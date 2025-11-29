# 图标配置系统使用指南

## 概述

本项目使用 `@iconify/vue` 作为图标库，提供了模块化的图标配置系统，方便统一管理和扩展。

## 目录结构

```
src/
├── config/
│   ├── icons.ts              # 图标配置文件
│   └── icons.README.md       # 本文档
├── components/
│   └── IconWrapper.vue       # 图标包装组件
└── features/
    └── superPanel/
        ├── SuperPanelView.vue        # 超级面板主视图
        ├── components/
        │   └── FeatureCard.vue       # 功能卡片组件
        └── types.ts                  # 类型定义
```

## 快速开始

### 1. 在 Vue 组件中使用图标

```vue
<template>
  <!-- 基础使用 -->
  <IconWrapper name="superPanel" />
  
  <!-- 自定义大小 -->
  <IconWrapper name="settings" :size="24" />
  
  <!-- 自定义颜色 -->
  <IconWrapper name="success" color="#10b981" />
  
  <!-- 同时自定义大小和颜色 -->
  <IconWrapper name="error" :size="20" color="#ef4444" />
</template>

<script setup lang="ts">
import IconWrapper from '@/components/IconWrapper.vue'
</script>
```

### 2. 添加新图标

在 `src/config/icons.ts` 中添加新的图标配置：

```typescript
export const FEATURE_ICONS = {
  // ... 现有图标
  
  // 添加新功能图标
  myNewFeature: {
    icon: 'mdi:star',           // Iconify 图标名称
    color: '#fbbf24'            // 可选：默认颜色
  }
}
```

### 3. 查找图标

访问 [Iconify 图标库](https://icon-sets.iconify.design/) 搜索和浏览图标。

推荐的图标集：
- **mdi**: Material Design Icons（最全面）
- **carbon**: IBM Carbon Design System（简洁现代）
- **lucide**: Lucide Icons（优雅简约）
- **tabler**: Tabler Icons（一致性好）
- **heroicons**: Heroicons（精致细腻）

## 图标配置说明

### IconConfig 接口

```typescript
interface IconConfig {
  icon: string      // 图标名称（格式：collection:icon-name）
  color?: string    // 可选：默认颜色
  size?: string | number  // 可选：默认大小
}
```

### 图标分类

#### 1. 功能图标 (FEATURE_ICONS)

用于各个功能模块的主图标：

```typescript
export const FEATURE_ICONS = {
  superPanel: { icon: 'mdi:view-dashboard', color: '#3b82f6' },
  tableOfContents: { icon: 'mdi:format-list-bulleted-square', color: '#10b981' },
  // ...
}
```

#### 2. 通用图标 (COMMON_ICONS)

用于通用操作、状态等：

```typescript
export const COMMON_ICONS = {
  // 操作类
  close: { icon: 'mdi:close' },
  settings: { icon: 'mdi:cog' },
  
  // 状态类
  success: { icon: 'mdi:check-circle', color: '#10b981' },
  error: { icon: 'mdi:alert-circle', color: '#ef4444' },
  
  // ...
}
```

## 扩展指南

### 添加新功能模块

1. **在 icons.ts 中添加图标配置**

```typescript
export const FEATURE_ICONS = {
  // ... 现有配置
  
  myFeature: {
    icon: 'mdi:rocket',
    color: '#8b5cf6'
  }
}
```

2. **在功能组件中使用**

```vue
<template>
  <div class="my-feature">
    <IconWrapper name="myFeature" :size="24" />
    <span>我的功能</span>
  </div>
</template>
```

3. **更新类型定义（自动推导）**

TypeScript 会自动推导出新的图标键名类型，无需手动更新。

### 替换图标集

如果想使用其他图标集，只需修改 `icon` 字段：

```typescript
// 从 Material Design Icons
icon: 'mdi:home'

// 改为 Carbon Icons
icon: 'carbon:home'

// 或 Lucide Icons
icon: 'lucide:home'
```

### 自定义图标组件

如果需要更复杂的图标样式，可以扩展 `IconWrapper.vue`：

```vue
<template>
  <div class="icon-container" :class="containerClass">
    <Icon 
      :icon="iconConfig.icon" 
      :style="iconStyle"
    />
    <span v-if="badge" class="icon-badge">{{ badge }}</span>
  </div>
</template>

<script setup lang="ts">
// 添加新的 props
interface Props {
  name: IconKey
  size?: string | number
  color?: string
  badge?: string | number  // 新增：徽章
  containerClass?: string  // 新增：容器类名
}
</script>
```

## 最佳实践

### 1. 保持一致性

- 同一类功能使用同一图标集
- 保持图标风格统一
- 使用语义化的图标名称

### 2. 性能优化

- Iconify 会自动按需加载图标
- 首次使用某个图标集时会有轻微延迟
- 可以预加载常用图标集

### 3. 颜色管理

- 优先使用主题变量（CSS 变量）
- 在配置中设置默认颜色
- 在组件中可以覆盖默认颜色

```vue
<!-- 使用配置的默认颜色 -->
<IconWrapper name="success" />

<!-- 覆盖为自定义颜色 -->
<IconWrapper name="success" color="var(--b3-theme-primary)" />
```

### 4. 尺寸规范

建议的图标尺寸：
- 小图标：16px
- 常规图标：20px
- 大图标：24px
- 特大图标：32px

## 常见问题

### Q: 图标不显示？

A: 检查以下几点：
1. 图标名称是否正确（格式：`collection:icon-name`）
2. 网络是否正常（首次加载需要从 CDN 获取）
3. 控制台是否有错误信息

### Q: 如何离线使用图标？

A: 可以安装对应的图标集包：

```bash
pnpm add @iconify-json/mdi
```

然后在 `vite.config.ts` 中配置：

```typescript
import { defineConfig } from 'vite'
import Icons from 'unplugin-icons/vite'

export default defineConfig({
  plugins: [
    Icons({
      compiler: 'vue3',
      autoInstall: true
    })
  ]
})
```

### Q: 如何批量替换图标？

A: 使用全局搜索替换功能，搜索旧的图标配置并替换为新的。

## 参考资源

- [Iconify 官方文档](https://iconify.design/)
- [Iconify Vue 文档](https://iconify.design/docs/icon-components/vue/)
- [图标搜索](https://icon-sets.iconify.design/)
- [Material Design Icons](https://pictogrammers.com/library/mdi/)
