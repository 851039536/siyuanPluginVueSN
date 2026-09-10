<!-- 书签名多标签输入：Tag chips（可关闭）+ 无边框内联输入，回车/逗号添加、空输入退格删末项 -->
<template>
  <div
    class="tags-input-wrapper"
    :class="{ 'is-focused': isFocused }"
  >
    <!-- 已添加书签名（可关闭） -->
    <Tag
      v-for="(name, index) in names"
      :key="name"
      size="xsmall"
      variant="primary"
      closable
      @close="$emit('remove', index)"
    >
      <span class="tag-text">{{ name }}</span>
    </Tag>
    <!-- 占位符："输入书签名，回车添加" -->
    <Input
      class="tag-input"
      borderless
      size="small"
      :model-value="draft"
      :placeholder="i18n.bookmarkNamePlaceholder"
      @update:model-value="draft = String($event ?? '')"
      @keydown="handleKeydown"
      @focus="isFocused = true"
      @blur="isFocused = false"
    />
  </div>
</template>

<script setup lang="ts">
import type { BookmarkMarkerI18n } from "../../types"
import { ref } from "vue"
import Input from "@/components/Input.vue"
import Tag from "@/components/Tag.vue"

const props = defineProps<{
  i18n: BookmarkMarkerI18n
  /** 已添加的书签名列表 */
  names: string[]
}>()

const emit = defineEmits<{
  add: [name: string]
  remove: [index: number]
}>()

/** 输入框草稿（提交后清空，避免直接改写父级数组） */
const draft = ref("")
const isFocused = ref(false)

/** 落盘当前草稿为标签；重复名仅清空输入不做新增 */
const addTag = () => {
  const value = draft.value.trim()
  if (!value) return
  draft.value = ""
  if (props.names.includes(value)) return
  emit("add", value)
}

/** 回车 / 逗号提交；输入为空时退格删除最后一个标签 */
const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === "Enter" || event.key === ",") {
    event.preventDefault()
    addTag()
    return
  }
  if (event.key === "Backspace" && draft.value === "" && props.names.length > 0) {
    emit("remove", props.names.length - 1)
  }
}
</script>

<style scoped lang="scss">
@use "../../styles/RuleItemTagInput.scss" as *;
</style>
