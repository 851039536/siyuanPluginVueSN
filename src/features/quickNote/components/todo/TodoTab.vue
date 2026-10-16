<template>
  <section class="panel-section">
    <!-- 待办新增/编辑表单 -->
    <TodoForm
      :projects="projects"
      :editing-todo="editingTodo"
      :i18n="i18n"
      :polishing="polishing"
      :polish="polish"
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
            :overdue="todoList.isOverdue(todo)"
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
</template>

<script setup lang="ts">
import type { PolishFn } from "../../composables/useAiPolish"
/**
 * 速记功能 — 待办 Tab
 * 待办新增/编辑表单 + 按日期分组列表 + 已完成列表；持有编辑中待办状态，
 * CRUD 直达 todoList composable，关联项目名经 projectsApi 解析；
 * AI 润色函数由父层注入并透传给 TodoForm（子组件不自行创建 composable）
 */
import type {
  TodoItem as TodoItemType,
  TodoSubmitPayload,
} from "../../types"
import {
  computed,
  ref,
} from "vue"
import { useProjects } from "../../composables/useProjects"
import { useTodoList } from "../../composables/useTodoList"
import TodoForm from "./TodoForm.vue"
import TodoItem from "./TodoItem.vue"

type TodoListApi = ReturnType<typeof useTodoList>
type ProjectsApi = ReturnType<typeof useProjects>

const props = defineProps<{
  i18n: Record<string, string>
  todoList: TodoListApi
  projectsApi: ProjectsApi
  /** AI 润色进行中（透传 TodoForm） */
  polishing: boolean
  /** AI 润色函数（透传 TodoForm） */
  polish: PolishFn
}>()

const todoList = props.todoList
const projectsApi = props.projectsApi

/** 可关联项目列表（供 TodoForm 下拉选择） */
const projects = projectsApi.projects

/** 编辑中的待办（null 为新增模式） */
const editingTodo = ref<TodoItemType | null>(null)

/** 按日期分组的未完成任务（今天/明天/本周/更远） */
const todoGroups = computed(() => [
  {
    key: "today",
    list: todoList.groupedPending.value.today,
  },
  {
    key: "tomorrow",
    list: todoList.groupedPending.value.tomorrow,
  },
  {
    key: "week",
    list: todoList.groupedPending.value.week,
  },
  {
    key: "future",
    list: todoList.groupedPending.value.future,
  },
])

/** 分组标题 i18n 键 */
const groupLabelKey = (key: string) => `group${key.charAt(0).toUpperCase()}${key.slice(1)}`

/** 已完成待办（按完成时间倒序） */
const doneTodos = todoList.doneTodos

/** 关联项目名（无则返回空字符串） */
const projectNameOf = (todo: TodoItemType) =>
  projectsApi.projects.value.find((p) => p.id === todo.projectId)?.name ?? ""

/** 删除待办（带确认） */
const handleTodoRemove = (id: string) => {
  if (!window.confirm(props.i18n.deleteConfirm)) return
  todoList.remove(id)
}

/** 开始编辑待办（回填表单） */
const startTodoEdit = (todo: TodoItemType) => {
  editingTodo.value = todo
}

/** 提交待办（分发新增/更新） */
const handleTodoSubmit = (payload: TodoSubmitPayload) => {
  if (payload.id) {
    const {
      id,
      ...patch
    } = payload
    todoList.update(id, patch)
    editingTodo.value = null
  } else {
    todoList.add(payload)
  }
}

/** 取消编辑（清空回填，回到新增模式） */
const handleTodoCancel = () => {
  editingTodo.value = null
}
</script>

<style scoped lang="scss">
@use "../../styles/index.scss";
</style>
