<!-- 过滤关键词编辑器：铅笔按钮 + 内联编辑面板（逗号分隔输入），点击外部关闭 -->
<template>
  <div
    class="doc-nav-filter-editor"
    ref="rootRef"
  >
    <!-- 编辑触发按钮 -->
    <button
      class="doc-nav-filter-editor-trigger"
      type="button"
      :title="i18n.docNavFilterKeywordsEdit"
      @click.stop="togglePanel"
    >
      <IconWrapper
        name="docNavKeywordEdit"
        size="12"
        aria-hidden="true"
      />
    </button>

    <!-- 内联编辑面板 -->
    <Transition name="doc-nav-filter-editor-fade">
      <div
        v-if="isOpen"
        class="doc-nav-filter-editor-panel"
        role="dialog"
        :aria-label="i18n.docNavFilterKeywordsEdit"
      >
        <!-- 面板标题："编辑关键词" -->
        <div class="doc-nav-filter-editor-header">{{ i18n.docNavFilterKeywordsEdit }}</div>
        <!-- 输入框："输入关键词，逗号分隔" -->
        <input
          ref="inputRef"
          v-model="inputValue"
          class="doc-nav-filter-editor-input"
          type="text"
          :placeholder="i18n.docNavFilterKeywordsPlaceholder"
          :aria-label="i18n.docNavFilterKeywordsPlaceholder"
          @keyup.enter="save"
          @keyup.escape="cancel"
        />
        <!-- 提示："逗号分隔多个关键词" -->
        <div class="doc-nav-filter-editor-hint">{{ i18n.docNavFilterKeywordsHint }}</div>
        <!-- 操作按钮行 -->
        <div class="doc-nav-filter-editor-actions">
          <button
            class="doc-nav-filter-editor-btn doc-nav-filter-editor-btn--cancel"
            type="button"
            @click="cancel"
          >
            {{ i18n.docNavFilterKeywordsCancel }}
          </button>
          <button
            class="doc-nav-filter-editor-btn doc-nav-filter-editor-btn--save"
            type="button"
            @click="save"
          >
            {{ i18n.docNavFilterKeywordsSave }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
import {
  nextTick,
  onMounted,
  onUnmounted,
  ref,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"

const props = defineProps<{
  /** 当前关键词数组，面板打开时预填 */
  filterKeywords: string[]
  /** 功能 i18n（与父组件共享，平铺在 plugin.i18n 顶层） */
  i18n: Record<string, string>
}>()

const emit = defineEmits<{
  /** 保存时提交新关键词列表 */
  (event: "saved", keywords: string[]): void
}>()

const rootRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const isOpen = ref(false)
const inputValue = ref("")

/** 打开面板时预填当前关键词（逗号分隔）并聚焦输入框 */
function togglePanel(): void {
  isOpen.value = !isOpen.value
  if (isOpen.value) {
    inputValue.value = props.filterKeywords.join("，")
    nextTick(() => {
      inputRef.value?.focus()
    })
  }
}

/** 保存：按逗号（中英文）切分、去除空串后 emit */
function save(): void {
  const keywords = inputValue.value
    .split(/[，,]/)
    .map((kw) => kw.trim())
    .filter((kw) => kw !== "")
  emit("saved", keywords)
  isOpen.value = false
}

/** 取消编辑 */
function cancel(): void {
  isOpen.value = false
}

/** 点击外部关闭面板（复用 document click handler 模式，@click.stop 已阻止触发按钮冒泡） */
function handleDocumentClick(event: MouseEvent) {
  if (rootRef.value && !rootRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener("click", handleDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener("click", handleDocumentClick)
})
</script>

<style scoped lang="scss">
@use "../styles/FilterKeywordsEditor.scss";
@use "../styles/index.scss";
</style>
