<!-- 功能抽屉面板：网格/列表展示所有功能入口，支持搜索、自定义分类 Tab、分类管理 -->
<template>
  <Teleport to="body">
    <div
      v-if="visible"
      class="feature-drawer-overlay"
      @click="emit('close')"
    />
    <Transition name="drawer-slide">
      <div
        v-if="visible"
        class="feature-drawer"
      >
        <div class="feature-drawer-header">
          <span class="feature-drawer-title">功能列表</span>
          <div class="feature-drawer-header-actions">
            <button
              class="feature-drawer-view-btn"
              title="管理分类"
              @click="manageMode = !manageMode"
            >
              <Icon
                icon="ph:tags"
                :width="14"
              />
            </button>
            <button
              class="feature-drawer-view-btn"
              :title="gridMode ? '切换为列表' : '切换为网格'"
              @click="gridMode = !gridMode"
            >
              <svg
                v-if="gridMode"
                width="14"
                height="14"
                viewBox="0 0 24 24"
              >
                <path
                  fill="currentColor"
                  d="M3 4h4v4H3V4zm6 0h4v4H9V4zm6 0h4v4h-4V4zM3 10h4v4H3v-4zm6 0h4v4H9v-4zm6 0h4v4h-4v-4zM3 16h4v4H3v-4zm6 0h4v4H9v-4zm6 0h4v4h-4v-4z"
                />
              </svg>
              <svg
                v-else
                width="14"
                height="14"
                viewBox="0 0 24 24"
              >
                <path
                  fill="currentColor"
                  d="M3 4h18v2H3V4zm0 7h18v2H3v-2zm0 7h18v2H3v-2z"
                />
              </svg>
            </button>
            <button
              class="feature-drawer-close"
              @click="emit('close')"
            >
              <Icon
                icon="ph:x"
                :width="14"
              />
            </button>
          </div>
        </div>
        <!-- 搜索栏（管理模式下隐藏） -->
        <div
          v-if="!manageMode"
          class="feature-drawer-search"
        >
          <Icon
            icon="ph:magnifying-glass"
            :width="14"
            class="search-icon"
          />
          <input
            v-model="searchQuery"
            type="text"
            class="search-input"
            placeholder="搜索功能..."
            @keydown.escape="searchQuery = ''"
          />
          <button
            v-if="searchQuery"
            class="search-clear"
            @click="searchQuery = ''"
          >
            <Icon
              icon="ph:x"
              :width="12"
            />
          </button>
        </div>
        <!-- 分类标签栏（全部 / 监控 / 自定义分类） -->
        <div
          v-if="!searchQuery && !manageMode"
          class="feature-drawer-tabs"
        >
          <button
            v-for="tab in tabs"
            :key="tab.key"
            class="feature-drawer-tab"
            :class="{ active: activeGroup === tab.key }"
            @click="activeGroup = tab.key"
          >
            {{ tab.label }}
          </button>
        </div>
        <!-- 功能列表 -->
        <div
          v-if="!manageMode"
          class="feature-drawer-list"
          :class="{ 'grid-mode': gridMode }"
        >
          <DrawerFeatureItem
            v-for="item in displayItems"
            :key="item.id"
            :item="item"
            :status-bar-visible="statusBarVisible"
            @select="handleClick"
            @toggle-status-bar="emit('toggleStatusBar', $event)"
            @assign-category="(id, e) => emit('assignCategory', id, e)"
            @toggle-enabled="emit('toggleEnabled', $event)"
          />
          <div
            v-if="displayItems.length === 0"
            class="feature-drawer-empty"
          >
            {{ searchQuery ? '未找到匹配功能' : '暂无功能' }}
          </div>
        </div>
        <!-- 分类管理面板 -->
        <div
          v-else
          class="feature-drawer-manage"
        >
          <!-- 现有分类行：重命名 + 成员计数 + 删除 -->
          <div
            v-for="cat in categories"
            :key="cat.id"
            class="feature-drawer-manage-row"
          >
            <input
              :value="cat.name"
              type="text"
              class="manage-input"
              :class="{ invalid: renameErrors[cat.id] }"
              @change="onRename(cat.id, $event)"
              @keydown.enter="($event.target as HTMLInputElement).blur()"
            />
            <span class="manage-count">{{ memberCount(cat.id) }} 项</span>
            <button
              class="manage-btn"
              title="删除分类"
              @click="onDelete(cat.id)"
            >
              <Icon
                icon="ph:trash"
                :width="14"
              />
            </button>
          </div>
          <!-- 行内错误提示 -->
          <div
            v-for="(msg, id) in renameErrors"
            :key="id"
            class="manage-error"
          >
            {{ msg }}
          </div>
          <div
            v-if="categories.length === 0"
            class="feature-drawer-empty"
          >
            <!-- 无分类时的提示文案 -->
            暂无分类，在下方输入名称新建
          </div>
          <!-- 底部添加行 -->
          <div class="feature-drawer-manage-add">
            <input
              v-model="newCategoryName"
              type="text"
              class="manage-input"
              :class="{ invalid: addError }"
              placeholder="新分类名称..."
              @keydown.enter="onAdd"
            />
            <button
              class="manage-btn"
              title="新建分类"
              @click="onAdd"
            >
              <Icon
                icon="ph:plus"
                :width="14"
              />
            </button>
          </div>
          <div
            v-if="addError"
            class="manage-error"
          >
            {{ addError }}
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { Ref } from "vue"
import type { StatusBarCategory } from "../types/index"
import { Icon } from "@iconify/vue"
import {
  computed,
  ref,
  watch,
} from "vue"
import DrawerFeatureItem from "./DrawerFeatureItem.vue"

export interface FeatureDrawerItem {
  id: string
  icon: string
  color: string
  title: string
  pinnable: boolean
  // 监控项标志：进入「监控」Tab，不参与自定义分类
  monitor?: boolean
  // 当前归属分类 id（未分类为空），供分类角标高亮
  categoryId?: string | null
  enabled?: boolean
  toggleable?: boolean
}

/** 分类管理器（useFeatureCategories 返回值的最小接口） */
export interface CategoryManager {
  categories: Ref<StatusBarCategory[]>
  assignment: Ref<Record<string, string>>
  addCategory: (name: string) => string
  renameCategory: (id: string, name: string) => string
  removeCategory: (id: string) => void
}

interface Props {
  visible: boolean
  items: FeatureDrawerItem[]
  statusBarVisible?: string[]
  categoryManager?: CategoryManager
}

interface Emits {
  (e: "close"): void
  (e: "select", id: string): void
  (e: "toggleStatusBar", id: string): void
  (e: "assignCategory", id: string, event: MouseEvent): void
  (e: "toggleEnabled", id: string): void
}

const props = withDefaults(defineProps<Props>(), {
  statusBarVisible: () => [],
  categoryManager: undefined,
})
const emit = defineEmits<Emits>()

const gridMode = ref(true)
const searchQuery = ref("")
const activeGroup = ref("__all__")
const manageMode = ref(false)

// 分类管理面板状态
const newCategoryName = ref("")
const addError = ref("")
const renameErrors = ref<Record<string, string>>({})

// 模板友好的解包视图
const categories = computed(() => props.categoryManager?.categories.value ?? [])
const assignment = computed(() => props.categoryManager?.assignment.value ?? {})

const onAdd = () => {
  const error = props.categoryManager?.addCategory(newCategoryName.value) ?? ""
  addError.value = error
  if (!error) newCategoryName.value = ""
}

const onRename = (id: string, event: Event) => {
  const name = (event.target as HTMLInputElement).value
  const error = props.categoryManager?.renameCategory(id, name) ?? ""
  if (error) {
    renameErrors.value = { ...renameErrors.value, [id]: error }
  } else {
    const { [id]: _removed, ...rest } = renameErrors.value
    renameErrors.value = rest
  }
}

const onDelete = (id: string) => {
  props.categoryManager?.removeCategory(id)
  // 被删分类正被选中时回退到「全部」
  if (activeGroup.value === id) activeGroup.value = "__all__"
}

// 成员计数
const memberCount = (categoryId: string) =>
  Object.values(assignment.value).filter((cid) => cid === categoryId).length

// 关闭抽屉时重置搜索、分组与管理状态，避免残留状态导致下次打开时显示不完整
watch(() => props.visible, (val) => {
  if (!val) {
    searchQuery.value = ""
    activeGroup.value = "__all__"
    manageMode.value = false
    addError.value = ""
    renameErrors.value = {}
  }
})

// 当前激活的分类被删除时回退到「全部」
watch(categories, (cats) => {
  if (activeGroup.value !== "__all__" && activeGroup.value !== "__monitor__"
    && !cats.some((c) => c.id === activeGroup.value)) {
    activeGroup.value = "__all__"
  }
})

// 缓存小写搜索词，避免 matchSearch 每次过滤时重复 toLowerCase()
const searchQueryLower = computed(() => searchQuery.value.toLowerCase())

// 分类名查找表：搜索时按归属分类名匹配
const categoryNameMap = computed(() =>
  new Map(categories.value.map((c) => [c.id, c.name])),
)

// 搜索过滤：标题 + 归属分类名
const matchSearch = (item: FeatureDrawerItem) => {
  if (!searchQuery.value) return true
  const q = searchQueryLower.value
  const categoryName = item.categoryId
    ? categoryNameMap.value.get(item.categoryId) ?? ""
    : ""
  return item.title.toLowerCase().includes(q)
    || categoryName.toLowerCase().includes(q)
}

const isMonitor = (item: FeatureDrawerItem) => item.monitor === true

// Tab 栏：系统 Tab（全部/监控）+ 动态自定义分类
const tabs = computed(() => [
  { key: "__all__", label: "全部" },
  { key: "__monitor__", label: "监控" },
  ...categories.value.map((c) => ({ key: c.id, label: c.name })),
])

// 按分类过滤（非搜索模式），搜索时忽略分类
const displayItems = computed(() => {
  const filtered = props.items.filter(matchSearch)
  if (searchQuery.value) return filtered
  if (activeGroup.value === "__monitor__") {
    return filtered.filter(isMonitor)
  }
  if (activeGroup.value === "__all__") {
    return filtered.filter((item) => !isMonitor(item))
  }
  // 自定义分类 Tab：仅显示归属该分类的非监控项
  return filtered.filter((item) =>
    !isMonitor(item) && assignment.value[item.id] === activeGroup.value)
})

const handleClick = (id: string) => {
  emit("select", id)
}
</script>
