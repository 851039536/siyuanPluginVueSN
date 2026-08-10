<template>
  <div class="qn-today-focus">
    <div class="qn-today-focus__header">
      <!-- 区块标题："今天要处理的" -->
      <span class="qn-today-focus__title">
        <IconWrapper
          name="alertCircle"
          :size="12"
        />
        {{ i18n.todayFocus }}
      </span>
      <!-- 计数徽标 -->
      <span class="qn-today-focus__count">{{ totalCount }}</span>
    </div>

    <!-- 无紧急事项时的绿色柔和提示 -->
    <div
      v-if="totalCount === 0"
      class="qn-today-focus__empty"
    >
      <IconWrapper
        name="checkCircle"
        :size="12"
      />
      {{ i18n.todayFocusEmpty }}
    </div>

    <!-- 逾期任务 + 卡住项目列表 -->
    <ul
      v-else
      class="qn-today-focus__list"
    >
      <!-- 逾期未完成的任务 -->
      <li
        v-for="todo in overdueTodos"
        :key="`t-${todo.id}`"
        class="qn-today-focus__item qn-today-focus__item--todo"
      >
        <IconWrapper
          name="alertCircle"
          :size="11"
        />
        <span class="qn-today-focus__text">{{ todo.content }}</span>
        <span
          v-if="todo.dueDate"
          class="qn-today-focus__due"
        >{{ todo.dueDate }}</span>
      </li>
      <!-- 卡住的项目 -->
      <li
        v-for="project in blockedProjects"
        :key="`p-${project.id}`"
        class="qn-today-focus__item qn-today-focus__item--project"
      >
        <IconWrapper
          name="folderAlert"
          :size="11"
        />
        <span class="qn-today-focus__text">{{ project.name }}</span>
        <span
          v-if="project.blockers"
          class="qn-today-focus__blocker"
        >{{ project.blockers }}</span>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
/**
 * 速记功能 — 「今天要处理的」聚焦区
 * 顶部固定展示逾期未完成任务与卡住项目，红色文字警示；
 * 数据由父层经 props 注入（逾期待办 + 卡住项目），无紧急事项时显示绿色柔和提示
 */
import type { ProjectItem, TodoItem } from "../../types"
import { computed } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"

const props = defineProps<{
  /** 逾期未完成任务（已按优先级排序） */
  overdueTodos: TodoItem[]
  /** 卡住项目 */
  blockedProjects: ProjectItem[]
  i18n: Record<string, string>
}>()

/** 总条数 = 逾期任务 + 卡住项目 */
const totalCount = computed(() => props.overdueTodos.length + props.blockedProjects.length)
</script>

<style scoped lang="scss">
@use "../../styles/TodayFocus.scss";
@use "../../styles/index.scss";
</style>
