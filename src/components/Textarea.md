# Textarea 组件

通用多行文本输入组件，支持自动高度、字符计数、清空等功能。

## 基础用法

```vue
<script setup lang="ts">
import { ref } from 'vue'
import Textarea from '@/components/Textarea.vue'

const content = ref('')
</script>

<template>
  <Textarea v-model="content" placeholder="请输入内容..." />
</template>
```

## 带标签

```vue
<template>
  <Textarea
    v-model="content"
    label="个人简介"
    placeholder="请介绍一下自己..."
  />
</template>
```

## 尺寸

支持 `small`、`medium`、`large` 三种尺寸。

```vue
<template>
  <Textarea v-model="content" size="small" placeholder="小尺寸" />
  <Textarea v-model="content" size="medium" placeholder="默认尺寸" />
  <Textarea v-model="content" size="large" placeholder="大尺寸" />
</template>
```

## 自动高度

通过 `autosize` 属性开启自动高度，可配合 `minRows` 和 `maxRows` 设置最小/最大行数。

```vue
<template>
  <Textarea
    v-model="content"
    :autosize="true"
    :min-rows="2"
    :max-rows="6"
    placeholder="内容会自动增长..."
  />
</template>
```

## 字符计数

通过 `showCount` 显示字符计数，配合 `maxlength` 显示最大长度限制。

```vue
<template>
  <!-- 显示最大长度限制 -->
  <Textarea
    v-model="content"
    :maxlength="200"
    :show-count="true"
    placeholder="最多200字"
  />

  <!-- 无最大长度时也显示计数 -->
  <Textarea
    v-model="content"
    :show-count="true"
    :show-count-without-max="true"
    placeholder="显示当前字数"
  />
</template>
```

## 可清空

```vue
<template>
  <Textarea
    v-model="content"
    :clearable="true"
    placeholder="输入内容后可清空"
  />
</template>
```

## 禁用和只读

```vue
<template>
  <Textarea v-model="content" disabled placeholder="禁用状态" />
  <Textarea v-model="content" readonly placeholder="只读状态" />
</template>
```

## 错误状态

```vue
<template>
  <Textarea
    v-model="content"
    error="内容不能为空"
    placeholder="显示错误提示"
  />
</template>
```

## 调整大小

```vue
<template>
  <!-- 禁止调整大小 -->
  <Textarea v-model="content" resize="none" />

  <!-- 水平调整 -->
  <Textarea v-model="content" resize="horizontal" />

  <!-- 垂直调整（默认） -->
  <Textarea v-model="content" resize="vertical" />

  <!-- 自定义调整手柄 -->
  <Textarea
    v-model="content"
    :show-resize-handle="true"
    resize="none"
  />
</template>
```

## 方法

通过 ref 可以调用组件方法：

```vue
<script setup lang="ts">
import { ref } from 'vue'
import Textarea from '@/components/Textarea.vue'

const textareaRef = ref()
const content = ref('')

const focusTextarea = () => {
  textareaRef.value?.focus()
}

const selectAll = () => {
  textareaRef.value?.select()
}
</script>

<template>
  <Textarea ref="textareaRef" v-model="content" />
  <button @click="focusTextarea">聚焦</button>
  <button @click="selectAll">全选</button>
</template>
```

### 可用方法

| 方法名 | 说明 | 参数 |
|--------|------|------|
| focus | 使输入框获得焦点 | - |
| blur | 使输入框失去焦点 | - |
| select | 选中输入框中的所有文本 | - |
| setRangeText | 替换指定范围的文本 | (replacement: string, start: number, end: number, selectMode?: SelectionMode) |
| adjustHeight | 手动调整高度（autosize 模式） | - |

## Props

| 属性名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| modelValue | `string \| null` | - | 绑定值 |
| size | `'small' \| 'medium' \| 'large'` | `'medium'` | 尺寸 |
| placeholder | `string` | `''` | 占位文本 |
| disabled | `boolean` | `false` | 禁用状态 |
| readonly | `boolean` | `false` | 只读状态 |
| label | `string` | - | 标签文本 |
| required | `boolean` | `false` | 是否必填 |
| hint | `string` | - | 提示文本 |
| error | `string` | - | 错误文本 |
| maxlength | `number` | - | 最大长度 |
| minlength | `number` | - | 最小长度 |
| rows | `number` | `3` | 默认行数 |
| cols | `number` | - | 列数 |
| minRows | `number` | `1` | 最小行数（自动高度） |
| maxRows | `number` | `10` | 最大行数（自动高度） |
| autosize | `boolean` | `false` | 是否自动高度 |
| resize | `'none' \| 'both' \| 'horizontal' \| 'vertical'` | `'vertical'` | 是否可调整大小 |
| showCount | `boolean` | `false` | 是否显示字符计数 |
| showCountWithoutMax | `boolean` | `false` | 无最大长度时是否显示计数 |
| clearable | `boolean` | `false` | 是否可清空 |
| showClear | `boolean` | `false` | 是否显示清除按钮 |
| showResizeHandle | `boolean` | `false` | 是否显示调整手柄 |
| iconSize | `number` | `16` | 图标大小 |
| autofocus | `boolean` | `false` | 是否自动获得焦点 |
| autocomplete | `string` | `'off'` | 自动完成 |
| wrap | `'hard' \| 'soft' \| 'off'` | `'soft'` | 换行方式 |
| spellcheck | `boolean` | `true` | 拼写检查 |
| inputmode | `string` | `'text'` | 输入模式 |
| name | `string` | - | 原生 name 属性 |
| form | `string` | - | 原生 form 属性 |

## Events

| 事件名 | 说明 | 参数 |
|--------|------|------|
| update:modelValue | 值变化时触发 | `(value: string \| null)` |
| input | 输入时触发 | `(value: string, event: Event)` |
| change | 内容变化后失去焦点时触发 | `(value: string, event: Event)` |
| focus | 获得焦点时触发 | `(event: FocusEvent)` |
| blur | 失去焦点时触发 | `(event: Event)` |
| clear | 清空时触发 | - |
| keydown | 按键按下时触发 | `(event: KeyboardEvent)` |

## Expose

| 暴露名 | 类型 | 说明 |
|--------|------|------|
| focus | `() => void` | 聚焦方法 |
| blur | `() => void` | 失焦方法 |
| select | `() => void` | 全选方法 |
| setRangeText | `(replacement: string, start: number, end: number, selectMode?: SelectionMode) => void` | 替换文本方法 |
| textareaElement | `Ref<HTMLTextAreaElement \| undefined>` | textarea 元素引用 |
| adjustHeight | `() => void` | 手动调整高度 |
