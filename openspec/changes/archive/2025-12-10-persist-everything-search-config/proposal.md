# 变更：Everything搜索配置持久化

## 为什么
当前Everything搜索对话框的服务地址和端口配置使用localStorage存储，这种方式与插件的配置管理策略不一致，且无法跨设备同步。为了与项目整体架构保持一致并改善用户体验，需要将配置迁移到思源API的持久化存储。

## 变更内容
- 将Everything搜索对话框的服务地址和端口配置从localStorage迁移到SiYuan API持久化存储
- 使用`plugin.loadData()`和`plugin.saveData()`方法替代localStorage
- 保持现有UI和用户交互不变，仅改变底层存储机制
- 确保配置向后兼容，能够自动迁移现有的localStorage配置

## 影响
- 受影响的规范：无（新功能）
- 受影响的代码：
  - `src/features/everythingSearch/EverythingSearchDialog.vue` (行 226-425)
  - 可能需要在`src/config/settings.ts`中添加相关配置管理函数