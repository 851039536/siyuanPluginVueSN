<!-- 项目分类管理弹窗 -->
<template>
  <div
    class="gp-mask"
    @click.self="$emit('close')"
  >
    <div
      class="gp-dialog"
      style="width: 340px;"
    >
      <div class="gp-dialog-header">
        <span class="gp-dialog-title">{{ i18n.manageCategories || '管理分类' }}</span>
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
            v-if="cat.id !== '__ungrouped__'"
            class="vp-btn vp-btn--ghost vp-btn--sm gp-btn-danger"
            @click="$emit('delete-category', cat.id)"
          >
            <Icon
              icon="mdi:delete-outline"
              height="12"
            />
          </button>
        </div>
        <div class="gp-cat-add-row">
          <input
            v-model="newCatName"
            class="gp-input"
            :placeholder="i18n.catNamePlaceholder || '分类名称'"
            style="flex:1"
            @keyup.enter="addCategory"
          />
          <input
            v-model="newCatColor"
            type="color"
            class="gp-color-input"
            title="颜色"
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

defineProps<{
  i18n: Record<string, any>
  categories: { id: string, name: string, color: string }[]
}>()

const emit = defineEmits<{
  "close": []
  "add-category": [name: string, color: string]
  "delete-category": [id: string]
}>()

const newCatName = ref("")
const newCatColor = ref("#3b82f6")

function addCategory() {
  const n = newCatName.value.trim()
  if (!n) return
  emit("add-category", n, newCatColor.value)
  newCatName.value = ""
  newCatColor.value = "#3b82f6"
}
</script>
