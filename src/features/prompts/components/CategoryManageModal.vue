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
        <h2>{{ t.manageCategories }}</h2>
        <Button
          variant="ghost"
          icon="close"
          size="xsmall"
          :title="t.close"
          @click="$emit('close')"
        />
      </div>

      <div class="vp-modal-body">
        <!-- 新建分类表单 -->
        <div class="vp-category-form">
          <div class="vp-form-row">
            <input
              v-model="form.name"
              type="text"
              class="vp-input"
              :placeholder="t.categoryName"
              :aria-label="t.categoryName"
              @keyup.enter="handleAdd"
            />
            <ColorField
              class="vp-category-color-field"
              :model-value="form.color"
              :placeholder="t.categoryColor"
              @update:model-value="form.color = $event"
            />
            <Button
              variant="success"
              icon="add"
              @click="handleAdd"
            >
              {{ t.add }}
            </Button>
          </div>
        </div>

        <!-- 分类列表：仅用户自定义分类（内置 default/all 由 manager 分离，不可删） -->
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
            <Button
              variant="danger"
              icon="delete"
              size="xsmall"
              @click="handleDelete(cat.id)"
            >
              {{ t.delete }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  CategoryManager,
  PromptsManager,
  PromptCategory,
} from "../types"
import { showMessage } from "siyuan"
import {
  computed,
  reactive,
} from "vue"
import Button from "@/components/Button.vue"
import ColorField from "@/components/ColorField.vue"
import {
  DEFAULT_CATEGORY_COLOR,
  PROMPTS_ALL_CATEGORY_ID,
  PROMPTS_DEFAULT_CATEGORY_ID,
} from "../types"
import {
  genId,
  MSG_DURATION,
  resolvePromptsI18n,
} from "../utils"

const props = defineProps<{
  show: boolean
  categoryManager: CategoryManager
  promptManager: PromptsManager
  i18n?: Record<string, string>
}>()

const emit = defineEmits<{
  (e: "close"): void
}>()

const t = computed(() => resolvePromptsI18n(props.i18n))

// manager 内的 Ref 经 props 传入不会自动解包，以 computed 暴露
const categories = computed(() => props.categoryManager.categories.value)

const form = reactive({
  name: "",
  color: DEFAULT_CATEGORY_COLOR,
})

/** 内置分类 id（禁止删除，双重保险：manager 层已拒绝，UI 层再拦截） */
const BUILTIN_IDS = new Set([PROMPTS_DEFAULT_CATEGORY_ID, PROMPTS_ALL_CATEGORY_ID])

async function handleAdd(): Promise<void> {
  if (!form.name.trim()) return
  const newCategory: PromptCategory = {
    // P2-8：统一 ID 生成
    id: genId("cat"),
    name: form.name.trim(),
    color: form.color,
  }
  try {
    await props.categoryManager.add(newCategory)
  } catch {
    // manager 已回滚内存态，提示后保留表单内容供重试
    showMessage(t.value.saveFailed, MSG_DURATION.SHORT, "error")
    return
  }
  form.name = ""
  form.color = DEFAULT_CATEGORY_COLOR
}

/** 删除分类：内置分类与有提示词占用的分类均拒绝删除 */
async function handleDelete(id: string): Promise<void> {
  if (BUILTIN_IDS.has(id)) return
  const hasPrompts = props.promptManager.prompts.value.some((p) => p.category === id)
  if (hasPrompts) {
    showMessage(t.value.categoryNotEmpty, MSG_DURATION.SHORT, "error")
    return
  }
  try {
    await props.categoryManager.remove(id)
  } catch {
    showMessage(t.value.saveFailed, MSG_DURATION.SHORT, "error")
  }
}
</script>

<style lang="scss" scoped>
@use '../styles/CategoryManageModal.scss';
@use '../styles/index.scss';
</style>
