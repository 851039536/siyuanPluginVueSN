---
name: ComparisonView-modularization
overview: 对 ComparisonView.vue（580行，严重超标）进行模块化拆分：提取重复的 barPct() 到 utils.ts、分离 SCSS、抽取 PeriodSelect 子组件、补充文件头注释。
todos:
  - id: extract-barpct
    content: 将 barPct() 从 ComparisonView.vue 和 ReportView.vue 提取到 utils/index.ts，两组件改为导入
    status: completed
  - id: extract-period-picker
    content: 新建 PeriodPicker.vue 子组件及 styles/period-picker.scss，消除 ComparisonView 模板中 A/B picker 重复
    status: completed
  - id: extract-scss
    content: 将 ComparisonView.vue 内联样式提取到 styles/comparison-view.scss，添加文件头注释
    status: completed
    dependencies:
      - extract-period-picker
---

## 用户需求

根据 AGENTS.md/AGENTS_RULES.md 规则，对 `src/features/statistics/components/ComparisonView.vue`（580 行）进行模块化审查并按规范拆分。

## 审查发现的违规项（5 项）

1. **行数严重超标**：580 行，超过 500 行硬阈值（"严重超标"，强烈建议拆分）
2. **`barPct()` 函数重复定义**：ComparisonView.vue（289 行）和 ReportView.vue（249 行）各定义了一次，违反"功能模块内代码分层"强制规则——同一纯工具函数被 2 个文件使用必须提取到 `utils.ts`
3. **SCSS 内联**：267 行样式写在 `.vue` SFC 中，违反"所有样式必须放在独立 `.scss` 文件"强制规范
4. **缺少文件头注释**：`.vue` 文件顶部缺少功能说明注释（强制规则）
5. **模板重复**：A/B 两个 period picker 区块 HTML 结构完全一致，构成第 2 次出现（接近 Rule of Three 阈值）

## 模块拆分策略

- 提取 `PeriodPicker.vue` 子组件（复用模板中去重的 period picker，消除约 60 行模板重复）
- 提取 `styles/comparison-view.scss`（迁移全部 267 行内联样式）
- 提取 `styles/period-picker.scss`（PeriodPicker 样式必须分离）
- 将 `barPct()` 提取到 `utils/index.ts`，ComparisonView 和 ReportView 统一导入
- 添加文件头注释
- 拆分后 ComparisonView.vue 预计约 230 行，进入"理想"范围

## 技术方案

### 实现策略

按照 AGENTS_RULES.md 模块提取判定标准（文件超 500 行硬阈值 + 含 ≥3 个独立状态 `ref`）触发拆分。拆分策略遵循：先消除代码重复（barPct 提取、PeriodPicker 抽象），再分离样式文件，最后补注释——每一步都可独立验证。

### 关键技术决策

1. **PeriodPicker 组件设计**：采用 `v-model` 双向绑定 year/month，props 传 label（"A"/"B"）和 yearOptions，保持父组件对状态的完全控制（ComparisonView 持有 4 个 `ref`：yearA/monthA/yearB/monthB）。这是最小的合理抽象，不引入不必要的复杂度。

2. **barPct 提取到 utils/index.ts**：该函数是纯计算函数（输入 val/max，输出百分比字符串），无 Vue 响应式依赖，符合 utils 层定义。ReportView.vue 中原有的本地定义改为从 `../utils` 导入。

3. **SCSS 分离**：comparison-view.scss 承载 ComparisonView 专属样式（表格、breakdown、bar）；period-picker.scss 承载 PeriodPicker 专属样式。两个 SCSS 文件均通过 `@use "../styles/index.scss" as stats;` 复用 stats 模块的变量和 mixin。

### 实现注意事项

- **向后兼容**：ComparisonView 对父组件 ReportView.vue 的接口（`onGetComparisonData` props）完全不变
- **样式作用域**：SCSS 文件使用与 Vue scoped style 等价的选择器命名，通过 BEM 风格的 class 层级隔离，不依赖 Vue 的 scoped 属性
- **PeriodPicker 仅 1 处使用**：虽然当前仅在 ComparisonView 中使用，但提取理由充分——消除模板内第 2 次重复 + 文件超 500 行硬阈值触发。若未来 report 单期视图也需要周期选择器，可直接复用
- **barPct 命名**：函数名保持 `barPct`（小驼峰），与 utils 中已有的 `formatNumber`、`padZero` 命名风格保持一致