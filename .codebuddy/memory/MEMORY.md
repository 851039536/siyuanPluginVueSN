# 项目记忆（siyuanPluginVueSN）

> 整理：2026-09-12（第 9 次压缩：删掉与 `AGENTS*.md` / `componentPreview/README.md` 重复的**组件级**说明——47 个组件的 props / 有意差异 / 插槽 / 事件现已逐条登记在那两处，此处只留规范外经验与反回归提醒）。编码规范正文见随上下文加载的 `AGENTS*.md`。

## 环境与边界
- pnpm 12：`pnpm-workspace.yaml` 的 `allowBuilds`（`@parcel/watcher`/`esbuild`/`vue-demi`=true）必须保留，否则 install 报错收尾；依赖损坏先扫 `.pnpm/*/node_modules/<pkg>` 是否缺 `package.json`，修复一律 `pnpm install --force`（手删会跟随 junction 删掉真包）
- AI **禁止** `pnpm vite build` / `pnpm lint`（C# 项目禁止 `dotnet build`）；可执行 `read_lints`、`npx tsc --noEmit`、`pnpm i18n:merge|verify`、`pnpm validate:icons`、`npx sass --no-source-map <单个 .scss>`（验 SCSS 语法与选择器产物）
- **四道验证各查不同问题**：`read_lints` 只查规范（查不到未导出成员/类型，偶有陈旧诊断须回读代码核对）；`tsc --noEmit` 查 TS2614/TS2322 但**不解析 `.vue`**；`vite build` 才查 MISSING_EXPORT。仓库有大量**既有**报错（statusBar/featureRegistry、ideaGenerator、gitPush、s3FileManager TS6133 等）⇒ **只看新增路径**
- IDE **拦截**未带 `-Encoding` 的 PowerShell `Get-Content` ⇒ 统计行数/读内容一律改用工具
- `types/index.ts` 是**显式导出清单**（值 export / type export 两块）⇒ 新增类型或常量须两处登记，否则消费方 TS2305
- 快捷键查重必须**递归**搜 `src/features/**`；已知未修冲突：`tableOfContents` 与 `ideaGenerator` 同为 ⌃⌥I

## 共享组件库（计数必须实测）
- 2026-09-12 实测（**并行会话随时会加组件，用前必须重数**）：**48 公开组件 / 56 个 `styles/*.scss` / 19 个小写起始目录（含 `styles` `kit` `docs` 三个支撑目录）/ 33 个 `previewData/*.ts` / 递归 160 个文件**
- 新增组件的文档同步面：`AGENTS.md`（4 处总数 + 清单表新增行 + 复用能力清单 + 目录树）、`componentPreview/README.md`（总数 / 覆盖清单 / sizeable 清单 / 档位段 / 具名插槽表 / 事件契约表）、`kit/README.md`、`kit/theme.ts` 头注释、根 `README.md`、迁移指南。⚠️ 陈旧数字常**埋在表格单元格中间**（TieredMenu / Sidebar 行内的「与全库 N 个组件一致」）⇒ 用 `\d+ 个` 全量搜；⚠️ 并行会话各改一半会造出「头部 48 / 行内 47」的内耗，收尾必须复扫一遍
- 私有子部件/纯函数放同名小写目录（`confirm datePicker fileUpload megaMenu overlay paginator select sidebar speedDial splitter tabs textarea tieredMenu timeline tooltip`），不计入清单、禁止 feature 直接导入
- **预览框架**：示例 = `props` + `slotText`/`render`（默认插槽）+ `slots`（具名/作用域插槽工厂，**第二参 = 注入档位后的实际渲染 props**）；受控示例由 `PreviewStage` 持本地值回写，未声明 `modelValue` 的组件**一个额外属性都不注入**（否则多根 `FormField` 报 extraneous attrs）
- **尺寸演示唯一入口 = 面板头部 XS/S/M/L**：分区不设「尺寸」卡、插槽内子控件不固定 `size`；⚠️ 但 `size: p.size` / `exampleProps.size` 的**动态透传必须保留**（Toolbar / InputGroup / Dialog / Drawer / ConfirmDialog / ConfirmPopup / FileUpload / Sidebar），删掉会让复合示例档位失效
- **面板自身排版约定（2026-09-12 UI 审查后）**：网格 `align-items: start`（卡片按内容高度 —— 特例舞台不再拉高同排卡片、展开代码不撑高邻居）；`STAGE_CLASS_BY_GROUP`（`PreviewSection.vue`，含 toast）是**舞台特例唯一登记点**；`WIDE_STAGE_GROUP_IDS`（dialog/drawer/megaMenu/tieredMenu）在 ≥720px 下 `.cp-card--wide` 跨两列；档位切换器 / 卡片代码按钮 / 代码块复制按钮**一律复用共享 `Button`**（icon-only 必传 `ariaLabel`；复制成功用 `:severity="'success'"` + `.cp-sr-only` 的 `aria-live` 播报），面板内唯一自建可交互元素是导航项（`aria-current` + 内嵌 `:focus-visible`）；边框统一 `--b3-border-color`，`--b3-theme-surface-lighter` 只作 hover 底色
- 预览需宿主样式（如垂直分隔线高度）→ 直接给示例传 `props: { style: "height: 80px" }`，无需改框架
- 弹层类预览必须沙箱覆盖：舞台 `position: relative` + 舞台内遮罩改 `absolute; z-index:1`（**类名写两遍**抬特异性）；`.cp-card` 为 `overflow:hidden`，三段结构另需卡高
- 新增公开组件四件套：顶部文件功能注释 + `import "./kit/theme"` 副作用 + 样式外置（`<style scoped>` 只 `@use` 一份 scss）+ **内部只用相对路径**（库要能整目录外迁；`@/utils/*` 是既有例外）
- 组件内定时器**不用** `@/utils/timerRegistry`（那是 feature 侧统一入口）—— 组件库零业务耦合，`tooltip`/`megaMenu`/`sidebar`/`tieredMenu`/`Message` 一律原生定时器 + 卸载清理

### 反回归提醒（勿重提 / 勿"顺手修"）
- `Button.isIconOnly` 的陈旧 computed 属**有意保留，勿重提**
- `Slider` 焦点环 fallback `rgba(hsl(...), 0.2)` 是**非法 CSS**，全项目 60+ 处同写法 → 勿单独「修正」
- `Input` 的 `type="textarea"` 按用户决定**保留为兼容入口**
- `ToggleButton`：给 `--severity-*` 会污染 `--outlined` 取色 ⇒ 未按下不传 severity；无文案时**不能传默认插槽**（否则 `$slots.default` 恒真毁 `isIconOnly`）
- `Message`：`severity` 取值照搬 PrimeVue（`warn`/`error`/`contrast`），**与 `Button.severity` 有意不统一**；关闭插槽叫 `closebutton`（非官方 `closeicon`）；`close` 只通报、**组件不自动隐藏**
- ⚠️ 覆写共享 `Button` 尺寸有**两颗雷**：①只有 `--button-size` 不够 —— 档位类自带的 `min-height: 28/36/44px` 会反过来决定高度 ⇒ 必须同时写 `min-height: 0`；②`--button-size` 本身只在 Button **无默认插槽**（`isIconOnly` 为真、输出 `si-button--icon-only`）时才生效 ⇒ 尺寸直接锁在自有类上最稳（`Message.scss` / `FileUpload.scss` 均按此写）
- ⚠️ **恒传插槽出口 = 给子组件造出「恒真的默认插槽」**：`<Button><slot name="x"/></Button>` 使 `$slots.default` 恒真、`isIconOnly` 退化为假（丢失 icon-only 档位尺寸、多渲染一个空文本层）⇒ 必须写成 `<template v-if="$slots.x" #default>` **条件转发**（已用 vue/compiler-sfc 实测：`v-if` 落在 `<template #slot>` 上会编译为 `createSlots` 的**条件条目**，不传时该插槽真的不存在）；同源坑见 `ToggleButton`「无文案时不能传默认插槽」

## 库外通用陷阱
- **受控/非受控标准写法**：可选 prop **不给默认值**，用 `props.x === undefined` 判定（`SpeedDial.visible` / `Panel.collapsed` 先例），两种模式都照常 emit
- **Vue 的 `slots` 不是响应式**：`instance.slots` 原地赋值 ⇒ 判断写在**模板里**才稳，必须 computed 时只能包 `props`
- **scoped 两个反直觉点**：父 scope 只加在「模板里直接写」的子组件根元素上且只对单根生效；**经插槽传入的子组件带的是调用方 scope** ⇒ 容器写 `.容器 > .子组件` 永不匹配，必须 `> :deep(.子组件)`
- **覆写共享组件内部样式必须算特异性**：组件自身 scoped 是 `.si-x[data-v-*]` =(0,2,0)，父级同类名单写 =(0,2,0) 靠注入顺序太脆弱 ⇒ **类名写两遍** =(0,3,0)；SCSS 中档位/变体写 `.si-xxx--tier &` 反向选择器
- **`.ts` 不得 `import type { X } from "@/components/Y.vue"`**（tsc 不解析 `.vue` → TS2614）：类型下沉到纯 TS 模块，或保留类型别名
- **i18n 类型用「键清单派生」**：`const XX_KEYS = {...} as const` + `type XX = keyof typeof XX_KEYS`，逐键 `?? ""` 填充；写成 `xxx?: string` 会让所有消费点报 TS2322
- 新增遵循既有模式的模块时先 `search_content '^export const'` 对齐同目录**导出清单**；非 deep watch 对原地 splice 不触发 ⇒ 返回全新数组；组件内常量被 composable 运行时引用要拆 `types/xxx.ts`（放 `types/index.ts` 会与 `index.vue` 循环）
- sass 离线编译需自定义 importer 映射 `@/` → `src/`（`findFileUrl`）；`import sass from 'sass'` 已废弃 → `import * as sass`
- **写 JS 扫描脚本的两个静默陷阱**：①对象字面量 `{ line: i + 1, line }` 后者覆盖前者 ⇒ 无任何报错；②用 `m[0]`（含首尾引号）做前缀判定会让规则**整体零命中**。改脚本后必须复扫或回读源码验证

### 相邻色与 Token
- `--b3-theme-surface`(#f7f7f5) 与 `--b3-theme-background`(#ffffff) 仅差 ~3% 灰度 ⇒ **不能画需区分的细线**，分隔一律 `--b3-border-color`
- `--b3-theme-destructive` **从未定义**（只有 `--b3-theme-error`）；`--b3-theme-secondary` 只在 `kit/theme.ts` 的兜底主题里有值、思源宿主不提供 ⇒ `secondary` 类语义走 surface/on-surface/border 中性族
- **Token 短名制**（`$s-px6`/`$t-xs`/`$r-base`/`$c-*`/`$ff-*`/`$fw-*`/`$lh-*`），旧长名已移除、无别名；映射表 `docs/token-shorthand.md`

## 组件库外迁（已交付）
- 交付文档 `src/components/docs/components-vue3-migration-guide.md`；**零业务耦合**：`src/components/**` 内 0 处 i18n / plugin / siyuan / store / `@/features`
- 目录外必带 3 项：`src/_variables.scss`、`src/config/icons.ts`、图标离线预加载 `addCollection(mdiIcons)`（不调则转请求 CDN，断网全空白且**不报错**）；别名 `@` → `src` 必须配（同样作用于 Sass `@use`）；**两个 `*-rgb` 变量必须逗号分隔**（空格分隔会让整条声明失效）

## 硬编码审查（工具与教训）
- 工具 `scripts/audit-hardcode.mjs`（只读；`--dry` 不写盘）+ 配套 `codemod-hardcode-tokens.mjs`（默认干跑、`--write`）、`audit-token-shorthand.mjs`、`verify-token-migration.mjs`；交付 `docs/hardcode-audit.md` + `.data.json`
- **可机械替换的前提是「值即名称」Token 可新增**；语义档位 Token **不能**机械改（`line-height` 实际 1.4/1.6/1.7、`transition-duration` 实际 0.15/0.2/0.3/0.6s）
- **编译通过 ≠ 正确**：Sass 不校验 CSS 属性值合法性（曾生成 `#var(--b3-theme-error)` 58 处却编译全过）⇒ 机械替换后必须抽查产物
- **`@use` 命名空间三坑**：裸 `$token` 只沿 `@forward` 链递归；`@/` 解析要补回 `src/`；已有其他 `as *` 时改用 `@use "@/variables.scss" as g;` + `g.$token`
- `git diff --shortstat` 会因 1.1 MB 的 `docs/hardcode-audit.data.json` 虚报数万行 ⇒ 核对用 `git diff --numstat`
- **样式分离标准动作**：①读 `<style>` 查 `@use` 依赖 ②新建 `styles/<Component>.scss`，首行 `@use "../kit/variables.scss" as *;`（组件库内）或 `@/variables.scss`（feature 内） ③无 Token 的值集中为文件顶部局部变量 + `// 无对应 Token` ④`.vue` 的 `<style>` 只留 `@use` ⑤`npx sass` 编译 + `read_lints` + 扫描器复跑

## 功能模块待办（只留仍可执行的事实）
- **待迁移**：feature 内原生 radio 5 处（`video/CompressDialog`、`wordQuery/WordQueryPanel`、`gitPush` 的 `SettingsDialog`/`CommitFixDialog`/`BatchFixDialog`）；**原生 `<input type="color">` 8 处**（`prompts/CategoryManageModal`、`toolCollection/tools/colorPicker`、`imageCreation/{CoverDecorationSettings,CodeImageTab}`、`superPanel/FeatureCard`、`gitPush/{common/CategoryDialog,CommitAnalysis/AnalysisSettingsForm}`、`generalSettings/TabPinSettings`）；`ReviewRadarChart` 未迁到 `Chart`
- **gitPush**：行数口径 = 工作区存量（`git ls-files` + 逐文件 `readFileSync`，排行与条形都取存量 ⇒ 改条数看不出差别）；失败明细 `fetchFailures`（kind 由 `classifyFetchFailure` 分类）→ `lineStatsCache.failures`；多本地路径 `resolveValidPath`；提交规则 14 条经 `readCommitRuleConfig(prefs)` 单一入口；⚠️ `styles/` 目录树计数与 `common/` 清单属历史欠账，改该文件时计数一律实测
- **gitPush 失败真因**：①路径不存在（多设备未配 `localPaths`）②`not a git repository` ③**空仓库 `git log` 退出码非 0**（合法空数据被当失败）④超时（本地命令走 60s 本地池，"调大网络超时"无效）⑤`spawn git ENOENT` ⑥dubious ownership（`safe.directory`）⑦`index.lock` 残留 ⑧大仓库全量 `git log --numstat` 逼近 10MB `maxBuffer`（可能报成「超时」）
- 其余模块细节见各自 `src/features/<name>/README.md` 与当日日志
