---
name: review-prompt-github-style-optimization
overview: 优化审核提示词（参考GitHub PR Review模式）并新增「标题质量」作为第六个评分维度，同步更新ReviewPanel雷达图和条形图展示。
todos:
  - id: extend-detailedscore-type
    content: 在 src/types/ai.ts 的 detailedScore 接口中新增 titleQuality 可选字段
    status: completed
  - id: refactor-review-prompt
    content: 重构 AIContentGenerator.ts 的 reviewContent() 审核 prompt 为 GitHub PR Review 三段式结构，新增第6维度标题质量并上调 maxTokens
    status: completed
    dependencies:
      - extend-detailedscore-type
  - id: update-radar-chart
    content: 将 ReviewRadarChart.vue 的 SCORE_KEYS 从5项扩展为6项（新增 titleQuality）
    status: completed
    dependencies:
      - extend-detailedscore-type
  - id: update-review-panel
    content: 在 ReviewPanel.vue 的 scoreLabelMap 中增加 titleQuality 标签映射
    status: completed
    dependencies:
      - extend-detailedscore-type
  - id: update-i18n-and-styles
    content: 新增中英文 i18n 键 reviewScoreTitleQuality，调整 ReviewPanel.scss 中 score-label 宽度为64px
    status: completed
---

## 用户需求

1. **优化审核提示词**：重构 `reviewContent()` 中的审核 prompt 结构，参考 GitHub PR Review 模式。将当前扁平化的提示词升级为 `Summary（总体评价）/ Review Comments（逐条审查意见）/ Suggestions（改进建议）` 三段式结构，让 AI 的输出更贴近代码审查的严谨风格。

2. **新增标题质量评分维度**：在现有 5 个评分维度（准确性/结构/语言质量/格式规范/覆盖完整）基础上，增加第 6 个维度——「标题质量（titleQuality）」，要求 AI 对文档标题的准确性、吸引力、信息量进行独立评分（1-10）。

3. **ReviewPanel 展示更新**：在分项评分条形图区域展示标题质量评分条目，同时雷达图从五轴升级为六轴（等分 360 度为 60 度步长），维度标签和数值标注同步显示。

## 技术方案

### 实现策略

采用最小改动原则：新增维度通过扩展现有数组常量、类型接口、i18n 映射表来实现，不引入新的架构概念。审核 prompt 重构在 `reviewContent()` 方法内部完成，仅改变提示词文本结构和新增 JSON schema 字段，不影响调用方接口。

### 修改文件清单（共 8 个文件）

#### 1. 类型定义 — `src/types/ai.ts`

- 在 `detailedScore` 接口中新增 `titleQuality?: number` 字段

#### 2. 审核逻辑 — `src/features/aiContentGenerator/modules/AIContentGenerator.ts`

- 重构 `reviewContent()` 中的 `reviewPrompt`：引入 GitHub PR Review 三段式结构（Summary / Review Comments / Suggestions），保留原有系统角色和输出格式约束
- 新增第 6 个评分维度描述：`6. 标题质量（titleQuality）— 标题是否准确概括内容、是否具有吸引力与信息量`
- 更新 JSON schema 示例：`"detailedScore":{"accuracy":8,"structure":7,"quality":9,"format":8,"coverage":7,"titleQuality":8}`
- 增加评分规则说明：标题质量评估要求（是否偏离主题、是否过于宽泛、是否有更好的标题建议等）
- 将 `maxTokens` 从 2000 上调至 2500（6 个维度 + 额外 review 结构增加输出量）

#### 3. 雷达图组件 — `src/features/aiContentGenerator/components/ReviewRadarChart.vue`

- `SCORE_KEYS` 从 5 项扩展为 6 项：`["accuracy","structure","quality","format","coverage","titleQuality"]`
- 注释从「五轴」更新为「六轴」
- `ANGLE_STEP` 自动从 72 度变为 60 度（基于 `SCORE_KEYS.length` 计算，无需手动改值）
- 无需调整 viewBox、MAX_RADIUS 和锚点阈值参数

#### 4. 审核面板 — `src/features/aiContentGenerator/components/ReviewPanel.vue`

- `scoreLabelMap` computed 新增 `titleQuality` 键，映射为 `props.i18n.reviewScoreTitleQuality`
- `ScoreKey` 类型从 5 项联合类型自动扩展（基于 `scoreLabelMap` 的 key 推导）

#### 5. 面板样式 — `src/features/aiContentGenerator/styles/ReviewPanel.scss`

- `.score-label` 的 `width` 从 `56px` 扩至 `64px`，以容纳四字中文标签「标题质量」

#### 6. 中文 i18n — `src/i18n/zh_CN/aiContentGenerator.json`

- 新增 `"reviewScoreTitleQuality": "标题质量"`

#### 7. 英文 i18n — `src/i18n/en_US/aiContentGenerator.json`

- 新增 `"reviewScoreTitleQuality": "Title"`

### 雷达图六轴几何兼容性

| 参数 | 五轴值 | 六轴值 | 说明 |
| --- | --- | --- | --- |
| SCORE_KEYS.length | 5 | 6 | 由常量数组长度决定 |
| ANGLE_STEP | 72度 | 60度 | 自动计算，代码无需改 |
| MAX_RADIUS | 50 | 50 | 不变 |
| viewBox | -110 -85 220 170 | 不变 | 六轴标签不超出边界 |
| ANCHOR_COS_THRESHOLD | 0.3 | 0.3 | 不变，各轴方向判定仍适用 |
| BASELINE_SIN_THRESHOLD | 0.35 | 0.35 | 不变 |


### 审核 prompt 结构变更对比

**当前结构（扁平化）：**

```
你是专业的文档质量审核专家 → 用户需求 → 生成内容 → 5维度 → JSON格式
```

**优化后结构（GitHub PR Review 风格）：**

```
你是专业的代码/文档审核专家，模拟 GitHub PR Review 风格进行审核：
  ## Summary（总体评价）
  简洁总结文档整体质量，给出 rating
  
  ## Review Comments（逐条审查意见）
  对发现的每个问题标注 severity 和具体描述
  
  ## Suggestions（改进建议）
  可操作的改进方向 → 6维度评分 → 标题质量专项评估 → JSON格式
```

### 注意事项

- 本功能已在 config.ts、features/index.ts 完成注册，属存量功能模块内部优化，无需触及 8 步注册流程
- 图标、功能开关、存储均无需改动
- 审核修复逻辑（useReview.ts）仅消费 `ReviewResult.detailedScore`，不直接依赖具体维度名，新增字段自动透传