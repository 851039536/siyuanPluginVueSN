---
name: fix-style-options-width
overview: 将 codeUtils.scss 中 .style-options 的 minmax 最小值从 120px 增大到 140px，让中文命名风格卡片标签完整显示。
todos:
  - id: fix-style-options-width
    content: 修改 codeUtils.scss 中 .style-options 的 grid-template-columns minmax 值：桌面端 120px→145px（L74），响应式端 100px→120px（L496）
    status: completed
---

## 用户需求

CodeTranslationPanel.vue 第 22-37 行的命名风格选择区域（.style-options）格子供宽度不足，5 个中文命名风格标签（驼峰命名、帕斯卡命名、下划线命名、短横线命名、常量命名）在 120px 最小列宽内显示局促。

## 修改目标

增大共享样式 `codeUtils.scss` 中 `.style-options` 的 `minmax` 最小列宽值，桌面端从 120px 提升至 145px，响应式端从 100px 提升至 120px，使所有 5 个风格选项有足够空间展示标签和示例文本。

## 技术方案

### 修改范围

仅修改 `src/features/toolCollection/tools/wordQuery/styles/codeUtils.scss` 两处 `grid-template-columns` 值：

| 位置 | 当前值 | 修改后 | 说明 |
| --- | --- | --- | --- |
| L74（桌面端） | `repeat(auto-fill, minmax(120px, 1fr))` | `repeat(auto-fill, minmax(145px, 1fr))` | 5 项中文标签 + 英文示例需要 145px 最小宽度 |
| L496（≤480px 响应式） | `repeat(auto-fill, minmax(100px, 1fr))` | `repeat(auto-fill, minmax(120px, 1fr))` | 比例同步放大，移动端仍可换行 |


### 影响分析

- 该 `.style-options` 样式仅被 `CodeTranslationPanel.vue` 和 `CodeCommentGenerator.vue` 使用（各 5 个选项），两者均受益于更大列宽
- `auto-fill` 模式下增大 `minmax` 最小值意味着同宽容器中每行项数减少、单项更宽，不会破坏布局
- 纯 CSS 变更，零逻辑改动，无回归风险