<template>
  <div
    class="qn-proj-item"
    :class="{ 'qn-proj-item--blocked': project.status === 'blocked' }"
  >
    <!-- 卡片头部：项目名 + 状态徽章 + 操作 -->
    <div class="qn-proj-item__header">
      <div class="qn-proj-item__title-group">
        <span class="qn-proj-item__name">{{ project.name }}</span>
        <!-- 状态徽章 -->
        <span
          class="qn-proj-item__status"
          :style="{ color: statusMeta.color, borderColor: statusMeta.color }"
        >{{ i18n[statusMeta.labelKey] }}</span>
      </div>
      <div class="qn-proj-item__actions">
        <!-- 编辑按钮 -->
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
        <!-- 删除按钮 -->
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

    <!-- 进度信息（当前步 → 下一步，箭头式流程感） -->
    <div class="qn-proj-item__flow">
      <div class="qn-proj-item__flow-col">
        <!-- 辅助文字："当前" -->
        <span class="qn-proj-item__flow-label">{{ i18n.currentStep }}</span>
        <span class="qn-proj-item__flow-text">{{ project.currentStep || "—" }}</span>
      </div>
      <IconWrapper
        name="arrowRight"
        :size="12"
        class="qn-proj-item__flow-arrow"
      />
      <div class="qn-proj-item__flow-col">
        <!-- 辅助文字："下一步" -->
        <span class="qn-proj-item__flow-label">{{ i18n.nextStep }}</span>
        <span class="qn-proj-item__flow-text">{{ project.nextStep || "—" }}</span>
      </div>
    </div>

    <!-- 卡点（仅卡住态显示） -->
    <div
      v-if="project.blockers"
      class="qn-proj-item__blocker"
    >
      <IconWrapper
        name="alertCircle"
        :size="11"
      />
      <span>{{ i18n.blockerLabel }}: {{ project.blockers }}</span>
    </div>

    <!-- 关联待办进度条 + 折叠列表 -->
    <div class="qn-proj-item__todos">
      <div class="qn-proj-item__progress-row">
        <!-- 进度条（蓝绿渐变填充，transition width 0.3s 为唯一例外） -->
        <div class="qn-proj-item__progress-track">
          <div
            class="qn-proj-item__progress-fill"
            :style="{ width: `${progressPercent}%` }"
          />
        </div>
        <!-- 完成数/总数 -->
        <span class="qn-proj-item__progress-text">{{ progress.done }}/{{ progress.total }}</span>
      </div>
      <!-- 关联待办折叠切换 -->
      <button
        v-if="progress.total > 0"
        class="qn-proj-item__toggle"
        @click="showTodos = !showTodos"
      >
        <IconWrapper
          :name="showTodos ? 'chevronUp' : 'chevronDown'"
          :size="10"
        />
        {{ showTodos ? i18n.hideTodos : i18n.showTodos }}
      </button>
      <!-- 关联待办列表（折叠显示） -->
      <ul
        v-if="showTodos"
        class="qn-proj-item__todo-list"
      >
        <li
          v-for="todo in linkedTodos"
          :key="todo.id"
          class="qn-proj-item__todo"
          :class="{ 'qn-proj-item__todo--done': todo.done }"
        >
          <IconWrapper
            :name="todo.done ? 'check' : 'circleOutline'"
            :size="10"
          />
          {{ todo.content }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 速记功能 — 项目卡片组件
 * 展示项目状态徽章、进度流程、卡点警示、关联待办进度条与折叠列表；
 * 编辑/删除仅 emit 事件，关联待办与进度由父层经 props 注入
 */
import type { ProjectItem, TodoItem } from "../../types"
import { computed, ref } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { STATUS_META } from "../../types"

const props = defineProps<{
  project: ProjectItem
  /** 关联待办列表 */
  linkedTodos: TodoItem[]
  /** 完成进度（已完成数/总数） */
  progress: { done: number, total: number }
  i18n: Record<string, string>
}>()

const emit = defineEmits<{
  edit: []
  remove: []
}>()

const showTodos = ref(false)

/** 当前项目状态元数据（标签 i18n 键 + 语义色） */
const statusMeta = computed(() => STATUS_META[props.project.status])

/** 进度百分比（无待办时按 0%） */
const progressPercent = computed(() =>
  props.progress.total === 0 ? 0 : Math.round((props.progress.done / props.progress.total) * 100),
)
</script>

<style scoped lang="scss">
@use "../../styles/ProjectItem.scss";
@use "../../styles/index.scss";
</style>
