<template>
  <div class="qn-todo-form">
    <div class="qn-todo-form__row">
      <!-- 输入框占位："输入待办事项，Enter 快速添加" -->
      <input
        v-model="content"
        class="vp-input qn-todo-form__input"
        :placeholder="i18n.todoPlaceholder"
        @keydown.enter.prevent="handleAdd"
      />
      <!-- 添加按钮："添加" -->
      <button
        class="qn-todo-form__add-btn"
        :disabled="!content.trim()"
        @click="handleAdd"
      >
        <IconWrapper
          name="plus"
          :size="12"
        />
      </button>
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
 * 速记功能 — 待办新增表单
 * 自包含表单状态：优先级（紧急/高/中/低）、截止日期、关联项目下拉；
 * 提交时仅 emit(add) 携带结构化载荷，存储由父 composable 统一处理
 */
import type { ProjectItem, TodoItem } from "../../types"
import { ref } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { PRIORITY_META, TODO_PRIORITIES } from "../../types"

const props = defineProps<{
  /** 可关联的项目列表（供下拉选择，空则不显示可选项目） */
  projects: ProjectItem[]
  i18n: Record<string, string>
}>()

const emit = defineEmits<{
  add: [payload: { content: string, priority: TodoItem["priority"], dueDate: string | null, projectId: string | null }]
}>()

// 表单本地状态
const content = ref("")
const priority = ref<TodoItem["priority"]>("medium")
const dueDate = ref<string>("")
const projectId = ref<string>("")

/** 提交：剥离空日期为 null，emit 结构化载荷并复位表单 */
const handleAdd = () => {
  if (!content.value.trim()) return
  emit("add", {
    content: content.value,
    priority: priority.value,
    dueDate: dueDate.value || null,
    projectId: projectId.value || null,
  })
  content.value = ""
  dueDate.value = ""
}
</script>

<style scoped lang="scss">
@use "../../styles/TodoForm.scss";
@use "../../styles/index.scss";
</style>
