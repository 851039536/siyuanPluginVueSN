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
        <h2>{{ editingPrompt ? i18n?.editPrompt || '编辑提示词' : i18n?.addPrompt || '添加提示词' }}</h2>
        <Button
          variant="ghost"
          icon="close"
          size="small"
          @click="$emit('close')"
        />
      </div>

      <div class="vp-modal-body">
        <form
          class="vp-form"
          @submit.prevent="handleSave"
        >
          <div class="vp-form-group">
            <label for="prompt-title">{{ i18n?.titleLabel || '标题' }}</label>
            <input
              id="prompt-title"
              v-model="form.title"
              type="text"
              class="vp-input"
              :placeholder="i18n?.titlePlaceholder || '请输入提示词标题'"
              required
              aria-required="true"
            />
          </div>

          <div class="vp-form-group">
            <label for="prompt-description">{{ i18n?.description || '描述' }}</label>
            <textarea
              id="prompt-description"
              v-model="form.description"
              class="vp-textarea"
              :placeholder="i18n?.descriptionPlaceholder || '请输入提示词描述'"
              rows="3"
            />
          </div>

          <div class="vp-form-group">
            <label for="prompt-category">{{ i18n?.category || '分类' }}</label>
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
            <label class="vp-form-label">{{ i18n?.contents || '内容块' }}</label>
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
                  :placeholder="i18n?.contentLabelPlaceholder || '内容标签'"
                  :aria-label="`${i18n?.contentLabel || '内容标签'} ${index + 1}`"
                />
                <textarea
                  v-model="block.text"
                  class="vp-textarea"
                  :placeholder="i18n?.contentPlaceholder || '请输入提示词内容'"
                  rows="5"
                  required
                  :aria-label="`${i18n?.content || '内容'} ${index + 1}`"
                />
              </div>
              <div class="vp-content-editor-actions">
                <Button
                  variant="ghost"
                  icon="up"
                  size="small"
                  :title="i18n?.moveUp || '上移'"
                  :disabled="index === 0"
                  @click="moveContentBlock(index, -1)"
                />
                <Button
                  variant="ghost"
                  icon="down"
                  size="small"
                  :title="i18n?.moveDown || '下移'"
                  :disabled="index === form.contents.length - 1"
                  @click="moveContentBlock(index, 1)"
                />
                <Button
                  variant="danger"
                  icon="delete"
                  size="small"
                  :title="i18n?.removeContent || '删除内容块'"
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
              {{ i18n?.addContentBlock || '添加内容块' }}
            </Button>
          </div>

          <div class="vp-form-actions">
            <Button
              type="button"
              variant="secondary"
              @click="$emit('close')"
            >
              {{ i18n?.cancel || '取消' }}
            </Button>
            <Button
              type="submit"
              variant="primary"
            >
              {{ i18n?.save || '保存' }}
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
import { reactive } from "vue"
// watch for show change to init form
import { watch } from "vue"
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

/** 每次打开弹窗时初始化表单数据 */
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
  { immediate: true },
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
  // 触发响应式更新
  form.contents = [...form.contents]
}

function handleSave() {
  if (!form.title.trim()) {
    showMessage("标题是必填项", 2000, "error")
    return
  }
  const validContents = form.contents.filter((c) => c.text.trim())
  if (validContents.length === 0) {
    showMessage("至少需要一个非空内容块", 2000, "error")
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
        label: c.label.trim() || "内容",
        text: c.text.trim(),
      })),
    category: form.category,
  }

  emit("save", prompt)
}
</script>

<style lang="scss" scoped>
@use '../styles/PromptsModal.scss';
</style>
