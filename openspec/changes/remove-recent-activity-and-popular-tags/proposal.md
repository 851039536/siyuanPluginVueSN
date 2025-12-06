# 变更：从 StatisticsPanel.vue 移除最近活跃和热门标签

## 为什么
简化 StatisticsPanel.vue 的界面，移除不太常用的功能（最近活跃文档和热门标签），让用户更专注于核心的统计数据和图表展示。

## 变更内容
- 从 StatisticsPanel.vue 中移除"热门标签云"部分（行 194-208）
- 从 StatisticsPanel.vue 中移除"最近活跃文档"部分（行 210-230）
- 从 StatisticsData 接口中移除 `topTags` 和 `recentDocs` 可选属性
- 移除相关的样式定义（`.tag-cloud-section` 和 `.recent-docs-section`）
- 移除相关的辅助函数（`getTagSize`、`formatDate`、`openDocument`）

## 影响
- 受影响的规范：statistics
- 受影响的代码：src/features/statistics/StatisticsPanel.vue