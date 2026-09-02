<template>
  <div
    class="quick-note-panel"
    :class="{ 'quick-note-panel--minimized': minimized }"
  >
    <!-- 最小化态：贴边小条（横条/竖条由当前位置派生），按住可拖动，点击展开，tooltip："展开" -->
    <button
      v-if="minimized"
      class="mini-bar"
      :class="{ 'mini-bar--vertical': minimizeMeta.axis === 'vertical' }"
      :title="i18n.restore"
      @pointerdown="props.manager.startDrag($event)"
      @click="handleMiniBarClick"
    >
      <IconWrapper
        name="quickNote"
        :size="14"
      />
      <!-- 最小化条标题："速记"（竖条时纵向排版） -->
      <span class="mini-bar__title">{{ i18n.title }}</span>
      <!-- 未完成待办计数徽标 -->
      <span
        v-if="pendingCount > 0"
        class="mini-bar__count"
      >{{ pendingCount }}</span>
      <IconWrapper
        :name="minimizeMeta.expandIcon"
        :size="14"
        class="mini-bar__chevron"
      />
    </button>

    <!-- 展开态：完整面板 -->
    <template v-else>
      <!-- 面板头部（拖拽把手：按住空白区可拖动面板） -->
      <div
        class="panel-header"
        @pointerdown="props.manager.startDrag($event)"
      >
        <!-- 弹窗标题："速记" -->
        <h3 class="panel-title">
          <IconWrapper
            name="quickNote"
            :size="14"
            class="panel-title__icon"
          />
          {{ i18n.title }}
        </h3>
        <div class="header-actions">
          <!-- 预设位置菜单 -->
          <div
            ref="menuWrapRef"
            class="position-menu-wrap"
          >
            <button
              class="qn-icon-btn"
              :title="i18n.position"
              @click="handleToggleMenu"
            >
              <IconWrapper
                name="layoutGrid"
                :size="12"
              />
            </button>
            <!-- 预设菜单项："居中/顶部/底部/左侧/右侧" -->
            <div
              v-if="menuOpen"
              class="position-menu"
            >
              <button
                v-for="p in QUICK_NOTE_POSITIONS"
                :key="p"
                class="position-menu__item"
                :class="{ 'position-menu__item--active': position === p }"
                @click="handleSelectPreset(p)"
              >
                {{ i18n[`position${p.charAt(0).toUpperCase()}${p.slice(1)}`] }}
              </button>
            </div>
          </div>
          <!-- 最小化按钮："最小化" -->
          <button
            class="qn-icon-btn"
            :title="i18n.minimize"
            @click="handleToggleMinimize"
          >
            <IconWrapper
              :name="minimizeMeta.collapseIcon"
              :size="12"
            />
          </button>
          <!-- 关闭按钮："关闭" -->
          <button
            class="qn-icon-btn"
            :title="i18n.close"
            @click="props.onClose?.()"
          >
            <IconWrapper
              name="close"
              :size="12"
            />
          </button>
        </div>
      </div>

      <!-- 「今天要处理的」聚焦区（今日到期/逾期任务 + 卡住项目标红） -->
      <TodayFocus
        :focus-todos="todayFocus"
        :blocked-projects="blockedProjects"
        :i18n="i18n"
      />

      <!-- Tab 导航栏（下划线式，激活态品牌蓝） -->
      <nav class="panel-tabs">
        <button
          v-for="tab in TABS"
          :key="tab.key"
          class="panel-tab"
          :class="{ 'panel-tab--active': activeTab === tab.key }"
          @click="activeTab = tab.key"
        >
          {{ i18n[tab.labelKey] }}
        </button>
      </nav>

      <!-- Tab 内容区（可滚动，右侧留滚动条呼吸空间） -->
      <div class="panel-body">
        <!-- 今天待办 Tab -->
        <TodoTab
          v-if="activeTab === 'todo'"
          :plugin="plugin"
          :i18n="i18n"
          :todo-list="todoList"
          :projects-api="projectsApi"
        />

        <!-- 灵感速记 Tab -->
        <InspirationTab
          v-else-if="activeTab === 'inspiration'"
          :plugin="plugin"
          :i18n="i18n"
          :inspirations="inspirations"
        />

        <!-- 项目跟进 Tab -->
        <ProjectTab
          v-else-if="activeTab === 'project'"
          :i18n="i18n"
          :projects-api="projectsApi"
        />

        <!-- 每周复盘 Tab -->
        <ReviewTab
          v-else
          :i18n="i18n"
          :review="review"
        />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * 速记 — 弹窗主面板（四大模块 Tab 导航壳层）
 * 顶部页头 + 「今天要处理的」聚焦区；Tab 切换待办/灵感/项目/复盘；
 * 四个 Tab 内容区由独立组件承载，此处仅负责壳层、composable 编排与定位/最小化逻辑；
 * onMounted 从 manager.storage 加载统一数据，位置变更/最小化直达 manager
 */
import type { Plugin } from "siyuan"
import type { QuickNoteManager } from "./index"
import type { QuickNotePlacement, QuickNotePosition } from "./types"
import { computed, onMounted, onUnmounted, ref, watch } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import TodayFocus from "./components/today/TodayFocus.vue"
import TodoTab from "./components/todo/TodoTab.vue"
import InspirationTab from "./components/inspiration/InspirationTab.vue"
import ProjectTab from "./components/project/ProjectTab.vue"
import ReviewTab from "./components/review/ReviewTab.vue"
import { useTodoList } from "./composables/useTodoList"
import { useInspirations } from "./composables/useInspirations"
import { useProjects } from "./composables/useProjects"
import { useWeeklyReview } from "./composables/useWeeklyReview"
import { POSITION_MINIMIZE_META, QUICK_NOTE_POSITIONS } from "./types"

const props = defineProps<{
  plugin: Plugin
  i18n: Record<string, string>
  manager: QuickNoteManager
  onClose?: () => void
}>()

// i18n 文案（script 内多处引用）
const i18n = props.i18n

// ==================== 四大 composable ====================
const todoList = useTodoList(props.manager.storage)
const inspirations = useInspirations(props.manager.storage)
// 关联待办列表经构造参数注入，供项目进度计算与删除时跨槽落盘
const projectsApi = useProjects(props.manager.storage, todoList.todos)
// 复盘为纯计算派生
const review = useWeeklyReview(todoList.todos, projectsApi.projects)

// ==================== Tab 导航 ====================
/** Tab 定义：key + i18n 标签键（<3 个 Tab 时平铺，此处 4 个按语义建 components 子目录） */
const TABS = [
  { key: "todo", labelKey: "tabTodo" },
  { key: "inspiration", labelKey: "tabInspiration" },
  { key: "project", labelKey: "tabProject" },
  { key: "review", labelKey: "tabReview" },
] as const

const activeTab = ref<(typeof TABS)[number]["key"]>("todo")

// ==================== 定位/最小化（沿用 Manager 机制） ====================
const position = ref<QuickNotePlacement>(props.manager.getPosition())
const minimized = ref(props.manager.isMinimized())
const minimizeMeta = computed(() => POSITION_MINIMIZE_META[position.value])

// 预设位置菜单开合
const menuOpen = ref(false)
const menuWrapRef = ref<HTMLElement | null>(null)

// ==================== 壳层数据访问 ====================
/** 未完成待办计数（最小化条徽标用） */
const pendingCount = todoList.pendingCount
/** 今日到期 + 逾期未完成任务（聚焦区用） */
const todayFocus = todoList.todayFocus
/** 卡住项目（聚焦区用） */
const blockedProjects = projectsApi.blockedProjects

// ==================== 定位/最小化事件 ====================
const syncPosition = () => {
  position.value = props.manager.getPosition()
}
const handleToggleMenu = () => {
  syncPosition()
  menuOpen.value = !menuOpen.value
}
const handleSelectPreset = (pos: QuickNotePosition) => {
  position.value = pos
  menuOpen.value = false
  props.manager.setPosition(pos)
}
const handleWindowClick = (e: MouseEvent) => {
  if (!menuOpen.value) return
  if (menuWrapRef.value?.contains(e.target as Node)) return
  menuOpen.value = false
}
const handleToggleMinimize = () => {
  syncPosition()
  minimized.value = !minimized.value
  props.manager.setMinimized(minimized.value)
}
const handleMaskMinimize = () => {
  if (minimized.value) return
  handleToggleMinimize()
}
const handleMiniBarClick = () => {
  if (props.manager.consumeDragClick()) return
  handleToggleMinimize()
}

// ==================== 生命周期 ====================
onMounted(async () => {
  await todoList.load()
  await inspirations.load()
  await projectsApi.load()
  syncPosition()
  minimized.value = props.manager.isMinimized()
  // 周起始时间周期刷新随复盘 Tab 启停（防止面板常驻跨周后复盘统计锁死，且避免非复盘 Tab 空转）
  window.addEventListener("click", handleWindowClick)
  window.addEventListener("quickNoteMaskMinimize", handleMaskMinimize)
})

// 复盘 Tab 激活时启动周起始校准，离开时停止
watch(activeTab, (tab) => {
  if (tab === "review") {
    review.startWatch()
  } else {
    review.stopWatch()
  }
})

onUnmounted(() => {
  review.stopWatch()
  window.removeEventListener("click", handleWindowClick)
  window.removeEventListener("quickNoteMaskMinimize", handleMaskMinimize)
})
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
