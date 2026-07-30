# StatsOverview.vue 审查修复计划

## 一、逻辑漏洞修复

### 1. L216 title 属性插值失效
`src/features/docAnalysis/components/StatsOverview.vue`：
```
- title="书签分类 Top-{{ stats.customBookmarkTop.length }}"
+ :title="`书签分类 Top-${stats.customBookmarkTop.length}`"
```

### 2. icon-only 卡片不受 hideZero 过滤
`getVisibleCards()` 中保留 `iconValue` 卡片：
```ts
return section.cards.filter((c) => c.iconValue || getCardValue(c) > 0)
```

### 3. hideZero 开关移至 Tab 栏
- 将"隐藏零值"按钮从 `section.key === 'size'` 的 `#headerExtra` 移到 `.stats-tab-bar` 行右侧（`margin-left: auto`），使概览/质量两个 Tab 都可见可控。
- `styles/StatsOverview.scss` 中为 tab 栏内的 `.toolbar-btn` 补充对齐样式（复用现有 Token，不新增硬编码）。

### 4. 消除 ">2万字" 字符串耦合
- `src/features/docAnalysis/utils/docStatsAnalyzer.ts`：导出常量 `export const WC_TOP_BIN_LABEL = ">2万字"`，L94 处使用该常量。
- `StatsOverview.vue` `_healthBreakdown` 中改为 `d.label === WC_TOP_BIN_LABEL`。

## 二、冗余消除

### 5. 删除未使用的 `loading` prop
- `StatsOverview.vue` Props 接口删除 `loading`；
- `src/features/docAnalysis/index.vue` 删除对应 `:loading` 绑定。

### 6. 质量 Tab 卡片元数据化（约 90 行 → 约 15 行）
- `src/features/docAnalysis/types/index.ts` 新增 `export const QUALITY_CARDS: StatCardDef[]`，包含 9 张卡：
  - `deep / hasImage / hasTag / hasAlias / hasMemo / hasRef / incomingRef / orphanDoc` 用 `statKey`；
  - `noTag` 用 `resolveValue: (s) => s.totalDocs - s.taggedDocs`（首次消费该死字段）；
  - `hasImage` 配 `suffixStatKey: "totalImages"`、`hasRef` 配 `suffixStatKey: "totalRefs"`。
- `StatsOverview.vue`：
  - `cardLabel()` 通用消费 `suffixStatKey`：`if (card.suffixStatKey) return \`${card.shortLabel}(${props.stats[card.suffixStatKey]})\``（duplicate 特例保留在前）；
  - 质量 Tab 模板替换为 `v-for="card in visibleQualityCards"` 单个 `StatCard`，`visibleQualityCards` computed 复用与 `getVisibleCards` 相同的 hideZero 过滤逻辑。
- 保持卡片顺序、colorClass、label 文案与现状完全一致。

### 7. 空值兜底统一（全部移除）
`DocStats` 字段非可选且由 `makeDefaultDocStats` 初始化、props 必传，删除：
- L522 `(props.duplicateNameFilter || [])` → `props.duplicateNameFilter`
- L567 `(s.wordCountDistribution || [])` → `s.wordCountDistribution`
- L645/L663 `props.stats.platformCounts || {}` → `props.stats.platformCounts`

实施前核对 `makeDefaultDocStats` 确含 `platformCounts`/`wordCountDistribution`/`customBookmarkTop` 初始值（若缺则改为在 `makeDefaultDocStats` 补齐，而非保留兜底）。

### 8. dupDialog 保存去重
`saveDupDialog()` 中 `names` 经 `[...new Set(names)]` 去重后再 emit。

## 三、可选改进（一并实施）
两个 Teleport 弹窗（书签详情、重名排除）补充 Escape 关闭：弹窗打开期间在根元素用 `@keydown.esc` + `tabindex="-1"` 自动聚焦，或按项目既有 modal 键盘可访问性模式实现（参考项目内既有弹窗写法，不新增全局监听，避免泄漏）。

## 测试计划
- `npx tsc --noEmit` 类型检查通过（`pnpm lint` / 构建由用户自行执行）。
- 手动核对：
  - 书签分类分区标题正确显示 "书签分类 Top-N"；
  - hideZero 开关在概览/质量 Tab 均可见，切换后 customTime 图标卡始终显示；
  - 质量 Tab 9 张卡片文案/颜色/点击过滤行为与改前一致（含 `图片(N)`、`含引用(N)` 动态后缀）；
  - 健康度 tooltip 中 "字数>2万" 数值不变。

## 影响文件
- `src/features/docAnalysis/components/StatsOverview.vue`（主体）
- `src/features/docAnalysis/types/index.ts`（新增 QUALITY_CARDS）
- `src/features/docAnalysis/utils/docStatsAnalyzer.ts`（导出 WC_TOP_BIN_LABEL）
- `src/features/docAnalysis/index.vue`（删 :loading 绑定）
- `src/features/docAnalysis/styles/StatsOverview.scss`（tab 栏按钮对齐）

不涉及 i18n（本组件文案为硬编码中文的存量状态，本次不扩大改动范围）。