# Avatar 组件

头像组件，用于展示用户头像、图标或文本。

## 基础用法

### 图片头像

```vue
<script setup lang="ts">
import Avatar from '@/components/Avatar.vue'
</script>

<template>
  <!-- 基础图片头像 -->
  <Avatar src="https://example.com/avatar.jpg" alt="User Avatar" />
</template>
```

### 文本头像

```vue
<template>
  <!-- 显示文本（默认取最后 2 个字符） -->
  <Avatar text="John Doe" />
  <Avatar text="张三" />
  <Avatar text="Alice" />
</template>
```

### 图标头像

```vue
<script setup lang="ts">
import Avatar from '@/components/Avatar.vue'
</script>

<template>
  <!-- 使用图标 -->
  <Avatar icon="iconSettings" />
  <Avatar icon="iconClose" />
</template>
```

### 默认插槽

```vue
<template>
  <!-- 自定义内容 -->
  <Avatar>
    <span>?</span>
  </Avatar>
</template>
```

## 尺寸

支持 5 种尺寸：`xsmall`、`small`、`medium`（默认）、`large`、`xlarge`

```vue
<template>
  <Avatar size="xsmall" text="AB" />
  <Avatar size="small" text="AB" />
  <Avatar size="medium" text="AB" />
  <Avatar size="large" text="AB" />
  <Avatar size="xlarge" text="AB" />
</template>
```

## 形状

支持 2 种形状：`circle`（默认，圆形）、`square`（方形）

```vue
<template>
  <Avatar shape="circle" src="avatar.jpg" />
  <Avatar shape="square" src="avatar.jpg" />
</template>
```

## 自定义尺寸

```vue
<template>
  <!-- 自定义像素尺寸 -->
  <Avatar :customSize="60" text="AB" />
  <Avatar :customSize="80" text="AB" />
</template>
```

## 交互状态

### 可点击

```vue
<script setup lang="ts">
import Avatar from '@/components/Avatar.vue'

const handleClick = () => {
  console.log('Avatar clicked')
}
</script>

<template>
  <Avatar clickable text="AB" @click="handleClick" />
</template>
```

### 激活状态

```vue
<template>
  <Avatar active text="AB" />
</template>
```

### 禁用状态

```vue
<template>
  <Avatar disabled text="AB" />
</template>
```

## 自定义颜色

```vue
<template>
  <!-- 自定义背景色 -->
  <Avatar color="#3b82f6" text="AB" textColor="#ffffff" />
  <Avatar color="#10b981" text="CD" textColor="#ffffff" />
  <Avatar color="#f59e0b" text="EF" textColor="#ffffff" />
</template>
```

## 文本长度控制

```vue
<template>
  <!-- 默认显示最后 2 个字符 -->
  <Avatar text="John Doe" :maxTextLength="2" />

  <!-- 显示最后 1 个字符 -->
  <Avatar text="John Doe" :maxTextLength="1" />

  <!-- 显示最后 3 个字符 -->
  <Avatar text="John Doe" :maxTextLength="3" />
</template>
```

## 组合示例

### 用户列表

```vue
<script setup lang="ts">
import Avatar from '@/components/Avatar.vue'

const users = [
  { name: 'Alice', avatar: 'https://example.com/alice.jpg' },
  { name: 'Bob', avatar: null },
  { name: 'Charlie', avatar: null }
]
</script>

<template>
  <div class="user-list">
    <div v-for="user in users" :key="user.name" class="user-item">
      <Avatar
        v-if="user.avatar"
        :src="user.avatar"
        :alt="user.name"
        size="large"
      />
      <Avatar
        v-else
        :text="user.name"
        size="large"
      />
      <span>{{ user.name }}</span>
    </div>
  </div>
</template>

<style scoped>
.user-list {
  display: flex;
  gap: 16px;
}

.user-item {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
```

### 头像组

```vue
<script setup lang="ts">
import Avatar from '@/components/Avatar.vue'

const avatars = [
  { src: 'avatar1.jpg', alt: 'User 1' },
  { src: 'avatar2.jpg', alt: 'User 2' },
  { src: 'avatar3.jpg', alt: 'User 3' },
  { text: '+5' }
]
</script>

<template>
  <div class="avatar-group">
    <Avatar
      v-for="(avatar, index) in avatars"
      :key="index"
      v-bind="avatar"
      size="small"
      class="avatar-group-item"
    />
  </div>
</template>

<style scoped>
.avatar-group {
  display: flex;
}

.avatar-group-item {
  margin-left: -8px;
  border: 2px solid white;
}

.avatar-group-item:first-child {
  margin-left: 0;
}
</style>
```

## Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `src` | `string` | - | 图片源 |
| `alt` | `string` | `'Avatar'` | 替代文本 |
| `text` | `string` | - | 显示文本 |
| `icon` | `IconKey` | - | 图标名称 |
| `size` | `'xsmall' \| 'small' \| 'medium' \| 'large' \| 'xlarge'` | `'medium'` | 头像尺寸 |
| `shape` | `'circle' \| 'square'` | `'circle'` | 头像形状 |
| `color` | `string` | - | 背景颜色 |
| `textColor` | `string` | - | 文本颜色 |
| `customSize` | `number` | - | 自定义尺寸（像素） |
| `clickable` | `boolean` | `false` | 是否可点击 |
| `active` | `boolean` | `false` | 激活状态 |
| `disabled` | `boolean` | `false` | 禁用状态 |
| `maxTextLength` | `number` | `2` | 文本最大长度 |

## Events

| 事件 | 参数 | 说明 |
|------|------|------|
| `click` | `(event: MouseEvent)` | 点击事件（仅在 `clickable` 时触发） |

## Slots

| 插槽名 | 说明 |
|--------|------|
| `default` | 默认内容，在没有 `src`、`text`、`icon` 时显示 |

## 样式变量

组件使用以下品牌变量（可在 `src/_variables.scss` 中找到）：

- `$radius-full` - 完全圆角
- `$radius-md` - 中等圆角
- `$transition-base` - 基础过渡动画
- `$brand-light-gray` - 浅灰色背景
- `$brand-dark` - 深色文本
- `$shadow-md` - 中等阴影
