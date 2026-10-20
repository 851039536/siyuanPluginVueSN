<template>
  <div class="quick-note-panel">
    <!-- 最小化态：纯图标小按钮（GitHub 风格），按住可拖动，点击展开，tooltip："展开" -->
    <button
      v-if="minimized"
      class="mini-bar"
      :title="i18n.restore"
      :aria-label="i18n.restore"
      @pointerdown="props.manager.startDrag($event)"
      @click="handleMiniBarClick"
    >
      <IconWrapper
        name="quickNote"
        :size="16"
      />
      <!-- 未完成待办计数徽标（超过 99 折叠显示） -->
      <span
        v-if="pendingCount > 0"
        class="mini-bar__count"
        aria-hidden="true"
      >{{ pendingCount > 99 ? "99+" : pendingCount }}</span>
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
              :name="collapseIcon"
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
          :i18n="i18n"
          :todo-list="todoList"
          :projects-api="projectsApi"
          :polishing="polishing"
          :polish="polish"
          :confirm="confirmDialog"
        />

        <!-- 灵感速记 Tab -->
        <InspirationTab
          v-else-if="activeTab === 'inspiration'"
          :i18n="i18n"
          :inspirations="inspirations"
          :polishing="polishing"
          :polish="polish"
          :confirm="confirmDialog"
        />

        <!-- 项目跟进 Tab -->
        <ProjectTab
          v-else-if="activeTab === 'project'"
          :i18n="i18n"
          :projects-api="projectsApi"
          :confirm="confirmDialog"
        />

        <!-- 每周复盘 Tab -->
        <ReviewTab
          v-else
          :i18n="i18n"
          :review="review"
        />
      </div>

      <!-- 删除二次确认弹窗（三个 Tab 共用，状态由 index.vue 单实例持有） -->
      <ConfirmDialog
        :visible="confirmDialog.state.value.visible"
        :header="confirmDialog.state.value.header"
        :accept-label="confirmDialog.state.value.acceptLabel"
        :reject-label="confirmDialog.state.value.rejectLabel"
        accept-severity="danger"
        @confirm="confirmDialog.confirm"
        @cancel="confirmDialog.cancel"
        @update:visible="(v) => !v && confirmDialog.cancel()"
      />

      <!-- 右下角缩放把手（按住拖拽调整面板大小，tooltip："拖拽调整大小"） -->
      <div
        class="quick-note-resize-handle"
        :title="i18n.resize"
        @pointerdown="props.manager.startResize($event)"
      />
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
import type {
  QuickNotePlacement,
  QuickNotePosition,
} from "./types"
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import InspirationTab from "./components/inspiration/InspirationTab.vue"
import ProjectTab from "./components/project/ProjectTab.vue"
import ReviewTab from "./components/review/ReviewTab.vue"
import TodayFocus from "./components/today/TodayFocus.vue"
import TodoTab from "./components/todo/TodoTab.vue"
import { useAiPolish } from "./composables/useAiPolish"
import { useConfirmDialog } from "./composables/useConfirmDialog"
import { useInspirations } from "./composables/useInspirations"
import { useProjects } from "./composables/useProjects"
import { useTodoList } from "./composables/useTodoList"
import { useWeeklyReview } from "./composables/useWeeklyReview"
import {
  POSITION_COLLAPSE_ICONS,
  QUICK_NOTE_MASK_MINIMIZE_EVENT,
  QUICK_NOTE_POSITIONS,
  QUICK_NOTE_STATE_EVENT,
} from "./types"

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
// AI 润色：此处唯一实例，经 props 下传三个使用点（待办表单/灵感表单/灵感编辑态），
// 保证 polishing 并发锁跨入口生效（子组件各自实例会导致锁失效，见 AGENTS_ARCH.md § 禁止将逻辑下放给子组件）
const {
  polishing,
  polish,
} = useAiPolish(props.plugin)
// 删除二次确认：单实例持有，经 props 下传三个 Tab（替代各 Tab 的 window.confirm + 原生弹窗样式）
const confirmDialog = useConfirmDialog()

// ==================== Tab 导航 ====================
/** Tab 定义：key + i18n 标签键（<3 个 Tab 时平铺，此处 4 个按语义建 components 子目录） */
const TABS = [
  {
    key: "todo",
    labelKey: "tabTodo",
  },
  {
    key: "inspiration",
    labelKey: "tabInspiration",
  },
  {
    key: "project",
    labelKey: "tabProject",
  },
  {
    key: "review",
    labelKey: "tabReview",
  },
] as const

const activeTab = ref<(typeof TABS)[number]["key"]>("todo")

// ==================== 定位/最小化（沿用 Manager 机制） ====================
const position = ref<QuickNotePlacement>(props.manager.getPosition())
const minimized = ref(props.manager.isMinimized())
/** 头部收起按钮的方向图标（最小化态本身固定为纯图标小按钮） */
const collapseIcon = computed(() => POSITION_COLLAPSE_ICONS[position.value])

// 预设位置菜单开合
const menuOpen = ref(false)
const menuWrapRef = ref<HTMLElement | null>(null)

// ==================== 壳层数据访问 ====================
/** 未完成待办计数（最小化图标徽标用） */
const pendingCount = todoList.pendingCount
/** 今日到期 + 逾期未完成任务（聚焦区用） */
const todayFocus = todoList.todayFocus
/** 卡住项目（聚焦区用） */
const blockedProjects = projectsApi.blockedProjects

// ==================== 定位/最小化事件 ====================
const syncPosition = () => {
  position.value = props.manager.getPosition()
}
/**
 * 从 Manager 同步权威状态
 * 面板为 persistent 实例，reset / 初始化回放等外部路径改动 Manager 状态时，
 * 本地 ref 不会自动更新，必须经 quickNoteStateChange 事件拉回
 */
const syncFromManager = () => {
  position.value = props.manager.getPosition()
  minimized.value = props.manager.isMinimized()
  // 状态切换后预设菜单的锚点/可用性已变化，直接收起
  menuOpen.value = false
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
  menuOpen.value = false
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
  // 交互监听先于数据加载注册：初次 load 期间用户仍可能点遮罩/触发状态回放
  window.addEventListener("click", handleWindowClick)
  window.addEventListener(QUICK_NOTE_MASK_MINIMIZE_EVENT, handleMaskMinimize)
  window.addEventListener(QUICK_NOTE_STATE_EVENT, syncFromManager)
  await todoList.load()
  await inspirations.load()
  await projectsApi.load()
  // load 期间 Manager 状态可能已变化（例如 init 完成后的回放），统一再同步一次
  syncFromManager()
})

// 进入复盘 Tab 时校准周界基准（纯派生无定时器，防止面板常驻跨天后周界过期）
watch(activeTab, (tab) => {
  if (tab === "review") review.refreshNow()
  // 待办 Tab 同样校准日期基准，否则跨天后「今天/明天」分组与逾期红字停留在昨天
  if (tab === "todo") todoList.refreshNow()
})

onUnmounted(() => {
  window.removeEventListener("click", handleWindowClick)
  window.removeEventListener(QUICK_NOTE_MASK_MINIMIZE_EVENT, handleMaskMinimize)
  window.removeEventListener(QUICK_NOTE_STATE_EVENT, syncFromManager)
})
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
