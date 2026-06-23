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
        <h2>{{ i18n?.manageCategories || '管理分类' }}</h2>
        <Button
          variant="ghost"
          icon="close"
          size="small"
          :title="i18n?.close || '关闭'"
          @click="$emit('close')"
        />
      </div>

      <div class="vp-modal-body">
        <div class="vp-category-form">
          <div class="vp-form-row">
            <input
              v-model="form.name"
              type="text"
              class="vp-input"
              :placeholder="i18n?.categoryName || '分类名称'"
              aria-label="分类名称"
              @keyup.enter="handleAdd"
            />
            <input
              v-model="form.color"
              type="color"
              class="vp-color-input"
              aria-label="分类颜色"
            />
            <Button
              variant="success"
              icon="add"
              @click="handleAdd"
            >
              {{ i18n?.add || '添加' }}
            </Button>
          </div>
        </div>

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
              size="small"
              @click="handleDelete(cat.id)"
            >
              {{ i18n?.delete || '删除' }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PromptCategory } from "../types"
import { reactive } from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"

const props = defineProps<{
  show: boolean
  categories: PromptCategory[]
  i18n?: Record<string, string>
}>()

const emit = defineEmits<{
  (e: "close"): void
  (e: "add", category: PromptCategory): void
  (e: "delete", id: string): void
}>()

const form = reactive({
  name: "",
  color: "#d97757",
})

function handleAdd() {
  if (!form.name.trim()) return
  const newCategory: PromptCategory = {
    id: Date.now().toString(),
    name: form.name.trim(),
    color: form.color,
  }
  emit("add", newCategory)
  form.name = ""
  form.color = "#d97757"
}

function handleDelete(id: string) {
  emit("delete", id)
}
</script>

<style lang="scss" scoped>
@use '../styles/index.scss';
</style>
