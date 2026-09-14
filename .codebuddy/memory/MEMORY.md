# 项目记忆（siyuanPluginVueSN）

> 2026-09-14（第 11 次压缩）。组件级细节不抄写，指向 `AGENTS*.md` / `componentPreview/README.md` / `docs/*.md`。**按价值排序**：前 4 节是规范外经验与防回归要点，末尾几节可丢。

## 1. 环境与边界
- AI **禁止** `pnpm vite build` / `pnpm lint`（C# 项目禁 `dotnet build`）；可执行 `read_lints`、`pnpm typecheck`（= vue-tsc，**禁 `npx tsc --noEmit`**）、`pnpm i18n:merge|verify`、`pnpm validate:icons`
- **四道验证各查不同问题**：`read_lints` 只查规范（偶有陈旧诊断须回读代码核对）；`vue-tsc` 查 TS 与 `.vue` props 类型（`tsc` 不解析 `.vue`，既报假错又漏真错）；`vite build` 才查 MISSING_EXPORT。2026-09-14 实测 `pnpm typecheck` 全仓库 **0 error**
- pnpm 12：`pnpm-workspace.yaml` 的 `allowBuilds` 必须保留，否则 install 报错；依赖损坏先扫 `.pnpm/*/node_modules/<pkg>` 是否缺 `package.json`，修复一律 `pnpm install --force`（手删会跟随 junction 删掉真包）
- IDE **拦截**未带 `-Encoding` 的 PowerShell `Get-Content` ⇒ 读内容/统计行数用工具或 `node -e "…fs.readFileSync…"`（可用 `node -e` 完成：统计 ts/vue 行数核对 500 行阈值、查行尾符、量体积、**离线编译带 `@/` 别名的 SCSS**〔项目内置 dart-sass + 自定义 importer，`@/variables.scss` 需 `_` 前缀回退〕）
- `types/index.ts` 是**显式导出清单**（值 export / type export 两块）⇒ 新增类型或常量须两处登记，否则消费方 TS2305
- 快捷键查重必须**递归**搜 `src/features/**`；已知未修冲突：`tableOfContents` 与 `ideaGenerator` 同为 ⌃⌥I
- ⚠️ **`replace_in_file` 在 CRLF 文件上的静默失效**：old_str 用 `\n` 处理「尾部空行」会报 success 但 0 lines changed ⇒ 改文件尾部用 node `s.replace(/[\r\n]+$/,'\r\n')`；怀疑未生效先 `JSON.stringify(s.slice(-30))` 看行尾符（同批其他编辑仍正常落地，别误判为整体失败）

## 2. 反回归提醒（勿重提 / 勿“顺手修”）
- `Button.isIconOnly` 的陈旧 computed 属**有意保留**
- `Slider` 焦点环 fallback `rgba(hsl(...), 0.2)` 是**非法 CSS**，全项目 60+ 处同写法 ⇒ 勿单独「修正」
- `Input` 的 `type="textarea"` 按用户决定**保留为兼容入口**
- `ToggleButton`：给 `--severity-*` 会污染 `--outlined` 取色 ⇒ 未按下不传 severity；无文案时**不能传默认插槽**（否则 `$slots.default` 恒真毁 `isIconOnly`）
- `Message`：`severity` 照搬 PrimeVue（`warn`/`error`/`contrast`），**与 `Button.severity` 有意不统一**；关闭插槽叫 `closebutton`（非官方 `closeicon`）；`close` 只通报、**组件不自动隐藏**
- ⚠️ 覆写共享 `Button` 尺寸有**两颗雷**：①档位类自带的 `min-height: 28/36/44px` 会反过来决定高度 ⇒ 必须同时写 `min-height: 0`；②`--button-size` 只在 Button **无默认插槽**（`isIconOnly` 为真）时生效 ⇒ 尺寸锁在自有类上最稳
- ⚠️ **恒传插槽出口 = 给子组件造出「恒真的默认插槽」**：`<Button><slot name="x"/></Button>` 使 `$slots.default` 恒真、`isIconOnly` 退化为假 ⇒ 必须 `<template v-if="$slots.x" #default>` **条件转发**（`FileList.vue` 的 `fileremoveicon` 曾因此回归）
- `FileUpload.scss` 的 `.si-fileupload__remove` 尺寸锁自有类（不依赖 `si-button--icon-only`）+ 清 `min-height`，属已修，勿回退

## 3. 库外通用陷阱
- **受控/非受控标准写法**：可选 prop **不给默认值**，用 `props.x === undefined` 判定（`SpeedDial.visible` / `Panel.collapsed` 先例），两种模式都照常 emit
- **Vue 的 `slots` 不是响应式**：`instance.slots` 原地赋值 ⇒ 判断写在**模板里**才稳
- ⚠️ **单例 Manager 的数据源不响应式**：`new XxxManager()` 存模块级变量时，面板写 `computed(() => manager.getList())` 会**永久缓存**（无任何响应式依赖）⇒ 增删改后 UI 不动、看着像“点击没反应”（`features/shortcut` 曾如此）。修法：视图层留 `ref` 镜像 + 变更后 `refresh()`，computed 只读该 ref，不直接读 Manager（同 gitPush `useProjectCrud.loadProjects()` 模式）
- **scoped 三个反直觉点**：①父 scope 只加在「模板里直接写」的子组件根元素上且只对单根生效；②**经插槽传入的子组件带的是调用方 scope** ⇒ 容器写 `.容器 > .子组件` 永不匹配，须 `> :deep(.子组件)`；③**一个组件用到的类名写在另一个兄弟组件的 scss 里 = 没写**（s3Backup 的 `.empty-state` / `.section-header-actions` 就是这样变成无样式死类的）
- **覆写共享组件内部样式必须算特异性**：组件自身 scoped 是 (0,2,0) ⇒ **类名写两遍**或嵌套在自有根类下 =(0,3,0)；SCSS 档位/变体写 `.si-xxx--tier &`
- **i18n 类型用「键清单派生」**（`const XX_KEYS = {...} as const` + `keyof typeof`）；写成 `xxx?: string` 会让所有消费点报 TS2322
- **i18n 键是全局扁平命名空间**（分片合并后）：通用词（`dataEmpty`）易撞名 ⇒ 加语义前缀（错误码统一 `err` 前缀）
- 新增遵循既有模式的模块时先 `search_content '^export const'` 对齐同目录**导出清单**；非 deep watch 对原地 splice 不触发 ⇒ 返回全新数组；组件内常量被 composable 运行时引用要拆 `types/xxx.ts`（放 `types/index.ts` 会与 `index.vue` 循环）
- **`@use` 命名空间坑**：裸 `$token` 只沿 `@forward` 链递归；`@/` 解析要补回 `src/`；已有其他 `as *` 时改用 `@use "@/variables.scss" as g;` + `g.$token`
- **写 JS 扫描脚本的两个静默陷阱**：①对象字面量 `{ line: i + 1, line }` 后者覆盖前者 ⇒ 无任何报错；②用 `m[0]`（含首尾引号）做前缀判定会让规则**整体零命中**。改脚本后必须复扫或回读源码验证

## 4. Token 与相邻色
- `--b3-theme-surface`(#f7f7f5) 与 `--b3-theme-background`(#ffffff) 仅差 ~3% 灰度 ⇒ **不能画需区分的细线**，分隔一律 `--b3-border-color`
- `--b3-theme-destructive` **从未定义**（只有 `--b3-theme-error`）；`--b3-theme-secondary` 只在 `kit/theme.ts` 的兜底主题里有值 ⇒ `secondary` 类语义走 surface/on-surface/border 中性族
- **Token 短名制**（`$s-px6`/`$t-xs`/`$r-base`/`$c-*`/`$ff-*`/`$fw-*`/`$lh-*`），旧长名已移除、无别名；映射表 `docs/token-shorthand.md`。`$c-success`/`$c-danger`/`$c-warning` 定义在 `src/components/kit/variables.scss`、经 `@/variables.scss` 可达 ⇒ **半透明语义色写 `rgba($c-*, α)`**，别写 `hsl(...)` 字面量

## 5. 共享组件库（计数必须实测）
- 2026-09-12 实测：**48 公开组件 / 56 个 `styles/*.scss` / 19 个小写起始目录 / 33 个 `previewData/*.ts` / 递归 160 文件**（并行会话随时加组件，用前必须重数）
- 私有子部件/纯函数放同名小写目录（`confirm`/`overlay`/`select`/`tabs`/`tooltip` 等），不计入清单、禁止 feature 直接导入
- 新增公开组件四件套：文件功能注释 + `import "./kit/theme"` 副作用 + 样式外置（`<style scoped>` 只 `@use` 一份 scss）+ **内部只用相对路径**（库要能整目录外迁；`@/utils/*` 是既有例外）。组件内定时器**不用** `@/utils/timerRegistry`（那是 feature 侧入口），用原生定时器 + 卸载清理
- 新增组件的文档同步面：`AGENTS.md`（4 处总数 + 清单表行 + 复用清单 + 目录树）、`componentPreview/README.md`、`kit/README.md`、`kit/theme.ts` 头注释、根 `README.md`、迁移指南。⚠️ 陈旧数字常**埋在表格单元格中间**（行内「与全库 N 个组件一致」）⇒ 用 `\d+ 个` 全量搜；并行会话各改一半会造出「头部 48 / 行内 47」，收尾必须复扫
- **预览面板**细节见 `componentPreview/README.md`；内存排查见 `docs/component-preview-memory-diagnosis.md`。口诀：**共享 `index.scss` 只由根 `index.vue` 引入一次**；**新分区/新组件会被并行会话随时塞进来 ⇒ 编辑前重读文件**

## 6. 可复用的模式（模板）
- **模块级错误码模式**（s3Backup 建立）：模块层零文案依赖，只抛 `BackupError`（`code` + 不含文案的 detail）；视图层出口统一 `localizeBackupError(err, i18n)` 映射 `err` 前缀键后拼接 ⇒ **别往模块层注入 i18n**
- **分层落位**：纯函数全在 `utils.ts`（多个文件共用时才提取）；依赖单例的持久化放 `instance.ts`；常量/类型在 `types/index.ts`；面板壳专属样式放 `styles/<Shell>.scss`（放共享 `index.scss` 会被多个组件各重复输出一份），嵌套在自有根类下同时把特异性抬到 (0,3,0)
- ⚠️ 迁移 `Select` 时 `@update:model-value` **必须在处理函数内先写 ref 再比对**（原 `@change` 依赖 v-model 已写回）；其载荷为 `string | number | boolean | null`。迁移 `Tabs` 五件套**必须 `lazy`**，否则未激活面板也进 DOM

## 7. 组件库外迁（已交付）
- 交付文档 `src/components/docs/components-vue3-migration-guide.md`；**零业务耦合**：`src/components/**` 内 0 处 i18n / plugin / siyuan / store / `@/features`
- 目录外必带：`src/_variables.scss`、`src/config/icons.ts`、图标离线预加载 `addCollection(mdiIcons)`（不调则转请求 CDN，断网全空白且**不报错**）；别名 `@` → `src` 必须配（同样作用于 Sass `@use`）；**两个 `*-rgb` 变量必须逗号分隔**（空格分隔会让整条声明失效）

## 8. 硬编码审查（工具与教训）
- 工具 `scripts/audit-hardcode.mjs`（只读）/ `codemod-hardcode-tokens.mjs`（默认干跑，`--write` 落盘）/ `audit-token-shorthand.mjs` / `verify-token-migration.mjs`；报告 `docs/hardcode-audit.md`
- 机械替换的边界：只有「值即名称」Token 可自动改，语义档位 Token 不能（`line-height` 实际 1.4/1.6/1.7、`transition-duration` 0.15/0.2/0.3/0.6s）；**编译通过 ≠ 正确**（Sass 不校验 CSS 值合法性，曾生成 `#var(--b3-theme-error)` 58 处却编译全过）⇒ 替换后必须抽查产物
- `git diff --shortstat` 会被 1.1 MB 的 `docs/hardcode-audit.data.json` 虚报数万行 ⇒ 核对用 `--numstat`。**样式分离标准动作**：读 `<style>` 查 `@use` → 新建 `styles/<C>.scss`（首行 `@use "@/variables.scss" as *;`）→ 无 Token 的值集中为文件顶部局部变量 + `// 无对应 Token` → `.vue` 的 `<style>` 只留 `@use` → 编译 + `read_lints` + 扫描器复跑

## 9. 功能模块速查
- **shortcut**（2026-09-14 完全重构，规格 `docs/shortcut-refactor-spec.md`，含 CR-002 改 2 列）：**2 列卡片网格**（卡片纵向两行：上行按键徽章 + 悬停浮出的操作按钮〔`visibility` 恒定预留空间 ⇒ 零抖动〕，下行名称/平台标签/描述；分组吸顶可折叠）+ **三键分离持久化**（`plugin-shortcuts-custom` 唯一可写；`favorites`/`recent` 独立；旧键 `plugin-shortcuts-all` 仅迁移源，**守卫用新键 `exists()` 含空数组**、写成功才删旧键）+ 导入导出/重置/冲突检测。分层：`utils.ts`/`dataTransfer.ts` 纯函数 → `manager.ts` 双段（预置只读 + 自定义可写，`isPreset` 双层设防）→ `composables/useShortcutData|useShortcutFilter` → `index.vue` 编排（217 行）。
  ⚠️ 两个坑：① 单例 Manager 的 `getPresetIds()`/数组会被 `loadFrom()` 整体替换 ⇒ 视图层必须 `ref` 镜像 + 变更后 `refresh()`，**computed 直接读 Manager 会永久缓存**；② 覆写共享 `Button` 选中态做不到（ghost hover 特异性 (0,5,0)）⇒ 用 `variant="primary" + :outlined`；面板根**不能**写 `container-type`（会毁掉弹层的 fixed 定位）
- **gitPush**：行数口径 = 工作区存量（`git ls-files` + 逐文件 readFileSync）；失败明细 `fetchFailures` → `lineStatsCache.failures`；多本地路径 `resolveValidPath`；提交规则 14 条经 `readCommitRuleConfig(prefs)` 单一入口；⚠️ `styles/` 目录树计数与 `common/` 清单属历史欠账，改该文件时计数一律实测
- **gitPush 失败真因**：①路径不存在（多设备未配 `localPaths`）②`not a git repository` ③**空仓库 `git log` 退出码非 0** ④超时（本地命令走 60s 本地池，“调大网络超时”无效）⑤`spawn git ENOENT` ⑥dubious ownership（`safe.directory`）⑦`index.lock` 残留 ⑧大仓库全量 `git log --numstat` 逼近 10MB `maxBuffer`
- **待迁移**：feature 内原生 radio 5 处（`video/CompressDialog`、`wordQuery/WordQueryPanel`、`gitPush/{SettingsDialog,CommitFixDialog,BatchFixDialog}`）；原生 `<input type="color">` 8 处（`prompts/CategoryManageModal`、`toolCollection/tools/colorPicker`、`imageCreation/{CoverDecorationSettings,CodeImageTab}`、`superPanel/FeatureCard`、`gitPush/{common/CategoryDialog,CommitAnalysis/AnalysisSettingsForm}`、`generalSettings/TabPinSettings`）；原生 `<select>` 30+ 处；`ReviewRadarChart` 未迁到 `Chart`
- 其余模块细节见各自 `src/features/<name>/README.md` 与当日日志
