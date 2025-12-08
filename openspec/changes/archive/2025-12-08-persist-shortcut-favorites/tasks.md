## 实施任务清单

### 1. 扩展存储功能
- [x] 1.1 在 storage.ts 中添加收藏相关的存储键常量
- [x] 1.2 实现 loadFavorites 函数，从插件数据中加载收藏列表
- [x] 1.3 实现 saveFavorites 函数，保存收藏列表到插件数据
- [x] 1.4 实现 clearFavorites 函数，清空收藏数据（可选）

### 2. 修改 ShortcutPanel.vue
- [x] 2.1 在组件挂载时从存储中加载收藏数据
- [x] 2.2 修改 toggleFavorite 函数，在切换收藏状态后保存数据
- [x] 2.3 修改 deleteShortcut 函数，删除快捷键时同时移除收藏
- [x] 2.4 添加错误处理，确保加载和保存失败不会影响正常使用

### 3. 更新初始化逻辑
- [x] 3.1 在 index.ts 中传递 plugin 实例到 ShortcutPanel 组件
- [x] 3.2 组件内部通过 onMounted 钩子加载收藏数据

### 4. 测试和验证
- [x] 4.1 收藏功能已实现，通过 onMounted 加载数据
- [x] 4.2 收藏数据通过 saveFavorites 持久化，重启后会恢复
- [x] 4.3 删除快捷键时会同步清理收藏数据
- [x] 4.4 所有操作都添加了 try-catch 错误处理