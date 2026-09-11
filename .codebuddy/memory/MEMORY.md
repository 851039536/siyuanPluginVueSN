# 项目记忆（siyuanPluginVueSN）

> 整理：2026-09-11（第 5 次压缩）。编码规范正文见随上下文加载的 `AGENTS*.md`，此处只记**规范之外的经验与陷阱**。

## 环境（本机 pnpm 12）
- `pnpm-workspace.yaml` 的 `allowBuilds`（`@parcel/watcher` / `esbuild` / `vue-demi` = true）必须保留：pnpm 仅在报 `ERR_PNPM_IGNORED_BUILDS` 时**自动写入占位**（`set this to true or false`）→ install 以报错收尾。`vue-demi` postinstall 必须允许
- 依赖损坏诊断：扫 `.pnpm/*/node_modules/<pkg>` 是否缺 `package.json`，一次拿到损坏清单并判断单点/面性；修复一律走 `pnpm install --force`——`.pnpm/<pkg>/node_modules/<dep>` 多为 junction，手删会跟随 junction 删掉真包
- 行数统计用 `(Get-Content X).Count`（`Measure-Object -Line` 漏空行）

## 硬性边界
- AI **禁止执行** `pnpm vite build` / `pnpm lint`（C# 项目禁止 `dotnet build`）；可执行 `read_lints`、`npx tsc --noEmit`、`pnpm i18n:merge`
- **四道验证各查不同问题**：`read_lints` 只查规范（**不查未导出成员/类型**，偶有陈旧诊断需读回代码核对）；`tsc --noEmit` 查 `TS2614`/`TS2322` 但**不解析 `.vue`**；`@vue/compiler-sfc` 未提升到根 `node_modules`（`Cannot find package`）⇒ 离线校验 `.vue` 只能靠 `read_lints` + 结构正则；`vite build` 才查 `MISSING_EXPORT`。**改动导出边界后必须跑 tsc 并过滤新增路径**
- 快捷键查重必须**递归**搜 `src/features/**`（hotkey 也在 `features/<name>/types/index.ts`）。已知未修冲突：`tableOfContents` 与 `ideaGenerator` 同为 ⌃⌥I
- 独立窗体精简：`isFloating`（`getFrontend() === "desktop-window"`）+ `v-if="!isFloating"` 隐藏重复标题
- 新功能 8 处注册；i18n 只改分片（顶层 JSON 由 merge 生成）

## 共享组件库（`src/components/`，27 个）
- **改计数前必须 `list_dir` 实测**（并行会话频繁变动）。新增组件 = 4 类位置：`<Name>.vue` + `styles/<Name>.scss` + `previewData/<name>.ts`（**双导出**「分组对象 + 分组数组」并接入 `previewData/index.ts`）+ 文档计数（`AGENTS.md` 5 处 + 清单表行 + 复用枚举、根 `README.md`、`componentPreview/README.md` 3 处 + 能力条目 + 具名插槽表/事件契约表、`kit/README.md`、`components/docs` 迁移指南 3 处）
- 私有子部件与纯函数放同名小写目录（`datePicker/` `select/` `speedDial/` `paginator/` `textarea/` `timeline/`），不计入清单、**禁止 feature 直接导入**；配套但需 feature 直接使用的组件也平铺（`InputGroup` + `InputGroupAddon`）
- 尺寸四档 `xsmall/small/medium/large`（默认 small），字号阶梯 10/12/14/16，四档禁同号；**原则上只改字号，不联动 padding/min-height/gap/图标**（Slider/DatePicker 的几何联动是**已登记的既有特例**，勿再扩）
- 分段档位/模式切换用 **`Button` 分组**（选中 `variant="primary"`、未选中 `ghost`+`text`+`size="xsmall"`+`:aria-pressed`）；`RadioButton` 用于表单式互斥选项
- 允许自建例外：纯展示局部布局容器、无档位 26×26 `.icon-btn`
- 改 props/行为/具名插槽/事件契约后，必须同步 `previewData/*.ts` 与 `componentPreview/README.md`（具名/作用域插槽与事件语义无法在快照呈现，必须登记 README）
- 预览框架：`PreviewExample` 支持 `props` + `slotText` / `render`（默认插槽）+ **`slots`（具名/作用域插槽工厂，2026-09-11 新增）**；数据文件超 300 行时另建 `previewData/<name>.ts`
- **受控示例在预览中可交互**：`PreviewSection.vue` 内联 `PreviewStage` 持本地 `modelValue` 并回写。两条约束：①`isControlledComponent()` 用 `component.props` 判断是否声明 `modelValue`，**未声明则一个额外属性都不注入**（否则多根组件 `FormField` 报 extraneous attrs）；②`hasSlot` **仅表示「有默认插槽内容」，无内容时必须为 false**

### 组件特有陷阱（只列非显然项）
- `Button`：既有 5 个 variant 语义不可改（180+ 处依赖），新能力走 `--severity-*`/`--outlined`/`--text` + `--btn-*` 变量；纯图标必须 `aria-label`；loading 用 `visibility:hidden` 保宽；图标随档 12/14/16/18。**`isIconOnly` 陈旧 computed 属已知有意保留，勿重提**
- `ToggleButton`：内部复用 `Button`。①**`--severity-*` 设 `--btn-color` 会污染 `--outlined` 取色** → 未按下不传 severity；②**无文案时必须不传默认插槽**（否则 `$slots.default` 恒真毁掉 `isIconOnly`）→ `v-if/v-else` 双分支。`fluid` 默认 **`false`**
- `SpeedDial`：内部复用 `Button`，私有目录 `speedDial/`。①`position` 用**类输出**（预览沙箱才能覆盖成 `absolute`）；②`transition-delay` **必须写三段**；③`linear` 距离从 `(index + 1) × (按钮边长 + 间隙)` 起算；④**键盘触发判别用 `event.detail === 0`**；⑤**不做 `mask`**；⑥`size` 决定几何，**禁止经 `buttonProps.size` 覆盖**
- `Paginator`：`page`（**1 基**，刻意不用 PrimeVue 的 `first` 零基）/ `rows` / `total` 驱动。①**页码越界必须收敛并回派 `update:page`**；②**`rows<=0` 兜底为 1**（否则得 `Infinity`）；③页码窗口**与首末页只隔 1 页时直接补上、间隔 ≥2 页才折叠为省略号**；④`rows` 变更回第 1 页；⑤`rowsPerPageOptions` 取 **`Array<number | SelectOption>`**；⑥文案走 `labels`（中文默认 + 可覆盖）⇒ **零 i18n 分片改动**；⑦预览里是静态快照（框架只识别 `modelValue`）
- **自建分页已统一到 `Paginator`**：`imageCompressor` / `flashcardReading` / `skillLearning`。⚠️ `gitPush/usePagedList.ts` 是「加载更多」累加式，**不是**分页器，勿迁
- `Timeline`（2026-09-11 新增）：`value` 必填 + `layout(vertical 默认 / horizontal)` × `align`（竖向 `left/right/alternate`，横向 `top/bottom/alternate`）+ `content`/`opposite`/`marker` 作用域插槽（`{ item, index }`）。①官方有 `icon` 作用域参数（来自其内部图标解析）与 `connector` 插槽，本项目**均不提供**；②**始终渲染 `opposite` 容器**（官方 Basic 观感：两侧等宽 / 等高、线位置稳定），`alternate` 下奇数索引反向；③**反向机制两向复用**：`isReversed()` 分向判断（竖 `right`、横 `bottom`），CSS 只换方向值（竖 `row-reverse`、横 `column-reverse`）；④默认节点为**空心圆（主题色描边 + 背景色填充，填充用于遮住穿行的线）**，连接线取 `--b3-border-color` 且**末项不渲染**；⑤四档尺寸只驱动字号（`--si-timeline-font`），节点直径 10px / 线宽 2px 恒定；⑥**横向连线对齐的软肋**：列高由内容决定、两侧块各占一半列高 ⇒ 通常节点跨列对齐，但某列 `opposite` 更高时该列连线会呈阶梯状（与官方同病，示例用等长文案规避）
- `ConfirmDialog`：`visible` 受控；`confirm` 后**不自动关闭**；**只监听 Esc，Enter 不绑定**。三处 feature 本地实现（`s3FileManager` / `gitPush` / `shortcut`）**尚未迁移**
- **弹层类预览必须沙箱覆盖**：`.cp-card__stage` 设 `position: relative`，舞台内遮罩类覆盖成 `absolute; z-index: 1`（覆盖必须**抬特异性**：类名写两遍 = (0,3,0)）。`SpeedDial` 同机制（+ `.cp-card__stage--speeddial` 高度类，由 `group.id` 判定）；**`.cp-card` 是 `overflow: hidden`**
- `Checkbox`：`isGroup = !binary && Array.isArray(modelValue)`；`indeterminate` 只能写 DOM 属性（`flush:"post"` + `onMounted`）；分组模式返回新数组
- `RadioButton`：无数组模式、无 `indeterminate`、不依赖 `IconWrapper`（圆点纯 CSS）；emit `binary ? true : value`（**不可取消**）；**同组必须传同一 `name`**；**只读拦截必须含方向键**
- `Textarea`：`fluid` **默认 `true`**；`autoResize` 时 `rows` 兼任初始高度与 `minRows` 兜底、`maxRows` 不传则不设上限；**实底聚焦必须用内嵌 outline（`-1px`）**。⚠️ `Input` 的 `type="textarea"` 按用户决定**原样保留为兼容入口**
- `DatePicker`：自建 `dateFormat` 模板引擎；**无时区字符串必须按本地时间解析**；焦点三坑 —— 关闭后 `input.focus()` 会重开面板（`skipFocusOpen`）、视图切换后焦点掉 body + Esc 失效（`focusActiveView()`）、面板容器需 `tabindex="-1"`；弹层用相对定位（非 Teleport）
- `ColorField`：**原生 `<input type="color">` 在思源 Electron 中不弹取色器**；全项目仍有 8 个文件遗留原生实现待替换。双事件 `update:modelValue` + `change`
- `Listbox`：**指示器自绘、不复用 `Checkbox`**（`role="option"` 内不得嵌套可交互元素）；键盘**只做基础键**；校验态用 `error`（非 `invalid`）
- `InputGroup` + `InputGroupAddon`：成员边框**不在根元素**上（`Input`/`DatePicker` 在 `__wrapper`、`Select` 在 `__trigger`）→ 命中必须 `> :deep(...)`；`margin-left: -1px` 合并边框 + hover/focus-within 抬 `z-index:1`；档位经 `--ig-addon-*` 继承（Sass 中 CSS 变量必须插值 `#{$var}`）；**容器禁设 `overflow:hidden`**
- `Slider`：①`readonly` 原生不支持 → 守卫 + `syncNativeValue()` **同步回滚** + 拦 8 个改值键（**Tab 放行**）；②**Chromium 的 `::-webkit-slider-thumb` 默认与轨道「顶」对齐** → 必须补 `margin-top`；Firefox **不要**加；③**轨道色必须取 `--b3-border-color`**；④焦点环 fallback `rgba(hsl(...), 0.2)` 是**非法 CSS**，全项目 60+ 处同写法 → 勿单独「修正」
- `FormField`：**多根组件 → 控件必须放进默认插槽**，写成自闭合 sibling 会让 hint 排到控件上方
- `Label`：禁用态邻近兜底 `:has(+ :disabled)` **只命中「禁用态在根元素上」**的成员；`Input`/`Select`/`DatePicker`/`Textarea` 须包装层显式加 `data-disabled`；**不得加 `inheritAttrs:false`**
- **相邻色陷阱**：`--b3-theme-surface`(`#f7f7f5`) 与 `--b3-theme-background`(`#ffffff`) 仅差 ~3% 灰度，**不能画需区分的细线**；分隔一律 `--b3-border-color`
- **错误色 Token 陷阱**：`--b3-theme-destructive` **从未定义**（只有 `--b3-theme-error`）；`Tag.scss`(3) / `Badge.scss`(1) 已修
- `Select`：`SelectOption`/`SelectGroupOption` 有 24 个文件从 `@/components/Select.vue` 导入 → **导出路径不可变**；**列表容器恒常渲染**；**筛选框必须常驻**；`closeDropdown({ restoreFocus })` 仅 Esc 与键盘选中传 true；**筛选框按键须单独处理**（复用主处理器会 `preventDefault` 掉 `Space`）
- `Loader` 无 props 且 `height:100%`；`Chart.vue` 仅 line/bar/pie/doughnut/area（无 radar）
- `Input.borderless`：去边框去底色，焦点反馈由外层 `:focus-within` 承担
- 「实时跟随 + 一次性落盘」统一双事件：`update:modelValue` + `change`；`Input`/`Select`/`Textarea` 在弹窗/表单中必须显式 `size="small"`；实底控件禁用 `focus-ring` mixin → 用 `outline`

## 组件库外迁（2026-09-10 实测）
- 交付文档：`src/components/docs/components-vue3-migration-guide.md`
- **零业务耦合**：`src/components/**` 内 0 处 i18n / plugin / `siyuan` / store / `@/features` 导入；跨目录依赖仅 `@/config/icons`（14 文件）与 Sass `@/variables.scss`（30 个 scss）；第三方仅 `vue` / `@iconify/vue` / `chart.js`+`vue-chartjs`（仅 Chart）
- **目录外必带 3 项**：`src/_variables.scss`、`src/config/icons.ts`、图标离线预加载 `addCollection(mdiIcons)`（不调则 `<Icon>` 转请求 CDN，断网全空白且**不报错**）
- 别名 `@`→`src` 必须配（Vite `resolve.alias` + tsconfig `paths`），Vite 的 alias 同样作用于 Sass `@use`
- 组件消费 **20 个 `--b3-*` 变量**，非思源项目需注入 bridge SCSS；**两个 `*-rgb` 变量必须是逗号分隔**（被 `rgba(var(--b3-theme-primary-rgb, 201, 122, 93), 0.1)` 消费），写现代空格分隔会让**整条声明失效**
- `ColorField.scss` 有 4 处 `var(--b3-theme-outline)` **无 fallback**；组件自身硬编码 **15 个 IconKey**（minus/check/x/close/eye/eyeOff/calendar/chevron*/magnify/plus）；仅 3 处宿主耦合（`var(--b3-*, fallback)`、`Chart.vue:175` 判 `html.b3-theme-dark`、`SpeedDial.vue:206` 输出 `b3-tooltips` 类）

## 通用陷阱
- **Vue 的 `slots` 不是响应式**：`instance.slots` 原地赋值 → `computed` 不随插槽增删重算
- **scoped 两个反直觉点**：①父 scope 只加在「模板里直接写」的子组件根元素上，且只对**单根节点**生效；②**经插槽传入的子组件带的是调用方的 scope 属性**，容器写 `.容器 > .子组件` 会永不匹配，必须 `> :deep(.子组件)`。校验手段：Sass 展平后喂 `compileStyle({scoped:true})`
- **覆写共享组件内部样式必须算特异性**：加一层父选择器才稳；**SCSS 嵌套陷阱**：档位/变体必须写 `.si-xxx--tier &` 反向选择器
- **Token 短名/长名双轨**：`kit/variables.scss` 同时导出两套等值 Token；**新代码一律用短名**（`$s-px6` / `$t-xs` / `$r-base` / `$c-*` / `$ff-zh` / `$fw-*` / `$lh-*`），旧长名（`$spacing-*` / `$font-size-*` / `$color-*`）仅存量使用，映射表见 `docs/token-shorthand.md`。间距 px 档位齐全（1/2/3/5/6/7/10/14/18px）+ rem 档位 `$s-1~16`；`.ts`/`.scss` 的 `@use` 一律显式（Sass 变量不跨文件传递）
- **`.ts` 不得 `import type { X } from "@/components/Y.vue"`**（tsc 不解析 `.vue` → `TS2614`）。新解法：①类型下沉到纯 TS 模块；②`.vue` 的 `<script setup>` 用类型别名保住对外路径
- **i18n 类型用「键清单派生」**：`const I18N_KEYS = [...] as const` + `Record<(typeof I18N_KEYS)[number], string>`，逐键 `?? ""` 填充；写成 `xxx?: string` 会让所有消费点报 TS2322
- 新增遵循既有模式的模块时，先 `search_content '^export const'` 对齐同目录同类文件的**导出清单**
- 非 deep watch 对原地 splice 不触发 → 返回全新数组；组件内常量若被 composable 运行时引用，拆 `types/xxx.ts`（放 `types/index.ts` 会与 `index.vue` 循环）
- 组件 props 中的 plugin 类型：思源 `Plugin` 基类无 `settings`，先例 `import type PluginSample from "@/index"`
- sass 离线编译需自定义 importer 映射 `@/` → `src/`（`findFileUrl`）；`import sass from 'sass'` 已废弃，用 `import * as sass`
- **写 JS 扫描脚本的两个静默陷阱**：①对象字面量 `{ line: i + 1, line }` 后者覆盖前者 → `findings.line` 变源码文本，**无任何报错**；②用 `m[0]`（含首尾引号）做前缀判定会让规则**整体零命中**，须用捕获组 `m[1]`。**改脚本后必须复扫或回读源码验证**（`replace_in_file` 曾返回 success 但内容未变）

## 硬编码审查（2026-09-11 建立）
- 工具：`scripts/audit-hardcode.mjs`（只读，31 条规则 / 四类 = SCSS Token + i18n 文案 + 业务常量 + 图标 emoji；15 类例外白名单；`--dry` **不写盘**，核对前须落盘一次）；交付 `docs/hardcode-audit.md` + `docs/hardcode-audit.data.json`
- 基线 **3613 处** → 七轮修复后 **1693**（−53.1%）。已归零：`scss/in-vue-inline` 402→0、`undefined-token`、`font-weight`、`font-family`；`scss/spacing` 1139→28、`border-radius` 132→16、语义色 58 处
- **可机械替换的前提是「值即名称」Token 可新增**（等值替换）；**语义档位 Token 不能机械改**：`line-height`（Token 仅 1.25/1.5/1.75，实际 1.4/1.6/1.7）、`transition-duration`（规范 0.12s，实际 0.15/0.2/0.3/0.6s）
- **编译通过 ≠ 正确**：Sass 不校验 CSS 属性值合法性。曾生成 `#var(--b3-theme-error)` 非法值，58 处全中招却**编译全过** ⇒ 机械替换后必须抽查产物
- **`@use` 命名空间三坑**：①判断「能否用裸 `$token`」只沿 **`@forward`** 链递归（`@use` 不传递成员）；②`@/` 解析要补回 `src/`；③已有其他 `as *` 导入时不能再补全局 `as *`（同名冲突）→ 改用 `@use "@/variables.scss" as g;` + `g.$token`
- **`git diff --shortstat` 会因 `docs/hardcode-audit.data.json`（1.1 MB，每次重写）虚报数万行**，核对用 `git diff --numstat` 按文件排序
- **动手分析前别下结论**：曾猜「spacing 剩余 `1px` 是边框宽度误报」，实际全是真 padding/gap/margin；真因是**没有对应 Token**
- **样式分离标准动作**：①读 `<style>` 先查有无 `@use ... as X` / `@include X.mixin` 依赖 ②新建 `styles/<Component>.scss`，首行显式 `@use "@/variables.scss" as *;` ③无 Token 的值集中声明为文件顶部局部变量 + `// 无对应 Token` ④`.vue` 的 `<style>` 改**双行导入** ⑤逐文件 `sass.compileAsync` + `read_lints` + 扫描器复跑
- 工具：`scripts/codemod-hardcode-tokens.mjs`（`--rules scss/spacing,scss/border-radius`，默认干跑、`--write`、幂等）；`scripts/audit-token-shorthand.mjs` / `verify-token-migration.mjs` 用于短名长名迁移

## 功能模块状态（只留仍可执行的事实）
- **待迁移清单（已确认、尚未动）**：`ConfirmDialog` 三处本地实现（`s3FileManager` / `gitPush` / `shortcut`）；`ReviewRadarChart` 未迁到 `Chart`；feature 内原生 radio 5 处（`video/CompressDialog`、`wordQuery/WordQueryPanel`、`gitPush` 的 `SettingsDialog`/`CommitFixDialog`/`BatchFixDialog`）；**原生 `<input type="color">` 8 处**（`prompts/CategoryManageModal`、`toolCollection/tools/colorPicker`、`imageCreation/{CoverDecorationSettings,CodeImageTab}`、`superPanel/FeatureCard`、`gitPush/{common/CategoryDialog,CommitAnalysis/AnalysisSettingsForm}`、`generalSettings/TabPinSettings`）
- **gitPush**：多本地路径（`resolveValidPath`）；历史重写 fast-import 化；提交规则 14 条经 `DEFAULT_COMMIT_RULE_CONFIG` / `readCommitRuleConfig(prefs)` 单一入口
- **componentPreview**：addTab + openWindow 双形态；`usePreviewSize`（key `component-preview-size`）；`sizeable` + `resolveProps` 只注入未显式指定 size 的示例
- **compactMode**：3 档密度 + 6 档字号 + 5 区域开关；`applyCompactMode` 先复位再置位（幂等）
- **statistics**：`BLOCK_TYPE_LABELS` 仍被 `baseStats` 使用，勿删
- 其余模块（S3 备份 / toolCollection / dataSnapshot / aiContentGenerator / bookmarkMarker / skillLearning / docAnalysis）细节见各自 `src/features/<name>/README.md` 与当日日志

## 禁止事项
- 禁止执行 `pnpm vite build` / `pnpm lint`；禁止 `dotnet build`
- 禁止跨 feature 直接导入（必须事件总线 + App.vue 调度）
- 禁止在 feature 内自建共享组件已覆盖的控件
