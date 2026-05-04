# Tag 组件

标签组件，用于分类、标记和展示状态信息。

## 基础用法

```vue
<template>
  <Tag>默认标签</Tag>
  <Tag variant="primary">
    主要
  </Tag>
  <Tag variant="success">
    成功
  </Tag>
  <Tag variant="warning">
    警告
  </Tag>
  <Tag variant="danger">
    危险
  </Tag>
  <Tag variant="info">
    信息
  </Tag>
</template>

<script setup lang="ts">
import Tag from '@/components/Tag.vue'
</script>
```

## 尺寸

支持 3 种尺寸：`small`、`medium`（默认）、`large`

```vue
<template>
  <Tag size="small">
    小标签
  </Tag>
  <Tag size="medium">
    中标签
  </Tag>
  <Tag size="large">
    大标签
  </Tag>
</template>
```

## 形状

支持 3 种形状：`rounded`（默认，圆角）、`square`（方角）、`circle`（完全圆角）

```vue
<template>
  <Tag shape="rounded">
    圆角
  </Tag>
  <Tag shape="square">
    方角
  </Tag>
  <Tag shape="circle">
    完全圆角
  </Tag>
</template>
```

## 可关闭

```vue
<template>
  <div class="tags">
    <Tag
      v-for="tag in tags"
      :key="tag"
      closable
      @close="handleClose(tag)"
    >
      {{ tag }}
    </Tag>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Tag from '@/components/Tag.vue'

const tags = ref(['Vue.js', 'React', 'TypeScript'])

const handleClose = (tag: string) => {
  tags.value = tags.value.filter((t) => t !== tag)
}
</script>
```

## 带图标

```vue
<template>
  <Tag
    icon="iconCheck"
    variant="success"
  >
    已完成
  </Tag>
  <Tag
    icon="iconTime"
    variant="warning"
  >
    处理中
  </Tag>
  <Tag
    icon="iconClose"
    variant="danger"
  >
    已拒绝
  </Tag>
  <Tag
    icon="iconInfo"
    variant="info"
  >
    信息
  </Tag>
</template>
```

## 禁用状态

```vue
<template>
  <Tag disabled>
    禁用标签
  </Tag>
  <Tag
    closable
    disabled
  >
    禁用可关闭
  </Tag>
</template>
```

## 自定义颜色

```vue
<template>
  <!-- 自定义背景色 -->
  <Tag
    color="#8b5cf6"
    textColor="#ffffff"
  >
    紫色
  </Tag>

  <!-- 自定义背景和边框色 -->
  <Tag
    color="#f3e8ff"
    textColor="#7c3aed"
    borderColor="#a78bfa"
  >
    紫色边框
  </Tag>
</template>
```

## 组合示例

### 标签列表

```vue
<template>
  <div class="tag-list">
    <Tag
      v-for="(tag, index) in tags"
      :key="tag.name"
      :variant="tag.type"
      closable
      @close="removeTag(index)"
    >
      {{ tag.name }}
    </Tag>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Tag from '@/components/Tag.vue'

const tags = ref([
  {
    name: 'Vue.js',
    type: 'primary',
  },
  {
    name: 'React',
    type: 'primary',
  },
  {
    name: 'TypeScript',
    type: 'success',
  },
  {
    name: 'Vite',
    type: 'info',
  },
])

const removeTag = (index: number) => {
  tags.value.splice(index, 1)
}
</script>

<style scoped>
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
```

### 文章标签

```vue
<template>
  <div class="article-tags">
    <h4>文章标签</h4>
    <div class="tags">
      <Tag
        v-for="tag in articleTags"
        :key="tag"
        variant="info"
        shape="square"
        size="small"
      >
        {{ tag }}
      </Tag>
    </div>
  </div>
</template>

<script setup lang="ts">
import Tag from '@/components/Tag.vue'

const articleTags = ['前端开发', 'Vue.js', 'TypeScript', '最佳实践']
</script>

<style scoped>
.article-tags h4 {
  margin: 0 0 8px;
  font-size: 14px;
  color: var(--b3-theme-on-background, #333);
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}
</style>
```

### 状态标签

```vue
<template>
  <div class="task-list">
    <div
      v-for="task in tasks"
      :key="task.title"
      class="task-item"
    >
      <span>{{ task.title }}</span>
      <Tag
        :variant="statusConfig[task.status].variant"
        :icon="statusConfig[task.status].icon"
        size="small"
        shape="circle"
      >
        {{ statusConfig[task.status].label }}
      </Tag>
    </div>
  </div>
</template>

<script setup lang="ts">
import Tag from '@/components/Tag.vue'

const tasks = [
  {
    title: '设计稿',
    status: 'completed',
  },
  {
    title: '前端开发',
    status: 'in-progress',
  },
  {
    title: '后端接口',
    status: 'pending',
  },
  {
    title: '测试',
    status: 'error',
  },
]

const statusConfig = {
  "completed": {
    variant: 'success',
    label: '已完成',
    icon: 'iconCheck',
  },
  'in-progress': {
    variant: 'primary',
    label: '进行中',
    icon: 'iconTime',
  },
  "pending": {
    variant: 'default',
    label: '待处理',
    icon: 'iconMore',
  },
  "error": {
    variant: 'danger',
    label: '失败',
    icon: 'iconClose',
  },
}
</script>

<style scoped>
.task-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  border-radius: 6px;
  background: var(--b3-theme-surface-lighter, #f5f5f5);
}
</style>
```

### 动态标签输入

```vue
<template>
  <div class="tag-input">
    <Tag
      v-for="tag in tags"
      :key="tag"
      closable
      @close="handleClose(tag)"
    >
      {{ tag }}
    </Tag>

    <Input
      v-if="inputVisible"
      v-model="inputValue"
      size="small"
      style="width: 100px"
      @blur="handleInputConfirm"
      @keyup.enter="handleInputConfirm"
    />

    <Tag
      v-else
      variant="default"
      style="cursor: pointer"
      @click="showInput"
    >
      + 新标签
    </Tag>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Input from '@/components/Input.vue'
import Tag from '@/components/Tag.vue'

const tags = ref(['Vue.js', 'React'])
const inputVisible = ref(false)
const inputValue = ref('')

const handleClose = (tag: string) => {
  tags.value = tags.value.filter((t) => t !== tag)
}

const handleInputConfirm = () => {
  if (inputValue.value && !tags.value.includes(inputValue.value)) {
    tags.value.push(inputValue.value)
  }
  inputVisible.value = false
  inputValue.value = ''
}

const showInput = () => {
  inputVisible.value = true
}
</script>

<style scoped>
.tag-input {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
</style>
```

### 标签云

```vue
<template>
  <div class="tag-cloud">
    <Tag
      v-for="topic in hotTopics"
      :key="topic.name"
      :variant="topic.weight > 90 ? 'primary' : 'default'"
      :size="topic.weight > 90 ? 'large' : 'medium'"
    >
      {{ topic.name }}
    </Tag>
  </div>
</template>

<script setup lang="ts">
import Tag from '@/components/Tag.vue'

const hotTopics = [
  {
    name: 'Vue.js',
    weight: 100,
  },
  {
    name: 'React',
    weight: 95,
  },
  {
    name: 'TypeScript',
    weight: 90,
  },
  {
    name: 'Vite',
    weight: 85,
  },
  {
    name: '前端',
    weight: 80,
  },
  {
    name: 'JavaScript',
    weight: 75,
  },
]
</script>

<style scoped>
.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  justify-content: center;
}
</style>
```

## Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | 标签尺寸 |
| `variant` | `'default' \| 'primary' \| 'success' \| 'warning' \| 'danger' \| 'info'` | `'default'` | 标签变体 |
| `shape` | `'rounded' \| 'square' \| 'circle'` | `'rounded'` | 标签形状 |
| `icon` | `IconKey` | - | 图标名称 |
| `iconSize` | `number` | `12` | 图标大小 |
| `closable` | `boolean` | `false` | 是否可关闭 |
| `closeIconSize` | `number` | `10` | 关闭按钮图标大小 |
| `disabled` | `boolean` | `false` | 是否禁用 |
| `color` | `string` | - | 自定义背景色 |
| `textColor` | `string` | - | 自定义文本色 |
| `borderColor` | `string` | - | 自定义边框色 |

## Events

| 事件 | 参数 | 说明 |
|------|------|------|
| `close` | - | 点击关闭按钮时触发 |
| `click` | `(event: MouseEvent)` | 点击标签时触发 |

## Slots

| 插槽名 | 说明 |
|--------|------|
| `default` | 标签内容 |

## 设计说明

- **颜色系统** - 使用 HSL 颜色空间，支持透明度变体
- **形状变体** - 提供不同圆角程度以适应不同场景
- **图标支持** - 可在标签前添加图标增强语义
- **可关闭** - 支持动态移除标签
- **自定义颜色** - 支持完全自定义颜色样式
