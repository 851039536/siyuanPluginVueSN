# StatsView UI 布局审查与优化计划

## 概述

对 gitPush 统计视图（`src/features/gitPush/components/StatsView/` 共 7 个组件 + `styles/StatsPanel.scss`、`styles/RepoLinkAuditSection.scss`）进行 UI 布局审查、显示优化与冗余排查。

**审查结论**：结构整体健康（组件拆分清晰、CSS 类无死代码、数据流符合架构规范），发现 3 类需修复问题：

| # | 类别 | 问题 | 严重度 |
|---|------|------|--------|
| 1 | 布局缺陷 | 瀑布流固定两列，窄面板下待处理表格被挤压；注释与实现矛盾 | 高 |
| 2 | 规则违反 | 3 处 tooltip 缺失（项目规则：所有 UI 元素须有 hover 提示） | 中 |
| 3 | 冗余备案 | 样式/模板重复 2 处（第 2 次出现，按 Rule of Three 不抽象仅备案） | 低 |

---

## 现状分析

- 入口 `StatsView/index.vue`：空态 + `OverviewCards`（6 卡）+ `.gp-stats-masonry` 瀑布流（5 个区块：覆盖率 / 分类分布 / 待处理项目 / 平台配置 / 链接一致性审计）。
- 数据流：`useGitStats.statsView` 单对象 prop + `useRepoLinkAudit` 4 个审计 props，符合「子组件最小 props」规范。
- 样式：`StatsPanel.scss`（区块/表格/chip/徽章原语）+ `RepoLinkAuditSection.scss`（审计专属补充），全部经 `@use` 模块化引入，Dart Sass 同模块只输出一次，无编译膨胀。
- `gp-spin` 定义于 `styles/Shared.scss`，有效。

---

## 修改清单

### 修改 1：瀑布流列数自适应 + 修正矛盾注释（修复窄面板挤压）

**文件**：
- `src/features/gitPush/styles/StatsPanel.scss`（L55-64）
- `src/features/gitPush/components/StatsView/index.vue`（L18 注释）

**问题**：
1. `StatsPanel.scss` 中 `.gp-stats-masonry` 为 `column-count: 2` 固定两列。
2. 窄 Dock（约 420px）下每列仅约 204px，而「待处理项目」表格固定宽度 = 5×40px 数值列 + 24px 操作列 + gap/padding ≈ 264px，名称列被压到 0，严重挤压。
3. `index.vue` L18 注释声称「列数由容器宽度自适应」与固定 2 列矛盾；且「四个区块」已过时（现为 5 个）。

**方案**：
```scss
.gp-stats-masonry {
  // 自适应列数：容器 ≥ ~684px（21rem×2 + gap）时双列瀑布（宽屏体验与现状一致），
  // 窄 Dock 自动退为单列，表格获得全宽不再挤压
  column-width: 21rem;
  column-count: 2;
  column-gap: $spacing-3;

  > .gp-stats-section {
    break-inside: avoid;
  }
}
```
- `index.vue` 注释改为：「瀑布流布局：容器 ≥ 约 684px 时双列瀑布，窄面板自动单列（列数由容器宽度决定），消除并排等高行的空隙」。

**效果**：窄面板（< 684px）单列，5 区块依次全宽排列，待处理表格完整可用；宽面板保持现有双列瀑布。

### 修改 2：补齐 tooltip（项目规则 + 组件间一致性）

**2a. 待处理状态 chips 加 title** — `PendingProjectsSection.vue`
- 问题：4 个状态 chip（待推送/待拉取/已同步/无远程）只有图标+数字，无 tooltip；同文件风格的 `RepoLinkAuditSection` chips 已有 `:title`，不一致且违反项目 tooltip 规则。
- 方案：`STATUS_CHIPS` 每项增加 `labelKey` 字段（复用现有 i18n 键，无需新增翻译）：
  - ahead → `needsPush`（"待推送"）
  - behind → `needsPullShort`（"待拉取"）
  - synced → `synced`（"已同步"）
  - noRemote → `noRemoteLabel`（"无远程"）
- 模板 chip 加 `:title="i18n[chip.labelKey]"`。

**2b. 平台表头图标加 title** — `PlatformStatusSection.vue` + `RepoLinkAuditSection.vue`
- 问题：两处表格表头的 4 个平台图标（GitHub/Gitee/Gitea/CNB）无 tooltip，新用户难辨认 `mdi:tea`、`mdi:cloud-braces` 等图标。
- 方案：两处表头 `<Icon :icon="pm.icon">` 外层单元格加 `:title="pm.label"`（PLATFORM_META 已有 label 字段，无新增 i18n）。

### 修改 3：冗余备案注释（审查结论，不重构）

依据 AGENTS「模块提取判定：同一问题第 3 次出现前不要抽象」，以下重复均为第 2 次出现，**本次只加交叉引用注释备案，不做合并**：

- `StatsPanel.scss` 的 `.gp-stats-section-title` / `.gp-stats-section-count` 与 `index.scss` 的 `.gpr-section-title` / `.gpr-section-count` 几乎逐字重复 → 在两处各加一行注释互指（「与 gpr-section-title 重复，第 3 处出现时提取 mixin」）。
- `PlatformStatusSection` 与 `RepoLinkAuditSection` 的平台表头结构（名称 + 4 平台图标 + 操作列）重复 → 不提取共享组件（Rule of Three），注释备案。

---

## 审查后明确不改项（决策记录）

| 项 | 结论 | 理由 |
|----|------|------|
| star 卡与待推送卡同为 warning 色 | 保持 | star 卡刻意与列表星标按钮同色（代码注释已说明） |
| 待推送卡片警告色 vs chip/徽章主题色 | 保持 | 卡片语境是"警示数量"，语义可辨 |
| coverage/分类条目 tooltip 仅显百分比 | 保持 | 条目本体已含名称+计数，tooltip 补充百分比已满足规则 |
| `RepoLinkAuditSection` 内 AUDIT_CHIPS 与 STATE_META 部分重复 | 保持 | 同文件内两种渲染形态（chip 用 outline 图标、单元格用实心图标），合并反而增加复杂度 |
| OverviewCards hover 边框高亮 | 保持 | 六卡统一视觉语言，纯装饰无误导 |
| CSS 死代码 | 无 | 已逐类核对 StatsPanel.scss / RepoLinkAuditSection.scss，全部在用 |

---

## 涉及文件汇总

| 文件 | 改动 |
|------|------|
| `src/features/gitPush/styles/StatsPanel.scss` | masonry 自适应列数；区块标题重复备案注释 |
| `src/features/gitPush/components/StatsView/index.vue` | 修正瀑布流注释（5 区块、列数自适应） |
| `src/features/gitPush/components/StatsView/PendingProjectsSection.vue` | STATUS_CHIPS 加 labelKey + chip title |
| `src/features/gitPush/components/StatsView/PlatformStatusSection.vue` | 表头平台图标 title + 备案注释 |
| `src/features/gitPush/components/StatsView/RepoLinkAuditSection.vue` | 表头平台图标 title + 备案注释 |
| `src/features/gitPush/styles/index.scss` | gpr-section-* 重复备案注释 |

i18n：零新增键（全部复用现有键）。

## 验证

1. `npx tsc --noEmit` 类型检查通过（用户按惯例自行执行 `pnpm lint` / `pnpm i18n:verify`）。
2. 手动验证：
   - 拖窄 Dock 面板 < 约 680px：统计视图退为单列，待处理表格完整显示无横向截断；
   - 拉宽面板 ≥ 约 700px：恢复双列瀑布；
   - 悬停待处理 chips 显示「待推送/待拉取/已同步/无远程」；悬停平台表头图标显示平台名；审计流程回归正常。
