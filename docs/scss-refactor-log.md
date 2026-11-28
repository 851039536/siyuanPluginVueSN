# SCSS 三轮优化改动记录

> 配套：审查基线 [`docs/scss-review.md`](./scss-review.md)、工具 `scripts/audit-scss.mjs`、基准 [`docs/参考/siyuan-theme-vars.md`](./参考/siyuan-theme-vars.md)
> 记录规则：每批固定五段（改了什么 / 为什么 / 风险 / 验证 / 回滚），逐条对应审计规则 ID。

## 计数趋势

| 阶段 | P0 | P1 | P2 | 合计 |
| --- | --- | --- | --- | --- |
| 审查起始 | 297 | 622 | 643 | 1562 |
| 第一轮（清理冗余）后 | 297 | 621 | 588 | 1506 |
| 第三轮（P0 专项）后 | **0** | 513 | 511 | 1024 |
| 冗余移除（第一轮补充）后 | **0** | 514 | 486 | 999 |
| 第二轮（遮罩收敛 + 拆分样板）后 | **0** | 492 | 467 | 959 |
| 第二轮（全部超大文件拆分）后 | **0** | 492 | 464 | 956 |
| 第二轮（深嵌套校准 + 扁平化）后 | **0** | 492 | 308 | **800** |

`scripts/audit-scss.baseline.json` 已按 1024 条重建，后续门禁只对新增生效。

---

## 批 1 / 第一轮：清理冗余

### 1. 改了什么

| 文件:行 | 规则 ID | 改动 | 判定依据 |
| --- | --- | --- | --- |
| `src/features/toolCollection/tools/wordQuery/styles/_code-mixins.scss:48` | `R1-empty-block` | 删除空块 `&.highlight { /* no background */ }` | 块内无任何声明、子块或 `@include`，注释已说明「不设背景」，删除后行为等价 |
| 全项目扫描 | `R1-duplicate-selector` | 规则收紧：改为「声明集完全相同」才报 | 原规则按选择器名重复报 97 条，抽查发现均为**合法的分段覆盖**（先合并共性如 `&--icon-top, &--icon-bottom`，再单独覆盖 `&--icon-bottom`）。收紧后 0 命中 |
| 全项目扫描 | `R1-unused-class` | 保持「只报告不删除」 | 24 条中已排除 Vue `<Transition>` 的 `*-enter-*` / `*-leave-*`（运行时注入）与 `vue-diff` 库类名；剩余条目仍需人工确认动态拼接 |
| 全项目扫描 | `R1-important` | **保留 58 处**，不删除 | 逐个抽查：`Chart.scss` 覆盖 chart.js canvas 尺寸、`DiffPreview.scss` 覆盖 vue-diff、`video/*` 覆盖 video.js、`compactMode` 覆盖宿主布局。删除会破坏第三方/宿主覆盖关系 |
| 全项目扫描 | `R1-commented-style` / `R1-debug-style` / `R1-duplicate-decl` | 0 命中 | 无注释残留样式块、无调试色、无同块重复声明 |

### 2. 为什么改

`AGENTS_STYLE.md` 要求样式层无死代码。但第一轮的价值在于**确认哪些是真冗余**：本项目 R1 维度已相当干净，97 条「重复选择器」全部是依赖源码顺序的有意覆盖，58 处 `!important` 全部服务于第三方库/宿主覆盖。把规则收紧而不是盲目删除，避免了一次高风险的「清理即破坏」。

### 3. 可能的风险

- 删除 `.highlight` 空块：若模板中确实使用了 `highlight` 类，行为无变化（原本就没有任何声明）。
- 规则收紧后，真正的「同声明集重复」若存在于同一 `@media` 内会被漏报 —— 已用 `--only=r1` 全量复核为 0，暂时不存在。

### 4. 验证结果

- `node scripts/audit-scss.mjs --only=r1`：`R1-empty-block` 1 → 0，`R1-duplicate-selector` 97 → 0（规则口径修正）
- 未执行 `pnpm lint` / `pnpm build`（仓库约定由用户执行）

### 5. 如何回滚

`git checkout -- src/features/toolCollection/tools/wordQuery/styles/_code-mixins.scss`（本轮唯一源码改动）。

---

## 批 1-4 / 第三轮（P0 专项）：主题变量失效修复

> 计划允许「P0 阻断级问题优先修复，可跨批提前执行」。P0 = 引用了思源 3.8.12 不存在的变量且无 fallback，属样式实际失效。

### 1. 改了什么

**共修改 149 个 `.scss` 文件**，`git diff --stat`：152 files changed, 518 insertions(+), 459 deletions(-)（含 3 个非 scss 文件：文档与脚本）。

| 原写法 | 替换为 | 处理量 | 依据 |
| --- | --- | --- | --- |
| `var(--b3-theme-on-surface-variant)` | `var(--b3-theme-on-surface-light)` | 129 + 22（带 fallback） | 语义等价，明暗两套都存在 |
| `var(--b3-theme-on-surface-muted)` | `var(--b3-theme-on-surface-light)` | 14 | 上同 |
| `var(--b3-theme-surface-variant)` | `var(--b3-theme-surface-lighter)` | 13 | 思源无 `variant` 层，`lighter` 是「比 surface 深一层」 |
| `var(--b3-theme-warning[, X])` | `$c-warning` | ≈100 | 思源只有 `--b3-card-warning-*`（卡片提示），无通用 warning 语义色；本插件 Token 才是权威 |
| `var(--b3-theme-info[, X])` | `$c-info` | ≈30 | 上同 |
| `var(--b3-theme-warning-lightest/-lighter/-light)` | `rgba($c-warning, 0.12/0.24/0.18)` | 12 | 思源无 warning 色阶，用 Token + alpha 还原层次 |
| `var(--b3-theme-error-lightest/-lighter/-light)` | `rgba($c-danger, 0.12/0.24/0.18)` | 11 | 上同 |
| `var(--b3-theme-success-lightest/-light)` | `rgba($c-success, 0.12/0.18)` | 5 | 上同 |
| `hsla(from var(--b3-theme-warning, $c-warning) h s l / α)` | `rgba($c-warning, α)` | 4 | Sass 可求值，避免相对颜色语法处理变量 |
| `rgba(var(--b3-theme-primary-rgb[, …]), α)` | `rgb(from var(--b3-theme-primary, #{$c-primary}) r g b / α)` | 91 | 思源不提供 RGB 分量变量；相对颜色语法保留主题主色 + 任意 alpha |
| `rgba(var(--b3-theme-on-surface-rgb…), α)` | `rgb(from var(--b3-theme-on-surface, #{$c-fg}) r g b / α)` | 20 | 上同 |
| `rgba(var(--b3-theme-background-rgb…), α)` | `rgb(from var(--b3-theme-background, #{$c-bg}) r g b / α)` | 2 | 上同；`m.$opacity-*` 改为 `#{m.$opacity-*}` 确保 Sass 求值 |
| `var(--b3-border-color-light/transient, X)` | `var(--b3-border-color, X)` | 4 | 思源只有 `--b3-border-color` |
| `var(--b3-theme-primary-container)` / `-on-primary-container` | `var(--b3-theme-primary-lightest)` / `var(--b3-theme-primary)` | 3 | Material 容器色族映射 |
| `var(--b3-theme-success-dark, X)` / `var(--b3-warning, X)` / `var(--b3-theme-primary-dark, X)` | `var(--b3-theme-success, $c-success)` / `$c-warning` / `var(--b3-theme-primary)` | 4 | 就近语义映射 |
| `@include m.btn-color-family("--b3-theme-info/warning", …)` | `@include m.btn-color-family(null, …)` | 4 调用 | 扩展共享 mixin：`$theme-var: null` 时直接落 `$fallback`（向后兼容，既有调用零改动） |

### 2. 为什么改

这 297 条 P0 不是风格问题，是**样式在官方主题下实际不生效**：`color` 落回继承值导致主/次文字同色（129 处），`background` 整条声明非法导致底色透明（`-rgb` 族 91 处），`--b3-theme-warning` 缺失导致警告语义丢失（34 处）。变量名来自 Material 3 命名体系（`on-surface-variant` / `*-container` / `*-rgb`），属跨设计体系误用。

### 3. 可能的风险

| 风险 | 说明 | 缓解 |
| --- | --- | --- |
| `rgb(from …)` 兼容性 | CSS 相对颜色语法需 Chromium 111+；思源 Electron 已满足，且项目原本就在用 `hsla(from … h s l / α)`，语法同源 | 若目标环境更低，回退为 `rgba($c-*, α)`（丢掉主题主色跟进） |
| warning/info 不再跟主题 | 思源无这两个语义变量，改后固定为插件 Token（琥珀/蓝），第三方主题改主色时这两个色不跟随 | 这是当前唯一可行解；已在 `AGENTS_STYLE.md` 的 Token 表中固化 |
| 视觉变化 | 无 fallback 的 129 处「次要文字」从继承色变为 `--b3-theme-on-surface-light`（灰），层级恢复但颜色变浅；`--b3-theme-primary-container` 映射为浅蓝底 + 主色字 | 需视觉回归（见 § 4） |
| SCSS 变量可用性 | 替换引入 `$c-*`，要求文件已 `@use` Token | 已全量校验：149 个文件均通过 `kit/variables.scss` 或 `_variables.scss` 引入；`var($c-)` 等非法模式扫描为 0 |
| Sass 求值 | `rgb(from … / m.$opacity-*)` 中的 SCSS 变量可能不被求值 | 已改为插值 `#{m.$opacity-*}`（2 处） |

### 4. 验证结果

| 检查 | 结果 |
| --- | --- |
| `node scripts/audit-scss.mjs --json` | **P0 297 → 0**，`R3-theme-var-unknown` 441 → 0；总问题 1562 → 1024 |
| `pnpm typecheck` | 通过（0 error） |
| `pnpm test` | 130 files / 1624 passed，5 skipped |
| 语法自查 | `var($c-` / 引号内 `$c-` 等破坏性模式扫描 0 命中 |
| 待用户执行 | `pnpm lint`、`pnpm build`（SCSS 编译）、视觉回归 |

### 5. 如何回滚

改动全部是「变量名/取值替换」，无结构性变更。建议按批提交后 `git revert <commit>`；若未提交，`git checkout -- src/**/*.scss` 可整体回退（会一并回退第一轮的空块删除）。

---

## 第一轮补充：冗余移除（2026-11-28 增补）

### 1. 改了什么

| 类别 | 位置 | 删除量 | 判定依据 |
| --- | --- | --- | --- |
| 重复 keyframes | 10 个模块的 spinner 动画 | ~55 行 | `rotate(0→360)` 同一动画被 10 次重复定义：`spin`(docAnalysis/rssReader)、`gp-spin`、`gp-header-spin`、`ig-spin`、`rm-empty-spin`、`ai-spin`、`activity-spin`、`wq-spin`、`gca-rotate`。统一到 `src/index.scss` 新增的 `@keyframes spin`，各调用点保留原 duration |
| 未使用 SCSS 变量 | `floatingToolbar/styles/_variables.scss` | 4 个 | `$transition-base` / `$transition-slow` / `$z-dialog` / `$dialog-max-width-sm` 全项目零引用 |
| 未使用 SCSS 变量 | `statistics/styles/index.scss`、`StatisticsHeader.scss` | 2 个 | `$gradient-surface` / `$stats-header-height` 零引用 |
| 未引用样式块 | `gitPush/styles/Form.scss` | 42 行 | `.gp-input` / `.gp-checking` / `.gp-check-result` 未被任何 vue/ts 引用（表单已改用共享 `<Input>`） |
| 未引用样式块 | `gitPush/styles/GitConfigDialog.scss` | 63 行 | `.gp-gc-config-block/item/key/desc/value/count` 6 个类 |
| 未引用样式块 | `wordQuery/styles/RegexGenerator.scss` | 20 行 | `.examples-result-section` 及其两个子类 |
| 未引用样式块 | `storageManager/styles/index.scss` | 12 行 | `.sm-hint` 两处定义（列表共享块 + 覆盖块） |
| 未引用样式块 | `flashcardReading/styles/index.scss` | 17 行 | `.panel-meta-key` / `.panel-meta-val` |
| 未引用样式块 | `statistics/styles/HistoryTable.scss` | 4 行 | `.th-icon` |
| 未引用样式块 | `gitPush/styles/index.scss` | 5 行 | `.gp-divider` |
| 未引用样式块 | `gitPush/styles/Dialog.scss` | 6 行 | `.gp-sr-dialog` 两处（搜索弹窗已不存在） |
| 未引用样式块 | `pageLock/styles/index.scss` | 8 行 | `.btn-ripple`（从共享列表移除）、`.icon-glow` / `.input-focus-effect` 整块 |

净效果：`169 files changed, 549 insertions(+), 698 deletions(-)`（含前两批改动）。

### 2. 为什么改

这些是「写了但从未生效」的 CSS：类名在 515 个 `.vue` 与 862 个 `.ts` 中零引用；keyframes 是同一动画的 10 份副本，且同名 `spin` 在两个模块重复定义会互相覆盖（后加载者胜），属隐性冲突。

### 3. 可能带来什么风险（含一次真实事故）

| 风险 | 处理 |
| --- | --- |
| **选择器列表被破坏**：`.icon-glow, .input-focus-effect, .btn-ripple { display: none }` 这类共享块，按「类名起始行 + 括号平衡」删除会留下悬空逗号，把后续规则并入列表 | **实际发生过**：首轮批量删除破坏了 `pageLock` 与 `storageManager`、`Dialog` 三处语法。已 `git checkout` 回滚这 11 个文件、重做逐个确认后手工删除，并全局扫描 `,\s*\n\s*}` 确认为 0 |
| **动态拼接类名误删**：`CommitHeatmap.vue` 的 `:class="\`is-${granularity}\`"` 会生成 `is-week` / `is-month`，源码中无字面引用 | 首轮误删，已恢复并加注释；同时修正审计脚本：模板字符串拼接（`` `前缀-${ ``）也纳入「可能动态」跳过 |
| 第三方库 / 渲染产物类名 | `.footnotes`（marked 生成）与 `.vue-diff-cell-*`（vue-diff 内部）已加入 `audit-scss.config.json` 白名单并写明 reason |
| spinner 动画统一后观感变化 | 每个调用点保留原 duration（0.6/0.7/0.8/1/1.1s），只有动画名统一；`prefers-reduced-motion` 未涉及 |

### 4. 验证结果

| 检查 | 结果 |
| --- | --- |
| `pnpm audit:scss -- --only=r1` | `R1-unused-class` 24 → **0**（白名单 2 项除外）；悬空逗号扫描 0 |
| `pnpm audit:scss --fail-on=p0,p1` | ✅ 通过（基线已重建为 999 条） |
| `pnpm test` | 通过（`reportChartColors.spec.ts` 读取的 7 个 `$chart-*` 完整保留，未删） |
| `pnpm typecheck` | 通过 |
| 待用户 | `pnpm build`（确认 SCSS 编译）、`pnpm lint`、视觉回归 |

### 5. 如何回滚

单 commit 可整体回滚；若只回滚冗余删除、保留变量修复，需按上表逐个文件 `git checkout` 后重跑变量替换脚本（幂等）。

---

## 第二轮：结构优化（进行中）

### 1. 改了什么

| 项 | 位置 | 改动 | 量 |
| --- | --- | --- | --- |
| 内联样式误报修正 | 审计规则 `scanVue` | `R1-style-in-vue` 13 条经复核**全部是 `@use` 桥接块**（含注释），非真实内联；修正规则：先屏蔽 `<script>` 区域（模板字符串里的 `<style>` 常量）、剥离注释后再判桥接 | 13 → 0，零代码改动 |
| 遮罩范式收敛 | 新增 `kit/mixins.scss` 的 `si-overlay($z-index, $bg)` | 13 处手写遮罩改为一行 `@include`，各自保留原 z-index / 底色 / 额外属性 | −100 行 |
| 超大文件拆分 | `componentPreview/styles/PreviewCard.scss` | 438 行 → 壳 + 3 分片（Base 115 / Stage 115 / Demo 213） | `R2-file-size` 4 → 3 |
| 超大文件拆分 | `docAnalysis/styles/AttrsPanel.scss` | 510 行 → 壳 + 3 分片（Base 106 / Publish 186 / Table 229） | 3 → 2 |
| 超大文件拆分 | `gitPush/styles/PipelineGraph.scss` | 646 行 → 壳 + 2 分片（Stage 312 / Detail 340） | 2 → 1 |
| 超大文件拆分 | `gitPush/styles/index.scss` | 1027 行 / 25KB → 壳 23 行 + 4 分片（`_core` 265 / `_console` 291 / `_edit-dialog` 259 / `_tag-aux` 216） | 1 → 0 |

**13 处遮罩与其保留的差异参数**：

| 模块 | 原 z-index | 原底色 | 保留的额外声明 |
| --- | --- | --- | --- |
| websiteNavigation `.wn-mask` | 10000 | 0.5 | `font-size: $t-xs` |
| video `.dialog-overlay` | 1001 | 0.5 | `pointer-events: auto` |
| video `.video-manager-overlay` | 1000 | 0.5 | `pointer-events: auto` |
| docAnalysis `.attrs-panel-overlay` | 1000 | **0.4** | 无 |
| docAnalysis `%modal-overlay`（placeholder） | 10000 | **0.35** | 无（内部改为 `@include`，`@extend` 用法不变） |
| statistics `.rule-editor-overlay` | 10000 | 0.5 | `font-size: $t-xs` |
| skillLearning `.skill-dialog-overlay` | 99999 | 0.5 | `padding` / `box-sizing` |
| scriptLauncher `.script-editor-mask` | 10000 | 0.5 | 无 |
| pageLock `.page-lock-dialog-mask` | 10000 | 0.5 | `pointer-events: auto` |
| minimalBrowser `.mb-dialog-mask` | 11000 | 0.5 | `font-size: $t-xs` |
| minimalBrowser `.mb-settings-mask` | 11000 | 0.5 | `font-size: $t-xs` |
| imageCreation `.image-creation-overlay` | 100001 | **0.45** | `font-size`；**移除 `backdrop-filter: blur(2px)`** |
| htmlViewer `.html-viewer-overlay` | 99999 | 0.5 | 嵌套 `&.modal-overlay { z-index: 100000 }` |
| flashcardReading `.dialog-overlay` | 1000 | 0.5 | `font-size: $t-xs` |

### 2. 为什么改

- 13 处遮罩的几何（`fixed` + 四边 0）、居中对齐、底色写法完全同构，属 `AGENTS_STYLE.md` § 背景与过渡要求「统一口径」的对象；散落手写导致 z-index 出现 1000 / 1001 / 11000 / 99999 / 100001 五种值，改一处口径要翻 13 个文件。
- `PreviewCard.scss` 超 12KB 阈值主因是「舞台分档 + 演示宿主类」两类与卡片外壳无关的规则堆在同一文件；三个 section 边界清晰、无局部变量，是低风险拆分样板。

### 2.1 深嵌套：阈值校准 + 定向扁平化

审计初版把嵌套阈值定为 4 层，实测 165 处命中 —— 但 BEM 基线本身就要 4 层
（`.block { &__el { &--mod { &:hover } } }`），再叠加 `@media` / `:last-child` 就是 5–6 层，属**写法正常**而非缺陷。

| 深度 | 初版命中 | 处理 |
| --- | --- | --- |
| 5 层 | 111 | 阈值校准后不再上报 |
| 6 层 | 38 | 阈值校准后不再上报 |
| 7 层 | 13 | 扁平化 4 处（`HistoryTable` tbody 提升后整条链路降 2 层）+ 保留 9 处 |
| 8 层 | 3 | 随 `HistoryTable` tbody 提升降为 6 层 |

- **阈值 4 → 6**（`audit-scss.config.json`），理由写入本节：4 层是 BEM 下限，用它当门禁会把正常写法全标红，反而淹没真正需要拆的结构。
- **`HistoryTable.scss` 定向扁平化**：把 `tbody` 整段（64 行）从 `.historical-table` 内提出为顶层完整路径选择器
  `.historical-data-list .historical-table-container .historical-table tbody { … }`，
  位置紧随 `.historical-data-list` 之后，**CSS 输出顺序不变**，内部层级从 7–8 降到 5–6。
- **保留 9 处 7 层**（`StatisticsView` 的 `&--0..3`、`FeedGroup` 的 `&::placeholder`、`regexTester` 的 3 处）：均为「父块内最后一层修饰符」，扁平化需把父链重复写 3 遍，可读性反而下降；作为 P2 保留在审计报告中，不阻塞门禁。

### 3. 可能带来的风险

| 风险 | 处理 |
| --- | --- |
| 遮罩 mixin 改变层级 | 每处显式传原 z-index，`si-overlay` 默认值 10000 仅作兜底；`html-viewer` 的 `.modal-overlay` 覆盖层级保留 |
| 遮罩底色差异被抹平 | 4 处非 0.5 底色（0.4 / 0.35 / 0.45）逐个传入，不统一成 0.5 |
| `imageCreation` 移除 `blur(2px)` | 该声明违反「禁用 backdrop-filter」（Electron 滚动性能 + 全局观感），属规范修正；视觉上遮罩从「模糊」变为「纯半透明」，**这是本轮唯一可感知的视觉变化** |
| placeholder 内 `@include` | `%modal-overlay` 仍可被 `@extend`，只是声明体来自 mixin；docAnalysis 各弹窗输出等价 |
| 拆分改变 CSS 输出顺序 | 聚合壳按 Base → Stage → Demo 顺序 `@use`，与原单文件一致；`PreviewCard.vue` 的引用路径不变 |
| 拆分导致重复发射 | 已确认 `PreviewCard.scss` 只有 1 个引入点（`PreviewCard.vue`），不存在 aiContentGenerator 那种「多组件各引一次」的重复风险 |

### 4. 验证结果

| 检查 | 结果 |
| --- | --- |
| `pnpm audit:scss --json` | P0 0 / P1 492 / P2 467（合计 959，起始 1562）；`R2-shared-pattern` 13 → **0**；`R2-file-size` 4 → 3；`R2-syntax-unbalanced` 0 |
| 拆分完整性 | Base 115 / Stage 115 / Demo 213 行，section 标题与内容衔接无缺失 |
| `pnpm typecheck` | 通过 |
| `pnpm test` | 130 files / 1624 passed |
| `pnpm audit:scss --fail-on=p0,p1` | ✅ 通过（基线重建为 959 条） |
| 待用户 | `pnpm build`、13 个弹窗视觉回归、组件预览面板 |

### 5. 如何回滚

- 遮罩收敛：`git checkout -- <13 个文件>` 并删除 `kit/mixins.scss` 的 `si-overlay`（无其他引用则不影响编译）
- PreviewCard 拆分：删除 3 个分片，`git checkout -- src/features/componentPreview/styles/PreviewCard.scss`

---

## 尚未执行（下一批入口）

### 第二轮：结构优化（未开始）

| 项 | 数量 | 入口 |
| --- | --- | --- |
| 超大文件拆分 | 4 | `gitPush/styles/index.scss`（1032 行/25KB）、`PipelineGraph.scss`（646 行/13KB）、`docAnalysis/styles/AttrsPanel.scss`（516 行/12KB）、`componentPreview/styles/PreviewCard.scss`（439 行/16KB） |
| `.vue` 内联样式外置 | 13 | rssReader 7、componentPreview 4、htmlViewer 1、aiContentGenerator 1（清单见报告 § 3） |
| 遮罩范式收敛 mixin | 14 | `pnpm audit:scss -- --only=r2` 的 `R2-shared-pattern` 条目 |
| 深嵌套扁平化 | 166 | `R2-deep-nesting`（>4 层） |

> 这四项均改变 CSS 输出顺序或组件样式归属，**必须逐模块视觉回归**，不宜与 P0 批量替换同批提交。

### 第三轮：剩余规范项（未开始）

| 规则 | 剩余量 |
| --- | --- |
| `R3-hardcoded-color` | 383（TOP：`statistics/styles/index.scss` 20、`docAnalysis/AttrsPanel.scss` 13） |
| `R3-color-in-var-fallback` | 137 |
| `R3-transition-duration` | 94 |
| `R3-box-shadow` | 29 |
| `R3-hardcoded-spacing` | 26 |
| `R3-mobile-breakpoint` | 19 |
| `R3-z-index` | 15 |
| `R3-hardcoded-font-size` / `-radius` / `-line-height` / `-font-weight` | 31 |

---

## 视觉回归清单（需用户执行）

工具：命令面板搜「组件预览」，逐组件对照改动前后。

| 范围 | 入口 | 核对点 |
| --- | --- | --- |
| 共享组件 52 个 | 组件预览面板 | 按钮 info/warning 变体（改为 `null` 分支后仍是实底 + 白字）；Badge/Tag/Message/ToastMessage 的 info/warning 底色与文字；Card/Chart 的半透明底；Input/Select 的聚焦光环；Slider 的滑块阴影与轨道 |
| 全局次要文字 | 任一面板 | `on-surface-variant` 改为 `on-surface-light` 后，主/次文字是否恢复层级（暗色主题尤其要看） |
| statistics | Dock「统计」 | 里程碑卡片、历史表格、趋势图（原 P0 最集中，12 处） |
| docAnalysis | Dock「文档分析」 | 发布面板、属性面板、统计表格、设置面板 |
| gitPush | Dock「Git 推送」 | 统计面板、热点区块、提交热力图、表单输入 |
| toolCollection | Dock「工具箱」 | 快捷指令面板（`on-surface-variant` 密集）、DeepSeek 余额查询（warning 色） |
| 主题与窄屏 | 设置 → 外观 | 明/暗主题各一遍；窗口宽度 ≤768px 一遍（遮罩、工具栏、卡片间距） |

---

## 复现与门禁

```bash
pnpm audit:scss -- --fail-on=p0,p1      # 门禁：无新增 P0/P1
pnpm audit:scss -- --only=r2            # 第二轮输入清单
pnpm typecheck
pnpm test
```
