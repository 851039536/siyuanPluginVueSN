# 超级面板功能

## 概述

超级面板是一个统一的功能入口，在右侧边栏提供所有插件功能的快捷访问。

## 技术栈

- **Vue 3**: 组件化开发
- **TypeScript**: 类型安全
- **@iconify/vue**: 图标库
- **模块化设计**: 易于维护和扩展

## 文件结构

```
src/features/superPanel/
├── index.ts                    # 主入口，注册功能
├── SuperPanelView.vue          # 面板主视图
├── types.ts                    # 类型定义
├── components/
│   └── FeatureCard.vue         # 功能卡片组件
└── README.md                   # 本文档
```

## 核心功能

### 1. 功能展示

- 以卡片形式展示所有功能
- 显示功能状态（启用/禁用）
- 提供快捷操作按钮

### 2. 图标系统

使用模块化的图标配置系统：

```typescript
// 在 src/config/icons.ts 中配置
export const FEATURE_ICONS = {
  superPanel: {
    icon: 'mdi:view-dashboard',
    color: '#3b82f6'
  }
}
```

在组件中使用：

```vue
<IconWrapper name="superPanel" :size="20" />
```

### 3. 响应式设计

- 平滑的打开/关闭动画
- 点击遮罩层关闭面板
- 自适应主题色

## 添加新功能

### 步骤 1: 添加图标配置

在 `src/config/icons.ts` 中添加：

```typescript
export const FEATURE_ICONS = {
  // ... 现有配置
  
  myNewFeature: {
    icon: 'mdi:star',
    color: '#fbbf24'
  }
}
```

### 步骤 2: 更新功能列表

在 `SuperPanelView.vue` 的 `features` 计算属性中添加：

```typescript
const features = computed<Feature[]>(() => [
  // ... 现有功能
  
  {
    id: 'myNewFeature',
    iconKey: 'myNewFeature',
    title: '我的新功能',
    desc: '这是一个新功能的描述',
    enabled: props.settings.enableMyNewFeature,
    actions: [
      { key: 'doSomething', label: '执行操作', hotkey: 'Ctrl+Alt+N' }
    ]
  }
])
```

### 步骤 3: 处理功能操作

在 `index.ts` 的 `handleFeatureAction` 函数中添加：

```typescript
function handleFeatureAction(_plugin: Plugin, action: string) {
  switch (action) {
    // ... 现有操作
    
    case 'doSomething':
      // 执行你的操作
      window.dispatchEvent(new CustomEvent('myNewFeatureAction'))
      closeSuperPanel()
      break
  }
}
```

## 组件说明

### SuperPanelView.vue

主面板视图组件，负责：
- 渲染面板结构
- 管理功能列表
- 处理用户交互

**Props:**
- `visible`: 面板是否可见
- `settings`: 插件设置对象
- `i18n`: 国际化文本

**Emits:**
- `close`: 关闭面板
- `openSettings`: 打开设置
- `action`: 执行功能操作

### FeatureCard.vue

功能卡片组件，负责：
- 显示单个功能信息
- 渲染操作按钮
- 处理点击事件

**Props:**
- `feature`: 功能配置对象
- `i18n`: 国际化文本

**Emits:**
- `action`: 执行操作

### IconWrapper.vue

图标包装组件，负责：
- 统一图标渲染
- 支持自定义大小和颜色
- 类型安全

## 样式定制

### 主题变量

面板使用思源笔记的主题变量：

```scss
// 背景色
var(--b3-theme-background)
var(--b3-theme-surface)

// 文字色
var(--b3-theme-on-background)
var(--b3-theme-on-surface)

// 主题色
var(--b3-theme-primary)
var(--b3-theme-primary-light)
var(--b3-theme-primary-lighter)
var(--b3-theme-primary-lightest)

// 边框色
var(--b3-theme-surface-lighter)
```

### 自定义样式

可以在组件的 `<style scoped>` 中覆盖样式：

```vue
<style scoped lang="scss">
.super-panel-container {
  // 自定义宽度
  width: 500px;
  
  // 自定义阴影
  box-shadow: -4px 0 20px rgba(0, 0, 0, 0.2);
}
</style>
```

## 国际化

在插件的 i18n 配置中添加文本：

```json
{
  "superPanel": {
    "title": "超级面板",
    "close": "关闭",
    "settings": "插件设置",
    "enabled": "已启用",
    "disabled": "已禁用",
    "featureDisabled": "该功能未启用，请在设置中开启"
  }
}
```

## 最佳实践

### 1. 保持功能独立

每个功能应该是独立的模块，通过事件通信：

```typescript
// 触发功能
window.dispatchEvent(new CustomEvent('myFeatureAction', {
  detail: { data: 'some data' }
}))

// 监听功能
window.addEventListener('myFeatureAction', (event) => {
  const data = event.detail.data
  // 处理数据
})
```

### 2. 使用类型定义

确保所有配置都有类型定义：

```typescript
interface Feature {
  id: string
  iconKey: FeatureIconKey
  title: string
  desc: string
  enabled: boolean
  actions: FeatureAction[]
}
```

### 3. 错误处理

添加适当的错误处理和用户提示：

```typescript
try {
  // 执行操作
} catch (error) {
  showMessage('操作失败：' + error.message, 3000, 'error')
}
```

## 调试技巧

### 1. 查看功能状态

在浏览器控制台中：

```javascript
// 查看插件实例
window._sy_plugin_sample

// 查看设置
window._sy_plugin_sample.settings
```

### 2. 测试图标

在控制台中测试图标是否可用：

```javascript
// 检查 Iconify 是否加载
console.log(window.Iconify)
```

### 3. 调试事件

监听所有自定义事件：

```javascript
window.addEventListener('*', (e) => {
  console.log('Event:', e.type, e.detail)
})
```

## 性能优化

### 1. 懒加载

面板只在打开时才创建 Vue 实例：

```typescript
function openSuperPanel(plugin: Plugin) {
  // 创建容器
  panelContainer = document.createElement('div')
  
  // 创建 Vue 应用
  vueApp = createApp(SuperPanelView, { /* props */ })
  vueApp.mount(panelContainer)
}
```

### 2. 及时清理

关闭面板时销毁 Vue 实例：

```typescript
function closeSuperPanel() {
  if (vueApp && panelContainer) {
    vueApp.unmount()
    panelContainer.remove()
    vueApp = null
    panelContainer = null
  }
}
```

## 未来扩展

可以考虑添加的功能：

1. **搜索功能**: 快速搜索和过滤功能
2. **收藏功能**: 收藏常用功能
3. **自定义排序**: 拖拽调整功能顺序
4. **快捷键提示**: 显示所有快捷键
5. **使用统计**: 记录功能使用频率

## 参考资源

- [Vue 3 文档](https://vuejs.org/)
- [TypeScript 文档](https://www.typescriptlang.org/)
- [Iconify 文档](https://iconify.design/)
- [思源笔记插件开发文档](https://github.com/siyuan-note/siyuan)
