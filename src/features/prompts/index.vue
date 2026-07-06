<template>
  <!-- 主弹窗 -->
  <div
    v-if="showModal"
    class="vp-modal"
    @keydown.escape="closeModal"
  >
    <div class="vp-modal-header">
      <div class="vp-modal-title">
        <IconWrapper
          name="starCircle"
          :size="24"
          class="vp-modal-icon"
        />
        <h2>{{ i18n?.title || '提示词库' }}</h2>
      </div>
      <div class="vp-modal-actions">
        <Button
          variant="ghost"
          size="xsmall"
          icon="listBulleted"
          :title="i18n?.manageCategories || '管理分类'"
          @click="showCategoryManage = true"
        />
        <Button
          variant="ghost"
          icon="close"
          size="xsmall"
          @click="closeModal"
        />
      </div>
    </div>

    <PromptsGrid
      :filtered-prompts="filteredPrompts"
      :all-categories="allCategories"
      :selected-category="selectedCategory"
      :search-query="searchQuery"
      :category-counts="categoryCounts"
      :loading="loading"
      :i18n="i18n"
      @update:search-query="searchQuery = $event"
      @select-category="selectedCategory = $event"
      @add-prompt="showAddModal = true; editingPrompt = null"
      @edit-prompt="(p: Prompt) => { editingPrompt = p; showAddModal = true }"
      @request-delete="deleteConfirmTarget = $event"
      @copy-content="copyContent"
    />
  </div>

  <!-- 添加/编辑弹窗 -->
  <PromptFormModal
    :show="showAddModal"
    :editing-prompt="editingPrompt"
    :categories="categoriesRaw"
    :i18n="i18n"
    @close="closeAddModal"
    @save="handleSave"
  />

  <!-- 分类管理弹窗 -->
  <CategoryManageModal
    :show="showCategoryManage"
    :categories="categoriesRaw"
    :i18n="i18n"
    @close="showCategoryManage = false"
    @add="handleCategoryAdd"
    @delete="handleCategoryDelete"
  />

  <!-- 删除确认弹窗 -->
  <DeleteConfirmModal
    :target-id="deleteConfirmTarget"
    :i18n="i18n"
    @confirm="confirmDelete"
    @cancel="deleteConfirmTarget = null"
  />
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type {
  Prompt,
  PromptCategory,
} from "./types"
import { showMessage } from "siyuan"
import {
  computed,
  onMounted,
  ref,
} from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { copyToClipboard } from "@/utils/domUtils"
import { useCategoryManager } from "./composables/useCategoryManager"
import { usePrompts } from "./composables/usePrompts"
import { PromptsStorage } from "./types/storage"
import CategoryManageModal from "./components/CategoryManageModal.vue"
import DeleteConfirmModal from "./components/DeleteConfirmModal.vue"
import PromptFormModal from "./components/PromptFormModal.vue"
import PromptsGrid from "./components/PromptsGrid.vue"

const props = defineProps<{
  i18n?: Record<string, string>
  plugin?: Plugin
  onClose?: () => void
}>()

const emit = defineEmits<{
  (e: "close"): void
}>()

// --- UI 状态 ---
const showModal = ref(true)
const showAddModal = ref(false)
const showCategoryManage = ref(false)
const editingPrompt = ref<Prompt | null>(null)
const searchQuery = ref("")
const selectedCategory = ref<string>("all")
const deleteConfirmTarget = ref<string | null>(null)

// --- 数据层 ---
const storage = ref<PromptsStorage | null>(null)
const {
  prompts,
  loading,
  load: loadPrompts,
  add: addPrompt,
  update: updatePrompt,
  remove: removePrompt,
} = usePrompts(storage)
const {
  categories: categoriesRaw,
  allCategories,
  load: loadCategories,
  add: addCategory,
  remove: removeCategory,
} = useCategoryManager(storage)

// --- 分类统计 ---
const categoryCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const p of prompts.value) {
    counts[p.category] = (counts[p.category] || 0) + 1
  }
  return counts
})

// --- 过滤计算 ---
// 缓存分类元数据，仅在分类列表变化时重建
const categoryMetaMap = computed(() => {
  const map = new Map<string, { name: string; color: string; bg: string }>()
  for (const cat of categoriesRaw.value) {
    map.set(cat.id, { name: cat.name, color: cat.color, bg: `${cat.color}20` })
  }
  return map
})

const filteredPrompts = computed(() => {
  let result = prompts.value

  if (selectedCategory.value !== "all") {
    result = result.filter((p) => p.category === selectedCategory.value)
  }

  const query = searchQuery.value.toLowerCase().trim()
  if (query) {
    result = result.filter(
      (p) =>
        p.title?.toLowerCase().includes(query)
        || p.description?.toLowerCase().includes(query)
        || (p.contents || []).some(
          (c) => c.text?.toLowerCase().includes(query) || c.label?.toLowerCase().includes(query),
        ),
    )
  }

  const metaMap = categoryMetaMap.value
  const defaultMeta = metaMap.get(categoriesRaw.value[0]?.id) || { name: "默认", color: "#d97757", bg: "#d9775720" }
  return result.map((prompt) => {
    const cat = metaMap.get(prompt.category) || defaultMeta
    return {
      ...prompt,
      catName: cat.name,
      catColor: cat.color,
      catBgColor: cat.bg,
    }
  })
})

// --- 初始化 ---
onMounted(async () => {
  if (props.plugin) {
    storage.value = new PromptsStorage(props.plugin)
    await Promise.all([loadPrompts(), loadCategories()])
  }
})

// --- 提示词操作 ---
function closeAddModal() {
  showAddModal.value = false
  editingPrompt.value = null
}

async function handleSave(prompt: Prompt) {
  if (editingPrompt.value) {
    await updatePrompt(prompt)
  } else {
    await addPrompt(prompt)
  }
  closeAddModal()
}

// --- 分类操作 ---
function handleCategoryAdd(category: PromptCategory) {
  addCategory(category)
}

async function handleCategoryDelete(id: string) {
  const hasPrompts = prompts.value.some((p) => p.category === id)
  if (hasPrompts) {
    showMessage("无法删除：该分类下还有提示词", 3000, "error")
    return
  }
  await removeCategory(id)
  if (selectedCategory.value === id) {
    selectedCategory.value = "all"
  }
}

// --- 删除确认 ---
async function confirmDelete() {
  const id = deleteConfirmTarget.value
  if (!id) return
  await removePrompt(id)
  deleteConfirmTarget.value = null
  showMessage("提示词已删除", 2000, "info")
}

// --- 工具函数 ---
async function copyContent(content: string) {
  const ok = await copyToClipboard(content)
  if (!ok) showMessage("复制失败，请手动复制", 2000, "error")
}

function closeModal() {
  showModal.value = false
  emit("close")
  props.onClose?.()
}
</script>

<style lang="scss" scoped>
@use './styles/index.scss';
</style>
