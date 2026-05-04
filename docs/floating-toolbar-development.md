# 浮动工具栏功能开发指南

## 概述

浮动工具栏是思源笔记插件的一个功能模块，它在用户选中文本时显示一个工具栏，提供快速操作功能。本模块采用模块化设计，支持动态注册和管理功能。

## 架构设计

### 核心文件结构

```
src/features/floatingToolbar/
├── FloatingToolbar.ts    # 主类，负责工具栏的生命周期管理
├── actions.ts           # 功能管理器和类型定义
├── examples.ts          # 功能实现示例
└── index.ts             # 模块导出
```

### 核心组件

1. **FloatingToolbar 类** (`FloatingToolbar.ts`)
   - 工具栏的初始化和销毁
   - 事件监听和处理
   - UI 渲染和交互
   - 功能注册入口

2. **ToolbarAction 接口** (`actions.ts`)
   - 定义功能的数据结构
   - 包含 ID、名称、图标、快捷键和处理函数

3. **ToolbarActionManager 类** (`actions.ts`)
   - 功能的注册、移除和查询
   - 功能状态管理
   - 提供批量操作接口

4. **ToolbarActionFactory 类** (`actions.ts`)
   - 创建功能对象的辅助函数
   - 简化功能定义过程

## 功能接口定义

```typescript
interface ToolbarAction {
  /** 功能唯一标识符 */
  id: string
  /** 功能显示名称 */
  name: string
  /** 功能图标 SVG 字符串 */
  icon: string
  /** 可选的快捷键 */
  hotkey?: string
  /** 功能处理函数 */
  handler: (selectedText: string) => Promise<void> | void
}
```

## 快速开始

### 1. 创建一个简单的功能

```typescript
import {
  ToolbarAction,
  ToolbarActionFactory,
} from './actions'

// 使用工厂函数创建
const myAction = ToolbarActionFactory.createSimpleAction(
  'my-action', // ID
  '我的功能', // 名称
  'Settings', // 图标名称（SiYuan 内置）
  async (selectedText) => { // 处理函数
    console.log('选中的文本:', selectedText)
    // 实现你的功能逻辑
  },
)

// 或者直接创建对象
const myAction: ToolbarAction = {
  id: 'my-action',
  name: '我的功能',
  icon: '<svg><use xlink:href="#iconSettings"></use></svg>',
  hotkey: 'Ctrl+Alt+M',
  handler: async (selectedText) => {
    // 处理逻辑
  },
}
```

### 2. 注册功能到工具栏

```typescript
import { FloatingToolbar } from './features/floatingToolbar/FloatingToolbar'

// 在插件的 onload 方法中
const floatingToolbar = new FloatingToolbar(this)
floatingToolbar.init()

// 注册你的功能
floatingToolbar.registerAction(myAction)
```

### 3. 实现功能逻辑

```typescript
const searchAction: ToolbarAction = {
  id: 'search',
  name: '搜索',
  icon: '<svg><use xlink:href="#iconSearch"></use></svg>',
  handler: async (selectedText) => {
    if (!selectedText) return

    // 在思源笔记内搜索
    const searchUrl = `/search?q=${encodeURIComponent(selectedText)}`
    window.open(searchUrl, '_blank')
  },
}
```

## 高级功能实现

### 使用思源 API

```typescript
const highlightAction: ToolbarAction = {
  id: 'highlight',
  name: '高亮',
  icon: '<svg><use xlink:href="#iconMark"></use></svg>',
  handler: async (selectedText) => {
    // 获取当前块 ID
    const blockId = await getCurrentBlockId()
    if (!blockId) {
      showMessage(plugin, '无法获取当前块ID')
      return
    }

    // 使用思源 API
    const response = await fetch('/api/block/updateBlock', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        id: blockId,
        dataType: 'markdown',
        data: `==${selectedText}==`, // 添加高亮标记
      }),
    })

    if (response.ok) {
      showMessage(plugin, '已添加高亮')
    }
  },
}

// 辅助函数
async function getCurrentBlockId(): Promise<string | null> {
  const selection = window.getSelection()
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0)
    const element = range.startContainer.parentElement
    const blockElement = element?.closest('[data-node-id]')
    return blockElement?.getAttribute('data-node-id')
  }
  return null
}

function showMessage(plugin: Plugin, message: string) {
  fetch('/api/notification/pushMsg', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      msg: message,
      timeout: 7000,
    }),
  })
}
```

### 异步处理和进度提示

```typescript
const processAction: ToolbarAction = {
  id: 'process',
  name: '处理文本',
  icon: '<svg><use xlink:href="#iconSparkles"></use></svg>',
  handler: async (selectedText) => {
    // 显示处理中消息
    showMessage(plugin, '正在处理文本...')

    try {
      // 模拟异步处理
      await new Promise((resolve) => setTimeout(resolve, 1000))

      // 执行实际处理
      const result = await processText(selectedText)

      // 复制结果
      await navigator.clipboard.writeText(result)
      showMessage(plugin, '处理完成并已复制')
    } catch (error) {
      console.error('处理失败:', error)
      showMessage(plugin, '处理失败')
    }
  },
}
```

## 最佳实践

### 1. 功能 ID 命名规范

- 使用小写字母和连字符：`my-feature`
- 避免使用特殊字符和空格
- 确保全局唯一性

### 2. 图标使用

- 优先使用 SiYuan 内置图标（如 `#iconCopy`、`#iconSearch`）
- 查看完整图标列表：[SiYuan Icons](https://github.com/siyuan-note/siyuan/blob/master/app/src/assets/icons)
- 自定义 SVG 图标应保持 16x16 像素大小

### 3. 错误处理

```typescript
const actionWithHandler: ToolbarAction = {
  id: 'my-action',
  name: '我的功能',
  icon: '<svg><use xlink:href="#iconSettings"></use></svg>',
  handler: async (selectedText) => {
    try {
      // 主要逻辑
      await doSomething(selectedText)
      showMessage(plugin, '操作成功')
    } catch (error) {
      console.error('操作失败:', error)
      showMessage(plugin, '操作失败，请查看控制台')
    }
  },
}
```

### 4. 国际化支持

```typescript
const action: ToolbarAction = {
    id: 'copy',
    name: plugin.i18n.floatingToolbar?.copy || '复制',
    icon: '<svg><use xlink:href="#iconCopy"></use></svg>',
    handler: copyText
}

// 在 i18n 文件中添加
// zh_CN.json
{
    "floatingToolbar": {
        "copy": "复制",
        "copySuccess": "已复制到剪贴板"
    }
}
```

### 5. 功能管理

```typescript
// 批量注册功能
const actions = [action1, action2, action3]
actions.forEach((action) => floatingToolbar.registerAction(action))

// 条件注册
if (this.settings.enableAdvancedFeatures) {
  floatingToolbar.registerAction(advancedAction)
}

// 动态移除功能
floatingToolbar.unregisterAction('my-action')
```

## API 参考

### FloatingToolbar 类

#### 方法

- `init(): void` - 初始化工具栏
- `destroy(): void` - 销毁工具栏，清理资源
- `registerAction(action: ToolbarAction): void` - 注册新功能
- `unregisterAction(actionId: string): void` - 移除功能

### ToolbarActionManager 类

#### 方法

- `registerAction(action: ToolbarAction): void` - 注册功能
- `unregisterAction(actionId: string): void` - 移除功能
- `getAction(actionId: string): ToolbarAction | undefined` - 获取功能
- `getAllActions(): ToolbarAction[]` - 获取所有功能
- `hasAction(actionId: string): boolean` - 检查功能是否存在
- `clear(): void` - 清除所有功能
- `getActionCount(): number` - 获取功能数量
- `registerActions(actions: ToolbarAction[]): void` - 批量注册功能

### ToolbarActionFactory 类

#### 静态方法

- `createSimpleAction(id, name, iconName, handler): ToolbarAction` - 创建简单功能
- `createActionWithHotkey(id, name, iconName, hotkey, handler): ToolbarAction` - 创建带快捷键的功能
- `createActionWithCustomIcon(id, name, svg, handler): ToolbarAction` - 创建使用自定义图标的功能

## 常见问题

### Q: 如何获取选中的文本内容？

A: 功能处理函数会自动传入选中的文本作为参数：

```typescript
handler: async (selectedText: string) => {
  console.log('用户选中的文本:', selectedText)
}
```

### Q: 如何处理多选块的情况？

A: 工具栏会自动将多选块的内容用换行符连接后传入。如果需要单独处理，可以：

```typescript
// 获取多选块的详细信息
const selects = protyle.querySelectorAll('.protyle-wysiwyg--select')
```

### Q: 如何添加快捷键支持？

A: 在功能定义中添加 `hotkey` 属性：

```typescript
const action: ToolbarAction = {
  id: 'my-action',
  name: '我的功能',
  icon: '...',
  hotkey: 'Ctrl+Alt+M', // 添加快捷键
  handler: myHandler,
}
```

### Q: 如何实现功能的开关控制？

A: 在注册时检查设置：

```typescript
if (plugin.settings.enableMyFeature) {
  floatingToolbar.registerAction(myAction)
}
```

## 示例代码

完整的功能示例请参考 `examples.ts` 文件，其中包含：

1. 搜索功能示例
2. 高亮功能示例
3. 翻译功能示例
4. 自定义处理示例

这些示例展示了不同类型的功能实现，可以作为开发自己功能的参考。
