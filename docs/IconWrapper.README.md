# IconWrapper 组件使用文档

## 概述

`IconWrapper` 是一个封装了 `@iconify/vue` 的图标组件，提供统一的图标管理、样式定制和错误处理。

## 组件位置

`src/components/IconWrapper.vue`

## 功能特性

- 统一的图标配置管理
- 支持自定义尺寸、颜色
- 图标加载失败错误处理
- 基于 Iconify 图标库，支持 100+ 图标集

## Props

| 属性     | 类型            | 必填 | 默认值 | 说明           |
| -------- | --------------- | ---- | ------ | -------------- |
| `name`   | `IconKey`       | 是   | -      | 图标键名       |
| `size`   | `string\|number` | 否   | -      | 自定义大小     |
| `color`  | `string`        | 否   | -      | 自定义颜色     |
| `className` | `string`    | 否   | -      | 自定义类名     |

## 使用方式

### 1. 导入组件

```vue
<script setup lang="ts">
import IconWrapper from '@/components/IconWrapper.vue'
</script>
```

### 2. 基础使用

```vue
<!-- 使用配置中的图标，保持默认样式 -->
<IconWrapper name="star" />
<IconWrapper name="settings" />
<IconWrapper name="image" />
```

### 3. 自定义大小

```vue
<!-- 数字自动转换为 px -->
<IconWrapper name="image" :size="20" />
<IconWrapper name="trash" :size="16" />

<!-- 字符串直接使用 -->
<IconWrapper name="image" size="2rem" />
<IconWrapper name="image" size="24px" />
```

### 4. 自定义颜色

```vue
<!-- 覆盖配置中的颜色 -->
<IconWrapper name="star" color="#fbbf24" />
<IconWrapper name="error" color="red" />
```

### 5. 组合使用

```vue
<IconWrapper
  name="star"
  :size="18"
  color="#fbbf24"
  className="custom-icon"
/>
```

### 6. 动态图标

```vue
<template>
  <button @click="toggleFavorite">
    <IconWrapper :name="isFavorited ? 'star' : 'starOutline'" :size="16" />
  </button>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const isFavorited = ref(false)
const toggleFavorite = () => {
  isFavorited.value = !isFavorited.value
}
</script>
```

## 可用图标列表

### 功能图标 (FEATURE_ICONS)

| 键名              | 图标             | 默认颜色  |
| ----------------- | ---------------- | --------- |
| `superPanel`      | 视图仪表盘       | #3b82f6   |
| `tableOfContents` | 列表             | #10b981   |
| `imageCompressor` | 图片             | #f59e0b   |
| `docNavigation`   | 文件树           | #8b5cf6   |
| `pageLock`        | 锁               | #ef4444   |
| `wordQuery`       | 书本             | #06b6d4   |
| `generalSettings` | 调节旋钮         | #a855f7   |
| `qrCode`          | 二维码           | #6366f1   |
| `unitConverter`   | 计算器           | #ec4899   |
| `shortcuts`       | 键盘             | #14b8a6   |
| `diskBrowser`     | 硬盘             | #f97316   |
| `codeImageGenerator` | 代码标签     | #22c55e   |
| `aiContentGenerator` | 机器人        | #9333ea   |
| `statistics`      | 柱状图           | #0ea5e9   |
| `pronunciation`   | 音量             | #f43f5e   |
| `encryption`      | 锁               | #dc2626   |
| `video`           | 视频             | #e11d48   |
| `everythingSearch` | 文件搜索        | #3b82f6   |
| `systemMonitor`   | 监控仪表盘       | #8b5cf6   |
| `apiReference`    | API              | #0ea5e9   |
| `floatingToolbar` | 文本格式         | #f97316   |
| `floatingBox`     | 部件             | #8b5cf6   |
| `textDiff`        | 文件对比         | #06b6d4   |
| `base64Image`     | 代码括号         | #f59e0b   |
| `skills`          | 大脑             | #a855f7   |
| `flashcardReading` | 卡片            | #f472b6   |
| `flashcardQuery`  | 放大镜           | #3b82f6   |

### 通用图标 (COMMON_ICONS)

#### 操作类
| 键名         | 说明     |
| ------------ | -------- |
| `close`      | 关闭     |
| `settings`   | 设置     |
| `save`       | 保存     |
| `cancel`     | 取消     |
| `edit`       | 编辑     |
| `delete`     | 删除     |
| `add`        | 添加     |
| `refresh`    | 刷新     |

#### 收藏类
| 键名          | 说明   |
| ------------- | ------ |
| `star`        | 实心星 |
| `starOutline` | 空心星 |

#### 状态类
| 键名    | 说明     | 默认颜色  |
| ------- | -------- | --------- |
| `success` | 成功    | #10b981   |
| `error`   | 错误    | #ef4444   |
| `warning` | 警告    | #f59e0b   |
| `info`    | 信息    | #3b82f6   |

#### 导航类
| 键名    | 说明     |
| ------- | -------- |
| `menu`  | 菜单     |
| `back`  | 后退/左  |
| `forward`| 前进/右 |
| `up`    | 向上     |
| `down`  | 向下     |

#### 文件类
| 键名    | 说明     |
| ------- | -------- |
| `file`  | 文档     |
| `folder`| 文件夹   |
| `image` | 图片     |

#### 其他
| 键名    | 说明     |
| ------- | -------- |
| `search` | 搜索    |
| `filter` | 筛选    |
| `sort`   | 排序    |
| `help`   | 帮助    |
| `eye`    | 显示    |
| `eyeOff` | 隐藏    |

## 项目中的使用位置

| 文件                                | 用途                     |
| ----------------------------------- | ------------------------ |
| `src/features/base64Image/Base64ImagePanel.vue` | 图片、垃圾桶图标        |
| `src/features/flashcardReading/FlashcardReadingPanel.vue` | 卡片阅读功能图标        |
| `src/features/pageLock/LockDialog.vue` | 页面锁定图标            |
| `src/features/superPanel/SuperPanelView.vue` | 超级面板功能图标        |
| `src/features/superPanel/components/FeatureCard.vue` | 功能卡片图标            |
| `src/features/wordQuery/WordQueryPanel.vue` | 单词查询功能图标        |

## 添加新图标

如需添加新图标，请编辑 `src/config/icons.ts`：

```typescript
export const FEATURE_ICONS = {
  // ... 现有图标

  // 添加新功能图标
  myNewFeature: {
    icon: 'mdi:icon-name',  // Iconify 格式
    color: '#3b82f6'        // 可选颜色
  },
} as const

export const COMMON_ICONS = {
  // ... 现有图标

  // 添加新通用图标
  myIcon: {
    icon: 'mdi:icon-name',
  },
} as const
```

## 浏览图标

访问 [Iconify 图标浏览器](https://icon-sets.iconify.design/) 查找可用图标。

## 相关文件

- 组件：`src/components/IconWrapper.vue`
- 配置：`src/config/icons.ts`
- 依赖：`@iconify/vue`
