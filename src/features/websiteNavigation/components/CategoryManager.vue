<!--
  网站导航 — 分类管理弹窗
-->
<template>
  <Teleport to="body">
    <Transition name="website-fade">
      <div
        v-if="visible"
        class="website-dialog-overlay"
        @click.self="handleClose"
      >
        <Transition name="website-scale">
          <div
            v-if="visible"
            class="website-dialog category-manager"
            @click.stop
          >
            <div class="dialog-header">
              <!-- 管理类别 -->
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
                <!-- 类别名称 -->
                <Input
                  v-model="catName"
                  type="text"
                  :placeholder="i18n.categoryName"
                  size="small"
                />
                <div class="color-picker">
                  <button
                    v-for="color in PRESET_CATEGORY_COLORS"
                    :key="color"
                    class="color-option"
                    :class="{ selected: catColor === color }"
                    :style="{ backgroundColor: color }"
                    @click="catColor = color"
                  />
                </div>
                <!-- 添加 -->
                <Button
                  icon="add"
                  variant="primary"
                  size="xsmall"
                  :disabled="!catName.trim()"
                  :loading="saving"
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
                    v-if="cat.id !== DEFAULT_CATEGORY_ID"
                    icon="delete"
                    variant="ghost"
                    size="xsmall"
                    :loading="removingId === cat.id"
                    @click="handleRemove(cat.id)"
                  />
                  <!-- 默认分类标记 -->
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
import type { I18n } from "../types"
import { ref } from "vue"
import { showMessage } from "siyuan"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import {
  DEFAULT_CATEGORY_ID,
  PRESET_CATEGORY_COLORS,
} from "../types/constants"
import {
  addCategory,
  categories,
  removeCategory,
} from "../composables/useWebsiteNavigation"

const props = defineProps<{
  visible: boolean
  i18n: I18n
}>()

const emit = defineEmits<{
  (e: "close"): void
  (e: "saved"): void
}>()

const catName = ref("")
const catColor = ref<string>(PRESET_CATEGORY_COLORS[0])
const saving = ref(false)
const removingId = ref<string | null>(null)

const resetForm = () => {
  catName.value = ""
  catColor.value = PRESET_CATEGORY_COLORS[0]
}

const handleAdd = async () => {
  const name = catName.value.trim()
  if (!name || saving.value) return

  saving.value = true
  try {
    const ok = await addCategory(name, catColor.value)
    if (!ok) {
      showMessage(props.i18n.categoryExists, 2000, "error")
      return
    }
    resetForm()
    emit("saved")
  } catch {
    showMessage(props.i18n.saveFailed, 3000, "error")
  } finally {
    saving.value = false
  }
}

const handleRemove = async (id: string) => {
  if (removingId.value) return

  removingId.value = id
  try {
    const ok = await removeCategory(id)
    if (!ok) {
      showMessage(props.i18n.categoryNotEmpty, 2000, "error")
      return
    }
    emit("saved")
  } catch {
    showMessage(props.i18n.saveFailed, 3000, "error")
  } finally {
    removingId.value = null
  }
}

const handleClose = () => {
  if (saving.value || removingId.value) return
  resetForm()
  emit("close")
}
</script>
