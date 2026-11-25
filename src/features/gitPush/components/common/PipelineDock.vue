<!-- 根级操作聚合 Dock：全局任务完整展示，卡片任务带项目名前缀紧凑展示 -->
<template>
  <!-- 嵌套的 OpPipeline 已有 aria-live，这里只用 region 命名，避免重复播报 -->
  <div
    class="gp-dock"
    role="region"
    :aria-label="i18n.pipelineActivity?.replace('{0}', String(lanes.length)) || '操作进行中'"
  >
    <div class="gp-dock-head">
      <Icon
        icon="mdi:loading"
        height="12"
        class="gp-spin"
      />
      <span class="gp-dock-title">{{ activityText }}</span>
    </div>
    <div class="gp-dock-body">
      <OpPipeline
        :lanes="lanes"
        :i18n="i18n"
        compact
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { OpPipelineLane } from "../../types/pipeline"
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import OpPipeline from "../ListView/OpPipeline.vue"

const props = defineProps<{
  /** 已带项目前缀的可见 lane（项目 lane + 全局 lane） */
  lanes: OpPipelineLane[]
  i18n: Record<string, any>
}>()

/** 进行中计数文案；缺文案时退化为「进行中 N 项」 */
const activityText = computed(() => {
  const template = props.i18n.pipelineActivity ?? "进行中 {0} 项"
  return String(template).replace("{0}", String(props.lanes.length))
})
</script>

<style lang="scss">
@use "../../styles/PipelineDock.scss";
</style>
