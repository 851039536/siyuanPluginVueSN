---
name: LineStats 合规改造与排行表可读性优化
overview: 按项目规则审查 gitPush 行数统计（LineStats）并按「合规 + 视觉全做」整改：迁移到共享组件库（Button/Card/Tabs/Checkbox/Badge/Toolbar/IconWrapper）、复用 gitPush 共享弹窗基座、修 token/过渡/尺寸/a11y 违规，并重点优化项目行数排行表的可读性（列宽自适应、粘性表头、条形最小可见宽度与过渡、行键盘可达）。
todos:
  - id: shared-foundation
    content: 补齐基础设施：新增 codeTags/filterVariant 图标键、analysisStatusText 可选 fallbackKey、i18n 可访问名称键
    status: completed
  - id: toolbar-cards
    content: 迁移工具条与汇总卡片到共享 Toolbar/Button/Badge/IconWrapper/Card，清理对应旧样式
    status: in_progress
    dependencies:
      - shared-foundation
  - id: ranking-readability
    content: 重构排行表：grid 列模板、吸顶表头、条形最小宽度与过渡、行改 button 键盘可达
    status: completed
    dependencies:
      - toolbar-cards
  - id: dialogs-migration
    content: 迁移两个弹窗到共享 Tabs/Checkbox/Button/Tag 并复用 gp-mask 基座，删除自绘遮罩与 chips 样式
    status: completed
    dependencies:
      - shared-foundation
  - id: verify-sweep
    content: 用 [subagent:code-explorer] 核查残留引用与 props 用法，跑 read_lints、tsc、i18n:verify、validate:icons
    status: completed
    dependencies:
      - ranking-readability
      - dialogs-migration
---

## 产品概述

对 gitPush 行数统计（LineStats）功能做一次规则合规审查并优化其界面呈现。功能边界与数据口径保持不变，只调整界面控件、布局与交互反馈。

## 核心功能（保持不变）

- 工具条：展示分析状态（未分析 / 分析中 / 上次分析时间），提供文件格式过滤入口、单项目请求条数选择、「开始行数分析 / 重新分析」按钮。
- 汇总卡片：总新增、总删除、总净增（正负着色）、当前总行数（存量口径，含说明）。
- 项目代码行数排行：排名、项目名、条形、新增 / 删除 / 净增、占比、当前总行数；点击某行打开该项目详情。
- 项目详情弹窗：文件明细（路径、修改次数、参与作者、增删净、占比、该文件存量行数）与作者明细两个视图切换，支持重新抓取该项目数据。
- 文件格式过滤弹窗：扩展名多选排除列表、「排除全部 / 清空 / 应用 / 取消」。

## 本次界面优化内容

- 控件外观统一：按钮、卡片、标签页、复选框、角标、图标全部改用项目通用控件，尺寸档位、焦点态、禁用态、加载态表现与全库一致。
- 排行表可读性（重点）：表头在滚动时吸顶；项目名不再被固定窄列大量截断；条形具备最小可见宽度与宽度过渡，极小占比的项目也能被看见；可点击行支持键盘聚焦与回车/空格打开，并有可见焦点提示。
- 工具条：过滤入口显示已选数量角标；分析按钮在分析中显示加载态且宽度不跳动；状态文案与其它分析视图完全一致。
- 汇总卡片：由四列固定窄格改为自适应排列，窄面板下自动折行，数字与标签层级更清晰。
- 详情弹窗：两个视图切换用标准标签页（带键盘方向键漫游与计数）；刷新与关闭为规范图标按钮。
- 过滤弹窗：扩展名由自绘小方块改为标准复选框网格，选中态语义明确。
- 弹窗一致性：遮罩浓度、层级与进出场动画与同模块其它弹窗完全一致。
- 保留现有配色、主题变量与 12px 基准字号层级，不改变信息结构与视觉语言。

## 技术栈选型

- Vue 3 + TypeScript + Vite（现状不变），SCSS 按 `styles/` 目录分离规则落在 feature 内。
- 复用项目自建共享组件库 `src/components/`：`Button`、`Card`、`Badge`、`Toolbar`、`Tabs` + `TabList` + `Tab` + `TabPanels` + `TabPanel`、`Checkbox`、`Tag`、`IconWrapper`（及其 `IconKey` 真源 `kit/icons.ts`）。
- 复用 gitPush 共享基座：`styles/Dialog.scss` 的 `.gp-mask` / `.gp-dialog-fade`（经 `styles/index.scss` 已 `@use`，LineStats 各组件本就第二行 `@use "../../styles/index.scss"`，无需新增导入）。
- 复用 gitPush 纯函数层：`utils.ts` 的 `analysisStatusText`、`netClass`、`withLineBarPct`。
- 不引入任何新依赖。

## 实施方案

总体策略：视图层「控件替换 + 结构收敛」，数据流与 props/emit 契约零改动；样式只做删除与 Token 对齐，不做视觉语言改造。

### 1. 组件映射（逐处替换，替换后删除本地等价样式）

| 现状 | 目标 |
| --- | --- |
| `.gls-toolbar` 自建 flex 行 | 共享 `Toolbar`（`variant="borderless" :padded="false" size="xsmall"`，`start`=状态、`end`=操作区，自带 `role="toolbar"`） |
| `.vp-btn vp-btn--ghost vp-btn--sm` 分析按钮 | `Button variant="ghost" :outlined="true" size="xsmall" :loading="analyzing"` + `icon`（加载态保宽由组件内 `visibility: hidden` 保证） |
| `.gls-ext-btn`（24×22 图标按钮）+ `.gls-ext-badge` 手搓角标 | `Badge :content="n" :hidden="n === 0" variant="primary" size="xsmall"` 包裹 `Button` 纯图标（`size="xsmall"` + `title`/`aria-label`） |
| `@iconify/vue` 的 `Icon` | `IconWrapper`（`:name="IconKey"` + `:size`），SCSS 不再用 `font-size` 控图标尺寸 |
| `.gls-card` 自建卡片 | 共享 `Card`（`variant="bordered" size="small" body-no-padding`）+ 内层 `.gls-card-inner` 自控内边距与居中 |
| `.pld-tabs / .pld-tab / .pld-tab-count` 手搓 Tab | `Tabs` + `TabList` + `Tab`（`v-model:value="activeTab"`）+ `TabPanels` + `TabPanel`，Tab 内计数用 `Tag size="xsmall"` |
| `.pld-close` / `.pld-refresh`（20×20） | `Button` 纯图标 `size="xsmall"`（22px）+ `title`/`ariaLabel` |
| `.gfe-chip` 自绘多选块 | `Checkbox` 数组模式（`v-model="draft"` + `:value="ext"` + `size="xsmall"`）网格 |
| `.gfe-act-btn`、`.gfe-close`、底部按钮 | `Button`（全选/清空：`variant="primary" text size="xsmall"`；关闭：纯图标；取消：`variant="ghost" :outlined="true" size="small"`；应用：`variant="primary" size="small"`） |
| `.pld-mask` / `.gfe-mask` 重复遮罩 | `.gp-mask`（0.5 / z-index 10000 / 12px 基准），本地仅保留弹窗尺寸与进出场 scale |


### 2. 关键决策与理由

1. **排行表用单一 grid 模板**：表头与数据行共用同一 `grid-template-columns`。现有 flex「名称固定 72px + 轨道 flex:1」既截断项目名、又不能放开名称列（一旦名称自适应，各行轨道宽度不同、条形长度失去可比性）。grid 模板可同时满足「名称列按可用宽度自适应」与「跨行条形起点/终点对齐」。
2. **行容器由 div 改为原生 button**：一次拿到键盘可达（Tab + Enter/Space）与焦点语义，且 grid 布局与 hover 态照旧；表头保持 div。不用共享 `Button` 是因为此处需要整行 grid 与多列截断，用组件会引入多余的内部包裹层。
3. **粘性表头**：`position: sticky; top: 0; z-index: 1;` + 不透明底 `var(--b3-theme-background)` 遮挡滚动行；滚动祖先是 `.gls-panel`（已 `overflow-y: auto`），中间不得新增 `overflow: hidden`。
4. **条形最小可见宽度 2px + `width 0.12s ease` 过渡**：零占比仍占 2px，属有意取舍（可读性优于严格比例），需注释说明。
5. **角标用 `Badge` 而非自绘**：`Badge` 默认 `variant="danger"`，须显式传 `primary`；计数上限由 `max` 控制。
6. **遮罩复用 `.gp-mask` 但保留本地 `pld-/gfe-dialog` 类名**：不改成 `gp-dialog`，因为 Dialog.scss 的 `.gp-dialog` 宽度（420px）在其后加载，会按源码顺序覆盖本地宽度设置；进出场 scale 由本地补一条 `.gp-dialog-fade-enter-from .pld-dialog { transform: scale(0.98) }` 实现（选择器不冲突，安全）。
7. **DRY**：工具条状态文案改用 `analysisStatusText({ ..., notRunKey: "lineStatsNotRun" })`，消除与提交分析/规则检查工具条的三元重复；为保留现有「刚刚」兜底，给该函数加**可选** `fallbackKey?: string` 参数（向后兼容，另两处调用不受影响）。
8. **图标补齐**：`kit/icons.ts` 的 `COMMON_ICONS` 新增 `codeTags`（mdi:code-tags）与 `filterVariant`（mdi:filter-variant）两个 `IconKey`（`IconKey = keyof FEATURE_ICONS | keyof COMMON_ICONS`，additive 低风险）；若 `pnpm validate:icons` 报错则回退复用已有 `filter`（mdi:filter）与 `chartLine`。
9. **尺寸档位统一**：`Toolbar` 不向插槽注入档位，内部控件必须显式同档。工具条取 `xsmall`（22px 按钮 / 28px 行高，与同排的 `CommitCountSelect` 紧凑高度匹配）；弹窗底部按钮取 `small`（28px，提升点击目标）。状态文案在 `.gls-status` 显式声明 `font-size: $t-xs` 保持现有 12px。
10. **性能**：渲染路径仍为 O(n)（`withLineBarPct` 单次遍历不变），无新增响应式计算、watch 或定时器；grid / sticky / transition 全为 CSS 层，无额外布局抖动。

### 3. 实施注意（防回归）

- `Card` 陷阱：`.si-card__body` 的内边距由 `.si-card--{tier} .si-card__body`（特异性 0,2,0）给出，外部单类改 padding 无效 ⇒ 用 `body-no-padding` + 内层容器自控；`Card` 默认底色是 `background`，面板内需 `surface` 凸出 ⇒ 在父级类 `.gls-card`（可命中子组件根节点）补 `background: var(--b3-theme-surface)`，并注释原因。
- `Tabs` 传 `value` 即受控 ⇒ `v-model:value="activeTab"`；Tab 计数不要用 `Badge`（角标定位语义），用 `Tag`。
- `Checkbox` 数组模式依赖 `modelValue` 为数组；`selectAll/clearAll` 仅重写数组，逻辑不变；网格列宽 `repeat(auto-fill, minmax(72px, 1fr))`，容器保留 `max-height + overflow-y: auto`，padding 已含右侧间距（符合 Dock 侧边栏间距规则）。
- 数字列补 `font-variant-numeric: tabular-nums`（对齐 gitPush 等宽计数范式）。
- 过渡统一 0.12s：`LineStatsPanel.scss` 的 `.gls-ext-btn`、`ExtFilterDialog.scss` 的 `.gfe-chip` 0.15s 随所在选择器一并删除；`.gls-ext-badge` 的 `line-height: 1` 随选择器删除（Badge 组件内部已有规范行高）。
- 删除清单（避免死样式）：`LineStatsPanel.scss` 的 `.gls-toolbar` / `.gls-toolbar-right` / `.gls-ext-btn*` / `.gls-ext-badge`；`ProjectLineDetail.scss` 的 `.pld-mask` / `.pld-close` / `.pld-refresh` / `.pld-tabs` / `.pld-tab` / `.pld-tab-count`；`ExtFilterDialog.scss` 的 `.gfe-mask` / `.gfe-close` / `.gfe-act-btn` / `.gfe-chip*`。`.gls-net--*` / `.pld-net--*` / `.gls-fail-hint` / `.gls-status` / 表格单元格样式保留。
- 层级变化注意：遮罩由 99999 降到基座 10000（与 gitPush 其它弹窗一致）；本视图内无其它浮层，无覆盖风险。
- 验证边界：AI 禁止执行 `pnpm lint` 与 `pnpm vite build`（由用户自验）；可执行 `read_lints`、`npx tsc --noEmit`、`pnpm i18n:verify`、`pnpm validate:icons`。`read_lints` 偶有陈旧诊断，须读回代码核对。
- i18n：只为新增可访问名称（如标签栏名称 `lineDetailTabsLabel`）补 zh_CN / en_US 分片键（只改分片，顶层 JSON 由 `pnpm i18n:merge` 生成）；图标按钮的 `title` 全部复用既有键（`lineStatsExtFilter`、`close`、`lineDetailRefreshHint`、`lineStatsExtSelectAll`、`lineStatsExtClearAll`、`lineStatsExtApply`、`cancel`）。

### 4. 架构与目录结构

视图编排与数据流不变：`index.vue` 仍只做状态编排与弹窗挂载（本次无需改动），`ProjectLineDetail.vue` 仍自包含聚合（`aggregateFileStats` / `sumAuthorLines` / `withLineBarPct`）；纯函数继续留在 `utils.ts` / `reportMetrics.ts`，组件内只保留视图状态（`showExtDialog`、`activeTab`、`draft`）。

```
src/features/gitPush/
├── components/LineStats/
│   ├── index.vue                 # [不改动] 已确认：props/emit 契约不变，弹窗挂载与空态逻辑无需调整
│   ├── LineStatsToolbar.vue      # [MODIFY] 换 Toolbar/Button/Badge/IconWrapper；状态文案改 analysisStatusText；删除本地按钮与状态三元
│   ├── LineStatsCards.vue        # [MODIFY] 四张卡片改共享 Card + 内层数值/标签容器；补 tabular-nums 与正负号展示
│   ├── LineRankingSection.vue    # [MODIFY] 行改原生 button（键盘可达 + focus）；沿用 netClass/withLineBarPct；修正「按净增降序」注释为「按总行数降序」
│   ├── ProjectLineDetail.vue     # [MODIFY] 换 Tabs 五件套（Tag 计数）+ 纯图标 Button；去掉本地遮罩类，改用 gp-mask
│   └── ExtFilterDialog.vue       # [MODIFY] chips 改 Checkbox 网格 + 共享 Button；去掉本地遮罩类，改用 gp-mask
├── styles/
│   ├── LineStatsPanel.scss       # [MODIFY] Toolbar/Card/排行 grid 模板 + 粘性表头 + 条形最小宽度与过渡 + tabular-nums；删除 .gls-toolbar*/.gls-ext-*
│   ├── ProjectLineDetail.scss    # [MODIFY] 删 .pld-mask/.pld-close/.pld-refresh/.pld-tab*；保留弹窗尺寸/头部/表格；补 .pld-dialog 的 scale 进出场
│   └── ExtFilterDialog.scss      # [MODIFY] 删 .gfe-mask/.gfe-close/.gfe-act-btn/.gfe-chip*；网格列宽与底部按钮间距调整
├── utils.ts                      # [MODIFY] analysisStatusText 增加可选 fallbackKey（向后兼容，默认行为不变）
src/components/kit/icons.ts       # [MODIFY] COMMON_ICONS 新增 codeTags / filterVariant 两个 IconKey
src/i18n/{zh_CN,en_US}/gitPush.json # [MODIFY] 新增标签栏可访问名称等 1~2 个键
```

## 关键结构约定

排行表「表头 / 数据行」必须共用同一列模板（这是可读性优化的落点，也是最容易改错的地方）：

```
// 排名 | 名称（自适应）| 条形轨道（自适应）| 三列数字 | 占比 | 总行数
$gls-rank-cols: 24px minmax(72px, 128px) minmax(48px, 1fr) auto 42px minmax(44px, auto);

.gls-bar-head,
.gls-bar-row {
  display: grid;
  grid-template-columns: $gls-rank-cols;
  align-items: center;
  gap: $s-2;
}

.gls-bar-head {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--b3-theme-background); // 遮挡滚动行
}

.gls-bar-row {           // 原生 button：border/background/字体全部重置，保留 grid 与 hover
  width: 100%;
  border: none;
  background: transparent;
  text-align: left;
  font: inherit;
  cursor: pointer;

  &:focus-visible { @include focus-ring; }
}

.gls-bar-fill {
  min-width: 2px;         // 极小占比仍可见（有意取舍）
  transition: width 0.12s ease;
}
```

## 范围外（本次不做，建议后续单独排期）

- `gitPush/README.md` 中 `LineRankingSection`「通用区块（mode prop 区分）」属过期描述，与实现不符，可另行修正。
- `styles/Buttons.scss` 的 0.15s 过渡、`common/CommitCountSelect.vue`、`common/EmptyState.vue` 的共享组件化均属跨多视图共享件，改动会影响提交分析/规则检查等视图，不在本次范围。

## Agent Extensions

### SubAgent

- **code-explorer**
- Purpose: 在收尾阶段做一次跨文件核查扫描：确认待删除的 `.gls-*` / `.pld-*` / `.gfe-*` 选择器没有其它引用方，并核对共享组件（Button/Card/Tabs/Checkbox/Badge/Toolbar/IconWrapper）在本仓库的真实 props 用法样例，避免落到猜 props。
- Expected outcome: 输出「无残留引用」结论 + 每处替换所用 props 与其调用样例的对照清单，确保无死样式与 props 误用。