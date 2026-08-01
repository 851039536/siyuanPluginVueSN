<!-- 项目分类管理弹窗 -->
<template>
  <div
    ref="rootRef"
    tabindex="-1"
    class="gp-mask"
    @keydown.escape="$emit('close')"
    @click.self="$emit('close')"
  >
    <div
      class="gp-dialog"
      style="width: 540px;"
    >
      <div class="gp-dialog-header">
        <!-- 弹窗标题：“管理分类” -->
        <span class="gp-dialog-title">{{ i18n.manageCategories }}</span>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          @click="$emit('close')"
        >
          <Icon icon="mdi:close" height="12" />
        </button>
      </div>
      <div class="gp-dialog-body">
        <div
          v-for="cat in categories"
          :key="cat.id"
          class="gp-cat-row"
        >
          <span
            class="gp-cat-dot-sm"
            :style="{ background: cat.color }"
          />
          <span class="gp-cat-name-sm">{{ cat.name }}</span>
          <button
            v-if="cat.id !== UNGROUPED_ID"
            class="vp-btn vp-btn--ghost vp-btn--sm gp-btn-danger"
            @click="$emit('deleteCategory', cat.id)"
          >
            <Icon
              icon="mdi:delete-outline"
              height="12"
            />
          </button>
        </div>
        <div class="gp-cat-add-row">
          <!-- 新分类名称输入：占位符“分类名称” -->
          <Input
            v-model="newCatName"
            size="xsmall"
            :placeholder="i18n.catNamePlaceholder"
            style="flex:1"
            @keydown.enter="addCategory()"
          />
          <!-- 分类颜色拾取器：提示“颜色” -->
          <input
            v-model="newCatColor"
            type="color"
            class="gp-color-input"
            :title="i18n.catColorTitle"
          />
          <button
            class="vp-btn vp-btn--primary vp-btn--sm"
            :disabled="!newCatName.trim()"
            @click="addCategory"
          >
            <Icon
              icon="mdi:plus"
              height="12"
            />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import { ref } from "vue"
import Input from "@/components/Input.vue"
import type { ProjectCategory } from "../../types"
import { UNGROUPED_ID } from "../../types"
import { useDialogKeyboard } from "../../composables/useDialogKeyboard"

defineProps<{
  i18n: Record<string, any>
  categories: ProjectCategory[]
}>()

const emit = defineEmits<{
  "close": []
  "addCategory": [name: string, color: string]
  "deleteCategory": [id: string]
}>()

const { rootRef } = useDialogKeyboard()

/** 新分类默认颜色 */
const DEFAULT_CAT_COLOR = "#3b82f6"

const newCatName = ref("")
const newCatColor = ref(DEFAULT_CAT_COLOR)

function addCategory() {
  const n = newCatName.value.trim()
  if (!n) return
  emit("addCategory", n, newCatColor.value)
  newCatName.value = ""
  newCatColor.value = DEFAULT_CAT_COLOR
}
</script>
