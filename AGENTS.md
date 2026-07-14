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
4. **注册** `src/index.ts` → `registerFeatures()` — 添加 `if (s.enableXxx) registerXxx(this)`
5. **设置** `src/config/settings.ts` — 在 `PluginSettings` 接口添加 `enableXxx: boolean` + `DEFAULT_SETTINGS` 添加默认值。含缩写词的 ID（如 `qrCode`、`aiContentGenerator`）需要在 `FEATURE_ID_TO_KEY_MAP` 中添加映射
6. **i18n** `src/i18n/{zh_CN,en_US}/<feature>.json` — 添加翻译，运行 `pnpm i18n:verify`
7. **配置** `src/features/config.ts` — 在 `FEATURE_CONFIG` 数组中添加条目；纯配置型功能（无 register 函数）还须加入 `_ConfigOnly` 白名单
8. **图标** `src/config/icons.ts` — 添加到 `FEATURE_ICONS`，运行 `pnpm validate:icons`

### 功能模块内代码分层（强制）

模块内的 TypeScript 代码按职责分三层，杜绝复制粘贴：

| 层级 | 文件 | 内容 | 示例 |
|------|------|------|------|
| 类型 + 共享常量 | `types/index.ts` | 类型定义 + 被多文件共用的元数据映射、枚举列表、配置表 | `STATUS_META`（状态徽章元数据）、`REMOTES`（PLATFORM_META 精简投影） |
| 纯工具函数 | `utils.ts` | 不依赖 Vue 响应式的纯函数，可被任何文件导入 | `hasAnyRemote(project)`、`resolveValidPath(project)` |
| 视图逻辑 | `.vue` 组件 / `composables/` | 模板相关状态、事件处理、composable 封装 | 组件本地 ref、watch、handleXxx 函数 |

**强制规则**：同一常量/工具函数被 2 个以上文件使用时，必须提取到对应的 `types/` 或 `utils.ts`，禁止复制粘贴。参考实现：`src/features/gitPush/`。

### 编译时注册完整性校验

`src/features/config.ts` 定义了 `FEATURE_CONFIG`（所有功能元数据的数组），并从中推导出 `FeatureId` 联合类型。`src/features/index.ts` 中有一个 `_Registered` 联合类型列出了所有有 `register` 导出的功能，并包含两个编译时断言：
- `_AssertRegisteredInConfig`：每个 `_Registered` ID 必须存在于 `FeatureId` 中（捕获配置删除不完整导致的孤立项）
- `_AssertAllCovered`：每个不在 `_ConfigOnly` 中的 `FeatureId` 必须存在于 `_Registered` 中（捕获配置新增但缺少导出）

如果注册链条两端任一断裂，TypeScript 将拒绝编译。

---

## 跨功能联动规则（强制）

**功能模块之间禁止直接相互导入**。跨功能联动必须通过事件总线 + App.vue 中心调度实现零依赖解耦。

### 正确模式（唯一允许）

```
Feature A（发起方）                 Feature B（响应方）
  │                                   ▲
  │ emitCustomEvent("eventName",      │
  │   { detail })                     │ 导出 public API
  │                                   │ (ref / function)
  ▼                                   │
App.vue onMounted 监听 ───────────────┘
  window.addEventListener("eventName",
    handler → 调用 Feature B 的 public API
  )
```

### 错误模式

| 禁止行为 | 原因 |
|----------|------|
| Feature A 直接 `import { xxx } from "@/features/FeatureB"` | 产生硬依赖，破坏模块独立性 |
| Feature A 直接修改 Feature B 的 ref | 跨越模块边界，状态归属混乱 |
| Feature A 通过全局变量 `(window as any).xxx` 访问 Feature B | 类型不安全，无契约约束 |

### 正确示例

```typescript
// ===== Feature A（如 floatingToolbar/actions/passwordVault.ts）=====
// 只用 createDialogAction 工厂 + emitCustomEvent 派发
// ===== App.vue（中心调度）=====
// 唯一允许同时导入两个 feature 的文件
import { openPasswordVaultWithText } from "@/features"

export function createPasswordVaultAction(plugin: Plugin): ToolbarAction {
  return createDialogAction({
    id: "passwordVault",
    icon: `<svg>...</svg>`,
    label: plugin.i18n.passwordVault.quickSave,
    eventName: "openPasswordVaultAdd", // 事件名
    getContent: (selection) => ({ content: selection }),
  })
}

// ===== Feature B（如 passwordVault/index.ts）=====
// 导出 public API，不导入任何其他 feature
export const pendingEntryName = ref("")
export function openPasswordVaultWithText(text: string) {
  pendingEntryName.value = text
  passwordVaultVisible.value = true
}

onMounted(() => {
  window.addEventListener("openPasswordVaultAdd", ((event: any) => {
    if (event.detail?.content) {
      openPasswordVaultWithText(event.detail.content)
    }
  }) as EventListener)
})
```

### 规则清单

1. **Feature 间零直接导入**：任何 feature 目录下的文件不得 `import` 其他 feature（`@/features/*` 的子目录）
2. **单向数据流**：发起方只负责 `emitCustomEvent`，绝不触碰响应方的状态
3. **App.vue 是唯一调度中心**：所有跨功能的事件监听统一在 App.vue 的 `onMounted` 中注册
4. **Public API 契约**：响应方 feature 的 `index.ts` 导出的函数/ref 即为它的 public API，其他 feature 不直接调用
5. **事件名规范**：使用 camelCase 动词短语（如 `openPasswordVaultAdd`），在 eventBus 中保持唯一
6. **数据透传**：事件 detail 中携带的数据由 App.vue 透传给响应方，双方不共享类型定义

---

## 统一入口原则（强制）

所有跨功能的通用操作必须通过统一定义的入口。在功能代码中直接调用思源框架（`plugin.loadData`、`fetch`、`new CustomEvent` 等）属于违规。

| 场景 | 必须使用的 API | 位置 |
|------|-------------|----------|
| 存储 | `PluginStorage` / `TypedStorage<T>` | `@/utils/pluginStorage` / `@/utils/typedStorage` |
| AI 调用 | `callAI` / `callAIStream` | `@/utils/aiApi` |
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
| 全局 `siyuan` | Props 传入的 `Plugin` 实例 | 禁止使用 `(window as any).siyuan` |

唯一例外：`src/config/settings.ts` 允许直接调用 `plugin.loadData/saveData`，仅用于单一的 `plugin-settings` 键。

> 上述各 API 的详细代码示例见 [AGENTS_RULES.md § API 参考](./AGENTS_RULES.md#api-参考)

---

## 子组件数据流规则（强制）

**对话框/编辑弹窗类子组件必须自包含，禁止父传全量 props + 子 emit 回父的中间人模式。**

### 正确模式

```
父组件                             子组件（对话框）
  │                                   │
  │ props: id, manager/service        │ 接收最小标识符 + 服务实例
  │                                   │
  │                                   ▼
  │                                 onMounted → 自行从 service 加载数据
  │                                   │
  │                                   ▼
  │                                 save() → 直接调用 service 持久化
  │                                   │
  │  ◄── emit("saved" | "close") ──  emit 极简通知（无数据载荷）
```

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
- **Composable 复用**：Dock 面板与弹窗共享逻辑时抽取 `composables/use*.ts`，禁止两个组件各自实例化 Storage。参考 `flashcardReading/composables/`
- **Vue 事件命名**：emit 事件必须 camelCase，禁止 kebab-case 或 `input:title` 格式
- **图标注册**：`FEATURE_ICONS` 中添加映射 + 运行 `pnpm validate:icons`
- **README 文档**：每个 `src/features/*/` 目录下必须有 `README.md`
- **全局样式**：`@use "@/index.scss" as *;`
- **优先思源内置图标** 或 @iconify/vue
- **图标规则**：禁止使用 emoji 表情作为图标。使用 `src/config/icons.ts` 中 `FEATURE_ICONS` / `COMMON_ICONS` 已注册的 Iconify 图标（`mdi:xxx`、`carbon:xxx` 等）。需要新图标时在 `icons.ts` 注册映射后引用，浏览图标 https://icon-sets.iconify.design/
- **文件头注释**：每个 `.ts` / `.vue` 文件顶部必须包含简要功能说明注释（`.scss` 不适用），格式见 [AGENTS_RULES.md § 强制规则：文件头注释](./AGENTS_RULES.md#强制规则文件头注释)
- **功能模块内代码分层**：模块内被多个文件共用的常量/工具函数不得在多处重复定义。共享常量（元数据映射、枚举值列表、配置表等）→ 提取到 `types/index.ts`；不依赖 Vue 响应式的纯工具函数 → 提取到 `utils.ts`。禁止 `.vue` 组件间复制粘贴相同的常量定义
- **单文件行数上限**：300 行警戒线，500 行硬阈值，≥1000 行必须重构。单一函数 ≤ 30 行最佳（Rule of 30），≤ 50 行可接受。详见 [AGENTS_RULES.md § 强制规则：单文件行数上限](./AGENTS_RULES.md#强制规则单文件行数上限)
- **模块提取判定**：核心原则——重复远比错误抽象便宜，同一问题出现第 3 次前不要抽象（Rule of Three）。组件仅在 ≥2 处复用 / 文件超 500 行 / 含 ≥3 个独立状态 + 操作函数时才拆分。仅 1 处使用且 ≤80 行的薄壳包装（仅 slot + CSS 外壳）禁止拆分。详见 [AGENTS_RULES.md § 强制规则：模块提取判定标准](./AGENTS_RULES.md#强制规则模块提取判定标准)
- **组件文件夹组织**：feature 的 `components/` ≥ 15 个文件时可按**组件类型**建子文件夹（如 `charts/`）。仅在 ≥3 个同质组件时创建；禁止按 Tab/页面分组；紧密耦合组件通过命名前缀体现关系无需子文件夹；每个 feature 最多 3 个子文件夹。详见 [AGENTS_RULES.md § 四、组件文件夹组织标准](./AGENTS_RULES.md#四组件文件夹组织标准components-子目录)
- **规则文件同步**：`AGENTS.md` 与 `CODEBUDDY.md` 必须保持内容一致（仅首行标题可不同）。修改任一方后，必须立即同步到另一方，禁止出现差异。

---

## 文件头注释规则

每个 `.ts` / `.vue` 文件顶部**必须**包含一行注释，简要说明文件功能（`.scss` 不适用）。详细格式规范见 [AGENTS_RULES.md § 强制规则：文件头注释](./AGENTS_RULES.md#强制规则文件头注释)。

---

## 设置架构

双层持久化策略：

1. **功能开关**（`feature-flags.json`）：通过 `fs.writeFileSync` 同步写入，在 `onload()` 中由 `loadFeatureFlagsSync()` 同步读取。这使得 `addDock()`（需要同步 API）能够立即检查开关。降级到 `localStorage`。

2. **完整设置**（`plugin-settings` 键，通过 `plugin.loadData/saveData`）：异步加载，在注册之后执行。敏感字段（`aiApiKeys`、`searchBochaApiKey`）在存储前使用嵌入的应用密钥进行 AES-GCM 加密。

---

## 持久化 Modal 模式

对于需要后台运行的功能（如自动备份），项目使用"持久化 Modal + CustomEvent"模式：

- Modal 以 `persistent: true` 创建 → Vue 实例在关闭后存活，仅 `display:none`
- `init()` 先调用 `modal.open()` 再调用 `modal.close()` 来触发 `onMounted`（注册事件监听）同时隐藏 UI
- `index.ts` 中的 `setInterval` 向持久化实例中的 Vue 组件派发 CustomEvent
- `destroy()` 调用 `modal.destroy()` + `clearInterval()` → `onUnmounted` 清理监听器
- 参考实现：`src/features/dataBackup/`

> 完整实现步骤与关键点速查表见 [AGENTS_RULES.md § Vue 实例常驻模式](./AGENTS_RULES.md#vue-实例常驻模式persistent-modal--customevent--定时器)

---

## 底部面板模式（Tab 切换）

部分工具类功能不需要独立 Dock 面板，适合整合到统一的"底部面板 + Tab 切换"容器中。参考实现：`src/features/toolCollection/`。

**架构要点**：

```
toolCollection/
├── index.ts              # registerToolCollection() + 公开 API（toggle/close/visible）
├── index.vue             # 面板容器：Overlay + Header + Tab 栏 + 内容区 + Transition 动画
├── types/index.ts        # ToolMeta 接口（id/label/icon）
├── styles/index.scss     # 面板样式（固定底部定位、Tab 栏、slide-up 动画）
└── tools/                # 各工具模块（独立子目录，互不依赖）
    └── <toolName>/
        ├── index.vue     # 工具主组件（接收 plugin / i18n props）
        ├── components/   # 工具子组件
        └── styles/       # 工具样式（SCSS 分离）
```

**通信流程**：

1. **触发**：状态栏（或快捷键）→ `emitCustomEvent("toggleToolCollection")`
2. **调度**：`App.vue` 监听 `window.addEventListener("toggleToolCollection", ...)` → 调用 `toggleToolCollection()`
3. **响应**：`toolCollection/index.ts` 导出模块级 `ref(visible)` + `toggleToolCollection()` / `closeToolCollection()`
4. **清理**：`onunload()` 中 `app.unmount()` + `container.remove()` + 重置 `ref`

**注册新工具到面板**：在 `toolCollection/index.vue` 的 `tools` computed 中添加条目 + 在 `<div class="tool-collection-content">` 中添加 `v-if` 组件引用。无需修改注册清单。

---

## 快捷键注册

通过 `plugin.addCommand()` 注册全局快捷键，在 `registerFeature()` 中调用：

```ts
plugin.addCommand({
  langKey: "toggleToolCollection", // i18n 键（命令名称，显示在快捷键设置界面）
  langText: "工具合集", // 回退文本（i18n 缺失时使用）
  hotkey: "⌃⌥T", // macOS 风格：⌃=Ctrl ⌥=Alt ⌘=Cmd ⇧=Shift；Windows 自动转换
  callback: () => {
    toggleToolCollection() // 回调函数
  },
})
```

**hotkey 格式**：
| 符号 | 按键 | 示例 |
|------|------|------|
| `⌃` | Ctrl | `⌃T` = Ctrl+T |
| `⌥` | Alt | `⌃⌥E` = Ctrl+Alt+E |
| `⌘` | Cmd | `⌘K` = Cmd+K |
| `⇧` | Shift | `⇧⌃P` = Ctrl+Shift+P |

快捷键的 `langKey` 需要对应 i18n 分片文件中的翻译键。思源框架会自动将 macOS 符号转换为 Windows 键名显示。

---

## 新增功能完整流程（8 步演练）

以 `toolCollection` 为例，展示从零到一完整步骤：

| 步骤 | 位置 | 操作 | toolCollection 实例 |
|------|------|------|---------------------|
| 1. **实现** | `src/features/<name>/index.ts` | 导出 `registerXxx(plugin)` + 公开 API（ref/函数） | `registerToolCollection()` + `toggleToolCollection`/`closeToolCollection`/`toolCollectionVisible` |
| 2. **类型** | `src/features/<name>/types/index.ts` | 接口/类型定义（不放 register 逻辑） | `ToolMeta { id, label, icon }` |
| 3. **导出** | `src/features/index.ts` | 添加 `export { ... } from "./<name>"` + 更新 `_Registered` 联合类型 | 新增 `registerToolCollection`, `toggleToolCollection` 等；`_Registered` 加 `"toolCollection"` |
| 4. **注册** | `src/index.ts` | `registerFeatures()` 中 `if (s.enableXxx) registerXxx(this)` + `onunload()` 清理 | `if (s.enableToolCollection) registerToolCollection(this)` + 清理 app/container |
| 5. **设置** | `src/config/settings.ts` | `PluginSettings` 接口 + `DEFAULT_SETTINGS` 默认值 | `enableToolCollection: boolean` 默认 `true` |
| 6. **i18n** | `src/i18n/{zh_CN,en_US}/<name>.json` | 翻译键值对，运行 `pnpm i18n:verify` | `toolCollection.json`（面板标题、描述、tab 标签、快捷键标签） |
| 7. **配置** | `src/features/config.ts` | `FEATURE_CONFIG` 数组条目；若纯配置型加 `_ConfigOnly` | 新增 `{ id: "toolCollection", defaultTitle: "工具合集", ... }` |
| 8. **图标** | `src/config/icons.ts` | `FEATURE_ICONS` 条目，运行 `pnpm validate:icons` | `toolCollection: { icon: "mdi:toolbox-outline", color: "#6366f1" }` |

**迁移现有功能为 Config-Only**：若功能不再独立注册（如 `base64Image` 迁移到 `toolCollection` 内），需：
- 将 `register` 函数改为 no-op（保留导出以维持编译通过）
- 在 `_ConfigOnly` 白名单中添加该功能 ID
- 从 `_Registered` 联合类型中移除，保留其在 `FeatureId` 中的存在

**验证链条**：完成全部 8 步后，由用户自行验证以下 4 项检查：
```bash
pnpm lint           # ESLint 代码规范（用户自行执行，AI 不运行）
pnpm i18n:verify    # 中英文键对齐
pnpm validate:icons # 图标注册有效性
npx tsc --noEmit    # TypeScript 编译类型检查
```
> **重要**：AI 不得执行 `pnpm vite build` 和 `pnpm lint`。这些验证由用户自行完成。

---

## UI 风格：Codex

**强制规则**：所有新增 feature 的 UI 必须遵循 Codex 风格。禁止硬编码尺寸——使用全局设计 Token（`src/_variables.scss` 提供 `$vp-radius` / `$spacing-*` / `$vp-mono` / `$radius-*`），禁止 `box-shadow`（改用边框）。字体三要素（`font-size` / `font-weight` / `line-height`）同样禁止硬编码 px/数字值，必须使用 `$font-size-*` / `$font-weight-*` / `$line-height-*` Token。

> 完整 Token 表、组件模式库、禁止事项见 [AGENTS_RULES.md § UI 风格：Codex](./AGENTS_RULES.md#ui-风格codex)

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

项目遵循 **Codex UI 风格**：基于边框的卡片（禁用 `box-shadow`），使用 `src/_variables.scss` 中的全局设计 Token（`$radius-*`/`$vp-radius`/`$spacing-2px`/`$spacing-px`/`$spacing-1`~`$spacing-4`/`$font-size-*`/`$font-weight-*`/`$line-height-*`/`$vp-mono`），大写标签 `$font-size-2xs`/`$font-weight-bold` 字重 + 0.06em 字母间距，统一 0.12s 过渡。**字体三要素 `font-size`/`font-weight`/`line-height` 禁止硬编码 px 或数字值**，必须使用对应的 `$font-size-*`/`$font-weight-*`/`$line-height-*` Token。**所有 `<Input>`/`<Select>` 在弹窗表单中必须指定 `size="small"`**，默认 `medium` 与紧凑风格不匹配。

> 完整设计 Token 表、核心规范速查表、`.vp-*` 组件模式库（弹窗/输入框/标签）、禁止事项清单见 [AGENTS_RULES.md § UI 风格：Codex](./AGENTS_RULES.md#ui-风格codex)
>
> SCSS 分离的强制规则与正误示例见 [AGENTS_RULES.md § 强制规则：SCSS 必须分离到 styles/ 目录](./AGENTS_RULES.md#强制规则scss-必须分离到-styles-目录)

---

## i18n 国际化

**分片架构**：源文件按 feature 模块拆分（`src/i18n/{zh_CN,en_US}/featureName.json`），构建时 `scripts/merge-i18n.mjs` 自动合并为思源框架所需的单一 `zh_CN.json` / `en_US.json`。

> ⛔ **硬规则：禁止直接写入 `zh_CN.json` 和 `en_US.json`**
>
> 这两个文件是构建产物，由 `merge-i18n.mjs` 自动生成。**新增或修改 i18n 文本时，必须定位到对应功能的分片文件**（`src/i18n/{zh_CN,en_US}/<feature>.json`），而非直接改大文件。
>
> - 不确定 key 属于哪个分片？→ 在 `zh_CN/` 目录下 grep 搜索
> - 全新增模块？→ 新建 `zh_CN/<feature>.json` + `en_US/<feature>.json`
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

⚠️ 遗留 — base64Image 使用下划线前缀，暂不重构
  src/i18n/zh_CN/base64Image.json   → plugin.i18n.base64Image_encode
```

### 日常操作

```bash
pnpm i18n:merge    # 手动合并（构建时自动执行，通常无需手动调用）
pnpm i18n:verify   # 校验 zh_CN 与 en_US 键完全对齐 + 检测重复键
pnpm i18n:split    # 从单体 JSON 重新拆分（极少需要，仅在分片损坏时使用）
```

### 新增 i18n 文本

1. 找到对应 feature 的分片文件（如 `src/i18n/zh_CN/wordQuery.json`）
2. 添加键值对
3. 同样在 `src/i18n/en_US/<feature>.json` 添加英文翻译
4. 提交前运行 `pnpm i18n:verify` 确保键对齐

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

使用 `@iconify/vue`，离线预加载 MDI 和 Phosphor 图标集（在 `iconifySetup.ts` 中配置）。所有功能图标必须在 `src/config/icons.ts` 的 `FEATURE_ICONS` 映射中注册。验证脚本（`scripts/validate-icons.mjs`）检查所有已注册图标是否存在于预加载的图标集中。禁止使用 emoji 作为图标。可在 https://icon-sets.iconify.design/ 浏览可用图标。

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
│   ├── aiApi.ts            # callAI / callAIStream — 所有 AI 调用唯一入口
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
├── components/             # 共享 shadcn-vue 组件（Button/Input/Select/Switch/Tag 等）
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

> **重要**：AI 不得执行 `pnpm vite build` 和 `pnpm lint`。这些验证由用户自行完成。AI 仅负责编写代码，用户自行验证构建和 lint。

常见 Vite 警告：`is dynamically imported by ... but also statically imported` → 改为统一静态 `import`。

---

## 参考文件

本文件提供架构"大图"和规则要点。**详细代码示例、完整 API 参数说明、组件模式库请查阅 [AGENTS_RULES.md](./AGENTS_RULES.md)**，其内容组织如下：

| 章节 | 内容 |
|------|------|
| API 参考 | 存储/Dock/Modal/事件/状态栏/DOM/Node/加密/AI/开关/设置的完整调用示例 |
| Vue 实例常驻模式 | 持久化 Modal 的 4 步实现 + 关键点速查表 |
| 文件路径 | `getFile`/`putFile` 路径规则、工作区目录、插件数据目录、Vite 外部模块声明 |
| UI 风格：Codex | 全局设计 Token 全表、核心规范速查表、`.vp-*` 组件模式库（弹窗/输入框/标签）、禁止事项清单 |
| 强制规则：SCSS 分离 | 目录结构模式、正误示例对比 |
| 强制规则：文件头注释 | .ts/.vue 文件头注释格式规范 |
| 强制规则：Composable 提取 | 工厂函数 + 依赖注入模式、判断标准、禁止事项 |
| 构建与验证 | 常见 Vite 警告原因与处理方法 |
