---
name: refactor-review-panel
overview: 对 ReviewPanel.vue 进行质量评审驱动重构：消除模板内联 SVG 重复模式（提取 ReviewSectionTitle 组件）、优化 JS 逻辑（减少硬编码、合并冗余 computed、提取常量映射）、消除样式违规（font-size 硬编码、gap 硬编码、box-shadow）、确保 Codex 设计规范合规。
todos:
  - id: add-svg-icon-component
    content: 新建 SvgIcon.vue 辅助组件，封装 SVG icon 渲染模式，消除模板中 5 处重复内联 SVG
    status: completed
  - id: add-i18n-severity-keys
    content: 在 zh_CN 和 en_US 的 aiContentGenerator.json 中新增 reviewSeverityHigh/Mid/Low 三个翻译键
    status: completed
  - id: refactor-review-panel-vue
    content: 重构 ReviewPanel.vue：模板用 SvgIcon 替换内联 SVG、过滤按钮 label 改用 i18n 映射、补充缺失的中文注释
    status: completed
    dependencies:
      - add-svg-icon-component
      - add-i18n-severity-keys
  - id: fix-review-panel-scss
    content: 使用 [skill:codex-ui-style-guide] 审核并修复 ReviewPanel.scss 的 Codex 合规问题，将硬编码 gap/padding/border-radius 替换为设计 Token
    status: completed
  - id: verify-changes
    content: 运行 pnpm i18n:verify 验证 i18n 键对齐，确认重构后的代码通过类型检查
    status: completed
    dependencies:
      - refactor-review-panel-vue
      - fix-review-panel-scss
---

## 用户需求

对 `src/features/aiContentGenerator/components/ReviewPanel.vue` 及其关联样式文件 `ReviewPanel.scss` 进行质量评审重构，修复不符合项目 Codex 规范的代码。

## 重构范围

### 模板层

- 将 5 处重复的内联 SVG `<svg><use xlink:href="#iconXxx"></use></svg>` 模式提取为可复用的辅助组件 `SvgIcon.vue`
- 为缺失 i18n 中文注释的模板区块补充注释
- 过滤按钮 label：`SEVERITY_LEVELS.map(sev => ({ key: sev, label: sev }))` 直接用中文枚举值作为显示文案，改为使用 i18n 映射（如 `reviewSeverityHigh`/`reviewSeverityMid`/`reviewSeverityLow`），使严重度过滤按钮与"全部"按钮的文案来源保持一致

### Script 层

- `RATING_CLASS_MAP` 静态常量映射与 `scoreLabelMap` computed 基于 i18n 的动态映射风格不统一：前者是组件级常量，后者依赖 props。保持现有分层但添加明确注释
- `filterOptions` computed 中 `label: sev` 改为 i18n 映射后需新增 `SEVERITY_LABEL_MAP` computed
- 新增对应的 i18n 键：`reviewSeverityHigh`（高）、`reviewSeverityMid`（中）、`reviewSeverityLow`（低）

### 样式层（SCSS 合规）

ReviewPanel.scss 存在 **11 处硬编码违规**，需替换为设计 Token：

| 行号 | 违规项 | 修复方案 |
| --- | --- | --- |
| L14 | `padding: 1px 6px` | `padding: 1px $spacing-1-5`（6px 无标准 token，使用最接近的）——评估后，6px 对应 `$radius-base`（0.375rem=6px）语义不符，保留 `6px` 并添加注释 |
| L15 | `border-radius: 3px` | `$radius-sm`（4px，视觉差异极小） |
| L36 | `gap: 8px` | `$spacing-2` |
| L42 | `gap: 5px` | `$spacing-1`（4px） |
| L63 | `gap: 3px` | `$spacing-px`（3px） |
| L69 | `gap: 6px` | 保留 `6px` 并添加注释（无精确 token） |
| L85 | `border-radius: 3px` | `$radius-sm` |
| L91 | `border-radius: 3px` | `$radius-sm` |
| L119 | `gap: 3px` | `$spacing-px` |
| L123 | `padding: 2px 7px` | `padding: $spacing-2px $spacing-2`（2px+8px） |
| L129 | `border-radius: 3px` | `$radius-sm` |
| L149 | `gap: 4px` | `$spacing-1` |
| L155 | `gap: 5px` | `$spacing-1` |
| L159 | `padding: 4px 6px` | `padding: $spacing-1 $spacing-1-5`——6px 保留并加注释 |
| L160 | `border-radius: 3px` | `$radius-sm` |
| L180 | `gap: 5px` | `$spacing-1` |
| L187 | `padding: 0 4px` | `padding: 0 $spacing-1` |
| L188 | `border-radius: 2px` | `$spacing-2px`（2px） |
| L220 | `gap: 2px` | `$spacing-2px` |
| L221 | `padding: 2px 6px` | `padding: $spacing-2px 6px`（6px 保留注释） |
| L226 | `border-radius: 3px` | `$radius-sm` |
| L239 | `gap: 3px` | `$spacing-px` |
| L251 | `margin-right: 3px` | `margin-right: $spacing-px` |
| L258 | `gap: 8px` | `$spacing-2` |
| L259 | `padding-top: 4px` | `padding-top: $spacing-1` |
| L280 | `gap: 4px` | `$spacing-1` |
| L287 | `gap: 3px` | `$spacing-px` |
| L288 | `padding: 2px 7px` | `padding: $spacing-2px $spacing-2` |
| L293 | `border-radius: 3px` | `$radius-sm` |
| L315 | `gap: 4px` | `$spacing-1` |


### i18n 补充

- 新增 3 个翻译键到 `zh_CN/aiContentGenerator.json` 和 `en_US/aiContentGenerator.json`：
- `reviewSeverityHigh`: "高" / "High"
- `reviewSeverityMid`: "中" / "Mid"
- `reviewSeverityLow`: "低" / "Low"

## 技术方案

### 实现策略

以最小化改动完成质量提升，遵循项目现有架构模式。主要改动分为三层：模板提取 SvgIcon 辅助组件、Script 增加 i18n 严重度映射、SCSS 全面 Token 化。

### 关键决策

1. **SvgIcon 组件**：模板中 `<svg width="X" height="X"><use xlink:href="#iconY"></use></svg>` 出现 5 次，仅尺寸不同（10x10 / 12x12）。提取为 `SvgIcon.vue` 小组件，props 接收 `name`（图标 ID）和 `size`（默认 12），消除模板重复。这是项目已有模式——CollapsibleSection 也内联了类似 SVG，但提取后可供同级组件共用。

2. **严重度标签 i18n 化**：当前 `filterOptions` 直接用中文枚举值 `"高"/"中"/"低"` 作为 label，与"全部"按钮用 `i18n.reviewFilterAll` 不一致。改为 `SEVERITY_LABEL_MAP` computed 映射到 i18n 键。这确保英文环境下的正确显示，也与项目"i18n 是 UI 文案唯一数据源"的硬规则一致。

3. **border-radius 统一为 $radius-sm**：项目中无 3px radius token，$radius-sm（4px）是最接近的标准值。Codex 风格下 1px 差异肉眼不可分辨，统一后更规范。

4. **gap: 6px 保留处理**：项目中无 6px 间距 token（$spacing-1=4px, $spacing-2=8px）。评分条形图的 6px gap 是精心调整的视觉间距，改用 4px 或 8px 会破坏视觉平衡。保留 `6px` 值并添加 `// 无精确 token，保留 6px` 注释。

### 架构影响

- 新增 `SvgIcon.vue` 仅影响 `aiContentGenerator/components/` 目录内
- i18n 新增 3 个键仅影响 `aiContentGenerator` 分片 JSON
- SCSS 修改仅限 `ReviewPanel.scss`，不影响其他模块

### 验证清单

重构完成后需用户自行执行：

```
pnpm lint           # ESLint 检查
pnpm i18n:verify    # 中英文键对齐
npx tsc --noEmit    # TypeScript 类型检查
```

## Agent Extensions

### Skill

- **codex-ui-style-guide**
- 目的：审核 ReviewPanel.scss 的 Codex 风格合规性，确认所有硬编码替换方案符合 Codex 设计规范
- 预期结果：生成样式合规审查报告，确认替换后的 Token 使用正确