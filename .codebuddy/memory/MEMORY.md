# 项目记忆（siyuanPluginVueSN）

> 最后整理：2026-09-10（压缩去重 + compactMode 合规改造 + 共享组件库扩至 19 个：InputGroup / InputGroupAddon）

## 编码规范偏好
- 统一入口原则（禁止在 feature 内直接调思源框架）：存储 `PluginStorage`/`TypedStorage`；Node `getNodeModules`；事件 `emitCustomEvent`；SQL `@/api`；AI `@/utils/aiApi`；定时器 `TimerRegistry`；Dock 预加载 `@/utils/dockPreload`；剪贴板/下载/动态样式 `@/utils/domUtils`；Dock/Modal `@/utils/vueAppHelper`
- UI 风格：Codex 设计语言（暖色中性、边框优先、无发光阴影、0.12s ease 过渡、主题自适应）
- Vue emit 必须 camelCase；`if` 必须有 `{}`；图标禁止 emoji，须用 `icons.ts` 已注册 `IconKey`
- 新功能必须 8 处注册（index.ts + types + features/index.ts + src/index.ts + settings + i18n + config + icons）
- i18n 只改分片 `src/i18n/{zh_CN,en_US}/<feature>.json`；顶层合并 JSON 由 `pnpm i18n:merge` 生成，禁止手改
- 独立窗体精简：`isFloating`（`getFrontend() === "desktop-window"`）+ `v-if="!isFloating"` 隐藏重复标题，仅改显示、逻辑零改动
- 快捷键冲突检查：须递归搜 `src/features/**`（hotkey 也注册在 `features/<name>/types/index.ts`）。已知未修冲突：tableOfContents 与 ideaGenerator 同为 ⌃⌥I
- **禁止私自执行** `pnpm vite build` / `pnpm lint`（用户自行验证）；其他 C# 项目禁止 `dotnet build`

## 共享组件库（`src/components/`，20 个）
- 规则：**先查用法（组件预览面板 / `previewData/*.ts` / 源码 `interface Props`）→ 优先复用（禁止 feature 自建同类）→ 改 API 必同步预览清单**
- 清单：Button / Input / Select / ColorField / FormField / **InputGroup** / **InputGroupAddon** / Label / Switch / Checkbox / DatePicker / Slider / Tag / Badge / Avatar / Card / **ConfirmDialog** / Chart / IconWrapper / Loader
- 结构约定：组件私有子部件与纯函数放同名小写子目录（如 `datePicker/`），不计入清单且**禁止 feature 直接导入**；子部件样式必须各自独立 SCSS（scoped 只对子组件根元素生效）；配套但需被 feature 直接使用的组件也平铺为公开条目（`InputGroup` + `InputGroupAddon` 共用「InputGroup」一个预览分区）
- **改计数前必须实测**：并行变更频繁（曾一天 15→16→17→19），禁止凭记忆改文档「N 个」
- 尺寸档位：`xsmall`/`small`/`medium`/`large`（默认 `small`），字号阶梯 10/12/14/16（`$font-size-2xs/xs/sm/base`，四档禁止同号）
- 新增组件 = 4 类位置：`<Name>.vue` + `styles/<Name>.scss`（复杂组件拆多份）+ `previewData/<name>.ts`（`props` 与 `code` 严格一致 + 接入 `index.ts`）+ 文档计数（`AGENTS.md` 5 处、清单表行、复用清单、根 `README.md`、`componentPreview/README.md`）
- 允许自建例外：纯展示局部布局容器、无档位 26×26 `.icon-btn`
- **分段单选组（档位/模式切换）无共享 Radio 组件**：统一用 `Button` 分组表达（选中 `variant="primary"` / 未选中 `variant="ghost"` + `text` + `size="xsmall"` + `:aria-pressed`，容器 `flex-wrap`）；先例 `bookmarkMarker/ruleItem/ModeGroupField.vue`、`compactMode/components/CompactModeSettings.vue`

### 组件约定与陷阱
- `Button`：颜色轴 `variant`/`severity` × 外观轴 `outlined`/`text`；既有 5 个 variant 语义不可改（180+ 处依赖），新能力走 `--severity-*`/`--outlined`/`--text` + CSS 变量 `--btn-color`/`--btn-on-color`/`--btn-soft`/`--btn-soft-strong`。纯图标按钮必须 `aria-label`/`title`；loading 用 `visibility:hidden` 保宽；图标随档 12/14/16/18
- `ConfirmDialog`（2026-09-10 新增，第 20 个组件）：`visible` 受控 + `title`/`message`（`\n` 多行）/`confirmText`/`cancelText`/`danger`/`size`/`closeOnMask`/`confirmLoading`；emits `confirm`（**确认后不自动关闭**，由父决定关闭时机以容纳异步）/`cancel`/`update:visible`（取消时与 `cancel` 一并派发，故支持 `v-model:visible`）；默认插槽覆盖消息区。**只有 Esc 走 window 监听，Enter 不绑定**（否则与聚焦按钮的原生 click 重复派发确认）；打开时焦点给对话框容器而非确认按钮（危险操作默认聚焦确认按钮会被 Enter 误触）。三处 feature 先例（s3FileManager/gitPush/shortcut）的本地实现**尚未迁移**，是后续清理项
- 弹层类共享组件（含 `ConfirmDialog`）在组件预览中必须**沙箱覆盖**：遮罩是 `position: fixed`，直接快照会铺满整个窗口 → `componentPreview/styles/PreviewSection.scss` 的 `.cp-card__stage` 设 `position: relative`，并把舞台内 `.si-confirm-mask` 覆盖为 `absolute; z-index: 1`（只影响预览沙箱，不改组件本体）；新增其它弹层组件时在同一处追加遮罩类名
- `Checkbox`：原生隐藏 input 承载语义，`isGroup = !binary && Array.isArray(modelValue)` 自动分模式；`indeterminate` 只能写 DOM 属性（`watch flush:"post"` + `onMounted`）；分组模式返回新数组；受控回写 `nextTick(syncNativeState)`
- `DatePicker`（首个带私有子目录的组件）：入口 + `datePicker/`（types/formatUtils/utils/useDatePicker/PickerPanel/CalendarPanel/MonthYearPanel）。①零日期库，自建 `dateFormat` 模板引擎（令牌对齐 PrimeVue，`parseDate` 只支持数值令牌）；②**无时区字符串必须按本地时间解析**（`LOCAL_DATE_PATTERN` 显式构造，否则 UTC 跨日错位）；③`isDateDisabled` 收敛 min/max + disabledDays + disabledDates（数组预处理为 `Set`）；④42 格元数据一次性 `computed`；⑤焦点三坑：关闭后 `input.focus()` 会重开面板（`skipFocusOpen` 抑制）、视图切换后原按钮卸载导致焦点掉 body + Esc 失效（`focusActiveView()`）、面板容器需 `tabindex="-1"`；⑥有意偏离 PrimeVue：`dateFormat` 默认 `yy-mm-dd`、`firstDayOfWeek` 默认 1，不做 `showTime`/`multiple`/`inline`/`numberOfMonths`；⑦弹层沿用 `Select` 相对定位，`overflow:hidden` 容器内可能被裁剪（已知限制，不用 Teleport）
- `ColorField`（由 `generalSettings` 提升为共享）：色块 + 32 色自绘调色板 + hex 文本双向联动。**原生 `<input type="color">` 在思源 Electron 中不弹取色器**，颜色选择一律用它；全项目仍有 8 个文件遗留原生实现待替换。事件：`update:modelValue`（实时）+ `change`（提交）
- `Input.borderless`：去边框去底色（三条高特异性选择器覆盖基类 hover/focus-within），供 chips 类复合控件内嵌；焦点反馈由外层 `:focus-within` 承担
- `InputGroup` + `InputGroupAddon`（2026-09-10 新增，参照 PrimeVue）：无缝拼接容器。成员边框**不在根元素**上（`Input` 在 `__wrapper`、`Select` 在 `__trigger`、`DatePicker` 在 `__wrapper`、`Button`/`Addon` 在根）。要点：①**插槽子组件不带接收方的 scope 属性**（见下方「scoped 陷阱」），故所有命中成员的规则必须写成 `> :deep(.si-input)`（直接子）或 `:deep(.si-input__wrapper)`（成员内部，后代形式更耐受结构调整）；②`margin-left: -1px` 合并相邻边框 + hover/focus-within 抬 `z-index:1`，否则聚焦边框缺一段；③档位（内边距/字号/最小高度）经根类输出 `--ig-addon-*` CSS 变量**跨组件继承**给 Addon，不用 provide/inject；④Input/DatePicker 在组内 `flex: 1 1 0`（`flex-basis:0` 可压制它们自带的 `width:100%`），Select `0 1 auto` + min-width，Addon/Button `0 0 auto`；⑤**容器禁设 `overflow:hidden`**（Select 下拉是 wrapper 内相对定位，会被裁剪）；⑥成员不得带 label/hint/error（FormField 撑高错位）；⑦DatePicker 组内 `outline-offset` 归一为 -1px
- 「实时跟随 + 一次性落盘」统一双事件：`update:modelValue`（内存）+ `change`（落盘）；`Slider`/`ColorField`/`Input` 均如此
- `Input`/`Select` 在弹窗/表单中必须显式 `size="small"`（默认 medium 36px 过高）
- 实底控件禁用 `focus-ring` mixin（只改 `border-color`，实底 border 为 transparent 会完全不可见）→ 用 `outline`（同 `Switch.scss`）
- **覆写共享组件内部样式必须算特异性**：`Label.scss` 的 `.si-label:not(.si-label--inline){margin-bottom}` 含 scoped 属性后为 (0,3,0)，父组件写 `.row .si-label` 也只到 (0,3,0)，会落入"比样式表顺序"的赌局；加一层父选择器（`.panel .row .si-label`，(0,4,0)）才稳
- **组件 props 中的 plugin 类型**：思源 `Plugin` 基类无 `settings` 字段；项目先例用 `import type PluginSample from "@/index"`（`PluginSample.settings!: PluginSettings`），`import type` 被擦除故无运行时循环。另：`CompactModeSettings` 这类被 `PluginSettings` 赋值的接口，字段类型**不能**随手收紧成字面量联合（`number` 字段改字面量联合会立刻 TS2322）
- **Vue 的 `slots` 不是响应式**：`instance.slots` 原地赋值 → `computed` 不因插槽增删重算；需跟随插槽变化必须用普通函数或模板直读 `$slots`
- `Select`/`Input`/`Slider` 的 `containerAttrs` 会剥离 `class`/`style`，预览中不能靠 props 传 style 控宽 → 由容器 SCSS 控制
- `Loader` 无 props 且 `height:100%`，父容器必须给显式高度；`Chart.vue` 仅支持 line/bar/pie/doughnut/area（无 radar）
- `Select` 支持 `#selected` 作用域插槽与 `SelectOption.keywords`；`@update:model-value` 载荷为 `string | number | boolean | null`
- 具名/作用域插槽与事件语义无法在预览快照呈现，必须在 `componentPreview/README.md` 的「具名插槽」「事件契约」表登记

## 代码风格硬规则
- 单文件行数：300 警戒 / 500 硬阈值 / ≥1000 必须重构；单一函数 ≤30 行
- SCSS 必须从 `.vue` 提取（`.vue` 内只留 `@use`）；组件专属 `styles/<Name>.scss`（PascalCase），partial 仅 `_mixins.scss`
- 文件头注释：每个 `.ts`/`.vue` 顶部 10~30 字功能说明（`.vue` 用 `<!-- -->` 放 `<template>` 前）；`.scss` 不适用
- 模块内分层：共享常量 → `types/index.ts`，纯工具 → `utils.ts`，2 处以上使用即提取
- **SCSS 嵌套陷阱**：档位变体必须写 `.si-xxx--tier &` 反向选择器，写成 `.si-xxx--tier { .si-xxx__el {} }` 会变成错误后代链
- 禁止硬编码 `font-size`/`font-weight`/`line-height`/颜色，用设计 Token；颜色统一 `$color-*` + `var(--b3-theme-*, $color-*)` 双保险
- **±2px 间距 Token**：2px=`$spacing-2px`、3px=`$spacing-px`、6px=`m.$gap-xs`、10px=`m.$spacing-2_5`；14px/18px 无 Token，硬编码 + `// 无对应 Token`
- `--b3-theme-primary` 的 fallback 全库统一 `$color-danger`（历史约定，勿"修正"）
- 背景与过渡对齐 gitPush 范式：底色 `background` + 卡片 `surface`；遮罩 `rgba(0,0,0,0.5)` 禁 `backdrop-filter`；过渡统一 0.12s ease；全屏遮罩 `z-index: 10000`
- **Vue scoped 的父 scope 只传给子组件单根节点**：带布局 class 的模板拆成多根节点后父样式完全失效；跨组件共用布局 class 必须抽独立 partial，每个组件各自 `@use`
- **scoped 的两个反直觉点**（2026-09-10 InputGroup 实测）：①父 scope 只加在「模板里直接写」的子组件根元素上；②**经插槽传入的子组件带的是调用方的 scope 属性**（`withCtx` 把渲染实例切回插槽归属者），容器组件写 `.容器 > .子组件` 会被编译成 `.容器[data-v-x] > .子组件[data-v-x]` 而**永不匹配**，必须写 `> :deep(.子组件)`。校验手段：`@vue/compiler-sfc` 的 `compileStyle({scoped:true})`，但**必须先用 Sass 展平**再喂进去（喂嵌套 CSS 会得出错误结论）
- Dock 面板根容器 `padding-right` ≥ `$spacing-2`

## 重构模式（已验证）
- 巨型文件拆分：Manager 独立文件 + composable 按领域拆 + 子组件提取；样式硬编码→Token、box-shadow→border
- 拆分依据：重复 3 次前不抽象（Rule of Three），但突破 500 行硬阈值同样是明示拆分依据
- **i18n 类型用「键清单派生」避免可选键污染调用方**：写成 `const I18N_KEYS = [...] as const` + `type I18n = Record<(typeof I18N_KEYS)[number], string>`，取值函数按清单逐键 `?? ""` 填充 → 调用方永远拿到 `string`。若写成 `interface { title?: string }`，所有 `snapshotTask.progress({ label: i18n.value.xxx })` 都报 TS2322（`string | undefined` 不可赋 `string`），逐处 `?? ""` 更啰嗦
- **拆文件后必须同轮全量切换 import 来源**（否则 build 报 `MISSING_EXPORT`）。三道验证各查不同问题，缺一不可：ESLint（`read_lints`）只查规范，**不查未导出成员、不查类型**；`npx tsc --noEmit` 查 `TS2614 无导出成员`/`TS2322 类型不匹配`（只读，允许跑）；rollup/vite build 才查 `MISSING_EXPORT`。故改完导出边界应跑一次 `npx tsc --noEmit` 过滤新增文件
- 非 deep watch 对原地 splice 不触发 → 返回全新数组
- 组件内常量若被 composable 运行时引用，不能放 `types/index.ts`（会与 `index.vue` 循环），应拆 `types/xxx.ts`
- `read_lints` 偶有陈旧诊断（行号不随编辑移动）：须读出对应代码核对，不要一律当陈旧忽略（曾漏掉真实少传参数 bug）

## 功能模块状态（摘要）
- **gitPush**：多本地路径（`resolveValidPath`）、响应式双列、commit log 数量选择、StatsView 卡片化网格；历史重写 fast-import 化（`cat-file --batch` + deleteall/全量 M + 临时 ref + CAS 切回）；提交规则 14 条，配置经 `DEFAULT_COMMIT_RULE_CONFIG` / `readCommitRuleConfig(prefs)` 单一入口，AI 生成后走 `normalizeCommitMessageFormat`
- **S3 备份**：直接上传（无 zip）+ 状态栏集成；第五个「增量」Tab（实验性）；`buildBackupUploadKey` 统一 key；`useBackupOrchestrator` + `BackupTab` + `IncrementalTab`；`instance.ts` 断循环依赖
- **componentPreview**：addTab + openWindow 双形态；`types/size.ts` + `usePreviewSize`（key `component-preview-size`）；`sizeable` 标记 + `resolveProps` 只注入未显式指定 size 的示例；**`PreviewExample.render?: (props) => VNode | VNode[]`**（2026-09-10 新增，默认插槽需放多个子组件的复合示例用，`PreviewSection` 内 `defineComponent` 的 `SlotRenderer` 承载，存在时优先于 `slotText`）；无默认快捷键；已集成状态栏功能列表
- **toolCollection**：底部面板 + Tab 切换，首个工具 base64Image（已转 `_ConfigOnly`）
- **dataSnapshot**（2026-09-10 合规改造）：控件全量换共享 `Button`/`Input`/`ConfirmDialog`（自建 `.ds-btn*`/`.ds-create__input`/`.ds-confirm*` 三段样式删除）；入口 358→228 行，拆 `components/{LocalSnapshotList,CloudSnapshotList,SnapshotDetail}.vue` + `types/i18n.ts`；API 层 `getRepoSnapshotContent` 由裸 `fetch` 改走 `requestOrThrow`（失败仍返回 `[]`）；`(snap as any).tag` 断言删除（接口本就有 `tag?`）；两处静默 `catch {}` 补日志；样式引入由 `import "./styles/index.scss"` 改为 `<style scoped lang="scss">@use`；Dock 根容器补 `padding-right`
- **aiContentGenerator**：共享组件合规（内联 svg 30→0、原生 button 13→1 例外、原生表单控件 →0）；`CollapsibleSection` 保留原生 button（合规例外，已补 aria）；`ReviewRadarChart` 未迁移（Chart 无 radar）
- **bookmarkMarker**：原生控件 29 处 → 0；`RuleItem.vue` 422→202 行（拆 `ruleItem/{TagInputField,IconSelectField,ModeGroupField}.vue`）；数据流改 `patch`/`commit`/`remove` 三事件；`v-for` key 改 `WeakMap` 稳定 key；i18n 分片扁平 34 键
- **statistics**：分布 Tab 单列纵向流；`BLOCK_TYPE_LABELS` 仍被 baseStats 使用勿删
- **compactMode**（2026-09-10 合规改造）：3 档密度 + 6 档字号 + 5 区域开关；`ALL_DENSITIES`/`ALL_FONT_SCALES`/`ALL_AREAS` 导出为单一来源（视图选项表由常量派生）；`applyCompactMode` 先 `clearCompactClasses()` 复位再置位（幂等）；面板原生 radio chip → 共享 `Button` 分组、原生 label → 共享 `Label`，样式外置 `styles/CompactModeSettings.scss`；i18n 修掉「紧洛模式」错别字 + 新增密度 3 键；组件 343 → 243 行
- **skillLearning**：代码片段练习库 + 闪卡记忆

## 禁止事项
- 禁止执行 `pnpm vite build` / `pnpm lint`（用户自行验证）；禁止 `dotnet build`
- 禁止跨 feature 直接导入（必须事件总线 + App.vue 调度）
- 禁止在 feature 内自建共享组件已覆盖的控件
- `Button.vue` 的 `isIconOnly` computed 陈旧 + 2 项冗余属**已知并有意保留**，勿主动重提
