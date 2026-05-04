# Badge 组件

徽标组件，用于展示数量、状态或提醒信息，通常附加在其他元素上。

## 基础用法

### 数量徽标

```vue
<template>
  <Badge :content="5">
    <Button>消息</Button>
  </Badge>

  <Badge :content="99">
    <Button>通知</Button>
  </Badge>
</template>

<script setup lang="ts">
import Badge from '@/components/Badge.vue'
import Button from '@/components/Button.vue'
</script>
```

### 最大值限制

```vue
<template>
  <!-- 超过 max 显示 "99+" -->
  <Badge
    :content="100"
    :max="99"
  >
    <Button>消息</Button>
  </Badge>

  <!-- 自定义最大值 -->
  <Badge
    :content="1000"
    :max="999"
  >
    <Button>通知</Button>
  </Badge>
</template>
```

### 圆点徽标

```vue
<template>
  <Badge dot>
    <Button>待处理</Button>
  </Badge>

  <Badge dot>
    <Avatar src="avatar.jpg" />
  </Badge>
</template>
```

### 自定义文本

```vue
<template>
  <Badge content="NEW">
    <Button>更新</Button>
  </Badge>

  <Badge content="HOT">
    <Button>热门</Button>
  </Badge>
</template>
```

## 颜色变体

支持 6 种颜色变体：`default`、`primary`、`success`、`warning`、`danger`（默认）、`info`

```vue
<template>
  <Badge
    variant="default"
    content="默认"
  >
    <Button>默认</Button>
  </Badge>

  <Badge
    variant="primary"
    content="主要"
  >
    <Button>主要</Button>
  </Badge>

  <Badge
    variant="success"
    content="成功"
  >
    <Button>成功</Button>
  </Badge>

  <Badge
    variant="warning"
    content="警告"
  >
    <Button>警告</Button>
  </Badge>

  <Badge
    variant="danger"
    content="危险"
  >
    <Button>危险</Button>
  </Badge>

  <Badge
    variant="info"
    content="信息"
  >
    <Button>信息</Button>
  </Badge>
</template>
```

## 自定义颜色

```vue
<template>
  <Badge
    color="#8b5cf6"
    content="自定义"
  >
    <Button>紫色</Button>
  </Badge>

  <Badge
    color="#ec4899"
    content="自定义"
  >
    <Button>粉色</Button>
  </Badge>

  <Badge
    color="#14b8a6"
    dot
  >
    <Button>青色圆点</Button>
  </Badge>
</template>
```

## 尺寸

支持 3 种尺寸：`small`、`medium`（默认）、`large`

```vue
<template>
  <Badge
    size="small"
    :content="99"
  >
    <Button size="small">
      小
    </Button>
  </Badge>

  <Badge
    size="medium"
    :content="99"
  >
    <Button size="medium">
      中
    </Button>
  </Badge>

  <Badge
    size="large"
    :content="99"
  >
    <Button size="large">
      大
    </Button>
  </Badge>
</template>
```

## 位置

支持 4 种位置：`top-right`（默认）、`top-left`、`bottom-right`、`bottom-left`

```vue
<template>
  <Badge
    position="top-right"
    content="右上"
  >
    <Button>右上</Button>
  </Badge>

  <Badge
    position="top-left"
    content="左上"
  >
    <Button>左上</Button>
  </Badge>

  <Badge
    position="bottom-right"
    content="右下"
  >
    <Button>右下</Button>
  </Badge>

  <Badge
    position="bottom-left"
    content="左下"
  >
    <Button>左下</Button>
  </Badge>
</template>
```

## 自定义偏移

```vue
<template>
  <!-- [x, y] 偏移量（像素） -->
  <Badge
    :offset="[10, 10]"
    content="偏移"
  >
    <Button>偏移</Button>
  </Badge>

  <Badge
    position="bottom-right"
    :offset="[5, 5]"
    dot
  >
    <Button>右下偏移</Button>
  </Badge>
</template>
```

## 隐藏徽标

```vue
<template>
  <!-- 隐藏徽标 -->
  <Badge
    :hidden="!hasNotification"
    :content="5"
  >
    <Button>消息</Button>
  </Badge>

  <!-- 条件隐藏 -->
  <Badge
    :content="0"
    :show-zero="false"
  >
    <Button>通知</Button>
  </Badge>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Badge from '@/components/Badge.vue'
import Button from '@/components/Button.vue'

const hasNotification = ref(true)
</script>
```

## 独立使用

```vue
<template>
  <!-- 不包裹任何元素，独立显示 -->
  <Badge :content="99" />
  <Badge content="NEW" />
  <Badge dot />
</template>
```

## 组合示例

### 通知中心

```vue
<template>
  <div class="notification-center">
    <Badge
      :content="unreadCount"
      :max="99"
    >
      <Button icon="iconBell">
        消息
      </Button>
    </Badge>

    <Badge dot>
      <Button icon="iconSettings">
        设置
      </Button>
    </Badge>

    <Badge
      variant="success"
      content="NEW"
    >
      <Button>更新</Button>
    </Badge>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Badge from '@/components/Badge.vue'
import Button from '@/components/Button.vue'
import IconWrapper from '@/components/IconWrapper.vue'

const unreadCount = ref(5)
const hasUpdate = ref(true)
</script>

<style scoped>
.notification-center {
  display: flex;
  gap: 16px;
}
</style>
```

### 用户状态

```vue
<template>
  <div class="user-status">
    <Badge
      dot
      color="#10b981"
      position="bottom-right"
    >
      <Avatar
        src="avatar.jpg"
        size="large"
      />
    </Badge>
    <span>在线</span>
  </div>

  <div class="user-status">
    <Badge
      dot
      color="#ef4444"
      position="bottom-right"
    >
      <Avatar
        src="avatar2.jpg"
        size="large"
      />
    </Badge>
    <span>忙碌</span>
  </div>
</template>

<script setup lang="ts">
import Avatar from '@/components/Avatar.vue'
import Badge from '@/components/Badge.vue'
</script>

<style scoped>
.user-status {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
```

### 菜单项

```vue
<template>
  <div class="menu-item">
    <span>收件箱</span>
    <Badge
      :content="12"
      size="small"
    />
  </div>

  <div class="menu-item">
    <span>草稿箱</span>
    <Badge
      :content="3"
      size="small"
      variant="warning"
    />
  </div>

  <div class="menu-item">
    <span>已发送</span>
    <Badge
      content="NEW"
      size="small"
      variant="success"
    />
  </div>
</template>

<script setup lang="ts">
import Badge from '@/components/Badge.vue'
</script>

<style scoped>
.menu-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 6px;
}

.menu-item:hover {
  background: var(--b3-theme-surface-lighter, #f5f5f5);
}
</style>
```

## Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `content` | `string \| number` | - | 徽标内容 |
| `dot` | `boolean` | `false` | 是否显示为圆点 |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | 徽标尺寸 |
| `variant` | `'default' \| 'primary' \| 'success' \| 'warning' \| 'danger' \| 'info'` | `'danger'` | 徽标变体 |
| `position` | `'top-right' \| 'top-left' \| 'bottom-right' \| 'bottom-left'` | `'top-right'` | 徽标位置 |
| `hidden` | `boolean` | `false` | 是否隐藏徽标 |
| `max` | `number` | `99` | 最大数值（超过显示 max+） |
| `showZero` | `boolean` | `false` | 是否显示零值 |
| `color` | `string` | - | 自定义颜色 |
| `offset` | `[number, number]` | - | 徽标偏移量（像素）[x, y] |

## Slots

| 插槽名 | 说明 |
|--------|------|
| `default` | 默认内容，要附加徽标的元素 |

## 样式变量

组件使用以下品牌变量（可在 `src/_variables.scss` 中找到）：

- `$radius-full` - 完全圆角
- `$transition-base` - 基础过渡动画
- `$brand-dark` - 深色文本
- `$brand-light` - 浅色背景
- `$brand-orange` - 主要色
- `$brand-success` - 成功色
- `$brand-warning` - 警告色
- `$brand-destructive` - 危险色
- `$brand-info` - 信息色
