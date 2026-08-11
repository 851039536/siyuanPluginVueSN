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
    <!-- 提交按钮 -->
    <div class="qn-proj-form__actions">
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
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 速记功能 — 项目新增表单
 * 自包含表单状态：名称、状态（进行中/已完成/卡住）、当前进度、下一步、卡点；
 * 提交时仅 emit(submit) 携带结构化载荷，存储由父 composable 统一处理
 */
import type { ProjectItem } from "../../types"
import { ref } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { PROJECT_STATUSES, STATUS_META } from "../../types"

const props = defineProps<{
  i18n: Record<string, string>
}>()

const emit = defineEmits<{
  submit: [payload: {
    name: string
    status: ProjectItem["status"]
    currentStep: string
    nextStep: string
    blockers: string
  }]
}>()

// 表单本地状态
const name = ref("")
const status = ref<ProjectItem["status"]>("active")
const currentStep = ref("")
const nextStep = ref("")
const blockers = ref("")

/** 提交：emit 结构化载荷并复位表单 */
const handleSubmit = () => {
  if (!name.value.trim()) return
  emit("submit", {
    name: name.value,
    status: status.value,
    currentStep: currentStep.value,
    nextStep: nextStep.value,
    blockers: blockers.value,
  })
  name.value = ""
  currentStep.value = ""
  nextStep.value = ""
  blockers.value = ""
}
</script>

<style scoped lang="scss">
@use "../../styles/ProjectForm.scss";
@use "../../styles/index.scss";
</style>
