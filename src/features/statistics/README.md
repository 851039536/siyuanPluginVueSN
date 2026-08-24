# 数据统计

显示思源笔记的使用数据统计分析。提供总笔记数、总字数、总块数、总附件数、今日新增/修改文档数、每日字数统计（支持 7/15/30/90/180/365 天周期）、每月字数统计、热门标签统计等，支持定时自动更新。

## 目录结构

```
src/features/statistics/
├── index.ts                        # 功能注册入口（registerStatistics）
├── index.vue                       # Dock 主面板：Tab 栏 + 数据持有 + 刷新编排（编排中心）
├── components/
│   ├── common/                     # 复用组件（面板级常驻）
│   │   └── StatisticsHeader.vue    # 顶部操作栏
│   ├── overview/index.vue          # 概览 Tab 入口（核心指标卡/文档变化/视图模式/图表）
│   ├── heatmap/index.vue           # 热力图 Tab 入口（内部自加载笔记本列表）
│   ├── activity/index.vue          # 活跃度 Tab 入口
│   ├── trend/index.vue             # 趋势 Tab 入口（趋势图 + 预测）
│   ├── distribution/index.vue      # 分布 Tab 入口（自包含懒加载 + hover 联动）
│   ├── report/index.vue            # 报告 Tab 入口
│   └── milestones/index.vue        # 里程碑 Tab 入口
├── composables/                    # 共享逻辑（useStatistics/useHistoryData/useNotebookStats/useMilestoneStorage/useNotebookHover）
├── queries/                        # SQL 查询层（docChangeStats/heatmapStats/notebookStats/reportStats）
├── styles/                         # SCSS（index.scss 为共享基座，组件样式独立文件）
├── types/                          # 类型定义 + 存储 + 里程碑规则
└── utils/                          # 纯工具函数（milestones/achievements 等）
```

### 组件组织规范（功能专属文件夹）

- 每个 Tab 对应 `components/` 下语义化文件夹，入口统一为 `index.vue`（符合 AGENTS_ARCH.md「功能专属文件夹」规则）；
- 主面板 `index.vue` 只负责 Tab 栏、核心数据持有（`useStatistics`/`useHistoryData`）与刷新编排，各 Tab 编排逻辑下放至入口容器；
- 被 ≥2 个视图复用的组件归入 `common/`；
- 分布 Tab 数据懒加载（首次切换激活时加载）、hover 联动均自包含于 `distribution/index.vue`。
