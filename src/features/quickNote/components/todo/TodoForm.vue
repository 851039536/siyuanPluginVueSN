<template>
  <div class="qn-todo-form">
    <div class="qn-todo-form__row">
      <!-- 输入框占位："输入待办事项，Enter 快速添加" -->
      <input
        v-model="content"
        class="vp-input qn-todo-form__input"
        :placeholder="i18n.todoPlaceholder"
        @keydown.enter.prevent="handleSubmit"
      />
      <!-- AI 润色按钮（新增/编辑模式均可用，流式回填内容） -->
      <button
        class="qn-todo-form__icon-btn"
        :disabled="!content.trim() || polishing"
        :title="i18n.polish"
        @click="handlePolish"
      >
        <IconWrapper
          name="sparkles"
          :size="12"
        />
      </button>
      <!-- 编辑模式：取消 + 保存；新增模式：添加 -->
      <template v-if="editingTodo">
        <!-- 取消按钮 -->
        <button
          class="qn-todo-form__cancel-btn"
          @click="emit('cancel')"
        >{{ i18n.cancel }}</button>
        <!-- 保存按钮 -->
        <button
          class="qn-todo-form__save-btn"
          :disabled="!content.trim()"
          @click="handleSubmit"
        >{{ i18n.save }}</button>
      </template>
      <template v-else>
        <!-- 添加按钮："添加" -->
        <button
          class="qn-todo-form__add-btn"
          :disabled="!content.trim()"
          @click="handleSubmit"
        >
          <IconWrapper
            name="plus"
            :size="12"
          />
        </button>
      </template>
    </div>

    <div class="qn-todo-form__row">
      <!-- 优先级选择（四个圆形色块） -->
      <div class="qn-todo-form__priorities">
        <button
          v-for="p in TODO_PRIORITIES"
          :key="p"
          class="qn-todo-form__prio"
          :class="{ 'qn-todo-form__prio--active': priority === p }"
          :style="{ background: PRIORITY_META[p].color }"
          :title="i18n[PRIORITY_META[p].labelKey]"
          @click="priority = p"
        />
      </div>

      <!-- 截止日期 -->
      <label class="qn-todo-form__date">
        <IconWrapper
          name="calendar"
          :size="12"
        />
        <input
          v-model="dueDate"
          type="date"
          class="vp-input qn-todo-form__date-input"
        />
      </label>

      <!-- 关联项目下拉 -->
      <select
        v-model="projectId"
        class="vp-input qn-todo-form__project"
        :title="i18n.linkProject"
      >
        <option value="">
          {{ i18n.noProject }}
        </option>
        <option
          v-for="proj in projects"
          :key="proj.id"
          :value="proj.id"
        >{{ proj.name }}</option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 速记功能 — 待办新增/编辑表单（共用组件）
 * 自包含表单状态：优先级（紧急/高/中/低）、截止日期、关联项目下拉；
 * 编辑模式通过 editingTodo prop 回填，保存 emit(submit + id)、取消 emit(cancel)；
 * AI 润色走 useAiPolish 流式回填内容，新增/编辑模式均可使用
 */
import type { Plugin } from "siyuan"
import type { ProjectItem, TodoItem } from "../../types"
import { ref, watch } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { PRIORITY_META, TODO_PRIORITIES } from "../../types"
import { useAiPolish } from "../../composables/useAiPolish"
import { polishText } from "../../utils"

const props = defineProps<{
  plugin: Plugin
  /** 可关联的项目列表（供下拉选择，空则不显示可选项目） */
  projects: ProjectItem[]
  /** 编辑中的待办（非 null 时为编辑模式，null/undefined 为新增模式） */
  editingTodo?: TodoItem | null
  i18n: Record<string, string>
}>()

const emit = defineEmits<{
  submit: [payload: {
    /** 编辑模式时携带待办 id */
    id?: string
    content: string
    priority: TodoItem["priority"]
    dueDate: string | null
    projectId: string | null
  }]
  cancel: []
}>()

// 表单本地状态
const content = ref("")
const priority = ref<TodoItem["priority"]>("medium")
const dueDate = ref<string>("")
const projectId = ref<string>("")

/** 编辑待办变化时回填/清空表单（immediate 确保首次渲染时也不遗漏） */
watch(
  () => props.editingTodo,
  (todo) => {
    if (todo) {
      content.value = todo.content
      priority.value = todo.priority
      dueDate.value = todo.dueDate ?? ""
      projectId.value = todo.projectId ?? ""
    } else {
      content.value = ""
      priority.value = "medium"
      dueDate.value = ""
      projectId.value = ""
    }
  },
  { immediate: true },
)

// AI 润色：新增/编辑共用实例，润色结果流式回填内容草稿（由用户确认后保存）
const { polishing, polish } = useAiPolish(props.plugin)

/** AI 润色草稿：缓存原稿 → 清空后流式回填 → 失败恢复原稿并提示（复用共享辅助函数） */
const handlePolish = async () => {
  if (polishing.value) return
  if (!content.value.trim()) return
  await polishText(polish, content, content.value, props.i18n)
}

/** 提交：编辑模式带 id 提交（不清空，由父清空 editingTodo 触发 watch 复位），新增模式提交后清空 */
const handleSubmit = () => {
  if (!content.value.trim()) return
  const payload: {
    id?: string
    content: string
    priority: TodoItem["priority"]
    dueDate: string | null
    projectId: string | null
  } = {
    content: content.value,
    priority: priority.value,
    dueDate: dueDate.value || null,
    projectId: projectId.value || null,
  }
  if (props.editingTodo) {
    payload.id = props.editingTodo.id
  }
  emit("submit", payload)
  if (!props.editingTodo) {
    // 新增模式：提交后立即清空表单
    content.value = ""
    dueDate.value = ""
    projectId.value = ""
  }
}
</script>

<style scoped lang="scss">
@use "../../styles/TodoForm.scss";
@use "../../styles/index.scss";
</style>
