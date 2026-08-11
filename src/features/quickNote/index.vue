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

      <!-- 「今天要处理的」聚焦区（逾期任务 + 卡住项目标红） -->
      <TodayFocus
        :overdue-todos="overdueTodos"
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
        <section
          v-if="activeTab === 'todo'"
          class="panel-section"
        >
          <TodoForm
            :projects="projects"
            :plugin="plugin"
            :editing-todo="editingTodo"
            :i18n="i18n"
            @submit="handleTodoSubmit"
            @cancel="handleTodoCancel"
          />
          <div class="todo-group-list">
            <!-- 按日期分组的未完成任务 -->
            <template v-for="group in todoGroups">
              <div
                v-if="group.list.length > 0"
                :key="group.key"
                class="todo-group"
              >
                <!-- 分组标题 -->
                <div class="todo-group__label">
                  {{ i18n[groupLabelKey(group.key)] }}
                  <span class="todo-group__count">{{ group.list.length }}</span>
                </div>
                <TodoItem
                  v-for="todo in group.list"
                  :key="todo.id"
                  :todo="todo"
                  :overdue="isOverdue(todo)"
                  :project-name="projectNameOf(todo)"
                  :i18n="i18n"
                  @toggle-done="todoList.toggleDone(todo.id)"
                  @rollover="todoList.rolloverToTomorrow(todo.id)"
                  @edit="startTodoEdit(todo)"
                  @remove="handleTodoRemove(todo.id)"
                />
              </div>
            </template>
            <!-- 已完成待办 -->
            <div
              v-if="doneTodos.length > 0"
              class="todo-group"
            >
              <!-- 分组标题："已完成" -->
              <div class="todo-group__label">
                {{ i18n.done }}
                <span class="todo-group__count">{{ doneTodos.length }}</span>
              </div>
              <TodoItem
                v-for="todo in doneTodos"
                :key="todo.id"
                :todo="todo"
                :overdue="false"
                :project-name="projectNameOf(todo)"
                :i18n="i18n"
                @toggle-done="todoList.toggleDone(todo.id)"
                @rollover="todoList.rolloverToTomorrow(todo.id)"
                @edit="startTodoEdit(todo)"
                @remove="handleTodoRemove(todo.id)"
              />
            </div>
          </div>
        </section>

        <!-- 灵感速记 Tab -->
        <section
          v-else-if="activeTab === 'inspiration'"
          class="panel-section"
        >
          <InspirationForm
            :plugin="plugin"
            :all-tags="allTags"
            :active-tag="activeTag"
            :i18n="i18n"
            @add="inspirations.add"
            @select-tag="handleSelectTag"
          />
          <div class="insp-list">
            <div
              v-if="filteredInspirations.length === 0"
              class="insp-list__empty"
            >{{ i18n.inspEmpty }}</div>
            <InspirationItem
              v-for="item in filteredInspirations"
              :key="item.id"
              :item="item"
              :plugin="plugin"
              :i18n="i18n"
              @update="(c, t) => inspirations.update(item.id, c, t)"
              @remove="handleInspRemove(item.id)"
              @filter-tag="handleSelectTag"
            />
          </div>
        </section>

        <!-- 项目跟进 Tab -->
        <section
          v-else-if="activeTab === 'project'"
          class="panel-section"
        >
          <ProjectForm
            :i18n="i18n"
            :editing-project="editingProject"
            @submit="handleProjectSubmit"
            @cancel="handleCancelEdit"
          />
          <div class="project-list">
            <div
              v-if="visibleProjects.length === 0"
              class="project-list__empty"
            >{{ i18n.projectEmpty }}</div>
            <ProjectItem
              v-for="project in visibleProjects"
              :key="project.id"
              :project="project"
              :linked-todos="linkedTodosOf(project.id)"
              :progress="projectProgressOf(project.id)"
              :i18n="i18n"
              @edit="startEdit(project)"
              @remove="handleProjectRemove(project.id)"
            />
          </div>
        </section>

        <!-- 每周复盘 Tab -->
        <section
          v-else
          class="panel-section"
        >
          <WeeklyReview
            :week-total="weekTotal"
            :priority-distribution="priorityDistribution"
            :project-effort="projectEffort"
            :block-summary="blockSummary"
            :i18n="i18n"
          />
        </section>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * 速记 — 弹窗主面板（四大模块 Tab 导航壳）
 * 顶部页头渐变配图 + 「今天要处理的」聚焦区；Tab 切换待办/灵感/项目/复盘；
 * 自包含数据流：onMounted 从 manager.storage 加载统一数据，四个 composable 直达存储，
 * 位置变更/最小化直达 manager
 */
import type { Plugin } from "siyuan"
import type { QuickNoteManager } from "./index"
import type { QuickNotePlacement, QuickNotePosition, ProjectItem as ProjectItemType, TodoItem as TodoItemType } from "./types"
import { computed, onMounted, onUnmounted, ref, watch } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import TodayFocus from "./components/today/TodayFocus.vue"
import TodoForm from "./components/todo/TodoForm.vue"
import TodoItem from "./components/todo/TodoItem.vue"
import InspirationForm from "./components/inspiration/InspirationForm.vue"
import InspirationItem from "./components/inspiration/InspirationItem.vue"
import ProjectForm from "./components/project/ProjectForm.vue"
import ProjectItem from "./components/project/ProjectItem.vue"
import WeeklyReview from "./components/review/WeeklyReview.vue"
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
const projectsApi = useProjects(props.manager.storage)
// 注入关联待办列表给项目进度计算
projectsApi.setTodos(todoList.todos)

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

// ==================== 待办数据访问 ====================
const pendingCount = todoList.pendingCount
const overdueTodos = todoList.overdueTodos
const doneTodos = todoList.doneTodos
const isOverdue = todoList.isOverdue

/** 按日期分组的未完成任务（今天/明天/本周/更远） */
const todoGroups = computed(() => [
  { key: "today", list: todoList.groupedPending.value.today },
  { key: "tomorrow", list: todoList.groupedPending.value.tomorrow },
  { key: "week", list: todoList.groupedPending.value.week },
  { key: "future", list: todoList.groupedPending.value.future },
])

/** 分组标题 i18n 键 */
const groupLabelKey = (key: string) => `group${key.charAt(0).toUpperCase()}${key.slice(1)}`

/** 关联项目名（无则返回空字符串） */
const projectNameOf = (todo: TodoItemType) =>
  projectsApi.projects.value.find((p) => p.id === todo.projectId)?.name ?? ""

/** 编辑中的待办（null 为新增模式） */
const editingTodo = ref<TodoItemType | null>(null)

// ==================== 灵感数据访问 ====================
const allTags = inspirations.allTags
const activeTag = inspirations.activeTag
const filteredInspirations = inspirations.filteredInspirations

// ==================== 项目数据访问 ====================
const projects = projectsApi.projects
const visibleProjects = projectsApi.visibleProjects
const blockedProjects = projectsApi.blockedProjects
const linkedTodosOf = (id: string) => projectsApi.todosOf(id)
const projectProgressOf = (id: string) => projectsApi.progressOf(id)

/** 编辑中的项目（null 为新增模式） */
const editingProject = ref<ProjectItemType | null>(null)

// ==================== 复盘数据访问 ====================
const weekTotal = review.weekTotal
const priorityDistribution = review.priorityDistribution
const projectEffort = review.projectEffort
const blockSummary = review.blockSummary

// ==================== 事件处理 ====================
const handleTodoRemove = (id: string) => {
  if (!window.confirm(i18n.deleteConfirm)) return
  todoList.remove(id)
}

/** 开始编辑待办（回填表单） */
const startTodoEdit = (todo: TodoItemType) => {
  editingTodo.value = todo
}

/** 提交待办（分发新增/更新） */
const handleTodoSubmit = (payload: {
  id?: string
  content: string
  priority: TodoItemType["priority"]
  dueDate: string | null
  projectId: string | null
}) => {
  if (payload.id) {
    const { id, ...patch } = payload
    todoList.update(id, patch)
    editingTodo.value = null
  } else {
    todoList.add(payload)
  }
}

/** 取消编辑（清空待办回填，回到新增模式） */
const handleTodoCancel = () => {
  editingTodo.value = null
}

const handleInspRemove = (id: string) => {
  if (!window.confirm(i18n.deleteConfirm)) return
  inspirations.remove(id)
}
const handleSelectTag = (tag: string | null) => {
  inspirations.activeTag.value = tag
}

const handleProjectRemove = (id: string) => {
  if (!window.confirm(i18n.deleteConfirm)) return
  projectsApi.remove(id)
}

/** 开始编辑项目（回填表单） */
const startEdit = (project: ProjectItemType) => {
  editingProject.value = project
}

/** 提交项目（分发新增/更新） */
const handleProjectSubmit = (payload: {
  id?: string
  name: string
  status: ProjectItemType["status"]
  currentStep: string
  nextStep: string
  blockers: string
}) => {
  if (payload.id) {
    const { id, ...patch } = payload
    projectsApi.update(id, patch)
    editingProject.value = null
  } else {
    projectsApi.add(payload)
  }
}

/** 取消编辑（清空项目回填，回到新增模式） */
const handleCancelEdit = () => {
  editingProject.value = null
}

/** 切换 Tab 时自动清空编辑状态（防止状态泄漏导致误编辑已有条目） */
watch(activeTab, () => {
  editingProject.value = null
  editingTodo.value = null
})

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
  // 启动周起始时间周期刷新（防止面板常驻跨周后复盘统计锁死）
  review.startWatch()
  window.addEventListener("click", handleWindowClick)
  window.addEventListener("quickNoteMaskMinimize", handleMaskMinimize)
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
