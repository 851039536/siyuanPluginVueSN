# Select Component

通用下拉选择组件，遵循项目品牌设计规范，支持单选、分组、筛选等功能。

## 特性

- 🎨 **品牌设计规范**：使用 Anthropic 官方品牌色
- 📐 **多种尺寸**：small、medium、large
- 🎯 **键盘导航**：支持方向键、Enter、Esc 等键盘操作
- 🔍 **可筛选**：支持输入关键词筛选选项
- 📦 **分组选项**：支持选项分组显示
- 🎭 **灵活定制**：支持自定义选项插槽
- ♿ **可访问性**：完整的键盘导航和焦点管理

## 基础用法

### 导入组件

```vue
<script setup lang="ts">
import type { SelectOption } from '@/components/Select.vue'
import Select from '@/components/Select.vue'

const options: SelectOption[] = [
  {
    value: 'apple',
    label: '苹果',
  },
  {
    value: 'banana',
    label: '香蕉',
  },
  {
    value: 'orange',
    label: '橙子',
  },
]
</script>
```

### 基础选择

```vue
<template>
  <Select
    v-model="selectedValue"
    :options="options"
    placeholder="请选择水果"
  />
</template>
```

### 带标签

```vue
<template>
  <Select
    v-model="selectedValue"
    :options="options"
    label="选择水果"
    placeholder="请选择"
  />
</template>
```

### 禁用状态

```vue
<template>
  <Select
    v-model="selectedValue"
    :options="options"
    disabled
  />
</template>
```

## Props

| 属性 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `options` | `OptionType[]` | `[]` | 选项数据（支持分组） |
| `modelValue` | `string \| number \| boolean \| null` | - | 绑定值（v-model） |
| `placeholder` | `string` | `'请选择'` | 占位文本 |
| `disabled` | `boolean` | `false` | 禁用状态 |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | 尺寸 |
| `label` | `string` | - | 标签文本 |
| `required` | `boolean` | `false` | 是否必填（显示星号） |
| `hint` | `string` | - | 提示文本 |
| `filterable` | `boolean` | `false` | 是否可筛选 |
| `filterPlaceholder` | `string` | `'搜索...'` | 筛选占位文本 |
| `emptyText` | `string` | `'暂无数据'` | 空状态文本 |
| `placement` | `'top' \| 'bottom' \| 'auto'` | `'auto'` | 下拉框位置 |
| `maxHeight` | `string \| number` | `200` | 下拉框最大高度 |
| `iconSize` | `number` | `14` | 图标大小 |
| `clearable` | `boolean` | `false` | 是否可清除 |

## Events

| 事件名 | 参数 | 说明 |
|--------|------|------|
| `update:modelValue` | `value: string \| number \| boolean \| null` | 值变化时触发 |
| `change` | `value, option` | 选择变化时触发 |
| `visible-change` | `visible: boolean` | 下拉框显示/隐藏时触发 |

## Slots

| 插槽名 | 参数 | 说明 |
|--------|------|------|
| `option` | `{ option: SelectOption }` | 自定义选项内容 |

## 高级用法

### 可筛选选择器

```vue
<template>
  <Select
    v-model="selectedValue"
    :options="options"
    :filterable="true"
    filter-placeholder="搜索水果..."
  />
</template>
```

### 分组选项

```vue
<template>
  <Select
    v-model="selectedValue"
    :options="groupedOptions"
  />
</template>

<script setup lang="ts">
import type {
  SelectGroupOption,
  SelectOption,
} from '@/components/Select.vue'

const groupedOptions = [
  {
    isGroup: true,
    label: '热带水果',
    options: [
      {
        value: 'banana',
        label: '香蕉',
      },
      {
        value: 'mango',
        label: '芒果',
      },
    ],
  },
  {
    isGroup: true,
    label: '温带水果',
    options: [
      {
        value: 'apple',
        label: '苹果',
      },
      {
        value: 'orange',
        label: '橙子',
      },
    ],
  },
]
</script>
```

### 禁用选项

```vue
<template>
  <Select
    v-model="selectedValue"
    :options="options"
  />
</template>

<script setup lang="ts">
const options = [
  {
    value: 'apple',
    label: '苹果',
  },
  {
    value: 'banana',
    label: '香蕉',
    disabled: true,
  },
  {
    value: 'orange',
    label: '橙子',
  },
]
</script>
```

### 自定义选项渲染

```vue
<template>
  <Select
    v-model="selectedValue"
    :options="options"
  >
    <template #option="{ option }">
      <div style="display: flex; align-items: center; gap: 8px;">
        <span>{{ option.icon }}</span>
        <span>{{ option.label }}</span>
        <span style="color: #999; font-size: 12px;">({{ option.count }})</span>
      </div>
    </template>
  </Select>
</template>
```

### 监听变化

```vue
<template>
  <Select
    v-model="selectedValue"
    :options="options"
    @change="handleChange"
  />
</template>

<script setup lang="ts">
const handleChange = (value: string, option: SelectOption) => {
  console.log('选择了:', value, option)
}
</script>
```

### 带提示信息

```vue
<template>
  <Select
    v-model="selectedValue"
    :options="options"
    label="选择水果"
    hint="请选择您最喜欢的水果"
  />
</template>
```

### 必填字段

```vue
<template>
  <Select
    v-model="selectedValue"
    :options="options"
    label="选择水果"
    :required="true"
  />
</template>
```

## 尺寸示例

```vue
<template>
  <Select
    v-model="value1"
    size="small"
    :options="options"
  />
  <Select
    v-model="value2"
    size="medium"
    :options="options"
  />
  <Select
    v-model="value3"
    size="large"
    :options="options"
  />
</template>
```

## 键盘操作

| 按键 | 功能 |
|------|------|
| `Enter` / `Space` | 打开/关闭下拉框，选择当前高亮选项 |
| `Esc` | 关闭下拉框 |
| `ArrowDown` | 下移高亮选项 |
| `ArrowUp` | 上移高亮选项 |
| `Tab` | 关闭下拉框并移出焦点 |

## 类型定义

```typescript
/** 选项类型 */
interface SelectOption {
  /** 选项值 */
  value: string | number | boolean
  /** 显示标签 */
  label: string
  /** 是否禁用 */
  disabled?: boolean
  /** 自定义数据 */
  [key: string]: any
}

/** 分组选项类型 */
interface SelectGroupOption {
  /** 分组标识 */
  isGroup: true
  /** 分组标签 */
  label: string
  /** 分组选项 */
  options: SelectOption[]
}

/** 选项数据类型 */
type OptionType = SelectOption | SelectGroupOption
```

## 最佳实践

1. **数据绑定**：始终使用 `v-model` 进行双向绑定
2. **唯一值**：确保每个选项的 `value` 是唯一的
3. **标签使用**：为表单字段提供清晰的 `label`
4. **必填标识**：必填字段使用 `required` 显示星号
5. **帮助文本**：使用 `hint` 提供额外的上下文信息
6. **可筛选数据**：当选项超过 10 个时，建议启用 `filterable`
7. **分组使用**：当选项有明确分类时，使用分组提高可读性

## 完整示例

```vue
<template>
  <div style="display: flex; flex-direction: column; gap: 16px;">
    <!-- 基础用法 -->
    <Select
      v-model="selectedFruit"
      :options="fruits"
      label="选择水果"
      placeholder="请选择水果"
    />

    <!-- 可筛选分组 -->
    <Select
      v-model="selectedCategory"
      :options="categories"
      :filterable="true"
      label="选择分类"
      placeholder="请选择分类"
      @change="handleCategoryChange"
    >
      <template #option="{ option }">
        <div style="display: flex; align-items: center; gap: 8px;">
          <span>{{ option.label }}</span>
          <span style="color: #999; font-size: 12px;">({{ option.count }})</span>
        </div>
      </template>
    </Select>
  </div>
</template>

<script setup lang="ts">
import type { SelectOption } from '@/components/Select.vue'
import { ref } from 'vue'
import Select from '@/components/Select.vue'

const selectedFruit = ref<string>('')
const selectedCategory = ref<string>('')

const fruits: SelectOption[] = [
  {
    value: 'apple',
    label: '苹果',
  },
  {
    value: 'banana',
    label: '香蕉',
    disabled: true,
  },
  {
    value: 'orange',
    label: '橙子',
  },
  {
    value: 'grape',
    label: '葡萄',
  },
]

const categories = [
  {
    isGroup: true,
    label: '水果类',
    options: [
      {
        value: 'apple',
        label: '苹果',
        count: 10,
      },
      {
        value: 'banana',
        label: '香蕉',
        count: 15,
      },
    ],
  },
  {
    isGroup: true,
    label: '蔬菜类',
    options: [
      {
        value: 'carrot',
        label: '胡萝卜',
        count: 8,
      },
      {
        value: 'tomato',
        label: '西红柿',
        count: 12,
      },
    ],
  },
]

const handleCategoryChange = (value: string, option: SelectOption) => {
  console.log('选择了分类:', value, option)
}
</script>
```
