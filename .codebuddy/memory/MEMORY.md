# 项目记忆（siyuanPluginVueSN）

> 2026-09-14（第 12 次压缩，去重 + 指向化）。**组件级细节一律不抄**，查 `AGENTS*.md` / `componentPreview/README.md` / `docs/*.md` / `src/features/<name>/README.md`。**前 4 节是高价值防回归要点，末尾可丢。**

## 1. 环境与边界
- AI **禁止** `pnpm vite build` / `pnpm lint`（C# 项目禁 `dotnet build`）；可执行 `read_lints`、`pnpm typecheck`（= vue-tsc，**禁 `npx tsc --noEmit`**）、`pnpm i18n:merge|verify`、`pnpm validate:icons`
- ⛔ **禁止新建临时校验脚本**（`.tmp-*.mjs` 等一次性脚本，含「离线编译 SCSS 校验 Token」）。验证只走 `read_lints` + 上述既有命令；SCSS 编译 / `lint` / `build` 由用户执行。需要可复用检查就在 `scripts/` 正式命名落地并登记（规则已入 `AGENTS.md` 验证链条 + `AGENTS_BUILD.md § 构建与验证`）
- **四道验证各查不同问题**：`read_lints` 只查规范（偶有陈旧诊断须回读代码核对）；`vue-tsc` 查 TS 与 `.vue` props 类型（`tsc` 不解析 `.vue`，既报假错又漏真错）；`vite build` 才查 MISSING_EXPORT。2026-09-14 实测 `pnpm typecheck` 全仓库 0 error
- pnpm 12：`pnpm-workspace.yaml` 的 `allowBuilds` 必须保留；依赖损坏先扫 `.pnpm/*/node_modules/<pkg>` 是否缺 `package.json`，修复一律 `pnpm install --force`（手删会跟随 junction 删掉真包）
- IDE **拦截**未带 `-Encoding` 的 PowerShell `Get-Content` ⇒ 读内容/统计行数用工具或 `node -e "…fs.readFileSync…"`（可顺带统计 ts/vue 行数核对 500 行阈值、查行尾符、离线编译带 `@/` 别名的 SCSS〔内置 dart-sass + 自定义 importer，`@/variables.scss` 需 `_` 前缀回退〕）
- `types/index.ts` 是**显式导出清单**（值 export / type export 两块）⇒ 新增类型或常量须两处登记，否则消费方 TS2305
- 快捷键查重必须**递归**搜 `src/features/**`；已知未修冲突：`tableOfContents` 与 `ideaGenerator` 同为 ⌃⌥I
- ⚠️ **`replace_in_file` 在 CRLF 文件上的静默失效**：old_str 用 `\n` 处理「尾部空行」会报 success 但 0 lines changed ⇒ 改文件尾部用 node `s.replace(/[\r\n]+$/,'\r\n')`；怀疑未生效先 `JSON.stringify(s.slice(-30))` 看行尾符（同批其他编辑仍正常落地，别误判为整体失败）

## 2. 反回归提醒（勿重提 / 勿“顺手修”）
- `Button.isIconOnly` 的陈旧 computed 属**有意保留**；`Slider` 焦点环 `rgba(hsl(...), 0.2)` 是非法 CSS 但全项目 60+ 处同写法 ⇒ 勿单独「修正」；`Input` 的 `type="textarea"` 按用户决定保留为兼容入口
- `ToggleButton`：给 `--severity-*` 会污染 `--outlined` 取色 ⇒ 未按下不传 severity；无文案时**不能传默认插槽**（否则 `$slots.default` 恒真毁 `isIconOnly`）
- `Message`：`severity` 照搬 PrimeVue（`warn`/`error`/`contrast`），**与 `Button.severity` 有意不统一**；关闭插槽叫 `closebutton`；`close` 只通报、**组件不自动隐藏**
- ⚠️ 覆写共享 `Button` 尺寸两颗雷：①档位类自带 `min-height: 28/36/44px` 会反过来定高 ⇒ 必须同时写 `min-height: 0`；②`--button-size` 只在 `isIconOnly` 为真时生效。选中态做不到（ghost hover 特异性 (0,5,0)）⇒ 用 `variant="primary" + :outlined`
- ⚠️ **恒传插槽出口 = 给子组件造出「恒真的默认插槽」**：`<Button><slot name="x"/></Button>` 使 `$slots.default` 恒真、`isIconOnly` 退化为假 ⇒ 必须 `<template v-if="$slots.x" #default>` **条件转发**（`FileList.vue` 的 `fileremoveicon` 曾因此回归）；`FileUpload.scss` 的 `.si-fileupload__remove` 尺寸锁自有类属已修，勿回退
- ⚠️ **共享弹层不用 Teleport**（就地 `position: fixed` + 遮罩 `inset: 0`）⇒ **任何带 transform / filter / contain 的祖先都会成为包含块，把弹层关进容器并裁剪**（toolCollection 面板曾因 `translateX(-50%)` + `contain: layout paint` 出错，2026-09-14 已修，勿回退）
- ⚠️ **弹层遮罩点关判定（`overlay/useOverlay.ts`，已修，勿回退）**：必须比对 `event.target === event.currentTarget`。只比「按下目标 === 抬起目标」会把弹层内任意点击判成点遮罩 ⇒ ① `dismissableMask` 的 `Dialog` 点进表单第一下即关；② `ConfirmDialog` 确认按钮**先**触发 cancel（清掉调用方状态）再 confirm ⇒ 确认回调读到 null 静默不执行（删除曾因此完全失效）
- ⚠️ **工具合集全局键盘导航**：`useToolNavigation.handleKeydown` 已排除输入类元素，弹层还需 `document.querySelector('[aria-modal="true"]')` 命中即 return（只拦真模态：`Dialog` 非模态时 `aria-modal="false"`，`ConfirmDialog` 恒 true）

## 3. 库外通用陷阱
- **受控/非受控标准写法**：可选 prop **不给默认值**，用 `props.x === undefined` 判定（`SpeedDial.visible` / `Panel.collapsed` 先例）
- ⚠️ **共享 `Select` / `Input` 是纯受控组件**（内部只 emit，显示完全取自 `props.modelValue`）：`:model-value` + `@update:model-value` 时**必须在 handler 内回写**，否则选中后文案与勾选态停在旧值。迁移 `Select` 时 handler 要**先写 ref 再比对**（原 `@change` 依赖 v-model 已写回），载荷为 `string|number|boolean|null`；迁移 `Tabs` 五件套**必须 `lazy`**
- ⚠️ **`v-if` 在两种控件间切换必须手动移交焦点**：新控件不自动获焦，用户敲键盘**静默落空**；叠加「留空即回落默认值」的静默兜底 ⇒ 表现为「新建 XX 没效果」。修法 `await nextTick()` 后调子组件 `focus()`（`Input`/`Button` 均 `defineExpose({ focus })`），并对用户的显式选择给就地校验而非静默回落
- **Vue 的 `slots` 不是响应式** ⇒ 判断写在**模板里**才稳
- ⚠️ **单例 Manager 的数据源不响应式**：`new XxxManager()` 存模块级变量 + `computed(() => manager.getList())` ⇒ **永久缓存**，增删改后 UI 不动（shortcut 曾如此）。修法：视图层 `ref` 镜像 + 变更后 `refresh()`，computed 只读该 ref（同 gitPush `useProjectCrud.loadProjects()`）
- **scoped 三个反直觉点**：①父 scope 只加在「模板里直接写」的子组件根元素上且只对单根生效；②**经插槽传入的子组件带调用方 scope** ⇒ 须 `> :deep(.子组件)`；③**类名写在另一个兄弟组件的 scss 里 = 没写**
- **覆写共享组件内部样式必须算特异性**：组件自身 scoped 是 (0,2,0) ⇒ 类名写两遍或嵌套自有根类 =(0,3,0)；档位/变体写 `.si-xxx--tier &`
- **i18n 类型用「键清单派生」**（`as const` + `keyof typeof`）；**i18n 键是全局扁平命名空间** ⇒ 通用词易撞名，加语义前缀（错误码统一 `err`）；**删键有跨模块风险**（如 `favorite` 被 minimalBrowser 用）⇒ 宁可留键不删
- ⚠️ **i18n 分片与合并产物**：运行时读到的是 `src/i18n/{zh_CN,en_US}.json`（`pnpm i18n:merge` 产物，构建/dev 会再生）。只改分片（`src/i18n/<lang>/<feature>.json`）而不 merge ⇒ 合并文件缺新键、`i18n:verify` 也不反映；**改完分片必须跑一次 `pnpm i18n:merge` 再 verify**（2026-09-14 实测：合并后才从 4487 → 4494）
- 新增遵循既有模式的模块时先 `search_content '^export const'` 对齐同目录**导出清单**；非 deep watch 对原地 splice 不触发 ⇒ 返回全新数组；组件内常量被 composable 运行时引用要拆 `types/xxx.ts`（放 `types/index.ts` 会与 `index.vue` 循环）
- **`@use` 命名空间坑**：裸 `$token` 只沿 `@forward` 链递归；`@/` 解析要补回 `src/`；已有其他 `as *` 时改用 `@use "@/variables.scss" as g;` + `g.$token`
- **写 JS 扫描脚本的两个静默陷阱**：①对象字面量 `{ line: i + 1, line }` 后者覆盖前者；②用 `m[0]`（含引号）做前缀判定会让规则**整体零命中**。改脚本后必须复扫或回读源码验证

## 4. Token 与相邻色
- `--b3-theme-surface`(#f7f7f5) 与 `--b3-theme-background`(#ffffff) 仅差 ~3% 灰度 ⇒ **不能画需区分的细线**，分隔一律 `--b3-border-color`
- `--b3-theme-destructive` **从未定义**（只有 `--b3-theme-error`）；`--b3-theme-secondary` 只在 `kit/theme.ts` 兜底主题里有值 ⇒ `secondary` 语义走 surface/on-surface/border 中性族
- **Token 短名制**（`$s-px6`/`$t-xs`/`$r-base`/`$c-*`/`$ff-*`/`$fw-*`/`$lh-*`），旧长名已移除、无别名；映射表 `docs/token-shorthand.md`。`$c-success|danger|warning` 在 `kit/variables.scss`、经 `@/variables.scss` 可达 ⇒ 半透明语义色写 `rgba($c-*, α)`，别写 `hsl(...)` 字面量

## 5. 共享组件库（计数必须实测）
- 2026-09-12 实测：**48 公开组件 / 56 个 `styles/*.scss` / 19 个小写起始目录 / 33 个 `previewData/*.ts` / 递归 160 文件**（并行会话随时加组件，用前重数）
- 私有子部件/纯函数放同名小写目录（`confirm`/`overlay`/`select`/`tabs`/`tooltip`…），不计入清单、禁止 feature 直接导入
- 新增公开组件四件套：文件功能注释 + `import "./kit/theme"` 副作用 + 样式外置（`<style scoped>` 只 `@use` 一份 scss）+ **内部只用相对路径**（库要能整目录外迁；`@/utils/*` 是既有例外）。组件内定时器**不用** `@/utils/timerRegistry`，用原生定时器 + 卸载清理
- 文档同步面：`AGENTS.md`（4 处总数 + 清单表行 + 复用清单 + 目录树）、`componentPreview/README.md`、`kit/README.md`、`kit/theme.ts` 头注释、根 `README.md`、迁移指南。⚠️ 陈旧数字常**埋在表格单元格中间** ⇒ 用 `\d+ 个` 全量搜，收尾必须复扫（并行会话各改一半会造出「头部 48 / 行内 47」）
- 预览面板详解见 `componentPreview/README.md`；内存排查见 `docs/component-preview-memory-diagnosis.md`。口诀：**共享 `index.scss` 只由根 `index.vue` 引入一次**；**编辑前重读文件**

## 6. 可复用的模式（模板）
- **模块级错误码模式**（s3Backup 建立）：模块层零文案依赖，只抛 `BackupError`（`code` + 不含文案的 detail）；视图层出口统一映射 ⇒ **别往模块层注入 i18n**（gitPush 亦同：`getFileDiff` 失败只返回空串，空态/加载态由弹窗经 i18n 呈现）
- **分层落位**：纯函数全在 `utils.ts`（2 文件以上共用才提取）；依赖单例的持久化放 `instance.ts`；常量/类型在 `types/`；面板壳专属样式放 `styles/<Shell>.scss`（放共享 `index.scss` 会被多组件各输出一份），嵌套自有根类顺带把特异性抬到 (0,3,0)
- ⚠️ **`utils.ts` 超 500 行的标准拆法**：拆为 `utils/` 目录（按域分模块）+ **显式汇聚的 `utils/index.ts`**，导出面与拆分前逐条对齐 ⇒ 所有消费方 `"../utils"` **import 零改动**（`vue-tsc` 的 TS2305 会兜住漏导出）；**必须删除原 `utils.ts`**（文件与目录同名时优先命中文件）。Manager 类同理：把纯文本解析抽到 `utils/gitOutput.ts`，类内只留 execGit 调用。规则已入 `AGENTS.md` 分层表 + `AGENTS_ARCH.md § 单文件行数上限 → 常用拆分模式`
- **模块层零文案的落法（FE_STATUS_META 范式）**：元数据只存 `titleKey`（`Record<FileChangeStatus, { icon, titleKey }>`，键集完整性由类型保证），文案统一经 `utils/fileStatus.ts` 的 `fileStatusText(file, i18n)` / `fileStatusTitle(file, i18n)` 在视图层解析；**AI 提示词不参与 i18n** ⇒ 里面写机器可读 id（如 `f.status`）而非展示文案
- **同键同构的旁路状态**：缓存在 `Record<string, T>` 时，其「在途/加载」标记也做成 `Record<string, boolean>` 并用同一 key 生成器（gitPush `fileDiffs` + `diffLoading` + `utils.diffCacheKey`）⇒ 命中缓存不亮加载态、`finally` 删除不泄漏
- **多份数据源切换**（gitPush 差异范围）：可切换的维度落成可选字段（`FileChange.unstaged`）+ 视图层 `scope` ref + 缓存键携带维度（`s::`/`u::`），切换时另一维度后台预取

## 7. 组件库外迁（已交付）
- 交付文档 `src/components/docs/components-vue3-migration-guide.md`；**零业务耦合**：`src/components/**` 内 0 处 i18n / plugin / siyuan / store / `@/features`
- 目录外必带：`src/_variables.scss`、`src/config/icons.ts`、图标离线预加载 `addCollection(mdiIcons)`（不调则转请求 CDN，断网全空白且**不报错**）；别名 `@` → `src` 必须配（同样作用于 Sass `@use`）；**两个 `*-rgb` 变量必须逗号分隔**（空格分隔会让整条声明失效）

## 8. 硬编码审查（工具与教训）
- 工具 `scripts/audit-hardcode.mjs`（只读）/ `codemod-hardcode-tokens.mjs`（默认干跑，`--write` 落盘）/ `audit-token-shorthand.mjs` / `verify-token-migration.mjs`；报告 `docs/hardcode-audit.md`
- 机械替换边界：只有「值即名称」Token 可自动改，语义档位 Token 不能（`line-height` 1.4/1.6/1.7、`transition-duration` 0.15/0.2/0.3/0.6s）；**编译通过 ≠ 正确**（Sass 不校验 CSS 值合法性，曾生成 `#var(--b3-theme-error)` 58 处却全过）⇒ 替换后抽查产物
- `git diff --shortstat` 会被 1.1 MB 的 `docs/hardcode-audit.data.json` 虚报数万行 ⇒ 核对用 `--numstat`。**样式分离标准动作**：读 `<style>` 查 `@use` → 新建 `styles/<C>.scss`（首行 `@use "@/variables.scss" as *;`）→ 无 Token 的值集中为文件顶部局部变量 + `// 无对应 Token` → `.vue` 的 `<style>` 只留 `@use` → 编译 + `read_lints` + 扫描器复跑

## 9. 功能模块速查
- **shortcut**：已整体迁入 `src/features/toolCollection/tools/shortcut/`（registry 第 10 个工具，独立 Dock 与 `enableShortcuts` 已摘除；规格与全部 CR-001~CR-009 见 `docs/shortcut-refactor-spec.md`，模块 README 有「内容显示模型」节）。要点：存储键 `plugin-toolCollection-shortcut-custom`（两代迁移 `plugin-shortcuts-custom` → `plugin-shortcuts-all`，逐代命中即停、写新键成功才删旧键）；`ShortcutInfo.keys` 可选（CLI 类条目无原生键位）；显示与复制同源（`resolveShortcutDisplay`）；单例 Manager 必须 `ref` 镜像；迁移工具类的完整清单（git mv + registry + 摘除旧入口 + 删 `@<feature>` 别名 + i18n 分片保留）见当日日志
- **gitPush**：行数口径 = 工作区存量（`git ls-files` + 逐文件 readFileSync）；多本地路径 `resolveValidPath`；提交规则经 `readCommitRuleConfig(prefs)` 单一入口；⚠️ `styles/` 目录树计数与 `common/` 清单属历史欠账，改该文件时计数一律实测。差异弹窗（2026-09-14）：`getFileDiff` 对未跟踪文件用 `git ls-tree HEAD` 判据 + `git diff --no-index -- /dev/null` 兜底（退出码 1 需 `execGit` 的 `allowExitCodes`）；`FileChange.unstaged` 标记两份差异；`utils.diffCacheKey` 统一缓存键；`utils.ts` 已拆为 `utils/`（12 文件 + index.ts 汇聚，最大 `diffText.ts` 206 行）、`WorktreeOps.ts` 的 git 输出解析抽到 `utils/gitOutput.ts`（464 行）；`FILE_STATUS_META` 只存 `titleKey`（文案经 `fileStatusText/fileStatusTitle(file, i18n)`）
- **gitPush 失败真因**：①路径不存在（多设备未配 `localPaths`）②`not a git repository` ③**空仓库 `git log` 退出码非 0** ④超时（本地命令走本地池，“调大网络超时”无效）⑤`spawn git ENOENT` ⑥dubious ownership（`safe.directory`）⑦`index.lock` 残留 ⑧大仓库全量 `git log --numstat` 逼近 10MB `maxBuffer`
- **待迁移**：feature 内原生 radio 5 处（`video/CompressDialog`、`wordQuery/WordQueryPanel`、`gitPush/{SettingsDialog,CommitFixDialog,BatchFixDialog}`）；原生 `<input type="color">` 8 处；原生 `<select>` 30+ 处；`ReviewRadarChart` 未迁到 `Chart`
- **已知超 500 行文件**（未拆）：`gitPush/types/meta.ts` 672（2026-09-14 新发现）、`toolCollection/tools/base64Image/index.vue` 917、`unitConverter/utils/units.ts` 690、`wordQuery/styles/codeUtils.scss` 530。**已达标**：gitPush `utils.ts` 822 → `utils/` 12 文件（最大 206）、`managers/WorktreeOps.ts` 563 → 464
- 其余模块细节见各自 `src/features/<name>/README.md` 与当日日志
