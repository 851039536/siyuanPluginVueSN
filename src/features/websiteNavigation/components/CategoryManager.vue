<!--
  网站导航 — 分类管理弹窗
-->
<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visible"
        class="website-dialog-overlay"
        @click.self="handleClose"
      >
        <Transition name="scale">
          <div
            v-if="visible"
            class="website-dialog category-manager"
            @click.stop
          >
            <div class="dialog-header">
              <h3>{{ i18n.manageCategories }}</h3>
              <Button
                icon="close"
                variant="ghost"
                size="xsmall"
                @click="handleClose"
              />
            </div>
            <div class="dialog-body">
              <div class="add-category-row">
                <Input
                  v-model="catName"
                  type="text"
                  :placeholder="i18n.categoryName"
                  size="xsmall"
                />
                <div class="color-picker">
                  <button
                    v-for="color in presetColors"
                    :key="color"
                    class="color-option"
                    :class="{ selected: catColor === color }"
                    :style="{ backgroundColor: color }"
                    @click="catColor = color"
                  />
                </div>
                <Button
                  icon="add"
                  variant="primary"
                  size="xsmall"
                  :disabled="!catName.trim()"
                  @click="handleAdd"
                >
                  {{ i18n.add }}
                </Button>
              </div>
              <div class="category-list">
                <div
                  v-for="cat in categories"
                  :key="cat.id"
                  class="category-row"
                >
                  <span
                    class="cat-dot"
                    :style="{ backgroundColor: cat.color }"
                  ></span>
                  <span class="cat-name">{{ cat.name }}</span>
                  <Button
                    v-if="cat.id !== 'default'"
                    icon="delete"
                    variant="ghost"
                    size="xsmall"
                    @click="emit('remove', cat.id)"
                  />
                  <span
                    v-else
                    class="default-badge"
                  >{{ i18n.defaultBadge }}</span>
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
import type {
  I18n,
  WebsiteCategory,
} from "../types"
import { ref } from "vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"

defineProps<{
  visible: boolean
  i18n: I18n
  categories: WebsiteCategory[]
}>()

const emit = defineEmits<{
  (e: "close"): void
  (e: "add", name: string, color: string): void
  (e: "remove", id: string): void
}>()

const presetColors = [
  "#3b82f6",
  "#10b981",
  "#f59e0b",
  "#ef4444",
  "#8b5cf6",
  "#ec4899",
  "#06b6d4",
  "#84cc16",
  "#b0aea5",
] as const

const catName = ref("")
const catColor = ref("#3b82f6")

const handleAdd = () => {
  if (!catName.value.trim()) return
  emit("add", catName.value.trim(), catColor.value)
  catName.value = ""
  catColor.value = "#3b82f6"
}

const handleClose = () => {
  catName.value = ""
  catColor.value = "#3b82f6"
  emit("close")
}
</script>
