<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visible"
        class="html-viewer-overlay modal-overlay"
        @click="emit('update:visible', false)"
      >
        <Transition name="scale">
          <div
            v-if="visible"
            class="html-viewer-dialog category-manager"
            @click.stop
          >
            <div class="dialog-header">
              <h2>管理分类</h2>
              <Button
                icon="close"
                variant="ghost"
                size="small"
                @click="emit('update:visible', false)"
              />
            </div>
            <div class="dialog-body">
              <div class="add-category-section">
                <h3>添加新分类</h3>
                <div class="add-category-form">
                  <Input
                    v-model="newCategory.name"
                    type="text"
                    placeholder="分类名称"
                    :maxlength="10"
                  />
                  <div class="color-picker-wrapper">
                    <button
                      v-for="color in PRESET_COLORS"
                      :key="color"
                      class="color-option"
                      :class="{ selected: newCategory.color === color }"
                      :style="{ backgroundColor: color }"
                      @click="newCategory.color = color"
                    ></button>
                  </div>
                  <Button
                    icon="add"
                    variant="primary"
                    size="small"
                    :disabled="!newCategory.name.trim()"
                    @click="handleAddCategory"
                  >
                    添加
                  </Button>
                </div>
              </div>
              <div class="category-list-section">
                <h3>现有分类</h3>
                <div class="category-list">
                  <div
                    v-for="cat in categories"
                    :key="cat.id"
                    class="category-item"
                  >
                    <span
                      class="category-dot"
                      :style="{ backgroundColor: cat.color }"
                    ></span>
                    <span class="category-name">{{ cat.name }}</span>
                    <Button
                      v-if="cat.id !== 'default'"
                      icon="close"
                      variant="ghost"
                      size="small"
                      title="删除分类"
                      @click="emit('delete-category', cat.id)"
                    />
                    <span
                      v-else
                      class="default-badge"
                    >默认</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { HtmlCategory } from "../types"
import {
  reactive,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"

const PRESET_COLORS = [
  "#d97757",
  "#6a9bcc",
  "#788c5d",
  "#b0aea5",
  "#e8a04c",
  "#9b6bb5",
]

interface Props {
  visible: boolean
  categories: HtmlCategory[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "update:visible", value: boolean): void
  (e: "add-category", payload: { name: string; color: string }): void
  (e: "delete-category", id: string): void
}>()

const newCategory = reactive({
  name: "",
  color: PRESET_COLORS[0],
})

watch(() => props.visible, (val) => {
  if (val) {
    newCategory.name = ""
    newCategory.color = PRESET_COLORS[0]
  }
})

function handleAddCategory() {
  if (!newCategory.name.trim()) return
  emit("add-category", {
    name: newCategory.name.trim(),
    color: newCategory.color,
  })
  newCategory.name = ""
  newCategory.color = PRESET_COLORS[0]
}
</script>
