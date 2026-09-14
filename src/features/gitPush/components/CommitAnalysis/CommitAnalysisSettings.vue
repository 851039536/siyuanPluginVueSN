<!-- 提交分析显示设置菜单：齿轮弹出薄壳，表单内容复用 AnalysisSettingsForm（改动即时派发持久化） -->
<template>
  <div
    ref="wrapEl"
    class="gpa-settings-wrap"
  >
    <!-- 齿轮按钮（tooltip："显示设置"；纯图标 + dense = 20×20 紧凑几何，title 承担可访问名） -->
    <Button
      variant="ghost"
      size="xsmall"
      dense
      icon="cogOutline"
      :title="i18n.analysisDisplaySettings"
      :aria-expanded="show"
      :aria-controls="POPOVER_ID"
      @click.stop="show = !show"
    />

    <!-- 浮层：共享库无 Popover 组件故自建（已登记例外），此处补齐对话框语义与标题关联 -->
    <div
      v-if="show"
      :id="POPOVER_ID"
      class="gpa-settings-popover"
      role="dialog"
      :aria-label="i18n.analysisDisplaySettings"
      @click.stop
    >
      <AnalysisSettingsForm
        :i18n="i18n"
        :view-settings="viewSettings"
        :years="years"
        @update="emit('update', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 提交分析显示设置菜单（薄壳：齿轮 + popover 容器，设置项在 AnalysisSettingsForm）
import type { CommitAnalysisViewSettings } from "../../types"
import { onMounted, onUnmounted, ref } from "vue"
import Button from "@/components/Button.vue"
import AnalysisSettingsForm from "./AnalysisSettingsForm.vue"

defineProps<{
  i18n: Record<string, any>
  /** 当前显示设置（父级持有，本组件只读展示 + 派发更新） */
  viewSettings: CommitAnalysisViewSettings
  /** 年份选项（数据年份 ∪ 今年 ∪ 已保存年份，降序） */
  years: number[]
}>()

const emit = defineEmits<{
  update: [patch: Partial<CommitAnalysisViewSettings>]
}>()

/** 浮层 id（供齿轮按钮 aria-controls 关联；本视图内该薄壳只挂载一次） */
const POPOVER_ID = "gpa-settings-popover"

/** 定位锚点（关闭浮层时把焦点交还齿轮按钮） */
const wrapEl = ref<HTMLElement | null>(null)

/** 菜单开关（点击菜单外部或按 Esc 关闭） */
const show = ref(false)

/** 关闭浮层并把焦点交还齿轮按钮，键盘用户不因浮层消失而丢失焦点位置 */
function closeSettings() {
  show.value = false
  wrapEl.value?.querySelector<HTMLButtonElement>(".si-button")?.focus()
}

/**
 * 点击菜单外部任意位置自动关闭。
 * 菜单未展开时直接返回：监听器随组件常驻，不加这道判断会让页面上每一次点击都白跑一次 closest() 查询。
 */
function closeOnOutside(e: MouseEvent) {
  if (!show.value) return
  const target = e.target as HTMLElement | null
  if (target && !target.closest(".gpa-settings-wrap")) show.value = false
}

/** Esc 关闭：对齐共享 Dialog/Drawer 的键盘预期（原先只能用鼠标点外部关闭） */
function onDocKeydown(e: KeyboardEvent) {
  if (!show.value || e.key !== "Escape") return
  closeSettings()
}

onMounted(() => {
  document.addEventListener("click", closeOnOutside)
  document.addEventListener("keydown", onDocKeydown)
})
onUnmounted(() => {
  document.removeEventListener("click", closeOnOutside)
  document.removeEventListener("keydown", onDocKeydown)
})
</script>

<style lang="scss">
@use "../../styles/CommitAnalysisSettings.scss";
@use "../../styles/index.scss";
</style>
