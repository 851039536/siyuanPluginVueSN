# 项目记忆（siyuanPluginVueSN）

> 2026-09-14（第 13 次压缩：去重 + 缩短行，修复超长截断）。**组件级细节一律不抄**，查 `AGENTS*.md` / `componentPreview/README.md` / `docs/*.md` / `src/features/<name>/README.md`。§1–4 为高价值防回归要点。

## 1. 环境与边界
- AI 禁 `pnpm vite build` / `pnpm lint`（C# 项目禁 `dotnet build`）；可跑 `read_lints`、`pnpm typecheck`（= vue-tsc，**禁 `npx tsc --noEmit`**）、`pnpm i18n:merge|verify`、`pnpm validate:icons`
- ⛔ 禁建临时校验脚本（`.tmp-*.mjs`，含「离线编译 SCSS 校验 Token」）；需可复用检查就落 `scripts/` 正式命名并登记
- 四道验证各管一段：`read_lints` 查规范（偶有陈旧诊断，须回读代码核对）；`vue-tsc` 查 TS 与 `.vue` props（`tsc` 不解析 `.vue`，既报假错又漏真错）；`vite build` 才查 MISSING_EXPORT
- pnpm 12：保留 `pnpm-workspace.yaml` 的 `allowBuilds`；依赖损坏先扫 `.pnpm/*/node_modules/<pkg>` 是否缺 `package.json`，修复一律 `pnpm install --force`
- IDE 拦未带 `-Encoding` 的 `Get-Content` ⇒ 读文件/统计行数用工具或 `node -e`
- `types/index.ts` 是显式导出清单（值 / type 两块）⇒ 新增须两处登记，否则消费方 TS2305
- 快捷键查重须递归搜 `src/features/**`；已知未修冲突：`tableOfContents` 与 `ideaGenerator` 同为 ⌃⌥I
- ⚠️ `replace_in_file` 在 CRLF 文件上改「尾部空行」静默失效（报 success 但 0 行）⇒ 用 node `s.replace(/[\r\n]+$/,'\r\n')`；怀疑未生效先 `JSON.stringify(s.slice(-30))` 看行尾符

## 2. 反回归（勿重提 / 勿顺手修）
- `Button.isIconOnly` 陈旧 computed、`Slider` 焦点环 `rgba(hsl(...),0.2)`（全项目 60+ 处同写法）、`Input` 的 `type="textarea"` ⇒ **均有意保留，勿改**
- `ToggleButton`：传 `--severity-*` 污染 `--outlined` 取色 ⇒ 未按下不传 severity；无文案时不能传默认插槽（`$slots.default` 恒真毁 `isIconOnly`）
- `Message`：severity 照搬 PrimeVue（`warn`/`error`/`contrast`）、关闭插槽叫 `closebutton`、`close` 只通报不自动隐藏 ⇒ 与 `Button.severity` 有意不统一
- ⚠️ 覆写共享 `Button` 尺寸：档位类 `min-height: 28/36/44px` 会反向定高（须同写 `min-height: 0`）；`--button-size` 仅 `isIconOnly` 生效；选中态用 `variant="primary" + :outlined`
- ⚠️ 恒传插槽出口会造出「恒真默认插槽」⇒ 须 `<template v-if="$slots.x" #default>` 条件转发
- ⚠️ 共享弹层不用 Teleport（就地 `fixed` + 遮罩 `inset:0`）⇒ 带 transform/filter/contain 的祖先会成为包含块把弹层裁剪
- ⚠️ 遮罩点关判定（`overlay/useOverlay.ts`）必须 `event.target === event.currentTarget`；否则 `Dialog` 点进表单第一下即关、`ConfirmDialog` 先 cancel 再 confirm ⇒ 确认回调读 null 静默失效
- ⚠️ 工具合集键盘导航需排除输入类元素，且 `[aria-modal="true"]` 命中即 return

## 3. 库外通用陷阱
- 受控/非受控：可选 prop **不给默认值**，用 `props.x === undefined` 判定（`SpeedDial.visible` / `Panel.collapsed` 先例）
- ⚠️ 共享 `Select`/`Input` 是纯受控组件（显示全取 `props.modelValue`）⇒ handler 内必须回写 ref；载荷 `string|number|boolean|null`；迁 `Tabs` 必须 `lazy`
- ⚠️ `v-if` 在两种控件间切换必须手动移交焦点（`await nextTick()` 后调子组件 `focus()`），否则用户敲键盘静默落空
- Vue 的 `slots` 不响应式 ⇒ 判断写在模板里才稳
- ⚠️ 单例 Manager 数据源不响应式（模块级实例 + `computed(manager.getList())` ⇒ 永久缓存）⇒ 视图层 `ref` 镜像 + 变更后 `refresh()`
- scoped 三反直觉：①父 scope 只加在模板里直接写的单根子组件上；②经插槽传入的子组件带调用方 scope（须 `> :deep(.子)`）；③类名写在兄弟组件的 scss 里 = 没写
- 覆写共享组件样式必须算特异性：组件自身 scoped 是 (0,2,0) ⇒ 类名写两遍或嵌自有根类 =(0,3,0)
- i18n 键是全局扁平命名空间 ⇒ 加语义前缀防撞名；删键有跨模块风险 ⇒ 宁留不删；类型用键清单派生（`as const` + `keyof typeof`）
- ⚠️ i18n 分片 vs 合并产物：运行时读 `src/i18n/{zh_CN,en_US}.json`（merge 产物）⇒ **改完分片必须 `pnpm i18n:merge` 再 `verify`**
- `@use`：裸 `$token` 只沿 `@forward` 链递归；`@/` 解析要补回 `src/`；已有 `as *` 时用 `@use "@/variables.scss" as g;` + `g.$token`
- 写 JS 扫描脚本两陷阱：①`{ line: i+1, line }` 后者覆盖前者；②用 `m[0]`（含引号）做前缀判定 ⇒ 规则整体零命中；改完必须复扫验证
- 组件内常量被 composable 运行时引用要拆独立 `types/xxx.ts`（放 `types/index.ts` 会循环）；非 deep watch 对原地 splice 不触发 ⇒ 返回新数组

## 4. Token 与相邻色
- `--b3-theme-surface`(#f7f7f5) 与 `--b3-theme-background`(#fff) 仅差 ~3% 灰度 ⇒ 不能画需区分的细线，分隔一律 `--b3-border-color`
- `--b3-theme-destructive` 从未定义（只有 `--b3-theme-error`）；`--b3-theme-secondary` 只在 `kit/theme.ts` 兜底主题有值 ⇒ secondary 走 surface/on-surface/border 中性族
- Token 短名制（`$s-px6`/`$t-xs`/`$r-base`/`$c-*`/`$ff-*`/`$fw-*`/`$lh-*`），旧长名已移除、无别名；映射表 `docs/token-shorthand.md`；半透明语义色写 `rgba($c-*, α)`

## 5. 共享组件库（计数用前重数）
- 2026-09-12 实测：48 公开组件 / 56 `styles/*.scss` / 19 小写起始目录 / 33 `previewData/*.ts` / 递归 160 文件
- 私有子部件放同名小写目录（`confirm`/`overlay`/`select`/`tabs`/`tooltip`…），不计清单、禁 feature 直接导入
- 新增公开组件四件套：文件功能注释 + `import "./kit/theme"` 副作用 + 样式外置 + 内部只用相对路径；组件内定时器用原生 + 卸载清理（不用 `timerRegistry`）
- 文档同步面：`AGENTS.md`（总数 + 清单表 + 复用清单 + 目录树）、`componentPreview/README.md`、`kit/README.md`、`kit/theme.ts` 头注释、根 `README.md`、迁移指南；陈旧数字常埋在表格单元格 ⇒ 收尾用 `\d+ 个` 复扫
- 口诀：共享 `index.scss` 只由根 `index.vue` 引入一次；编辑前重读文件

## 6. 可复用模式
- **模块级错误码**（s3Backup 立）：模块层零文案，只抛 `XxxError`（code + 无文案 detail），视图层统一映射 ⇒ 别往模块层注入 i18n（gitPush `getFileDiff` 失败返回空串同理）
- **分层落位**：纯函数在 `utils.ts`（2 文件以上共用才提取）；依赖单例的持久化放 `instance.ts`；常量/类型在 `types/`；面板壳样式放 `styles/<Shell>.scss`
- ⚠️ `utils.ts` 超 500 行标准拆法：拆 `utils/` 目录 + 显式汇聚 `utils/index.ts`（导出面逐条对齐 ⇒ 消费方 import 零改动），**必须删原 `utils.ts`**；见 `AGENTS_ARCH.md § 单文件行数上限`
- **模块层零文案落法**（FE_STATUS_META）：元数据只存 `titleKey`，文案经 `utils/fileStatus.ts` 在视图层解析；AI 提示词不参与 i18n ⇒ 写机器可读 id
- **同键同构旁路状态**：缓存 `Record<string, T>` 时其加载标记做 `Record<string, boolean>` + 同一 key 生成器（gitPush `fileDiffs` + `diffLoading` + `diffCacheKey`）
- **多数据源切换**：可切换维度落成可选字段（`FileChange.unstaged`）+ 视图层 scope ref + 缓存键携带维度（`s::`/`u::`），切换时另一维度后台预取

## 7. 外迁与工具（已交付，细节查文档）
- 组件库外迁：文档 `src/components/docs/components-vue3-migration-guide.md`，零业务耦合；外迁必带 `src/_variables.scss`、`src/config/icons.ts`、图标预加载 `addCollection(mdiIcons)`（不调则转 CDN，断网全空白且不报错）；别名 `@`→`src` 必须配；两个 `*-rgb` 变量必须逗号分隔
- 硬编码工具：`scripts/audit-hardcode.mjs`（只读）/ `codemod-hardcode-tokens.mjs`（默认干跑，`--write` 落盘）/ `audit-token-shorthand.mjs` / `verify-token-migration.mjs`；报告 `docs/hardcode-audit.md`。只有「值即名称」Token 可机械改；**编译通过 ≠ 正确**（Sass 不校验 CSS 值，曾生成 `#var(--b3-theme-error)` 58 处全过）；`git diff --shortstat` 被 1.1MB 数据文件虚报 ⇒ 用 `--numstat`

## 8. 模块速查
- **gitPush**：行数口径 = 工作区存量；多本地路径 `resolveValidPath`；提交规则经 `readCommitRuleConfig(prefs)`；`styles/` 计数与 `common/` 清单属历史欠账，一律实测。差异弹窗：未跟踪文件用 `git ls-tree HEAD` 判据 + `git diff --no-index` 兜底（退出码 1 走 `allowExitCodes`）；`FileChange.unstaged` 标记两份差异；`utils.diffCacheKey` 统一缓存键；`utils.ts` 已拆 `utils/`（12 文件 + index.ts，最大 206 行）；`WorktreeOps.ts` 464 行，git 输出解析在 `utils/gitOutput.ts`；`discardFile` staged 分支按 `isFileInHead` 分流（新增类 reset 后 `clean -f`）；工作区面板自动同步：`window focus` + 面板 `pointerdown` → `refreshWorkingTree`（防抖 800ms、2s 最小间隔去重、`gitOpLoading`/`refreshingWorkingTree` 期间跳过，TimerRegistry 托管；**不用 panel focusin** —— Electron 切回窗口时 DOM 焦点未变，点非聚焦区域也不触发）；MM 文件行渲染 `.wt-partial-mark` 且 `.partially-staged` 覆盖 `.staged` 的 `opacity: 0.5`（否则标记连带被压暗）
- **gitPush 失败真因**：①路径不存在（多设备未配 `localPaths`）②`not a git repository` ③空仓库 `git log` 退出码非 0 ④超时（本地命令走本地池）⑤`spawn git ENOENT` ⑥dubious ownership ⑦`index.lock` 残留 ⑧大仓库 `git log --numstat` 逼近 10MB maxBuffer
- **共享控件迁移（2026-09-14 gitPush/ListView 完成）**：`Button` 新增 `dense`（仅与 `size="xsmall"` 协同）；覆写共享组件统一抬 (0,3,0)～(0,4,0)（padding/圆角须 (0,4,0)）；`Dialog` 用 header 插槽须把 `headerId` 打到标题元素；删 `import { Icon }` 前必须 grep 模板 `<Icon`（残留时 lint 与 typecheck 都不报）。报告 `docs/gitPush-listview-controls-review.md`
- **shortcut**：已迁入 `toolCollection/tools/shortcut/`（独立 Dock 已摘除；规格 `docs/shortcut-refactor-spec.md`）；存储键 `plugin-toolCollection-shortcut-custom`；单例 Manager 必须 `ref` 镜像
- **待迁移**：feature 内原生 radio 5 处、`input[type=color]` 8 处、`<select>` 30+ 处、`ReviewRadarChart` 未迁 `Chart`
- **超 500 行未拆**：`gitPush/types/meta.ts` 672、`toolCollection/tools/base64Image/index.vue` 917、`unitConverter/utils/units.ts` 690、`wordQuery/styles/codeUtils.scss` 530
- 其余细节见各模块 `README.md` 与当日日志
