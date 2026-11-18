<!--
  提示词库主面板 — Modal 容器，管理提示词 CRUD + 分类 + 删除确认
  编辑/分类弹窗自包含（父只传 editingId 最小标识符 + manager 实例）
-->
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
        <h2>{{ t.title }}</h2>
      </div>
      <div class="vp-modal-actions">
        <Button
          variant="ghost"
          size="xsmall"
          icon="listBulleted"
          :title="t.manageCategories"
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
      :i18n="t"
      @update:searchQuery="searchQuery = $event"
      @selectCategory="selectedCategory = $event"
      @manageCategories="showCategoryManage = true"
      @addPrompt="showAddModal = true; editingId = null"
      @editPrompt="(p: Prompt) => { editingId = p.id; showAddModal = true }"
      @requestDelete="deleteConfirmTarget = $event"
      @copyContent="copyContent"
    />
  </div>

  <!-- 添加/编辑弹窗（自包含） -->
  <PromptFormModal
    :show="showAddModal"
    :editing-id="editingId"
    :prompt-manager="promptsManager"
    :category-manager="categoryManager"
    :i18n="t"
    @close="closeAddModal"
  />

  <!-- 分类管理弹窗（自包含） -->
  <CategoryManageModal
    :show="showCategoryManage"
    :category-manager="categoryManager"
    :prompt-manager="promptsManager"
    :i18n="t"
    @close="showCategoryManage = false"
  />

  <!-- 删除确认弹窗 -->
  <DeleteConfirmModal
    :target-id="deleteConfirmTarget"
    :i18n="t"
    @confirm="confirmDelete"
    @cancel="deleteConfirmTarget = null"
  />
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type {
  Prompt,
  PromptDisplay,
} from "./types"
import { showMessage } from "siyuan"
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { copyToClipboard } from "@/utils/domUtils"
import CategoryManageModal from "./components/CategoryManageModal.vue"
import DeleteConfirmModal from "./components/DeleteConfirmModal.vue"
import PromptFormModal from "./components/PromptFormModal.vue"
import PromptsGrid from "./components/PromptsGrid.vue"
import { useCategoryManager } from "./composables/useCategoryManager"
import { usePrompts } from "./composables/usePrompts"
import {
  DEFAULT_CATEGORY_COLOR,
  PROMPTS_ALL_CATEGORY_ID,
} from "./types"
import { PromptsStorage } from "./types/storage"
import {
  MSG_DURATION,
  resolvePromptsI18n,
  withAlpha,
} from "./utils"

const props = defineProps<{
  i18n?: Record<string, string>
  plugin?: Plugin
  onClose?: () => void
}>()

/** 完整 i18n（含默认值兜底），替代散落的 `(props.i18n || {}).x!` */
const t = computed(() => resolvePromptsI18n(props.i18n))

// --- UI 状态 ---
const showModal = ref(true)
const showAddModal = ref(false)
const showCategoryManage = ref(false)
/** 正在编辑的提示词 id（null = 新增；完整表单数据由 PromptFormModal 自行加载） */
const editingId = ref<string | null>(null)
const searchQuery = ref("")
const selectedCategory = ref<string>(PROMPTS_ALL_CATEGORY_ID)
const deleteConfirmTarget = ref<string | null>(null)

// --- 数据层 ---
const storage = shallowRef<PromptsStorage | null>(null)
const promptsManager = usePrompts(storage)
const { prompts, loading, load: loadPrompts, remove: removePrompt } = promptsManager
const categoryManager = useCategoryManager(storage, props.i18n)
const { allCategories, load: loadCategories } = categoryManager

// --- 分类统计 ---
const categoryCounts = computed(() => {
  const counts: Record<string, number> = {}
  for (const p of prompts.value) {
    counts[p.category] = (counts[p.category] || 0) + 1
  }
  return counts
})

// --- 过滤计算 ---
// 缓存分类元数据，仅在分类列表变化时重建（含内置 default，保证旧数据正确着色）
const categoryMetaMap = computed(() => {
  const map = new Map<string, { name: string, color: string, bg: string }>()
  for (const cat of allCategories.value) {
    map.set(cat.id, {
      name: cat.name,
      color: cat.color,
      bg: withAlpha(cat.color, 0.125),
    })
  }
  return map
})

const filteredPrompts = computed<PromptDisplay[]>(() => {
  let result = prompts.value

  if (selectedCategory.value !== PROMPTS_ALL_CATEGORY_ID) {
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
  const defaultMeta = {
    name: t.value.defaultCategory,
    color: DEFAULT_CATEGORY_COLOR,
    bg: withAlpha(DEFAULT_CATEGORY_COLOR, 0.125),
  }
  return result.map((prompt): PromptDisplay => {
    const cat = metaMap.get(prompt.category) || defaultMeta
    return {
      ...prompt,
      catName: cat.name,
      catColor: cat.color,
      catBgColor: cat.bg,
    }
  })
})

// --- 初始化（迁移已在 showPromptsModal 打开前显式完成，此处仅纯加载）---
let unmounted = false
onMounted(async () => {
  if (!props.plugin) return

  storage.value = new PromptsStorage(props.plugin)
  try {
    await Promise.all([loadPrompts(), loadCategories()])
  } catch (error) {
    console.error("初始化提示词库失败:", error)
    if (!unmounted) showMessage(t.value.loadFailed, MSG_DURATION.LONG, "error")
  }
})
onUnmounted(() => {
  // 异步加载完成后若组件已销毁，不再写回状态/弹提示
  unmounted = true
})

// 所选分类被删除后回退"全部"（监听完整分类视图，内置分类恒定存在）
watch(allCategories, (cats) => {
  if (
    selectedCategory.value !== PROMPTS_ALL_CATEGORY_ID
    && !cats.some((c) => c.id === selectedCategory.value)
  ) {
    selectedCategory.value = PROMPTS_ALL_CATEGORY_ID
  }
})

// --- 提示词操作 ---
function closeAddModal(): void {
  showAddModal.value = false
  editingId.value = null
}

// --- 删除确认 ---
async function confirmDelete(): Promise<void> {
  const id = deleteConfirmTarget.value
  if (!id) return
  try {
    // P1-2：仅在持久化成功后提示"已删除"，失败时保留弹窗供重试
    await removePrompt(id)
    deleteConfirmTarget.value = null
    showMessage(t.value.promptDeleted, MSG_DURATION.SHORT, "info")
  } catch {
    showMessage(t.value.saveFailed, MSG_DURATION.SHORT, "error")
  }
}

// --- 工具函数 ---
async function copyContent(content: string): Promise<void> {
  const ok = await copyToClipboard(content)
  if (!ok) showMessage(t.value.copyFailed, MSG_DURATION.SHORT, "error")
}

function closeModal(): void {
  showModal.value = false
  props.onClose?.()
}
</script>

<style lang="scss" scoped>
@use './styles/index.scss';
</style>
