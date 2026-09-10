# 项目记忆（siyuanPluginVueSN）

> 最后整理：2026-09-10（去重压缩；共享组件库 22 个）
> 说明：编码规范正文见随项目上下文自动加载的 `AGENTS*.md`，此处只记**不在规范文档里的经验与陷阱**。

## 环境（本机 pnpm 12）
- 启用了**构建脚本白名单**：`pnpm-workspace.yaml` 的 `allowBuilds`（`@parcel/watcher` / `esbuild` / `vue-demi` = `true`）。若 install 报 `ERR_PNPM_IGNORED_BUILDS`，先看这个文件 —— pnpm 会**自动生成占位内容**（`set this to true or false`）导致 install 以报错收尾。`vue-demi` 的脚本必须允许（切换 Vue 2/3 入口）；`esbuild` / `@parcel/watcher` 靠 optional 平台包即可工作
- **依赖包损坏的诊断**（`pnpm dev` 报 `Cannot find module 'xxx'` 时）：扫 `.pnpm/*/node_modules/<pkg>` 是否缺 `package.json`，一次拿到全量损坏清单与「单点/面性」判断
- **修复一律走 pnpm 自身命令**（如 `pnpm install --force`）：`.pnpm/<pkg>/node_modules/<dep>` 多为 junction，手删目录有「跟随 junction 删掉目标真包」的风险
- `pnpm dev` 是 `vite build --watch`，属禁止 AI 执行项（见「硬性边界」）

## 硬性边界
- **禁止私自执行** `pnpm vite build` / `pnpm lint`（用户自行验证）；其他 C# 项目禁止 `dotnet build`。可执行：`read_lints`、`npx tsc --noEmit`、`pnpm i18n:merge`
- 统一入口清单见 `AGENTS.md`；新功能 8 处注册；i18n 只改分片（顶层 JSON 由 merge 生成）
- 快捷键查重必须递归搜 `src/features/**`（hotkey 也在 `features/<name>/types/index.ts`，用 `features/*/index.ts` 通配会漏检）。已知未修冲突：`tableOfContents` 与 `ideaGenerator` 同为 ⌃⌥I
- 独立窗体精简：`isFloating`（`getFrontend() === "desktop-window"`）+ `v-if="!isFloating"` 隐藏重复标题

## 共享组件库（`src/components/`，22 个）
- 清单：Button / Input / Select / Listbox / ColorField / FormField / InputGroup / InputGroupAddon / Label / Switch / Checkbox / RadioButton / DatePicker / Slider / Tag / Badge / Avatar / Card / ConfirmDialog / Chart / IconWrapper / Loader
- **改计数前必须实测**（并行会话频繁变动，曾一天内 15→16→17→19→20→21→22）；新增组件 = 4 类位置：`<Name>.vue` + `styles/<Name>.scss` + `previewData/<name>.ts`（**双导出**「分组对象 + 分组数组」并接入 `index.ts`）+ 文档计数（`AGENTS.md` 5 处 + 清单表行 + 复用枚举、根 `README.md`、`componentPreview/README.md` 4 处）
- 私有子部件/纯函数放同名小写子目录（如 `datePicker/`），不计入清单且禁止 feature 直接导入；配套但需 feature 直接使用的组件也平铺（`InputGroup` + `InputGroupAddon` 共用预览分区）
- 尺寸四档 `xsmall/small/medium/large`（默认 `small`），字号阶梯 10/12/14/16，四档禁同号
- **分段档位/模式切换用 `Button` 分组表达**（选中 `variant="primary"`、未选中 `ghost` + `text` + `size="xsmall"` + `:aria-pressed`，容器 `flex-wrap`；先例 `ruleItem/ModeGroupField.vue`、`compactMode/CompactModeSettings.vue`）；`RadioButton` 用于表单式互斥选项
- 允许自建例外：纯展示局部布局容器、无档位 26×26 `.icon-btn`
- 改 props / 行为 / 具名插槽 / 事件契约后，必须同步 `previewData/*.ts` 与 `componentPreview/README.md`（含「具名插槽」表与「事件契约」表）
- 预览框架：`PreviewExample` 支持 `props` + `slotText` 或 `render`（默认插槽需放多个子组件时）；**具名/作用域插槽与事件语义无法在快照呈现**，必须登记到 README

### 组件特有陷阱
- `Button`：既有 5 个 variant 语义不可改（180+ 处依赖），新能力走 `--severity-*`/`--outlined`/`--text` + `--btn-*` CSS 变量；纯图标必须 `aria-label`；loading 用 `visibility:hidden` 保宽；图标随档 12/14/16/18。**`isIconOnly` computed 陈旧 + 2 项冗余属已知并有意保留，勿重提**
- `ConfirmDialog`：`visible` 受控；`confirm` 后**不自动关闭**（父决定时机以容纳异步）；**只监听 Esc、Enter 不绑定**（否则与聚焦按钮原生 click 重复派发）；打开时焦点给容器而非确认按钮。三处 feature 本地实现（s3FileManager/gitPush/shortcut）**尚未迁移**，后续清理项
- 弹层类组件（含 `ConfirmDialog`）在预览中必须**沙箱覆盖**：`componentPreview/styles/PreviewSection.scss` 的 `.cp-card__stage` 设 `position: relative`，并把舞台内遮罩类覆盖为 `absolute; z-index: 1`（仅沙箱，不改组件本体）
- `Checkbox`：`isGroup = !binary && Array.isArray(modelValue)` 自动分模式；`indeterminate` 只能写 DOM 属性（`watch flush:"post"` + `onMounted`）；分组模式返回新数组；受控回写 `nextTick(syncNativeState)`
- `RadioButton`（2026-09-10 新增）：结构同构 `Checkbox`；差异 —— **无数组模式、无 `indeterminate`、不依赖 `IconWrapper`**（圆点为纯 CSS，`scale(0)→scale(1)`，尺寸取圆框 50% 等比）；`checked = binary ? !!modelValue : modelValue === value`；emit `binary ? true : value`（**单选项不可取消**）；**同组必须传同一 `name`**，键盘与 ARIA 语义由浏览器原生提供，不自造键盘逻辑；**只读拦截必须包含方向键**（原生方向键会直接改选并移动组内焦点，只拦 Space/click 会漏，Checkbox 无此问题）；`.ts` 预览中组用法只能写在 `code`（`render` 是默认插槽内容，无法并排放多个选项）
- `DatePicker`：自建 `dateFormat` 模板引擎（`parseDate` 只支持数值令牌）；**无时区字符串必须按本地时间解析**（`LOCAL_DATE_PATTERN`，否则 UTC 跨日错位）；`isDateDisabled` 收敛四类约束（数组预处理为 `Set`）；42 格元数据一次性 `computed`；焦点三坑 —— 关闭后 `input.focus()` 重开面板（`skipFocusOpen`）、视图切换后焦点掉 body + Esc 失效（`focusActiveView()`）、面板容器需 `tabindex="-1"`；弹层沿用相对定位，`overflow:hidden` 容器内会被裁剪（不用 Teleport）
- `ColorField`：**原生 `<input type="color">` 在思源 Electron 中不弹取色器**，颜色选择一律用它；全项目仍有 8 个文件遗留原生实现待替换。事件 `update:modelValue`（实时）+ `change`（提交）
- `Listbox`：**指示器自绘、不复用 `Checkbox`**（`role="option"` 内不得嵌套可交互元素，`Checkbox` 是 `<label>` + 原生 input 会双重语义且双触发），仅勾选图标复用 `IconWrapper`；键盘**只做基础键**（`aria-activedescendant` + 容器 tabindex），不做组合键/字符定位/虚拟滚动/分组与字段映射；校验态按项目约定用 `error`（非 `invalid`）
- `InputGroup` + `InputGroupAddon`：成员边框**不在根元素**上（`Input` 在 `__wrapper`、`Select` 在 `__trigger`、`DatePicker` 在 `__wrapper`、`Button`/`Addon` 在根）→ 命中成员必须 `> :deep(.si-input)` / `:deep(.si-input__wrapper)`；`margin-left: -1px` 合并边框 + hover/focus-within 抬 `z-index:1`；档位经 `--ig-addon-*` CSS 变量跨组件继承（Sass 中 CSS 变量值必须插值 `#{$var}`）；Input/DatePicker 组内 `flex: 1 1 0` 压制自带 `width:100%`；**容器禁设 `overflow:hidden`**（会裁 Select 下拉）；成员不得带 label/hint/error
- `Slider`（2026-09-10 修 5 项缺陷）：原生 `input[type=range]`，键盘与 `role="slider"` + `aria-valuemin|max|now` 全由浏览器提供（**不要自实现**）。①`readonly` 原生不支持 → `handleInput`/`handleChange` 守卫 + `syncNativeValue()` **同步回滚**（`modelValue` 未变时 Vue 不会重 patch `value`，必须自行写回）+ `handleKeydown` 拦 8 个改值键（**Tab 放行**）+ `aria-readonly`；②`showMinMax` 排在**轨道下方两侧**（`__field-column` 列容器使极值与轨道等宽），与 `showValue` 共用 `formatValue`；③档位尺寸经 `--si-slider-track-h`/`--si-slider-thumb-size` 单点驱动 4 个伪元素（原来 track 伪元素写死 6px → 档位对轨道完全无效），**必须带 fallback** 以防伪元素不继承时拇指消失；④`.si-slider__field` 在列布局中**不能有 `flex: 1`**（会纵向拉伸），改由 `__field-column` 承担；⑤**Chromium 的 `::-webkit-slider-thumb` 默认与轨道「顶」对齐**（不是垂直居中）→ 必须补 `margin-top: calc((轨道高 - 拇指高) / 2)`，否则拇指整体垂到轨道下方，视觉重心偏下、看着像「没居中」；Firefox 的 `::-moz-range-thumb` 由浏览器自动居中，**不要**给它加 margin；⑥**轨道色必须取 `--b3-border-color`**（浅色 `#e0deda`）—— 原用 `--b3-theme-surface`（`#f7f7f5`）在面板底色 `--b3-theme-background`（`#ffffff`）上仅差 ~3% 灰度、肉眼等同不可见（用户报「看不到横线，只看得到圆形的」）；⑥`.si-slider` 焦点环的 fallback `rgba(hsl(...), 0.2)` 是**非法 CSS**（变量缺失时整条丢弃），但该变量由 `themeColor` 运行时写入、全项目 60+ 处同写法 → 已知潜在问题，勿单独"修正"
- `FormField`：新增可选 `labelId`（`:id` 打在 `.si-form-field__label` 上，供控件 `aria-labelledby` 关联；不传输出不变）。**它是多根组件（label → 默认插槽 → hint → 计数）→ 控件必须放进默认插槽**，写成自闭合 sibling 会让 hint 排到控件上方
- `Label`：**禁用态邻近兜底 `:has(+ :disabled)` 只命中「禁用态在根元素上」的成员**（原生 `button[disabled]`、原生 `input`）；`Input`/`Select`/`DatePicker` 须包装层显式加 `data-disabled`。`variant` 仅在 `--inline`（`tag !== "label"`）下可见；**不得加 `inheritAttrs:false`**
- **相邻色陷阱（面板/卡片对）**：`--b3-theme-surface` 与 `--b3-theme-background` 是「卡片 / 面板」这一对相邻色，**不能用来画需要与面板区分开的细线** —— 浅色下 `#f7f7f5` vs `#ffffff` 仅差 ~3% 灰度，等同不可见（`Slider` 轨道曾因此「看不到横线」，已改 `--b3-border-color` = 浅色 `#e0deda` / 暗色 `#3a3a3c`，语义即凹槽/分隔）。同类偏弱：`--b3-theme-surface-lighter`（`Switch` 轨道）
- **错误色 Token 陷阱**：`--b3-theme-destructive` **从未定义**（只有 `--b3-theme-error`）→ 写它恒走 fallback 且暗色偏暗。已修 `Label.scss` + `Slider.scss`；**残留 4 处**：`Tag.scss`(3) / `Badge.scss`(1)
- `Select`（2026-09-10 ARIA + 键盘改造）：`#selected` / `#option` 作用域插槽 + `SelectOption.keywords`；`@update:model-value` 载荷 `string|number|boolean|null`；`containerAttrs` 剥离 `class`/`style`（预览不能靠 props 控宽）。ARIA：trigger `role="combobox"`、面板 `role="listbox"`、选项 `role="option"`（`aria-selected`/`aria-disabled`）、分组 `role="group"` + `aria-labelledby` 指向可见分组标题；**列表容器恒常渲染**（空态是其子节点，否则 `aria-controls` 悬空）；**筛选框必须常驻**（原条件含 `filteredOptions.length > 0` → 输入不匹配字符即卸载输入框且焦点掉 body）。键盘：单一 `activeIndex`（渲染顺序 = 导航顺序 = DOM 顺序）驱动高亮 + `aria-activedescendant` + `scrollIntoView`；打开定位已选项（无则 ↓ 首项 / ↑ 末项）；`closeDropdown({ restoreFocus })` 仅 Esc 与键盘选中传 true（外部点击/Tab/鼠标选中须 false，否则抢焦点）；**筛选框按键须单独处理**（复用主处理器会 `preventDefault` 掉 `Space` → 打不出空格）。私有实现目录 `src/components/select/`（types/导航/工具/2 composable，禁止 feature 直接导入；`SelectOption`/`SelectGroupOption` 有 24 个文件从 `@/components/Select.vue` 导入 → **导出路径不可变**）
- `Loader` 无 props 且 `height:100%`（父容器必须给显式高度）；`Chart.vue` 仅 line/bar/pie/doughnut/area（无 radar）
- `Input.borderless`：去边框去底色，供 chips 类复合控件内嵌，焦点反馈由外层 `:focus-within` 承担
- 「实时跟随 + 一次性落盘」统一双事件：`update:modelValue` + `change`（`Slider`/`ColorField`/`Input`）
- `Input`/`Select` 在弹窗/表单中必须显式 `size="small"`（默认 medium 36px 过高）
- 实底控件禁用 `focus-ring` mixin（只改 `border-color`，实底 border 为 transparent 会完全不可见）→ 用 `outline`（同 `Switch.scss`）

## 通用陷阱
- **Vue 的 `slots` 不是响应式**：`instance.slots` 原地赋值 → `computed` 不随插槽增删重算；需跟随变化必须用普通函数或模板直读 `$slots`
- **scoped 的两个反直觉点**：①父 scope 只加在「模板里直接写」的子组件根元素上，且只对**单根节点**生效（模板拆多根后父样式全失效）；②**经插槽传入的子组件带的是调用方的 scope 属性**，容器组件写 `.容器 > .子组件` 会编译成两处同 `data-v` 而**永不匹配**，必须 `> :deep(.子组件)`。校验手段：Sass 展平后喂 `@vue/compiler-sfc` 的 `compileStyle({scoped:true})`（直接喂嵌套 CSS 会得出错误结论）
- **覆写共享组件内部样式必须算特异性**：`Label.scss` 含 scoped 后为 (0,3,0)，父组件写 `.row .si-label` 也只到 (0,3,0) → 会落入「比样式表顺序」的赌局，加一层父选择器才稳
- **SCSS 嵌套陷阱**：档位变体必须写 `.si-xxx--tier &` 反向选择器，写成 `.si-xxx--tier { .si-xxx__el {} }` 会变成错误后代链
- **±2px 间距 Token 映射**：2px=`$spacing-2px`、3px=`$spacing-px`、6px=`m.$gap-xs`、10px=`m.$spacing-2_5`；14px/18px 无 Token，硬编码 + `// 无对应 Token`。`--b3-theme-primary` 的 fallback 全库统一 `$color-danger`（历史约定，勿「修正」）
- **四道验证各查不同问题**：`read_lints` 只查规范（**不查未导出成员/类型**）；`npx tsc --noEmit` 查 `TS2614`/`TS2322` 但**不解析 `.vue`**；`@vue/compiler-sfc` 的 `parse`+`compileScript`（取 `bindings` 喂 `compileTemplate`）才能离线验证 `.vue` 的宏/模板/模板引用绑定（需从 `node_modules/.pnpm/@vue+compiler-sfc@<ver>/...` 绝对路径 require）；vite build 才查 `MISSING_EXPORT`。故**改导出边界（拆文件/移函数）后必须跑 `npx tsc --noEmit`**，并同轮全量切换 import 来源
- 工具坑：`Get-Content X | Measure-Object -Line` **漏掉空行**（Select.vue 报 557 / 实际 616）→ 用 `(Get-Content X).Count` 或锚点行号；sass 离线编译组件 SCSS 时**自定义 importer 解析不了 `@/variables.scss`**（两种 importer 写法均失败；判据是未改动文件同样报错）→ 退化为「括号配平 + 关键声明存在性」校验
- **`.ts` 不得 `import type { X } from "@/components/Y.vue"`**（tsc 不解析 `.vue` 导出 → `TS2614`；既有噪声：`useCodeImageGenerator.ts`、`statusBar/featureRegistry.ts`）。**新解法（优于「结构化字面量」泛型）**：①类型下沉到纯 TS 模块（如 `src/components/select/types.ts`），同目录 `.ts` 直接引用真实类型、免掉泛型噪音；②`.vue` 的 `<script setup>` 用**类型别名**保住对外路径：`import type { SelectOption as Shape } from "./select/types"` + `export type SelectOption = Shape`（type-only 导出，已用 `@vue/compiler-sfc@3.5.40` 实测 `export interface` / `export type X = Y` / `export type { X } from` 三种均可编译）
- **i18n 类型用「键清单派生」**：`const I18N_KEYS = [...] as const` + `Record<(typeof I18N_KEYS)[number], string>`，逐键 `?? ""` 填充 → 调用方恒得 `string`；写成 `xxx?: string` 会让所有消费点报 TS2322
- 新增遵循既有模式的模块时，先列出同目录同类文件的**导出清单**对齐（`search_content '^export const'`），别漏「导出契约」
- 非 deep watch 对原地 splice 不触发 → 返回全新数组；组件内常量若被 composable 运行时引用，不能放 `types/index.ts`（会与 `index.vue` 循环），拆 `types/xxx.ts`
- `read_lints` 偶有陈旧诊断（行号不随编辑移动）：须读出对应代码核对，不要一律当陈旧忽略（曾漏掉真实少传参数 bug）
- 组件 props 中的 plugin 类型：思源 `Plugin` 基类无 `settings`，项目先例 `import type PluginSample from "@/index"`（`import type` 被擦除，无运行时循环）

## 功能模块状态（摘要，只留仍可执行的事实）
- **待迁移清单（已确认、尚未动）**：`ConfirmDialog` 的三处本地实现（`s3FileManager` / `gitPush` / `shortcut`）；`ReviewRadarChart` 未迁到 `Chart`（Chart 无 radar 控制器）；feature 内原生 radio 5 处（`video/CompressDialog`、`wordQuery/WordQueryPanel`、`gitPush` 的 `SettingsDialog`/`CommitFixDialog`/`BatchFixDialog`）
- **gitPush**：多本地路径（`resolveValidPath`）；历史重写 fast-import 化；提交规则 14 条经 `DEFAULT_COMMIT_RULE_CONFIG` / `readCommitRuleConfig(prefs)` 单一入口
- **componentPreview**：addTab + openWindow 双形态；`usePreviewSize`（key `component-preview-size`）；`sizeable` + `resolveProps` 只注入未显式指定 size 的示例；**受控示例在预览中可交互**（2026-09-10 起）：`PreviewSection.vue` 的内联 `PreviewStage` 持有本地 `modelValue` 并回写 `update:modelValue`，其余 props 每次渲染重解析（切档位即时生效且不覆盖用户已改的值）。两个关键约束：①`isControlledComponent()` 用 `component.props` 判断组件是否声明了 `modelValue`，**未声明则一个额外属性都不注入**（否则落进 attrs 会让多根组件如 `FormField` 报 extraneous attrs 警告）；②`hasSlot` prop 控制是否转发默认插槽，**无插槽内容时必须为 false**（否则 `$slots.default` 恒真，会改变 `Button.isIconOnly`、`Checkbox`/`Switch` 的 `label || $slots.default`、`RadioButton` 多渲染空 label 撑出 gap 等分支）。`render` 复合示例内部的子组件仍是静态 props；无默认快捷键（⌃⌥V 被 video 占用）
- **compactMode**：3 档密度 + 6 档字号 + 5 区域开关；`ALL_*` 常量单一来源；`applyCompactMode` 先复位再置位（幂等）
- **statistics**：`BLOCK_TYPE_LABELS` 仍被 `baseStats` 使用，勿删
- 其余模块（S3 备份 / toolCollection / dataSnapshot / aiContentGenerator / bookmarkMarker / skillLearning）的实现细节见各自 `src/features/<name>/README.md` 与当日日志，不在此重复

## 禁止事项
- 禁止执行 `pnpm vite build` / `pnpm lint`；禁止 `dotnet build`
- 禁止跨 feature 直接导入（必须事件总线 + App.vue 调度）
- 禁止在 feature 内自建共享组件已覆盖的控件
