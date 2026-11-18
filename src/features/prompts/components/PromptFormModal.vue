<!--
  提示词库 — 添加/编辑表单弹窗（自包含：按 editingId 自行查数，保存直调 promptManager）
-->
<template>
  <div
    v-if="show"
    class="vp-overlay"
    @click="$emit('close')"
    @keydown.escape="$emit('close')"
  >
    <div
      class="vp-modal vp-modal--form"
      @click.stop
    >
      <div class="vp-modal-header">
        <h2>{{ editingPrompt ? t.editPrompt : t.addPrompt }}</h2>
        <Button
          variant="ghost"
          icon="close"
          size="xsmall"
          @click="$emit('close')"
        />
      </div>

      <div class="vp-modal-body">
        <form
          class="vp-form"
          @submit.prevent="handleSave"
        >
          <!-- 标题字段 -->
          <div class="vp-form-group">
            <label for="prompt-title">{{ t.titleLabel }}</label>
            <input
              id="prompt-title"
              v-model="form.title"
              type="text"
              class="vp-input"
              :placeholder="t.titlePlaceholder"
              required
              aria-required="true"
            />
          </div>

          <!-- 描述字段 -->
          <div class="vp-form-group">
            <label for="prompt-description">{{ t.description }}</label>
            <textarea
              id="prompt-description"
              v-model="form.description"
              class="vp-textarea"
              :placeholder="t.descriptionPlaceholder"
              rows="3"
            />
          </div>

          <!-- 分类字段 -->
          <div class="vp-form-group">
            <label for="prompt-category">{{ t.category }}</label>
            <Select
              id="prompt-category"
              class="vp-select-field"
              :model-value="form.category"
              :options="categoryOptions"
              size="xsmall"
              required
              :aria-label="t.category"
              @update:model-value="(v) => form.category = v === null ? '' : String(v)"
            />
          </div>

          <!-- 动态内容块编辑区 -->
          <div class="vp-content-editor">
            <label class="vp-form-label">{{ t.contents }}</label>
            <div
              v-for="(block, index) in form.contents"
              :key="block.id"
              class="vp-content-editor-item"
            >
              <div class="vp-content-editor-inputs">
                <input
                  v-model="block.label"
                  type="text"
                  class="vp-input vp-input--label"
                  :placeholder="t.contentLabelPlaceholder"
                  :aria-label="`${t.contentLabel} ${index + 1}`"
                />
                <textarea
                  v-model="block.text"
                  class="vp-textarea"
                  :placeholder="t.contentPlaceholder"
                  rows="5"
                  required
                  :aria-label="`${t.content} ${index + 1}`"
                />
              </div>
              <div class="vp-content-editor-actions">
                <Button
                  variant="ghost"
                  icon="up"
                  size="xsmall"
                  :title="t.moveUp"
                  :disabled="index === 0"
                  @click="moveContentBlock(index, -1)"
                />
                <Button
                  variant="ghost"
                  icon="down"
                  size="xsmall"
                  :title="t.moveDown"
                  :disabled="index === form.contents.length - 1"
                  @click="moveContentBlock(index, 1)"
                />
                <Button
                  variant="danger"
                  icon="delete"
                  size="xsmall"
                  :title="t.removeContent"
                  :disabled="form.contents.length <= 1"
                  @click="removeContentBlock(index)"
                />
              </div>
            </div>
            <Button
              variant="secondary"
              icon="add"
              class="vp-content-editor-add"
              @click="addContentBlock"
            >
              {{ t.addContentBlock }}
            </Button>
          </div>

          <div class="vp-form-actions">
            <Button
              type="button"
              variant="secondary"
              @click="$emit('close')"
            >
              {{ t.cancel }}
            </Button>
            <Button
              type="submit"
              variant="primary"
            >
              {{ t.save }}
            </Button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  CategoryManager,
  PromptsManager,
  Prompt,
  PromptContent,
} from "../types"
import { showMessage } from "siyuan"
import {
  computed,
  reactive,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import Select from "@/components/Select.vue"
import {
  PROMPTS_ALL_CATEGORY_ID,
  PROMPTS_DEFAULT_CATEGORY_ID,
} from "../types"
import {
  genId,
  MSG_DURATION,
  PROMPTS_LIMIT_ERROR,
  resolvePromptsI18n,
} from "../utils"

const props = defineProps<{
  show: boolean
  /** 正在编辑的提示词 id（null = 新增） */
  editingId: string | null
  promptManager: PromptsManager
  categoryManager: CategoryManager
  i18n?: Record<string, string>
}>()

const emit = defineEmits<{
  (e: "close"): void
}>()

const t = computed(() => resolvePromptsI18n(props.i18n))

// manager 内的 Ref 经 props 传入不会自动解包，统一以 computed 暴露
const editingPrompt = computed(() =>
  props.editingId
    ? props.promptManager.prompts.value.find((p) => p.id === props.editingId) ?? null
    : null,
)

/**
 * 表单可选分类 = 默认 + 用户自定义（排除筛选专用的"全部"伪分类）。
 * 使用 allCategories 保证内置 default 恒定在列，即使 categories 当前为空。
 */
const assignableCategories = computed(() =>
  props.categoryManager.allCategories.value.filter((c) => c.id !== PROMPTS_ALL_CATEGORY_ID),
)

/** 分类选项（值 = 分类 id，与 form.category 语义一致） */
const categoryOptions = computed(() =>
  assignableCategories.value.map((cat) => ({
    value: cat.id,
    label: cat.name,
  })),
)

const form = reactive<{
  title: string
  description: string
  contents: PromptContent[]
  category: string
}>({
  title: "",
  description: "",
  contents: [],
  category: "",
})

function initForm(): void {
  if (editingPrompt.value) {
    const p = editingPrompt.value
    form.title = p.title
    form.description = p.description
    form.contents =
      p.contents && p.contents.length > 0
        ? p.contents.map((c) => ({ ...c }))
        : [createEmptyContentBlock()]
    form.category = p.category
  } else {
    form.title = ""
    form.description = ""
    form.contents = [createEmptyContentBlock()]
    // P2-6：回退到恒定存在的内置默认分类 id，不再指向可能已删除的 categories[0]
    form.category = assignableCategories.value.some((c) => c.id === PROMPTS_DEFAULT_CATEGORY_ID)
      ? PROMPTS_DEFAULT_CATEGORY_ID
      : assignableCategories.value[0]?.id || PROMPTS_DEFAULT_CATEGORY_ID
  }
}
watch(
  () => props.show,
  (v) => {
    if (v) initForm()
  },
  { immediate: true },
)

function createEmptyContentBlock(): PromptContent {
  return {
    // P2-8：统一 ID 生成，替换 Date.now() 拼接
    id: genId("c"),
    label: "",
    text: "",
  }
}

function addContentBlock(): void {
  form.contents.push(createEmptyContentBlock())
}

function removeContentBlock(index: number): void {
  if (form.contents.length <= 1) return
  form.contents.splice(index, 1)
}

function moveContentBlock(index: number, direction: -1 | 1): void {
  const target = index + direction
  if (target < 0 || target >= form.contents.length) return
  const tmp = form.contents[index]
  form.contents[index] = form.contents[target]
  form.contents[target] = tmp
}

async function handleSave(): Promise<void> {
  if (!form.title.trim()) {
    showMessage(t.value.titleRequired, MSG_DURATION.SHORT, "error")
    return
  }
  // P2-7：只过滤一次，复用结果，避免校验与实际保存内容漂移
  const validContents = form.contents.filter((c) => c.text.trim())
  if (validContents.length === 0) {
    showMessage(t.value.contentRequired, MSG_DURATION.SHORT, "error")
    return
  }

  const prompt: Prompt = {
    // P2-8：统一 ID 生成
    id: editingPrompt.value?.id || genId("p"),
    title: form.title.trim(),
    description: form.description.trim(),
    contents: validContents.map((c) => ({
      id: c.id,
      label: c.label.trim() || t.value.contentBlockLabel,
      text: c.text.trim(),
    })),
    category: form.category,
  }

  // 直接持久化：失败时 manager 已回滚内存态，弹窗保持打开供修改重试
  try {
    if (editingPrompt.value) {
      await props.promptManager.update(prompt)
    } else {
      await props.promptManager.add(prompt)
    }
  } catch (error) {
    // 上限与普通写入失败区分提示，避免"静默没保存"
    const isLimit = error instanceof Error && error.message === PROMPTS_LIMIT_ERROR
    showMessage(isLimit ? t.value.limitReached : t.value.saveFailed, MSG_DURATION.SHORT, "error")
    return
  }
  emit("close")
}
</script>

<style lang="scss" scoped>
@use '../styles/PromptFormModal.scss';
@use '../styles/index.scss';
</style>
