# 项目记忆（siyuanPluginVueSN）

> 整理：2026-09-12（第 8 次压缩：合并同类项、删与 `AGENTS*.md` 重复的表述，保留规范外经验）。编码规范正文见随上下文加载的 `AGENTS*.md`。

## 环境与边界
- pnpm 12：`pnpm-workspace.yaml` 的 `allowBuilds`（`@parcel/watcher` / `esbuild` / `vue-demi` = true）必须保留，否则 install 以报错收尾
- 依赖损坏诊断：扫 `.pnpm/*/node_modules/<pkg>` 是否缺 `package.json`；修复一律 `pnpm install --force`（手删会跟随 junction 删掉真包）
- 行数统计用 `(Get-Content X).Count`（`Measure-Object -Line` 漏空行）
- AI **禁止** `pnpm vite build` / `pnpm lint`（C# 项目禁止 `dotnet build`）；可执行 `read_lints`、`npx tsc --noEmit`、`pnpm i18n:merge|verify`、`pnpm validate:icons`
- **四道验证各查不同问题**：`read_lints` 只查规范（**不查未导出成员/类型**，偶有陈旧诊断须回读代码核对）；`tsc --noEmit` 查 `TS2614`/`TS2322` 但**不解析 `.vue`**，且仓库存在大量既有报错（statusBar/featureRegistry、ideaGenerator、gitPush 等）⇒ 只看新增路径；`@vue/compiler-sfc` 未提升到根 `node_modules`；`vite build` 才查 `MISSING_EXPORT`
- `types/index.ts` 用**显式导出清单**（分「值 export」与「type export」两块）⇒ 新增类型/常量须两处分别登记，否则消费方 TS2305
- 快捷键查重必须**递归**搜 `src/features/**`；已知未修冲突：`tableOfContents` 与 `ideaGenerator` 同为 ⌃⌥I
- 独立窗体精简：`isFloating`（`getFrontend() === "desktop-window"`）+ `v-if="!isFloating"` 隐藏重复标题

## 共享组件库
> 实测基线（2026-09-12）：45 个公开组件 / 17 个私有子目录 / previewData 30 个数据文件 —— **计数必须实测**（并行会话频繁变动）
- 新增组件 = `<Name>.vue` + `styles/<Name>.scss` + `previewData/<name>.ts`（**双导出**「分组对象 + 分组数组」并接入 `previewData/index.ts`）+ 文档计数（`AGENTS.md` 多处、根 `README.md`、`componentPreview/README.md`、`kit/README.md`、迁移指南、私有目录清单）
- 私有子部件与纯函数放同名小写目录（`datePicker/ select/ speedDial/ paginator/ textarea/ timeline/ splitter/ tabs/ confirm/ overlay/` 等），不计入清单、**禁止 feature 直接导入**；配套但供 feature 直接使用的组件平铺（`InputGroup` + `InputGroupAddon`、`Splitter` + `SplitterPanel`）
- 四档 `xsmall/small/medium/large`（默认 small），字号 10/12/14/16；**原则上只改字号，不联动 padding/min-height/gap/图标**（Slider/DatePicker 的几何联动为已登记特例）
- 分段档位/模式切换用 **`Button` 分组**（选中 `variant="primary"`、未选中 `ghost`+`text`+`size="xsmall"`+`:aria-pressed`）；表单式互斥选项才用 `RadioButton`
- 允许自建例外：纯展示局部布局容器、无档位 26×26 `.icon-btn`
- 改 props/行为/具名插槽/事件契约后，必须同步 `previewData/*.ts` 与 `componentPreview/README.md`（插槽与事件语义无法在快照呈现）
- **预览框架**：`PreviewExample` = `props` + `slotText`/`render`（默认插槽）+ `slots`（具名/作用域插槽工厂，**第二参 = 注入档位后的实际渲染 props**）；受控示例由 `PreviewStage` 持本地 `modelValue` 并回写，未声明 `modelValue` 的组件**一个额外属性都不注入**（否则多根 `FormField` 报 extraneous attrs）；`hasSlot` 仅表示「有默认插槽内容」
- **尺寸演示唯一入口 = 面板头部 XS/S/M/L 切换（2026-09-12 起）**：各分区不再单设「尺寸」示例卡，示例插槽内子控件也不再固定 `size`（Panel / Card / Timeline 已清）。⚠️ 保留项：`size: p.size` / `exampleProps.size` / demo 包装的 `props.size` 动态透传（Toolbar、Dialog、Drawer、ConfirmDialog、ConfirmPopup、FileUpload、InputGroup、Sidebar）——删掉会让档位切换在复合示例中失效；`Avatar.xlarge`、IconWrapper 像素 size、Splitter 的 `sizes` 与「尺寸持久化」均不属档位演示，也不单列
- **预览里需要宿主样式**（如垂直分隔线高度）→ 直接给示例传 `props: { style: "height: 80px" }`（单根组件 fallthrough），无需改框架
- 弹层类预览必须沙箱覆盖：`.cp-card__stage{position:relative}` + 舞台内遮罩改 `absolute; z-index:1`（覆盖须抬特异性：类名写两遍）；`.cp-card` 为 `overflow:hidden`；三段结构的 Dialog/Drawer 另需卡高（300px）并把 `max-height` 收敛为 `100%`

### 组件特有陷阱
- `Button`：5 个既有 variant 语义不可改（180+ 处依赖）；新能力走 `--severity-*`/`--outlined`/`--text`；纯图标必须 `aria-label`；loading 用 `visibility:hidden` 保宽。`isIconOnly` 陈旧 computed 属**有意保留，勿重提**
- `ToggleButton`：①给 `--severity-*` 会污染 `--outlined` 取色 ⇒ 未按下不传 severity；②无文案时**不能传默认插槽**（否则 `$slots.default` 恒真毁 `isIconOnly`）；`fluid` 默认 false
- `SpeedDial`：`position` 用类输出；`transition-delay` 必须三段；`linear` 距离 = `(index + 1) × (边长 + 间隙)`；键盘触发判别 `event.detail === 0`；不做 `mask`；`size` 决定几何，禁经 `buttonProps.size` 覆盖
- `Paginator`：`page` **1 基** / `rows` / `total`；越界必须收敛并回派 `update:page`；`rows<=0` 兜底 1；页码窗口只隔 1 页直接补上、≥2 页才折叠省略号；`rows` 变更回第 1 页；文案走 `labels` ⇒ **零 i18n 改动**。已统一自建分页（`imageCompressor`/`flashcardReading`/`skillLearning`）；⚠️ `gitPush/usePagedList.ts` 是「加载更多」累加式，**不是**分页器，勿迁
- `Timeline`：**始终渲染 `opposite` 容器**；`alternate` 按奇数索引反向；反向机制两向复用 `isReversed()`；默认节点为空心圆、连接线**末项不渲染**；横向连线在某列 `opposite` 更高时呈阶梯状（与官方同病）
- `Card`：`content` 插槽未传**回落默认插槽**；⚠️ 本项目 `header` = 带下边框的标题栏（官方通栏语义对应本项目 `cover`）；钩子 `contentClass`→`.si-card__body`、`captionClass`→`.si-card__header-content`；`.si-card__body` 的 padding 由 `.si-card--{tier} .si-card__body`(0,2,0) 给出 ⇒ **外部单类改 padding 无效**
- `Divider`：`align` 取值与方向绑定、**交叉组合静默居中**；用两段真实线段实现；**垂直分隔必须给高度**否则非 flex 父容器塌成 0。**待迁移**：22 个 feature 文件有自建分隔线
- `Panel`：受控/非受控双模式（`collapsed` **刻意不给默认值**）；`toggleable=false` 时必须忽略 `collapsed`；图标-only Button **不能传默认插槽**（`toggleicon` 走 `v-if/v-else`）且必须 `aria-label` + `aria-expanded`。**待迁移**：约 28 个 feature 有自建折叠区
- `Splitter` + `SplitterPanel`：分隔条渲染在**面板内侧**；子 `onMounted` 先于父 ⇒ 父级 `onMounted` 是「全部就绪」时点；**scoped 归属陷阱（真踩过）**：分隔条样式必须写在 `SplitterPanel.scss`，写进 `Splitter.scss` 会**静默失效**；`aria-orientation` 取自身物理方向；垂直/嵌套布局须给父容器确定高度；Pointer Events + `setPointerCapture`
- `Tabs` 五件套：`value` 受控/非受控双模式；`TabPanel.lazy` 未激活**不进 DOM**（状态会丢）；键盘逻辑在 `Tab` 不在 `TabList`；活动指示器为静态下划线；**激活态不改字重**。**待迁移**：36 个 feature 文件命中自建 tab
- `Toolbar`：三容器**恒定渲染**；两端 `flex: 1 1 0` 配平使 center 精确居中；⚠️ **档位传不进插槽** ⇒ 内部共享控件必须显式传同档 `size`（该约定现只在分区 summary 与 README 保留）。**待迁移**：86 个 feature 文件命中工具栏类实现
- `Dialog`：`dismissableMask` 默认 **false**（ConfirmDialog 是 true）；`modal` 默认 **true**（官方 false，遮罩恒渲染，非模态 `--plain`）；**点关 = 遮罩上按下并抬起**；初始焦点 `[autofocus]`（footer→header→content）⇒ 外壳须可注入；`showHeader:false` 连带不渲染关闭按钮。**待迁移**：47 个 `*Dialog.vue` + 12 个 `*Modal.vue`
- `ConfirmDialog`：`visible` 受控；confirm 后**不自动关闭**；**只监听 Esc，不绑 Enter**；遮罩点关/Esc/焦点接管与归还已抽到私有 `overlay/useOverlay`（与 `Dialog` 共用，外部名零变更）。`prompts`/`skillsViewer` 的 `DeleteConfirmModal` 与三处 feature 本地确认弹窗（s3FileManager / gitPush / shortcut）**尚未迁移**
- `Checkbox`：`isGroup = !binary && Array.isArray(modelValue)`；`indeterminate` 只能写 DOM 属性；分组模式返回**新数组**；`label` 只接受字符串（自定义文案走默认插槽）
- `RadioButton`：无数组模式/无 indeterminate；emit `binary ? true : value`（**不可取消**）；**同组必须同一 `name`**；只读拦截须含方向键
- `Textarea`：`fluid` **默认 true**；`autoResize` 时 `rows` 兼初始高度与 `minRows` 兜底；实底控件聚焦用内嵌 outline。⚠️ `Input` 的 `type="textarea"` 按用户决定**保留为兼容入口**
- `DatePicker`：自建 `dateFormat` 模板引擎；**无时区字符串必须按本地时间解析**；焦点三坑（关闭后重开面板 → `skipFocusOpen`；视图切换后焦点掉 body + Esc 失效 → `focusActiveView()`；面板容器需 `tabindex="-1"`）
- `ColorField`：原生 `<input type="color">` 在思源 Electron 中**不弹取色器**；仍有 8 处原生实现待替换（见文末）
- `Listbox`：指示器**自绘、不复用 `Checkbox`**（`role="option"` 内不得嵌套可交互元素）
- `InputGroup` + `InputGroupAddon`：成员边框不在根元素（`Input`/`DatePicker` 在 `__wrapper`、`Select` 在 `__trigger`）⇒ 必须 `> :deep(...)`；`margin-left: -1px` 合并边框 + hover/focus-within 抬 `z-index:1`；档位经 `--ig-addon-*` 继承（Sass 中 CSS 变量须插值）；**容器禁设 `overflow: hidden`**
- `Slider`：`readonly` 原生不支持 ⇒ 守卫 + `syncNativeValue()` 回滚 + 拦 8 个改值键（**Tab 放行**）；**Chromium 下 thumb 需补 `margin-top`**（Firefox 不加）；焦点环 fallback `rgba(hsl(...), 0.2)` 是**非法 CSS**且全项目 60+ 处同写法 → 勿单独「修正」
- `FormField` **多根** ⇒ 控件必须放进默认插槽；`Label` 的邻近禁用兜底只命中「禁用态在根元素上」的成员（`Input`/`Select`/`DatePicker`/`Textarea` 须包装层 `data-disabled`），且**不得加 `inheritAttrs:false`**
- `Select`：`SelectOption`/`SelectGroupOption` 有 24 个文件从 `@/components/Select.vue` 导入 ⇒ **导出路径不可变**；列表容器恒渲染、筛选框常驻；`closeDropdown({ restoreFocus })` 仅 Esc 与键盘选中传 true；筛选框按键须单独处理（复用主处理器会吃掉 Space）
- `Loader` 无 props 且 `height:100%`；`Chart.vue` 仅 line/bar/pie/doughnut/area；`Input.borderless` 的焦点反馈由外层 `:focus-within` 承担
- 「实时跟随 + 一次性落盘」统一双事件 `update:modelValue` + `change`；`Input`/`Select`/`Textarea` 在弹窗/表单中显式 `size="small"`；实底控件禁用 `focus-ring` mixin → 用 outline

### 相邻色与 Token
- `--b3-theme-surface`(#f7f7f5) 与 `--b3-theme-background`(#ffffff) 仅差 ~3% 灰度 ⇒ **不能画需区分的细线**，分隔一律 `--b3-border-color`
- `--b3-theme-destructive` **从未定义**（只有 `--b3-theme-error`）；`Tag.scss` / `Badge.scss` 已修
- **Token 短名/长名双轨**：`kit/variables.scss` 两套等值；**新代码一律短名**（`$s-px6` / `$t-xs` / `$r-base` / `$c-*` / `$ff-zh` / `$fw-*` / `$lh-*`），映射表 `docs/token-shorthand.md`；`.ts`/`.scss` 的 `@use` 一律显式

## 组件库外迁（已交付）
- 交付文档 `src/components/docs/components-vue3-migration-guide.md`；**零业务耦合**：`src/components/**` 内 0 处 i18n / plugin / siyuan / store / `@/features`
- **目录外必带 3 项**：`src/_variables.scss`、`src/config/icons.ts`、图标离线预加载 `addCollection(mdiIcons)`（不调则转请求 CDN，断网全空白且**不报错**）；别名 `@`→`src` 必须配（同样作用于 Sass `@use`）
- 组件消费 20 个 `--b3-*` 变量；**两个 `*-rgb` 必须逗号分隔**（现代空格分隔会让**整条声明失效**）

## 通用陷阱
- **受控/非受控标准写法**：可选 prop **不给默认值**，用 `props.x === undefined` 判定是否受控，未受控时写内部 `ref`，两种模式都照常 emit（`SpeedDial.visible` / `Panel.collapsed` 先例）
- **Vue 的 `slots` 不是响应式**：`instance.slots` 原地赋值 ⇒ 判断写在**模板里**才稳，必须 computed 时只能包 `props`
- **scoped 两个反直觉点**：父 scope 只加在「模板里直接写」的子组件根元素上且只对单根生效；**经插槽传入的子组件带的是调用方 scope** ⇒ 容器写 `.容器 > .子组件` 永不匹配，必须 `> :deep(.子组件)`
- **覆写共享组件内部样式必须算特异性**：组件自身 scoped 样式 `.si-x[data-v-*]` =(0,2,0) ⇒ 父级单类同特异性、胜负取决于注入顺序 → 解法是**类名重复一次**（=(0,3,0)）；SCSS 中档位/变体写 `.si-xxx--tier &` 反向选择器
- **`.ts` 不得 `import type { X } from "@/components/Y.vue"`**（tsc 不解析 `.vue` → `TS2614`）：类型下沉到纯 TS 模块，或用类型别名保住对外路径
- **i18n 类型用「键清单派生」**：`const XX_KEYS = {...} as const` + `type XX = keyof typeof XX_KEYS`，逐键 `?? ""` 填充；写成 `xxx?: string` 会让所有消费点报 TS2322
- 新增遵循既有模式的模块时先 `search_content '^export const'` 对齐同目录**导出清单**；非 deep watch 对原地 splice 不触发 ⇒ 返回全新数组；组件内常量被 composable 运行时引用要拆 `types/xxx.ts`（放 `types/index.ts` 会与 `index.vue` 循环）
- sass 离线编译需自定义 importer 映射 `@/` → `src/`（`findFileUrl`）；`import sass from 'sass'` 已废弃 → `import * as sass`
- **写 JS 扫描脚本的两个静默陷阱**：①对象字面量 `{ line: i + 1, line }` 后者覆盖前者 ⇒ `findings.line` 变源码文本且**无任何报错**；②用 `m[0]`（含首尾引号）做前缀判定会让规则**整体零命中**。改脚本后必须复扫或回读源码验证

## 硬编码审查（工具与教训）
- 工具 `scripts/audit-hardcode.mjs`（只读；四类规则 + 15 类例外白名单；`--dry` **不写盘**）；交付 `docs/hardcode-audit.md` + `docs/hardcode-audit.data.json`；配套 `scripts/codemod-hardcode-tokens.mjs`（默认干跑、`--write`、幂等）、`audit-token-shorthand.mjs`、`verify-token-migration.mjs`
- **可机械替换的前提是「值即名称」Token 可新增**；语义档位 Token **不能**机械改（`line-height` 实际 1.4/1.6/1.7、`transition-duration` 实际 0.15/0.2/0.3/0.6s）
- **编译通过 ≠ 正确**：Sass 不校验 CSS 属性值合法性（曾生成 `#var(--b3-theme-error)` 58 处却**编译全过**）⇒ 机械替换后必须抽查产物
- **`@use` 命名空间三坑**：裸 `$token` 只沿 **`@forward`** 链递归；`@/` 解析要补回 `src/`；已有其他 `as *` 时改用 `@use "@/variables.scss" as g;` + `g.$token`
- `git diff --shortstat` 会因 1.1 MB 的 `docs/hardcode-audit.data.json`（每次重写）虚报数万行 ⇒ 核对用 `git diff --numstat`；**分析前别下结论**（曾把「没有对应 Token」误猜成边框宽度误报）
- **样式分离标准动作**：①读 `<style>` 查 `@use ... as X` 依赖 ②新建 `styles/<Component>.scss`，首行 `@use "@/variables.scss" as *;` ③无 Token 的值集中为文件顶部局部变量 + `// 无对应 Token` ④`.vue` 的 `<style>` 改**双行导入** ⑤`sass.compileAsync` + `read_lints` + 扫描器复跑

## 功能模块待办（只留仍可执行的事实）
- **待迁移**：feature 内原生 radio 5 处（`video/CompressDialog`、`wordQuery/WordQueryPanel`、`gitPush` 的 `SettingsDialog`/`CommitFixDialog`/`BatchFixDialog`）；**原生 `<input type="color">` 8 处**（`prompts/CategoryManageModal`、`toolCollection/tools/colorPicker`、`imageCreation/{CoverDecorationSettings,CodeImageTab}`、`superPanel/FeatureCard`、`gitPush/{common/CategoryDialog,CommitAnalysis/AnalysisSettingsForm}`、`generalSettings/TabPinSettings`）；`ReviewRadarChart` 未迁到 `Chart`
- **gitPush**：多本地路径（`resolveValidPath`）；历史重写 fast-import 化；提交规则 14 条经 `DEFAULT_COMMIT_RULE_CONFIG` / `readCommitRuleConfig(prefs)` 单一入口；行数统计已两轮整改。⚠️ `styles/` 目录树计数与 `common/` 清单属历史欠账，改该文件时计数一律实测
- **gitPush 行数口径**：**「当前总行数」是工作区存量维度**（`git ls-files` + 逐文件 `readFileSync`，同步阻塞、与条数无关、不过滤扩展名）；排行与条形都取存量 ⇒ 改条数看不出差别
- **gitPush 失败明细**：`fetchFailures`（`ProjectFetchFailure` = projectId/projectName/path/kind/reason）由 `runCore` 的 `settled` 回填 → 持久化 `lineStatsCache.failures`；UI `LineStats/FetchFailuresDialog.vue`（共享 `Dialog`）；分类 `FETCH_FAILURE_KIND_KEYS`（`types/meta.ts`）+ `classifyFetchFailure`（`utils.ts`），路径预检用 `ProjectFetchError` 自带 kind
- **gitPush 失败真因排查清单**：①路径不存在（多设备未配 `localPaths`）②`not a git repository`（路径指到父/空目录）③**空仓库 `git log` 退出码非 0**（合法空数据被当失败）④超时（本地命令用 60s 本地池，"调大网络超时"提示无效）⑤`spawn git ENOENT` / Node 环境不可用 ⑥dubious ownership（`safe.directory`）⑦`index.lock` 残留 ⑧大仓库全量 `git log --numstat` 逼近 10MB `maxBuffer`（可能报成"超时"）
- 其余模块（componentPreview / compactMode / statistics / S3 备份 / toolCollection / dataSnapshot / aiContentGenerator / bookmarkMarker / skillLearning / docAnalysis / CodeReport）细节见各自 `src/features/<name>/README.md` 与当日日志
