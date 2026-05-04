# Slider 组件

滑块输入组件，支持数值范围选择。

## 基础用法

```vue
<template>
  <Slider
    v-model="value"
    :min="0"
    :max="100"
  />
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Slider from '@/components/Slider.vue'

const value = ref(50)
</script>
```

## 显示当前值

使用 `showValue` 属性显示当前选中的值。

```vue
<Slider v-model="value" :showValue="true" />
```

## 显示最小最大值

使用 `showMinMax` 属性显示范围标签。

```vue
<Slider v-model="value" :showMinMax="true" />
```

## 值格式化

使用 `formatValue` 函数自定义值的显示格式。

```vue
<Slider
  v-model="temperature"
  :formatValue="v => v.toFixed(1)"
/>
```

## Props

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| `modelValue` | `number \| null` | `null` | 绑定值 |
| `size` | `'small' \| 'medium' \| 'large'` | `'medium'` | 尺寸 |
| `min` | `number` | `0` | 最小值 |
| `max` | `number` | `100` | 最大值 |
| `step` | `number` | `1` | 步长 |
| `disabled` | `boolean` | `false` | 禁用状态 |
| `readonly` | `boolean` | `false` | 只读状态 |
| `label` | `string` | - | 标签文本 |
| `required` | `boolean` | `false` | 是否必填 |
| `hint` | `string` | - | 提示文本 |
| `error` | `string` | - | 错误文本 |
| `showValue` | `boolean` | `false` | 是否显示当前值 |
| `showMinMax` | `boolean` | `false` | 是否显示最小最大值标签 |
| `formatValue` | `(value: number) => string` | - | 值显示格式化函数 |
| `name` | `string` | - | 原生 name 属性 |

## Emits

| 事件 | 参数 | 描述 |
|------|------|------|
| `update:modelValue` | `value: number \| null` | 值变化时触发 |
| `input` | `value: number, event: Event` | 输入时触发 |
| `change` | `value: number, event: Event` | 值改变时触发 |
| `focus` | `event: FocusEvent` | 获得焦点时触发 |
| `blur` | `event: FocusEvent` | 失去焦点时触发 |

## 尺寸变体

```vue
<Slider size="small" v-model="value" />

<Slider size="medium" v-model="value" />

<Slider size="large" v-model="value" />
```

## 禁用状态

```vue
<Slider v-model="value" :disabled="true" />
```

## 错误状态

```vue
<Slider v-model="value" error="值超出范围" />
```

## 完整示例

```vue
<template>
  <div class="example">
    <Slider
      v-model="temperature"
      label="创造性"
      :min="0"
      :max="2"
      :step="0.1"
      :showValue="true"
      :showMinMax="true"
      :formatValue="v => v.toFixed(1)"
      hint="控制AI输出的创造性程度"
    />
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import Slider from '@/components/Slider.vue'

const temperature = ref(0.7)
</script>
```
