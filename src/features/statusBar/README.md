# 状态栏

在思源笔记底部状态栏右侧显示系统资源和文档统计信息。包括 CPU 使用率、内存使用情况、系统运行时间、笔记总数/总字数、今日活动统计，并提供密码箱、视频管理器等快捷入口。

## 功能抽屉与自定义分类

点击状态栏右侧的网格图标打开功能抽屉，集中展示全部功能入口，支持搜索、网格/列表视图切换。

### Tab 结构

- **全部**：未分类的非监控功能项（已分配分类的功能自动隐藏，避免重复显示）
- **监控**：状态栏监控项（文档数/总字数/今日活动/CPU/内存/运行时间）的显隐控制
- **自定义分类**：用户创建的动态分类 Tab，仅显示归属该分类的功能

### 分类管理

- 抽屉头部「管理分类」按钮（标签图标）进入管理面板：新建、重命名（输入框回车/失焦提交）、删除分类（成员自动回到未分类），每行显示成员计数
- 每个功能项的分类角标（标签图标）：点击弹出菜单选择归属分类或移出到「未分类」
- 每个功能最多归属一个自定义分类；监控项不参与分类

### 存储槽位

| 键 | 内容 |
|------|------|
| `statusBar-shortcuts` | 状态栏快捷入口（pin 到状态栏的功能 id） |
| `statusBar-monitors` | 监控项显隐集合 |
| `statusBar-categories` | 自定义分类列表（`{ id, name }`，有序） |
| `statusBar-feature-category` | 功能 → 分类 id 的单一归属映射 |

### 固定与开关

- pin 角标：将功能固定/移出到状态栏快捷区
- 开关角标：直接启用/禁用对应功能（经 `plugin.updateSettings` 持久化）

## 文件结构

```
statusBar/
├── index.ts                        # registerStatusBar / unregisterStatusBar（状态栏挂载）
├── index.vue                       # 主面板：监控项 + 快捷入口 + 抽屉容器 + 分配菜单
├── featureRegistry.ts              # 功能注册表（抽屉/快捷/动作统一数据源）+ i18n 分片辅助
├── types/index.ts                  # 类型与监控阈值常量
├── composables/
│   ├── useStatusBar.ts             # CPU/内存/统计采集
│   ├── useStatusBarTask.ts         # 后台任务状态栏展示（跨功能统一入口）
│   └── useFeatureCategories.ts     # 自定义分类 CRUD 与归属持久化
├── components/
│   ├── MonitorItem.vue             # 监控项容器
│   ├── FeatureDrawer.vue           # 功能抽屉（Tab/搜索/分类管理面板）
│   ├── DrawerFeatureItem.vue       # 抽屉项（pin/分类/开关角标）
│   └── CategoryAssignMenu.vue      # 分类分配弹出菜单
└── styles/index.scss               # 全部样式
```
