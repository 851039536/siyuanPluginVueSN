<template>
  <div class="qn-insp-form">
    <!-- 新增表单 -->
    <div class="qn-insp-form__add">
      <textarea
        v-model="content"
        class="qn-insp-form__textarea"
        rows="2"
        :placeholder="i18n.inspPlaceholder"
        @keydown.ctrl.enter.prevent="handleAdd"
      />
      <div class="qn-insp-form__row">
        <!-- 标签输入 -->
        <input
          v-model="tags"
          class="vp-input qn-insp-form__tag-input"
          :placeholder="i18n.tagsPlaceholder"
        />
        <!-- AI 润色按钮 -->
        <button
          class="qn-insp-form__icon-btn"
          :disabled="!content.trim() || polishing"
          :title="i18n.polish"
          @click="handlePolish"
        >
          <IconWrapper
            name="sparkles"
            :size="12"
          />
        </button>
        <!-- 添加按钮 -->
        <button
          class="qn-insp-form__add-btn"
          :disabled="!content.trim()"
          :title="i18n.add"
          @click="handleAdd"
        >
          <IconWrapper
            name="plus"
            :size="12"
          />
        </button>
      </div>
    </div>

    <!-- 标签筛选栏 -->
    <div
      v-if="allTags.length > 0"
      class="qn-insp-form__filter"
    >
      <!-- 全部标签按钮 -->
      <button
        class="qn-insp-form__filter-tag"
        :class="{ 'qn-insp-form__filter-tag--active': activeTag === null }"
        @click="emit('selectTag', null)"
      >{{ i18n.allTags }}</button>
      <!-- 各标签按钮 -->
      <button
        v-for="tag in allTags"
        :key="tag"
        class="qn-insp-form__filter-tag"
        :class="{ 'qn-insp-form__filter-tag--active': activeTag === tag }"
        @click="emit('selectTag', tag)"
      >#{{ tag }}</button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 速记功能 — 灵感新增表单 + 标签筛选栏
 * 自包含表单状态：内容草稿、标签输入；AI 润色函数由父层注入（polish prop）；
 * 标签筛选栏内联于此（全部/各标签），选中状态由父层 activeTag 注入
 */
import type { PolishFn } from "../../composables/useAiPolish"
import { ref } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { polishText } from "../../utils"

const props = defineProps<{
  /** 全量标签（供筛选栏渲染） */
  allTags: string[]
  /** 当前选中标签（null = 全部） */
  activeTag: string | null
  i18n: Record<string, string>
  /** AI 润色进行中（父层唯一实例的并发锁状态，供按钮 disabled） */
  polishing: boolean
  /** AI 润色函数（父层唯一实例注入） */
  polish: PolishFn
}>()

const emit = defineEmits<{
  add: [content: string, tags: string]
  selectTag: [tag: string | null]
}>()

const content = ref("")
const tags = ref("")

// AI 润色：调用父层注入的 polish，润色结果流式回填内容草稿（由用户确认后添加）
const { polish } = props

const handleAdd = () => {
  if (!content.value.trim()) return
  emit("add", content.value, tags.value)
  content.value = ""
  tags.value = ""
}

// AI 润色草稿：缓存原稿 → 清空后流式回填 → 失败恢复原稿并提示（复用共享辅助函数）
const handlePolish = async () => {
  if (props.polishing) return
  if (!content.value.trim()) return
  await polishText(polish, content, content.value, props.i18n)
}
</script>

<style scoped lang="scss">
@use "../../styles/InspirationForm.scss";
@use "../../styles/index.scss";
</style>
