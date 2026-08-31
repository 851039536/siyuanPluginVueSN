<!--
  提示词库 — 分类管理弹窗（自包含：增删直调 categoryManager，删除前自行校验分类占用）
-->
<template>
  <div
    v-if="show"
    class="vp-overlay"
    @click="$emit('close')"
    @keydown.escape="$emit('close')"
  >
    <div
      class="vp-modal vp-modal--small"
      @click.stop
    >
      <div class="vp-modal-header">
        <!-- 弹窗标题："管理分类" -->
        <h2>{{ i18n?.manageCategories }}</h2>
        <!-- 按钮提示："关闭" -->
        <Button
          variant="ghost"
          icon="close"
          size="xsmall"
          :title="i18n?.close"
          @click="$emit('close')"
        />
      </div>

      <div class="vp-modal-body">
        <!-- 新建分类表单 -->
        <div class="vp-category-form">
          <div class="vp-form-row">
            <!-- 占位文案："分类名称" -->
            <input
              v-model="form.name"
              type="text"
              class="vp-input"
              :placeholder="i18n?.categoryName"
              :aria-label="i18n?.categoryName"
              @keyup.enter="handleAdd"
            />
            <!-- 无障碍标签："分类颜色" -->
            <input
              v-model="form.color"
              type="color"
              class="vp-color-input"
              :aria-label="i18n?.categoryColor"
            />
            <!-- 按钮文案："添加" -->
            <Button
              variant="success"
              icon="add"
              @click="handleAdd"
            >
              {{ i18n?.add }}
            </Button>
          </div>
        </div>

        <!-- 分类列表 -->
        <div
          class="vp-category-list"
          role="list"
        >
          <div
            v-for="cat in categories"
            :key="cat.id"
            class="vp-category-item"
            role="listitem"
          >
            <span
              class="vp-category-dot"
              :style="{ backgroundColor: cat.color }"
            />
            <span class="vp-category-name">{{ cat.name }}</span>
            <!-- 按钮文案："删除" -->
            <Button
              variant="danger"
              icon="delete"
              size="xsmall"
              @click="handleDelete(cat.id)"
            >
              {{ i18n?.delete }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PromptCategory } from "../types"
import type { CategoryManager } from "../composables/useCategoryManager"
import type { PromptsManager } from "../composables/usePrompts"
import { showMessage } from "siyuan"
import {
  computed,
  reactive,
} from "vue"
import Button from "@/components/Button.vue"
import { DEFAULT_CATEGORY_COLOR } from "../types"

const props = defineProps<{
  show: boolean
  categoryManager: CategoryManager
  promptManager: PromptsManager
  i18n?: Record<string, string>
}>()

const emit = defineEmits<{
  (e: "close"): void
}>()

// manager 内的 Ref 经 props 传入不会自动解包，以 computed 暴露
const categories = computed(() => props.categoryManager.categories.value)

const form = reactive({
  name: "",
  color: DEFAULT_CATEGORY_COLOR,
})

async function handleAdd(): Promise<void> {
  if (!form.name.trim()) return
  const newCategory: PromptCategory = {
    id: Date.now().toString(),
    name: form.name.trim(),
    color: form.color,
  }
  try {
    await props.categoryManager.add(newCategory)
  } catch {
    // manager 已回滚内存态，提示后保留表单内容供重试
    showMessage((props.i18n || {}).saveFailed!, 2000, "error")
    return
  }
  form.name = ""
  form.color = DEFAULT_CATEGORY_COLOR
}

/** 删除分类：有提示词占用的分类拒绝删除（manager 内存态即时可查） */
async function handleDelete(id: string): Promise<void> {
  const hasPrompts = props.promptManager.prompts.value.some((p) => p.category === id)
  if (hasPrompts) {
    showMessage((props.i18n || {}).categoryNotEmpty!, 2000, "error")
    return
  }
  await props.categoryManager.remove(id)
}
</script>

<style lang="scss" scoped>
@use '../styles/CategoryManageModal.scss';
@use '../styles/index.scss';
</style>
