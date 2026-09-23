<!-- gitPush 统计视图工具条（快照状态文案 + 刷新全部按钮，与提交分析 AnalysisToolbar 同构） -->
<template>
  <Toolbar
    class="gp-analysistoolbar"
    variant="borderless"
    :padded="false"
    size="xsmall"
    :aria-label="i18n.statsView"
  >
    <!-- 快照状态："刷新中…" / "上次刷新 {相对时间}" / "共 {n} 个项目" -->
    <template #start>
      <span class="gp-analysistoolbar-status">{{ statusText }}</span>
    </template>
    <template #end>
      <!-- 刷新全部项目状态（强制重跑 git status + 远程比对；审计入口在「仓库链接一致性」区块标题右侧） -->
      <Button
        variant="ghost"
        size="xsmall"
        icon="refresh"
        :loading="refreshing"
        :disabled="refreshing"
        :title="i18n.refreshAll"
        @click="emit('refresh')"
      />
    </template>
  </Toolbar>
</template>

<script setup lang="ts">
// 统计视图工具条：与提交分析视图共用 .gp-analysistoolbar 外壳与状态文案样式。
// 状态文案三态：刷新中 → 上次刷新相对时间（有快照时）→ 项目总数（尚未刷新过）。
import { computed } from "vue"
import Button from "@/components/Button.vue"
import Toolbar from "@/components/Toolbar.vue"
import { relativeTime } from "../../utils"

const props = defineProps<{
  i18n: Record<string, any>
  /** 项目总数 */
  projectCount: number
  /** 状态数据刷新中 */
  refreshing: boolean
  /** 上次状态快照刷新完成时间（ISO，空串 = 尚未手动刷新过） */
  refreshedAt: string
}>()

const emit = defineEmits<{
  refresh: []
}>()

/** 状态文案：刷新中优先 → 有快照时间则显示相对时间 → 否则回落到项目总数 */
const statusText = computed(() => {
  if (props.refreshing) return props.i18n.loadingLabel
  if (props.refreshedAt) return props.i18n.statsSnapshotAt.replace("{0}", relativeTime(props.refreshedAt, props.i18n))
  return props.i18n.statsProjectCount.replace("{0}", String(props.projectCount))
})
</script>

<style lang="scss">
@use "../../styles/AnalysisToolbar.scss";
@use "../../styles/index.scss";
</style>
