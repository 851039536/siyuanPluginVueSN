# 全项目 SCSS 审查报告（三轮优化基线）

> **状态（2026-11-28）**：审查完成；**P0 已清零**（297 → 0），第一轮冗余清理、第三轮 P0 专项均已落地，当前 999 条（P1 513 / P2 486）。本文保留审查基线口径，改动明细与未执行清单见 [`docs/scss-refactor-log.md`](./scss-refactor-log.md)。
> 审查范围：`src/**/*.scss`（478）+ `src/**/*.vue` 的 style 块（515），覆盖 40+ 功能模块与 52 个共享组件。
> 审查方式：`scripts/audit-scss.mjs` 全量静态扫描 + 思源 3.8.12 主题变量快照比对；未执行 `pnpm lint` / `pnpm build`（按仓库约定由用户执行）。
> 基准数据：`scripts/data/siyuan-theme-vars.json`（valid 253 个变量），采集说明见 [`docs/参考/siyuan-theme-vars.md`](./参考/siyuan-theme-vars.md)。

---

## 0. 结论速览

| 指标 | 数值 |
| --- | --- |
| 扫描文件 | 478 `.scss` + 515 `.vue` |
| 问题总数 | **1562**（P0 297 / P1 622 / P2 643） |
| 存量指纹 | 1298（已冻结到 `scripts/audit-scss.baseline.json`，只降不升） |
| 最严重问题 | `var(--b3-*)` 引用思源 3.8.12 **不存在的变量** 441 处，其中 297 处无 fallback ⇒ 样式实际失效 |
| 最集中变量 | `--b3-theme-on-surface-variant`（129）、`--b3-theme-warning`（34+）、`--b3-theme-primary-rgb`（33） |
| 热点模块 | `statistics` 293、`docAnalysis` 204、`gitPush` 172、`components` 116 |
| 结构问题 | 4 个文件超阈值（最大 `gitPush/styles/index.scss` 1032 行 / 25KB） |

**一句话**：这不是「风格不统一」，而是**大量样式引用了另一套设计体系（Material 3 命名）的变量**，在官方主题下静默失效——文字层级、警告色、半透明底色全部回落。

---

## 1. 审查基准与方法

### 1.1 基准三层

| 层 | 来源 | 本次使用情况 |
| --- | --- | --- |
| L1 静态 | 思源 3.8.12 安装目录 `appearance/themes/{daylight,midnight}/theme.css` + `stage/build/app/base.*.css` | ✅ 已采集：明/暗各 185 变量，主样式补充 72，并集 253 |
| L2 运行时 | 思源内 `getComputedStyle` 导出 | 未执行（用户可在装第三方主题时补采，见基准文档 § 五） |
| L3 上游 | GitHub `siyuan-note/siyuan`（raw 直连） | ✅ 已复测：正确路径为 `app/appearance/themes/*/theme.css`，上游 master 明/暗各 185 变量，与本地 3.8.12 一致；`api.github.com` 仍 403 限流、jsDelivr 超 50MB 不可用 |

> 之所以用安装目录而非 GitHub：`--b3-*` 的生效集合由「主题 + 内核注入」共同决定，安装目录就是当前运行版本的可信来源。升级思源后必须 `pnpm audit:scss -- --refresh-theme-vars <安装目录>` 重采。

### 1.2 判定口径

- **P0**：`var(--b3-x)` 中 `x` 不在 253 个有效变量内，且**无 fallback** ⇒ 该条声明在官方主题下失效。
- **P1**：变量不存在但有 fallback（暗色下 fallback 与主题脱节）；或违反 `AGENTS_STYLE.md` 强制项（硬编码 Token、移动端断点、`:deep()` 等）。
- **P2**：冗余、结构、建议级（重复选择器、未引用类名、装饰性阴影、过渡时长等）。

规则 ID 与检查点的完整映射见 [`AGENTS_STYLE.md § 自动审计映射`](../AGENTS_STYLE.md#自动审计映射2026-11-28)。

---

## 2. P0（297）：主题变量失效

### 2.1 按变量归类

| 变量 | 命中 | 性质 |
| --- | --- | --- |
| `--b3-theme-on-surface-variant` | 129 | Material 3 命名的次要文字色，思源无此变量 |
| `--b3-theme-warning` | 34 | 思源只有 `--b3-card-warning-*`，无 `--b3-theme-warning` |
| `--b3-theme-primary-rgb` | 33 | 插件想拼半透明主色，但思源不提供 rgb 分量变量 |
| `--b3-theme-on-surface-muted` | 14 | 思源的次要文字是 `--b3-theme-on-surface-light` |
| `--b3-theme-surface-variant` | 13 | 应为 `--b3-theme-surface-lighter` / `--b3-theme-background-light` |
| `--b3-theme-on-surface-rgb` | 13 | 无对应变量 |
| `--b3-theme-warning-lightest` / `--b3-theme-error-lightest` / `--b3-theme-success-lightest` | 17 | 思源只有三级 `-light/-lighter/-lightest` 中的部分色族（primary/error 有，warning/success 无） |

### 2.2 受影响位置（TOP）

| 文件 | P0 数 |
| --- | --- |
| `src/features/statistics/styles/MilestonesCard.scss` | 12 |
| `src/features/gitPush/styles/StatsPanel.scss` | 11 |
| `src/features/docAnalysis/styles/PublishPanel.scss` | 11 |
| `src/features/generalSettings/styles/CodeBlockSettings.scss` | 8 |
| `src/features/docAnalysis/styles/index.scss` | 8 |
| `src/features/gitPush/styles/HotspotSection.scss` | 7 |
| `src/features/docAnalysis/styles/AttrsPanel.scss` | 7 |
| `src/features/statistics/styles/index.scss` | 6 |
| `src/features/rssReader/styles/FeedGroup.scss` | 6 |
| `src/features/skillLearning/styles/ReviewView.scss` | 6 |

典型样本：

```
src/features/toolCollection/tools/shortcut/styles/ShortcutList.scss:42   color: var(--b3-theme-on-surface-variant)
src/features/toolCollection/tools/deepSeekCost/styles/BalanceQuery.scss:18  color: var(--b3-theme-warning)
src/components/styles/Badge.scss:96   background: var(--b3-theme-info)
src/components/styles/Button.scss:160 @include m.btn-color-family("--b3-theme-info", ...)   // mixin 拼接，静态 var() 看不到
```

> 最后一条说明：变量名以**字符串参数**传给 mixin、由 mixin 拼进 `var()` 的写法，脚本已单独覆盖（`R3-theme-var-unknown` 的 mixin 参数分支），但人工排查时容易漏。

### 2.3 影响

1. **文字层级丢失**：`on-surface-variant` 失效后 `color` 回落继承值，主/次文字同色，129 处。
2. **语义色缺失**：`--b3-theme-warning` 无 fallback 时警告条、余额不足提示等失去黄色语义，退化为普通文字。
3. **半透明底色失效**：`--b3-theme-primary-rgb` 用于 `rgba(var(--b3-theme-primary-rgb), .1)` 时整条声明非法，背景变透明。

### 2.4 修复建议（统一口径）

| 误用 | 应改为 | 依据 |
| --- | --- | --- |
| `--b3-theme-on-surface-variant` | `--b3-theme-on-surface-light` | 思源明暗两套均有，语义即「次要文字」 |
| `--b3-theme-on-surface-muted` | `--b3-theme-on-surface-light` | 同上 |
| `--b3-theme-warning` | `--b3-card-warning-color`（文字）/ `--b3-card-warning-background`（底） | 思源卡片语义色族 |
| `--b3-theme-info` | `--b3-card-info-color` / `--b3-card-info-background` | 同上 |
| `--b3-theme-success` / `--b3-theme-error` | 保留（这两个**存在**） | 已在 valid 集合内 |
| `--b3-theme-primary-rgb` | `--b3-theme-primary-lightest`（现成半透明层） | 思源不提供 rgb 分量 |
| `--b3-theme-surface-variant` | `--b3-theme-surface-lighter` / `--b3-theme-background-light` | 按「比 surface 更深一层」的用途选 |
| `--b3-theme-*-lightest`（warning/success） | `--b3-card-*-background` | 思源无该色族的阶梯 |

**执行原则**：P0 修复属于**第三轮（规范对齐）**的第一优先级，但因为它只是「改变量名」，风险低、收益高，可提前在每批的 R1 里顺带完成——前提是每处都补 fallback（`var(--b3-x, #{$c-*})`），使第三方主题下也不至于完全失效。

---

## 3. P1（622）

| 规则 | 数量 | 说明 | 处理轮次 |
| --- | --- | --- | --- |
| `R3-hardcoded-color` | 383 | 硬编码 `#hex` / `rgba()` / `hsl()` | R3 |
| `R3-theme-var-unknown`（有 fallback） | 144 | 变量不存在但兜底存在，暗色下观感脱节 | R3（与 P0 同批） |
| `R3-hardcoded-spacing` | 26 | `padding/gap/margin` 直接写 px | R3 |
| `R3-mobile-breakpoint` | 19 | `@media (max-width: $bp-mobile)` 缺 `(pointer: coarse)` 兜底 | R3 |
| `R1-style-in-vue` | 13 | `.vue` 内联样式，违反「样式必须外置」 | R2 |
| `R3-hardcoded-font-size` | 12 | `font-size: 13px` 等 | R3 |
| `R3-hardcoded-radius` | 10 | `border-radius: 6px` 等 | R3 |
| `R3-hardcoded-line-height` | 8 | `line-height: 1.5` 等 | R3 |
| `R3-backdrop-filter` | 5 | 毛玻璃（4 处在代码图片输出样式，1 处在 UI） | R2 |
| `R1-duplicate-decl` | 1 | 同一块内属性重复 | R1 |
| `R3-hardcoded-font-weight` | 1 | 字重硬编码 | R3 |

**内联样式位置**（13 处，集中在 4 个模块）：

```
src/features/rssReader/components/**      7 处
src/features/componentPreview/components/**  4 处
src/features/htmlViewer/components/SnippetLibrary.vue
src/features/aiContentGenerator/components/SkillPreviewModal.vue
```

> 判定已排除「纯 `@use` 桥接块」——形如 `<style scoped lang="scss">@use "@/components/styles/Badge.scss";</style>` 属规范写法，不计入。

---

## 4. P2（643）

| 规则 | 数量 | 处理轮次 |
| --- | --- | --- |
| `R2-deep-nesting` | 166 | R2（嵌套 >4 层） |
| `R3-color-in-var-fallback` | 137 | R3（fallback 里的硬编码色，建议换 `$c-*`） |
| `R1-duplicate-selector` | 97 | R1（同特异性覆盖属合法写法，需人工确认） |
| `R3-transition-duration` | 94 | R3（非 0.12s） |
| `R1-important` | 58 | R1 |
| `R3-box-shadow` | 29 | R3（装饰性阴影） |
| `R1-unused-class` | 24 | R1（**仅报告，禁止自动删**） |
| `R3-z-index` | 15 | R3（超出 10000 基准） |
| `R2-shared-pattern` | 14 | R2（标准居中遮罩范式，应收敛 mixin） |
| `R2-file-size` | 4 | R2（拆分） |
| `R3-font-size-over-base` | 4 | R3（>16px） |
| `R1-empty-block` | 1 | R1 |

**超阈值文件（第二轮拆分目标）**：

| 文件 | 体量 |
| --- | --- |
| `src/features/gitPush/styles/index.scss` | 1032 行 / 25KB |
| `src/features/gitPush/styles/PipelineGraph.scss` | 646 行 / 13KB |
| `src/features/docAnalysis/styles/AttrsPanel.scss` | 516 行 / 12KB |
| `src/features/componentPreview/styles/PreviewCard.scss` | 439 行 / 16KB |

---

## 5. 热点模块排行（问题数）

| 模块 | 合计 | 建议批次 |
| --- | --- | --- |
| `statistics` | 293 | 批 4（重灾区） |
| `docAnalysis` | 204 | 批 4 |
| `gitPush` | 172 | 批 4 |
| `components`（共享组件库） | 116 | 批 1（基础设施） |
| `rssReader` | 92 | 批 3 |
| `generalSettings` | 90 | 批 3 |
| `skillLearning` | 79 | 批 3 |
| `toolCollection` | 78 | 批 3 |
| `aiContentGenerator` | 67 | 批 3 |
| `flashcardReading` | 61 | 批 3 |
| `imageCreation` | 54 | 批 3 |

其余模块（`passwordVault` 23、`htmlViewer` 21、`quickNote` 20、`superPanel` 16、`s3Backup` 16、`elevationAssistant` 16、`apiDebugger` 14、`docNavigation` 14、`scriptLauncher` 12、`video` 11、`minimalBrowser` 10 等）归入批 2。

---

## 6. 分批计划

先低风险跑通流程，再攻高价值区。每批每轮独立 commit，回滚粒度 = 单批单 commit。

| 批 | 范围 | 预估文件 | 目标 |
| --- | --- | --- | --- |
| 批 1 | `src/components/**`（52 组件 + kit） + `src/index.scss` | ~60 | 先把公共资产的规则跑通；**任何 Token 取值变更都要 52 组件全量目视回归** |
| 批 2 | 11 个小模块 | ~35 | 验证流程可复制 |
| 批 3 | rssReader / generalSettings / skillLearning / toolCollection / aiContentGenerator / flashcardReading / imageCreation | ~90 | 主体清理 |
| 批 4 | statistics / docAnalysis / gitPush | ~45 | 重灾区：P0 最集中、4 个超大文件都在这里 |

**每批上限**：≤8 个模块或 ≤30 个样式文件；超出则拆成子批（如 `stats-a` / `stats-b`）。

---

## 7. 三轮执行模板（每批固定交付）

每轮输入 = 本文对应分级清单 + `pnpm audit:scss -- --changed` 结果 + 该模块的 `AGENTS_STYLE.md` 条目。

### 第一轮：清理冗余（只删不改观感）

- 删除注释掉的样式块、空规则块、调试样式
- 合并同块内重复声明；同文件重复选择器**先确认是否靠源码顺序覆盖**（`Button.scss` 的 severity 分组就是有意为之）
- 未引用类名：**只报告不删**，删除前必须 grep 动态 `:class`、模板字符串拼接、思源原生 `.b3-*`
- 过期注释（描述已删除实现、迁移遗留的 TODO）

**禁止**：改任何声明值、改选择器名、动 Token 取值。

### 第二轮：结构优化

- 拆分 4 个超阈值文件（按 `.scss` 分片 + 汇聚 `@use`，保持导出面不变）
- 把 14 处标准居中遮罩收敛到 `kit/mixins.scss`（新增 `si-overlay`，feature 侧只 `@include` 委托）
- 13 处 `.vue` 内联样式外置到 `styles/*.scss`
- 拆分对应模块的超长 TS 函数（配合 `lsp-code-analysis` 查引用面）
- 统一命名与返回值（持久化操作返回结果对象而非布尔）

**风险**：拆分会改变 CSS 输出顺序 —— 同特异性依赖顺序的选择器会翻转。每拆一个文件必须回归一次。

### 第三轮：规范对齐

- **P0 变量修复优先**（441 处 → 按 § 2.4 映射表批量替换并补 fallback）
- 硬编码 Token 化（383 色 / 26 间距 / 12 字号 / 10 圆角 / 8 行高 / 1 字重）
- 移动端断点补 `(pointer: coarse) and (hover: none)`（19 处）
- 背景层级、0.12s 过渡、`z-index` 10000 对齐
- 模块 `README.md` 补样式与存储章节

### 每批交付格式（强制，逐条对应违规 ID）

```md
### 批 N / 第 R 轮：<模块列表>

#### 改了什么
| 文件:行 | 规则 ID | 改动 | 说明 |
|---|---|---|---|
| src/features/x/styles/a.scss:42 | R3-theme-var-unknown | `--b3-theme-on-surface-variant` → `--b3-theme-on-surface-light` | 变量在 3.8.12 不存在 |

#### 为什么改
（对应规范条款 / 审计规则；不写「更整洁」这类无依据理由）

#### 可能带来什么风险
（视觉差异、特异性变化、暗色表现、第三方主题表现；无可感知风险也要写「无」并说明依据）

#### 验证结果
- `pnpm audit:scss -- --changed --fail-on=p0,p1`：新增 0
- `pnpm typecheck`：通过
- `pnpm test`：xx passed
- 视觉回归：<功能名 + 入口 + 核对点>（明/暗 + ≤768px）

#### 如何回滚
`git revert <commit>`（本批单 commit，无跨批依赖）
```

**禁止**只贴重构后的代码。没有「改了什么/为什么/风险」三段的提交一律退回。

---

## 8. 验证流程

| 阶段 | 命令 | 执行者 | 通过标准 |
| --- | --- | --- | --- |
| 静态 | `pnpm audit:scss -- --changed --fail-on=p0,p1` | AI | 基线外新增 = 0 |
| 静态 | `pnpm audit:tokens` | AI | 无旧长名 Token |
| 类型 | `pnpm typecheck` | AI | 0 error |
| 单测 | `pnpm test` | AI | 全通过 |
| 存储 | `pnpm audit:storage` | AI | 无未登记槽位 |
| i18n / 图标 | `pnpm i18n:verify` / `pnpm validate:icons` | AI | 键对齐、图标已注册 |
| Lint | `pnpm lint` | 用户 | 0 error |
| 构建 | `pnpm build` | 用户 | 产物正常 |
| 视觉 | 命令面板「组件预览」+ 受影响功能 Dock/弹窗 | 用户 | 明/暗主题、≤768px 无异常 |

**视觉回归清单必须由 AI 在每批交付中显式列出**（功能名 + 入口 + 核对点），不能只说「已自测」。

**计数趋势**：每轮收尾用 `pnpm audit:scss -- --json` 记录 P0/P1/P2，必须单调下降；若某规则计数上升，说明该轮引入了新问题，不得进入下一批。

---

## 9. 风险与回滚

| 风险 | 触发场景 | 缓解 |
| --- | --- | --- |
| 公共 Token 取值变更 | 改 `kit/variables.scss` | 只允许新增可选 Token；取值变更单独成批 + 52 组件全量回归 |
| CSS 输出顺序变化 | 拆分文件、提取 mixin | 每拆一个回归一次；mixin 内声明顺序与原块保持一致 |
| 误删动态类名 | 第一轮「未引用类名」 | 只报告不自动删；删除前 grep `:class` 与模板字符串 |
| 主题适配回归 | 变量替换 | 一律补 `$c-*` fallback，保证第三方主题下不炸 |
| 跨批混提交无法回滚 | 一次改多个模块 | 单批单 commit，前缀 `refactor(scss,r1\|r2\|r3): <模块>` |
| 审计脚本结论漂移 | 升级思源 | 先 `--refresh-theme-vars`，再重跑全量 |

---

## 10. 复现命令

```bash
# 全量分级清单（与本文数字一致）
pnpm audit:scss -- --fail-on=none --limit=0

# 只看某一轮
pnpm audit:scss -- --only=r1 --fail-on=none
pnpm audit:scss -- --only=r3 --fail-on=none

# 机器可读（供批次推进脚本消费）
pnpm audit:scss -- --json --fail-on=none

# 只扫本次改动
pnpm audit:scss -- --changed

# 每轮收尾收紧基线
pnpm audit:scss -- --write-baseline
```
