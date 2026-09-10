# 项目记忆（siyuanPluginVueSN）

> 整理：2026-09-10（第 3 次压缩去重）。编码规范正文见随上下文自动加载的 `AGENTS*.md`，此处只记**规范文档外的经验与陷阱**。

## 环境（本机 pnpm 12）
- `pnpm-workspace.yaml` 的 `allowBuilds`（`@parcel/watcher`/`esbuild`/`vue-demi` = true）必须保留：pnpm 仅在报 `ERR_PNPM_IGNORED_BUILDS` 时**自动写入占位**（`set this to true or false`）→ install 以报错收尾。`vue-demi` postinstall 必须允许（Vue 2/3 入口切换）；`esbuild`/`@parcel/watcher` 靠 optional 平台包即可工作
- 依赖损坏诊断：扫 `.pnpm/*/node_modules/<pkg>` 是否缺 `package.json`，一次拿到损坏清单并判断「单点/面性」；修复一律走 pnpm 自身命令（如 `pnpm install --force`）——`.pnpm/<pkg>/node_modules/<dep>` 多为 junction，手删会跟随 junction 删掉真包
- 行数统计用 `(Get-Content X).Count`（`Measure-Object -Line` 会漏空行）

## 硬性边界
- AI **禁止执行** `pnpm vite build` / `pnpm lint`（其他 C# 项目禁止 `dotnet build`）；可执行 `read_lints`、`npx tsc --noEmit`、`pnpm i18n:merge`
- **四道验证各查不同问题**：`read_lints` 只查规范（**不查未导出成员/类型**，偶有陈旧诊断需读回代码核对）；`tsc --noEmit` 查 `TS2614`/`TS2322` 但**不解析 `.vue`**；`@vue/compiler-sfc`（`parse` + `compileScript` 取 `bindings` 喂 `compileTemplate`）才能离线验证 `.vue` 的宏/模板/绑定；`vite build` 才查 `MISSING_EXPORT`。**改动导出边界（拆文件/移函数）后必须跑 tsc 并过滤新增路径**
- 快捷键查重必须**递归**搜 `src/features/**`（hotkey 也在 `features/<name>/types/index.ts`，用 `features/*/index.ts` 会漏检）。已知未修冲突：`tableOfContents` 与 `ideaGenerator` 同为 ⌃⌥I
- 独立窗体精简：`isFloating`（`getFrontend() === "desktop-window"`）+ `v-if="!isFloating"` 隐藏重复标题
- 统一入口清单见 `AGENTS.md`；新功能 8 处注册；i18n 只改分片（顶层 JSON 由 merge 生成）

## 共享组件库（`src/components/`，25 个）
- 清单：Button / ToggleButton / SpeedDial / Input / Textarea / Select / Listbox / ColorField / FormField / InputGroup / InputGroupAddon / Label / Switch / Checkbox / RadioButton / DatePicker / Slider / Tag / Badge / Avatar / Card / ConfirmDialog / Chart / IconWrapper / Loader
- **改计数前必须 `list_dir` 实测**（并行会话频繁变动，曾在一天内 15→…→25）。新增组件 = 4 类位置：`<Name>.vue` + `styles/<Name>.scss` + `previewData/<name>.ts`（**双导出**「分组对象 + 分组数组」并接入 `previewData/index.ts`）+ 文档计数（`AGENTS.md` 5 处 + 清单表行 + 复用枚举、根 `README.md`、`componentPreview/README.md` 3 处 + 能力条目 + 具名插槽表/事件契约表）
- 私有子部件与纯函数放同名小写目录（`datePicker/` `select/` `speedDial/` `textarea/`），不计入清单、**禁止 feature 直接导入**；配套但需 feature 直接使用的组件也平铺（`InputGroup` + `InputGroupAddon` 共用预览分区）
- 尺寸四档 `xsmall/small/medium/large`（默认 small），字号阶梯 10/12/14/16，四档禁同号；**只改字号，不联动 padding/min-height/gap/图标**
- 分段档位/模式切换用 **`Button` 分组**（选中 `variant="primary"`、未选中 `ghost`+`text`+`size="xsmall"`+`:aria-pressed`）；`RadioButton` 用于表单式互斥选项
- 允许自建例外：纯展示局部布局容器、无档位 26×26 `.icon-btn`
- 改 props/行为/具名插槽/事件契约后，必须同步 `previewData/*.ts` 与 `componentPreview/README.md`
- 预览框架：`PreviewExample` 支持 `props` + `slotText` 或 `render`（默认插槽放多组件时）；**具名/作用域插槽与事件语义无法在快照呈现，必须登记 README**；数据文件超 300 行时另建 `previewData/<name>.ts`
- **受控示例在预览中可交互**：`PreviewSection.vue` 的内联 `PreviewStage` 持本地 `modelValue` 并回写（`code` 仍是最初静态组合）。两条约束：①`isControlledComponent()` 用 `component.props` 判断是否声明 `modelValue`，**未声明则一个额外属性都不注入**（否则落进 attrs 会让多根组件 `FormField` 报 extraneous attrs）；②`hasSlot` **无插槽内容时必须为 false**（否则会改变 `Button.isIconOnly`、`Checkbox`/`Switch` 的 `label || $slots.default` 分支）

### 组件特有陷阱
- `Button`：既有 5 个 variant 语义不可改（180+ 处依赖），新能力走 `--severity-*`/`--outlined`/`--text` + `--btn-*` CSS 变量；纯图标必须 `aria-label`；loading 用 `visibility:hidden` 保宽；图标随档 12/14/16/18。**`isIconOnly` computed 陈旧 + 2 项冗余属已知并有意保留，勿重提**
- `ToggleButton`（第 24 个）：**内部复用 `Button`（零样式复制）** —— `variant="ghost"` 恒定、`:severity="error ? 'danger' : (pressed ? 'primary' : undefined)"`、`:outlined="!pressed"`。两个机制：①**`--severity-*` 设 `--btn-color` 会污染 `--outlined` 的取色**（未按下变主色描边而非中性描边）→「未按下不传 severity」才正确；②**无文案时必须不传默认插槽**（否则 `$slots.default` 恒真毁掉 `isIconOnly`，多出的 gap 还让图标偏心）→ 用 `v-if/v-else` 双分支 + `v-bind="buttonProps"`。`on/offLabel`、`on/offIcon` **无默认值**；DEV 告警两条（内容为空 / 可见文案随状态变却无稳定 aria 标签）。`fluid` 默认 **`false`**（与 `Textarea.fluid` 相反）。⚠️ 选用边界：单按钮开关用它，一组互斥选项仍用 `Button` 分组
- `SpeedDial`（第 25 个）：8 向 × 四档轨迹展开动作，**内部复用 `Button`**，私有目录 `speedDial/`。要点：①`position` 四档角落用**类输出**（`right/bottom` + `--si-speeddial-offset`）→ 预览沙箱才能一条规则覆盖成 `absolute`；②轨迹位移/逐项延迟走 `--si-speeddial-x/y/delay` 内联变量；③收起态用 `visibility: hidden`（自动移出 Tab 与无障碍树），`transition-delay` **必须写三段**（否则展开瞬间不渲染、淡入被吞）；④**`linear` 距离从 `(index + 1) × (按钮边长 + 间隙)` 起算**（写 `index × 步距` 会让首个动作与主按钮完全重叠 —— 已由纯函数数值断言抓出）；⑤`radius` 小于按钮边长时抬到按钮边长；⑥ARIA `role="menu"/menuitem` + `aria-haspopup/expanded/controls`、方向键/Home/End 移焦、Esc 关闭并**返还焦点**；⑦**键盘触发判别用 `event.detail === 0`**（原生 button 键盘 click 的 detail 为 0）→ 只有键盘操作才移焦入首项；⑧动作气泡复用思源内置 `b3-tooltips`；⑨**不做 `mask`**；⑩`size` 同时决定按钮边长与几何，**禁止经 `buttonProps.size` 覆盖**；⑪图标旋转靠 `:deep(.si-button__icon)`
- `ConfirmDialog`：`visible` 受控；`confirm` 后**不自动关闭**（父决定时机以容纳异步）；**只监听 Esc、Enter 不绑定**（否则与聚焦按钮原生 click 重复派发）；打开时焦点给容器而非确认按钮。三处 feature 本地实现（s3FileManager / gitPush / shortcut）**尚未迁移**
- **弹层类预览必须沙箱覆盖**：`PreviewSection.scss` 的 `.cp-card__stage` 设 `position: relative`，舞台内遮罩类覆盖成 `absolute; z-index: 1`（仅沙箱，不改组件本体）。`SpeedDial` 是同机制变体：舞台内覆盖 `.si-speeddial { position: absolute }` + `.cp-card__stage--speeddial { height: 260px }` —— 因 **`.cp-card` 是 `overflow: hidden`，展开后超出舞台的动作会被裁**（故 `position: top-*` 的示例必须配 `direction: down`）；高度类由 `PreviewSection.vue` 按 `group.id === 'speedDial'` 判定
- `Checkbox`：`isGroup = !binary && Array.isArray(modelValue)` 自动分模式；`indeterminate` 只能写 DOM 属性（`watch flush:"post"` + `onMounted`）；分组模式返回新数组；受控回写 `nextTick(syncNativeState)`
- `RadioButton`：结构同构 `Checkbox`；差异 —— **无数组模式、无 `indeterminate`、不依赖 `IconWrapper`**（圆点纯 CSS，尺寸取圆框 50%）；`checked = binary ? !!modelValue : modelValue === value`；emit `binary ? true : value`（**单选项不可取消**）；**同组必须传同一 `name`**（键盘与 ARIA 靠浏览器原生）；**只读拦截必须含方向键**（原生方向键会改选并移动组内焦点）；预览中「组用法」只能写进 `code`（`render` 是默认插槽内容）
- `Textarea`（第 23 个）：`fluid` **默认 `true`**（项目其他控件默认 `width:100%`），`:fluid="false"` 退回原生 `cols` 固有宽度；`autoResize` 时 `rows` 兼任初始高度与 `minRows` 兜底、`maxRows` 不传则不设上限（超限转内部滚动）；`variant: outlined|filled` 与 Checkbox/RadioButton 同名字段，**实底聚焦必须用内嵌 outline（`-1px`）**（`focus-ring` mixin 只改 border-color，在透明边框上不可见）；高度算法抽到私有 `textarea/autoResize.ts` —— **纯函数抽取的正当理由不止 Rule of Three，突破 300 警戒线且具内聚语义同样成立**。⚠️ `Input` 的 `type="textarea"`（16 文件 19 处）按用户决定**原样保留为兼容入口，新代码一律用 `Textarea`**
- `DatePicker`：自建 `dateFormat` 模板引擎（`parseDate` 只支持数值令牌）；**无时区字符串必须按本地时间解析**（`LOCAL_DATE_PATTERN`，否则 UTC 跨日错位）；`isDateDisabled` 收敛四类约束（数组预处理为 `Set`）；42 格元数据一次性 `computed`；焦点三坑 —— 关闭后 `input.focus()` 会重开面板（`skipFocusOpen`）、视图切换后焦点掉 body + Esc 失效（`focusActiveView()`）、面板容器需 `tabindex="-1"`；弹层沿用相对定位（不用 Teleport），`overflow:hidden` 容器内会被裁剪
- `ColorField`：**原生 `<input type="color">` 在思源 Electron 中不弹取色器**，颜色选择一律用它；全项目仍有 8 个文件遗留原生实现待替换。事件 `update:modelValue`（实时）+ `change`（提交）
- `Listbox`：**指示器自绘、不复用 `Checkbox`**（`role="option"` 内不得嵌套可交互元素），仅勾选图标复用 `IconWrapper`；键盘**只做基础键**（`aria-activedescendant` + 容器 tabindex），不做组合键/字符定位/虚拟滚动/分组与字段映射；校验态按项目约定用 `error`（非 `invalid`）
- `InputGroup` + `InputGroupAddon`：成员边框**不在根元素**上（`Input` 在 `__wrapper`、`Select` 在 `__trigger`、`DatePicker` 在 `__wrapper`、`Button`/`Addon` 在根）→ 命中成员必须 `> :deep(.si-input)` / `:deep(.si-input__wrapper)`；`margin-left: -1px` 合并边框 + hover/focus-within 抬 `z-index:1`；档位经 `--ig-addon-*` CSS 变量跨组件继承（Sass 中 CSS 变量值必须插值 `#{$var}`）；Input/DatePicker 组内 `flex: 1 1 0` 压制自带 `width:100%`；**容器禁设 `overflow:hidden`**（会裁 Select 下拉）；成员不得带 label/hint/error
- `Slider`：原生 `input[type=range]`，键盘与 `role="slider"` + `aria-valuemin|max|now` 全由浏览器提供（**不要自实现**）。①`readonly` 原生不支持 → 守卫 + `syncNativeValue()` **同步回滚**（`modelValue` 未变时 Vue 不会重 patch `value`）+ 拦 8 个改值键（**Tab 放行**）+ `aria-readonly`；②档位尺寸经 `--si-slider-track-h`/`--si-slider-thumb-size` 单点驱动 4 个伪元素，**必须带 fallback**；③**Chromium 的 `::-webkit-slider-thumb` 默认与轨道「顶」对齐**（非垂直居中）→ 必须补 `margin-top: calc((轨道高 - 拇指高) / 2)`；Firefox 的 `::-moz-range-thumb` 由浏览器自动居中，**不要**加 margin；④**轨道色必须取 `--b3-border-color`**（见相邻色陷阱）；⑤焦点环 fallback `rgba(hsl(...), 0.2)` 是**非法 CSS**，但该变量由 `themeColor` 运行时写入、全项目 60+ 处同写法 → 已知潜在问题，勿单独「修正」
- `FormField`：可选 `labelId`（`:id` 打在 `.si-form-field__label`，供控件 `aria-labelledby` 关联）。**它是多根组件（label → 默认插槽 → hint → 计数）→ 控件必须放进默认插槽**，写成自闭合 sibling 会让 hint 排到控件上方（`Select`/`Slider` 都曾踩）
- `Label`：**禁用态邻近兜底 `:has(+ :disabled)` 只命中「禁用态在根元素上」的成员**（原生 `button[disabled]`、原生 `input`）；`Input`/`Select`/`DatePicker`/`Textarea` 须包装层显式加 `data-disabled`。`variant` 仅在 `--inline`（`tag !== "label"`）下可见；**不得加 `inheritAttrs:false`**；`align` 靠文本层 `text-align` 而非根 `justify-content`
- **相邻色陷阱（面板/卡片对）**：`--b3-theme-surface`(`#f7f7f5`) 与 `--b3-theme-background`(`#ffffff`) 是相邻色，**不能用来画需要与面板区分的细线**（仅差 ~3% 灰度，等同不可见）；分隔/凹槽一律 `--b3-border-color`（浅 `#e0deda` / 暗 `#3a3a3c`）。同类偏弱：`--b3-theme-surface-lighter`（`Switch` 轨道、实底控件填充）
- **错误色 Token 陷阱**：`--b3-theme-destructive` **从未定义**（只有 `--b3-theme-error`）→ 写它恒走 fallback 且暗色偏暗。已修 `Label`/`Slider`；**残留 4 处**：`Tag.scss`(3) / `Badge.scss`(1)
- `Select`：`#selected`/`#option` 作用域插槽 + `SelectOption.keywords`；ARIA：trigger `role="combobox"`、面板 `role="listbox"`、选项 `role="option"`、分组 `role="group"` + `aria-labelledby`；**列表容器恒常渲染**（空态是其子节点，否则 `aria-controls` 悬空）；**筛选框必须常驻**（否则输入不匹配字符即卸载输入框、焦点掉 body）。键盘：单一 `activeIndex` 驱动高亮 + `aria-activedescendant` + `scrollIntoView`；`closeDropdown({ restoreFocus })` 仅 Esc 与键盘选中传 true；**筛选框按键须单独处理**（复用主处理器会 `preventDefault` 掉 `Space`）。私有目录 `select/`（禁止 feature 直接导入）；`SelectOption`/`SelectGroupOption` 有 **24 个文件**从 `@/components/Select.vue` 导入 → **导出路径不可变**
- `Loader` 无 props 且 `height:100%`（父容器必须给显式高度）；`Chart.vue` 仅 line/bar/pie/doughnut/area（无 radar）
- `Input.borderless`：去边框去底色，供 chips 类复合控件内嵌，焦点反馈由外层 `:focus-within` 承担
- 「实时跟随 + 一次性落盘」统一双事件：`update:modelValue` + `change`（`Slider`/`ColorField`/`Input`/`Textarea`）
- `Input`/`Select`/`Textarea` 在弹窗/表单中必须显式 `size="small"`（默认 small，但 medium 36px 过高）
- 实底控件禁用 `focus-ring` mixin（只改 `border-color`，实底 border 为 transparent 会完全不可见）→ 用 `outline`（同 `Switch.scss`/`Checkbox.scss`/`Listbox.scss`）

## 组件库外迁（供别的项目复用；2026-09-10 实测）
- 交付文档：`docs/components-vue3-migration-guide.md`（复制清单 / 依赖 / 接入步骤 / 主题桥接 / 坑 / 裁剪 + 自检命令）
- 基线：`src/components/` **72 文件**（根 26 / `datePicker` 7 / `select` 5 / `speedDial` 3 / `textarea` 1 / `styles` 30）；**25 个公开组件**
- **零业务耦合（可直接迁普通 Vue 3）**：`src/components/**` 内 0 处 i18n / plugin / `siyuan` / store / `@/features` 导入；跨目录依赖**仅两项** —— `@/config/icons`（14 文件，`IconWrapper.vue` 是唯一运行时消费方）与 Sass `@/variables.scss`（30 个 scss）；第三方仅 `vue`(28 文件) / `@iconify/vue` / `chart.js`+`vue-chartjs`（仅 Chart）
- **目录外必带 3 项**：`src/_variables.scss`（设计 Token）、`src/config/icons.ts`（853 行纯数据零依赖）、图标离线预加载 `addCollection(mdiIcons)`（不调则 `<Icon>` 转请求 CDN，断网全空白且**不报错**）。组件只用 mdi → `@iconify-json/ph` 可省
- 别名 `@`→`src` 必须配（Vite `resolve.alias` + tsconfig `paths`），Vite 的 alias 同样作用于 Sass `@use`；本仓库 `tsconfig.types` 里的 `"siyuan"` 不能照抄
- 组件消费 **20 个 `--b3-*` 变量**，非思源项目需注入一份 bridge SCSS；**两个 `*-rgb` 变量必须是逗号分隔**（被 `rgba(var(--b3-theme-primary-rgb, 201, 122, 93), 0.1)` 消费），写现代空格分隔会让**整条声明失效**
- `ColorField.scss` 有 4 处 `var(--b3-theme-outline)` **无 fallback**（16/31/50/65 行）→ 桥接必须补该变量，否则边框退 `currentColor`
- 组件自身硬编码 **15 个 IconKey**：minus / check / x / close / eye / eyeOff / calendar / chevronUp / chevronDown / chevronLeft / chevronRight / chevronDoubleLeft / chevronDoubleRight / magnify / plus
- 仅 3 处宿主耦合：①样式全走 `var(--b3-*, fallback)`（非思源=恒定亮色，靠桥接解决）②`Chart.vue:175` 判 `html.b3-theme-dark` ③`SpeedDial.vue:206` 输出 `b3-tooltips` 类

## 通用陷阱
- **Vue 的 `slots` 不是响应式**：`instance.slots` 原地赋值 → `computed` 不随插槽增删重算；需跟随变化必须用普通函数或模板直读 `$slots`
- **scoped 的两个反直觉点**：①父 scope 只加在「模板里直接写」的子组件根元素上，且只对**单根节点**生效（模板拆多根后父样式全失效）；②**经插槽传入的子组件带的是调用方的 scope 属性**，容器组件写 `.容器 > .子组件` 会编译成两处同 `data-v` 而**永不匹配**，必须 `> :deep(.子组件)`。校验手段：Sass 展平后喂 `@vue/compiler-sfc` 的 `compileStyle({scoped:true})`（直接喂嵌套 CSS 会得出错误结论）
- **覆写共享组件内部样式必须算特异性**：`Label.scss` 含 scoped 后为 (0,3,0)，父组件写 `.row .si-label` 也只到 (0,3,0) → 会落入「比样式表顺序」的赌局，加一层父选择器才稳
- **SCSS 嵌套陷阱**：档位/变体必须写 `.si-xxx--tier &` 反向选择器，写成 `.si-xxx--tier { .si-xxx__el {} }` 会变成错误后代链
- **±2px 间距 Token 映射**：2px=`$spacing-2px`、3px=`$spacing-px`、6px=`m.$gap-xs`、10px=`m.$spacing-2_5`；14px / 18px 无 Token，硬编码 + `// 无对应 Token`。`--b3-theme-primary` 的 fallback 全库统一 `$color-danger`（历史约定，勿「修正」）
- **`.ts` 不得 `import type { X } from "@/components/Y.vue"`**（tsc 不解析 `.vue` 导出 → `TS2614`；既有噪声：`useCodeImageGenerator.ts`、`statusBar/featureRegistry.ts`）。**新解法**：①类型下沉到纯 TS 模块（如 `src/components/select/types.ts`）；②`.vue` 的 `<script setup>` 用类型别名保住对外路径：`import type { SelectOption as Shape } from "./select/types"` + `export type SelectOption = Shape`
- **i18n 类型用「键清单派生」**：`const I18N_KEYS = [...] as const` + `Record<(typeof I18N_KEYS)[number], string>`，逐键 `?? ""` 填充 → 调用方恒得 `string`；写成 `xxx?: string` 会让所有消费点报 TS2322
- 新增遵循既有模式的模块时，先列出同目录同类文件的**导出清单**对齐（`search_content '^export const'`），别漏「导出契约」
- 非 deep watch 对原地 splice 不触发 → 返回全新数组；组件内常量若被 composable 运行时引用，不能放 `types/index.ts`（会与 `index.vue` 循环），拆 `types/xxx.ts`
- 组件 props 中的 plugin 类型：思源 `Plugin` 基类无 `settings`，项目先例 `import type PluginSample from "@/index"`（`import type` 被擦除，无运行时循环）
- 工具坑：`Get-Content | Measure-Object -Line` **漏空行** → 用 `(Get-Content X).Count`；sass 离线编译需自定义 importer 映射 `@/` → `src/`（`findFileUrl`），可端到端验证 SCSS 编译与选择器展开

## 功能模块状态（只留仍可执行的事实）
- **待迁移清单（已确认、尚未动）**：`ConfirmDialog` 的三处本地实现（`s3FileManager` / `gitPush` / `shortcut`）；`ReviewRadarChart` 未迁到 `Chart`（Chart 无 radar 控制器）；feature 内原生 radio 5 处（`video/CompressDialog`、`wordQuery/WordQueryPanel`、`gitPush` 的 `SettingsDialog`/`CommitFixDialog`/`BatchFixDialog`）；**原生 `<input type="color">` 8 处**（`prompts/CategoryManageModal`、`toolCollection/tools/colorPicker`、`imageCreation/{CoverDecorationSettings,CodeImageTab}`、`superPanel/FeatureCard`、`gitPush/{common/CategoryDialog,CommitAnalysis/AnalysisSettingsForm}`、`generalSettings/TabPinSettings`）
- **gitPush**：多本地路径（`resolveValidPath`）；历史重写 fast-import 化；提交规则 14 条经 `DEFAULT_COMMIT_RULE_CONFIG` / `readCommitRuleConfig(prefs)` 单一入口
- **componentPreview**：addTab + openWindow 双形态；`usePreviewSize`（key `component-preview-size`）；`sizeable` + `resolveProps` 只注入未显式指定 size 的示例
- **compactMode**：3 档密度 + 6 档字号 + 5 区域开关；`ALL_*` 常量单一来源；`applyCompactMode` 先复位再置位（幂等）
- **statistics**：`BLOCK_TYPE_LABELS` 仍被 `baseStats` 使用，勿删
- 其余模块（S3 备份 / toolCollection / dataSnapshot / aiContentGenerator / bookmarkMarker / skillLearning）细节见各自 `src/features/<name>/README.md` 与当日日志

## 禁止事项
- 禁止执行 `pnpm vite build` / `pnpm lint`；禁止 `dotnet build`
- 禁止跨 feature 直接导入（必须事件总线 + App.vue 调度）
- 禁止在 feature 内自建共享组件已覆盖的控件
