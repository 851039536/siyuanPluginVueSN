# AGENTS.md

## 命令

```bash
# 开发模式（热重载，构建到思源工作区插件目录）
pnpm dev

# 生产构建（输出到 ./dist/ 并生成 package.zip）
pnpm build

# ESLint 检查 / 自动修复
pnpm lint
pnpm lint:fix

# 验证功能图标是否在已注册的图标集中
pnpm validate:icons

# i18n 操作
pnpm i18n:merge    # 合并分片 i18n 文件为 zh_CN.json / en_US.json（构建时自动执行）
pnpm i18n:verify   # 校验 zh_CN 与 en_US 键对齐 + 检测重复键
pnpm i18n:split    # 将合并后的 JSON 重新拆分为按功能的文件（极少需要）

# 版本发布（递增版本号 + 构建 + 生成 package.zip）
pnpm release:patch  # 1.0.0 → 1.0.1
pnpm release:minor  # 1.0.0 → 1.1.0
pnpm release:major  # 1.0.0 → 2.0.0
pnpm release:manual # 手动输入版本号
```

开发模式需要在根目录创建 `.env.local`，包含 `VITE_SIYUAN_WORKSPACE_PATH=C:/path/to/siyuan-workspace`。构建输出 CJS 库格式；`siyuan`、`process` 和 `node:*` 模块外部化。

---

## 架构

### 概述

这是一个基于 Vite + Vue 3 + TypeScript 构建的思源笔记插件（思源是一个 Electron 桌面知识管理应用）。它是一个**单体插件**，内含 40+ 个功能模块，每个模块均可通过功能开关独立启停。插件类 `PluginSample`（位于 `src/index.ts`）继承思源的 `Plugin` 基类。一个单一的 Vue 应用（`App.vue`）被创建并挂载到 `document.body`，作为所有功能 UI 的全局对话框/遮罩容器。

### 启动流程

1. `onload()`：`setupIconifyOffline()` 预加载图标数据 → `setFeatureFlagsDir()` 设置持久化 flag 存储 → `loadFeatureFlagsSync()` 从文件同步读取功能开关（因为 `addDock` 必须在 `onload` 同步阶段完成）→ `registerFeatures()` 根据开关条件注册各功能模块 → `initCommands()` 注册斜杠命令 → `init()` 创建并挂载 Vue 应用 → `loadAndApplySettings()` 异步加载完整加密配置并应用紧凑模式 + 主题。

2. `onunload()`：销毁所有持有持久资源的功能实例（定时器、Modal 实例），清除缓存的加密密钥，卸载 Vue 应用，移除 DOM 根元素。

### 功能模块目录结构

每个功能模块位于 `src/features/<featureName>/`，遵循以下规范布局：

```
feature/
├── index.ts          # registerFeature(plugin) — 入口，导出入口逻辑
├── index.vue         # 主 UI 组件（Dock 面板或持久化弹窗）
├── types/
│   ├── index.ts      # 类型定义 + Manager 类（此处不放 register 函数）
│   └── storage.ts    # class FeatureStorage { TypedStorage 槽位 }
├── composables/      # Dock 面板与弹窗视图间共享的 composable
├── components/       # 子组件
├── actions/          # 工具栏动作工厂函数（用于浮动工具栏）
└── styles/           # SCSS 文件（强制：样式必须从 .vue 文件中提取出来）
```

### 功能注册清单（8 步，缺一不可）

每个新功能必须触及 8 个位置：

1. **实现** `src/features/<feature>/index.ts` — 导出 `registerFeature(plugin)`
2. **类型** `src/features/<feature>/types/index.ts` — 仅放类型/Manager 类，不放 register 逻辑
3. **导出** `src/features/index.ts` — 添加 `export { registerFeature } from "./feature"` 并更新 `_Registered` 联合类型（编译时断言将其链接到 `FEATURE_CONFIG`）
4. **注册** `src/index.ts` → `registerFeatures()` — 添加 `if (s.enableXxx) registerXxx(this)`（统一单行模式，禁止在此处接收返回值做 `(this as any).__xxx =` 挂载，见下方「实例挂载与销毁模式」）
5. **设置** `src/config/settings.ts` — 在 `PluginSettings` 接口添加 `enableXxx: boolean` + `DEFAULT_SETTINGS` 添加默认值。含缩写词的 ID（如 `qrCode`、`aiContentGenerator`）需要在 `FEATURE_ID_TO_KEY_MAP` 中添加映射
6. **i18n** `src/i18n/{zh_CN,en_US}/<feature>.json` — 添加翻译，运行 `pnpm i18n:verify`
7. **配置** `src/features/config.ts` — 在 `FEATURE_CONFIG` 数组中添加条目；纯配置型功能（无 register 函数）还须加入 `_ConfigOnly` 白名单
8. **图标** `src/components/kit/icons.ts`（真源，`src/config/icons.ts` 为转发壳）— 添加到 `FEATURE_ICONS`，运行 `pnpm validate:icons`

**迁移现有功能为 Config-Only**：若功能不再独立注册（如 `base64Image` 迁移到 `toolCollection` 内），需：
- 将 `register` 函数改为 no-op（保留导出以维持编译通过）
- 在 `_ConfigOnly` 白名单中添加该功能 ID
- 从 `_Registered` 联合类型中移除，保留其在 `FeatureId` 中的存在

**实例挂载与销毁模式（强制）**：持有持久资源（定时器/监听器/persistent Modal/常驻 DOM）的功能，实例挂载必须在自己的 `registerFeature(plugin)` 内部完成：
- register 内部自挂载：`(plugin as any).__xxx = instance`，实例必须提供 `destroy()` 方法
- 字段名同步加入 `src/index.ts` 的 `DESTROYABLE_KEYS` 清单，由 `onunload` 统一循环销毁
- 禁止由 `registerFeatures()` 接收返回值再挂载（两套模式并存）；禁止在 `onunload` 中为个别功能写特例清理分支（无 destroy 方法的资源应在 register 内包一层 `{ destroy: cleanupFn }` 再挂载）
- 跨功能调度（App.vue 调用 `plugin.__xxx.toggle()` 等）依赖同一挂载点，挂载时机与调度入口保持一致
- 参考实现：`src/features/gitPush/index.ts`（Manager 自挂载）、`src/features/toolCollection/index.ts`（包装 destroy）

**验证链条**：完成全部 8 步后，由用户自行验证以下 4 项检查：
```bash
pnpm lint           # ESLint 代码规范（用户执行，AI 不运行）
pnpm i18n:verify    # 中英文键对齐
pnpm validate:icons # 图标注册有效性
pnpm typecheck      # TypeScript 类型检查（= vue-tsc --noEmit）
```
> **重要**：AI 不执行 `pnpm vite build` 和 `pnpm lint`。验证由用户自行完成。

> ⛔ **禁止新建临时校验脚本**（`.tmp-*.mjs` / `.tmp-*.js` 等一次性脚本，包括「离线编译 SCSS 校验 Token」这类做法）。
> 验证只走既有入口：`read_lints`（IDE 诊断）+ `pnpm typecheck` / `pnpm i18n:verify` / `pnpm validate:icons`；
> `pnpm lint` / `pnpm vite build` / SCSS 编译由用户执行。
> 需要**可复用**的检查能力时，在 `scripts/` 下以正式名称落地并在文档登记（如 `audit-hardcode.mjs`），不要写成临时文件。
> 详见 [AGENTS_BUILD.md § 构建与验证](./AGENTS_BUILD.md#构建与验证)。

> ⛔ **类型检查必须用 `pnpm typecheck`（`vue-tsc`），禁止用 `npx tsc --noEmit`**。
> `tsc` 读不懂 `.vue` 文件，只会退回 `src/types/vue.d.ts` 的通配 shim（该 shim 仅声明 `default` 导出、无任何具名类型），
> 于是**任何 `import type { X } from "*.vue"` 都会失败**，并使 `extends` 该类型的接口塌成 `{}` ——
> 产生大量**假错误**（实测：`featureRegistry.ts` 在 `tsc` 下报 30 个错、在 `vue-tsc` 下为 0 个）。
> 用错工具的代价是双向的：既会追查不存在的 bug，**也会漏掉真实错误**（`tsc` 无法校验传给 `.vue` 组件的 props 类型，
> 这类 `TS2769` 只有 `vue-tsc` 报得出来）。

### 功能模块内代码分层（强制）

模块内的 TypeScript 代码按职责分三层，杜绝复制粘贴：

| 层级 | 文件 | 内容 | 示例 |
|------|------|------|------|
| 类型 + 共享常量 | `types/index.ts` | 类型定义 + 被多文件共用的元数据映射、枚举列表、配置表 | `STATUS_META`（状态徽章元数据）、`REMOTES`（PLATFORM_META 精简投影） |
| 纯工具函数 | `utils.ts` | 不依赖 Vue 响应式的纯函数，可被任何文件导入；**超过 500 行硬阈值时拆为 `utils/` 目录 + 汇聚 `index.ts`（导出面保持不变，消费方 import 路径零改动）** | `hasAnyRemote(project)`、`resolveValidPath(project)` |
| 视图逻辑 | `.vue` 组件 / `composables/` | 模板相关状态、事件处理、composable 封装 | 组件本地 ref、watch、handleXxx 函数 |

**强制规则**：同一常量/工具函数被 2 个以上文件使用时，必须提取到对应的 `types/` 或 `utils.ts`，禁止复制粘贴。参考实现：`src/features/gitPush/`（`utils/` 已按域拆分为 11 个模块 + `index.ts` 汇聚）。

### 编译时注册完整性校验

`src/features/config.ts` 定义了 `FEATURE_CONFIG`（所有功能元数据的数组），并从中推导出 `FeatureId` 联合类型。`src/features/index.ts` 中有一个 `_Registered` 联合类型列出了所有有 `register` 导出的功能，并包含两个编译时断言：
- `_AssertRegisteredInConfig`：每个 `_Registered` ID 必须存在于 `FeatureId` 中（捕获配置删除不完整导致的孤立项）
- `_AssertAllCovered`：每个不在 `_ConfigOnly` 中的 `FeatureId` 必须存在于 `_Registered` 中（捕获配置新增但缺少导出）

如果注册链条两端任一断裂，TypeScript 将拒绝编译。

---

## 跨功能联动规则（强制）

**功能模块之间禁止直接相互导入**。跨功能联动必须通过事件总线 + App.vue 中心调度实现零依赖解耦。

> 正确模式、错误模式规则清单与完整代码示例见 [AGENTS_API.md § 跨功能联动规则](./AGENTS_API.md#跨功能联动规则强制) 及 [§ 跨功能联动示例](./AGENTS_API.md#跨功能联动示例)。

---

## 统一入口原则（强制）

所有跨功能的通用操作必须通过统一定义的入口。在功能代码中直接调用思源框架（`plugin.loadData`、`fetch`、`new CustomEvent` 等）属于违规。

| 场景 | 必须使用的 API | 位置 |
|------|-------------|----------|
| 存储 | `PluginStorage` / `TypedStorage<T>` | `@/utils/pluginStorage` / `@/utils/typedStorage` |
| AI 调用 | `callAI` / `callAIStream` / `callAISmart` / `callAIChat` / `getApiConfigFromPlugin` | `@/utils/aiApi` |
| 自定义事件 | `emitCustomEvent` | `@/utils/eventBus` |
| Dock 面板 | `createVueDockApp` | `@/utils/vueAppHelper` |
| Modal 弹窗 | `createModalVueApp` | `@/utils/vueAppHelper` |
| 剪贴板 | `copyToClipboard` | `@/utils/domUtils` |
| 下载 | `triggerDownload` / `triggerBlobDownload` | `@/utils/domUtils` |
| 动态样式 | `injectStyle(id, css)` / `removeStyle(id)` | `@/utils/domUtils` |
| 加密 | `cryptoPrimitives`（AES-GCM/PBKDF2 基元） | `@/utils/cryptoPrimitives` |
| Node 模块 | `getNodeModules()` 等 | `@/utils/nodeModules` |
| SQL 查询 | `sql()` | `@/api` |
| 思源 API | 对应的 `@/api` 封装函数 | `@/api` |
| 状态栏任务 | `useStatusBarTask` | `@/features/statusBar/composables/useStatusBarTask` |
| Markdown 渲染 | `parseMarkdown` / `convertHljsToInlineStyles` | `@/utils/mdRenderer` |
| 定时器 | `TimerRegistry`（`setInterval` / `setTimeout` / `clear` / `clearAll`） | `@/utils/timerRegistry` |
| Dock 预加载 | `registerDockPreload` / `runAllDockPreloads` / `refreshDockPreload` / `getDockPreloadState` | `@/utils/dockPreload` |
| 全局 `siyuan` | Props 传入的 `Plugin` 实例 | 禁止使用 `(window as any).siyuan` |

唯一例外：`src/config/settings.ts` 允许直接调用 `plugin.loadData/saveData`，仅用于单一的 `plugin-settings` 键。

> 上述各 API 的详细代码示例见 [AGENTS_API.md § API 参考](./AGENTS_API.md#api-参考)

---

## 共享组件库使用规则（强制）

`src/components/` 是**全项目唯一的 UI 控件来源**（52 个组件）。三条强制要求：**先查用法 → 优先复用 → 改 API 必同步**。

### 1. 先查用法，禁止猜 props

写任何 `src/components/` 组件之前，先查它的真实 props 与示例，**禁止凭记忆猜 props 名或取值**：

| 查询方式 | 位置 | 说明 |
|---------|------|------|
| **组件预览面板（推荐）** | 命令面板搜「组件预览」/ 状态栏功能列表 | 52 个组件的**真实渲染**快照 + 可复制代码；改完组件样式可直接目视回归 |
| 用法清单（源码） | `src/features/componentPreview/previewData/*.ts` | `props` 与 `code` 同源，是 props 的权威示例 |
| 组件源码 | `src/components/<Name>.vue` 的 `interface Props` | 最终事实来源（含 JSDoc 注释） |

- 图标只能传 `src/components/kit/icons.ts`（真源）已注册的 `IconKey`，不能传任意 Iconify 名
- 尺寸档位统一 `xsmall` / `small` / `medium` / `large`（默认 `small`）；字号阶梯与按钮交互/无障碍约定见 [AGENTS_STYLE.md § 强制规则：按钮交互与无障碍](./AGENTS_STYLE.md#强制规则按钮交互与无障碍2026-09-10)
- 需要比 `xsmall` 更紧凑的几何（迁移既有紧凑按钮）时，给 `Button` 叠加 `dense` 修饰：`<Button variant="ghost" size="xsmall" dense icon="refresh" title="刷新" />`。**`dense` 仅与 `size="xsmall"` 协同生效**（去 `min-height`、padding `2px 5px`、gap `3px`、圆角 `4px`，纯图标 20px），单独使用不产生效果；它不改变字号阶梯，10px 正文仍由档位承担

### 2. 优先复用，禁止在 feature 内自建同类控件

- 需要按钮 / 按钮式开关 / 浮动动作按钮 / 输入框 / 多行文本域 / 下拉 / 列表选择 / 开关 / 复选框 / 单选框 / 日期选择 / 滑块 / 标签 / 徽标 / 头像 / 卡片 / 图表 / 图标 / 加载态 / 颜色字段 / 输入框组合器 / 确认对话框 / **分页** / **时间线** / **分隔线** / **可折叠面板** / **可调整的分割面板** / **标签页切换** / **工具栏** / **气泡确认** / **对话框（模态弹层）** / **抽屉（侧边浮层）** / **文字提示（气泡）** / **文件上传（拖拽 / 选择）** / **大型菜单（多列导航）** / **级联菜单（逐级下钻）** / **侧边栏（布局型）** / **内联消息提示**时，**必须**使用共享组件（多行输入用 `Textarea`，不用 `Input` 的 `type="textarea"` 旧入口；**单按钮布尔开关用 `ToggleButton`，一组互斥选项的分段切换仍用 `Button` 分组 + `:aria-pressed`**；**多动作浮钮用 `SpeedDial`**）
- 共享组件缺能力时：**先扩展共享组件**（在 `interface Props` 加可选参数，保持向后兼容），再在 feature 中消费；禁止在 feature 内复制一份改改
- 允许自建的例外：纯展示的局部布局容器，以及 `.icon-btn` 这类无档位的 26×26 固定尺寸图标按钮（见 [AGENTS_STYLE.md § 核心规范速查表](./AGENTS_STYLE.md#核心规范速查表)）

### 3. 组件清单（52 个）

| 组件 | 职责 | 关键 props |
|------|------|-----------|
| `Button.vue` | 按钮：颜色轴 × 外观轴、四档尺寸、`dense` 紧凑修饰（仅与 `xsmall` 协同）、图标四向、加载 | `variant` / `severity` / `outlined` / `text` / `size` / `dense` / `icon` / `iconPosition` / `rounded` / `block` / `loading` / `type` / `title` / `ariaLabel` |
| `ToggleButton.vue` | 按钮式布尔开关（`v-model` 为 boolean）；**内部复用 `Button`（零样式复制）**，按下态切换文案/图标，四档尺寸、占满宽、禁用与校验态。**无内置文案**（不传 on/off 文案则退化为方形纯图标按钮）；`fluid` 默认 `false`（与 `Textarea.fluid` 相反，按钮天然内容宽） | `v-model` / `size` / `onLabel` / `offLabel` / `onIcon` / `offIcon` / `disabled` / `fluid` / `hint` / `error` / `name` / `type` / `tabindex` / `title` / `ariaLabel` / `ariaLabelledby` |
| `SpeedDial.vue` | 浮动动作按钮：8 向 × 四档轨迹（linear/circle/semi-circle/quarter-circle + radius）展开动作，**默认 `position: fixed` 悬浮于视口角落**（四档 `position` + `offset`）；**内部复用 `Button`（零样式复制）**；动作气泡走思源内置 `b3-tooltips`；`hideOnClickOutside` 默认 `true`；**不做 `mask`**；私有目录 `speedDial/`（types/geometry/useSpeedDial，禁止 feature 直接导入） | `model`（`SpeedDialAction[]`，必填） / `visible`（`v-model:visible`） / `direction` / `type` / `radius` / `transitionDelay` / `disabled` / `hideOnClickOutside` / `showIcon` / `hideIcon` / `rotateAnimation` / `position` / `offset` / `size` / `tooltipPosition` / `buttonProps` / `actionButtonProps` / `ariaLabel` / `ariaLabelledby` |
| `Paginator.vue` | 分页器：`page`（**1 基**）/ `rows` / `total` 三要素驱动，可开关首末页、页码链接（窗口滑动 + 两端省略号折叠）、数字报告（`{page}`/`{totalPages}`/`{rows}`/`{total}`/`{first}`/`{last}` 占位符）、每页条数下拉、跳页输入；**内部复用 `Button`/`Select`/`Input`（零样式复制）**；**越界页码自动收敛**、`rows` 变更自动回第 1 页；私有目录 `paginator/`（types/pageLinks/state，禁止 feature 直接导入） | `v-model:page` / `v-model:rows` / `total` / `size` / `showFirstLast` / `showPageLinks` / `pageLinkSize` / `showReport` / `reportTemplate` / `rowsPerPageOptions`（支持 `Array<number \| SelectOption>`） / `showJumpInput` / `alwaysShow` / `disabled` / `labels` |
| `Input.vue` | 单行输入（前后缀图标、清除、密码、字数计数、无边框内嵌）；`type="textarea"` 多行模式为**兼容保留** | `v-model` / `type` / `size` / `prefixIcon` / `suffixIcon` / `clearable` / `borderless` / `showPassword` / `showCount` / `error` / `rows` / `autosize` |
| `Textarea.vue` | 多行文本域：四档尺寸、描边/实底变体、自动增高、宽度控制与字数统计（**新代码一律用本组件**；`fluid` 默认 `true`，`autoResize` 时 `maxRows` 不传则不设上限） | `v-model` / `size` / `variant` / `fluid` / `autoResize` / `minRows` / `maxRows` / `rows` / `cols` / `resize` / `label` / `required` / `hint` / `error` / `showCount` / `maxlength` / `disabled` / `readonly` / `ariaLabel` / `ariaLabelledby` |
| `Select.vue` | 下拉选择（可筛选、可清除、可分组；**`role="combobox"` + listbox 无障碍语义、↑↓ 移动自动滚入视野、Esc 关闭返还焦点、打开定位已选项**） | `v-model` / `options` / `size` / `filterable` / `clearable` / `placement` / `maxHeight` / `emptyText` / `ariaLabel` / `ariaLabelledby` / `clearLabel` |
| `Listbox.vue` | 内联列表选择：单选 / 多选、复选指示（`checkbox`）与勾选指示（`checkmark`）、内置筛选、单项与整体禁用、错误态（**无分组与字段映射；键盘仅基础键；指示器为装饰元素、不复用 `Checkbox`**） | `v-model` / `options`(必填) / `multiple` / `checkbox` / `checkmark` / `highlightOnSelect` / `filter` / `filterPlaceholder` / `emptyText` / `maxHeight` / `size` / `disabled` / `error` / `label` / `required` / `hint` / `ariaLabel` |
| `ColorField.vue` | 颜色字段：色块 + 32 色自绘调色板弹层 + hex 文本双向联动（**思源 Electron 下原生 `input[type=color]` 不弹窗，禁止用原生取色器**） | `v-model` / `placeholder` |
| `FormField.vue` | 表单行容器：label + 控件 + hint/error + 字数计数 | `label` / `labelId` / `required` / `hint` / `error` / `size` / `showCount` / `countCurrent` / `countMax` |
| `InputGroup.vue` | 输入框组合器容器：与 `Input` / `Select` / `DatePicker` / `Button` / `InputGroupAddon` 无缝拼接为一体化控件（**组内成员禁带 label/hint/error；容器禁设 `overflow: hidden`**） | `size`（需与组内成员同档） |
| `InputGroupAddon.vue` | 输入框组合器附加项：前缀/后缀文本或图标，外观随 `InputGroup` 档位变量继承（可单独使用） | — |
| `Label.vue` | 表单标签文本（可带图标、必填星号）；**包裹控件建立隐式关联（`wrapper`）**；禁用态三入口（`disabled` / 容器 `data-disabled` / 邻近被禁用兄弟控件）；必填附无障碍替代文本 | `size` / `variant` / `state` / `icon` / `iconPosition` / `tag` / `for` / `width` / `align` / `disabled` / `wrapper` / `requiredText` |
| `Switch.vue` | 开关 | `v-model` / `label` / `size` / `loading` / `labelBefore` / `activeColor` |
| `Checkbox.vue` | 复选框（二元 / 数组分组多选 / 半选，描边与实底变体） | `v-model` / `value` / `trueValue` / `falseValue` / `binary` / `indeterminate` / `size` / `variant` / `label` / `hint` / `error` / `disabled` / `readonly` / `labelBefore` |
| `RadioButton.vue` | 单选框（单选组 / 二值模式，描边与实底变体；**同组必须传同一个 `name`，方向键与 ARIA 语义依赖原生单选组**） | `v-model` / `value` / `binary` / `size` / `variant` / `label` / `hint` / `error` / `disabled` / `readonly` / `name` / `inputId` / `labelBefore` |
| `DatePicker.vue` | 日期选择器（单选 / 区间、日-月-年三视图、`dateFormat` 模板、范围与禁用日期） | `v-model` / `selectionMode` / `view` / `dateFormat` / `valueFormat` / `minDate` / `maxDate` / `disabledDates` / `disabledDays` / `firstDayOfWeek` / `showClear` / `showButtonBar` / `manualInput` / `size` / `label` / `hint` / `error` / `disabled` / `readonly` |
| `Slider.vue` | 滑块（原生 `input[type=range]`；可显示当前值与极值，支持只读） | `v-model` / `size` / `min` / `max` / `step` / `showValue` / `showMinMax` / `formatValue` / `disabled` / `readonly` / `label` / `hint` / `error` |
| `Tag.vue` | 标签 / 行内徽标（参考 PrimeVue Badge 的「独立行内标签」语义 + PrimeVue Chip 的「带头像标签」语义，**与 `Badge.vue` 的角标职责不重叠**）：`variant` 颜色轴**同时容纳库内既有命名与官方 Badge severity 命名**（`default` / `primary` / `success` / `warning` / `danger` / `info` + 官方 `secondary` / `warn` / `error` / `contrast`；其中 `warning`≡`warn`、`danger`≡`error`、`default`≡`secondary` 为**同义别名**，样式层合并映射，`secondary` 走 surface / on-surface / border 中性族、`contrast` 走 on-background / background 反色对）；默认外观为「同色系 10% 浅底 + 100% 文字 + 20% 描边」，**`fill` 改为实底**（色块 100% 铺底 + 反差文字 + 去描边，对齐官方 Badge 的默认实底观感 —— 官方 Badge 本无描边、直接色块铺底）；`shape` 三档（`rounded` 默认 / `square` / **`circle` 圆形徽标**：固定最小边长 20px + 居中，宜放纯数字或单字，内容过长会被裁）；**`content` 为纯文本便捷入口**（对齐官方 Badge 的 `value`，不传默认插槽时直接渲染；数字按 `max` 折叠为 `${max}+`，对齐库内 `Badge.max` 语义；`max` **默认 99**，`<= 0` 视为不折叠）；**`image` 为头像位**（对齐官方 Chip：标签最左侧的圆形头像，典型用于人员 / 主体标签；与 `icon` **互斥且 `image` 优先**，图片 `@error` 时**自动回退渲染 `icon`**，不会出现破图占位 —— 同 `Avatar` 的 `hasError` 思路；`alt` 取 `imageAlt`，未传则取 `content` 的文本形式，无 `content` 时空串 = 装饰性图片交由读屏跳过；头像边长随档位 12/14/16/18px，与图标口径一致）；另有 `icon`（受 `IconKey` 约束）/ `closable`（关闭按钮可访问名称走 `closeLabel`，中文默认值 ⇒ **零 i18n 改动**）/ `disabled` 与三色自定义（`color` / `textColor` / `borderColor`，与 `fill` 同用时以自定义色为准）；四档 `size`（`xsmall` / `small` 默认 / `medium` / `large`，字号 10/12/14/16 驱动内边距与关闭按钮 10/12/14/16px）；⚠️ **与官方的有意差异**：不做官方 Badge 的 `size` 三档取值（`small` / `large` / `xlarge`）—— 本库统一四档阶梯；不做官方 Chip 的 `removeIcon`（改由库内固定图标承担，需要自定义请用插槽思路自建）；不做 `dt` / `pt` / `ptOptions` / `unstyled`。⚠️ 语义边界：`Tag` 是**行内**的独立标签 / 徽标（自身即内容，无包裹语义），`Badge` 是**角标**（包裹内容并在四角叠加标记，props 为 `content` / `dot` / `position` / `max`）—— **按语义各取所需，勿混用** | `size` / `variant` / `shape` / `fill` / `content` / `max` / `icon` / `iconSize` / `image` / `imageAlt` / `closable` / `closeLabel` / `closeIconSize` / `disabled` / `color` / `textColor` / `borderColor` |
| `Badge.vue` | 徽标/角标（圆点、四角定位、上限折叠） | `content` / `dot` / `size` / `variant` / `position` / `max` / `offset` / `hidden` |
| `Inplace.vue` | 就地编辑（参考 PrimeVue Inplace）：**只读输出与编辑内容两态互换** —— 点 `display` 插槽内容即切到 `content` 插槽，收起时**焦点归还 `display`**（官方语义，避免键盘用户丢失位置）；`active` **传入即受控 / 不传即自持**（与 `Panel.collapsed` / `Tooltip.visible` 同一范式，派发 `update:active`）；`disabled` 时 `display` 既不可点击也不可聚焦（不输出 `role="button"` / `tabindex`，并置 `aria-disabled`）；⚠️ **组件自身不含任何文案**（两态内容全由插槽给出）⇒ 调用方自备文案，**零 i18n 分片改动**；`display` 为 `role="button"` + `tabindex="0"`，指针点击与 **Enter** 均可展开（键盘可达性的关键：官方只绑 `@keydown.enter`，本项目同）；⚠️ 编辑态内容需**自行接线 `closeCallback`**（作用域 `content` 给出）才能收起 —— 组件不猜内部结构（同 `FileUpload.header` / `Panel.togglebutton` 的既有约定）；三事件 = `update:active` / `open` / `close`，⚠️ `close` 载荷为 `Event \| null`（程序化关闭时无原生事件，同 `Message.close` 用 `MouseEvent \| null` 区分来源的做法）；`defineExpose` 暴露 `open()` / `close()` 供程序化开合；根容器 `aria-live="polite"`（官方同）；`display` 常态无边框，**悬停/聚焦时才显虚线框**（提示「可点击编辑」，Codex 边框优先不用阴影；以边框变色作为可见焦点指示，故不叠加 outline）；**与官方有意差异**：不做 `displayProps` 对象袋（同 `Panel` 拒绝 `toggleButtonProps` 的判据，改由调用方在 `display` 插槽内自建结构并自行打类）与 `dt` / `pt` / `ptOptions` / `unstyled` | `active` / `disabled` |
| `FocusTrap.vue` | 焦点陷阱（参考 PrimeVue FocusTrap）：**把 Tab 焦点限制在包裹区域内** —— Tab 在末位回绕到首位、Shift+Tab 在首位跳到末位（中间位置**不干预**，交还浏览器原生 Tab 语义），另有**焦点逃逸拉回**（`focusin` 冒泡到容器，若新焦点不在容器内则拉回内部并派发 `focusEscaped`，这是「陷阱」的实质：模态弹层内点空白不该把焦点丢给背后的页面）；挂载时自动聚焦（`autoFocus` **默认 `true`**，优先 `initialFocus` 选择器 → 首个可聚焦元素 → 容器自身兜底）；`trapFocusIn`（默认 `true`）可只保留 Tab 回绕、放开外部聚焦（适合非模态浮层）；⚠️ **`disabled` 与 `autoFocus` 刻意解耦** —— `disabled` 只关「困住」，不关「自动聚焦」（对齐官方语义），`autoFocus` 独立生效；`defineExpose` 暴露 `focus()` 供「异步内容就绪后再聚焦」的场景；⚠️ 官方是指令（`v-focustrap`），本项目按仓库硬规则（`src/components/` 是唯一 UI 出口、组件须能进预览面板与清单）**做成组件** —— 与 `Tooltip` 由指令改组件的先例一致；**纯行为、零视觉**（不设内边距 / 边框 / 底色 / 尺寸，避免改变调用方布局 —— 这是它与 `Card` / `Panel` 这类容器型组件的根本区别）；可聚焦元素判定与回绕边界算法外置为私有纯函数 `focustrap/focusable.ts`（**排除 `[tabindex="-1"]`** —— 那是可编程聚焦但 Tab 到不了的节点；并逐个过滤 `disabled` / `[inert]` 子树 / `getClientRects()` 为空的不可见元素；⚠️ 按 DOM 顺序而非真实 Tab 顺序，因库内组件一律不用正 `tabindex`，两者等价，属可接受的有意简化）；⚠️ **不做**：`dt` / `pt` / `ptOptions` / `unstyled`；⚠️ 与库内 `overlay/useOverlay` 的分工：`useOverlay` 负责**弹层打开时的初始焦点与关闭归还**，本组件负责**持续困住**，两者互补不重叠（`useOverlay` 第 39 行原注「不做 FocusTrap」仍然成立 —— 那是弹层外壳的有意裁剪，本组件是独立可选的显式包装） | `disabled` / `autoFocus` / `trapFocusIn` / `initialFocus` |
| `MeterGroup.vue` | 多段进度条（参考 PrimeVue MeterGroup）：**把一组数值按区间换算为百分比并排成一条**，可选标签列表 —— 用于「磁盘占用由应用/系统/其他构成」这类**占比拆解**展示（与 `FileUpload` 内那条单值进度条职责不同：那是「单一进度」，本组件是「多项占比构成」）；`value` 为 `MeterItem[]`（`{ label, value, color?, icon? }`，⚠️ 图标受 `IconKey` 约束、**不照搬官方 `[key: string]: any` 索引签名**，那会让类型检查形同虚设）；`min`（默认 0）/ `max`（默认 100）定义区间，各段长度 = `(value - min) / (max - min)` —— ⚠️ 是**每项各自映射到整个区间**（而非「各项之和占区间」），与官方一致，典型用法为各项之和等于 `max`；百分比**钳制到 0~100 并四舍五入**（`> max` 或 `< min` 不会撑破容器），⚠️ **`min === max` 时区间跨度为 0，除法会得 `NaN`** ⇒ 显式判为 0（`toPercent` 内的守卫，含 `Infinity` / 非有限值兜底）；`orientation`（`horizontal` 默认，条从左往右 / `vertical`，条从下往上 —— 竖向用 `column-reverse` 让首项落在最底，符合「累计自下而上」直觉）；`labelPosition`（`end` 默认 / `start`）+ `labelOrientation`（`horizontal` 默认 / `vertical`）；插槽 = `label`（作用域 `{ value, totalPercent, percentages }`，整块替换标签列表）/ `meter`（`{ value, index, orientation, size, totalPercent }`，替换单段 —— ⚠️ 官方另有 `class` 作用域参数，本项目**不提供**：类名是其 PT 体系的产物，库内一律由调用方自行打类）/ `start` / `end`（均 `{ value, totalPercent, percentages }`，位于条的两侧）；⚠️ 百分比为 0 的项**不渲染条段**（否则留下 0 宽/高的空 `div`，还会吃掉 flex 段间间隙），但仍出现在标签列表中；**无自有事件、无自有状态**（纯展示：`value` 即全部输入）；根元素 `role="meter"` + `aria-valuemin` / `aria-valuemax` / `aria-valuenow`（对齐官方；⚠️ `aria-valuenow` 取**总值百分比**）；私有目录 `metergroup/`（types / MeterGroupLabel，禁止 feature 直接导入），百分比计算（`toPercent` / `toTotalPercent` / `toCumulativePercents`）外置为纯函数便于单独推理；⚠️ `toTotalPercent` **先逐项取整再求和**（官方为「总和后取整」）—— 因为条段宽度就是逐项取整后的值，两者同口径，标签里显示的累计值才与目视条段长度一致（代价是三项各 33% 时总显示 99%，属有意取舍）；⚠️ 无 `size` 档位（字号固定 `$t-xs`，同库内其它容器型组件）；**与官方有意差异**：不做 `dt` / `pt` / `ptOptions` / `unstyled`；⚠️ 颜色走 `MeterItem.color` 的**行内 style**（颜色来自数据、每项可不同，无法预生成类名 —— 同 `Tag.color` 的既有做法） | `value` / `min` / `max` / `orientation` / `labelPosition` / `labelOrientation` |
| `ProgressBar.vue` | 进度条（参考 PrimeVue ProgressBar）：**单值进度指示** —— ⚠️ 与上一行的 `MeterGroup` 正好配对（**单值 vs 多值占比**）：`ProgressBar` 是「一件事做到几成」（上传 / 安装 / 加载），`MeterGroup` 是「一块蛋糕怎么切」（磁盘占用构成）；`value`（0~100，**超出范围钳制**而非溢出容器，非有限值 `NaN` / `Infinity` 一律判 0 —— 否则会渲染出 `NaN%` 宽度使整条塌陷）；`mode`（`determinate` 默认 / `indeterminate` 进度未知）；⚠️ 不定态**忽略 `value`**，且 `aria-valuenow` **缺省**（进度未知时给具体数值是错误语义），改由 `aria-valuetext` 承载 `indeterminateLabel`（默认「进行中」，可覆盖为调用方 i18n ⇒ 零 i18n 分片改动）；`showValue`（默认 `true`；⚠️ 渲染判据逐字对齐官方 `value != null && value !== 0 && showValue` —— **0 与未提供都不渲染标签**，故「进度 0」时看不到「0%」文字，这是官方既定行为）；四档 `size`（`xsmall` 4px / `small` 默认 8px / `medium` 12px / `large` 18px，驱动条高与字号 —— ⚠️ 官方**无 `size` prop**，属本项目按库规范扩展；`xsmall` 的 4px 与 `FileUpload` 内联进度条同档）；插槽 = 默认插槽（替换标签文本，不传则显示 `{value}%`）；**无自有事件、无自有状态**（纯展示）；⚠️ **与官方的结构差异（有意）**：官方把标签**嵌在填充条内部**（跟随条移动），条极短时标签会溢出被裁；本项目把标签改为**轨道的兄弟节点**（右侧旁注），无论条多短都稳定可读（故 DOM 上多一层 `.si-progressbar__track` 承载 `role="progressbar"` —— 进度语义挂轨道、标签只是旁注）；标签用 `tabular-nums` + `min-width: 2.5em` 保证数值跳动时轨道宽度不抖；不定态动画用 `transform`（**不用 `left`**，前者由合成器处理、不触发布局重排，同 `Loader` 的既有做法）并配 `prefers-reduced-motion: reduce` 降级为静态半透明块；**与官方有意差异**：不做 `dt` / `pt` / `ptOptions` / `unstyled` | `value` / `mode` / `showValue` / `size` / `indeterminateLabel` |
| `Avatar.vue` | 头像（图片/文字/图标，5 档尺寸含 `xlarge`） | `src` / `text` / `icon` / `size` / `shape` / `customSize` / `clickable` |
| `Card.vue` | 卡片容器（标题/副标题/封面/主体/底部/加载/激活）；具名插槽 `title` / `subtitle` / `content`（`content` 未传时**回落默认插槽**，官方写法可直接照搬），另有 `header`（**本项目为带下边框的标题栏，非官方通栏语义**） / `header-extra` / `cover`（对应官方通栏区） / `footer` | `variant` / `size` / `title` / `subtitle` / `cover` / `clickable` / `loading` / `rounded` / `bodyNoPadding` / `contentClass`（主体容器类名钩子，对应官方 `contentClass`） / `captionClass`（标题区容器类名钩子，对应官方 PT 的 `caption`） |
| `Dialog.vue` | 对话框（**通用模态容器**，与 `ConfirmDialog` 共用私有目录 `overlay/` 的弹层外壳）：受控 `visible`（配 `v-model:visible`）+ `header` / 内容区 / `footer` 三段结构（`showHeader` 控制标题栏、`closable` 控制右上角关闭按钮、`footer` 文本或插槽存在才渲染页脚）+ **九档 `position`**（`center` 默认 / 四边 / 四角，模板类驱动、零 JS 定位）+ 四档 `size`（驱动弹窗宽度 320/400/520/680px、内边距与基准字号 10/12/14/16；`max-height: 80vh`、1px 描边、圆角 `$r-base` **恒定**，**不用阴影**——层级靠遮罩对比）；关闭路径 = 关闭按钮 / Esc（`closeOnEscape` 默认开）/ 遮罩点关（`dismissableMask` **默认 `false`，与官方一致**，且**需在遮罩上按下并抬起**才算数，弹层内按下、遮罩上抬起不误关）/ 插槽内自建按钮；`modal` **默认 `true`**（官方默认 `false`，属**有意差异**：本项目遮罩恒定渲染，非模态时加 `--plain` 让遮罩透明且 `pointer-events: none`，页面其余部分仍可交互，点关随之失效）；**焦点**：打开时优先聚焦容器内 `[autofocus]`（footer → header → content 顺序）、否则聚焦容器，关闭时归还打开前元素；`aria-labelledby` 指向标题元素（`showHeader` 且有 `header` 文本或 `header` 插槽时），否则回退 `ariaLabel`；六个插槽 = `default`（**内容区**）/ `header`（作用域 `{ class, headerId }`）/ `footer` / `closebutton`（`{ closeCallback }`）/ `closeicon` / `container`（`{ closeCallback }`）；四个事件 = `update:visible` / `show`（过渡 enter）/ `hide`（过渡 leave）/ `after-hide`（过渡 after-leave）；私有目录 `overlay/`（types / useOverlay，禁止 feature 直接导入）；**与官方有意差异**：不做 `draggable`（官方默认开）/ `maximizable` / `breakpoints` / `appendTo`（**不 Teleport，就地 fixed**）/ `blockScroll` / ZIndex 管理 / FocusTrap 与 `dt` / `pt` / `ptOptions` / `unstyled`，`container` 插槽亦无官方 `maximizeCallback` / `initDragCallback` | `visible` / `header` / `footer` / `modal` / `closable` / `dismissableMask` / `closeOnEscape` / `showHeader` / `position` / `size` / `closeLabel` / `ariaLabel` |
| `Drawer.vue` | 抽屉（**贴边浮层容器**，`Dialog` 的「贴边 + 轴向滑入」姊妹组件，参考 PrimeVue Drawer）：受控 `visible`（配 `v-model:visible`）+ `header` / 内容区 / `footer` 三段结构 + **四向 `position`**（`left` 默认 / `right` / `top` / `bottom`，模板类驱动、零 JS 定位）+ 四档 `size`（**贴合边方向上的延伸量** 320/400/520/680px，沿边方向恒铺满；驱动内边距与基准字号 10/12/14/16）；**贴边侧不画描边、圆角只在朝内一侧**（Codex 边框优先，**不用阴影**）；四向轴向滑入过渡（`0.12s ease`，**不叠加缩放**——`Dialog` 是 fade + scale 0.98）；遮罩 / 点关判定 / Esc / 焦点接管与归还**全部复用私有目录 `overlay/`**（`useOverlay` + `useOverlay` 的「按下并抬起」点关语义，与 `Dialog` / `ConfirmDialog` 同一套）；六个插槽 = `default`（**内容区**）/ `header`（作用域 `{ class, headerId }`，比官方多给 `headerId` 以便建立 `aria-labelledby`）/ `footer` / `closebutton`（`{ closeCallback }`）/ `closeicon` / `container`（`{ closeCallback }`）；四个事件 = `update:visible` / `show` / `hide` / `after-hide`（与 `Dialog` 事件集**完全一致**）；私有目录 `overlay/`（types / useOverlay，禁止 feature 直接导入）；**与官方有意差异**：不做 `full` 位置档（全屏浮层由 `Dialog` 九档位置承担）、不做 `blockScroll` / `closeButtonProps` / `closeIcon` / `baseZIndex` / `autoZIndex` 与 `dt` / `pt` / `ptOptions` / `unstyled`；**命名统一**：官方 `dismissable` → 本项目 `dismissableMask`、官方 `showCloseIcon` → 本项目 `closable`（与库内 `Dialog` / `ConfirmDialog` 同名同义）；`modal` 与 `Dialog` 同口径**默认 `true`**（官方默认亦为 `true`），非模态时遮罩透明且 `pointer-events: none`（点关随之失效） | `visible` / `header` / `footer` / `position` / `size` / `modal` / `closable` / `dismissableMask` / `closeOnEscape` / `showHeader` / `closeLabel` / `ariaLabel` |
| `ConfirmDialog.vue` | 确认对话框：受控显示（`v-model:visible`）+ **九档 `position`**（`center` 默认 / 四边 / 四角，模板类驱动、零 JS 定位）；**命名对齐官方 `ConfirmationOptions`**（`header` / `message` / `icon` / `acceptLabel` / `rejectLabel`），但**驱动方式为受控**（官方靠 `useConfirm().require()` 命令式服务 + `group`，本项目零全局服务）；`acceptSeverity`（`danger` 默认 / `primary`）取代官方 `acceptProps.severity` 对象袋（与 Panel 拒绝 `toggleButtonProps` 同一判据，更自由诉求走 `container` 插槽）；另有 `acceptIcon` / `rejectIcon` / `acceptLoading`（异步确认）/ `closable`（**默认 `false`**，官方 Dialog 默认 `true` 属有意差异）/ `closeOnEscape` / `dismissableMask`（官方 Dialog 命名，替代旧的 `closeOnMask`）/ `size`；插槽 = 官方五个（`message` 作用域 `{ message, icon }`（官方给 `ConfirmationOptions` 对象，属有意差异）/ `icon` `{ class }` / `accepticon` / `rejecticon` / `container`（作用域含 `header` / `message` / `icon` / `acceptLabel` / `rejectLabel` 与 `closeCallback` / `rejectCallback` / `acceptCallback`；**不提供官方 `initDragCallback`**，因不做 `draggable`））+ 保留**默认插槽**（优先级：默认插槽 > `message` 插槽 > `message` prop）；内容段由私有子部件 `confirm/ConfirmBody.vue` 渲染（私有目录 `confirm/` 含 types / position / ConfirmBody，禁止 feature 直接导入）；**遮罩点关 / Esc / 焦点接管与归还已改由私有目录 `overlay/` 提供**（`useOverlay`，与 `Dialog` 共用，禁止 feature 直接导入）——点关判定由原 `@click.self` 升级为官方「在遮罩上按下并抬起」语义（弹层内按下、遮罩上抬起不误关），公开 props / 事件 / 插槽 / 类名零变更；事件 = `update:visible` / `confirm`（**不自动关闭**，便于异步）/ `cancel`；⚠️ 官方**没有 `header` / `footer` 插槽**（`header` / `footer` / `title` / `headerActions` / `content` / `mask` 只是 PT 段落名） | `visible` / `header` / `message` / `icon` / `acceptLabel` / `rejectLabel` / `acceptSeverity` / `acceptIcon` / `rejectIcon` / `acceptLoading` / `closable` / `closeOnEscape` / `dismissableMask` / `position` / `size` |
| `ConfirmPopup.vue` | 气泡确认：受控显示 + **`target` 锚点**（`HTMLElement \| (() => HTMLElement \| null)`），弹出在触发元素旁（**非模态、无遮罩**）；定位为 `position: fixed` + 视口坐标（**不 Teleport**，与 Select / DatePicker 的相对定位范式一致），**八向 `placement`**（`auto` 默认：优先下方、放不下上翻、水平居中；显式方位只做视口 8px 钳制、**不翻转**）并带 8px 指向三角；监听 `window` 的 `scroll`（`capture: true`，覆盖任意滚动容器）与 `resize`，**rAF 节流**重算；定位计算外置为纯函数 `confirm/position.ts`；`dismissable`（默认 `true`：点组件与锚点之外关闭）/ `closeOnEscape` / `ariaLabel`；内容段与插槽集合**与 `ConfirmDialog` 完全一致**（共用 `confirm/ConfirmBody.vue`），但**无 `closable`**（气泡靠点外部 / Esc 关闭）；事件 = `update:visible` / `confirm` / `cancel`；打开时焦点给气泡容器（避免 Enter 误触危险操作），关闭时归还锚点 | `visible` / `target` / `header` / `message` / `icon` / `acceptLabel` / `rejectLabel` / `acceptSeverity` / `acceptIcon` / `rejectIcon` / `acceptLoading` / `placement` / `dismissable` / `closeOnEscape` / `size` / `ariaLabel` |
| `Timeline.vue` | 时间线：`value` 事件集合 + 两向 `layout`（`vertical` 默认：事件自上而下、线在左/右；`horizontal`：事件自左向右、线在上/下）× 三档 `align`（竖向 `left` 默认 / `right` 镜像 / `alternate` 左右交替；横向 `top` 默认 / `bottom` 镜像 / `alternate` 上下交替），渲染由 `content`（必填）/ `opposite` / `marker` 三个插槽驱动（作用域 `{ item, index }`）；**纯展示无交互、无自有事件**（节点上的点击由调用方在插槽内自行提供）；`opposite` 容器恒渲染（两侧等宽 / 等高、线位置稳定），`alternate` 按奇数索引反向；默认节点为主题色空心圆，连接线取 `--b3-border-color` 且**末项不延长**；四档 `size` **只驱动字号**（节点直径 10px / 线宽 2px 恒定）；私有目录 `timeline/`（types，禁止 feature 直接导入） | `value`（必填）/ `layout` / `align` / `size` |
| `Tabs.vue` | 标签页容器（**五件套之首**，与 `TabList` / `Tab` / `TabPanels` / `TabPanel` 共用「Tabs」一个预览分区）：`value`（**传入即受控**，配 `v-model:value`；不传时内部自持 = 非受控，两种模式都派发 `update:value`）+ `lazy`（未激活面板是否完全**不进 DOM**，默认 `false` 时仅 `display:none` 隐藏并**保留面板内状态**）+ `selectOnFocus`（焦点移入即选中）+ `tabindex`（roving tabindex 基准：激活标签取该值、其余 `-1`，面板共用，传 `-1` 可把整组移出 Tab 序列）+ `scrollStrategy`（激活标签滚动策略：`nearest` 默认（越界才滚，留 10% 缓冲）/ `center` / `false` / 自定义函数）；`update:value` **幂等**（值未变不派发）；四档 `size` 驱动字号 10/12/14/16 与标签水平内边距、面板上边距（**下划线厚度与标签栏分隔线恒定**）；根 `width: 100%`；私有目录 `tabs/`（types/context，禁止 feature 直接导入）；**与官方有意差异**：不做 `showNavigators` 与 `previcon` / `nexticon`、不做已废弃的 `scrollable`、不做 `as` / `asChild` 多态渲染与 `dt` / `pt` | `value` / `lazy` / `selectOnFocus` / `tabindex` / `scrollStrategy` / `size` |
| `TabList.vue` | 标签栏容器（配套组件）：`div > div[role="tablist"][aria-orientation="horizontal"]`，内容容器**横向可滚动且滚动条隐藏**；激活值变化（含首次挂载）时把激活标签**自动滚入视野**；`ariaLabel` / `ariaLabelledby` 命名整组（其余 attrs 透传到根）。**滚动导航按钮不提供**（官方 `showNavigators` 的产物） | `ariaLabel` / `ariaLabelledby` |
| `Tab.vue` | 单个标签（配套组件）：`<button type="button" role="tab">` + `aria-selected` / `aria-controls` / `id`（`${tabsId}-tab-${value}`）+ roving `tabindex` + 原生 `disabled`；`value` **必填**（与同值 `TabPanel` 配对，**用严格相等判定激活** —— 官方 `equals()` 深比较是为支持任意类型，本项目 `value` 限定 `string \| number`）；**键盘键位完全对齐官方**：←/→ 移焦点并回绕、Home / End 跳首末、PageUp / PageDown **仅滚动不聚焦**、Enter / 空格选中（焦点移动 = `focus()` + `scrollIntoView({ block: "nearest" })`；相邻项查找走容器内 `[role="tab"]` 过滤禁用项后按索引取，官方为兄弟遍历并跳过其墨条元素） | `value`（必填）/ `disabled` |
| `TabPanels.vue` | 面板容器（配套组件）：纯结构 `div` + 默认插槽，无 role；隐藏由各自的 `TabPanel` 负责 | — |
| `TabPanel.vue` | 单个面板（配套组件）：`role="tabpanel"` + `id`（`${tabsId}-tabpanel-${value}`）+ `aria-labelledby` 指向对应标签 + `tabindex`（取 `Tabs` 的 `tabindex`）；**`lazy` 双开关**：`v-if="lazy ? active : true"` + `v-show="lazy ? true : active"`；**默认插槽无作用域参数**（官方仅 `asChild` 模式下才传 `{ class, active, a11yAttrs }`，本项目不做 `asChild`） | `value`（必填） |
| `Toolbar.vue` | 工具栏：三段式布局容器（`start` 左 / `center` 居中 / `end` 右），**三个容器恒定渲染**（未传内容时仍占位，位置不随内容增删跳动）；官方契约只有 `start` / `center` / `end` 三个**无作用域参数**的插槽与 `ariaLabelledby` 一个业务 prop，**无自有事件、无自有状态**；本项目扩展：`variant`（`outlined` 默认 = surface 底 + 1px `--b3-border-color` / `filled` 实底无边框 / `borderless` 无边框无底色）+ `padded`（默认 `true`，关闭后四向贴合但**仍保留档位最小高度**）+ `wrap`（默认 `false`，开启后 `start` 独占首行、`center` / `end` 落次行并分居两端）+ 四档 `size`（字号 10/12/14/16，驱动内边距、最小高度 28/36/44/54px 与段间距，**边框 1px 与圆角 6px 恒定**）+ `ariaLabel`（官方只有 `ariaLabelledby`）；`center` 用「两端各 `flex: 1 1 0` 配平」实现**精确居中**（官方 `space-between` 在三段俱全时只能大致居中，属有意改进）；⚠️ **档位传不进插槽** ⇒ 内部共享控件（`Button` / `Input` 等）需由调用方显式传同档 `size`，否则高度脱节；不引入官方 `dt` / `pt` / `ptOptions` / `unstyled`，且用默认 attrs 透传（官方为 `inheritAttrs: false` + PT） | `variant` / `size` / `padded` / `wrap` / `ariaLabel` / `ariaLabelledby` |
| `Divider.vue` | 分隔线：三种线型（`solid` 默认 / `dashed` / `dotted`）× 两个方向（`horizontal` 默认 / `vertical`）× 三档内容位置（水平 `left`/`center`/`right`，垂直 `top`/`center`/`bottom`；**未传按居中、取值与方向不匹配时静默回落居中**，与官方一致）；**仅有默认插槽**（无具名/作用域参数），不传时整条线贯通；**纯展示无交互、无自有事件**；**用两段真实线段实现**（非官方「内容遮罩底色」法，因本项目父容器底色有多种）；垂直方向需父容器有确定高度且内置 `min-height` 兜底；线色取 `--b3-border-color`，水平 `margin: $s-3 0` / 垂直 `margin: 0 $s-3`（可被调用方覆盖）；单根元素 ⇒ `class` / `style` 直接透传 | `type` / `layout` / `align` |
| `Panel.vue` | 面板：可折叠的内容容器（`header` 文本 + `toggleable` 折叠 + `collapsed` 受控/非受控双模式，**不传 `collapsed` 时内部自持、可独立开合**；**未开启 `toggleable` 时忽略 `collapsed`**）；6 个插槽 = `default` / `header`（作用域 `{ collapsed }`）/ `icons` / `togglebutton`（作用域 `{ collapsed, toggleCallback, keydownCallback }`）/ `toggleicon`（`{ collapsed }`）/ `footer`，2 个事件 = `update:collapsed` / `toggle`；**与官方三处有意差异**：不提供 `toggleButtonProps`（改由 `togglebutton` 插槽覆盖）、`header` 作用域只给 `{ collapsed }`、**折叠用 `v-show` 瞬时收起 + 图标 0.12s 旋转（不做官方高度动画）**；切换按钮为共享 `Button` 纯图标 ⇒ `aria-label` 走 `toggleLabel`（中文默认值，零 i18n 改动）+ `aria-expanded` / `aria-controls` | `header` / `toggleable` / `collapsed` / `toggleLabel` |
| `Splitter.vue` | 分割面板容器：`layout`（`horizontal` 默认 / `vertical`）+ `gutterSize`（分隔条 px，默认 4，同时决定拖拽命中区）+ `step`（方向键步进百分比，默认 5）+ `disabled` + `sizes`（**传入即受控**，配合 `v-model:sizes`）+ `stateKey` / `stateStorage`（Web Storage 持久化，受控时不读写）+ `resizeLabel`（分隔条无障碍名称，中文默认值 ⇒ 零 i18n）；事件 = `update:sizes` / `resizestart` / `resize` / `resizeend` / `collapse`，另暴露 `resetState()`；**分隔条渲染在面板内侧**（见 `SplitterPanel.vue`），拖拽走 Pointer Events + `setPointerCapture`，键盘 ←→ / ↑↓ 按 `step` 调整；私有目录 `splitter/`（types/sizes，禁止 feature 直接导入） | `layout` / `gutterSize` / `step` / `disabled` / `sizes` / `stateKey` / `stateStorage` / `resizeLabel` |
| `SplitterPanel.vue` | 分割面板（`Splitter` 的**配套组件**，与 `Splitter` 共用「Splitter」一个预览分区）：`size`（初始百分比，未指定者与其它未指定者均分剩余）+ `minSize` / `maxSize`（夹取范围）+ `collapsible` / `collapsedSize`（拖到 `minSize` 以下**吸附折叠**）；**自渲染 `flex-basis` 与左（上）侧分隔条**（首个面板无分隔条）；未注入 Splitter 时退化为普通容器 | `size` / `minSize` / `maxSize` / `collapsible` / `collapsedSize` |
| `Chart.vue` | 图表（chart.js：line/bar/pie/doughnut/area） | `type` / `data`（必填）/ `size` / `title` / `loading` / `theme` / `emptyText` |
| `IconWrapper.vue` | 图标（按 `IconKey` 渲染 Iconify） | `name`（必填）/ `size` / `color` / `title` |
| `Tooltip.vue` | 文字提示（锚点旁气泡，参考 PrimeVue Tooltip；⚠️ 官方是**指令** `v-tooltip`，本项目按仓库约定做成**组件**）：`text`（或默认插槽）+ **`target` 锚点**（`HTMLElement \| (() => HTMLElement \| null)`，通常传触发元素的 ref；取不到时退化为视口居中）+ **`visible` 传入即受控 / 不传即自持**（非受控，与 `Panel.collapsed` 同一范式）+ 四向 `placement`（`top` 默认 / `bottom` / `left` / `right`）+ **`auto`**（**优先上方**、空间不足下翻；⚠️ 偏好与 `ConfirmPopup` 的「优先下方」相反，因官方 Tooltip 默认方位是 top）+ `trigger`（`both` 默认 / `hover` / `focus`，**focus 默认开启**：键盘用户的信息可达路径）+ `showDelay` / `hideDelay`（默认 0）+ 四档 `size`（只驱动字号 10/12/14/16 与内边距，气泡宽度随内容自适应）+ `maxWidth`（默认 240，超长文案在气泡内换行）+ `disabled`；**非模态、无遮罩、不可交互**（`pointer-events: none`，避免气泡盖住锚点导致 pointerleave 抖动）；定位为 `position: fixed` + 视口坐标（**不 Teleport**，与 `ConfirmPopup` 同一范式），**复用 `confirm/position.ts` 的几何计算与视口 8px 钳制**（零复制粘贴，只补 auto 的上方偏好），带 8px 指向三角；`window` 的 `scroll`（`capture: true`，覆盖任意滚动容器）与 `resize` 触发 **rAF 节流**重算，气泡跟随锚点；锚点晚于组件挂载出现时用**有界轮询**（每 200ms、上限 15 次，对齐仓库既有的 DOM 就绪轮询约定）补挂监听；三事件 = `update:visible` / `show` / `hide`；私有目录 `tooltip/`（types / position，禁止 feature 直接导入）；**与官方有意差异**：不做 `escape` / `fitContent` / `autoHide`（气泡不可交互，二者无意义）/ `id` / `class`（走默认 attrs 透传）/ `dt` / `pt` / `ptOptions` / `unstyled`；**官方靠修饰符表达的方位**（`v-tooltip.top` 等）在本项目改为 `placement` prop | `text` / `target` / `visible` / `placement` / `trigger` / `showDelay` / `hideDelay` / `size` / `disabled` / `maxWidth` |
| `FileUpload.vue` | 文件上传（参考 PrimeVue FileUpload）：**拖拽区 + 点击选择 + 多文件列表与图片缩略图 + 校验提示 + 进度条**；`mode` 双档（`advanced` 默认（拖拽区 / 列表 / 操作栏）/ `basic`（仅选择按钮 + 数量徽标，适合作工具栏内嵌））；**队列为非受控自持**（组件持有 `File[]`，经 `select` / `remove` / `clear` 事件对外通报）——与官方一致，且不必让调用方接管每次增删；**校验内置且只拒绝不合格项**（`accept` 支持 `.pdf` / `image/*` / `image/png` 三种形态混用、`maxFileSize` 字节上限、`fileLimit` 数量上限按「已有 + 本次」累计判断，**超限只拒绝溢出部分而非一票否决整批**），失败项以 `invalid` 事件 + 行内提示双通道给出（文案含 `{0}`/`{1}` 占位符插值，全部可覆盖为 i18n ⇒ 零 i18n 分片改动）；**不做网络请求**：`upload` 事件只把队列交给调用方，`uploading` / `progress` 由调用方按自身上传通道回报（进度条传入 `progress` 才渲染）；插槽 = `header`（作用域 `{ files, uploadedFiles, chooseCallback, uploadCallback, clearCallback }`）/ `content`（`{ files, uploadedFiles, progress, messages, removeFileCallback, removeUploadedFileCallback }`）/ `empty` / `chooseicon` / `uploadicon` / `cancelicon` / `fileremoveicon`（`{ file, index }`）/ `filelabel`（`{ files }`）；五事件 = `select` / `remove` / `clear` / `upload` / `invalid`；`defineExpose` 暴露 `choose()` / `clear()` / `upload()`（对齐官方方法名）；四档 `size` 驱动字号 10/12/14/16 与内边距；**列表行按「紧凑单行」设计**（行高由缩略图决定，文件名与大小**上下堆叠**、行纵向内边距 2px / 行间距 2px，**左侧标识位不画框不铺底**（行本身已有描边，再加方块会「框里套框」），且**非图片的文件图标尺寸与 `previewWidth` 解耦** —— 按档位字号 +2px 取 12/14/16/18（图标是文字性行内标识，应与行文字同阶，否则默认档位「大图标配小字」头重脚轻），左列占位宽按内容分别取 `--si-fu-thumb`（图片）/ `--si-fu-thumb-icon`（图标）以避免右侧空档，**移除按钮按档位收紧为 20/22/24/26px** —— 共享 `Button` 的 icon-only 档位是 22/28/36/44px，**会反过来成为行高下限**，故必须抬特异性覆写，**并清掉档位 `min-height`** —— 否则 28/36/44px 的最小高度会反过来决定按钮高度；尺寸锁在 `__remove` 上而**不是**覆写 `--button-size`，因为后者只在 Button **无默认插槽**、输出 `si-button--icon-only` 时才成立 ⇒ `FileList` 已把 `fileremoveicon` 插槽出口改为 `v-if` **条件转发**）；**列表高度上限按档位缩放**（132/168/200/240px，约 5~6 行）；`previewWidth`（**默认 24，比官方 50 紧凑**）只决定**图片**缩略图尺寸；**内部复用 `Button` / `Badge` / `IconWrapper`（零样式复制）**，大小格式化复用 `@/utils/format` 的 `formatFileSize`；⚠️ 图片缩略图用 `URL.createObjectURL`，**组件在队列变化与卸载时显式 `revokeObjectURL`**（否则长会话持续泄漏）；私有目录 `fileUpload/`（types / validate，禁止 feature 直接导入）；**与官方有意差异**：不做 `url` / `withCredentials` / `auto` / `customUpload` / `before-upload` / `before-send` / `error` / 进度事件与 `uploader`（**组件不做网络请求**，全交由调用方）、不做上传后文件区 `uploadedFiles` 与 `removeUploadedFile`（`uploadedFiles` 恒空，仅为对齐官方插槽作用域形状而保留）、不做 `chooseButtonProps` / `uploadButtonProps` / `cancelButtonProps` 对象袋（同 `Panel` 拒绝 `toggleButtonProps` 的判据，改由各图标插槽 + 文案 props 覆盖）、不做 `style` / `class`（走默认 attrs 透传）与 `dt` / `pt` / `ptOptions` / `unstyled` | `accept` / `mode` / `multiple` / `disabled` / `maxFileSize` / `fileLimit` / `name` / `previewWidth` / `size` / `showUploadButton` / `showCancelButton` / `uploading` / `progress` / `chooseLabel` / `uploadLabel` / `cancelLabel` / `removeLabel` / `dragText` / `hintText` / `emptyText` / `invalidFileSizeMessage` / `invalidFileTypeMessage` / `invalidFileLimitMessage` |
| `MegaMenu.vue` | 大型菜单（参考 PrimeVue MegaMenu）：**根项水平排列，展开时在下方以「多列并排面板」同时展示分组子菜单** —— 多列并排是它与普通下拉菜单的**定义性差异**；`model` 为本项目自有精简项 `MegaMenuItem`（**不照搬官方 `MenuItem`**：官方含 `url` / `routerLink` / `target` / `visible` / `separator`，本项目无 vue-router 且用不上，强塞即成假契约），字段 = `{ key, label, icon?: IconKey, disabled?, description?, header?, items?, command? }`；`items` **只支持一层**（根项 → 面板内分组列 → 叶子项；更深嵌套属普通级联菜单，不在本范式内）；**分组列切分**由子项中 `header: true` 驱动（`megaMenu/columns.ts` 纯函数：遇 header 开新列并作该列标题，首个 header 之前的散项归入一个**无标题列**，无 header 时退化为单列）；**展开态为非受控自持**（与 `Panel.collapsed` 同范式），`update:active` 通报当前展开项 key；`orientation`（`horizontal` 默认，面板在下方 / `vertical` 竖排根菜单 + 面板在右侧且**收为单列**避免挤成窄条）；`openOnHover`（**默认 `true`**，悬停展开；关闭后仅点击展开，适合触屏为主场景）；`scrollHeight`（面板限高，默认 20rem，超出走面板内部滚动）/ `columnMinWidth`（列宽下限，默认 160px，`grid auto-fit` 据此自适应列数）；**定位**：面板 `position: absolute` 挂在根项下方（**相对根容器，不 Teleport**，同 Select / DatePicker 范式）；**交互**：悬停展开带 **120ms 关闭延迟**（`useMegaMenu` 私有组合式函数，给鼠标从根项移向面板的途中留容错，否则面板闪退），进入面板即取消关闭，鼠标划过**只改展开态、不抢键盘焦点**（避免打断键盘用户）；**无障碍与键盘**（menubar 标准做法）：根菜单 `role="menubar"`、根项/叶子 `role="menuitem"`、可展开根项带 `aria-haspopup` / `aria-expanded` / `aria-controls`；**roving tabindex**（整组只留一个 Tab 停留点：当前展开项，无展开则首项）；← → / ↑ ↓ 在根项与面板叶子间漫游、Home / End 跳首末、**面板首项 ↑ 回到所属根项**、Esc 关闭并把焦点还给触发根项、Tab 交还浏览器默认行为并顺手收面板；尺寸四档驱动字号 10/12/14/16 与内边距；⚠️ **无可见标题时必须传 `ariaLabel` / `ariaLabelledby`**（Dev 环境告警）；私有目录 `megaMenu/`（types / columns / useMegaMenu，禁止 feature 直接导入）；**与官方有意差异**：不做 `breakpoint` 响应式折叠与移动端「单按钮 + 弹层」`button` 插槽（官方默认 960px 折叠，本项目容器宽度多变、由调用方按需自行折叠更可控）、不做 `tabindex`（由 roving tabindex 内部管理）/ `menuId`（内部 `useId` 生成）/ `class` / `style`（走默认 attrs 透传）与 `dt` / `pt` / `ptOptions` / `unstyled`；插槽只保留 `start` / `end`（官方另有 `item` / `itemicon` / `submenuicon` / `button` / `buttonicon`） | `model`（必填）/ `orientation` / `size` / `disabled` / `openOnHover` / `scrollHeight` / `columnMinWidth` / `ariaLabel` / `ariaLabelledby` |
| `TieredMenu.vue` | 级联菜单（参考 PrimeVue TieredMenu）：**子菜单逐级嵌套下钻（任意层）** —— 与 `MegaMenu` 的根本区别在于，后者是「面板内多列**并排**」且 `items` **刻意只支持一层**（并排范式下更深嵌套无意义），而本组件正是为**递归层级**而生；`model` 为本项目自有精简项 `TieredMenuItem`（与 `MegaMenuItem` **各自独立、互不依赖** —— 强合一会让两边都背上对方用不到的字段：`MegaMenuItem` 有 `header` / `description`，本组件有 `separator`），字段 = `{ key, label?, icon?: IconKey, disabled?, separator?, items?: TieredMenuItem[], command? }`，`items` **递归任意层**；`separator: true` 渲染为分隔线（**不参与键盘漫游、不可交互**）；**展开态为「活动路径」**（`number[]`，从根到最深展开层的各层下标 —— 级联菜单的展开状态天然是一条链），**非受控自持**；**交互**：悬停进入可下钻项即展开其子菜单、悬停到叶子/分隔线/禁用项则收起同级与更深（符合级联直觉），子菜单关闭带 **120ms 延迟**（给鼠标斜向移入的途中留容错）；⚠️ 悬停**只改展开路径、不抢键盘焦点**（同 MegaMenu 约定）；`popup` 模式（**默认 `false`**）：`false` 时内联渲染在文档流中，`true` 时菜单默认隐藏、经 `defineExpose` 的 **`show(event)` / `hide()` / `toggle(event)`** 在**触发事件坐标处**浮出（右键菜单形态，`position: fixed` + 视口双向钳制，**不 Teleport、不做** 官方 `appendTo` / `autoZIndex` / `baseZIndex` —— 与全库 48 个组件一致的就地定位 + 固定 z-index 范式）；`submenuSide`（`right` 默认 / `left`）+ 内置**左右翻转**；四档 `size`（字号 10/12/14/16 与内边距、最小宽度 150/180/210/240px）；**无障碍与键盘**（菜单惯例）：面板 `role="menu"`、项 `role="menuitem"`、分隔线 `role="separator"`、父项带 `aria-haspopup` / `aria-expanded`；↓/↑ 同层移动（**跳过分隔线与禁用项、循环回绕**）、→ 进入子菜单首项、← 退回父层（焦点给展开当前层的父项）、Home/End 跳首末、**Esc 逐层回退**（先收子菜单、无子菜单时才收整个 popup）、Enter/Space 由原生 button 直接派发；`tabindex`（默认 0，传 `-1` 可把整组移出 Tab 序列）；树形结构由私有子部件 `tieredMenu/TieredMenuList.vue` **递归渲染**（每层自渲染 `<ul>`，`defineOptions({ name })` 支持自引用）；**与官方有意差异**：不做 `breakpoint` 响应式折叠、不做 `appendTo` / `autoZIndex` / `baseZIndex`（**不 Teleport**）、不做 `as` / `asChild` 多态渲染、不做 `dt` / `pt` / `ptOptions` / `unstyled`；⚠️ 子菜单翻转按**根层可用空间一次性判定**（逐层测量收益低而复杂度高，属有意简化）；插槽只保留 `start` / `end`（官方另有 `item` / `itemicon` / `submenuicon`） | `model`（必填）/ `popup` / `submenuSide` / `size` / `disabled` / `tabindex` / `ariaLabel` / `ariaLabelledby` |
| `Sidebar.vue` | 侧边栏（**布局型**，参考 PrimeVue v5 Sidebar —— ⚠️ 与旧版 Sidebar 完全不同：旧版是遮罩式抽屉，本项目已有 `Drawer` 承担该职责，**两者无重叠**）：与配套的 `SidebarMain` 共用「Sidebar」一个预览分区；**占文档流**（宽度撑开，主内容区自动让位）或 `overlay` 浮层（不占位、叠在内容上）；`variant` 三档（`sidebar` 默认（与内容同平面，朝内容一侧画 1px 分隔线）/ `floating`（四周留白 + 全描边 + 四向圆角）/ `inset`（贴边缘但整体内缩））× `collapsible` 三档（`offcanvas` 完全隐藏 / `icon` 收成图标条（默认，按 `iconWidth`）/ `none` 不可折叠 × open 恒真 —— 避免「关不掉又不可折叠」的死状态）；`open` **传入即受控 / 不传即自持**（与 `Panel.collapsed` 同范式，派发 `update:open`）；`openOnHover`（默认 `false`；悬停展开/收起带 `hoverOpenDelay` 50ms / `hoverCloseDelay` 100ms 延迟，避免边缘抖动闪合；⚠️ 悬停**只改开合态、不抢焦点**）；`dismissable`（默认 `true`，仅 overlay 生效，语义同 Dialog 的遮罩点关）；`width`（默认 16rem）/ `iconWidth`（默认 3rem）/ 四档 `size`（字号 10/12/14/16）；**图标条折叠约定**：折叠时组件隐藏带 `.si-sidebar__label` / `.si-sidebar__hide-collapsed` 类名的节点（文字由调用方自行打类），并让内容水平居中；`aria-hidden` + `inert` 在收起态同步置位（收起的面板不仅不可见、也退出无障碍树与 Tab 序列）；`defineExpose` 暴露 `show()` / `hide()` / `toggle()`；**提供 `SidebarContext` 给 `SidebarMain`**（经私有目录 `sidebar/context.ts`，禁止 feature 直接导入）；插槽 = 默认（作用域 `{ open }`）/ `footer`（`{ open }`）；**与官方有意差异**：⚠️ 官方 Sidebar 是**四件套**（另含 `SidebarLayout` 注册表 + `SidebarTrigger`），本项目按需**只做两件套**（`Sidebar` + `SidebarMain`），开合由调用方自己的按钮经 `defineExpose` 或受控 `v-model:open` 驱动 —— 因此没有「多 sidebar 注册表 + 任意位置放 trigger」能力；不做 `as` / `asChild` 多态渲染（与全库 48 个组件一致，`Tabs` 亦明确裁掉；Vue 下可用默认 attrs 透传替代）、不做 `hideOnOutsideClick` / `id` 与 `dt` / `pt` / `ptOptions` / `unstyled` | `open` / `side` / `variant` / `collapsible` / `overlay` / `openOnHover` / `hoverOpenDelay` / `hoverCloseDelay` / `dismissable` / `width` / `iconWidth` / `size` / `ariaLabel` / `ariaLabelledby` |
| `SidebarMain.vue` | 主内容区（`Sidebar` 的**配套组件**，与 `Sidebar` 共用「Sidebar」一个预览分区）：与 `Sidebar` 并排，**按侧边栏实际占用宽度自动让位**（`occupiedWidth`；⚠️ `overlay` 模式下占用为 `0px` ⇒ **不让位**，避免浮层把内容推走）；让位实现刻意用 **`padding` 而非 `margin`** —— flex 布局下 margin 会参与伸缩计算被压缩，导致主内容与侧边栏重叠；⚠️ **允许脱离 `<Sidebar>` 独立使用**（`useSidebarContext()` 返回 null 时退化为普通主内容容器，仅保留基础排版），故注入辅助函数**不抛错**（与 Tabs 五件套「必须成组、脱离即抛错」的判据不同：这里独立使用是合理场景） | `size` / `padded` |
| `Loader.vue` | 加载动画（无 props，父容器需给显式高度） | — |
| `Message.vue` | 内联消息提示（参考 PrimeVue Message）：**未传 `severity` 时为主题主色默认外观**，六档语义 `secondary` / `success` / `info` / `warn` / `error` / `contrast` —— ⚠️ **取值逐字对齐官方**（`warn` / `error` / `contrast` 与库内 `Button.severity` 的 `warning` / `danger` **有意不统一**，勿按库内命名「修正」）；配色为「同色系 10% 浅底 + 100% 文字 + 20% 描边」（`secondary` 走 surface / on-surface / border 中性族，`contrast` 走 on-background / background 反色对 —— 宿主**没有** `--b3-theme-secondary` 语义色，故不臆造）；图标经 `icon` prop（受 `IconKey` 约束）或 `icon` 插槽，**两者都不传则不渲染图标**（与官方一致：severity 不自动附带图标）；四档 `size` 驱动字号 10/12/14/16、内边距与图标边长 12/14/16/18（**圆角 `$r-base` 与 1px 描边恒定**；⚠️ 官方仅 `small` / `large` + 默认档，本项目按库规范收敛为四档，属**有意差异**）；`closable` 显示关闭按钮（**复用共享 `Button` 的 icon-only 形态**，按 `FileUpload` 的移除按钮先例覆写 `--button-size` 为 18/20/22/24 **并同时清掉档位 `min-height`** —— 否则 28px 最小高度会反过来决定按钮高度、尺寸覆写失效；关闭按钮可访问名称走 `closeLabel`，中文默认值 ⇒ **零 i18n 改动**）；`life` 为毫秒级定时（组件内原生 `setTimeout` + `watch(immediate)` 装载，**不用 `@/utils/timerRegistry`** —— 保持组件库零业务耦合；三条清理路径 = 到期 / 手动关闭 / 组件卸载）；⚠️ **`close` 仅作通报、组件不自动隐藏**（同 `ConfirmDialog`「confirm 后不自动关闭」范式，是否移除由调用方 `v-if` 决定）；插槽 = `default`（文本，可换行）/ `icon`（作用域 `{ class }`）/ `closebutton`（作用域 `{ closeCallback }`，**整块替换**关闭按钮 —— **命名对齐库内 `Dialog.closebutton` 而非官方 `closeicon`**，同类语义全库只有一个名字；仅 `closable` 为真时该插槽才渲染）；根元素 `role="alert"` + `aria-live="polite"` + `aria-atomic="true"`（官方文档称隐式 assertive，官方源码实为**显式 polite**，本项目取后者以避免读屏打断）；**与官方有意差异**：不做 `variant`（`outlined` / `simple`）、不做 `closeButtonProps` 对象袋（同 Panel 拒绝 `toggleButtonProps` 的判据）与 `dt` / `pt` / `ptOptions` / `unstyled`；**非弹层**（无遮罩、无定位、无过渡）⇒ 预览面板无需任何沙箱覆盖 | `severity` / `icon` / `size` / `closable` / `life` / `closeLabel` |
| `Toast.vue` | 消息通知浮层（参考 PrimeVue Toast）：**停靠在视口边缘的消息堆栈** —— `position: fixed` + 模板类驱动的**八向 `position`**（`top-right` 默认 / `top-left` / `top-center` / `bottom-left` / `bottom-center` / `bottom-right` / `center`，零 JS 定位，**不 Teleport**）；⚠️ 与库内 `Message` 的边界：`Message` 是**文档流内**的内联提示条，`Toast` 是**浮在页面之上**的瞬时通知浮层（同 `Dialog` / `Drawer` 与 `Card` 的关系），两者无重叠 —— 语义取值与图标映射逐字共用（同一套官方 `warn` / `error` / `contrast` 写法），但配色改为**左侧 3px 语义色条 + 表面实底卡片**（浮层浮在任意底色之上，`Message` 那套「同色系 10% 浅底」会与页面内容糊在一起）；**消息队列为受控 `v-model:messages`**（`ToastMessageOptions[]`，逐字对齐官方：`severity`（默认 `info`）/ `summary` / `detail` / `closable`（默认 `true`）/ `life` / `group`，另加内部 `id`）—— ⚠️ **本项目刻意不做官方的 `ToastService` + `useToast()` 命令式全局服务**（官方靠 `app.use(ToastService)` + `ToastEventBus` 跨组件广播，而本库既定判据是**零 plugin / 零全局服务**，同 `ConfirmDialog` 拒绝 `useConfirm()`）；改为**受控队列**（同 `Dialog.visible` / `ConfirmDialog.visible` 范式：组件只派发 `update:messages`（载荷为**移除后的剩余队列**）等调用方回写，**永不直接改数组**），并额外经 `defineExpose` 暴露完全对齐官方 `ToastServiceMethods` 的 **`add()` / `remove()` / `removeGroup()` / `removeAll()`** 供程序化调用（`add` 把补齐 `id` 与默认 `severity` 后的对象派发出去，`remove` 据其 `id` 精确定位）；`group` **同时是渲染过滤与 `removeGroup()` 的作用域边界**（仅渲染 `group` 与之相等的消息，`undefined` 只匹配未指定 group 的消息 —— 与官方 `onAdd` 判据一致）；`life` 为毫秒级定时，**鼠标悬停即暂停计时、移出后按剩余时长继续**（官方 `lifeRemaining` 机制；组件内**原生 `setTimeout`**，**不用 `@/utils/timerRegistry`** —— 保持组件库零业务耦合；四条清理路径 = 到期 / 手动关闭 / 悬停暂停 / 组件卸载，⚠️ 手动关闭时**先停计时再派发**，避免同一实例被「到期」与「点击」重复触发两次）；插槽 = `message`（作用域 `{ message }`，整块替换图标 + 文字区）/ `messageicon`（`{ class }`，替换语义图标）/ `container`（`{ message, closeCallback }`，整块替换单条消息**含关闭按钮**）/ `closeicon`（`{ class }`，仅替换关闭按钮内的图标）+ **保留官方已废弃的 `icon` 别名插槽**（官方 v4 标记 `@deprecated` 但源码仍在生效，按「先查用法」原则照实保留，`messageicon` 优先）；四档 `size`（字号 10/12/14/16 驱动消息卡宽度 260/320/360/420px、内边距与图标边长 12/14/16/18 —— ⚠️ 官方**无 `size` prop**，属本项目按库规范扩展，与 `Message` 档位台阶一致）；关闭按钮**复用共享 `Button` 的 icon-only 形态**（按 `Message` / `FileUpload` 先例覆写 `--button-size` 为 18/20/22/24 并**同时清掉档位 `min-height`**，否则 28px 最小高度会反过来决定按钮高度、尺寸覆写失效；⚠️ 但 `closeicon` 插槽存在时改由**自绘按钮本体**承载 —— `Button` 的图标只能经 `icon` prop 指定、**无 `icon` 插槽**，无法在其中塞自定义图标内容）；可访问名称走 `closeLabel` / `ariaLabel`（中文默认值 ⇒ **零 i18n 分片改动**），单条消息 `role="alert"` + `aria-live="assertive"` + `aria-atomic="true"`（**逐字对齐官方 ToastMessage**，与 `Message` 的 `polite` 有意不同：浮层通知属需要立即播报的瞬时事件），浮层根为 `role="region"` + `aria-label`；**非模态、无遮罩** ⇒ 根容器 `pointer-events: none`（浮层不挡住页面其余部分）、仅消息卡恢复 `auto`；过渡为全库统一的 **0.12s ease**（fade + 按停靠边自适应的 12px 横向位移，`TransitionGroup` 承载，离场时 `position: absolute` 以免同组其余消息被推挤跳动）；层级沿用全库约定：**固定 `z-index: 10000`**（同全屏遮罩档，**不做**官方 `autoZIndex` / `baseZIndex` 运行时层叠管理）；⚠️ `messages` 未传时组件自持内部副本（便于 `add()` 独立使用），传入即受控；**与官方有意差异**：不做 `breakpoints`（官方靠运行时注入 `<style>` 生成媒体查询，本项目容器宽度多变、交由调用方自行控制）、不做 `autoZIndex` / `baseZIndex`、不做 `closeButtonProps` 对象袋（同 `Panel` 拒绝 `toggleButtonProps` 的判据，改由 `closeicon` 插槽覆盖）、不做 `ToastMessageOptions.styleClass` / `contentStyleClass`（自定义外观走 `container` / `message` 插槽）、不做 `appendTo`（**不 Teleport**，与全库一致的就地 fixed 范式）与 `dt` / `pt` / `ptOptions` / `unstyled`；⚠️ 事件为库内命名的 **`update:messages`** + `close(message, reason)`（`reason` 区分 `close` / `life-end`），**不做**官方 `close({ message })` / `life-end({ message })` 双事件 —— 两者合并为单事件 + `reason` 判别（同 `Message.close` 用 `MouseEvent | null` 区分来源的既有做法）；私有目录 `toast/`（types / ToastMessage，禁止 feature 直接导入）；⚠️ 子部件的样式**单独放 `styles/ToastMessage.scss`** 并由子部件自己 `@use`（不能留在 `Toast.scss`：子部件元素带子组件自己的 scope id，父组件 scoped 样式匹配不到、会静默失效），跨入共享 `Button` 的覆写与 TransitionGroup 打在子元素上的过渡类则走 `:deep()` | `messages` / `group` / `position` / `size` / `closeLabel` / `ariaLabel` |

**结构约定**：公开组件平铺于 `src/components/`（保持 `import X from "@/components/X.vue"` 单一导入约定，上表只登记这些条目）；单个组件的**私有子部件与纯函数**放同名小写子目录（如 `src/components/datePicker/` 承载 `PickerPanel.vue` / `CalendarPanel.vue` / `utils.ts`），子部件**不计入**本清单，且**禁止 feature 直接导入**。配套但需被 feature 直接使用的组件同样平铺为独立公开条目（如 `InputGroup.vue` / `InputGroupAddon.vue`，两者共用「InputGroup」一个预览分区）。子部件样式同样外置到 `src/components/styles/<Name>.scss`（每个 `.vue` 的 `<style scoped>` 只 `@use` 自己那一份，避免父组件样式对子部件内部元素失效）。

### 4. 改组件 API 必须同步预览清单

新增/修改共享组件的 props 或行为后，**必须同步**以下两处，否则预览面板会与真实 API 漂移（预览面板是唯一的目视回归入口）：

1. `src/features/componentPreview/previewData/*.ts` — 补/改对应示例，`props` 与 `code` 必须一致
2. `src/features/componentPreview/README.md` — 组件能力、档位说明有变化时同步

> 预览面板自身的机制（`sizeable` 标记、`resolveProps` 注入逻辑、尺寸档位）见 [src/features/componentPreview/README.md](./src/features/componentPreview/README.md)

---

## 子组件数据流规则（强制）

**对话框/编辑弹窗类子组件必须自包含，禁止父传全量 props + 子 emit 回父的中间人模式。**

**正确模式**：父只传最小标识符 + manager/service 实例；子组件 `onMounted` 自行从 service 加载数据，`save()` 直接调 service 持久化，仅 emit 极简通知（`saved`/`close`，无数据载荷）。

### 禁止事项

| 禁止 | 原因 |
|------|------|
| 父组件为子组件维护 `editXxx` 系列中间状态 ref | 冗余的数据拷贝，所有权混乱 |
| 父传递完整 project + urlValues + remoteList 等 5+ 个 props | props 膨胀，子组件沦为渲染傀儡 |
| 子组件 emit 全量表单数据 `emit("save", {name,status,...})` | 数据往返传递，逻辑分散在两处 |
| 父通过 `ref.setLocalPath()` 回填子组件内部状态 | 跨组件操作内部状态，破坏封装 |
| 子 `defineExpose({ setLocalPath })` 供父调用 | 暴露内部实现，紧耦合 |
| 子组件有 manager 实例却 emit 事件让父调用 CRUD | 绕远路，应直接调 manager |

> **核心**：子组件持有 manager/service 实例后，CRUD 全在内部完成。父只管开关弹窗 + 刷新列表，不关心编辑了什么字段。

---

## 硬规则

- **功能注册完整性**：新功能必须在 8 处注册（见上方「功能注册清单」）
- **实例挂载统一**：持有持久资源的功能实例在 register 内部自挂载 `(plugin as any).__xxx` + 加入 `DESTROYABLE_KEYS`，禁止在 `registerFeatures()` 接收返回值挂载或在 `onunload` 写特例清理（见上方「实例挂载与销毁模式」）
- **Composable 复用**：Dock 面板与弹窗共享逻辑时抽取 `composables/use*.ts`，禁止两个组件各自实例化 Storage。参考 `flashcardReading/composables/`
- **Vue 事件命名**：emit 事件必须 camelCase，禁止 kebab-case 或 `input:title` 格式
- **图标注册**：`FEATURE_ICONS` 中添加映射 + 运行 `pnpm validate:icons`
- **README 文档**：每个 `src/features/*/` 目录下必须有 `README.md`
- **全局样式**：`@use "@/index.scss" as *;`
- **优先思源内置图标** 或 @iconify/vue
- **图标规则**：禁止使用 emoji 表情作为图标。使用 `src/components/kit/icons.ts`（真源）中 `FEATURE_ICONS` / `COMMON_ICONS` 已注册的 Iconify 图标（`mdi:xxx`、`carbon:xxx` 等）。需要新图标时在 `icons.ts` 注册映射后引用，浏览图标 https://icon-sets.iconify.design/
- **文件头注释**：每个 `.ts` / `.vue` 文件顶部必须包含简要功能说明注释（`.scss` 不适用），格式见 [AGENTS_ARCH.md § 强制规则：文件头注释](./AGENTS_ARCH.md#强制规则文件头注释)
- **功能模块内代码分层**：模块内共享常量/工具函数禁止复制粘贴，提取到 `types/index.ts` / `utils.ts`（见上方「功能模块内代码分层」）
- **单文件行数上限**：300 行警戒线，500 行硬阈值，≥1000 行必须重构；单一函数 ≤30 行最佳。详见 [AGENTS_ARCH.md § 强制规则：单文件行数上限](./AGENTS_ARCH.md#强制规则单文件行数上限)
- **模块提取判定**：重复远比错误抽象便宜，同一问题第 3 次出现前不要抽象（Rule of Three）。详见 [AGENTS_ARCH.md § 强制规则：模块提取判定标准](./AGENTS_ARCH.md#强制规则模块提取判定标准)
- **组件文件夹组织**：按功能单元建语义化文件夹、入口统一 `index.vue`、复用组件放 `common/`、复用逻辑放 `composables/`。详见 [AGENTS_ARCH.md § 四、组件文件夹组织标准](./AGENTS_ARCH.md#四组件文件夹组织标准components-子目录)
- **共享组件先查后用**：写 `src/components/` 组件前，先查组件预览面板或 `previewData/` 清单确认真实 props，禁止凭记忆猜 props 名/取值（见上方「共享组件库使用规则」）
- **共享组件优先复用**：按钮/输入框/下拉/开关/复选框/滑块/标签/徽标/头像/卡片/图表/图标/加载态/颜色字段必须用 `src/components/` 共享组件，禁止在 feature 内自建同类；缺能力时先扩展共享组件（加可选 props 保持向后兼容）
- **组件 API 变更同步预览清单**：新增/修改共享组件 props 或行为后，必须同步 `src/features/componentPreview/previewData/*.ts` 示例（`props` 与 `code` 一致）与 `componentPreview/README.md`
- **字号层级规范**：两级字号制（`$font-size-xs` 12px / `$font-size-2xs` 10px），根容器显式设置基准字号。详见 [AGENTS_STYLE.md § 强制规则：字号层级与全局基准字号](./AGENTS_STYLE.md#强制规则字号层级与全局基准字号)
- **背景与过渡 gitPush 范式**：弹窗/面板底色 `background` + 卡片 `surface` 凸出；遮罩 `rgba(0,0,0,0.5)` 禁 `backdrop-filter`；过渡统一 0.12s ease（fade + scale 0.98），禁自定义缓动与装饰性 `letter-spacing`；全屏遮罩 `z-index: 10000`。详见 [AGENTS_STYLE.md § 强制规则：背景与过渡对齐 gitPush 范式](./AGENTS_STYLE.md#强制规则背景与过渡对齐-gitpush-范式2026-09-02)
- **Dock 面板侧边栏间距**：滚动内容不得紧贴侧边栏，根容器必须 `padding-right` ≥ `$spacing-2`。详见 [AGENTS_STYLE.md § 强制规则：Dock 面板侧边栏间距](./AGENTS_STYLE.md#强制规则dock-面板侧边栏间距)
- **AI 调用统一入口**：必须走 `@/utils/aiApi` 的 `callAI` / `callAISmart` / `callAIChat`，禁止直接 `fetch` 或硬编码 Key/端点。详见 [AGENTS_API.md § 强制规则：AI 调用](./AGENTS_API.md#强制规则ai-调用) 与 [docs/ai-api-usage.md](./docs/ai-api-usage.md)
- **定时任务统一入口**：新增定时任务必须走 `@/utils/timerRegistry` 的 `TimerRegistry`（`setInterval` / `setTimeout` / `clear` / `clearAll`），禁止裸 `setInterval` / `setTimeout`；句柄类型统一为 `TimerHandle`（`ReturnType<typeof setInterval>`），动态启停必须通过 `clear(handle)` / `clearAll()`，生命周期随功能实例 destroy/stop 清理。详见 [AGENTS_API.md § 定时器](./AGENTS_API.md#定时器)
- **Dock 预加载统一入口**：需要启动预载的 Dock 功能必须通过 `@/utils/dockPreload` 的 `registerDockPreload` 注册（labels 从 `plugin.i18n.<feature>` 提取），启动预载由插件启动链路 `runAllDockPreloads()` 统一执行；手动/定时刷新走 `refreshDockPreload(id)`（带状态栏三态与 loading 防重），面板打开用 `getDockPreloadState(id)` 分流（ready→直接用 / loading→等待 / idle|error→兜底刷新），禁止在 register/init 中自行散落预载逻辑或面板打开时重复全量刷新。详见 [AGENTS_API.md § Dock 预加载](./AGENTS_API.md#dock-预加载)
- **禁止 i18n 硬编码兜底**：`{{ i18n.xxx || '中文兜底' }}` 模式禁止使用。详见 [AGENTS_I18N.md § 强制规则：禁止 i18n 硬编码兜底值](./AGENTS_I18N.md#强制规则禁止-i18n-硬编码兜底值)
- **i18n 中文注释**：模板中每处使用 i18n 键渲染文案的位置，必须在其上方添加中文 HTML 注释标明实际显示的中文文案（如 `<!-- 弹窗标题："Git 全局配置" -->`）；模板的主要结构区块同样必须添加中文区块注释（如 `<!-- 底部操作栏 -->`）。i18n 键名是英文，缺少注释会降低模板可读性。

---

## 设置架构

双层持久化策略：

1. **功能开关**（`feature-flags.json`）：通过 `fs.writeFileSync` 同步写入，在 `onload()` 中由 `loadFeatureFlagsSync()` 同步读取。这使得 `addDock()`（需要同步 API）能够立即检查开关。降级到 `localStorage`。

2. **完整设置**（`plugin-settings` 键，通过 `plugin.loadData/saveData`）：异步加载，在注册之后执行。敏感字段（`aiApiKeys`、`searchBochaApiKey`）在存储前使用嵌入的应用密钥进行 AES-GCM 加密。

### 功能设置的加载起点（强制）

带持久化设置的运行时功能，设置**必须在插件启动链路中加载并立即应用**。加载起点是功能的注册/初始化入口（如 `GeneralSettings.init()` 中的 `applyXxxStyle()`），而不是设置面板：

1. **启动即加载**：初始化入口用 `TypedStorage.loadOrDefault()` 读取设置（默认值在 `types/storage.ts` 的 `DEFAULT_XXX_SETTINGS` 常量中注册），从未保存过设置时按默认值生效，与设置面板显示的默认状态保持一致。禁止用 `load()` 返回 null 就跳过——那会导致"必须打开设置面板动一次开关才生效"
2. **DOM 就绪轮询**：启动阶段目标 DOM（如文件树 `ul[data-url]`）可能尚未渲染，Manager 首渲必须做有界轮询等待（如每 2 秒一次、上限 15 次），出现后立即渲染；禁止首渲扑空后依赖下一个定时器周期补渲，轮询定时器须在 `stop()` 中清理
3. **设置面板只负责修改**：面板保存后通过 Manager 宿主的公开方法（如 `updateDocCount(settings)`）应用变更，不承担启动加载职责，也不得直接触碰 Manager 实例的私有字段

参考实现：`GeneralSettings.applyDocCountStyle()` + `DocCountManager.renderWhenTreeReady()`。

---

## 持久化 Modal 模式

对于需要后台运行的功能（如自动备份），项目使用"持久化 Modal + CustomEvent"模式：

- Modal 以 `persistent: true` 创建 → Vue 实例在关闭后存活，仅 `display:none`
- `init()` 先调用 `modal.open()` 再调用 `modal.close()` 来触发 `onMounted`（注册事件监听）同时隐藏 UI
- `index.ts` 中的 `setInterval` 向持久化实例中的 Vue 组件派发 CustomEvent
- `destroy()` 调用 `modal.destroy()` + `clearInterval()` → `onUnmounted` 清理监听器
- 参考实现：`src/features/dataBackup/`

> 完整实现步骤与关键点速查表见 [AGENTS_API.md § Vue 实例常驻模式](./AGENTS_API.md#vue-实例常驻模式persistent-modal--customevent--定时器)

---

## 底部面板模式（Tab 切换）

部分工具类功能不需要独立 Dock 面板，适合整合到统一的"底部面板 + Tab 切换"容器中。参考实现：`src/features/toolCollection/`。注册新工具只需在 `toolCollection/tools/registry.ts` 的 `TOOL_REGISTRY` 添加一条（`id` / `label` / `component`）并在 `TOOL_LABEL_KEYS` 登记标签解析，i18n 文案放 `src/i18n/{zh_CN,en_US}/<toolName>.json`；无需修改容器的 `index.vue`。

> 完整目录结构与通信流程见 [AGENTS_API.md § 底部面板模式（Tab 切换）](./AGENTS_API.md#底部面板模式tab-切换)

---

## 独立窗口承载（addTab + openTab + openWindow）

需要「独立窗口 / 浮动窗口」承载 UI 的功能，使用思源官方 API 的 `addTab + openTab + openWindow` 组合实现双形态承载（主窗口页签 ⇄ 独立浮动窗口）。核心流程：`plugin.addTab()` 注册自定义页签模型 → `openTab({ custom })` 创建/聚焦主窗口页签 → `openWindow({ tab })` 移入浮动窗口；关闭浮动窗口页签自动移回主窗口。Manager 类放 `types/index.ts`（模块级 `tabRegistered` 防重复注册），`index.vue` 以 `mode` prop 支持双形态。**独立窗体 UI 精简（强制）**：浮动窗口页签标题已标识功能名，面板头部不再显示重复标题字样，通过 `isFloating`（`getFrontend() === "desktop-window"`）隐藏，仅移除显示、不动功能逻辑。参考实现：`src/features/minimalBrowser/`、`src/features/toolCollection/`。

> 完整 API 签名、实现步骤与关键点速查表见 [AGENTS_API.md § 独立窗口承载](./AGENTS_API.md#独立窗口承载addtab-opentab-openwindow)

---

## 快捷键注册

通过 `plugin.addCommand()` 注册全局快捷键（macOS 符号风格 hotkey，如 `⌃⌥T`，Windows 自动转换），在 `registerFeature()` 中调用；`langKey` 需对应 i18n 分片中的翻译键。

> 完整代码示例与 hotkey 符号表见 [AGENTS_API.md § 快捷键注册](./AGENTS_API.md#快捷键注册)

---

## UI 风格：Codex

**强制规则**：所有新增 feature 的 UI 必须遵循 Codex 风格。禁止硬编码尺寸——使用全局设计 Token（`src/_variables.scss` 提供 `$color-*` / `$vp-radius` / `$spacing-*` / `$vp-mono` / `$radius-*`），禁止硬编码色值（使用 `$color-*` 语义色），禁止 `box-shadow`（改用边框）。字体三要素（`font-size` / `font-weight` / `line-height`）同样禁止硬编码 px/数字值，必须使用 `$font-size-*` / `$font-weight-*` / `$line-height-*` Token。

> 完整 Token 表、组件模式库、禁止事项见 [AGENTS_STYLE.md § UI 风格：Codex](./AGENTS_STYLE.md#ui-风格codex)

---

## SCSS 规范

所有样式必须放在独立的 `.scss` 文件中，禁止在 Vue SFC `<style>` 块中编写内联样式。Vue 文件中仅允许 `@use` 导入语句。

**命名规则**：

| 文件类型 | 命名 | 示例 |
|---------|------|------|
| 组件专属 | `styles/<ComponentName>.scss`（PascalCase，无 `_`） | `PromptsGrid.scss`、`CategoryManageModal.scss` |
| 纯 mixins/变量（partial） | `styles/_mixins.scss`（仅此类可用 `_` 前缀） | `_mixins.scss` |
| 主入口 + 共享基座 | `styles/index.scss` | `index.scss` |

**导入规则**：

- `index.vue`：单行导入 `@use './styles/index.scss'`
- 子组件：双行导入——第一行组件专属，第二行共享 index.scss：
  ```scss
  @use '../styles/MyComponent.scss';
  @use '../styles/index.scss';
  ```
- `_mixins.scss` 由各 SCSS 文件通过 `@use "./mixins" as m` 自行引用
- 响应式 `@media` 查询就近放置：组件专属放在组件 SCSS 末尾，公共基座类放在 `index.scss` 末尾

Codex UI 风格要求（禁用 `box-shadow`、全套设计 Token、字体三要素禁止硬编码、弹窗表单 `<Input>`/`<Select>` 必须 `size="small"`）见上方「UI 风格：Codex」章节。

> 完整设计 Token 表、核心规范速查表、`.vp-*` 组件模式库（弹窗/输入框/标签）、禁止事项清单见 [AGENTS_STYLE.md § UI 风格：Codex](./AGENTS_STYLE.md#ui-风格codex)
>
> SCSS 分离的强制规则与正误示例见 [AGENTS_STYLE.md § 强制规则：SCSS 必须分离到 styles/ 目录](./AGENTS_STYLE.md#强制规则scss-必须分离到-styles-目录)

---

## i18n 国际化

**分片架构**：源文件按 feature 模块拆分（`src/i18n/{zh_CN,en_US}/featureName.json`），构建时 `scripts/merge-i18n.mjs` 自动合并为思源框架所需的单一 `zh_CN.json` / `en_US.json`。

> ⛔ **硬规则：禁止直接写入 `zh_CN.json` 和 `en_US.json`**
>
> 这两个文件是构建产物，由 `merge-i18n.mjs` 自动生成。**新增或修改 i18n 文本时，必须定位到对应功能的分片文件**（`src/i18n/{zh_CN,en_US}/<feature>.json`），而非直接改大文件。
>
> - 不确定 key 属于哪个分片？→ 在 `zh_CN/` 目录下 grep 搜索
> - 全新增模块？→ 新建 `zh_CN/<feature>.json` + `en_US/<feature>.json`
> - 新增键必须中英分片同步添加，提交前运行 `pnpm i18n:verify` 确保键对齐
> - 修改完成后 → 运行 `pnpm i18n:merge` 重新生成大文件（构建时自动执行）

### 文件规则

| 分片 | 内容 |
|------|------|
| `common.json` | 全局通用键（save/cancel/confirm/delete/copy/edit/close/refresh 等） |
| `pageLock.json` | 页面锁定模块的所有键（含嵌套 `pageLock.*` 和顶层 `enablePageLock*`） |
| `<feature>.json` | 每个功能模块一个文件（命名与 `src/features/` 目录名对应） |

### 命名约定

```
✅ 推荐 — 统一按 feature 模块组织
  src/i18n/zh_CN/wordQuery.json     → plugin.i18n.wordQuery.title
  src/i18n/zh_CN/imageCompressor.json → plugin.i18n.imageCompressor.quality

### 构建流程

```
vite buildStart
  → execSync("node scripts/merge-i18n.mjs")
    → 读取 src/i18n/zh_CN/*.json → 合并 → 写入 src/i18n/zh_CN.json
    → 读取 src/i18n/en_US/*.json → 合并 → 写入 src/i18n/en_US.json
  → viteStaticCopy 复制产出的 .json 到 dist/i18n/
  → 思源框架读取 dist/i18n/{zh_CN,en_US}.json
```

---

## 构建流程

Vite library 模式 → 从 `src/index.ts` 输出 CJS 格式。`vite.config.ts` 配置：
- `@/` 别名解析为 `src/`
- 自定义 `merge-i18n` 插件在 `buildStart` 时运行
- `viteStaticCopy` 将 `plugin.json`、`icon.png`、`preview.png`、`README*.md`、`i18n/` 复制到输出目录
- Watch 模式：构建到思源工作区插件目录 + livereload
- 生产模式：输出到 `./dist/` + `zipPack` 生成 `package.zip`
- 外部化模块：`siyuan`、`process`、`node:fs`、`node:path`、`node:child_process`、`node:os`

---

## 图标系统

使用 `@iconify/vue`，离线预加载 MDI 和 Phosphor 图标集（在 `iconifySetup.ts` 中配置）。所有功能图标必须在 `src/components/kit/icons.ts`（真源）的 `FEATURE_ICONS` 映射中注册，验证脚本（`scripts/validate-icons.mjs`）检查其是否存在于预加载图标集中。图标使用规范见上方「图标规则」。

---

## 关键文件速查

```
src/
├── api.ts                  # 所有思源 API 封装（sql/getFile/putFile/getConf 等 60+ 函数）
├── index.ts                # 插件入口（同步读开关 → 条件注册各功能）
├── config/
│   ├── settings.ts         # PluginSettings 接口 + 功能开关持久化
│   └── icons.ts            # FEATURE_ICONS + COMMON_ICONS
├── utils/
│   ├── aiApi.ts            # callAI / callAISmart / callAIChat — 所有 AI 调用唯一入口
│   ├── eventBus.ts         # emitCustomEvent — 所有自定义事件唯一入口
│   ├── pluginStorage.ts    # PluginStorage — 统一存储抽象层
│   ├── typedStorage.ts     # TypedStorage<T> — 类型安全存储槽
│   ├── vueAppHelper.ts     # createVueDockApp / createModalVueApp
│   ├── domUtils.ts         # copyToClipboard / triggerDownload / injectStyle
│   ├── nodeModules.ts      # getNodeModules / getNodeProcessModules / getNodeFsPathOs
│   ├── settingsCrypto.ts   # encryptSetting / decryptSetting — 配置加密
│   ├── cryptoPrimitives.ts # deriveAESKey / aesGcmEncrypt / aesGcmDecrypt — 加密基元
│   ├── iconHelper.ts       # replaceTopBarIcon / createIconElement
│   ├── mdRenderer.ts       # parseMarkdown / convertHljsToInlineStyles — Markdown 渲染统一入口
│   └── settingsBackup.ts   # backupPluginData / restoreFromUpload
├── components/             # 共享组件库 52 个（Button/ToggleButton/SpeedDial/Splitter/Paginator/Panel/Input/Textarea/Select/Listbox/Checkbox/RadioButton/DatePicker/ColorField/InputGroup/Dialog/Drawer/ConfirmDialog/ConfirmPopup/MegaMenu/TieredMenu/Message/Toast/Sidebar/SidebarMain/Card/Timeline/Tabs/TabList/Tab/TabPanels/TabPanel/Toolbar/Divider/Chart/Inplace/FocusTrap/MeterGroup/ProgressBar 等）— 使用规则见「共享组件库使用规则」
├── features/
│   ├── statusBar/
│   │   └── composables/
│   │       └── useStatusBarTask.ts  # 状态栏后台任务（task.progress/complete/fail）
│   ├── config.ts           # FEATURE_CONFIG — 单一数据源，推导 FeatureId 类型
│   ├── index.ts            # 功能注册函数统一导出 + 编译时双向断言
│   └── <feature>/          # 各功能模块（index.ts + index.vue + types/ + composables/）
├── types/
│   ├── ai.ts               # AI API 类型
│   └── api.d.ts            # API 请求/响应类型
└── i18n/
    ├── zh_CN/                 # 中文分片（源文件，按 feature 模块拆分）
    ├── en_US/                 # 英文分片（源文件，结构与中文对应）
    ├── zh_CN.json             # 构建产物（自动合并，思源框架读取）
    └── en_US.json             # 构建产物（自动合并）
```

---

## 构建与验证

> AI 不得执行 `pnpm vite build` 和 `pnpm lint`，验证由用户自行完成。常见 Vite 警告与处理方法见 [AGENTS_BUILD.md § 构建与验证](./AGENTS_BUILD.md#构建与验证)。

---

## 规则分片索引

本文件提供架构"大图"和规则要点。**详细代码示例、完整 API 参数说明、组件模式库请按主题查阅以下分片文件**：

| 分片文件 | 内容 | 使用场景 |
|------|------|------|
| [AGENTS_API.md](./AGENTS_API.md) | API 参考（存储/Dock/Modal/事件/状态栏/DOM/Node/加密/AI/开关/设置/快捷键）、路径别名、文件路径、承载模式（Vue 实例常驻/底部面板/独立窗口）、跨功能联动规则与示例、AI 调用规则 | 新功能开发时查询 API 用法、跨功能联动规则与示例 |
| [AGENTS_STYLE.md](./AGENTS_STYLE.md) | UI 风格 Codex（设计 Token 全表/核心规范/`.vp-*` 组件模式库/禁止事项）、字号层级、Dock 侧边栏间距、SCSS 分离、内置字体 | 编写或审查 SCSS 样式时 |
| [AGENTS_ARCH.md](./AGENTS_ARCH.md) | Composable 提取、文件头注释、单文件行数上限、模块提取判定标准、组件文件夹组织标准 | 代码组织、组件拆分、目录结构规划时 |
| [AGENTS_I18N.md](./AGENTS_I18N.md) | i18n 不生效问题排查、禁止 i18n 硬编码兜底值 | 处理 i18n 文案或排查翻译不生效时 |
| [AGENTS_BUILD.md](./AGENTS_BUILD.md) | 构建与验证、viteStaticCopy stripBase、依赖清单 | 构建配置、静态资源复制、验证流程时 |
| [docs/ai-api-usage.md](./docs/ai-api-usage.md) | 完整 AI 调用用法（标准/流式/思考模式/RAG/多轮对话 + 调用方清单） | 需要实现 AI 功能时（唯一 AI 调用参考文档） |
| [src/features/componentPreview/README.md](./src/features/componentPreview/README.md) | 共享组件预览面板机制（52 个组件的用法快照、受控示例可交互、组件尺寸档位、`sizeable`/`resolveProps`、复合示例 `render`、具名/作用域插槽 `slots`、弹层类沙箱覆盖、清单扩展指南） | 使用共享组件前查用法、或改共享组件 API 后同步预览清单时 |
