<!--
  提示词库 — 添加/编辑表单弹窗，支持动态内容块管理
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
          <div class="vp-form-group">
              <label for="prompt-title">{{ i18n?.titleLabel }}</label>
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

          <div class="vp-form-group">
              <label for="prompt-description">{{ i18n?.description }}</label>
              <textarea
                id="prompt-description"
                v-model="form.description"
                class="vp-textarea"
                :placeholder="i18n?.descriptionPlaceholder"
              rows="3"
            />
          </div>

          <div class="vp-form-group">
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
            <label class="vp-form-label">{{ i18n?.contents }}</label>
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
                  :placeholder="i18n?.contentLabelPlaceholder"
                  :aria-label="`${i18n?.contentLabel} ${index + 1}`"
                />
                <textarea
                  v-model="block.text"
                  class="vp-textarea"
                  :placeholder="i18n?.contentPlaceholder"
                  rows="5"
                  required
                  :aria-label="`${i18n?.content || '内容'} ${index + 1}`"
                />
              </div>
              <div class="vp-content-editor-actions">
                <Button
                  variant="ghost"
                  icon="up"
                  size="xsmall"
                  :title="i18n?.moveUp"
                  :disabled="index === 0"
                  @click="moveContentBlock(index, -1)"
                />
                <Button
                  variant="ghost"
                  icon="down"
                  size="xsmall"
                  :title="i18n?.moveDown"
                  :disabled="index === form.contents.length - 1"
                  @click="moveContentBlock(index, 1)"
                />
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
            <Button
              type="button"
              variant="secondary"
              @click="$emit('close')"
            >
              {{ i18n?.cancel }}
            </Button>
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
  PromptCategory,
  PromptContent,
} from "../types"

import { showMessage } from "siyuan"
import { reactive, watch } from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"

const props = defineProps<{
  show: boolean
  editingPrompt: Prompt | null
  categories: PromptCategory[]
  i18n?: Record<string, string>
}>()

const emit = defineEmits<{
  (e: "close"): void
  (e: "save", prompt: Prompt): void
}>()

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

function initForm() {
  if (props.editingPrompt) {
    const p = props.editingPrompt
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
    form.category = props.categories[0]?.id || "default"
  }
}
watch(
  () => props.show,
  (v) => {
    if (v) initForm()
  },
)

function createEmptyContentBlock(label?: string): PromptContent {
  return {
    id: `c${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    label: label || "",
    text: "",
  }
}

function addContentBlock() {
  form.contents.push(createEmptyContentBlock())
}

function removeContentBlock(index: number) {
  if (form.contents.length <= 1) return
  form.contents.splice(index, 1)
}

function moveContentBlock(index: number, direction: -1 | 1) {
  const target = index + direction
  if (target < 0 || target >= form.contents.length) return
  const tmp = form.contents[index]
  form.contents[index] = form.contents[target]
  form.contents[target] = tmp
}

function handleSave() {
  if (!form.title.trim()) {
    showMessage(props.i18n?.titleRequired, 2000, "error")
    return
  }
  const validContents = form.contents.filter((c) => c.text.trim())
  if (validContents.length === 0) {
    showMessage(props.i18n?.contentRequired, 2000, "error")
    return
  }

  const prompt: Prompt = {
    id: props.editingPrompt?.id || Date.now().toString(),
    title: form.title.trim(),
    description: form.description.trim(),
    contents: form.contents
      .filter((c) => c.text.trim())
      .map((c) => ({
        id: c.id,
        label: c.label.trim() || (props.i18n?.contentBlockLabel || "内容"),
        text: c.text.trim(),
      })),
    category: form.category,
  }

  emit("save", prompt)
}
</script>

<style lang="scss" scoped>
@use '../styles/PromptFormModal.scss';
@use '../styles/index.scss';
</style>
