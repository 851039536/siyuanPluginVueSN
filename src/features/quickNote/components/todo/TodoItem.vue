<template>
  <div
    class="qn-todo-item"
    :class="{
      'qn-todo-item--done': todo.done,
      'qn-todo-item--overdue': overdue,
    }"
  >
    <!-- 优先级色条（逾期变红，完成置灰） -->
    <span
      class="qn-todo-item__bar"
      :style="{ background: overdue ? '#ef4444' : priorityMeta.color }"
    />

    <!-- 完成勾选框（悬浮提示："标记完成"/"标记待完成"） -->
    <button
      class="qn-todo-item__check"
      :title="todo.done ? i18n.markPending : i18n.markDone"
      @click="emit('toggleDone')"
    >
      <IconWrapper
        :name="todo.done ? 'check' : 'circleOutline'"
        :size="14"
      />
    </button>

    <div class="qn-todo-item__body">
      <!-- 待办内容 -->
      <div class="qn-todo-item__content">{{ todo.content }}</div>
      <!-- 元信息行：截止日期 + 优先级标签 + 关联项目 + 顺延次数 -->
      <div class="qn-todo-item__meta">
        <!-- 截止日期（逾期红色警示，无日期不显示） -->
        <span
          v-if="todo.dueDate"
          class="qn-todo-item__due"
          :class="{ 'qn-todo-item__due--overdue': overdue }"
        >
          <IconWrapper
            name="calendar"
            :size="10"
          />
          {{ todo.dueDate }}
        </span>
        <!-- 顺延次数标记 -->
        <span
          v-if="todo.rolloverCount > 0"
          class="qn-todo-item__rollover"
        >
          <IconWrapper
            name="repeat"
            :size="10"
          />
          {{ i18n.rolloverCount }} {{ todo.rolloverCount }}
        </span>
        <!-- 关联项目徽章 -->
        <span
          v-if="projectName"
          class="qn-todo-item__project"
        >
          <IconWrapper
            name="folder"
            :size="10"
          />
          {{ projectName }}
        </span>
        <!-- 优先级标签 -->
        <span
          class="qn-todo-item__priority"
          :style="{ color: priorityMeta.color }"
        >{{ i18n[priorityMeta.labelKey] }}</span>
      </div>
    </div>

    <div class="qn-todo-item__actions">
      <!-- 逾期未完成时显示"顺延到明天"按钮 -->
      <button
        v-if="overdue"
        class="qn-todo-item__rollover-btn"
        :title="i18n.rolloverToTomorrow"
        @click="emit('rollover')"
      >
        <IconWrapper
          name="chevronRight"
          :size="12"
        />
        {{ i18n.rolloverToTomorrow }}
      </button>
      <!-- 编辑按钮（回填表单由父层 editingTodo 分发） -->
      <button
        class="qn-icon-btn"
        :title="i18n.edit"
        @click="emit('edit')"
      >
        <IconWrapper
          name="edit"
          :size="12"
        />
      </button>
      <!-- 删除按钮（带确认由父层处理） -->
      <button
        class="qn-icon-btn qn-icon-btn--danger"
        :title="i18n.delete"
        @click="emit('remove')"
      >
        <IconWrapper
          name="delete"
          :size="12"
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 速记功能 — 待办单条目组件
 * 勾选/顺延/编辑/删除仅 emit 事件（存储与编辑状态由父层统一处理）；
 * 优先级色条与逾期红色警示由 props 派生，关联项目名由父层注入
 */
import type { TodoItem } from "../../types"
import { computed } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { PRIORITY_META } from "../../types"

const props = defineProps<{
  todo: TodoItem
  /** 是否已逾期（父层 isOverdue 判定结果） */
  overdue: boolean
  /** 关联项目名称（未关联传空字符串） */
  projectName: string
  i18n: Record<string, string>
}>()

const emit = defineEmits<{
  toggleDone: []
  rollover: []
  edit: []
  remove: []
}>()

/** 当前待办的优先级元数据（色条颜色 + 标签 i18n 键） */
const priorityMeta = computed(() => PRIORITY_META[props.todo.priority])
</script>

<style scoped lang="scss">
@use "../../styles/TodoItem.scss";
@use "../../styles/index.scss";
</style>
