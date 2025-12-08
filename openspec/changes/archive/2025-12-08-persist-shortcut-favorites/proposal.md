# 变更：持久化快捷键收藏功能

## Why
用户在快捷键面板中收藏的快捷键在程序重启后丢失，影响用户体验。需要实现收藏数据的持久化存储。

## What Changes
- 修改快捷键面板的收藏功能，使用思源 API 保存和加载收藏数据
- 在 storage.ts 中添加收藏相关的持久化函数
- 在 ShortcutPanel.vue 中集成数据加载和保存逻辑
- 确保收藏数据在程序重启后能够恢复

## Impact
- 受影响的规范：shortcut-copy
- 受影响的代码：
  - src/features/shortcut/storage.ts (新增收藏存储函数)
  - src/features/shortcut/ShortcutPanel.vue (集成收藏持久化)
  - src/features/shortcut/index.ts (初始化时加载收藏数据)