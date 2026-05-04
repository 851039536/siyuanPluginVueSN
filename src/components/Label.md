# Label 组件

标签组件，用于表单标签或独立的状态标签展示。

## 基础用法

### 表单标签

```vue
<template>
  <div>
    <Label for="username">用户名</Label>
    <Input
      id="username"
      placeholder="请输入用户名"
    />
  </div>
</template>

<script setup lang="ts">
import Input from '@/components/Input.vue'
import Label from '@/components/Label.vue'
</script>
```

### 必填标记

```vue
<template>
  <Label
    for="email"
    required
  >邮箱地址</Label>
  <Input
    id="email"
    type="email"
    placeholder="请输入邮箱"
  />
</template>
```

### 带图标

```vue
<template>
  <Label
    icon="iconEmail"
    for="email"
  >邮箱</Label>
  <Input id="email" />

  <Label
    icon="iconLock"
    icon-position="right"
    for="password"
  >密码</Label>
  <Input
    id="password"
    type="password"
  />
</template>
```

## 尺寸

支持 3 种尺寸：`small`、`medium`（默认）、`large`

```vue
<template>
  <Label size="small">小标签</Label>
  <Label size="medium">中标签</Label>
  <Label size="large">大标签</Label>
</template>
```

## 状态

支持 4 种状态：`default`（默认）、`error`、`success`、`warning`

```vue
<template>
  <Label state="default">默认状态</Label>
  <Label state="error">错误状态</Label>
  <Label state="success">成功状态</Label>
  <Label state="warning">警告状态</Label>
</template>
```

## 独立标签（内联样式）

使用 `tag` 属性改为非 label 元素，可作为独立的状态标签使用。

```vue
<template>
  <!-- 默认样式 -->
  <Label tag="span">默认</Label>

  <!-- 主要色 -->
  <Label
    tag="span"
    variant="primary"
  >主要</Label>

  <!-- 成功色 -->
  <Label
    tag="span"
    variant="success"
  >成功</Label>

  <!-- 警告色 -->
  <Label
    tag="span"
    variant="warning"
  >警告</Label>

  <!-- 危险色 -->
  <Label
    tag="span"
    variant="danger"
  >危险</Label>

  <!-- 信息色 -->
  <Label
    tag="span"
    variant="info"
  >信息</Label>
</template>

<script setup lang="ts">
import Label from '@/components/Label.vue'
</script>
```

## 图标

```vue
<template>
  <!-- 图标在左侧 -->
  <Label
    icon="iconCheck"
    tag="span"
    variant="success"
  >已完成</Label>

  <!-- 图标在右侧 -->
  <Label
    icon="iconDown"
    icon-position="right"
    tag="span"
  >
    下拉菜单
  </Label>
</template>
```

## 禁用状态

```vue
<template>
  <Label disabled>禁用标签</Label>
</template>
```

## 文本对齐

```vue
<template>
  <Label
    width="200px"
    align="left"
  >左对齐</Label>
  <Label
    width="200px"
    align="center"
  >居中对齐</Label>
  <Label
    width="200px"
    align="right"
  >右对齐</Label>
</template>
```

## 自定义宽度

```vue
<template>
  <!-- 固定宽度像素 -->
  <Label :width="120">用户名</Label>
  <Input />

  <!-- 百分比宽度 -->
  <Label width="30%">邮箱</Label>
  <Input />
</template>
```

## 组合示例

### 表单组

```vue
<template>
  <div class="form-group">
    <div class="form-item">
      <Label
        for="username"
        required
        icon="iconUser"
      >用户名</Label>
      <Input
        id="username"
        v-model="formData.username"
        placeholder="请输入用户名"
      />
    </div>

    <div class="form-item">
      <Label
        for="email"
        required
        icon="iconEmail"
      >邮箱地址</Label>
      <Input
        id="email"
        v-model="formData.email"
        type="email"
        placeholder="请输入邮箱"
      />
    </div>

    <div class="form-item">
      <Label
        for="password"
        required
        icon="iconLock"
      >密码</Label>
      <Input
        id="password"
        v-model="formData.password"
        type="password"
        placeholder="请输入密码"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Button from '@/components/Button.vue'
import Input from '@/components/Input.vue'
import Label from '@/components/Label.vue'

const formData = ref({
  username: '',
  email: '',
  password: '',
})
</script>

<style scoped>
.form-item {
  margin-bottom: 16px;
}
</style>
```

### 错误提示

```vue
<template>
  <div>
    <Label
      for="email"
      :state="error ? 'error' : 'default'"
      required
    >
      邮箱地址
    </Label>
    <Input
      id="email"
      v-model="email"
      placeholder="请输入邮箱"
      @blur="validateEmail"
    />
    <p
      v-if="error"
      class="error-text"
    >
      {{ error }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Input from '@/components/Input.vue'
import Label from '@/components/Label.vue'

const email = ref('')
const error = ref('')
</script>

<style scoped>
.error-text {
  margin-top: 4px;
  font-size: 12px;
  color: var(--b3-theme-destructive, #ef4444);
}
</style>
```

### 状态标签组

```vue
<template>
  <div class="task-list">
    <div
      v-for="task in tasks"
      :key="task.title"
      class="task-item"
    >
      <span>{{ task.title }}</span>
      <Label
        tag="span"
        :variant="statusConfig[task.status].variant"
        size="small"
      >
        {{ statusConfig[task.status].label }}
      </Label>
    </div>
  </div>
</template>

<script setup lang="ts">
import Label from '@/components/Label.vue'

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
  },
  'in-progress': {
    variant: 'primary',
    label: '进行中',
  },
  "pending": {
    variant: 'default',
    label: '待处理',
  },
  "error": {
    variant: 'danger',
    label: '失败',
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

### 标签云

```vue
<template>
  <div class="tag-cloud">
    <Label
      v-for="tag in tags"
      :key="tag"
      tag="span"
      variant="info"
    >
      {{ tag }}
    </Label>
  </div>
</template>

<script setup lang="ts">
import Label from '@/components/Label.vue'

const tags = [
  'Vue.js',
  'React',
  'TypeScript',
  'Vite',
  'CSS',
  'JavaScript',
  'HTML',
  'Node.js',
]
</script>

<style scoped>
.tag-cloud {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
```

### 表格状态列

```vue
<template>
  <table class="user-table">
    <thead>
      <tr>
        <th>用户名</th>
        <th>状态</th>
      </tr>
    </thead>
    <tbody>
      <tr
        v-for="user in users"
        :key="user.name"
      >
        <td>{{ user.name }}</td>
        <td>
          <Label
            tag="span"
            size="small"
            :variant="statusConfig[user.status].variant"
          >
            {{ statusConfig[user.status].label }}
          </Label>
        </td>
      </tr>
    </tbody>
  </table>
</template>

<script setup lang="ts">
import Label from '@/components/Label.vue'

const users = [
  {
    name: '张三',
    status: 'active',
  },
  {
    name: '李四',
    status: 'inactive',
  },
  {
    name: '王五',
    status: 'pending',
  },
]

const statusConfig = {
  active: {
    variant: 'success',
    label: '活跃',
  },
  inactive: {
    variant: 'default',
    label: '离线',
  },
  pending: {
    variant: 'warning',
    label: '待激活',
  },
}
</script>

<style scoped>
.user-table {
  width: 100%;
  border-collapse: collapse;
}

.user-table th,
.user-table td {
  padding: 12px;
  text-align: left;
  border-bottom: 1px solid var(--b3-border-color, #e5e5e5);
}
</style>
```

## Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `required` | `boolean` | `false` | 是否必填 |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | 标签尺寸 |
| `variant` | `'default' \| 'primary' \| 'success' \| 'warning' \| 'danger' \| 'info'` | `'default'` | 标签变体（独立展示时） |
| `state` | `'default' \| 'error' \| 'success' \| 'warning'` | `'default'` | 状态 |
| `icon` | `IconKey` | - | 图标名称 |
| `iconSize` | `number` | `14` | 图标大小 |
| `iconPosition` | `'left' \| 'right'` | `'left'` | 图标位置 |
| `tag` | `'label' \| 'span' \| 'div'` | `'label'` | HTML 标签类型 |
| `for` | `string` | - | 关联的表单元素 id |
| `disabled` | `boolean` | `false` | 是否禁用 |
| `width` | `string \| number` | - | 自定义宽度 |
| `align` | `'left' \| 'center' \| 'right'` | `'left'` | 文本对齐 |

## Slots

| 插槽名 | 说明 |
|--------|------|
| `default` | 标签内容 |

## 使用场景

1. **表单标签** - 与表单元素关联，提供语义化的标签
2. **状态标识** - 独立展示状态信息（成功、警告、错误等）
3. **标签云** - 展示标签或分类
4. **表格状态列** - 在表格中展示状态信息

## 注意事项

- 当 `tag="label"` 时，`for` 属性会关联到对应的表单元素
- 使用 `tag="span"` 或 `tag="div"` 可将组件作为独立的状态标签使用
- `required` 属性会显示红色星号标记
- `state` 属性用于表单验证状态展示
- `variant` 属性仅对非 label 标签生效，用于独立标签的颜色样式
