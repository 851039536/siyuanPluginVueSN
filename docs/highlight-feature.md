# 双击高亮功能开发文档

## 功能概述

双击高亮功能允许用户在思源笔记编辑器中双击选中文本，自动高亮文档中所有匹配的文本，并显示匹配数量提示。

## 文件结构

```
src/features/
├── highlight/
│   └── index.ts          # 核心高亮逻辑
└── generalSettings/
    └── components/
        └── HighlightSettings.vue   # 设置面板组件
```

## 核心功能实现 (index.ts)

### 主要函数

#### `registerHighlight(plugin, enableHighlight)`

注册双击高亮功能。

| 参数 | 类型 | 说明 |
|------|------|------|
| `plugin` | `Plugin` | 思源插件实例 |
| `enableHighlight` | `boolean` | 是否启用功能（默认 true） |

**功能逻辑：**
1. 添加 CSS 高亮样式（只执行一次）
2. 监听 `mouseup` 事件：检测双击选中文本并高亮
3. 监听 `mousedown` 事件：清除高亮

#### `highlightText(value): number`

高亮指定文本，返回匹配数量。

**实现细节：**
- 使用 `document.createTreeWalker` 遍历所有文本节点
- 使用 `document.createRange` 创建选区
- 使用 CSS Custom Highlight API (`CSS.highlights`) 设置高亮
- 匹配逻辑：不区分大小写

### 样式说明

| 样式名 | 作用 |
|--------|------|
| `::highlight(selected-results)` | 高亮文本样式（黄色背景） |
| `.highlight-toast` | 匹配数量提示框 |

### 事件处理

| 事件 | 处理 |
|------|------|
| `mouseup` | 获取选中文本，在编辑器内高亮所有匹配项 |
| `mousedown` | 清除高亮状态 |

## 设置面板 (HighlightSettings.vue)

### Props

| 属性 | 类型 | 说明 |
|------|------|------|
| `i18n` | `Record<string, string>` | 国际化文本（可选） |
| `plugin` | `any` | 插件实例（可选） |

### 数据存储

- **存储键名**: `highlight-settings`
- **存储格式**: `{ enableHighlight: boolean }`
- **默认状态**: 启用（true）

### 方法暴露

| 方法名 | 说明 |
|--------|------|
| `loadSettings()` | 异步加载设置 |
| `enableHighlight` | 当前开关状态（ref） |

### 样式变量

使用思源主题 CSS 变量：

| 变量 | 用途 |
|------|------|
| `--b3-theme-on-surface` | 标签文字颜色 |
| `--b3-theme-surface-variant` | 开关关闭背景 |
| `--b3-theme-primary` | 开关开启背景/匹配数字颜色 |
| `--b3-theme-outline` | 开关边框 |
| `--b3-border-color` | Toast 边框 |

## 使用说明

### 1. 初始化注册

```typescript
import { registerHighlight } from './features/highlight'

// 在插件初始化时调用
registerHighlight(plugin, true)
```

### 2. 添加设置面板

```vue
<template>
  <HighlightSettings 
    :i18n="i18n" 
    :plugin="plugin" 
    ref="highlightSettingsRef"
  />
</template>

<script setup>
import HighlightSettings from './components/HighlightSettings.vue'

const highlightSettingsRef = ref()

// 重新加载设置
highlightSettingsRef.value?.loadSettings()
</script>
```

### 3. 用户操作

| 操作 | 效果 |
|------|------|
| 双击选中文本 | 高亮所有匹配项，显示 Toast 提示 |
| 点击编辑器 | 清除高亮 |

## 注意事项

1. **浏览器兼容性**: 使用 CSS Custom Highlight API，需要现代浏览器支持
2. **性能考虑**: 长文档遍历所有文本节点可能有性能影响
3. **样式隔离**: 高亮样式使用 `::highlight` 伪元素，不影响原有选区样式
4. **国际化**: 支持通过 `i18n` prop 传入自定义文本

## 扩展建议

如需扩展功能，可考虑：
- 添加区分大小写选项
- 添加全词匹配选项
- 支持正则表达式搜索
- 添加快捷键清除高亮
