# 快捷键模块数据持久化说明

## 概述

本文档说明了快捷键模块如何实现自定义快捷键的数据持久化，使得用户添加的快捷键在重启插件后能够保留。

## 核心功能

### 1. 数据保存 (storage.ts)

创建了 `src/features/shortcut/storage.ts` 模块，提供三个主要函数：

#### `loadCustomShortcuts(plugin: Plugin): Promise<ShortcutInfo[]>`
- **功能**: 从思源笔记的数据库加载已保存的自定义快捷键
- **返回**: 快捷键数组，如果未找到则返回空数组
- **使用场景**: 插件初始化时调用，恢复用户之前添加的快捷键

#### `saveCustomShortcuts(plugin: Plugin, shortcuts: ShortcutInfo[]): Promise<boolean>`
- **功能**: 将自定义快捷键保存到思源笔记的数据库
- **参数**: 
  - `plugin`: 插件实例
  - `shortcuts`: 所有快捷键数组（函数会自动过滤只保存 category === 'custom' 的）
- **返回**: 保存是否成功
- **调用时机**: 当用户添加或删除快捷键时自动触发

#### `clearCustomShortcuts(plugin: Plugin): Promise<boolean>`
- **功能**: 清空所有自定义快捷键数据
- **返回**: 清空是否成功

### 2. 管理器改进 (manager.ts)

更新了 `ShortcutManager` 类以支持回调保存：

#### 新增方法

```typescript
setSaveCallback(callback: (shortcuts: ShortcutInfo[]) => Promise<void>): void
```
- **功能**: 设置保存回调函数
- **参数**: 异步回调函数，在快捷键数据变化时触发
- **使用**: 允许管理器在数据变化时自动通知外部保存

#### 更新的异步方法

- `async addShortcut(shortcut: ShortcutInfo): Promise<void>`
- `async addShortcuts(shortcuts: ShortcutInfo[]): Promise<void>`
- `async removeShortcut(id: string): Promise<boolean>`

这些方法现在都是异步的，在数据修改后会自动触发保存回调。

### 3. UI 组件更新 (ShortcutPanel.vue)

更新了快捷键面板组件以支持异步操作：

```typescript
async function addShortcut() { ... }
async function deleteShortcut(id: string) { ... }
```

这些函数现在会等待保存完成。

### 4. 设置面板开关 (SettingPanel.vue)

添加了快捷键模块的启用/禁用开关：

```vue
<div class="setting-item b3-label">
  <span class="fn__flex-1">{{ i18n.enableShortcuts || '快捷键面板' }}</span>
  <input
    type="checkbox"
    class="b3-switch fn__flex-center"
    v-model="localSettings.enableShortcuts"
  />
</div>
<div class="b3-label__text">{{ i18n.enableShortcutsDesc || '在右侧边栏显示快捷键面板' }}</div>
```

用户可以在设置面板中启用或禁用快捷键面板功能。

### 5. 初始化流程 (index.ts)

更新了 `registerShortcut` 函数为异步，完整流程如下：

```typescript
export async function registerShortcut(plugin: Plugin) {
  const manager = getShortcutManager()
  
  // 1. 添加思源笔记快捷键
  await manager.addShortcuts(getSiyuanShortcuts())
  
  // 2. 添加插件快捷键
  await manager.addShortcuts(getPluginShortcuts(plugin))
  
  // 3. 加载自定义快捷键
  const customShortcuts = await loadCustomShortcuts(plugin)
  if (customShortcuts.length > 0) {
    await manager.addShortcuts(customShortcuts)
  }
  
  // 4. 设置保存回调
  manager.setSaveCallback(async (shortcuts: ShortcutInfo[]) => {
    await saveCustomShortcuts(plugin, shortcuts)
  })
  
  // 5. 添加 Dock
  addShortcutDock(plugin, manager)
}
```

## 数据流图

```
用户操作（添加/删除快捷键）
         ↓
  ShortcutPanel.vue
         ↓
  manager.addShortcut() / removeShortcut()
         ↓
  triggerSave() → setSaveCallback()
         ↓
  storage.saveCustomShortcuts()
         ↓
   plugin.saveData()
         ↓
   思源笔记数据库
```

## 存储位置

自定义快捷键数据存储在思源笔记的插件数据存储中，使用键 `plugin-shortcuts-custom`。

存储格式为 JSON 数组：

```json
[
  {
    "id": "custom_1234567890",
    "name": "我的快捷键",
    "description": "快捷键描述",
    "keys": "Ctrl+Alt+M",
    "category": "custom",
    "group": "自定义"
  },
  ...
]
```

## 生命周期

1. **初始化** (onload)
   - 加载思源笔记和插件快捷键
   - 从数据库加载自定义快捷键
   - 设置保存回调

2. **运行时**
   - 用户添加快捷键 → 自动保存
   - 用户删除快捷键 → 自动保存
   - 用户启用/禁用功能 → 通过设置面板控制

3. **关闭**
   - 所有数据已持久化，重启后自动恢复

## 关键特性

✅ **自动保存**: 无需手动保存，任何修改都自动持久化
✅ **异步操作**: 所有 I/O 操作都是异步的，不阻塞 UI
✅ **模块化**: 存储逻辑完全独立，易于维护和测试
✅ **错误处理**: 所有操作都有完整的错误处理
✅ **灵活配置**: 用户可以通过设置面板启用/禁用功能
✅ **数据隔离**: 只保存自定义快捷键，内置快捷键不被覆盖

## 常见问题

### Q: 重启后快捷键消失？
A: 检查设置中是否启用了快捷键模块（enableShortcuts 为 true）。

### Q: 如何手动清空所有自定义快捷键？
A: 可以通过以下方式：
1. 在面板中逐个删除
2. 调用 `clearCustomShortcuts()` API

### Q: 快捷键数据保存在哪里？
A: 保存在思源笔记的插件数据目录中，具体位置取决于思源安装位置。

## 技术细节

### 异步设计

所有与持久化相关的操作都是异步的：
- 数据库操作通过 Promise 包装
- UI 组件中使用 async/await
- 保存回调是异步函数

### 数据验证

保存前进行验证：
- 检查数据数组有效性
- 过滤非自定义快捷键
- 检查错误并记录日志

### 错误恢复

如果保存失败：
- 在控制台输出错误信息
- 回调函数会 catch 异常
- UI 不会出现冻结

## 扩展建议

未来可以考虑的功能：
- 快捷键导入/导出
- 快捷键备份与恢复
- 快捷键冲突检测
- 快捷键使用统计
- 版本化的快捷键管理
