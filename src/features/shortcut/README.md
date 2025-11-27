# 快捷键模块 (Shortcut Module)

## 功能概述

快捷键模块在右侧边栏提供一个集中的快捷键信息面板，用户可以:

1. **查看思源笔记常用快捷键** - 涵盖编辑、格式化、块类型、导航等常用操作
2. **查看插件快捷键** - 显示当前项目所有功能的快捷键
3. **搜索快捷键** - 支持按名称、描述、快捷键等关键词搜索
4. **分类管理** - 可按分类（全部、思源笔记、插件、自定义）筛选查看
5. **自定义快捷键** - 开发者可灵活添加自定义快捷键信息

## 目录结构

```
src/features/shortcut/
├── index.ts              # 模块主入口，注册 Dock 和快捷键数据
├── types.ts              # TypeScript 类型定义
├── manager.ts            # 快捷键管理器，负责数据存储和查询
├── ShortcutPanel.vue     # 快捷键面板 Vue 组件
└── README.md             # 本文档
```

## 核心组件说明

### 1. types.ts - 类型定义

定义了快捷键相关的数据结构:

```typescript
// 快捷键分类
type ShortcutCategory = 'siyuan' | 'plugin' | 'custom'

// 快捷键信息
interface ShortcutInfo {
  id: string              // 唯一标识符
  name: string            // 快捷键名称
  description: string     // 功能描述
  keys: string            // 快捷键组合 (如 'Ctrl+K')
  category: ShortcutCategory  // 分类
  group?: string          // 功能分组
  platform?: 'win' | 'mac' | 'linux'  // 平台限制 (可选)
}

// 快捷键分组
interface ShortcutGroup {
  name: string
  shortcuts: ShortcutInfo[]
}
```

### 2. manager.ts - 快捷键管理器

提供快捷键数据的增删查改功能:

```typescript
// 主要方法
addShortcut(shortcut: ShortcutInfo)          // 添加单个快捷键
addShortcuts(shortcuts: ShortcutInfo[])      // 批量添加快捷键
getAllShortcuts(): ShortcutInfo[]            // 获取所有快捷键
getByCategory(category: string)              // 按分类获取
getGrouped(): ShortcutGroup[]                // 获取分组后的快捷键
getGroupedByCategory(): Record<...>          // 按分类+分组组织
getById(id: string)                          // 按 ID 查询
removeShortcut(id: string)                   // 删除快捷键
search(keyword: string)                      // 搜索快捷键
```

全局单例获取:

```typescript
import { getShortcutManager } from './manager'
const manager = getShortcutManager()
```

### 3. ShortcutPanel.vue - 快捷键面板

Vue3 组件，提供完整的 UI 界面:

- **搜索功能** - 实时搜索快捷键
- **分类切换** - 按分类过滤快捷键
- **分组显示** - 按功能分组显示
- **响应式设计** - 适配不同屏幕尺寸
- **主题适配** - 自动适配思源笔记的亮色/暗色主题

### 4. index.ts - 模块主入口

负责:

1. 初始化快捷键管理器
2. 加载思源笔记的常用快捷键
3. 加载插件的快捷键
4. 注册右侧边栏 Dock

## 使用方式

### 基础使用

在 `src/index.ts` 中自动注册（需配置启用）:

```typescript
if (this.settings.enableShortcuts) {
  registerShortcut(this)
}
```

### 自定义添加快捷键

#### 方式 1: 在插件加载时添加

```typescript
import { registerShortcut, addCustomShortcuts } from '@/features'

// 在插件的 onload() 中
addCustomShortcuts([
  {
    id: 'my_feature_1',
    name: '我的功能 1',
    description: '执行自定义操作',
    keys: 'Ctrl+Shift+M',
    category: 'custom',
    group: '我的功能'
  },
  {
    id: 'my_feature_2',
    name: '我的功能 2',
    description: '另一个自定义操作',
    keys: 'Ctrl+Alt+M',
    category: 'custom',
    group: '我的功能'
  }
])
```

#### 方式 2: 单个添加

```typescript
import { addCustomShortcut } from '@/features'

addCustomShortcut({
  id: 'my_feature',
  name: '我的功能',
  description: '执行自定义操作',
  keys: 'Ctrl+M',
  category: 'custom',
  group: '我的功能'
})
```

#### 方式 3: 直接使用管理器

```typescript
import { getShortcutManager } from '@/features'

const manager = getShortcutManager()
manager.addShortcut({
  id: 'my_feature',
  name: '我的功能',
  description: '执行自定义操作',
  keys: 'Ctrl+M',
  category: 'custom',
  group: '我的功能'
})
```

### 查询快捷键

```typescript
import { getShortcutManager } from '@/features'

const manager = getShortcutManager()

// 获取所有快捷键
const all = manager.getAllShortcuts()

// 按分类获取
const pluginShortcuts = manager.getByCategory('plugin')

// 按 ID 查询
const shortcut = manager.getById('my_feature')

// 搜索
const results = manager.search('编辑')
```

## 默认快捷键

### 思源笔记快捷键

#### 编辑操作
- **撤销** - Ctrl+Z
- **重做** - Ctrl+Shift+Z
- **删除块** - Ctrl+Shift+D
- **复制块** - Ctrl+D

#### 文本格式
- **粗体** - Ctrl+B
- **斜体** - Ctrl+I
- **下划线** - Ctrl+U
- **删除线** - Ctrl+Shift+X
- **代码** - Ctrl+Shift+`

#### 块类型
- **一级标题** - Ctrl+1
- **二级标题** - Ctrl+2
- **三级标题** - Ctrl+3
- **无序列表** - Ctrl+Shift+L
- **有序列表** - Ctrl+Shift+O
- **引用块** - Ctrl+Shift+B
- **代码块** - Ctrl+Shift+C

#### 导航
- **搜索** - Ctrl+F
- **替换** - Ctrl+H
- **聚焦** - Ctrl+L

#### 插入
- **行内链接** - Ctrl+K

### 插件快捷键

#### 目录索引
- **插入索引** - Ctrl+Alt+I
- **插入子文档引用** - Ctrl+Alt+R
- **插入子文档大纲** - Ctrl+Alt+O

#### 其他功能
- **锁定/解锁页面** - Icon Click
- **打开图片压缩器** - Icon Click

## 样式定制

快捷键面板使用思源笔记的主题变量，自动适配亮色/暗色主题:

```scss
// 使用的主要变量
--b3-theme-background      // 背景色
--b3-theme-surface         // 表面色
--b3-theme-primary         // 主色
--b3-theme-on-surface      // 文字色
--b3-theme-on-surface-variant  // 辅助文字色
```

## 配置管理

在 `src/config/settings.ts` 中:

```typescript
export interface PluginSettings {
  // ... 其他配置
  enableShortcuts: boolean  // 启用/禁用快捷键模块
}

export const DEFAULT_SETTINGS: PluginSettings = {
  // ... 其他默认值
  enableShortcuts: true,    // 默认启用
}
```

## 国际化支持

已支持中文和英文。翻译文本在:

- `src/i18n/zh_CN.json` - 中文
- `src/i18n/en_US.json` - 英文

### 已支持的国际化键:

- `shortcuts` - 快捷键
- `enableShortcuts` - 启用快捷键面板
- `enableShortcutsDesc` - 快捷键面板描述
- `allShortcuts` - 全部
- `siyuanShortcuts` - 思源笔记
- `pluginShortcuts` - 插件快捷键
- `customShortcuts` - 自定义
- `searchPlaceholder` - 搜索占位符
- `noResults` - 无结果提示
- `other` - 其他

## 最佳实践

### 快捷键组织

1. **使用有意义的 ID** - 便于识别和管理
   ```typescript
   id: 'plugin_insert_index'  // ✓ 清晰
   id: 'feature1'             // ✗ 不清晰
   ```

2. **合理的分组** - 便于用户查找
   ```typescript
   group: '目录索引'  // 将相关快捷键分组
   ```

3. **清晰的描述** - 帮助用户理解功能
   ```typescript
   description: '插入当前文档的子文档索引'  // ✓ 明确
   description: '插入'                      // ✗ 模糊
   ```

### 快捷键命名规范

- 使用 `Ctrl` (Windows/Linux) 和 `Cmd` (Mac) 表示主键
- 使用 `+` 分隔多个键
- 使用 `Shift`, `Alt` 表示修饰键
- 示例: `Ctrl+Alt+I`, `Cmd+Shift+K`

### 避免冲突

- 与思源笔记内置快捷键避免冲突
- 与常用软件快捷键避免冲突
- 可使用 `search()` 方法检查是否存在

## 性能考虑

- 快捷键管理器使用单例模式，全局共享
- 搜索操作经过优化，性能良好
- UI 组件使用 Vue3 Composition API，性能高效

## 常见问题

### Q: 如何修改已添加的快捷键？

A: 使用相同的 ID 调用 `addShortcut()`，会自动覆盖:

```typescript
manager.addShortcut({
  id: 'plugin_insert_index',  // ID 相同
  // ... 新的信息
})
```

### Q: 快捷键支持平台特定吗？

A: 支持。在 `ShortcutInfo` 中设置 `platform` 字段:

```typescript
{
  id: 'my_feature',
  // ...
  platform: 'win'  // 仅在 Windows 显示
}
```

### Q: 如何动态添加快捷键？

A: 快捷键可以在运行时随时添加:

```typescript
// 插件运行过程中任何时刻
addCustomShortcut({
  // ... 快捷键信息
})
```

## 贡献指南

欢迎提交 Pull Request 来改进快捷键列表或 UI!

## 许可证

同主项目许可证
