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
          <!-- 抽屉标题："功能列表" -->
          <span class="feature-drawer-title">{{ i18n.featureDrawer }}</span>
          <div class="feature-drawer-header-actions">
            <!-- 按钮提示："管理分类" -->
            <Button
              variant="ghost"
              size="xsmall"
              icon="tagOutline"
              :icon-size="14"
              :title="i18n.manageCategories"
              :aria-pressed="manageMode"
              @click="manageMode = !manageMode"
            />
            <!-- 视图切换：网格 / 列表 -->
            <Button
              variant="ghost"
              size="xsmall"
              :icon="gridMode ? 'list' : 'viewGrid'"
              :icon-size="14"
              :title="gridMode ? i18n.switchToList : i18n.switchToGrid"
              @click="gridMode = !gridMode"
            />
            <!-- 按钮提示："关闭" -->
            <Button
              variant="ghost"
              size="xsmall"
              icon="close"
              :icon-size="14"
              :title="i18n.panelCloseLabel"
              @click="emit('close')"
            />
          </div>
        </div>
        <!-- 搜索栏（管理模式下隐藏） -->
        <div
          v-if="!manageMode"
          class="feature-drawer-search"
        >
          <Input
            v-model="searchQuery"
            size="xsmall"
            borderless
            prefix-icon="magnify"
            :placeholder="i18n.searchFeaturePlaceholder"
            clearable
            :aria-label="i18n.searchFeaturePlaceholder"
            @keydown.escape="searchQuery = ''"
          />
        </div>
        <!-- 分类标签栏（全部 / 监控 / 自定义分类） -->
        <div
          v-if="!searchQuery && !manageMode"
          class="feature-drawer-tabs"
          role="group"
          :aria-label="i18n.featureDrawer"
        >
          <Button
            v-for="tab in tabs"
            :key="tab.key"
            :variant="activeGroup === tab.key ? 'primary' : 'ghost'"
            :text="activeGroup !== tab.key"
            size="xsmall"
            :aria-pressed="activeGroup === tab.key"
            @click="activeGroup = tab.key"
          >
            {{ tab.label }}
          </Button>
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
            :i18n="i18n"
            @select="handleClick"
            @toggle-status-bar="emit('toggleStatusBar', $event)"
            @assign-category="(id, e) => emit('assignCategory', id, e)"
            @toggle-enabled="emit('toggleEnabled', $event)"
          />
          <!-- 空态："未找到匹配功能" / "暂无功能" -->
          <div
            v-if="displayItems.length === 0"
            class="feature-drawer-empty"
          >
            {{ searchQuery ? i18n.noMatchingFeature : i18n.noFeature }}
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
            <Input
              class="manage-input"
              :model-value="cat.name"
              size="xsmall"
              :error="renameErrors[cat.id]"
              :aria-label="i18n.manageCategories"
              @change="onRename(cat.id, String($event))"
              @keydown.enter="($event.target as HTMLInputElement).blur()"
            />
            <!-- 成员计数："N 项" -->
            <span class="manage-count">{{ memberCount(cat.id) }} {{ i18n.itemsCount }}</span>
            <!-- 按钮提示："删除分类" -->
            <Button
              variant="ghost"
              size="xsmall"
              icon="delete"
              :icon-size="14"
              :title="i18n.deleteCategory"
              @click="onDelete(cat.id)"
            />
          </div>
          <!-- 无分类时的提示文案 -->
          <div
            v-if="categories.length === 0"
            class="feature-drawer-empty"
          >
            {{ i18n.noCategoryHint }}
          </div>
          <!-- 底部添加行 -->
          <div class="feature-drawer-manage-add">
            <Input
              class="manage-input"
              v-model="newCategoryName"
              size="xsmall"
              :error="addError"
              :placeholder="i18n.newCategoryPlaceholder"
              :aria-label="i18n.addCategory"
              @keydown.enter="onAdd"
            />
            <!-- 按钮提示："新建分类" -->
            <Button
              variant="ghost"
              size="xsmall"
              icon="plus"
              :icon-size="14"
              :title="i18n.addCategory"
              @click="onAdd"
            />
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import type { Ref } from "vue"
import type { FeatureDrawerItem, StatusBarCategory } from "../types/index"
import { computed, ref, watch } from "vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import DrawerFeatureItem from "./DrawerFeatureItem.vue"

/** 分类管理器（useFeatureCategories 返回值的最小接口；返回值是 i18n 键，由本组件翻译） */
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
  categoryManager: CategoryManager
  i18n: Record<string, string>
}

const props = withDefaults(defineProps<Props>(), {
  statusBarVisible: () => [],
})
const emit = defineEmits<{
  close: []
  select: [id: string]
  toggleStatusBar: [id: string]
  assignCategory: [id: string, event: MouseEvent]
  toggleEnabled: [id: string]
}>()

const gridMode = ref(true)
const searchQuery = ref("")
const activeGroup = ref("__all__")
const manageMode = ref(false)

// 分类管理面板状态
const newCategoryName = ref("")
const addError = ref("")
const renameErrors = ref<Record<string, string>>({})

// 模板友好的解包视图
const categories = computed(() => props.categoryManager.categories.value)
const assignment = computed(() => props.categoryManager.assignment.value)

/** 把校验返回的 i18n 键翻译为文案（键缺失时回退原键，便于定位缺失翻译） */
const translateError = (key: string): string =>
  key ? (props.i18n[key] ?? key) : ""

const onAdd = () => {
  const error = props.categoryManager.addCategory(newCategoryName.value)
  addError.value = translateError(error)
  if (!error) newCategoryName.value = ""
}

const onRename = (id: string, name: string) => {
  const error = props.categoryManager.renameCategory(id, name)
  if (error) {
    renameErrors.value = { ...renameErrors.value, [id]: translateError(error) }
  } else {
    const { [id]: _removed, ...rest } = renameErrors.value
    renameErrors.value = rest
  }
}

const onDelete = (id: string) => {
  props.categoryManager.removeCategory(id)
  // 同步清理该分类的重命名错误提示，避免孤儿文案残留渲染
  const { [id]: _removed, ...rest } = renameErrors.value
  renameErrors.value = rest
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
  { key: "__all__", label: props.i18n.tabAll },
  { key: "__monitor__", label: props.i18n.tabMonitor },
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
    // 已分类出去的功能不重复出现在「全部」，仅显示未分类项
    return filtered.filter((item) =>
      !isMonitor(item) && !assignment.value[item.id])
  }
  // 自定义分类 Tab：仅显示归属该分类的非监控项
  return filtered.filter((item) =>
    !isMonitor(item) && assignment.value[item.id] === activeGroup.value)
})

const handleClick = (id: string) => {
  emit("select", id)
}
</script>
