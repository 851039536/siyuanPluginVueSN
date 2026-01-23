---
title: '如何为 Vue 插件构建可扩展的图标系统'
date: 2025-01-23
published: false
---

## 遇到的问题

我在用 Vue 3 构建思源笔记插件时，需要用到很多图标。不同功能需要不同的图标，结果我发现自己在每个组件里都重复写着相同的图标设置代码。典型的低级错误。

一开始我直接在每个组件里用 `@iconify/vue`：

```vue
<Icon icon="mdi:view-dashboard" style="color: #3b82f6" />
```

但这样很快就变得一团糟。如果我想换个配色方案怎么办？如果图标名称变了怎么办？我得在每个组件里到处找来改去。技术不行啊！

## 我的解决思路

我意识到需要一个统一的地方来管理所有图标配置。看看项目结构，发现已经有了 `src/config/` 目录用来存放配置。放图标配置系统的地方完美。

目标很明确：
1. 所有图标的单一事实来源
2. 类型安全的图标引用
3. 易于自定义（大小、颜色）
4. 同时支持功能图标和通用图标

## 解决方案

### 第一步：图标配置

首先创建了 `src/config/icons.ts`，定义所有图标：

```typescript
export interface IconConfig {
  /** 图标名称（Iconify 格式：collection:icon-name） */
  icon: string
  /** 图标颜色（可选，默认继承主题色） */
  color?: string
  /** 图标大小（可选，默认继承父元素） */
  size?: string | number
}

export const FEATURE_ICONS = {
  superPanel: {
    icon: 'mdi:view-dashboard',
    color: '#3b82f6'
  },
  tableOfContents: {
    icon: 'mdi:format-list-bulleted-square',
    color: '#10b981'
  },
  // ... 更多图标
} as const

export const COMMON_ICONS = {
  close: { icon: 'mdi:close' },
  settings: { icon: 'mdi:cog' },
  save: { icon: 'mdi:content-save' },
  // ... 通用图标
} as const
```

这里的 `as const` 很关键 —— 它让 key 成为字面量类型，这样后面就能获得完整的自动补全。

### 第二步：包装器组件

然后构建 `src/components/IconWrapper.vue`：

```vue
<template>
  <Icon
    :icon="iconConfig.icon"
    :style="iconStyle"
    :class="className"
    @error="handleIconError"
  />
</template>

<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { computed } from 'vue'
import { getIconConfig, type IconKey } from '@/config/icons'

interface Props {
  /** 图标键名 */
  name: IconKey
  /** 自定义大小 */
  size?: string | number
  /** 自定义颜色 */
  color?: string
  /** 自定义类名 */
  className?: string
}

const props = defineProps<Props>()

const iconConfig = computed(() => getIconConfig(props.name))

const iconStyle = computed(() => {
  const style: Record<string, string> = {}

  if (props.size) {
    const size = typeof props.size === 'number' ? `${props.size}px` : props.size
    style.width = size
    style.height = size
  }

  const color = props.color || iconConfig.value.color
  if (color) {
    style.color = color
  }

  return style
})
</script>
```

### 第三步：在组件中使用

现在在任何地方使用图标都超级简单：

```vue
<template>
  <div>
    <IconWrapper name="superPanel" />
    <IconWrapper name="close" size="20px" />
    <IconWrapper name="settings" color="#ff0000" />
  </div>
</template>
```

而且 `name` 属性有完整的自动补全。太棒了！

## 我的收获

这个方案解决了好几个问题：

1. **集中管理** - 所有图标定义都在一个地方。如果需要更改图标或默认颜色，只需在 `icons.ts` 更新一次，就会传播到所有地方。

2. **类型安全** - TypeScript 精确知道有哪些图标可用。不会再有 `icon="mdi:view-dashborad"` 这种拼写错误（在生产环境中发现过这个，好玩）。

3. **灵活性** - 如果需要，我可以按实例覆盖大小和颜色，但默认情况下大多数时候都能正常工作。

4. **错误处理** - 包装器包含了图标加载失败的处理，需要的话可以扩展备用图标。

这个模式扩展性也很好。插件目前有 20+ 个功能图标和 30+ 个通用图标，都通过这个组件统一管理。

## 想看代码？

[IconWrapper.vue](src/components/IconWrapper.vue) - 包装器组件
[icons.ts](src/config/icons.ts) - 图标配置

实现使用的是 Iconify，可以访问大量图标集（Material Design、Carbon、Lucide 等）—— 在 [icon-sets.iconify.design](https://icon-sets.iconify.design/) 浏览。

这才是真正的图标系统。
