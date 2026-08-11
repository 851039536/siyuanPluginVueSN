<template>
  <div class="qn-proj-form">
    <!-- 名称 + 状态 -->
    <div class="qn-proj-form__row">
      <input
        v-model="name"
        class="vp-input qn-proj-form__name"
        :placeholder="i18n.projNamePlaceholder"
      />
      <select
        v-model="status"
        class="vp-input qn-proj-form__status"
      >
        <option
          v-for="s in PROJECT_STATUSES"
          :key="s"
          :value="s"
        >{{ i18n[STATUS_META[s].labelKey] }}</option>
      </select>
    </div>
    <!-- 当前进度 -->
    <input
      v-model="currentStep"
      class="vp-input qn-proj-form__field"
      :placeholder="i18n.currentStepPlaceholder"
    />
    <!-- 下一步 -->
    <input
      v-model="nextStep"
      class="vp-input qn-proj-form__field"
      :placeholder="i18n.nextStepPlaceholder"
    />
    <!-- 卡点 -->
    <input
      v-model="blockers"
      class="vp-input qn-proj-form__field"
      :placeholder="i18n.blockerPlaceholder"
    />
    <!-- 提交按钮区（编辑模式：保存 + 取消；新增模式：添加项目） -->
    <div class="qn-proj-form__actions">
      <template v-if="editingProject">
        <!-- 取消按钮 -->
        <button
          class="qn-proj-form__cancel-btn"
          @click="emit('cancel')"
        >{{ i18n.cancel }}</button>
        <!-- 保存按钮（编辑模式） -->
        <button
          class="qn-proj-form__save-btn"
          :disabled="!name.trim()"
          @click="handleSubmit"
        >{{ i18n.save }}</button>
      </template>
      <template v-else>
        <!-- 添加项目按钮（新增模式） -->
        <button
          class="qn-proj-form__add-btn"
          :disabled="!name.trim()"
          @click="handleSubmit"
        >
          <IconWrapper
            name="plus"
            :size="12"
          />
          {{ i18n.addProject }}
        </button>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 速记功能 — 项目新增/编辑表单（共用组件）
 * 自包含表单状态：名称、状态（进行中/已完成/卡住）、当前进度、下一步、卡点；
 * 新增模式：提交后清空表单；编辑模式：通过 editingProject prop 回填，
 * 保存 emit(submit + id)、取消 emit(cancel)，表单由 watch(editingProject) 自动复位
 */
import type { ProjectItem } from "../../types"
import { ref, watch } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { PROJECT_STATUSES, STATUS_META } from "../../types"

const props = defineProps<{
  i18n: Record<string, string>
  /** 编辑中的项目（非 null 时为编辑模式，null/undefined 为新增模式） */
  editingProject?: ProjectItem | null
}>()

const emit = defineEmits<{
  submit: [payload: {
    /** 编辑模式时携带项目 id */
    id?: string
    name: string
    status: ProjectItem["status"]
    currentStep: string
    nextStep: string
    blockers: string
  }]
  cancel: []
}>()

// 表单本地状态
const name = ref("")
const status = ref<ProjectItem["status"]>("active")
const currentStep = ref("")
const nextStep = ref("")
const blockers = ref("")

/** 编辑项目变化时回填/清空表单（immediate 确保首次渲染时也不遗漏） */
watch(
  () => props.editingProject,
  (p) => {
    if (p) {
      name.value = p.name
      status.value = p.status
      currentStep.value = p.currentStep
      nextStep.value = p.nextStep
      blockers.value = p.blockers
    } else {
      name.value = ""
      status.value = "active"
      currentStep.value = ""
      nextStep.value = ""
      blockers.value = ""
    }
  },
  { immediate: true },
)

/** 提交：编辑模式带 id 提交（不清空，由父清空 editingProject 触发 watch 复位），新增模式提交后清空 */
const handleSubmit = () => {
  if (!name.value.trim()) return
  const payload: {
    id?: string
    name: string
    status: ProjectItem["status"]
    currentStep: string
    nextStep: string
    blockers: string
  } = {
    name: name.value,
    status: status.value,
    currentStep: currentStep.value,
    nextStep: nextStep.value,
    blockers: blockers.value,
  }
  if (props.editingProject) {
    payload.id = props.editingProject.id
  }
  emit("submit", payload)
  if (!props.editingProject) {
    // 新增模式：提交后立即清空表单
    name.value = ""
    currentStep.value = ""
    nextStep.value = ""
    blockers.value = ""
  }
}
</script>

<style scoped lang="scss">
@use "../../styles/ProjectForm.scss";
@use "../../styles/index.scss";
</style>
