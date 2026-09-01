<!-- 提交分析显示设置菜单：齿轮弹出薄壳，表单内容复用 AnalysisSettingsForm（改动即时派发持久化） -->
<template>
  <div class="gpa-settings-wrap">
    <!-- 齿轮按钮（tooltip："显示设置"） -->
    <button
      class="vp-btn vp-btn--ghost vp-btn--sm"
      :title="i18n.analysisDisplaySettings"
      @click.stop="show = !show"
    >
      <Icon
        icon="mdi:cog-outline"
        height="12"
      />
    </button>

    <div
      v-if="show"
      class="gpa-settings-popover"
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
import { Icon } from "@iconify/vue"
import { onMounted, onUnmounted, ref } from "vue"
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

/** 菜单开关（点击菜单外部任意位置自动关闭） */
const show = ref(false)

/**
 * 点击菜单外部任意位置自动关闭。
 * 菜单未展开时直接返回：监听器随组件常驻，不加这道判断会让页面上每一次点击都白跑一次 closest() 查询。
 */
function closeOnOutside(e: MouseEvent) {
  if (!show.value) return
  const target = e.target as HTMLElement | null
  if (target && !target.closest(".gpa-settings-wrap")) show.value = false
}

onMounted(() => document.addEventListener("click", closeOnOutside))
onUnmounted(() => document.removeEventListener("click", closeOnOutside))
</script>

<style lang="scss">
@use "../../styles/CommitAnalysisSettings.scss";
@use "../../styles/index.scss";
</style>
