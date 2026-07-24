<!-- 密码箱类别管理弹窗 — 自包含，新增/删除类别直接调用数据层 composable -->
<template>
  <Teleport to="body">
    <Transition name="fade">
      <div
        v-if="visible"
        class="password-vault-overlay modal-overlay"
        @click="$emit('close')"
      >
        <Transition name="scale">
          <div
            v-if="visible"
            class="password-vault-dialog category-manager"
            @click.stop
          >
            <div class="dialog-header">
              <h2>管理类别</h2>
              <Button
                icon="close"
                variant="ghost"
                size="xsmall"
                @click="$emit('close')"
              />
            </div>

            <div class="dialog-body">
              <!-- 添加新类别 -->
              <div class="add-category-section">
                <h3>添加新类别</h3>
                <div class="add-category-form">
                  <Input
                    v-model="newCategory.name"
                    type="text"
                    size="xsmall"
                    placeholder="类别名称"
                    :maxlength="10"
                  />
                  <div class="color-picker-wrapper">
                    <button
                      v-for="color in presetColors"
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
                    size="xsmall"
                    :disabled="!newCategory.name.trim()"
                    @click="handleAddCategory"
                  >
                    添加
                  </Button>
                </div>
              </div>

              <!-- 类别列表 -->
              <div class="category-list-section">
                <h3>现有类别</h3>
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
                      size="xsmall"
                      title="删除类别"
                      @click="openDeleteConfirm(cat.id)"
                    />
                    <span
                      v-else
                      class="default-badge"
                    >默认</span>
                  </div>
                </div>
              </div>

              <!-- 删除确认 -->
              <div
                v-if="showDeleteConfirm"
                class="category-delete-confirm"
              >
                <div class="confirm-card">
                  <p class="confirm-warning">
                    <IconWrapper
                      name="warning"
                      :size="16"
                    />
                    确定要删除类别「<strong>{{ getCategoryById(pendingDeleteId)?.name }}</strong>」吗？
                  </p>
                  <p
                    v-if="getCategoryEntryCount(pendingDeleteId) > 0"
                    class="confirm-hint"
                  >
                    该类别下 <strong>{{ getCategoryEntryCount(pendingDeleteId) }} 条</strong>条目将被移至默认类别。
                  </p>
                  <p
                    v-else
                    class="confirm-hint"
                  >
                    此操作不可撤销。
                  </p>
                  <div class="form-actions">
                    <Button
                      variant="ghost"
                      size="xsmall"
                      @click="showDeleteConfirm = false"
                    >
                      取消
                    </Button>
                    <Button
                      variant="primary"
                      size="xsmall"
                      @click="executeDelete"
                    >
                      确认删除
                    </Button>
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
import { showMessage } from "siyuan"
import {
  reactive,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"
import { usePasswordVaultData } from "../composables/usePasswordVaultData"

interface Props {
  visible: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "close"): void
  (e: "deleted", categoryId: string): void
}>()

const {
  categories,
  addCategory,
  deleteCategory,
  getCategoryById,
  getCategoryEntryCount,
} = usePasswordVaultData()

// 预设颜色 (Anthropic 品牌色)
const presetColors = [
  "#d97757", // 橙色 - Primary accent
  "#6a9bcc", // 蓝色 - Secondary accent
  "#788c5d", // 绿色 - Tertiary accent
  "#b0aea5", // 中灰 - Secondary
  "#141413", // 深色 - Primary text
  "#e8e6dc", // 浅灰 - Subtle backgrounds
]

const newCategory = reactive({
  name: "",
  color: presetColors[0],
})
const showDeleteConfirm = ref(false)
const pendingDeleteId = ref("")

// 关闭时重置内部状态
watch(
  () => props.visible,
  (visible) => {
    if (!visible) {
      showDeleteConfirm.value = false
      pendingDeleteId.value = ""
      newCategory.name = ""
      newCategory.color = presetColors[0]
    }
  },
)

const handleAddCategory = async () => {
  const ok = await addCategory(newCategory.name, newCategory.color)
  if (ok) {
    newCategory.name = ""
    newCategory.color = presetColors[0]
  }
}

const openDeleteConfirm = (categoryId: string) => {
  pendingDeleteId.value = categoryId
  showDeleteConfirm.value = true
}

const executeDelete = async () => {
  const categoryId = pendingDeleteId.value
  const movedCount = await deleteCategory(categoryId)
  emit("deleted", categoryId)

  const hint = movedCount > 0
    ? `类别已删除，${movedCount} 条条目已移至默认类别`
    : "类别已删除"
  showMessage(hint, 2000, "info")

  showDeleteConfirm.value = false
  pendingDeleteId.value = ""
}
</script>

<style lang="scss" scoped>
@use '../styles/CategoryManagerModal.scss';
@use '../styles/index.scss';
</style>
