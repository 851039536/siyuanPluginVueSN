# 项目记忆（siyuanPluginVueSN）

> 整理：2026-09-11（第 6 次压缩，为控制体积做了合并去重）。编码规范正文见随上下文加载的 `AGENTS*.md`，此处只记**规范之外的经验与陷阱**。

## 环境与边界
- pnpm 12：`pnpm-workspace.yaml` 的 `allowBuilds`（`@parcel/watcher` / `esbuild` / `vue-demi` = true）必须保留，否则 install 以报错收尾；`vue-demi` postinstall 必须允许
- 依赖损坏诊断：扫 `.pnpm/*/node_modules/<pkg>` 是否缺 `package.json`；修复一律 `pnpm install --force`（手删会跟随 junction 删掉真包）
- 行数统计用 `(Get-Content X).Count`（`Measure-Object -Line` 漏空行）
- AI **禁止** `pnpm vite build` / `pnpm lint`（C# 项目禁止 `dotnet build`）；可执行 `read_lints`、`npx tsc --noEmit`、`pnpm i18n:merge`、`pnpm i18n:verify`、`pnpm validate:icons`
- **四道验证各查不同问题**：`read_lints` 只查规范（**不查未导出成员/类型**，偶有陈旧诊断须读回代码核对）；`tsc --noEmit` 查 `TS2614`/`TS2322` 但**不解析 `.vue`**；`@vue/compiler-sfc` 未提升到根 `node_modules`（离线校验 `.vue` 只能靠 `read_lints` + 结构正则）；`vite build` 才查 `MISSING_EXPORT` ⇒ **改动导出边界后必须跑 tsc 并过滤新增路径**
- 快捷键查重必须**递归**搜 `src/features/**`（hotkey 也在 `features/<name>/types/index.ts`）；已知未修冲突：`tableOfContents` 与 `ideaGenerator` 同为 ⌃⌥I
- 独立窗体精简：`isFloating`（`getFrontend() === "desktop-window"`）+ `v-if="!isFloating"` 隐藏重复标题
- 新功能 8 处注册；i18n 只改分片（顶层 JSON 由 merge 生成）；**禁止跨 feature 直接导入**（走事件总线 + App.vue 调度）；**禁止在 feature 内自建共享组件已覆盖的控件**

## 共享组件库（`src/components/`，39 个公开组件）
- 计数**必须实测**（并行会话频繁变动）；**私有子目录也计入文件数基线**（Splitter 轮次把 96 写成 94，就因漏了 `splitter/` 的 3 个文件）。新增组件 = `<Name>.vue` + `styles/<Name>.scss` + `previewData/<name>.ts`（**双导出**「分组对象 + 分组数组」并接入 `previewData/index.ts`）+ 文档计数（`AGENTS.md` 5 处 + 清单行 + 复用枚举、根 `README.md`、`componentPreview/README.md`、`kit/README.md`、迁移指南 3 处 + 私有目录清单）
- 私有子部件与纯函数放同名小写目录（`datePicker/ select/ speedDial/ paginator/ textarea/ timeline/ splitter/ tabs/ confirm/ overlay/`），不计入清单、**禁止 feature 直接导入**；配套但需 feature 直接使用的组件平铺（`InputGroup` + `InputGroupAddon`、`Splitter` + `SplitterPanel`，后两者共用同一预览分区）
- 四档 `xsmall/small/medium/large`（默认 small），字号 10/12/14/16 禁同号；**原则上只改字号，不联动 padding/min-height/gap/图标**（Slider/DatePicker 的几何联动是已登记特例，勿再扩）
- 分段档位/模式切换用 **`Button` 分组**（选中 `variant="primary"`、未选中 `ghost`+`text`+`size="xsmall"`+`:aria-pressed`）；`RadioButton` 用于表单式互斥选项
- 允许自建例外：纯展示局部布局容器、无档位 26×26 `.icon-btn`
- 改 props/行为/具名插槽/事件契约后，必须同步 `previewData/*.ts` 与 `componentPreview/README.md`（插槽与事件语义无法在快照呈现）
- 预览框架：`PreviewExample` = `props` + `slotText`/`render`（默认插槽）+ **`slots`**（具名/作用域插槽工厂，**第二参为注入档位后的实际渲染 props**）；数据文件超 300 行时另建 `previewData/<name>.ts`（`control.ts` 339 / `input.ts` 309 说明该线非硬约束）
- **预览里需要宿主样式**（如垂直分隔线高度）→ 直接给示例传 `props: { style: "height: 80px" }`（单根组件 fallthrough），**无需改框架、无需加舞台类**
- 受控示例在预览中可交互：`PreviewStage` 持本地 `modelValue` 并回写；①`isControlledComponent()` 用 `component.props` 判断，未声明则**一个额外属性都不注入**（否则多根 `FormField` 报 extraneous attrs）；②`hasSlot` 仅表示「有默认插槽内容」
- 弹层类预览必须沙箱覆盖：`.cp-card__stage{position:relative}` + 舞台内遮罩覆盖为 `absolute; z-index:1`（覆盖须抬特异性：类名写两遍 =(0,3,0)）；`.cp-card` 是 `overflow: hidden`。**三段结构的 Dialog 另需 `--dialog` 高度类（300px）并把卡片 `max-height` 收敛为 `100%`**（否则被卡片边界裁掉、长内容演示不了内部滚动；宽度不用管，组件侧 `max-width:100%` 已收敛）

### 组件特有陷阱
- `Button`：既有 5 个 variant 语义不可改（180+ 处依赖）；新能力走 `--severity-*`/`--outlined`/`--text`；纯图标必须 `aria-label`；loading 用 `visibility:hidden` 保宽；图标随档 12/14/16/18。`isIconOnly` 陈旧 computed 属**有意保留，勿重提**
- `ToggleButton`：①**`--severity-*` 设 `--btn-color` 会污染 `--outlined` 取色** → 未按下不传 severity；②**无文案时必须不传默认插槽**（否则 `$slots.default` 恒真毁掉 `isIconOnly`）→ `v-if/v-else` 双分支；`fluid` 默认 **false**
- `SpeedDial`：①`position` 用**类输出**（预览沙箱才能覆盖）；②`transition-delay` **必须三段**；③`linear` 距离自 `(index + 1) × (按钮边长 + 间隙)`；④键盘触发判别用 `event.detail === 0`；⑤**不做 `mask`**；⑥`size` 决定几何，禁止经 `buttonProps.size` 覆盖
- `Paginator`：`page`（**1 基**，刻意不用 PrimeVue `first` 零基）/ `rows` / `total`。①越界必须收敛并回派 `update:page`；②`rows<=0` 兜底 1（否则得 `Infinity`）；③页码窗口与首末页只隔 1 页直接补上、间隔 ≥2 页才折叠为省略号；④`rows` 变更回第 1 页；⑤`rowsPerPageOptions` 取 `Array<number | SelectOption>`；⑥文案走 `labels`（中文默认）⇒ **零 i18n 分片改动**；⑦预览是静态快照（框架只识别 `modelValue`）
- **自建分页已统一到 `Paginator`**：`imageCompressor` / `flashcardReading` / `skillLearning`。⚠️ `gitPush/usePagedList.ts` 是「加载更多」累加式，**不是**分页器，勿迁
- `Timeline`：`value` 必填 + `layout`（vertical 默认 / horizontal）× `align` + `content`/`opposite`/`marker` 作用域插槽（`{ item, index }`）。①官方 `icon` 作用域参数与 `connector` 插槽**均不提供**；②**始终渲染 `opposite` 容器**（两侧等宽/等高、线位置稳定），`alternate` 按奇数索引反向；③**反向机制两向复用** `isReversed()`（竖 `right`、横 `bottom`），CSS 只换方向值（`row-reverse` / `column-reverse`）；④默认节点为**空心圆（背景色填充用于遮住穿行的线）**，连接线取 `--b3-border-color` 且**末项不渲染**；⑤四档只驱动字号，节点 10px / 线 2px 恒定；⑥**横向连线软肋**：某列 `opposite` 更高时该列连线呈阶梯状（与官方同病，示例用等长文案规避）
- `Card`：①`title`/`subtitle`/`content` 具名插槽已补，`content` **未传回落默认插槽**（`<slot name="content"><slot /></slot>`，不引入 `$slots` 判断）；②⚠️ **`header` 语义与官方不同**（本项目=带下边框的标题栏；官方通栏对应本项目 `cover`；`footer` 是独立分区带上边框）；③钩子 `contentClass`→`.si-card__body`、`captionClass`→`.si-card__header-content`，**不新建 `__content` 层**（会打断既有 `:deep(.si-card__body)` 定制）；④`.si-card__body` 的 padding 由 `.si-card--{tier} .si-card__body`(0,2,0) 给出 ⇒ **外部单类选择器改 padding 无效**（用 `bodyNoPadding` + 内层自控）
- `Divider`：`type` × `layout` × `align`，**仅默认插槽**、无事件。①`align` 未传按 `center`（不是 left）、取值与方向绑定、**交叉组合静默回落居中**；②用**两段真实线段**（按对齐隐藏首段/末段），不复刻官方「根元素画线 + 内容底色遮罩」（父容器底色多样必露色块）；③**垂直分隔必须给高度**：`align-self: stretch` + `min-height: $s-6`，否则非 flex 父容器塌成 0；④线色 `--b3-border-color`。**待迁移**：22 个 feature 文件有自建分隔线
- `Panel`：①**受控/非受控双模式**（`collapsed` **刻意不给默认值**，用 `undefined` 判定）；②**`toggleable=false` 时必须忽略 `collapsed`**（`v-show="!toggleable || !isCollapsed"`）否则死锁；③不提供官方 `toggleButtonProps`（object props 袋无法既宽又安全），改用官方同样存在的 `togglebutton` 插槽；④折叠用 `v-show` 瞬时收起 + 图标 0.12s 旋转，**不做官方高度动画**；⑤切换按钮是纯图标 `Button` ⇒ 必须 `aria-label` + `aria-expanded`/`aria-controls`；⑥**图标-only 的 Button 不能传默认插槽** ⇒ `toggleicon` 走 `v-if/v-else`。**待迁移**：约 28 个 feature 有自建折叠区
- `Splitter` + `SplitterPanel`：①分隔条渲染在**面板内侧**（首个面板没有），拖动调整「所属面板 + 前一个面板」，两侧之和恒定；②面板顺序靠注册，**子 `onMounted` 先于父** ⇒ 父级 `onMounted` 是「全部面板已就绪」的可靠时点；③尺寸计算外置纯函数（`splitter/sizes.ts`）；④受控/非受控（`sizes` 不传即自持）+ `stateKey` 走**浏览器原生 Storage**（组件库不引 `@/utils/pluginStorage`）；⑤**scoped 归属陷阱（真踩过）**：分隔条由 SplitterPanel 渲染 ⇒ 其样式必须写在 `SplitterPanel.scss`，写进 `Splitter.scss` 会因 scoped 属性不匹配**静默失效**；⑥`role="separator"` + `aria-orientation` 取**自身物理方向**；⑦垂直/嵌套布局必须给父容器确定高度；⑧Pointer Events + `setPointerCapture` + `touch-action: none`
- `Tabs` 五件套：`Tabs.value` 受控/非受控双模式、`update:value` 幂等；`Tab` 是原生 button + roving tabindex + `role="tab"`；`TabPanel` 的 `lazy` 双开关（true = 未激活**不进 DOM**、状态会丢）；键盘逻辑在 `Tab` 不在 `TabList`；活动指示器是**静态下划线**（不做官方滑动墨条）；档位只驱动字号 + 标签水平内边距 + 面板上边距；**激活态不改字重**（字重变化会让标签左右抖动）。**待迁移**：36 个 feature 文件命中自建 tab（含 gitPush `CardTabs.vue`）
- `Toolbar`：`start`/`center`/`end` 三容器**恒定渲染**；两端 `flex: 1 1 0` 配平使 center 精确居中；四档 min-height 28/36/44/54（= 同档 Button 最小高度 + 2×上下内边距）；`variant` 与 `padded` 解耦（`padded=false` 仍保留档位最小高度）；⚠️ **档位传不进插槽** ⇒ 内部共享控件必须显式传同档 `size`。**待迁移**：86 个 feature 文件命中工具栏类实现（gitPush 一家 6 个 `*Toolbar.vue`）
- `Dialog`：`visible` 受控 + header/内容/footer 三段 + 九档 position + 四档 size（宽度 320/400/520/680px）。①`dismissableMask` 默认 **false**（官方同；ConfirmDialog 是 true，差异已登记）；②`modal` 默认 **true**（官方 false，有意差异：遮罩恒渲染，非模态 `--plain` = 遮罩透明 + `pointer-events:none` + 卡片 auto，点关随之失效）；③**点关 = 遮罩上按下并抬起**（官方 mousedown/mouseup 同目标判定，ConfirmDialog 已从 `@click.self` 迁移）；④初始焦点 `[autofocus]`（footer→header→content）→ 容器回退，ConfirmDialog 刻意只聚焦容器 ⇒ **外壳的 `initialFocus` 必须可注入**；⑤`showHeader:false` 连带不渲染关闭按钮；⑥裁剪 draggable/maximizable/appendTo/Teleport/blockScroll/ZIndex/FocusTrap。**待迁移**：47 个 `*Dialog.vue` + 12 个 `*Modal.vue`（59 个自建弹窗、48 份自画遮罩 SCSS）
- `ConfirmDialog`：`visible` 受控；`confirm` 后**不自动关闭**；**只监听 Esc，Enter 不绑定**；遮罩点关 / Esc / 焦点接管与归还已抽到私有 `overlay/useOverlay`（与 `Dialog` 共用；`ConfirmPosition`/`ConfirmSize`/`DEFAULT_CLOSE_LABEL` 改为 overlay 模块别名转出，外部名零变更）。`dataSnapshot` 已迁；`prompts`/`skillsViewer` 的 `DeleteConfirmModal` 与三处 feature 本地确认弹窗（s3FileManager / gitPush / shortcut）**尚未迁移**
- `Checkbox`：`isGroup = !binary && Array.isArray(modelValue)`；`indeterminate` 只能写 DOM 属性（`flush:"post"` + `onMounted`）；分组模式返回**新数组**。`label` prop 只能是字符串 ⇒ 要自定义文案样式（如等宽）走**默认插槽**放自己的 span，别去覆盖 `.si-checkbox__label`
- `RadioButton`：无数组模式、无 `indeterminate`、纯 CSS 圆点；emit `binary ? true : value`（**不可取消**）；**同组必须传同一 `name`**；只读拦截必须含方向键
- `Textarea`：`fluid` **默认 true**；`autoResize` 时 `rows` 兼任初始高度与 `minRows` 兜底，`maxRows` 不传则不设上限；实底聚焦必须用内嵌 outline（`-1px`）。⚠️ `Input` 的 `type="textarea"` 按用户决定**保留为兼容入口**
- `DatePicker`：自建 `dateFormat` 模板引擎；**无时区字符串必须按本地时间解析**；焦点三坑（关闭后 `input.focus()` 重开面板 → `skipFocusOpen`；视图切换后焦点掉 body + Esc 失效 → `focusActiveView()`；面板容器需 `tabindex="-1"`）；弹层用相对定位（非 Teleport）
- `ColorField`：**原生 `<input type="color">` 在思源 Electron 中不弹取色器**；全项目仍有 8 个文件遗留原生实现待替换
- `Listbox`：**指示器自绘、不复用 `Checkbox`**（`role="option"` 内不得嵌套可交互元素）；键盘只做基础键；校验态用 `error`
- `InputGroup` + `InputGroupAddon`：成员边框不在根元素（`Input`/`DatePicker` 在 `__wrapper`、`Select` 在 `__trigger`）⇒ 命中必须 `> :deep(...)`；`margin-left: -1px` 合并边框 + hover/focus-within 抬 `z-index:1`；档位经 `--ig-addon-*` 继承（Sass 中 CSS 变量须插值 `#{$var}`）；**容器禁设 `overflow: hidden`**
- `Slider`：①`readonly` 原生不支持 ⇒ 守卫 + `syncNativeValue()` 回滚 + 拦 8 个改值键（**Tab 放行**）；②**Chromium 下 `::-webkit-slider-thumb` 默认与轨道「顶」对齐** ⇒ 必须补 `margin-top`（Firefox 不加）；③轨道色必须取 `--b3-border-color`；④焦点环 fallback `rgba(hsl(...), 0.2)` 是**非法 CSS**，全项目 60+ 处同写法 → 勿单独「修正」
- `FormField`：**多根组件** ⇒ 控件必须放进默认插槽（写成自闭合 sibling 会让 hint 排到控件上方）
- `Label`：禁用态邻近兜底 `:has(+ :disabled)` **只命中「禁用态在根元素上」**的成员；`Input`/`Select`/`DatePicker`/`Textarea` 须包装层显式加 `data-disabled`；**不得加 `inheritAttrs:false`**
- `Select`：`SelectOption`/`SelectGroupOption` 有 24 个文件从 `@/components/Select.vue` 导入 ⇒ **导出路径不可变**；列表容器恒常渲染；筛选框必须常驻；`closeDropdown({ restoreFocus })` 仅 Esc 与键盘选中传 true；筛选框按键须单独处理（复用主处理器会 `preventDefault` 掉 `Space`）
- `Loader` 无 props 且 `height:100%`；`Chart.vue` 仅 line/bar/pie/doughnut/area（无 radar）；`Input.borderless` 去边框去底色，焦点反馈由外层 `:focus-within` 承担
- 「实时跟随 + 一次性落盘」统一双事件 `update:modelValue` + `change`；`Input`/`Select`/`Textarea` 在弹窗/表单中必须显式 `size="small"`；实底控件禁用 `focus-ring` mixin → 用 outline

### 相邻色与 Token 陷阱
- `--b3-theme-surface`(#f7f7f5) 与 `--b3-theme-background`(#ffffff) 仅差 ~3% 灰度 ⇒ **不能画需区分的细线**，分隔一律 `--b3-border-color`
- `--b3-theme-destructive` **从未定义**（只有 `--b3-theme-error`）；`Tag.scss`(3) / `Badge.scss`(1) 已修

## 组件库外迁（2026-09-10 实测）
- 交付文档 `src/components/docs/components-vue3-migration-guide.md`
- **零业务耦合**：`src/components/**` 内 0 处 i18n / plugin / `siyuan` / store / `@/features`；跨目录依赖仅 `@/config/icons`（14 文件）与 Sass `@/variables.scss`（30 scss）；第三方仅 `vue` / `@iconify/vue` / `chart.js`+`vue-chartjs`
- **目录外必带 3 项**：`src/_variables.scss`、`src/config/icons.ts`、图标离线预加载 `addCollection(mdiIcons)`（不调则转请求 CDN，断网全空白且**不报错**）；别名 `@`→`src` 必须配（Vite alias 同样作用于 Sass `@use`）
- 组件消费 **20 个 `--b3-*` 变量**；**两个 `*-rgb` 必须是逗号分隔**（`rgba(var(--b3-theme-primary-rgb, 201, 122, 93), 0.1)`），写现代空格分隔会让**整条声明失效**
- `ColorField.scss` 有 4 处 `var(--b3-theme-outline)` **无 fallback**；组件自身硬编码 **15 个 IconKey**；仅 3 处宿主耦合（`var(--b3-*, fallback)`、`Chart.vue:175` 判主题、`SpeedDial.vue:206` 输出 `b3-tooltips`）

## 通用陷阱
- **受控/非受控双模式的标准写法**：可选 prop **不给默认值**，用 `props.x === undefined` 判定是否受控，未受控时写内部 `ref`，两种模式都照常 emit（`SpeedDial.visible` / `Panel.collapsed` 先例）
- **Vue 的 `slots` 不是响应式**：`instance.slots` 原地赋值 ⇒ `computed` 不随插槽增删重算；**判断写在模板里**（每次渲染重新读取）才稳，若必须 computed 只能包 `props`
- **scoped 两个反直觉点**：①父 scope 只加在「模板里直接写」的子组件根元素上，且只对**单根节点**生效；②**经插槽传入的子组件带的是调用方的 scope 属性**，容器写 `.容器 > .子组件` 会永不匹配，必须 `> :deep(.子组件)`
- **覆写共享组件内部样式必须算特异性**：加一层父选择器才稳；**但组件自身 scoped 样式是 `.si-x[data-v-*]` =(0,2,0)** ⇒ 父级单类钩子与它**同特异性**、胜负取决于样式注入顺序（不稳定）→ 解法是**类名重复一次**（`.gls-cards .gls-card.gls-card` =(0,3,0)）。SCSS 嵌套陷阱：档位/变体必须写 `.si-xxx--tier &` 反向选择器
- **Token 短名/长名双轨**：`kit/variables.scss` 导出两套等值 Token；**新代码一律短名**（`$s-px6` / `$t-xs` / `$r-base` / `$c-*` / `$ff-zh` / `$fw-*` / `$lh-*`），旧长名仅存量使用；映射表见 `docs/token-shorthand.md`。`.ts`/`.scss` 的 `@use` 一律显式（Sass 变量不跨文件传递）
- **`.ts` 不得 `import type { X } from "@/components/Y.vue"`**（tsc 不解析 `.vue` → `TS2614`）：类型下沉到纯 TS 模块，或 `.vue` 的 `<script setup>` 用类型别名保住对外路径
- **i18n 类型用「键清单派生」**：`const I18N_KEYS = [...] as const` + `Record<(typeof I18N_KEYS)[number], string>`，逐键 `?? ""` 填充；写成 `xxx?: string` 会让所有消费点报 TS2322
- 新增遵循既有模式的模块时，先 `search_content '^export const'` 对齐同目录同类文件的**导出清单**；非 deep watch 对原地 splice 不触发 ⇒ 返回全新数组；组件内常量若被 composable 运行时引用，拆 `types/xxx.ts`（放 `types/index.ts` 会与 `index.vue` 循环）；props 中的 plugin 类型先例 `import type PluginSample from "@/index"`
- sass 离线编译需自定义 importer 映射 `@/` → `src/`（`findFileUrl`）；`import sass from 'sass'` 已废弃 → `import * as sass`
- **写 JS 扫描脚本的两个静默陷阱**：①对象字面量 `{ line: i + 1, line }` 后者覆盖前者 ⇒ `findings.line` 变源码文本，**无任何报错**；②用 `m[0]`（含首尾引号）做前缀判定会让规则**整体零命中**，须用捕获组。**改脚本后必须复扫或回读源码验证**（`replace_in_file` 曾返回 success 但内容未变）

## 硬编码审查（2026-09-11 建立）
- 工具 `scripts/audit-hardcode.mjs`（只读；31 条规则 / 四类 = SCSS Token + i18n 文案 + 业务常量 + 图标 emoji；15 类例外白名单；`--dry` **不写盘**，核对前须落盘一次）；交付 `docs/hardcode-audit.md` + `docs/hardcode-audit.data.json`
- 基线 **3613 处 → 七轮后 1693**（−53.1%）。已归零：`scss/in-vue-inline` 402→0、`undefined-token`、`font-weight`、`font-family`；`spacing` 1139→28、`border-radius` 132→16、语义色 58 处
- **可机械替换的前提是「值即名称」Token 可新增**（等值替换）；**语义档位 Token 不能机械改**：`line-height`（Token 只有 1.25/1.5/1.75，实际 1.4/1.6/1.7）、`transition-duration`（规范 0.12s，实际 0.15/0.2/0.3/0.6s）
- **编译通过 ≠ 正确**：Sass 不校验 CSS 属性值合法性，曾生成 `#var(--b3-theme-error)` 58 处却**编译全过** ⇒ 机械替换后必须抽查产物
- **`@use` 命名空间三坑**：①判断「能否用裸 `$token`」只沿 **`@forward`** 链递归（`@use` 不传递成员）；②`@/` 解析要补回 `src/`；③已有其他 `as *` 导入时不能再补全局 `as *`（同名冲突）→ 改用 `@use "@/variables.scss" as g;` + `g.$token`
- **`git diff --shortstat` 会因 `docs/hardcode-audit.data.json`（1.1 MB，每次重写）虚报数万行** ⇒ 核对用 `git diff --numstat` 按文件排序
- **动手分析前别下结论**：曾猜「spacing 剩余 `1px` 是边框宽度误报」，实际全是真 padding/gap/margin；真因是**没有对应 Token**
- **样式分离标准动作**：①读 `<style>` 先查有无 `@use ... as X` / `@include X.mixin` 依赖 ②新建 `styles/<Component>.scss`，首行显式 `@use "@/variables.scss" as *;` ③无 Token 的值集中声明为文件顶部局部变量 + `// 无对应 Token` ④`.vue` 的 `<style>` 改**双行导入** ⑤逐文件 `sass.compileAsync` + `read_lints` + 扫描器复跑
- 工具：`scripts/codemod-hardcode-tokens.mjs`（`--rules scss/spacing,scss/border-radius`，默认干跑、`--write`、幂等）；`audit-token-shorthand.mjs` / `verify-token-migration.mjs` 用于短名长名迁移

## 功能模块待办（只留仍可执行的事实）
- **待迁移**：feature 内原生 radio 5 处（`video/CompressDialog`、`wordQuery/WordQueryPanel`、`gitPush` 的 `SettingsDialog`/`CommitFixDialog`/`BatchFixDialog`）；**原生 `<input type="color">` 8 处**（`prompts/CategoryManageModal`、`toolCollection/tools/colorPicker`、`imageCreation/{CoverDecorationSettings,CodeImageTab}`、`superPanel/FeatureCard`、`gitPush/{common/CategoryDialog,CommitAnalysis/AnalysisSettingsForm}`、`generalSettings/TabPinSettings`）；`ReviewRadarChart` 未迁到 `Chart`
- **gitPush**：多本地路径（`resolveValidPath`）；历史重写 fast-import 化；提交规则 14 条经 `DEFAULT_COMMIT_RULE_CONFIG` / `readCommitRuleConfig(prefs)` 单一入口；**行数统计（LineStats）2026-09-11 已完成两轮整改**：①六个组件迁共享组件（Toolbar/Button/Badge/Card/Checkbox/Tabs+Tag/IconWrapper）+ 弹窗复用 `.gp-mask` + 排行表 grid 列模板/吸顶表头/键盘可达行；②移除条数选择（固定全部提交）+ 抽 `common/LineRankRow.vue` / `LineShareBar.vue` + 净增语义色统一 `lrr-net` + `compareProjectLineRank` / `sumLineDeltas` 去重
- **gitPush 行数统计的口径常识**：`fetchProjectLineStats` 混两个维度 —— 提交维度受条数限制（`git log -N`），**「当前总行数」是工作区存量维度（`git ls-files` + 逐文件 `readFileSync`，同步阻塞、与条数无关、不过滤扩展名）**；排行排序与条形都取存量 ⇒ 改条数看不出差别。行数统计现固定全部提交且不再读写共享 `commitCount`（`LineStatsCache` 已无该字段）
- **gitPush README 属历史欠账**：`styles/` 目录树仅列 26 项（实测 54 个 `*.scss`，缺 30 项登记），`common/` 清单曾缺 7 个组件（已补）。改该文件时计数一律实测，别信既有数字
- **componentPreview**：addTab + openWindow 双形态；`usePreviewSize`（key `component-preview-size`）；`sizeable` + `resolveProps` 只注入未显式指定 size 的示例
- **compactMode**：3 档密度 + 6 档字号 + 5 区域开关；`applyCompactMode` 先复位再置位（幂等）
- **statistics**：`BLOCK_TYPE_LABELS` 仍被 `baseStats` 使用，勿删
- 其余模块（S3 备份 / toolCollection / dataSnapshot / aiContentGenerator / bookmarkMarker / skillLearning / docAnalysis / CodeReport）细节见各自 `src/features/<name>/README.md` 与当日日志
