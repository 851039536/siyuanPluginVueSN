<!-- 文档分析功能 - 统一设置弹窗（健康度/0B排除书签/名称排除/平台管理/查询默认，齿轮图标打开） -->
<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="settings-overlay"
      @click.self="handleCancel"
    >
      <div
        class="settings-panel"
        tabindex="-1"
        @keydown.esc="handleCancel"
      >
        <div class="settings-header">
          <span class="settings-title">
            <Icon icon="mdi:cog-outline" />
            设置
          </span>
          <button
            class="close-btn"
            @click="handleCancel"
          >
            <Icon icon="mdi:close" />
          </button>
        </div>

        <div class="settings-body">
          <!-- 健康度分区：扣分项勾选 + 0B 排除书签勾选 -->
          <HealthSection
            :enabled-deductions="draft.enabledDeductions"
            :zero-byte-exclude-bookmarks="draft.zeroByteExcludeBookmarks"
            :bookmark-distribution="bookmarkDistribution"
            @update:enabledDeductions="(v) => draft.enabledDeductions = v"
            @update:zeroByteExcludeBookmarks="(v) => draft.zeroByteExcludeBookmarks = v"
          />

          <!-- 名称排除分区：重名文档名称排除（初始值透传原始持久化列表，避免打开瞬间 draft 未初始化读到空） -->
          <ExcludeSection
            :visible="visible"
            :names="props.duplicateNameFilter"
            @update:names="(v) => draft.duplicateNames = v"
          />

          <!-- 平台管理分区：平台增删/排序/判定/隐藏（初始值透传原始平台列表，避免打开瞬间 draft 未初始化读到空） -->
          <PlatformSection
            :visible="visible"
            :platforms="props.platforms"
            @update:platforms="(v) => draft.platforms = v"
            @update:valid="(v) => platformValid = v"
          />

          <!-- 查询默认分区：隐藏零值 + 默认笔记本 + 默认排序 -->
          <QuerySection
            :hide-zero="draft.hideZero"
            :notebook-id="draft.notebookId"
            :sort-field="draft.sortField"
            :sort-order="draft.sortOrder"
            :notebooks="notebooks"
            @update:hideZero="(v) => draft.hideZero = v"
            @update:notebookId="(v) => draft.notebookId = v"
            @update:sortField="(v) => draft.sortField = v"
            @update:sortOrder="(v) => draft.sortOrder = v"
          />
        </div>

        <div class="settings-footer">
          <!-- 底部操作栏 -->
          <button
            class="settings-cancel"
            @click="handleCancel"
          >取消</button>
          <button
            class="settings-save"
            :disabled="!platformValid || saving"
            @click="handleSave"
          >
            <Icon
              :icon="saving ? 'mdi:loading' : 'mdi:check'"
              :class="{ 'spin-icon': saving }"
            />
            {{ saving ? '保存中...' : '保存' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import { computed, reactive, ref, watch } from "vue"
import type {
  DeductionKey,
  DocStats,
  FilterOptions,
  HealthSettings,
  NotebookInfo,
  PlatformMeta,
  SortField,
  SortOrder,
  ViewSettings,
} from "../../types/index"
import HealthSection from "./HealthSection.vue"
import ExcludeSection from "./ExcludeSection.vue"
import PlatformSection from "./PlatformSection.vue"
import QuerySection from "./QuerySection.vue"

/** 设置弹窗聚合副本（统一保存一次性写入） */
export interface SettingsDraft {
  enabledDeductions: DeductionKey[]
  zeroByteExcludeBookmarks: string[]
  duplicateNames: string[]
  hideZero: boolean
  platforms: PlatformMeta[]
  notebookId: string
  sortField: SortField
  sortOrder: SortOrder
}

interface Props {
  visible: boolean
  healthSettings: HealthSettings
  duplicateNameFilter: string[]
  viewSettings: ViewSettings
  platforms: PlatformMeta[]
  filterOptions: FilterOptions
  notebooks: NotebookInfo[]
  /** 文档统计（书签分布供 0B 排除书签选项） */
  stats: DocStats
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "close"): void
  (e: "saved", draft: SettingsDraft): void
}>()

/** 平台分区校验是否通过（保存按钮禁用条件） */
const platformValid = ref(true)
const saving = ref(false)

/** 聚合副本：打开时从各持久化状态初始化，编辑过程仅改副本 */
const draft = reactive<SettingsDraft>({
  enabledDeductions: [],
  zeroByteExcludeBookmarks: [],
  duplicateNames: [],
  hideZero: false,
  platforms: [],
  notebookId: "",
  sortField: "wordCount",
  sortOrder: "asc",
})

/** 打开/首次挂载时用各持久化状态初始化副本（immediate 保证 v-if 首次挂载 visible=true 也能初始化） */
watch(() => props.visible, (v) => {
  if (!v) return
  draft.enabledDeductions = [...props.healthSettings.enabledDeductions]
  draft.zeroByteExcludeBookmarks = [...props.healthSettings.zeroByteExcludeBookmarks]
  draft.duplicateNames = [...props.duplicateNameFilter]
  draft.hideZero = props.viewSettings.hideZero
  draft.platforms = props.platforms.map((p) => ({ ...p, matchers: [...p.matchers] }))
  draft.notebookId = props.filterOptions.notebookId
  draft.sortField = props.filterOptions.sortField
  draft.sortOrder = props.filterOptions.sortOrder
  platformValid.value = true
}, { immediate: true })

/** 书签分布（0B 排除书签选项数据源） */
const bookmarkDistribution = computed(() => props.stats.bookmarkDistribution)

/** 统一保存：回写副本并 emit，由父级写入各持久化槽位 */
function handleSave() {
  if (!platformValid.value || saving.value) return
  saving.value = true
  try {
    emit("saved", {
      enabledDeductions: [...draft.enabledDeductions],
      zeroByteExcludeBookmarks: [...draft.zeroByteExcludeBookmarks],
      duplicateNames: [...draft.duplicateNames],
      hideZero: draft.hideZero,
      platforms: draft.platforms.map((p) => ({
        ...p,
        id: p.id.trim(),
        name: p.name.trim(),
        matchers: p.matchers.filter(Boolean),
      })),
      notebookId: draft.notebookId,
      sortField: draft.sortField,
      sortOrder: draft.sortOrder,
    })
    emit("close")
  } finally {
    saving.value = false
  }
}

/** 取消：丢弃副本直接关闭 */
function handleCancel() {
  emit("close")
}
</script>

<style lang="scss" scoped>
@use "../../styles/SettingsPanel.scss";
</style>
