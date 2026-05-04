# Button Component

通用按钮组件，遵循项目品牌设计规范，支持多种变体、尺寸和状态。

## 特性

- 🎨 **品牌设计规范**：使用 Anthropic 官方品牌色
- 📐 **多种尺寸**：small、medium、large
- 🎭 **多种变体**：primary、secondary、success、danger、ghost
- 🔄 **状态管理**：支持禁用和加载状态
- 🎯 **图标集成**：支持左右图标位置
- 📱 **响应式**：支持块级显示

## 基础用法

### 导入组件

```vue
<script setup lang="ts">
import Button from '@/components/Button.vue'
</script>
```

### 文本按钮

```vue
<template>
  <Button @click="handleClick">
    点击我
  </Button>
</template>
```

### 图标按钮

```vue
<template>
  <!-- 左侧图标 -->
  <Button
    icon="iconSettings"
    @click="handleClick"
  >
    设置
  </Button>

  <!-- 右侧图标 -->
  <Button
    icon="iconDown"
    icon-position="right"
    @click="handleClick"
  >
    更多
  </Button>
</template>
```

### 仅图标按钮

```vue
<template>
  <Button
    icon="iconClose"
    size="small"
    @click="handleClose"
  />
</template>
```

## Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `variant` | `'primary' \| 'secondary' \| 'success' \| 'danger' \| 'ghost'` | `'primary'` | 按钮变体 |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | 按钮尺寸 |
| `icon` | `IconKey` | - | 图标名称 |
| `iconSize` | `number` | `16` | 图标大小（px） |
| `disabled` | `boolean` | `false` | 禁用状态 |
| `loading` | `boolean` | `false` | 加载状态 |
| `iconPosition` | `'left' \| 'right'` | `'left'` | 图标位置 |
| `block` | `boolean` | `false` | 块级按钮（宽度 100%） |

## Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| `click` | `event: MouseEvent` | 点击事件（禁用或加载时不触发） |

## 变体示例

### Primary（主按钮）

```vue
<template>
  <Button variant="primary">
    主按钮
  </Button>
</template>
```

**使用场景**：主要操作、提交表单、确认操作

### Secondary（次要按钮）

```vue
<template>
  <Button variant="secondary">
    次要按钮
  </Button>
</template>
```

**使用场景**：次要操作、取消操作、返回

### Success（成功按钮）

```vue
<template>
  <Button variant="success">
    成功
  </Button>
</template>
```

**使用场景**：完成操作、保存成功、积极操作

### Danger（危险按钮）

```vue
<template>
  <Button variant="danger">
    删除
  </Button>
</template>
```

**使用场景**：删除操作、取消、危险操作

### Ghost（幽灵按钮）

```vue
<template>
  <Button variant="ghost">
    幽灵按钮
  </Button>
</template>
```

**使用场景**：次要操作、不想强调的操作

## 尺寸示例

```vue
<template>
  <Button size="small">
    小按钮
  </Button>
  <Button size="medium">
    中按钮
  </Button>
  <Button size="large">
    大按钮
  </Button>
</template>
```

## 状态示例

### 禁用状态

```vue
<template>
  <Button disabled>
    禁用按钮
  </Button>
</template>
```

### 加载状态

```vue
<template>
  <Button loading>
    加载中...
  </Button>
</template>
```

## 组合示例

### 带图标的主要操作

```vue
<template>
  <Button
    variant="primary"
    icon="iconCheckmark"
    size="large"
    @click="handleSubmit"
  >
    确认提交
  </Button>
</template>
```

### 操作按钮组

```vue
<template>
  <div class="button-group">
    <Button
      variant="secondary"
      icon="iconLeft"
      @click="handleBack"
    >
      返回
    </Button>
    <Button
      variant="primary"
      icon="iconRight"
      icon-position="right"
      @click="handleNext"
    >
      下一步
    </Button>
  </div>
</template>

<style scoped>
.button-group {
  display: flex;
  gap: 12px;
  justify-content: flex-end;
}
</style>
```

### 表单操作

```vue
<template>
  <div class="form-actions">
    <Button
      variant="ghost"
      @click="handleCancel"
    >
      取消
    </Button>
    <Button
      variant="danger"
      @click="handleDelete"
    >
      删除
    </Button>
    <Button
      variant="primary"
      :loading="isSubmitting"
      @click="handleSubmit"
    >
      保存
    </Button>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'

const isSubmitting = ref(false)

const handleSubmit = async () => {
  isSubmitting.value = true
  try {
    // 提交逻辑
    await submitForm()
  } finally {
    isSubmitting.value = false
  }
}
</script>
```

### 块级按钮

```vue
<template>
  <Button
    variant="primary"
    block
    size="large"
  >
    完整宽度按钮
  </Button>
</template>
```

### 仅图标的工具栏按钮

```vue
<template>
  <div class="toolbar">
    <Button
      icon="iconBold"
      variant="ghost"
      size="small"
      title="加粗"
    />
    <Button
      icon="iconItalic"
      variant="ghost"
      size="small"
      title="斜体"
    />
    <Button
      icon="iconUnderline"
      variant="ghost"
      size="small"
      title="下划线"
    />
  </div>
</template>
```

## 样式定制

组件使用项目的品牌设计变量，如需自定义样式，可以通过以下方式：

### 覆盖 CSS 变量

```vue
<template>
  <Button class="custom-button">
    自定义按钮
  </Button>
</template>

<style scoped>
.custom-button {
  --button-radius: 8px;
  --button-padding: 12px 24px;
}
</style>
```

### 使用深度选择器

```vue
<template>
  <Button class="custom-button">
    自定义按钮
  </Button>
</template>

<style scoped>
.custom-button :deep(.si-button__text) {
  font-weight: 600;
}
</style>
```

## 最佳实践

1. **按钮层级**：使用 `variant` 区分操作重要性
   - 主要操作：`primary`
   - 次要操作：`secondary` 或 `ghost`
   - 危险操作：`danger`

2. **图标使用**：
   - 为操作提供视觉提示
   - 保持图标简洁清晰
   - 仅图标按钮需要提供 `title` 属性

3. **加载状态**：异步操作时使用 `loading` 状态

4. **可访问性**：
   - 提供清晰的文本标签
   - 仅图标按钮必须提供 `title` 属性

5. **尺寸选择**：
   - 表单、主要操作：`medium` 或 `large`
   - 工具栏、密集区域：`small`
