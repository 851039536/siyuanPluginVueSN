# 项目记忆（siyuanPluginVueSN）

> 最后整理：2026-09-10（合并重复条目、压缩模块状态，共享组件库扩至第 16 个 ColorField）

## 编码规范偏好
- 严格遵守统一入口原则：存储用 `PluginStorage`/`TypedStorage`、Node 模块用 `getNodeModules`、事件用 `emitCustomEvent`、SQL 用 `@/api`、AI 用 `@/utils/aiApi`、定时器用 `TimerRegistry`、Dock 预加载用 `@/utils/dockPreload`
- UI 风格使用 Codex 设计语言（暖色中性、边框优先、无发光阴影、0.12s ease 过渡、主题自适应）
- Vue emit 事件必须 camelCase，禁止 kebab-case；`if` 必须有花括号 `{}`
- 新功能必须在 8 处注册（index.ts + types + features/index.ts + src/index.ts + settings + i18n + config + icons）
- 图标禁止 emoji，必须用 `src/config/icons.ts` 已注册的 `IconKey`
- i18n 只改分片文件（`src/i18n/{zh_CN,en_US}/<feature>.json`）；顶层合并 JSON 由 `pnpm i18n:merge` 生成，**禁止手改**
- 独立窗体 UI 精简：addTab + openWindow 窗体中用 `isFloating`（`getFrontend() === "desktop-window"`）+ `v-if="!isFloating"` 隐藏重复标题，仅移除显示、逻辑零改动
- **快捷键冲突检查**：必须**递归搜索整个 `src/features/**`**，hotkey 也注册在 `features/<name>/types/index.ts`（video ⌃⌥V、formatAssistant ⌃⌥G、superPanel ⌃⌥P）。已知既有冲突：tableOfContents 与 ideaGenerator 同为 ⌃⌥I（未修）。思源 `ICommand.hotkey` 可选，不写即仅作命令面板入口
- **禁止私自执行** `pnpm vite build` / `pnpm lint`（用户自行验证）；MewTool 等其他 C# 项目禁止 `dotnet build`

## 共享组件库（`src/components/`，17 个）
规则见 `AGENTS.md § 共享组件库使用规则（强制）`：**先查用法（组件预览面板 / `previewData/*.ts` / 源码 `interface Props`）→ 优先复用（禁止 feature 自建同类控件）→ 改 API 必同步预览清单**。
- 清单（公开组件平铺于 `src/components/`）：Button / Input / Select / **ColorField** / FormField / Label / Switch / **Checkbox** / **DatePicker** / Slider / Tag / Badge / Avatar / Card / Chart / IconWrapper / Loader
- **结构约定**（2026-09-10 起，已写入 AGENTS.md）：单个组件的私有子部件与纯函数放同名小写子目录（如 `src/components/datePicker/`），子部件不计入组件清单、**禁止 feature 直接导入**；子部件样式必须各自独立 SCSS —— Vue scoped 样式只对子组件**根元素**生效，父组件的规则命不中子部件内部元素
- **改计数前必须先实测**：组件数会被并行变更改变（2026-09-10 一天内 15→16→17），禁止凭上一轮记忆改 `AGENTS.md` / 根 `README.md` / `componentPreview/README.md` 里的「N 个」
- 尺寸档位统一 `xsmall`/`small`/`medium`/`large`（默认 `small`），字号阶梯 10/12/14/16（`$font-size-2xs/xs/sm/base`，四档禁止同号；这是两级字号制中唯一允许 10px 出现在控件正文的场景）
- 新增组件 = 改 4 类位置：`<Name>.vue` 公开入口 + `styles/<Name>.scss`（复杂组件再按子部件拆多份 SCSS）+ `previewData/<name>.ts`（`props` 与 `code` 严格一致，再接入 `previewData/index.ts` 聚合）+ 文档计数（`AGENTS.md` 5 处 + 清单表行 + 复用控件清单 + 根 `README.md` + `componentPreview/README.md` 的 L3/L8/L13/L14 与具名插槽表/事件契约表）
- 允许自建例外：纯展示局部布局容器、无档位 26×26 `.icon-btn`
- 改共享组件 API 必须同步 `previewData/*.ts` 与 `componentPreview/README.md`

### 组件约定与陷阱
- **`Button`**：颜色轴 `variant`/`severity` × 外观轴 `outlined`/`text`。既有 5 个 variant 语义**不可改动**（180+ 处调用依赖），新增能力走新类名（`--severity-*`/`--outlined`/`--text`），颜色族经 CSS 变量 `--btn-color`/`--btn-on-color`/`--btn-soft`/`--btn-soft-strong`（`btn-color-family` mixin）。纯图标按钮必须给 `aria-label`/`title`；loading 用 `visibility: hidden` 保宽；图标随 size 档位 12/14/16/18
- **`Checkbox`**（2026-09-10 新增）：原生隐藏 input 承载语义（Tab/Space + 表单），`isGroup = !binary && Array.isArray(modelValue)` 自动分模式；`indeterminate` 只能写 DOM 属性（`watch flush: "post"` + `onMounted`）；分组模式返回全新数组；受控回写 `nextTick(syncNativeState)` 防漂移；复用 `FormField`（只传 hint/error）+ `IconWrapper`（`check`/`minus`）
- **`DatePicker`**（2026-09-10 新增，首个带私有子目录的组件）：`src/components/DatePicker.vue`（入口）+ `datePicker/`（types/formatUtils/utils/useDatePicker/PickerPanel/CalendarPanel/MonthYearPanel）。要点：①**零日期库**，自建 `dateFormat` 模板引擎（令牌严格对齐 PrimeVue，`parseDate` 反向解析只支持数值令牌）；②**无时区字符串必须按本地时间解析**（`new Date("2026-09-10")` 按 UTC 会跨日错位，用 `LOCAL_DATE_PATTERN` 显式构造）；③`isDateDisabled(date, options)` 收敛 min/max + disabledDays + disabledDates 四类约束，数组预处理为 `Set<number>`；④42 格元数据一次性 `computed`（模板只读 + `date` 插槽 scope 同源）；⑤**焦点三坑**：关闭后 `input.focus()` 会立即重开面板（需 `skipFocusOpen` 抑制标记）、视图切换后原按钮卸载导致焦点掉 body + Esc 失效（需 `focusActiveView()`）、面板容器要 `tabindex="-1"` 才能程序化聚焦；⑥有意偏离 PrimeVue：`dateFormat` 默认 `yy-mm-dd`、`firstDayOfWeek` 默认 1（周一起始），不做 `showTime`/`multiple`/`inline`/`numberOfMonths`；⑦弹层沿用 `Select` 相对定位范式，`overflow:hidden` 容器内可能被裁剪（已知限制，不用 Teleport）
- **`ColorField`**（2026-09-10 由 `generalSettings` 提升为共享）：色块 + 32 色自绘调色板 + hex 文本双向联动。**原生 `<input type="color">` 在思源 Electron 中不弹取色器**，颜色选择一律用它；全项目仍有 8 个文件遗留原生实现待替换。事件：`update:modelValue`（实时值）+ `change`（提交信号：blur/回车/选色）
- **`Input.borderless`**：去边框去底色（三条高特异性选择器覆盖基类 hover/focus-within），供 chips 类复合控件内嵌；焦点反馈由外层容器 `:focus-within` 承担
- **「实时跟随 + 一次性落盘」交互统一用双事件**：`update:modelValue`（只改内存）+ `change`（落盘）。`Slider`/`ColorField`/`Input` 均如此；消费方据此避免逐像素写盘与提示刷屏
- **`Input`/`Select` 在弹窗/表单中必须显式 `size="small"`**（默认 medium 36px 过高，见 `AGENTS_STYLE.md`）
- **焦点环禁用 `focus-ring` mixin**：该 mixin 只改 `border-color`，实底控件（border 为 `1px solid transparent`）复用后**焦点完全不可见**；实底控件用 `outline`（同 `Switch.scss`）
- **Vue 的 `slots` 不是响应式**（Vue 3.5.40 源码证据）：`instance.slots` 是普通对象、`updateSlots` 原地赋值 → `computed` 派生值**不会**因插槽增删重算，与模板 `v-if="$slots.default"` 会不一致。需跟随插槽变化必须用**普通函数**或模板直读 `$slots`，禁用 `computed`
- **`Select`/`Input`/`Slider` 的 `containerAttrs` 会剥离 `class`/`style`**：预览中不能靠 props 传 style 控宽，改由容器 SCSS 控制
- **`Loader`** 无 props 且 `height:100%`，父容器必须给显式高度
- **`Chart.vue`** 仅注册 line/bar/pie/doughnut/area，**不支持 radar**
- **`Select`** 支持 `#selected` 作用域插槽与 `SelectOption.keywords`（`filterable` 附加检索词）；`@update:model-value` 载荷是 `string | number | boolean | null`
- 具名/作用域插槽**无法**在预览快照渲染，必须在 `componentPreview/README.md` 登记；同样地，**事件语义**（如 `change` 提交信号）也登记在该文件的「事件契约」表

## 代码风格硬规则
- 单文件行数：300 行警戒，500 行硬阈值，≥1000 必须重构；单一函数 ≤30 行
- SCSS 必须从 `.vue` 提取到独立文件，`.vue` 内只留 `@use`；组件专属 `styles/<Name>.scss`（PascalCase），partial 仅 `_mixins.scss`
- 文件头注释：每个 `.ts`/`.vue` 顶部必须有 10~30 字功能说明（`.vue` 用 `<!-- -->` 放 `<template>` 前）；`.scss` 不适用
- 模块内代码分层：共享常量 → `types/index.ts`，纯工具函数 → `utils.ts`，禁止复制粘贴（2 处以上使用即提取）
- **SCSS 嵌套陷阱**：档位/状态变体必须用 `.si-xxx--tier &` 反向选择器（`&` 为当前元素选择器）；写成 `.si-xxx--tier { .si-xxx__el {} }` 会被 Sass 前置父选择器变成错误的后代链
- 禁止硬编码 `font-size`/`font-weight`/`line-height`/颜色，用设计 Token；颜色统一 `$color-*` 语义色（旧 `$brand-*` 已删除）+ `var(--b3-theme-*, $color-*)` 双保险
- **±2px 间距 Token 映射**：2px=`$spacing-2px`、3px=`$spacing-px`、6px=`m.$gap-xs`、10px=`m.$spacing-2_5`；**14px / 18px 无 Token**，只能硬编码并加 `// 无对应 Token` 注释
- `--b3-theme-primary` 的 fallback 全库统一为 `$color-danger`（历史约定，勿"修正"）
- 背景与过渡对齐 gitPush 范式：底色 `background` + 卡片 `surface`；遮罩 `rgba(0,0,0,0.5)` 禁 `backdrop-filter`；过渡统一 0.12s ease；全屏遮罩 `z-index: 10000`
- **Vue scoped CSS 的父 scope 只传给子组件的「单根节点」**：把带布局 class 的模板拆成**多根节点**子组件后，父组件 scoped 样式完全不生效。跨组件共用的布局 class 必须抽独立 partial，**每个渲染它的组件各自 `@use`**，让 scoped 编译带上自身 `data-v`
- Dock 面板根容器 `padding-right` ≥ `$spacing-2`

## 重构模式（已验证可复用）
- 巨型文件拆分：Manager 类独立文件 + composable 按领域拆分 + 子组件提取
- 样式合规：硬编码值→设计 Token、box-shadow→border、SCSS 提取
- 冗余消除：公共函数提取、watch 合并、computed 预计算映射
- 响应式布局：纯 CSS flex-wrap 替代 JS 监听
- 拆分依据：重复 3 次前不抽象（Rule of Three），但**突破 500 行硬阈值同样是明示的拆分依据**
- **拆分文件后必须同轮全量切换 import 来源**（否则 build 报 `MISSING_EXPORT`）。2026-09-10 实测教训（DatePicker 拆 `utils.ts` → `utils.ts` + `formatUtils.ts`）：`parseDate` 已随模板引擎迁走，但 `useDatePicker.ts` 仍从 `./utils` 导入 → 用户 build 才暴露。**三道验证各查不同问题，缺一不可**：ESLint（`read_lints`）只查规范、**不查未导出成员也不查类型**；`npx tsc --noEmit` 能查出 `TS2614 无导出成员` 与 `TS2322 类型不匹配`（同轮还查出 `buildModelValue` 三元表达式产出 `(string | Date)[]` 不可赋给 `DatePickerValue` —— 需按分支分别 map）；rollup/vite build 才查 `MISSING_EXPORT`。故**改完导出边界后应本地跑一次 `npx tsc --noEmit` 并过滤新增文件路径**（该命令不在禁用清单内，只读）
- 非 deep watch 对原地 splice 数组引用永不触发 → 返回全新数组
- 组件内常量若被 composable 运行时引用，**不能**放 `types/index.ts`（其运行时 import `index.vue` 会形成循环），应拆 `types/xxx.ts` 独立文件
- `read_lints` 偶有陈旧诊断（行号不随编辑移动）：需把报的行号对应代码读出来核对，**不要一律当陈旧忽略**（曾漏掉真实的少传参数 bug）

## 功能模块状态（摘要）
- **gitPush**：多本地路径配置（`resolveValidPath`）、响应式双列、commit log 数量选择、StatsView 区块卡片化网格；历史重写已 fast-import 化（`cat-file --batch` 批量查 tree + deleteall/全量 M + 临时 ref + CAS 切回，`GitExecutor.execGitStreaming`）；提交规则检查 14 条（7 原 + 4 首轮 + 3 可选），配置经 `DEFAULT_COMMIT_RULE_CONFIG` 与 `readCommitRuleConfig(prefs)` 单一入口，AI 生成后走 `normalizeCommitMessageFormat` 规范化
- **S3 备份**：直接上传模式（无 zip 打包上传）+ 状态栏集成；第五个「增量」Tab（实验性）承载增量备份/还原；`buildBackupUploadKey` 统一 key 规则；`useBackupOrchestrator` + `BackupTab` + `IncrementalTab` 拆分；`instance.ts` 断开循环依赖
- **componentPreview**：addTab + openWindow 双形态，静态快照 + 可复制代码；`types/size.ts` + `composables/usePreviewSize`（key `component-preview-size`）；`PreviewGroup.sizeable` 标记支持 size 的组件，`PreviewSection.resolveProps` 只向未显式指定 size 的示例注入档位；不绑定默认快捷键（仅命令面板入口）；已集成状态栏功能列表
- **statistics**：分布 Tab 为单列纵向流（汇总栏 → 排行表格 → 字数饼图）；`BLOCK_TYPE_LABELS` 仍被 baseStats 使用勿删
- **toolCollection**：底部面板 + Tab 切换，首个工具 base64Image（已转 `_ConfigOnly`）
- **compactMode**：3 档密度 + 5 档字号 + 5 区域开关
- **skillLearning**：代码片段练习库 + 闪卡记忆
- **aiContentGenerator**：已完成共享组件合规改造（30 处内联 svg → 0、13 处原生 button → 1 例外、6 处原生表单控件 → 0、62 处硬编码文案 → 0）；`CollapsibleSection` 保留原生 button（合规例外，已补 aria）；`ReviewRadarChart` 自建 SVG 未迁移（Chart 不支持 radar）
- **bookmarkMarker**（2026-09-10 完成审查与合规改造）：原生 button/select/input/radio/range/label/chip 共 29 处 → 全 0；`RuleItem.vue` 422 → 202 行（拆出 `ruleItem/{TagInputField,IconSelectField,ModeGroupField}.vue`），`styles/RuleItem.scss` 318 → 59 行；`RuleItem` 数据流改 `patch`（只改父级对象内存）+ `commit`（落盘/通知/提示）+ `remove`（按对象身份）三事件，顺带修掉滑块逐像素写盘与 toast 刷屏；`v-for` key 由索引改为 `WeakMap` 生成的规则对象稳定 key；i18n 分片由嵌套 32 键改扁平 34 键（9 键改名避跨分片重名）。**取色器缺陷已修**（`ColorField` 提升）

## 禁止事项
- 禁止执行 `pnpm vite build` 和 `pnpm lint`（用户自行验证）
- 禁止私自执行 `dotnet build`
- 禁止跨 feature 直接导入（必须通过事件总线 + App.vue 调度）
- 禁止在 feature 内自建共享组件已覆盖的 13 类控件
- `Button.vue` 的 `isIconOnly` computed 陈旧 + 2 项冗余属**已知并有意保留**，不要主动重提或"修复"
