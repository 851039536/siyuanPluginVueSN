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
        <!-- 弹窗标题："编辑提示词" / "添加提示词" -->
        <h2>{{ editingPrompt ? i18n?.editPrompt : i18n?.addPrompt }}</h2>
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
            <!-- 标签文案："标题" -->
            <label for="prompt-title">{{ i18n?.titleLabel }}</label>
            <!-- 占位文案："请输入提示词标题" -->
            <input
              id="prompt-title"
              v-model="form.title"
              type="text"
              class="vp-input"
              :placeholder="i18n?.titlePlaceholder"
              required
              aria-required="true"
            />
          </div>

          <!-- 描述字段 -->
          <div class="vp-form-group">
            <!-- 标签文案："描述" -->
            <label for="prompt-description">{{ i18n?.description }}</label>
            <!-- 占位文案："请输入提示词描述" -->
            <textarea
              id="prompt-description"
              v-model="form.description"
              class="vp-textarea"
              :placeholder="i18n?.descriptionPlaceholder"
              rows="3"
            />
          </div>

          <!-- 分类字段 -->
          <div class="vp-form-group">
            <!-- 标签文案："分类" -->
            <label for="prompt-category">{{ i18n?.category }}</label>
            <select
              id="prompt-category"
              v-model="form.category"
              class="vp-select"
              required
              aria-required="true"
            >
              <option
                v-for="cat in categories"
                :key="cat.id"
                :value="cat.id"
              >
                {{ cat.name }}
              </option>
            </select>
          </div>

          <!-- 动态内容块编辑区 -->
          <div class="vp-content-editor">
            <!-- 标签文案："内容块" -->
            <label class="vp-form-label">{{ i18n?.contents }}</label>
            <div
              v-for="(block, index) in form.contents"
              :key="block.id"
              class="vp-content-editor-item"
            >
              <div class="vp-content-editor-inputs">
                <!-- 占位文案："内容标签"；无障碍标签："内容标签 N" -->
                <input
                  v-model="block.label"
                  type="text"
                  class="vp-input vp-input--label"
                  :placeholder="i18n?.contentLabelPlaceholder"
                  :aria-label="`${i18n?.contentLabel} ${index + 1}`"
                />
                <!-- 占位文案："请输入提示词内容"；无障碍标签："内容 N" -->
                <textarea
                  v-model="block.text"
                  class="vp-textarea"
                  :placeholder="i18n?.contentPlaceholder"
                  rows="5"
                  required
                  :aria-label="`${i18n?.content} ${index + 1}`"
                />
              </div>
              <div class="vp-content-editor-actions">
                <!-- 按钮提示："上移" -->
                <Button
                  variant="ghost"
                  icon="up"
                  size="xsmall"
                  :title="i18n?.moveUp"
                  :disabled="index === 0"
                  @click="moveContentBlock(index, -1)"
                />
                <!-- 按钮提示："下移" -->
                <Button
                  variant="ghost"
                  icon="down"
                  size="xsmall"
                  :title="i18n?.moveDown"
                  :disabled="index === form.contents.length - 1"
                  @click="moveContentBlock(index, 1)"
                />
                <!-- 按钮提示："删除内容块" -->
                <Button
                  variant="danger"
                  icon="delete"
                  size="xsmall"
                  :title="i18n?.removeContent"
                  :disabled="form.contents.length <= 1"
                  @click="removeContentBlock(index)"
                />
              </div>
            </div>
            <!-- 按钮文案："添加内容块" -->
            <Button
              variant="secondary"
              icon="add"
              class="vp-content-editor-add"
              @click="addContentBlock"
            >
              {{ i18n?.addContentBlock }}
            </Button>
          </div>

          <div class="vp-form-actions">
            <!-- 按钮文案："取消" -->
            <Button
              type="button"
              variant="secondary"
              @click="$emit('close')"
            >
              {{ i18n?.cancel }}
            </Button>
            <!-- 按钮文案："保存" -->
            <Button
              type="submit"
              variant="primary"
            >
              {{ i18n?.save }}
            </Button>
          </div>
        </form>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  Prompt,
  PromptContent,
} from "../types"
import type { CategoryManager } from "../composables/useCategoryManager"
import type { PromptsManager } from "../composables/usePrompts"

import { showMessage } from "siyuan"
import {
  computed,
  reactive,
  watch,
} from "vue"
import Button from "@/components/Button.vue"

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

// manager 内的 Ref 经 props 传入不会自动解包，统一以 computed 暴露
const editingPrompt = computed(() =>
  props.editingId
    ? props.promptManager.prompts.value.find((p) => p.id === props.editingId) ?? null
    : null,
)
const categories = computed(() => props.categoryManager.categories.value)

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
    form.category = categories.value[0]?.id || "default"
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
    id: `c${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
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
    showMessage((props.i18n || {}).titleRequired!, 2000, "error")
    return
  }
  const validContents = form.contents.filter((c) => c.text.trim())
  if (validContents.length === 0) {
    showMessage((props.i18n || {}).contentRequired!, 2000, "error")
    return
  }

  const prompt: Prompt = {
    id: editingPrompt.value?.id || Date.now().toString(),
    title: form.title.trim(),
    description: form.description.trim(),
    contents: form.contents
      .filter((c) => c.text.trim())
      .map((c) => ({
        id: c.id,
        label: c.label.trim() || (props.i18n || {}).contentBlockLabel!,
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
  } catch {
    showMessage((props.i18n || {}).saveFailed!, 2000, "error")
    return
  }
  emit("close")
}
</script>

<style lang="scss" scoped>
@use '../styles/PromptFormModal.scss';
@use '../styles/index.scss';
</style>
