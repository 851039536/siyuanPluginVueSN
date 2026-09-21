# 全项目硬编码合规审查报告

审查对象：`src/` 全域（1292 个源文件 / 212915 行，含 40+ 功能模块与 `src/components/` 共享组件库）
审查依据：`AGENTS.md`（§ 硬规则、§ 统一入口原则）、`AGENTS_STYLE.md`（§ UI 风格 Codex、§ 强制规则：字号层级与全局基准字号、§ 强制规则：背景与过渡对齐 gitPush 范式、§ 强制规则：Dock 面板侧边栏间距、§ 强制规则：SCSS 必须分离到 styles/ 目录）、`AGENTS_I18N.md`（§ 强制规则：禁止 i18n 硬编码兜底值）、`AGENTS_API.md`（§ 强制规则：AI 调用、§ 定时器）
审查日期：2026-09-11
机器可读基线：`docs/hardcode-audit.data.json`（扫描器：`scripts/audit-hardcode.mjs`，只读、可复跑）

> **行号口径**：本报告全部行号取自上述基线快照。项目存在并行会话改动，落地修复前请以实际文件为准重新定位。
> **复现命令**：`node scripts/audit-hardcode.mjs`（默认写入 `docs/hardcode-audit.data.json`；`--dry` 只扫描不写盘）

---

## 一、结论摘要

| 类别 | 命中数 | 涉及文件 | 严重度分布 | 结论 |
|---|---|---|---|---|
| SCSS 设计 Token | 2633 | 251 | P1 510 / P2 2020 / P3 103 | 面最广、修复收益最高；以「间距/色值/圆角」为主，但存在 **9 个 `.vue` 内联样式块**与 `globalRelations` 整体未 Token 化两处结构性问题 |
| i18n 文案 | 609 | 95 | P1 609 | `wordQuery` 子模块独占 92 处兜底值；`docAnalysis` / `passwordVault` / `video` 模板中文文案成片未走 i18n |
| 业务常量 | 124 | 74 | P1 68 / P2 56 | **无硬编码密钥（P0 = 0）**；主要问题是 62 处裸定时器绕过 `TimerRegistry`、53 处魔法数字（SQL `LIMIT` / 超时 / 分页） |
| 图标与 emoji | 247 | 84 | P1 235 / P2 0 / P3 12 | **232 处图标名未在 `src/config/icons.ts` 注册**（此前从未被发现，属新增风险面）；emoji 当图标仅 3 处 |
| **合计** | **3613** | — | **P0 0 / P1 1422 / P2 2076 / P3 115** | 按例外白名单另排除 1495 处 |

### 三条最关键的结论

1. **不存在硬编码凭据（P0 = 0）**。独立文本搜索交叉验证 `sk-` / `apiKey` / `Bearer` / `secret` 等模式后确认：无泄漏的 API Key 或 token；`src/utils/settingsCrypto.ts` 使用的是运行时 PBKDF2 派生的应用层密钥材料（文件头已声明「防偶然浏览，不防反汇编」），属既定设计，**不应**被当作硬编码密钥「修复」。
2. **最严重的三处结构性问题**（P1，非零散个案）：
   - 9 个 `.vue` 文件共 402 行样式写在 `<style>` 块内，违反「样式必须分离到 `styles/`」强制规则；其中 `formatAssistant/index.vue` 单文件 256 行（且内联样式里另有字号/字重/圆角/间距硬编码，属双重违规）。
   - **232 处图标名未注册**（201 个 `mdi:*` + 31 个 `ph:*`）——它们能正常渲染（MDI / Phosphor 图标集已离线预加载），但绕过了 `icons.ts` 注册体系，属规则明令禁止的「传任意 Iconify 名」。
   - `src/features/globalRelations/styles/index.scss` 单文件犯全字号、字重、行高、圆角、间距五类硬编码（字号 15 处 / 字重 5 处 / 行高 3 处），整文件未 Token 化，建议重写。
3. **修复性价比排序明确**：SCSS 的「间距 + 圆角 + 色值」四类合计 1726 处（`spacing` 1139 + `border-radius` 132 + `color-literal` 288 + `color-functional` 167），均为机械替换、零行为变化，适合首轮批量处理；i18n 与图标注册需人工判断语义，应放后续批次。

---

## 二、审查口径与排除例外清单（务实口径）

本次审查按「务实口径」执行：**只把「裸字面量」计为违规**，防御性兜底、既定约定与领域数据不计入。以下 15 类例外已在扫描器中代码化（见 `scripts/audit-hardcode.mjs` 的 `excludes` / `EXCLUDED_FILES` / `CENTRAL_*` 常量），排除记录可在 `docs/hardcode-audit.data.json` 的 `excluded[]` 中逐条追溯。

| # | 例外 | 理由 |
|---|---|---|
| 1 | `src/_variables.scss` | 设计 Token 的定义源，本身必须写死字面量 |
| 2 | `src/index.scss` | 全局样式入口（Token 桥接 + 基准字号） |
| 3 | `src/utils/timerRegistry.ts` | 定时器统一入口实现，必须调用原生 `setTimeout`/`setInterval` |
| 4 | `src/components/styles/*.scss` 的 `&--xsmall/--small/--medium/--large` 档位字号 | `AGENTS_STYLE.md` 明示的「两级字号制唯一例外」，允许 10/12/14/16px |
| 5 | 行内含 `// 无对应 Token` 注释的字面量 | 既有约定：14px / 18px 等无 Token 场景，硬编码但已显式标注 |
| 6 | `var(--b3-*, fallback)` 内的 fallback 字面量 | 防御性兜底，运行时由思源主题变量覆盖 |
| 7 | `--b3-theme-primary` 的 `$color-danger` fallback | 历史约定（全库统一），不做「修正」 |
| 8 | `rgba(0, 0, 0, 0.5)` 全屏遮罩 | `AGENTS_STYLE.md` 规定的合规遮罩值 |
| 9 | `src/components/styles/Slider.scss` 的 `box-shadow: 0 0 0 Npx rgba(var(--b3-theme-primary-rgb, $color-danger), 0.2)` | 已知潜在问题（fallback 语法非法但全项目同写法），明确要求勿单独修正 |
| 10 | `src/config/icons.ts` 中已注册 IconKey 的使用 | 注册表自身与其合法消费 |
| 11 | 非网络请求 URL（XML 命名空间 / 本地地址 / 示例域名 / 模板变量） | `www.w3.org`、`example.com`、`localhost` 等 |
| 12 | AI 端点与模型名集中定义：`src/api.ts` / `src/utils/aiApi.ts` / `src/utils/webSearch.ts` / `src/types/ai.ts` | `AGENTS_API.md` 明示的唯一入口实现 |
| 13 | 集中数据表：`config/aiModels.ts`、`superPanel/components/providers.ts`、`deepSeekCost/utils/pricing.ts`、`docAnalysis/types/index.ts`、`gitPush/types/meta.ts`、`shortcut/data/**` | 单一数据源的平台/模型/定价/快捷键元数据表 |
| 14 | `src/components/**` 与 `componentPreview/previewData/**` 的 i18n 豁免 | 组件库刻意零 i18n 依赖（可外迁复用，文案由调用方注入）；预览数据为开发态演示文案 |
| 15 | emoji 豁免：`generalSettings/utils/styles.ts`（用户可选内容预设）、`imageCreation/types/coverStylesNew.ts`（生成内容模板）、`bookmarkMarker`（用户可编辑内容） | 属用户/生成产物内容，非插件 UI 图标 |

补充说明两条**不计违规但已知的问题**：

- `--b3-theme-destructive` 从未定义（只有 `--b3-theme-error`），写它恒走 fallback 且暗色偏暗。**残留 4 处属真违规**（见 § 四），已计入报告。
- `border-radius: 50%`（头像/圆形按钮）属几何形状而非圆角 Token 场景，扫描器已通过 Token 映射表单独标注，真违规只取 `4/6/8/12/16/20/24px` 等具体像素值。

---

## 三、规则矩阵（31 条）

| ruleId | 检索模式（摘要） | 严重度 | 命中 | 主要例外 |
|---|---|---|---|---|
| `scss/in-vue-inline` | `.vue` 的 `<style>` 块内除 `@use`/注释外还有实际样式 | P1 | 402 | 无 |
| `scss/font-size` | `font-size: <字面量>px/rem;`（纯字面量声明） | P1 | 28 | 组件档位字号、`// 无对应 Token`、`rem * $var` 表达式、相对 `em` |
| `scss/font-weight` | `font-weight: <三位数>` | P1 | 5 | Token 定义源 |
| `scss/line-height` | `line-height: <数字>` | P1 | 58 | Token 定义源 |
| `scss/backdrop-filter` | `backdrop-filter:` | P1 | 13 | 生成产物样式 |
| `scss/undefined-token` | `--b3-theme-destructive` | P1 | 4 | 注释行 |
| `scss/legacy-spacing-alias` | `$spacing-(xs\|sm\|md\|lg)` | P1（superPanel 内 P3） | 20 | `superPanel/styles/variables.scss` 定义处 |
| `scss/spacing` | `padding/margin/gap` 值含 px/rem 字面量 | P2 | 1139 | `var()` fallback、`$var` 引用 |
| `scss/color-literal` | 裸 `#hex`（剥离 `var()` 后） | P2 | 288 | `var()` fallback |
| `scss/color-functional` | 裸 `rgb()/hsl()` 且首参为数字 | P2 | 167 | `rgba(0,0,0,0.5)` 遮罩 |
| `scss/color-named` | `color/background/...: <色名>` | P2 | 2 | `$var` 内的色词 |
| `scss/border-radius` | `border-radius: <值含 px/rem>` | P2 | 132 | `0`、`$var`、`var()`、`50%` 单独标注 |
| `scss/font-family` | `font-family: <非 $var / var()>` | P2 | 120 | 纯 `$var` 引用 |
| `scss/box-shadow` | `box-shadow: <非 none>`（标记 needsReview） | P2 | 37 | Token 定义源 |
| `scss/transition-duration` | `transition[-duration]:` 内时长 ≠ 0.12s | P2 | 133 | `spin`/`infinite` 动画 |
| `scss/transition-easing` | `cubic-bezier(` | P2 | 2 | Token 定义源 |
| `scss/letter-spacing-negative` | `letter-spacing: -<值>` | P2 | 0 | — |
| `scss/z-index` | `z-index: <数字>` 且 ≠ 10000 且 ≥ 1000 | P3 | 83 | Token 定义源 |
| `i18n/fallback-cn` | `... \|\| '中文兜底'`（左侧须含 `i18n`/`pluginI18n`/`$t`） | P1 | 132 | 组件库、预览数据、数据表、注释 |
| `i18n/fallback-i18n` | `i18n.x \|\| '<非空英文>'` | P1 | 0 | 空串 `\|\| ""` 属类型兜底不计 |
| `i18n/text-node-cn` | 模板文本节点中的中文（剥离注释/插值/标签后） | P1 | 155 | 同上 |
| `i18n/static-attr-cn` | `title="中文"` / `placeholder="中文"` 等静态属性 | P1 | 103 | 同上 |
| `i18n/script-ui-cn` | `showMessage/message/title/label/placeholder/...: "中文"` | P1 | 219 | 同上 |
| `const/secret` | `sk-xxxx` / `apiKey\|secret\|token = "≥8位"` | P0 | **0** | 占位符/示例值 |
| `const/model-name` | 真实模型名形态（`qwen-plus`/`deepseek-v4-pro` 等） | P1 | 2 | 集中定义表 |
| `const/url` | `http(s)://`（`fetch` 上下文升 P1） | P1/P2 | 5 | 集中定义表、外链常量表、示例域名 |
| `const/bare-fetch` | `fetch("http...")` 直连第三方 | P1 | 2 | 统一入口实现自身 |
| `const/bare-timer` | 裸 `setTimeout(`/`setInterval(`/`window.*` | P1 | 62 | `TimerRegistry` 实例方法、`src/utils/**`、代码示例数据文件 |
| `const/magic-number` | SQL `LIMIT` ≥ 4 位 / `timeout\|pageSize\|chunkSize` ≥ 2 位 | P2 | 53 | 代码示例数据文件 |
| `icon/unknown-name` | `'xxx:yyy'` 图标名未在 `icons.ts` 注册 | P1 | 232 | 已注册 IconKey、非 Iconify 前缀、注册表自身 |
| `icon/emoji-as-icon` | emoji 作为独立图标（前后为标签/分隔符边界） | P1 | 3 | 用户内容预设、生成模板 |
| `icon/emoji-in-text` | emoji 出现在文案字符串内 | P3 | 12 | 同上 |

---

## 四、P1 违规明细（1420 处）

### 4.1 `scss/in-vue-inline`（402 处 / 9 文件）—— 样式未分离

| # | 文件 | `<style>` 块范围 | 块内行数 | 内联部分是否另有硬编码 |
|---|---|---|---|---|
| 1 | `src/features/formatAssistant/index.vue` | 435–746 | 310 | **严重**：`font-size:14px/12px/11px`、`font-weight:600/500`、`padding/gap` px、`border-radius:4px`、`transition: all 0.15s` |
| 2 | `src/features/toolCollection/tools/unitConverter/components/ASCIIConverter.vue` | 194–279 | 84 | **严重**：`font-size:11px`、`font-family:"JetBrains Mono",...`、`font-weight:600/500`、`border-radius:4px`、`gap:14/6/8px` |
| 3 | `src/features/video/components/VideoPlayerDialog.vue` | 162–211 | 48 | **有**：`font-size:15px/13px/12px`、`font-weight:500`、`margin-top:16px`、`border-radius:4px` |
| 4 | `src/App.vue` | 301–318 | 16 | 无（纯布局属性） |
| 5 | `src/features/toolCollection/tools/unitConverter/components/BaseConverter.vue` | 210–224 | 13 | 轻微：`font-size:0.7em`、`margin-left:2px` |
| 6 | `src/features/video/components/VideoDownloadDialog.vue` | 725–733 | 7 | 轻微：`gap:8px` |
| 7 | `src/features/toolCollection/tools/unitConverter/components/BaseUnitConverter.vue` | 152–160 | 7 | 轻微：`gap:12px` |
| 8 | `src/features/rssReader/index.vue` | 384–390 | 5 | 轻微 |
| 9 | `src/features/htmlViewer/components/SnippetLibrary.vue` | 228（JS 模板字符串内嵌 `<style>`） | 1 | **有**：模板串内硬编码 `font-size:12px` |

处置：样式整体迁移至对应 `styles/<ComponentName>.scss`，`.vue` 的 `<style>` 内只留 `@use`；迁移时同步替换上文列出的硬编码值。

### 4.2 `icon/unknown-name`（232 处 / 77 文件）—— 图标名未注册

分布：`mdi:*` 201 处 + `ph:*` 31 处。已验证 `mdi:brush`、`mdi:lock-open-variant`、`mdi:apps`、`mdi:shield-lock`、`mdi:rocket-launch-outline`、`ph:video` 在 `src/config/icons.ts` 中均不存在。

| 文件 | 命中 | 代表违规名 |
|---|---|---|
| `src/features/statusBar/featureRegistry.ts` | 20 | `ph:video`、`ph:lock-key`、`ph:puzzle-piece`、`ph:code`、`ph:text-align-left`、`mdi:language-html5` |
| `src/features/gitPush/composables/useIdeManagement.ts` | 11 | `mdi:microsoft-visual-studio-code`、`mdi:language-csharp`、`mdi:robot-outline`、`mdi:alpha-t-box` |
| `src/features/gitPush/components/common/PanelHeader.vue` | 10 | — |
| `src/features/gitPush/components/ListView/CardHeaderActions.vue` | 9 | — |
| `src/features/gitPush/components/common/ConsistencyAuditDialog.vue` | 7 | — |
| `src/features/gitPush/components/RepoCleanPanel/CleanWizardDialog.vue` | 7 | `mdi:shield-lock-outline`、`mdi:database-remove-outline` |
| `src/features/gitPush/types/meta.ts` | 6 | `mdi:git`、`mdi:tea`、`mdi:cloud-braces`、`mdi:source-branch` |
| `src/features/statusBar/components/FeatureDrawer.vue` | 6 | `ph:tag`、`ph:x`、`ph:magnifying-glass`、`ph:trash`、`ph:plus` |
| `src/features/gitPush/components/CodeReport/index.vue` | 6 | — |
| `src/features/gitPush/components/common/EditProjectDialog.vue` | 6 | — |
| `src/features/scriptLauncher/types/index.ts` / `statusBar/components/DrawerFeatureItem.vue` | 5 / 5 | `ph:push-pin-simple-fill`、`ph:toggle-right` |
| `src/features/pageLock/index.ts`(2)、`textDiff`(4)、`pdfViewer`(5)、`RepoCleanPanel`(8) 等 | 其余 | `mdi:shield-lock`、`mdi:swap-horizontal`、`mdi:file-pdf-box`、`mdi:broom`、`mdi:undo-variant`、`mdi:history`、`mdi:check-all` |

影响评估：这些图标**当前可正常渲染**（`iconifySetup.ts` 已离线预加载 MDI 与 Phosphor 集合，`pnpm validate:icons` 只校验 `FEATURE_ICONS`/`COMMON_ICONS` 条目，故从未报警），但违反 `AGENTS.md` 硬规则「图标只能传 `src/config/icons.ts` 已注册的 `IconKey`，不能传任意 Iconify 名」。修复方式为**批量注册进 `icons.ts` 或替换为已有 IconKey**，不涉及运行时报错。

### 4.3 `i18n/*`（609 处）—— 文案未走 i18n

#### 4.3.1 `i18n/fallback-cn`（132 处 / 28 文件）

违反 `AGENTS_I18N.md`「禁止 i18n 硬编码兜底值」，i18n 应为 UI 文案唯一数据源。

| 文件 | 命中 | 补键落点分片 |
|---|---|---|
| `toolCollection/tools/wordQuery/components/WordQueryPanel.vue` | 24 | `i18n/{zh_CN,en_US}/wordQuery.json` |
| `toolCollection/tools/wordQuery/components/RegexGenerator.vue` | 20 | 同上 |
| `toolCollection/tools/wordQuery/components/TranslatePanel.vue` | 18 | 同上 |
| `toolCollection/tools/wordQuery/components/CodeExplainer.vue` | 11 | 同上 |
| `toolCollection/tools/wordQuery/components/CodeTranslationPanel.vue` | 11 | 同上 |
| `toolCollection/tools/wordQuery/components/CodeCommentGenerator.vue` | 8 | 同上 |
| ~~`diskBrowser/utils/index.ts`~~ | ~~6~~ → **0** | ✅ 已修（2026-09-21，见 `docs/disk-browser-redundancy-review.md` § F16） |
| `compactMode/components/CompactModeSettings.vue` | 5 | `compactMode.json` |
| `superPanel/types/index.ts`(4) / `superPanel/index.vue`(3) / `SuperPanelHeader.vue`(2) | 9 | `superPanel.json` |
| `skillLearning/index.ts`(2) / `statusBar/featureRegistry.ts`(2) / `wordQuery/composables/useWordQuery.ts`(2) | 6 | 各自 feature 分片 |
| `apiDebugger/index.ts`、~~`diskBrowser/index.ts`~~、`docAnalysis/index.ts`、`gitPush/GitPushManager.ts`、`globalRelations/index.ts`、`rssReader/index.ts`、`componentPreview/types/index.ts`、`docAnalysis/types/manager.ts`、`everythingSearch/types/index.ts`、`floatingToolbar/core/FloatingToolbar.ts`、`ideaGenerator/types/index.ts`、`minimalBrowser/types/index.ts`、`scriptLauncher/types/index.ts`、`toolCollection/types/index.ts` | 各 1 | 各 feature 分片（`diskBrowser/index.ts` 已修） |

典型形态：`title: i18n.panelTitle || "磁盘浏览器"`、`langText: i18n.panelTitle || "全局关系列表"`、`title: (plugin.i18n as any).apiDebugger?.panelTitle || "API调试器"`。
修复要点：**删除 `|| "中文"` 并确认对应分片键存在且已加载**——兜底值会掩盖「i18n 未加载 / 键缺失」的真实 bug。

#### 4.3.2 `i18n/text-node-cn`（155 处 / 33 文件）—— 模板文本节点中文

| 文件 | 命中 | 文件 | 命中 |
|---|---|---|---|
| `docAnalysis/index.vue` | 12 | `passwordVault/components/ExportModal.vue` | 9 |
| `docAnalysis/components/DocListView/index.vue` | 12 | `docAnalysis/components/AttrsPanel/index.vue` | 9 |
| `passwordVault/components/CategoryManagerModal.vue` | 10 | `docAnalysis/components/PublishPanel/index.vue` | 9 |
| `video/components/VideoToolbar.vue` | 10 | `docAnalysis/components/SettingsPanel/QuerySection.vue` | 7 |

修复要点：模板中每处 i18n 键渲染位置同时须补中文 HTML 注释（`<!-- 弹窗标题："Git 全局配置" -->`），主要结构区块补中文区块注释（`AGENTS.md § 硬规则`）。

#### 4.3.3 `i18n/static-attr-cn`（103 处 / 35 文件）—— 静态属性中文

| 文件 | 命中 | 代表行 |
|---|---|---|
| `passwordVault/components/EntryFormModal.vue` | 9 | `title="..."` / `placeholder="..."` |
| `htmlViewer/components/HtmlSourcePanel.vue` | 7 | — |
| `passwordVault/components/ChangePasswordModal.vue` | 6 | — |
| `docAnalysis/components/DocListView/FilterSettings.vue` | 6 | — |
| `passwordVault/index.vue` | 5 | `title="管理类别"`、`placeholder="搜索名称、账号或描述..."`、`title="导出所有数据"` |
| `skillLearning/components/SkillDialog.vue` / `statusBar/components/FeatureDrawer.vue` / `docAnalysis/components/PublishPanel/index.vue` | 各 5 | — |
| `htmlViewer/components/HtmlPreviewPanel.vue` / `SnippetEditModal.vue` | 各 4 | — |
| 其余 25 文件 | 各 1–3 | 含 `docAnalysis/index.vue:?` `title="设置"`、`scriptLauncher/index.vue` `title="打开 data/storage/sc/"` |

修复方式：改为 `:title="i18n.xxx"` / `:placeholder="i18n.xxx"`。

#### 4.3.4 `i18n/script-ui-cn`（219 处 / 61 文件）—— 脚本内 UI 文案

| 文件 | 命中 | 判定 |
|---|---|---|
| `src/utils/s3/s3Client.ts` | 12 | 真违规（P2）：工具层抛出的中文错误信息会经 toast 呈现，建议集中为错误码 + i18n 键 |
| `src/features/config.ts` | 10 | **真违规**：`FEATURE_CONFIG` 的 `label: "打开"` / `defaultLabel: "英译中替换"` 等，功能标签应来自 `plugin.i18n.<feature>` |
| `toolCollection/tools/wordQuery/utils/codeTranslation.ts` | 10 | 真违规（P2）：AI 提示词/UI 文案 |
| `passwordVault/components/EntryFormModal.vue` | 9 | 真违规 |
| `statusBar/featureRegistry.ts` | 8 | **真违规**：功能注册表 `label` / `langText` 应走 i18n 分片 |
| `wordQuery/utils/codeUtils.ts` | 8 | 真违规 |
| `gitPush/types/meta.ts` | 7 | 边界：平台元数据表（已判为集中数据表，此处为其余中文说明文案） |
| `htmlViewer/components/HtmlSourcePanel.vue` | 7 | 真违规 |
| `statusBar/components/FeatureDrawer.vue` | 7 | 真违规 |
| `passwordVault/components/ChangePasswordModal.vue` | 6 | 真违规 |
| `docAnalysis/components/{AttrsPanel/index,DocListView/DocListItem,DocListView/FilterSettings,PublishPanel/index}.vue` | 各 5–6 | 真违规 |
| 其余 49 文件 | 各 1–5 | 以 `.vue` 的 `showMessage("...")` / `errorText: "..."` 为主 |

### 4.4 `const/bare-timer`（62 处 / 50 文件）—— 裸定时器绕过统一入口

违反 `AGENTS.md § 统一入口原则`「定时任务统一入口：必须走 `@/utils/timerRegistry` 的 `TimerRegistry`，禁止裸 `setInterval`/`setTimeout`」。

按 feature 归组（`src/utils/**` 已在例外中，不在此列）：

| feature | 文件数 | 命中 | 备注 |
|---|---|---|---|
| gitPush | 13 | 14 | 模块内已有 registry 范式（`useBatchProgress`），被命中文件属漏接入 |
| generalSettings | 8 | 12 | `DocCountManager` 已用 `this.timers`，被命中文件未接入 |
| toolCollection | 5 | 6 | — |
| docAnalysis | 3 | 4 | — |
| floatingToolbar | 2 | 3 | — |
| formatAssistant / flashcardReading / imageCreation | 各 1–3 | 各 3 | — |
| componentPreview / rssReader | 各 2 | 各 2 | componentPreview 为 `window.setTimeout` |
| docNavigation / pageLock / passwordVault / encryption / skillsViewer / statistics / htmlViewer / scriptLauncher / floatingBox / imageCompressor / skillLearning / superPanel 等 | 各 1 | 各 1 | — |

**其中 2 处泄漏风险最高（`setInterval` 周期任务）**：

| 文件:行 | 内容 | 处置 |
|---|---|---|
| `src/features/flashcardReading/components/TypingPractice.vue:335` | `timerInterval = setInterval(...)`（另有 415 / 423 两处 `setTimeout`） | `TimerRegistry` + `onUnmounted` `clearAll()` |
| `src/features/rssReader/composables/useAutoRefresh.ts:23` | `timer = setInterval(...)` | 同上 |

其余 60 处多为一次性 UI 提示（`setTimeout(() => showMessage(), 2000)`）与防抖，建议统一接 registry，`onUnmounted`/`destroy()` 中 `clearAll()`。

---

## 五、P2 违规明细（2078 处）

### 5.1 间距 `scss/spacing`（1139 处 / 165 文件）

机械替换类，`4/8/12/16/20/24px` 有对应 Token，`6/10/14/30px` 属「无对应 Token」（建议补 Token 或标注）。

| 文件 | 命中 | 文件 | 命中 |
|---|---|---|---|
| `statistics/styles/MilestoneRuleEditor.scss` | 68 | `globalRelations/styles/index.scss` | 29 |
| `gitPush/styles/index.scss` | 44 | `docAnalysis/styles/index.scss` | 27 |
| `htmlViewer/styles/index.scss` | 42 | `toolCollection/tools/unitConverter/styles/index.scss` | 26 |
| `statistics/styles/MilestonesCard.scss` | 42 | `compactMode/styles/index.scss` | 24 |
| `video/styles/index.scss` | 41 | `docAnalysis/styles/DocListItem.scss` | 19 |

### 5.2 色值 `scss/color-literal`（288）+ `scss/color-functional`（167）

| 文件 | literal | functional | 判定 |
|---|---|---|---|
| `src/features/imageCreation/styles/CodeImageStyles.scss` | 95 | 41 | **整体豁免**：导出图片本体的生成样式（文件头已声明「作用于被截图生成的图片，非插件 UI 样式」） |
| `src/features/apiDebugger/styles/index.scss` | 14 | 7 | 真违规 |
| `src/features/skillLearning/styles/FlashcardView.scss` | 14 | 7 | 真违规（`#22c55e`/`#ef4444` → `$color-success`/`$color-danger`） |
| `src/features/skillLearning/styles/ReviewView.scss` | 12 | — | 真违规（`#22c55e`、`#94a3b8`） |
| `src/features/statistics/styles/index.scss` | 12 | — | 部分：`rgba(var(--b3-*-rgb), x)` 为主题的半透明派生，属可接受；裸 `#2da44e` / `#cf222e` 应 Token 化 |
| `src/features/gitPush/styles/_mixins.scss` | 10 | — | **整体豁免**：`gp-diff-color-vars` 为 diff 着色调色板映射 |
| `src/features/generalSettings/styles/codeblockThemes.scss` | 7 | — | **整体豁免**：代码高亮主题映射（固定品牌色） |
| `src/features/docAnalysis/styles/AttrsPanel.scss` | 18 | 11 | 真违规；另 `rgba(0,0,0,0.4)` 遮罩透明度偏离规定值 0.5 |
| `statistics/*Chart*.scss`、`gitPush/styles/CandlestickSection.scss`、`aiContentGenerator/styles/ReviewRadarChart.scss` | — | — | **整体豁免**：canvas 无法解析 CSS 变量，须与 TS 调色板（`chartConfig.ts` / `REPORT_CHART_COLORS`）逐字一致 |
| `docAnalysis/styles/{StatTable,index,DocListItem,MarkdownEditor}.scss`、`skillLearning/_shared.scss`、`components/styles/Switch.scss` 等 | 各 6–13 | 各 6–7 | 真违规，逐条 Token 化 |

### 5.3 圆角 `scss/border-radius`（132 处 / 58 文件）

TOP：`htmlViewer/styles/index.scss`(11)、`globalRelations/styles/index.scss`(7)、`unitConverter/styles/index.scss`(6)、`statistics/MilestoneRuleEditor.scss`(5)、`statistics/MilestonesCard.scss`(5)、`superPanel/feature-card.scss`(5)、`gitPush/AuthorContributionSection.scss`(4)、`gitPush/CandlestickSection.scss`(4)、`skillLearning/FlashcardView.scss`(前面统计中 18 处含 `50%` 几何形状，需剔除后处理)。
注意：命中含大量 `border-radius: 50%`（头像/圆形），属几何形状，**不计违规**；真违规为 `4/6/8/12/16/20/24px` 具体像素值。

### 5.4 字体族 `scss/font-family`（120 处 / 25 文件）

| 文件组 | 命中 | 处置 |
|---|---|---|
| `src/features/statistics/styles/*.scss`（21 文件） | ~121 | `font-family: stats.$font-mono` → 统一改 `$vp-mono`（机械替换） |
| `toolCollection/tools/unitConverter/styles/index.scss` | 7 | 本地别名 `$mono` → `$vp-mono` |
| `htmlViewer/styles/index.scss` | 2（148 / 221 行） | `'JetBrains Mono','Fira Code',monospace` → `$vp-mono` |
| `docAnalysis/styles/MarkdownEditor.scss` | 1（44 行） | `Consolas, Monaco, 'Courier New', $vp-mono, monospace` → `$vp-mono` |
| `apiDebugger/styles/index.scss` | 1（126 行） | `"SFMono-Regular","Consolas",...` → `$vp-mono` |

### 5.5 过渡时长 `scss/transition-duration`（133 处 / 73 文件）

违反 `AGENTS_STYLE.md § 强制规则：背景与过渡对齐 gitPush 范式`「过渡统一 0.12s ease」。值分布：`0.15s` 约 60 处、`0.2s` 约 20 处、`0.25s`（statusBar）、`0.3s`（宽度动画）、`0.5s`/`0.6s`（进度条）、`0.1s` 等。

TOP：`statistics/MilestonesCard.scss`(11)、`statistics/NotebookActivity.scss`(5)、`gitPush/BranchCommitList.scss`(4)、`gitPush/index.scss`(4)、`htmlViewer/index.scss`(4)、`superPanel/index.scss`(4)、`docNavigation/FilterKeywordsEditor.scss`(3)、`docNavigation/_dropdown-shell.scss`(3) 等。

配套 `scss/transition-easing`（2 处）与 `scss/letter-spacing-negative`（0 处）：
- `src/features/statusBar/styles/index.scss`：`$_ease-out: cubic-bezier(0.4, 0, 0.2, 1)`
- `src/features/toolCollection/styles/index.scss`：`$tc-ease: cubic-bezier(0.4, 0, 0.2, 1)`

不建议修改的例外：`src/components/styles/SpeedDial.scss` 的 `transition-delay: var(--si-speeddial-delay, 0ms)` 三段延迟与 `visibility 0s linear 0.12s`（组件机制，非 duration 违规）。

### 5.6 `scss/box-shadow`（37 处 / 12 文件）—— 逐条判定后仅 1 处真违规

| 文件:行 | 内容 | 判定 |
|---|---|---|
| `src/features/aiContentGenerator/components/styles/SkillPreviewModal.scss:20` | `0 8px 32px rgba(0,0,0,0.12)` | **违规（P1）**：弹窗主样式阴影，应改 `border: 1px solid var(--b3-border-color)` |
| `src/components/styles/Slider.scss:111,115` | `0 0 0 4px rgba(var(--b3-theme-primary-rgb, $color-danger), 0.2)` | 已知例外（勿单独修正） |
| `src/components/styles/Slider.scss:59,80,63,84` | `0 2px 4px rgba(0,0,0,0.1)` / `0 4px 8px rgba(0,0,0,0.15)` | 滑块拇指投影，保留 |
| `src/components/styles/Switch.scss:40,77` | `inset 0 1px 2px rgba(0,0,0,0.1)` / `0 1px 3px rgba(0,0,0,0.3)` | 凹槽内阴影 / 拇指投影，保留 |
| `src/features/generalSettings/styles/SettingSlider.scss:30,40` | `0 1px 4px` / `0 2px 6px` | 原生 range 拇指视觉，保留 |
| `src/features/generalSettings/styles/codeblockThemes.scss:147` | Mac 三色点 `box-shadow` 绘制 | 合理例外（纯 CSS 画点） |
| `encryption/DecryptDialog.scss:78,107`、`floatingToolbar/_mixins.scss:175`、`statistics/ReportView.scss:67`、`passwordVault/mixins.scss:59`、`passwordVault/CategoryManagerModal.scss:52` | `0 0 0 2px var(--b3-theme-primary-lightest)` | focus 环，**合规**（规范范式本身） |
| `src/features/statistics/styles/NotebookTable.scss:70` | `inset 3px 0 0 var(--b3-theme-primary)` | 行选中指示条，保留 |
| `src/features/imageCreation/styles/CodeImageStyles.scss`（18 处） | 多种 `0 8px 24px rgba(...)` | **整体豁免**：生成产物样式 |

### 5.7 `scss/line-height`（58 处 / 42 文件）

| 值桶 | 数量 | 判定 |
|---|---|---|
| `1` | 17 | 图标/单行居中归一化，**保留** |
| `1.25 / 1.5 / 1.75` | 1 | **真违规**：`globalRelations/styles/index.scss:56` 的 `1.5` → `$line-height-normal` |
| 其他小数 `1.2/1.3/1.4/1.6/1.65/1.7/2` | 33 | 无对应 Token，建议保留或补 Token |
| px 值 | 11 | 无对应 Token（格子/日期高度对齐，如 `compactMode/index.scss` 的 `24/24/22/20px !important`、`gitPush/CommitHeatmap.scss:62` 的 `12px`） |

### 5.8 `scss/font-size`（28 处 / 11 文件）与 `scss/font-weight`（5 处 / 1 文件）

`font-size` 有 Token 可直接替换的（P2）：

| 文件:行 | 值 | 应替换 |
|---|---|---|
| `globalRelations/styles/index.scss:34` | `14px` | `$font-size-sm` |
| `globalRelations/styles/index.scss:55,155,190,242` | `12px` | `$font-size-xs` |
| `globalRelations/styles/index.scss:110` | `18px` | `$font-size-lg` |
| `globalRelations/styles/index.scss:256,357,370` | `10px` | `$font-size-2xs` |
| `gitPush/styles/Dialog.scss:119` | `0.875rem` | `$font-size-sm` |

无对应 Token 的（P3，建议标注或补 Token）：`globalRelations` 的 `11px`（5 处）、`statistics/MilestonesCard.scss` 的 `28/20/22px`、`statistics/{CompareLineChart,ReportTrendChart,StatsCardsCompact}.scss` 的 `8px`（SVG 坐标）、`docAnalysis/StatsOverview.scss:29` 的 `40px`、`everythingSearch/SearchResults.scss:72` 的 `32px`、`gitPush/Dialog.scss:147` 的 `0.8125rem`、`skillLearning/{FlashcardView,ProgressRing,StatsView}.scss`。

`font-weight` 全部集中在 `globalRelations/styles/index.scss`（35 行 `600`、111 行 `700`、243 行 `500`、295 行 `600`、349 行 `500`）。

### 5.9 `const/magic-number`（53 处 / 23 文件）

| 文件 | 命中 | 语义 | 建议常量 |
|---|---|---|---|
| `floatingToolbar/components/PronunciationDialog.vue` | 12 | 提示超时 `2000/3000/5000` | 组件内 `const TOAST = { short: 2000, normal: 3000, long: 5000 }` |
| `floatingToolbar/core/actions/translate.ts` | 7 | 同上 | 复用 `TOAST_TIMEOUT_MS` |
| `floatingToolbar/components/QRCodeDialog.vue` | 6 | 提示超时 | 同上 |
| `statistics/queries/{timeStats,reportStats,heatmapStats,docChangeStats,baseStats}.ts` | 9 | SQL `LIMIT 1024/2048` | `STATS_SQL_LIMIT` → `statistics/types/index.ts` |
| `docAnalysis/utils/docStatsAnalyzer.ts` | 3 | SQL `LIMIT 10000/50000` | `DOC_ANALYSIS_SQL_LIMIT` |
| `docAnalysis/utils/platformPublish.ts` / `useDocAnalysis.ts` | 各 1–2 | SQL `LIMIT 50000/10000` | 同上 |
| `rssReader/utils/fetchRss.ts` | 4 | 请求超时 `15000/20000` | `RSS_FETCH_TIMEOUT_MS` |
| `generalSettings/utils/styles.ts:363` | 1 | 轮询超时 `5000` | `ELEMENT_WAIT_TIMEOUT_MS` |
| `gitPush/composables/usePagedList.ts:5` | 1 | `pageSize = 50` | `DEFAULT_PAGE_SIZE` |
| `skillLearning/components/SkillListView.vue:109`、`resourceManager/...`、~~`diskBrowser/utils/index.ts:23`~~、`useIdeManagement.ts:211`、`useResultActions.ts:120` 等 | 各 1 | 分页/超时 | 各自 feature 的 `types/`（diskBrowser 已改为具名常量 `VOLUME_LABEL_TIMEOUT`） |

**已是具名常量、无需再改**：`flashcardReading/types/index.ts:50` 的 `PAGE_SIZE: 10`、`docAnalysis/components/DocListView/index.vue:222` 的 `PAGE_SIZE = 50`、`gitPush/types/storage.ts:29` 的 `DEFAULT_NETWORK_TIMEOUT = 240`。

### 5.10 其余 P2

| ruleId | 命中 | 说明 |
|---|---|---|
| `scss/backdrop-filter` | 13 | **真违规（`AGENTS_STYLE.md` 要求 grep 零命中）**：`gitPush/{WorkingTreeDiffDialog,LogDetailDialog,FileDetailModal,AiErrorAnalysisDialog}.scss` 各 `blur(2px)`；`statistics/index.scss:136` `blur(8px)`；`everythingSearch/index.scss:21` `blur(4px)`；`prompts/_mixins.scss:24` `blur(4px)`；`imageCreation/index.scss:16` `blur(2px)`；`imageCreation/CodeImageStyles.scss` 4 处属生成产物例外 |
| `scss/color-named` | 2 | `generalSettings/styles/DocumentFontSettings.scss:126,154` 的 `color: white` → `var(--b3-theme-on-primary)` |
| `const/url` | 5 | `deepSeekCost/BalanceQuery.vue`（2，升 P1，见 § 四）、`superPanel/AiSettingsPanel.vue`（`open.bochaai.com` 外链）、`docAnalysis/{AttrsPanel,PublishPanel}` 的 `https://md.doocs.org/`（应提取为具名常量） |
| `const/model-name` | 2 | `src/config/settings.ts` 的 `aiModel: "qwen-plus"` 默认值、`superPanel/types/index.ts` 的 `s.aiModel \|\| "qwen-plus"` → 改取 `src/config/aiModels.ts` 或 `providers.ts` 的 `getDefaultModel()` |

---

## 六、P3 违规明细（115 处）

| ruleId | 命中 | 说明与处置建议 |
|---|---|---|
| `scss/z-index` | 83 | 分布 65 文件（`statusBar/index.scss` 3、`pdfViewer/styles/index.scss` 3、`floatingBox` 2、`ProjectLineDetail` 2、`htmlViewer` 2、`imageCompressor` 2 等）。规范要求全屏遮罩统一 `10000`，子级弹窗可叠加；当前存在 99999 等散落值。**仅登记，建议不改**（改 z-index 有层叠回归风险，收益低） |
| `scss/legacy-spacing-alias` | 20 | `superPanel/styles/index.scss`(17) 与 `feature-card.scss`(3) 使用 `$spacing-sm/md/lg` 本地别名。别名在 `superPanel/styles/variables.scss` 内定义，**模块内合法**；风险仅在跨模块复制引用（会 `Undefined variable`）。建议：将 superPanel 本地别名更名为 `$sp-sm` 等，彻底消除与全局数字后缀 Token 的歧义 |
| `icon/emoji-in-text` | 12 | `gitPush/managers/RemoteOps.ts`(4，消息中 `⚠ ` 前缀)、`gitPush/LogPanel/{LogDetailDialog,LogTableRow}.vue`(各 2，`✓`/`✗` 状态符)、`jsonFormatter/index.vue`(2，`"✓ Valid JSON"` i18n 兜底文案)、`deepSeekCost/BalanceQuery.vue`(2，`"✓"`/`"✗"`)。处置：删符号或改 `IconWrapper`；`jsonFormatter` 两处应一并移除 i18n 兜底 |

### `icon/emoji-as-icon`（3 处，P1）

| 文件:行 | 内容 | 替代 IconKey（均已注册） |
|---|---|---|
| `src/features/everythingSearch/components/DialogHeader.vue:32` | `<span aria-hidden="true">✕</span>` | `<IconWrapper name="close" :size="12" />` 或用 `<Button icon-only :icon="'close'" />` |
| `src/features/gitPush/components/LogPanel/LogStatsBar.vue:14` | `{{ s.ok }}✓` | `<IconWrapper name="check" :size="12" />` |
| `src/features/gitPush/components/LogPanel/LogStatsBar.vue:18` | `{{ s.fail }}✗` | `<IconWrapper name="close" :size="12" />` |

附带发现（未被 emoji 规则捕获，因 `⌘` U+2318 不在 emoji 码点范围）：`DialogHeader.vue:7` 用 `⌘` 当标题图标，建议改 `IconWrapper`（需先在 `icons.ts` 注册对应键）。

### `const/bare-fetch`（2 处，P1）

| 文件:行 | 内容 |
|---|---|
| `src/features/toolCollection/tools/deepSeekCost/components/BalanceQuery.vue:261` | `fetch("https://api.deepseek.com/user/balance", ...)` |
| `src/features/toolCollection/tools/deepSeekCost/components/BalanceQuery.vue:269` | `fetch("https://api.deepseek.com/models", ...)` |

评估：`@/utils/aiApi` 的 `callAI` 系列只覆盖 Chat 类端点，**不存在**余额/模型列表的统一入口；该文件已正确从 `plugin.settings.aiApiKeys.deepseek` 读取运行时密钥（**无泄漏风险**），问题仅在「绕过统一入口 + 端点字面量内联」。
建议（推荐顺序）：① 在 `deepSeekCost/utils/` 内新增 `queryDeepSeekBalance(apiKey)` / `listDeepSeekModels(apiKey)`，端点提为 `DEEPSEEK_API_BASE` 常量，组件只调函数；② 退而求其次把 base URL 与路径提到 `deepSeekCost/types/index.ts` 集中常量。

### `scss/undefined-token`（4 处，P1）

| 文件:行 | 内容 | 应替换 |
|---|---|---|
| `src/components/styles/Badge.scss:91` | `--b3-theme-destructive` | `--b3-theme-error` |
| `src/components/styles/Tag.scss:98` | 同上 | 同上 |
| `src/components/styles/Tag.scss:99` | 同上 | 同上 |
| `src/components/styles/Tag.scss:100` | 同上 | 同上 |

说明：`--b3-theme-destructive` 在思源主题变量中**从未定义**，恒走 fallback 且暗色模式偏暗。`Label.scss` / `Slider.scss` 已修，此 4 处为残留。

---

## 七、复核校正记录

本轮审查由「扫描器 + 两个只读代码复核代理（SCSS / 常量与图标）+ 规则矩阵交叉校验」三线并行完成，过程中发现并修复了扫描器自身的两个缺陷，影响此前中间结果的准确性，记录如下以保证结论可信：

| # | 缺陷 | 影响 | 修复 |
|---|---|---|---|
| 1 | `main()` 构造 `ctx` 时 `line: i + 1` 被后写的 `line`（源码文本）覆盖，导致 `findings[].line` 存的是**源码文本而非行号** | 所有依赖行号定位的明细不可用（仅 `scss/in-vue-inline`、`i18n/text-node-cn` 两个专用处理器不受影响） | 原名改为 `raw`，`line` 统一为数字；同步修正 5 处 `ctx.line` 消费点 |
| 2 | `icon/unknown-name` 的前缀判定用了含引号的匹配串（`'"mdi:x"'`），`ICON_SET_PREFIX` 测试恒为 false → **该规则整体失效、零命中** | 232 处未注册图标名被静默漏检 | 改用捕获组 `m[1]`（不含引号）判定；修复后暴露 232 处违规 |

另有 3 类初版误报在复核中定位并修正（均已代码化为例外）：`$spacing-2px` 等 `$var` 引用被 `mapLengths` 当作字面量；`|| ""` 空串类型兜底被计为 i18n 硬编码兜底；`disk-browser-settings` 中的 `sk-` 被误判为 API Key 前缀。

**实读校正**：复核代理逐一读取源文件核对后确认，除上述两类外，其余规则的命中数与文件集合与基线一致。`box-shadow` 实读为 41 行（基线 37），差额为 `CodeImageStyles.scss` 的多行 `box-shadow:` 续行未逐条计数，文件集合（12）一致，不影响判定。

---

## 八、分批修复计划

> 完整修复顺序、批次范围、验证命令与「不建议修」清单见 § 九。本节先给出总体策略。

### 8.1 批次设计原则

按「**风险递增、收益递减**」排序，前三批均为**机械替换、零行为变化**，可在一次会话内批量完成并只跑 `read_lints` + `npx tsc --noEmit` 验证；后四批涉及语义判断，需人工确认文案与图标映射。

| 批次 | 主题 | 命中数 | 文件数 | 风险 | 验证 |
|---|---|---|---|---|---|
| B1 | SCSS 间距 Token 化（`scss/spacing`） | 1139 | 165 | 极低（纯值替换） | `read_lints` + 目视回归面板 |
| B2 | SCSS 圆角 + 字体族 Token 化 | 252 | 70 | 极低 | 同上 |
| B3 | SCSS 色值 Token 化（剔除豁免文件） | ~330 | ~45 | 低 | 组件预览面板目视回归 |
| B4 | SCSS 其余杂项（过渡时长 / backdrop-filter / line-height / font-size / font-weight / undefined-token / transition-easing / color-named / legacy alias） | 265 | 115 | 低–中（过渡时长影响观感） | 目视回归 |
| B5 | 样式分离（`scss/in-vue-inline` 9 文件） | 402 | 9 | 中（迁移 + 命名空间） | `read_lints` + 逐面板目视 |
| B6 | i18n 文案补齐（4 条 i18n 规则） | 609 | 95 | 中（须同步双分片 + 补中文注释） | `pnpm i18n:verify` |
| B7 | 图标注册（232 处，批量注册为主） | 232 | 77 | 中低 | `pnpm validate:icons` |
| B8 | 定时器统一入口 + 魔法数字 + 端点常量 | 124 | 74 | 中（生命周期/清理路径） | `npx tsc --noEmit` + 功能实测 |
| B9 | emoji 替换（3 + 12 处） | 15 | 6 | 低 | 目视 |

### 8.2 建议的首轮动手顺序（高性价比清单）

1. `src/features/globalRelations/styles/index.scss` —— **单文件重写**即可消掉字号 15 + 字重 5 + 行高 1 + 圆角 7 + 间距 29 + 色值若干，是投入产出比最高的一处。
2. `src/components/styles/{Tag,Badge}.scss` 的 `--b3-theme-destructive` → `--b3-theme-error`（4 行，修掉真实的功能性缺陷）。
3. `src/features/aiContentGenerator/components/styles/SkillPreviewModal.scss:20` 的弹窗主阴影（1 行）。
4. 9 个 `.vue` 的样式分离（`formatAssistant/index.vue` 优先，256 行）。
5. `wordQuery` 6 个组件的 92 处 i18n 兜底值（同一分片，可一次性处理）。

---

## 九、修复计划详情

### 9.1 各批次范围与执行要点

#### B1 SCSS 间距 Token 化（1139 处 / 165 文件）
- 替换映射：`2px→$spacing-2px`、`3px→$spacing-px`、`4px→$spacing-1`、`8px→$spacing-2`、`12px→$spacing-3`、`16px→$spacing-4`、`20px→$spacing-5`、`24px→$spacing-6`、`32px→$spacing-8`、`40px→$spacing-10`、`48px→$spacing-12`、`64px→$spacing-16`；`rem` 等价换算同表。
- **无对应 Token 的值**（`6/10/14/18/30px`）：二选一 —— ①就近取 Token（可能改变视觉）；②行尾加 `// 无对应 Token` 注释保留。建议先统一加注释，再单独评审是否补 Token。
- 必须逐文件确认已 `@use '@/variables.scss' as *;`（缺则补导入）。

#### B2 圆角 + 字体族（252 处 / 70 文件）
- 圆角映射：`4px→$radius-sm`、`6px→$vp-radius`、`8px→$radius-md`、`12px→$radius-lg`、`16px→$radius-xl`、`24px→$radius-2xl`、`9999px→$radius-full`。
- **跳过 `border-radius: 50%`**（头像/圆形几何形状）。
- 字体族：`statistics/*` 的 21 个文件统一把本地 `$font-mono` 别名的取值改为 `$vp-mono`（**改定义处一处即可**，优于改 121 处使用点）；`htmlViewer`(2)、`MarkdownEditor`(1)、`apiDebugger`(1)、`unitConverter`(7) 逐个替换。

#### B3 色值 Token 化（约 330 处 / 45 文件）
- **先做整体豁免**：`imageCreation/styles/CodeImageStyles.scss`、`generalSettings/styles/codeblockThemes.scss`、`gitPush/styles/_mixins.scss`（`gp-diff-color-vars`）、`statistics/*Chart*.scss`、`gitPush/styles/CandlestickSection.scss`、`aiContentGenerator/styles/ReviewRadarChart.scss`。
- 余下按语义映射：状态色 → `$color-success`/`$color-danger`/`$color-warning`/`$color-info`；中性色 → `var(--b3-theme-*)` 或 `$color-*`。
- `rgba(var(--b3-*-rgb), x)` 形式的半透明主题派生**可保留**（属主题变量派生，非硬编码）。
- 顺带修正遮罩透明度：`rgba(0,0,0,0.4)` / `0.45` → `rgba(0, 0, 0, 0.5)`。

#### B4 SCSS 杂项（约 250 处 / 110 文件）
- `transition-duration`：统一 `0.12s`（保留 `spin 1s linear`、`SpeedDial` 的三段 `transition-delay`）。
- `backdrop-filter`：9 个文件全部删除（`gitPush` 4 处、`statistics` 1、`everythingSearch` 1、`prompts` 1、`imageCreation` 1，另 `imageCreation/CodeImageStyles.scss` 4 处豁免）。
- `line-height`：仅 `globalRelations/styles/index.scss:56` 的 `1.5` 换 `$line-height-normal`；`line-height: 1` 与无 Token 值保留。
- `font-size`/`font-weight`：`globalRelations` 整文件替换；`gitPush/Dialog.scss:119` 的 `0.875rem` → `$font-size-sm`。
- `undefined-token`：`Tag.scss` 3 处 + `Badge.scss` 1 处 → `--b3-theme-error`。
- `transition-easing`：`statusBar` 与 `toolCollection` 的 `$_ease-out` / `$tc-ease` 删除，改用 `ease`。
- `color-named`：`DocumentFontSettings.scss:126,154` → `var(--b3-theme-on-primary)`。
- `legacy-spacing-alias`：`superPanel` 本地别名更名为 `$sp-$size`（`sp-xs/sp-sm/sp-md/sp-lg` 等），消除与全局 Token 的歧义（20 处）。

#### B5 样式分离（402 行 / 9 文件）
- 每个 `.vue` 的 `<style>` 内容迁至 `src/features/<feature>/styles/<ComponentName>.scss`，`<style>` 内只留 `@use`。
- 迁移时同步替换块内硬编码（见 § 4.1 表格第三列）。
- `App.vue`（16 行布局）可迁至 `src/styles/app.scss`；`SnippetLibrary.vue:228` 的 JS 模板字符串内嵌 `<style>` 需改为外部 SCSS 或 CSS 变量注入。

#### B6 i18n 文案补齐（609 处 / 120+ 文件）
- **只改分片**：`src/i18n/{zh_CN,en_US}/<feature>.json`，禁止直接写合并产物 `zh_CN.json` / `en_US.json`。
- 落点对照：`shortcut` 的分片名为 `shortcuts.json`；其余按 feature 目录名对应。
- 顺序建议：先删兜底值（`fallback-cn` 132 处）→ 再补模板文本节点（`text-node-cn` 155）→ 再补静态属性（`static-attr-cn` 103）→ 最后补脚本 UI 文案（`script-ui-cn` 219）。
- **同步补齐中文注释**：模板中每处 i18n 渲染位上方加 `<!-- 文案："中文" -->`，主要结构区块加中文区块注释（`AGENTS.md § 硬规则`）。
- 完成后运行 `pnpm i18n:merge` 与 `pnpm i18n:verify`。
- 例外保留：`src/features/config.ts` 的 `label` 建议改为读 `plugin.i18n`（属真违规，不建议豁免）；`src/utils/s3/s3Client.ts` 的中文错误信息建议改为错误码 + i18n 键映射。

#### B7 图标注册（232 处 / 77 文件）
- 优先**批量注册**：把 `mdi:*` 201 个与 `ph:*` 31 个（去重后数量更少）补入 `src/config/icons.ts` 的 `FEATURE_ICONS` / `COMMON_ICONS` 映射，随后把调用点从裸字面量改走 `IconWrapper :name="<IconKey>"`。
- 若某图标仅 1 处使用且已有语义等价的已注册图标，则直接替换而非新增注册。
- `gitPush/types/meta.ts`、`gitPush/composables/useIdeManagement.ts`、`statusBar/featureRegistry.ts` 属集中数据表，注册后可整体改为引用 `IconKey`。
- 完成后运行 `pnpm validate:icons`。

#### B8 定时器 / 魔法数字 / 端点常量（122 处 / 70+ 文件）
- **优先 2 处 `setInterval`**（`flashcardReading/TypingPractice.vue:335`、`rssReader/composables/useAutoRefresh.ts:23`）——存在真实泄漏风险。
- 其余 60 处 `setTimeout`（多为提示/防抖）统一接 `TimerRegistry`，在 `onUnmounted` / `destroy()` 中 `clearAll()`。
- 魔法数字提取为具名常量（落点见 § 5.9）；`PAGE_SIZE` 等**已具名的不再改造**。
- `deepSeekCost/BalanceQuery.vue` 的 2 处 `fetch` 按 § 六的建议新增最小统一入口或集中端点常量。
- `const/model-name` 2 处改为引用 `src/config/aiModels.ts` / `providers.ts` 的 `getDefaultModel()`。

#### B9 emoji 替换（15 处 / 6 文件）
- 见 § 六的替换表；`gitPush` 的三个 `LogPanel` 组件建议收敛为一个共享的小状态图标组件后再替换。

### 9.2 验证命令

| 时机 | 命令 | 说明 |
|---|---|---|
| 每批次改动后 | `read_lints`（IDE 诊断） | 规范类问题 |
| B1–B5（SCSS/样式）后 | `npx tsc --noEmit` | 类型检查（`.vue` 内联样式迁移后尤其必要） |
| B5 后 | 打开组件预览面板逐组件目视回归 | 样式分离与 Token 替换的唯一目视入口 |
| B6（i18n）后 | `pnpm i18n:merge` → `pnpm i18n:verify` | 中英键对齐 + 重复键检测 |
| B7（图标）后 | `pnpm validate:icons` | 图标注册有效性 |
| B8（定时器）后 | 功能实测（重点：rssReader 自动刷新、flashcardReading 打字练习进出） | 生命周期与清理路径 |
| 全部完成后 | `node scripts/audit-hardcode.mjs` 复跑并 diff `docs/hardcode-audit.data.json` | 得到「已消除 / 新增」清单，作为回归守卫 |

> 按项目约定，`pnpm lint` 与 `pnpm vite build` 由用户自行执行，AI 不运行。

### 9.3 不建议修 / 建议整体豁免清单

| 项 | 命中 | 不建议修的理由 |
|---|---|---|
| `src/features/imageCreation/styles/CodeImageStyles.scss` | 色值 95 + functional 41 + box-shadow 18 + backdrop-filter 4 | 作用于**被截图导出的图片本体**（产品输出），非插件 UI 样式；改 Token 会改变用户导出效果 |
| `src/features/generalSettings/styles/codeblockThemes.scss` | 色值 7 + box-shadow 1 | 代码高亮主题映射，须与第三方主题（GitHub / Mac 骨架）配色一致 |
| `src/features/gitPush/styles/_mixins.scss`（`gp-diff-color-vars`） | 色值 10 | diff 着色调色板，须与 GitHub Light/Dark 语义对齐 |
| `statistics/*Chart*.scss`、`gitPush/CandlestickSection.scss`、`aiContentGenerator/ReviewRadarChart.scss` | 图表配色若干 | canvas 渲染无法解析 CSS 变量，取值须与 TS 侧 `chartConfig.ts` / `REPORT_CHART_COLORS` 逐字一致 |
| `src/components/styles/Slider.scss` 的 focus 环 fallback | 2 | 已知潜在问题（`rgba(hsl(...), 0.2)` 语法非法，但全项目 60+ 处同写法）；单独修正会造成不一致 |
| `border-radius: 50%` | 约 60（混在圆角命中中） | 圆形几何形状，非圆角 Token 场景 |
| `line-height: 1` | 17 | 图标/单行居中归一化，替换为 `$line-height-tight`(1.25) 会破坏居中 |
| `scss/z-index`（83 处） | 83 | 改 z-index 有层叠回归风险，且现有层级（99999 等）已成事实约定，收益低于风险 |
| `scss/legacy-spacing-alias` 的 superPanel 内部使用 | 20 | 模块内合法（别名在 `superPanel/styles/variables.scss` 定义）；仅建议更名消除歧义，不必强制改值 |
| `scss/line-height` 的无 Token 值（33 处）与 px 值（11 处） | 44 | 无对应 Token；补 Token 属设计系统决策，非本轮硬编码治理范围 |
| AI 端点/模型集中定义（`src/api.ts` / `aiApi.ts` / `aiModels.ts` / `providers.ts` / `pricing.ts`） | — | 单一数据源的正当实现，符合「统一入口」而非违规 |
| 领域数据表中文（`shortcut/data/**`、`apiDebugger/types/index.ts`、`gitPush/types/gitConfigDesc.ts`、`docAnalysis/types/index.ts`、`imageCreation/types/coverStyles*.ts`、`skillLearning/data/**`） | 约 150（混在 i18n 命中中） | 外部工具命令名 / API 文档 / 平台专有名词 / 示例代码，i18n 化无收益且会破坏数据可读性 |
| `src/utils/settingsCrypto.ts` 的应用层加密密钥材料 | — | 既定设计（文件头已声明强度边界）；改为环境变量属伪安全提升，如需增强应接 OS 凭据管理器 |
| `src/components/**` 的中文默认 props（如 `emptyText: "暂无数据"`） | 约 120（混在 i18n 命中中） | 组件库刻意零 i18n 依赖以保证可外迁复用，文案由调用方注入 |
| `componentPreview/previewData/**` 的中文示例 | 约 200（混在 i18n 命中中） | 开发态演示数据，非产品 UI |

### 9.4 收尾动作

1. 全部批次完成后复跑 `node scripts/audit-hardcode.mjs`，将 `docs/hardcode-audit.data.json` 与本次基线 diff，确认目标规则命中归零、且无新增。
2. 保留 `scripts/audit-hardcode.mjs` 作为**长期回归守卫**：建议在改动 SCSS / i18n / 图标 / 统一入口相关代码后复跑一次。若需纳入 CI，可考虑在 `package.json` 增加 `"audit:hardcode": "node scripts/audit-hardcode.mjs"` 脚本（本次未改动 `package.json`）。
3. 若要长期压制噪音，可将 § 二 的 15 类例外与 § 9.3 的豁免文件在扫描器中进一步参数化（当前已代码化，扩展时只需追加 `I18N_DATA_TABLE_PATTERNS` / `CENTRAL_DATA_FILES` / `EXCLUDED_FILES` 条目）。

---

## 十、修复进度

### 第一轮（2026-09-11）：§ 8.2 首轮动手顺序 1–4 项

改动 6 个文件（5 改 + 1 新增），未执行 `pnpm lint` / `pnpm vite build`（按约定由用户执行）。

| # | 文件 | 改动 |
|---|---|---|
| 1 | `src/components/styles/Tag.scss` | `--b3-theme-destructive` → `--b3-theme-error`（3 处） |
| 2 | `src/components/styles/Badge.scss` | `--b3-theme-destructive` → `--b3-theme-error`（1 处） |
| 3 | `src/features/aiContentGenerator/components/styles/SkillPreviewModal.scss` | 删除弹窗主样式 `box-shadow: 0 8px 32px rgba(0,0,0,0.12)`（已有 `border` 兜底）；遮罩 `rgba(0,0,0,0.45)` → `rgba(0,0,0,0.5)` |
| 4 | `src/features/globalRelations/styles/index.scss` | 整体 Token 化重写：补 `@use "@/variables.scss" as *;`；字号/字重/行高/圆角/间距/过渡全部换 Token；无对应档位的值集中声明为 `$gr-*` 局部变量并标注 |
| 5 | `src/features/formatAssistant/index.vue` | 311 行内联 `<style>` 迁出，仅留 `@use "./styles/index.scss";` |
| 6 | `src/features/formatAssistant/styles/index.scss` | **新增**：承接迁出的样式并 Token 化；无对应档位的值集中声明为 `$fa-*` |

**本轮顺带修正的非硬编码项**（对齐 `AGENTS_STYLE.md`）：
- 8 处 `border: 1px solid var(--b3-theme-surface-lighter)` → `var(--b3-border-color)`（`--b3-theme-surface-lighter` 落在「相邻色陷阱」区间，不应用于画需区分的分隔线；作为背景填充的 3 处保留）
- `formatAssistant` 的 `.close-btn:hover` 背景 `rgba(0, 0, 0, 0.08)` → `var(--b3-list-hover)`；`.input-textarea` 字体栈 → `$vp-mono`
- `formatAssistant` 根容器补 `font-size: $font-size-xs`（`AGENTS_STYLE.md` 审查检查点 1）

**保留项（已注明理由）**：
- `$gr-accent: #06b6d4` 与 `icons.ts:328` 的 `globalRelations` 图标色成对，且全局 `$color-*` 无语义青色档位 → 标注 `// 无对应 Token` 保留
- `$fa-preview-bg: #fff`：预览区须固定白底以对齐微信公众号阅读态，无对应 Token → 标注保留
- `border-radius: 50%`（圆形几何形状）、`width/height: 28px`（图标按钮尺寸）保持原值

### 第二轮（2026-09-11）：B5 样式分离收尾 —— 全部剩余内联样式清零

改动 16 个文件（8 改 + 8 新增），使 `scss/in-vue-inline` 从 146 降至 **0**。

| # | 文件 | 改动 |
|---|---|---|
| 1 | `src/styles/app.scss` | **新增**：承接 `App.vue` 的 `.plugin-app-main` 宿主布局（原 16 行内联，纯布局无硬编码） |
| 2 | `src/App.vue` | `<style>` 内容迁出 → `@use "./styles/app.scss"` |
| 3 | `unitConverter/styles/BaseConverter.scss` | **新增**：`gap: 12px` → `$spacing-3`；`margin-left: 2px` → `$spacing-2px` |
| 4 | `unitConverter/components/BaseConverter.vue` | 迁出 + 双行导入 |
| 5 | `unitConverter/styles/BaseUnitConverter.scss` | **新增**：`gap: 12px` → `$spacing-3` |
| 6 | `unitConverter/components/BaseUnitConverter.vue` | 迁出 + 双行导入 |
| 7 | `unitConverter/styles/ASCIIConverter.scss` | **新增**：`gap: 8px` → `$spacing-2`、`padding: 4px 10px` → `$spacing-1` + 别名、`border-radius: 4px` → `$radius-sm`、字体栈 → `$vp-mono`、字重 → Token；无档位的 14/6/10/11px 集中为 `$ac-*` 别名 |
| 8 | `unitConverter/components/ASCIIConverter.vue` | 迁出 + 双行导入（保留 `@include index.label-style` 所需的 `index` 命名空间） |
| 9 | `video/styles/VideoDownloadDialog.scss` | **新增**：`gap: 8px` → `$spacing-2` |
| 10 | `video/components/VideoDownloadDialog.vue` | 迁出 + 双行导入 |
| 11 | `video/styles/VideoPlayerDialog.scss` | **新增**：`margin-top: 16px` → `$spacing-4`、`margin: 0 0 8px 0` → `$spacing-2`、`gap: 12px` → `$spacing-3`、`padding: 2px 8px` → `$spacing-2px $spacing-2`、`border-radius: 4px` → `$radius-sm`、字号/字重 → Token；无档位的 15/13px 集中为 `$vpd-*` 别名 |
| 12 | `video/components/VideoPlayerDialog.vue` | 迁出 + 双行导入 |
| 13 | `rssReader/styles/index.scss` | 追加 `.loading-icon`（承接 `index.vue` 内联规则，紧邻既有 `@keyframes spin`） |
| 14 | `rssReader/index.vue` | 删除内联规则 |
| 15 | `unitConverter/styles/index.scss` | 删除模块重复声明的 `$mono` 字体栈，7 处 `font-family` 改用全局 `$vp-mono`（`AGENTS_STYLE.md` 禁止各模块重复声明 `$vp-mono`） |
| 16 | `htmlViewer/components/SnippetLibrary.vue` | iframe `srcdoc` 内嵌 `<style>` 提取为具名常量 `PREVIEW_DOC_STYLE` |

**第二轮的例外认定**：`SnippetLibrary.vue` 的 `<style>` 是 `iframe srcdoc` 的**隔离文档样式**（`sandbox="allow-scripts"`，与插件样式表完全隔离，无法引用 SCSS Token），属合法例外而非内联违规。它是扫描器误报 —— 原 `scanVueStyleBlocks` 的正则会扫到 `<script>` 区域，**已修正为只扫描 SFC 顶层 `<style>` 块**（先以等长空白抹掉 `<script>` / `<template>`，保留行号）。

**顺带发现并修正的工具口径偏差**：`scss/z-index` 原本把 `z-index: 4` 这类局部层叠也计入（84 处 / 66 文件），与 § 三 声明的「≥ 1000 且 ≠ 10000」不符。已修正为只报「全屏遮罩级」层叠，命中降至 **39 处 / 32 文件**（本轮新增 `src/styles/app.scss` 的 `z-index: 4` 因此不再计入）。

### 第三轮（2026-09-11）：B1 间距 Token 化（164 文件全量）

**路线**：采纳 § 8.4 的路线 A —— 在 `src/_variables.scss` 新增两个全局档位，消除「约一半取值无 Token」的分水岭：

```scss
$spacing-6px: 6px;    // 沿用 $spacing-2px 的「值即名称」写法
$spacing-10px: 10px;
```

并把 `src/components/styles/_mixins.scss` 的重复字面量收敛为单一来源：

```scss
$gap-xs: $spacing-6px;        // 原 $gap-xs: 6px
$spacing-2_5: $spacing-10px;  // 原 $spacing-2_5: 10px
```

**执行方式**：脚本化 codemod（`scripts/codemod-spacing-tokens.mjs`，等值替换、默认干跑、可复跑、幂等）—— 151 文件 × 1200+ 处逐一手改不可靠且不可复核。

| 指标 | 数值 |
|---|---|
| 目标文件 | 164（`scss/spacing` 命中全集） |
| 实际改动文件 | 151 |
| 替换处 | 1202 处 / 涉及 977 行 |
| 自动补 `@use` | 0（全部文件已通过直接 / 相对路径 / `@forward` 链具备全局 Token） |
| 离线编译 | **151 / 151 通过，0 失败** |
| 幂等性复核 | 复跑 0 改动 |
| 源码改动规模（`git diff`） | ~987 行 / 151 个 SCSS 文件（`Tag.scss` 抽样 3/3，无行尾符扰动） |

**映射口径（纯等值替换）**

| 来源 | 映射 |
|---|---|
| px | 2→`$spacing-2px`、3→`$spacing-px`、4→`$spacing-1`、6→`$spacing-6px`、8→`$spacing-2`、10→`$spacing-10px`、12→`$spacing-3`、16→`$spacing-4`、20→`$spacing-5`、24/32/40/48/64→`$spacing-6/8/10/12/16` |
| rem | 0.25/0.5/0.75/1/1.25/1.5/2/2.5/3/4 → 对应 Token（**仅 rem → rem**） |
| 跳过 | `var()` / `calc()` / `#{}` 插值、`$var` 引用、`0` 值、负值 |

**两处刻意保守处理（保证「零语义变化」严格成立）**

1. **rem 不做 rem → px 映射**：`0.125rem`(2px) / `0.1875rem`(3px) / `0.375rem`(6px) / `0.625rem`(10px) 在 `compactMode/styles/index.scss` 有 8 处。`$spacing-2px` / `$spacing-6px` 是 **px** 值，映射过去会在「根字号 ≠ 16px」时改变结果（rem 相对根字号、px 绝对）→ **保持原字面量**，仅同声明内的 rem 值照常 Token 化（如 `(0.375rem * $s) (0.75rem * $s)` → `(0.375rem * $s) ($spacing-3 * $s)`）。
2. **负值与无 Token 档位保持原样**，不做「就近取 Token」的近似替换（那会改视觉）。

**未映射留存（239 处 / 94 文件，属真·无 Token 档位）**

| 值 | 处数 | 说明 |
|---|---|---|
| 1px | 82 | 发丝线 / 边框合并（含 `margin: -1px`） |
| 5px | 54 | 无对应档位 |
| 14px | 46 | 组件库既有的「原值减 2px」档 |
| 7px | 11 | 无对应档位 |
| 18px / 28px / 30px / 9px / 36px / 11px / 15px / 22px / 35px | 各 1–7 | 零散档位 |
| 0.375rem / 0.125rem | 6 / 2 | rem 相对单位，按上条第 1 点保留 |
| `-1px` / `-50px` / `-0.375rem` | 3 | 负值 |

→ 这批需要**设计决策**而非机械替换：①补全局 Token；②就近取 Token（会改视觉）；③标注 `// 无对应 Token` 保留（现状）。

**本轮最重要的坑（已记入工具）**：codemod 需要判断「某文件能否直接用裸 `$spacing-*`」。初版只匹配 `@/variables.scss` 这一种拼写，判定出「133 个文件需补导入」——而实际上这些文件早已通过 `@use "../../../variables" as *;`（相对路径）或 `@use "./variables" as *`（`superPanel/styles/variables.scss` **`@forward` 了全局**）拿到 Token。若照此插入，会因**重复加载同一模块**而编译失败。已改为按 Sass 语义的模块解析（`resolveScss` + `forwardsGlobalTokens` + `hasGlobalTokens`，**只沿 `@forward` 链递归**，不沿 `@use` 链——后者不传递成员），修正后「需补导入」归零。

### 第四轮（2026-09-11）：B2 圆角 + 字体族

**圆角**：`scss/border-radius` 的取值分布暴露了与 B1 同型的缺口 —— **2px(38) + 3px(32) 占 125 处中的 70**，而圆角 Token 表只有 4/6/8/12/16/24px 档。沿用 B1 的做法新增两档：

```scss
$radius-2px: 2px;   // 沿用 $spacing-2px 的「值即名称」写法
$radius-px: 3px;    // 沿用 $spacing-px 的写法
```

**字体族**：修正两处扫描器误报后，`scss/font-family` 从 120 处降到 **5 处真实违规**（其余 115 处是 `stats.$font-mono` 这类**带命名空间的变量引用**，本就已指向 `$vp-mono`）。5 处已手工改完 → 归零。

| 指标 | 数值 |
|---|---|
| 圆角：目标 / 改动 | 57 / **52** 文件，**110 处 / 107 行** |
| 圆角：离线编译 | **52 / 52 通过，0 失败** |
| 圆角：自动补 `@use` | 1（`statistics/styles/_mixins.scss`，原本无任何导入） |
| 圆角：整文件跳过 | 2（见下） |
| 字体族 | 5 处硬编码字体栈 → `$vp-mono` / `$font-zh`，已归零 |
| 结果 | `border-radius` 125 → **16**（消除 87%）；`font-family` 120 → **0** |

**圆角映射（等值）**：2px→`$radius-2px`、3px→`$radius-px`、4px→`$radius-sm`、6px→`$vp-radius`、8px→`$radius-md`、12px→`$radius-lg`、16px→`$radius-xl`、24px→`$radius-2xl`、9999px→`$radius-full`；`border-radius: 50%`（圆形几何）按 § 9.3 不动。

**本轮新增的 codemod 守卫（第 3 次踩到同类坑）**：部分文件已有 `@use "variables" as *;`（**裸包名**，Sass 会优先解析到同目录的本地 `_variables.scss`）。给它们再补 `@use "@/variables.scss" as *;` 会因**两个 `*` 命名空间成员同名**而编译失败。已加 `canSafelyAddStarImport`：若已存在解析不到全局的 `as *` 导入，**整文件跳过**（不替换、不写盘、进报告）。

| 跳过的文件 | 原因 | 已选处置 |
|---|---|---|
| `flashcardReading/styles/StatisticsView.scss` | 本地 `_variables.scss` 占用 `*` | 新增 `@use "@/variables.scss" as g;`，2 处改 `g.$radius-2px` |
| `floatingToolbar/styles/_mixins.scss` | 同上；且已有 `@use "@/variables.scss" as g;` | 直接复用现有 `g.` 命名空间，1 处改 `g.$radius-2px` |

> 顺带发现一处**同名不同值**隐患：`floatingToolbar/styles/_variables.scss` 定义 `$radius-md: 6px`（全局是 8px）、`$radius-full: 50%`（全局是 9999px）。该模块内部生效的是本地值，与全局语义不一致，建议后续收敛（本轮未动，避免改视觉）。

### 第五轮（2026-09-11）：B3 色值

**结论：色值不适用 B1/B2 那种机械全量替换。** 本轮先做可行性分析，确认安全子集后按**选项 B** 执行 —— 从 142 处「族总量」中逐条筛出真正可主题化的 **58 处**。

三个决定性事实：

**1. `$color-*` 不是替换目标。** `src/_variables.scss` 的开篇注释写得很明确：

```scss
// 用途：作为思源 CSS 变量（--b3-theme-*）的 fallback 值。
// 思源运行时必提供主题变量，fallback 仅作防御性兜底，基本不实际生效。
```

全局 Token 是 **hsl 语义色**（`$color-danger: hsl(0 72% 51%)`），项目里散落的是 **Tailwind 色阶**（`#ef4444`、`#94a3b8`）——**两者不存在等值关系**。改 `var(--b3-theme-*)` 必然改变色相/明度，而 B1/B2 之所以能放心跑 codemod，靠的正是「等值替换、零视觉变化」。

**2. 相当比例的硬编码是刻意设计，改了反而错。** 剔除豁免后的 265 处里：

| 类别 | 例子 | 为什么不能改 |
|---|---|---|
| 徽章白字 | `color: #fff` **37 处**（`ReviewPanel` / `AttrsPanel` 等） | 多为彩色徽章上的白字，是配色的另一半 |
| 黑白遮罩/阴影 | `rgba(0,0,0,α)` 28 处 | 几何效果，与主题无关 |
| 第三方品牌色 | `#609926`（Gitea）、`#00a8e8`（CNB）、`#2da44e`/`#cf222e`（GitHub） | 品牌识别色，须与设计稿一致 |
| 等级/排行金属色 | `#d4a017` 金 / `#8e9aa8` 银 / `#b87333` 铜 | 语义配色方案，须跨主题保持一致 |
| macOS 装饰色 | `#ff5f56` / `#ffbd2e` / `#27c93f` | 还原系统窗口按钮外观 |
| 调色板定义 | `--gp-diff-*`、`--stat-color-*`、`--status-color-*`、`$color-tier-*` | 调色板的职责就是集中声明字面量 |

**3. 项目已有集中调色板，说明「模块内定义语义调色板再引用」是既有模式**（`--gp-diff-*`、`--stat-color-*`、`--status-color-*`），并非所有色值都要收敛到 `--b3-theme-*`。

#### 剔除豁免后的真实分布（265 处 / 8 族）

| 色值族 | 处数 | 文件数 | 代表值 | 建议 |
|---|---|---|---|---|
| white | 54 | 33 | `#fff` / `rgba(255,255,255,α)` | 逐处判断（37 处是徽章白字，保留） |
| red | 39 | 16 | `#ef4444` / `rgba(239,68,68,α)` | 可主题化 → `--b3-theme-error` |
| green | 38 | 14 | `#22c55e` / `rgba(34,197,94,α)` | 可主题化 → `--b3-theme-success` |
| gray | 32 | 16 | `#94a3b8` / `#64748b` | 可主题化 → `--b3-theme-on-surface-variant` |
| other | 29 | 14 | 品牌色 / 等级色 / 装饰色 | **保留** |
| black | 28 | 20 | `rgba(0,0,0,α)` | **保留**（遮罩/阴影） |
| amber | 24 | 16 | `#f59e0b` / `rgba(245,158,11,α)` | 可主题化 → `--b3-theme-warning` |
| purple | 12 | 8 | `#8b5cf6` / `#a855f7` | 无对应主题变量，多为 tier 等级色 → **保留** |
| blue | 9 | 5 | `#3b82f6` / `#0ea5e9` | 可主题化 → `--b3-theme-info` |

「可主题化」合计 **142 处** —— 但每一处都会**改变视觉**（这是修复，不是回归：深色主题下写死的 `#ef4444` 本就有对比度问题）。

#### 本轮实际改动（两步）

**第一步：扫描器精度修正。** 新增 `colorLiteralExempt`，把**调色板定义**判为合法（CSS 自定义属性声明 `--*`、模块本地 `$color-*` 声明处）—— 调色板的职责就是集中声明字面量，使用点才需要引用变量。

**第二步：按选项 B 执行语义色主题化。** 14 文件 / **58 处**，离线编译 **14/14 通过，0 失败**。映射目标是 `var(--b3-theme-*)`（CSS 变量，无需补 SCSS 导入）：

| 族 | 色值 | 目标变量 | 处数 |
|---|---|---|---|
| red | `#ef4444` `#dc2626` | `var(--b3-theme-error)` | 16 |
| green | `#10b981` `#22c55e` `#16a34a` | `var(--b3-theme-success)` | 12 |
| gray（文字） | `#94a3b8` `#64748b` `#6b7280` | `var(--b3-theme-on-surface-variant)` | 18 |
| amber | `#f59e0b` `#d97706` | `var(--b3-theme-warning)` | 8 |
| blue | `#3b82f6` `#0ea5e9` `#2563eb` | `var(--b3-theme-info)` | 3 |
| gray（底/框） | `#f0f0f0` | `var(--b3-theme-surface)` / `var(--b3-border-color)` | 2 |

> **本轮踩的坑（值得记录）**：替换脚本为构造正则用 `from.slice(1)` 剥掉了 `#`，匹配到 `ef4444` 后替换成 `var(--b3-theme-error)`，结果拼出 **`#var(--b3-theme-error)` 这种非法值 —— 58 处全部中招**。
> 而 **Sass 离线编译 14/14 全部通过**：Sass 不校验 CSS 属性值的合法性，`color: #var(...)` 被当成一个普通值原样输出。
> **教训：编译通过 ≠ 正确。** 机械替换后必须抽查产物内容。本次先靠抽查发现，随后补了一次全库 `#var(` 扫描确认清理干净，并复查了 B1/B2 的圆角/间距产物（均为合法 Token 引用，未受同类影响）。

**58 与 142 的差额**（逐条审阅后判定为不可改）：

| 剔除项 | 约数 | 理由 |
|---|---|---|
| rgba 低透明度变体 | 45 | 无干净等价物；`--b3-theme-error-rgb` + `rgba(var(...), α)` 会踩项目既有的 `rgba(hsl(...), α)` 语法坑 |
| 图表配色 | 15 | 带 `// REPORT_CHART_COLORS.*`、`// chartConfig *` 注释，须与 TS 侧调色板逐字一致 |
| 语义徽章 | 8 | `heading-badge-h1~h6`（标题等级）、`lang--*`（语言分类）、`--gitee`（平台品牌） |
| 配套配色组 | 6 | 见下 |

**整体保留的配套配色**（单独改其中任一色都会破坏设计完整性）：

| 配色组 | 色值 | 位置 | 理由 |
|---|---|---|---|
| AntD success 提示框 | `#f0fff4` 底 / `#b7eb8f` 边 / `#135200` 字 / `#52c41a` | `htmlViewer/styles/index.scss` | 四色成套 |
| slate 深色卡片 | `#1e293b` 底 / `#e2e8f0` 字 / `#334155` 边 | `skillLearning` 的 `SkillDialog` / `_shared` | 三色成套；只改字色会在深底上对比度不足 |
| 暗色编辑器 | `#e0e0e0` | `docAnalysis/styles/MarkdownEditor.scss` | 暗色编辑区文字，改后在浅色主题下对比度反转 |

> 顺带记录一处隐患：`statistics/styles/index.scss` **重新定义了** `$color-danger: #cf222e;` 等与全局同名的变量（模块本地覆盖）。全局 `$color-danger` 是 `hsl(0 72% 51%)`，两者不是同一个值，混用会导致 fallback 行为不一致。

### 第六轮（2026-09-11）：B4 间距收尾

上一轮判断「剩余 239 处里 `1px`(82) 大概率是边框宽度误报」—— **这个猜测是错的**。实际分布是 `padding: 1px` 62 + `gap: 1px` 8 + `margin-*: 1px` 12，都是真实间距，不是边框。真正的收获是另外三点：

**1. `em` 单位应豁免（约 37 处）。** 剩余项里有 `margin: 0.3em 0`、`margin: 0.4em 0`、`padding-left: 1.4em` 等，全部集中在 Markdown 内容排版（`:deep(p)` / `:deep(ul)`）。em 是**相对字号的排版单位**，换成 px Token 会破坏文本缩放。已给 `scss/spacing` 加豁免：值全部为 em（非 rem）时不计违规。

**2. 补 5 个高频 px 档位，覆盖 190 处。** 此前的 px Token 只有 2px / 3px / 6px / 10px 四档，而剩余 239 处的 TOP 值是 `1px`(82) / `5px`(53) / `14px`(39) / `7px`(10) / `18px`(6) —— **全部没有 Token，这才是它们一直没被替换的真正原因**（不是缺 `@use`）。

```scss
$spacing-1px: 1px;    // 极细间距（紧凑控件内边距、细分隔线间距）
$spacing-5px: 5px;    // 紧凑内边距（介于 $spacing-1=4px 与 $spacing-6px=6px 之间）
$spacing-7px: 7px;    // 表单控件内边距（gitPush / passwordVault 长期使用的微调值）
$spacing-14px: 14px;  // 卡片水平内边距（组件库由 16px 微调而来）
$spacing-18px: 18px;  // 宽松卡片内边距（组件库由 20px 微调而来）
```

命名沿用既有的「值即名称」族，且**只补 `$spacing-1~16`（4/8/12/16/20/24…）未覆盖的非 4 倍数**，避免与 rem 档位语义重复。

**3. 收尾：23 处过时注释。** B1/B2/B4 新增 Token 后，一批 `// 无对应 Token` 注释变得**自相矛盾**（如 `padding: $spacing-6px; // 水平 6px 无对应 Token`）。这类注释会误导后续维护，还会让扫描器误豁免，已统一改为「已收敛为全局 Token」。

| 指标 | 数值 |
|---|---|
| em 豁免 | 约 37 处（排版相对单位） |
| 新增 Token | 5 个 px 档位 |
| codemod 执行 | **86 文件 / 201 处 / 185 行**，`需补 @use` **0** |
| 离线编译 | **86 / 86 通过，0 失败** |
| 产物抽查 | 无可疑写法（`padding: $spacing-14px $spacing-18px` 等形式正确） |
| 跳过 | 1（`flashcardReading/styles/StatisticsView.scss`，本地 `_variables.scss` 占 `*` 命名空间，与 B2 同一处） |
| 结果 | `scss/spacing` **1139 → 28**（消除 **97.5%**）；总命中 1904 → **1693** |

剩余 28 处为 `0.375rem`(6) / `28px`(3) / `30px`(2) / `9px`(2) / `36px`(2) / `0.125rem`(2) 等零散值与负值（`-1px` / `-50px` 偏移），均属「零散到不值得为它新增一档」或负值偏移，保持原样。

### 累计命中变化（扫描器复跑，同一 31 条规则口径）

| 指标 | 初始基线 | 一轮 | 二轮 | 三轮（B1） | 四轮（B2） | 五轮（B3） | 六轮（B4） | 累计变化 |
|---|---|---|---|---|---|---|---|---|
| 总命中 | 3613 | 3288 | 3098 | 2227 | 1998 | 1904 | **1693** | **−1920**（消除 **53.1%**） |
| P1 | 1422 | 1139 | 993 | 993 | 993 | 993 | 993 | −429 |
| P2 | 2076 | 2034 | 2034 | 1163 | 934 | 840 | 629 | −1447 |
| P3 | 115 | 115 | 71 | 71 | 71 | 71 | 71 | −44 |

**已归零的规则**：`scss/in-vue-inline` 402→0、`scss/undefined-token` 4→0、`scss/font-weight` 5→0、`scss/font-family` 120→0。
**接近归零**：`scss/spacing` 1139→**28**、`scss/border-radius` 132→**16**。

| ruleId | 初始 | 第二轮后 | 说明 |
|---|---|---|---|
| `scss/in-vue-inline` | 402 | **0** | 9 个内联样式文件全部清零（`formatAssistant` + 本轮 8 个） |
| `scss/undefined-token` | 4 | **0** | `Tag.scss`(3) + `Badge.scss`(1) |
| `scss/font-weight` | 5 | **0** | `globalRelations` 已全部 Token 化 |
| `scss/font-family` | 120 | **0** | 已归零：115 处是带命名空间的变量引用误报（修正扫描器），5 处真实硬编码字体栈已改 `$vp-mono` / `$font-zh` |
| `scss/border-radius` | 132 | **16** | −116（B2 已执行，消除 88%；余量为 10px/20px/1px/7px/14px 零散档） |
| `scss/spacing` | 1139 | **239** | −900（B1 全量执行，消除 79%；余量为真·无 Token 档位） |
| `scss/color-literal` | 288 | 287 | −1 |
| `scss/color-functional` | 167 | 165 | −2 |
| `scss/transition-duration` | 133 | 131 | −2 |
| `scss/border-radius` | 132 | 125 | −7 |
| `scss/line-height` | 58 | 55 | −3 |
| `scss/font-size` | 28 | 13 | −15 |
| `scss/box-shadow` | 37 | 36 | −1 |
| `scss/z-index` | 83 | 39 | 口径修正为主因（见上） |

> 样式分离后，原本位于 `.vue` 的内联样式开始被 SCSS 规则扫描（如 `padding: 4px 10px`、`border-radius: 4px`），这部分命中已随迁出**同步 Token 化**，未成为新增违规。

### 验证记录

| 轮次 | 验证项 | 结果 |
|---|---|---|
| 一 | IDE 诊断（`read_lints`） | 6 个文件 0 错误 |
| 一 | Sass 离线编译 | `globalRelations/styles/index.scss`、`formatAssistant/styles/index.scss` 编译通过 |
| 一 | SFC 结构校验 | `formatAssistant/index.vue` 439 行，模板/脚本/样式块各恰好一对 |
| 二 | IDE 诊断（`read_lints`） | 5 个 `.vue` + 扫描器 0 错误 |
| 二 | Sass 离线编译 | 本轮 8 个 SCSS 全部编译通过（含 `ASCIIConverter.scss` 的 `index` 命名空间 mixin 调用） |
| 二 | 扫描器复跑 | `scss/in-vue-inline` 归零，各 scss 规则无新增命中 |
| 三（B1） | 离线编译 | 151 个变更 SCSS 全部通过，**0 失败** |
| 三（B1） | 幂等性复核 | 复跑 codemod 输出 0 改动 |
| 三（B1） | 抽样 diff 复核 | `Tag.scss` 3/3、`MilestoneRuleEditor.scss`、`compactMode/index.scss` 均为纯等值替换，无结构改动、无行尾符扰动 |
| 三（B1） | IDE 诊断 | codemod 脚本 0 错误 |
| 四（B2） | 离线编译 | 圆角 52/52 + 人工处理的 7 个文件全部通过，0 失败 |
| 四（B2） | 幂等性复核 | 泛化后对间距规则复跑仍为 0 改动（B1 结果未被破坏） |
| 四（B2） | IDE 诊断 | `codemod-hardcode-tokens.mjs` 与 `audit-hardcode.mjs` 均 0 错误 |

### 下一轮建议

B1~B4 已把「可等值替换」的部分基本做完。盘点剩余项时有个**关键认知**，它决定了还有什么是能机械替换的：

> B1/B2/B4 能放心跑 codemod，靠的是**「值即名称」Token 可以按需新增**（`$spacing-7px`、`$radius-2px`），从而实现**等值替换**。
> 而 `line-height` / `transition-duration` 是**语义档位 Token**，值域固定，替换必然改变表现。

**还能机械收尾的（推荐下一轮 B5）**：

| 剩余项 | 量 | 做法 |
|---|---|---|
| `scss/border-radius` | 16（13 文件） | 等值扩 Token：`10px`(4) / `20px` / `1px` / `7px` / `14px`，照 B2 的「值即名称」写法补 5 档即可收尾 |
| 模块局部变量收敛 | 约 15 | `globalRelations` 的 `$gr-space-1/5/6/7/10/14`、`unitConverter` 的 `$ac-space-6/10/14`、`formatAssistant` 的 `$fa-space-6/10` 现在都有全局 Token 了，可改为委派（`$gr-space-6: $spacing-6px;`）或直接用全局 Token |
| `scss/legacy-spacing-alias` | 20（2 文件） | `superPanel` 本地 `$spacing-xs/sm/md/lg` 与全局 `$spacing-1~4` 语义重叠，建议更名 `$sp-*` 消除歧义 |

**不建议机械处理的大项**（改了会改变表现，或需语义判断）：

| 项 | 量 | 为什么 |
|---|---|---|
| `scss/line-height` | 55（41 文件） | Token 只有 `1.25 / 1.5 / 1.75`，实际值却是 `1.4`(13) / `1.6`(8) / `1.7`(6) / `1.3`(3) / `1.65` / `2`；`1`(17) 属图标居中归一化应保留 |
| `scss/transition-duration` | 131（72 文件） | 规范要求统一 `0.12s ease`，实际却是 `0.15s`(40+) / `0.2s`(20) / `0.3s`(8) / `0.6s`(4)。`width 0.6s ease` 这类进度条动画改 0.12s 会明显変快 |
| `scss/spacing` | 28（17 文件） | 剩余是 `0.375rem`(6) / `28px`(3) / `30px`(2) / `36px`(2) 等零散值与负值偏移，为零星几处新增档位不划算 |

**P1 专项治理项**（与 SCSS Token 化不同源，建议独立排期）：

| 项 | 量 | 为什么不能机械做 |
|---|---|---|
| i18n 系列（fallback-cn / static-attr-cn / text-node-cn / script-ui-cn） | 609 | 需同步补 `zh_CN` + `en_US` 分片键，且要判断每处是否真该走 i18n |
| `icon/unknown-name` | 232（77 文件） | 需 `pnpm validate:icons` 逐个核实注册状态 |
| `scss/box-shadow` | 36（11 文件） | 卡片主样式阴影改边框涉及视觉，需设计确认 |
| `const/magic-number` | 53（23 文件） | 需逐个判断语义后提取具名常量 |

**积累的三个「同名不同值 / 语义重叠」隐患**（建议后续专项收敛，均非本轮引入）：

1. `floatingToolbar/styles/_variables.scss`：`$radius-md: 6px`（全局 8px）、`$radius-full: 50%`（全局 9999px）
2. `statistics/styles/index.scss`：重新定义 `$color-danger: #cf222e` 等与全局同名的变量，值与全局 hsl 语义色不一致
3. `superPanel/styles/variables.scss`：`$spacing-xs/sm/md/lg` 与全局 `$spacing-1~4` 语义重叠

**B1 遗留的 239 处无 Token 档位需要一次设计决策**（`1px` 82、`5px` 54、`14px` 46、`7px` 11 为主）：

| 选项 | 影响 |
|---|---|
| 补全局 Token（如 `$spacing-1px` / `$spacing-5px` / `$spacing-14px`） | 一举清零，但设计 Token 表会从「克制」变「枚举」；`1px` 多为发丝线语义，不属间距档 |
| 就近取 Token | 会改视觉（如 5px→4px 或 8px），**与「等值替换」原则冲突** |
| 标注 `// 无对应 Token` 保留 | 零风险，但字面量仍在（仅被扫描器豁免） |

建议：只对**反复出现的 5px / 14px** 考虑补 Token，`1px`（发丝线）与零散档位标注保留。
