<!-- 项目分类管理弹窗：列表区滚动 + 底部固定添加行（增删改一体） -->
<template>
  <div
    ref="rootRef"
    tabindex="-1"
    class="gp-mask"
    @keydown.escape="$emit('close')"
    @click.self="$emit('close')"
  >
    <div class="gp-dialog gp-cat-dialog">
      <div class="gp-dialog-header">
        <!-- 弹窗标题：“管理分类” -->
        <span class="gp-dialog-title">{{ i18n.manageCategories }}</span>
        <button
          class="vp-btn vp-btn--ghost gp-cat-icon-btn"
          :title="i18n.close"
          @click="$emit('close')"
        >
          <Icon
            icon="mdi:close"
            height="14"
          />
        </button>
      </div>

      <div class="gp-cat-body">
        <!-- 分类列表：可滚动区，分类变多时弹窗不超出视口 -->
        <div
          v-if="categories.length > 0"
          class="gp-cat-list"
        >
          <div
            v-for="cat in categories"
            :key="cat.id"
            class="gp-cat-row"
            :class="{ 'gp-cat-row--locked': cat.id === UNGROUPED_ID }"
          >
            <span
              class="gp-cat-dot"
              :style="{ background: cat.color }"
            />

            <!-- 编辑态：名称输入 + 颜色 + 保存/取消 -->
            <template v-if="editingId === cat.id">
              <Input
                v-model="editName"
                size="xsmall"
                class="gp-cat-edit-name"
                :placeholder="i18n.catNamePlaceholder"
                @keydown.enter="submitEdit(cat.id)"
                @keydown.escape.stop="cancelEdit"
              />
              <ColorField
                v-model="editColor"
                class="gp-cat-color"
                :placeholder="i18n.catColorTitle"
              />
              <div class="gp-cat-row-actions gp-cat-row-actions--editing">
                <button
                  class="vp-btn vp-btn--primary gp-cat-icon-btn"
                  :title="i18n.save"
                  :disabled="!editName.trim()"
                  @click="submitEdit(cat.id)"
                >
                  <Icon
                    icon="mdi:check"
                    height="14"
                  />
                </button>
                <button
                  class="vp-btn vp-btn--ghost gp-cat-icon-btn"
                  :title="i18n.cancel"
                  @click="cancelEdit"
                >
                  <Icon
                    icon="mdi:close"
                    height="14"
                  />
                </button>
              </div>
            </template>

            <!-- 展示态：名称 + 操作按钮（未分组仅展示，不可改名/删除） -->
            <template v-else>
              <span
                class="gp-cat-name"
                :title="cat.name"
              >{{ cat.name }}</span>
              <div
                v-if="cat.id !== UNGROUPED_ID"
                class="gp-cat-row-actions"
              >
                <!-- 编辑（改名 / 改色） -->
                <button
                  class="vp-btn vp-btn--ghost gp-cat-icon-btn"
                  :title="i18n.edit"
                  @click="startEdit(cat)"
                >
                  <Icon
                    icon="mdi:pencil-outline"
                    height="14"
                  />
                </button>
                <!-- 删除（不可逆，交父级二次确认） -->
                <button
                  class="vp-btn vp-btn--ghost gp-cat-icon-btn gp-btn-danger"
                  :title="i18n.delete"
                  @click="$emit('deleteCategory', cat.id)"
                >
                  <Icon
                    icon="mdi:delete-outline"
                    height="14"
                  />
                </button>
              </div>
            </template>
          </div>
        </div>
        <!-- 空态：默认分类恒存在，此分支仅为防御性兜底 -->
        <div
          v-else
          class="gp-cat-empty"
        >
          {{ i18n.noCategories }}
        </div>

        <!-- 添加区：固定于弹窗底部，不随列表滚动 -->
        <div class="gp-cat-add">
          <div class="gp-cat-add-row">
            <!-- 新分类名称输入：占位符“分类名称” -->
            <Input
              v-model="newCatName"
              size="xsmall"
              :placeholder="i18n.catNamePlaceholder"
              :maxlength="MAX_NAME_LEN"
              @keydown.enter="addCategory"
            />
            <!-- 分类颜色拾取器：共享 ColorField（原生 input[type=color] 在 Electron 下不弹窗） -->
            <ColorField
              v-model="newCatColor"
              class="gp-cat-color"
              :placeholder="i18n.catColorTitle"
            />
            <!-- 新增按钮：名称非空才可用 -->
            <button
              class="vp-btn vp-btn--primary gp-cat-add-btn"
              :title="i18n.add"
              :disabled="!canAdd"
              @click="addCategory"
            >
              <Icon
                icon="mdi:plus"
                height="14"
              />
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ProjectCategory } from "../../types"
import { Icon } from "@iconify/vue"
import { computed, ref } from "vue"
import ColorField from "@/components/ColorField.vue"
import Input from "@/components/Input.vue"
import { useDialogKeyboard } from "../../composables/useDialogKeyboard"
import { UNGROUPED_ID } from "../../types"

const props = defineProps<{
  i18n: Record<string, any>
  categories: ProjectCategory[]
}>()

const emit = defineEmits<{
  close: []
  addCategory: [name: string, color: string]
  updateCategory: [id: string, name: string, color: string]
  deleteCategory: [id: string]
}>()

// ⚠️ `rootRef` 必须保留为本地绑定：模板 `ref="rootRef"` 依赖它把根节点交给 composable 聚焦。
// TS 看不到「模板里的使用」，故以 void 显式消费，避免 noUnusedLocals 误判（下同各弹窗）。
const { rootRef } = useDialogKeyboard()
void rootRef

/** 新分类默认颜色 */
const DEFAULT_CAT_COLOR = "#3b82f6"
/** 分类名长度上限（与输入框 maxlength 同源，避免两处不一致） */
const MAX_NAME_LEN = 30

const newCatName = ref("")
const newCatColor = ref(DEFAULT_CAT_COLOR)

const canAdd = computed(() => newCatName.value.trim().length > 0)

// ── 行内编辑状态 ──
const editingId = ref("")
const editName = ref("")
const editColor = ref(DEFAULT_CAT_COLOR)

function startEdit(cat: ProjectCategory) {
  editingId.value = cat.id
  editName.value = cat.name
  editColor.value = cat.color
}

function cancelEdit() {
  editingId.value = ""
  editName.value = ""
}

function submitEdit(id: string) {
  const n = editName.value.trim()
  if (!n) return
  // 未变更则不派发，避免无意义的落盘与重渲染
  const prev = props.categories.find((c) => c.id === id)
  if (prev && prev.name === n && prev.color === editColor.value) {
    cancelEdit()
    return
  }
  emit("updateCategory", id, n, editColor.value)
  cancelEdit()
}

function addCategory() {
  if (!canAdd.value) return
  emit("addCategory", newCatName.value.trim(), newCatColor.value)
  // 提交后重置表单，焦点保持在输入框以便连续添加
  newCatName.value = ""
  newCatColor.value = DEFAULT_CAT_COLOR
}
</script>

<style scoped lang="scss">
@use "../../styles/CategoryDialog.scss";
</style>
