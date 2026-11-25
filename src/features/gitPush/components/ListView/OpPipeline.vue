<!-- 操作流水线：运行中展示真实阶段（远程 git 进度 / 本地执行步骤），完成后由父层移除 -->
<template>
  <div
    class="gp-pipeline"
    role="group"
    aria-live="polite"
    :aria-label="i18n.opPipelineLabel || '操作进度'"
  >
    <div
      v-for="lane in lanes"
      :key="lane.id"
      class="gp-pipeline-lane"
      :class="`gp-pipeline-lane--${lane.status}`"
    >
      <div class="gp-pipeline-head">
        <Icon
          :icon="laneIcon(lane)"
          height="12"
          :class="{ 'gp-spin': lane.status === 'running' && !laneStalled(lane) }"
        />
        <span
          class="gp-pipeline-label"
          :title="lane.label"
        >{{ lane.label }}</span>
        <span
          v-if="lanePercent(lane) !== undefined"
          class="gp-pipeline-percent"
        >{{ lanePercent(lane) }}%</span>
      </div>
      <ol class="gp-pipeline-stages">
        <li
          v-for="(stage, idx) in lane.stages"
          :key="stage.key"
          class="gp-pipeline-stage"
          :class="[`gp-pipeline-stage--${stage.status}`, { 'is-stalled': stage.stalled }]"
          :aria-current="stage.status === 'running' ? 'step' : undefined"
        >
          <span
            class="gp-pipeline-dot"
            aria-hidden="true"
          />
          <!-- 阶段标签：停滞时补「仍在处理」，避免用户以为卡死 -->
          <span
            class="gp-pipeline-stage-label"
            :title="stage.detail"
          >{{ stageLabel(stage.key) }}<template v-if="stage.stalled"> · {{ i18n.opStageStillWorking || "仍在处理" }}</template></span>
          <span
            v-if="idx < lane.stages.length - 1"
            class="gp-pipeline-connector"
            :class="{ 'is-active': stage.status === 'done' && lane.stages[idx + 1]?.status === 'running' }"
            aria-hidden="true"
          />
        </li>
      </ol>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { OpPipelineLane, PipelineStageKey } from "../../types/pipeline"
import { Icon } from "@iconify/vue"
import { PIPELINE_STAGE_LABEL_KEY, runningStage } from "../../utils/opPipeline"

const props = defineProps<{
  /** 运行中的流水线（父层已按 200ms 可见阈值过滤） */
  lanes: OpPipelineLane[]
  i18n: Record<string, any>
}>()

/** 当前阶段是否长时间无新输出（仅视觉降级） */
function laneStalled(lane: OpPipelineLane): boolean {
  return Boolean(runningStage(lane)?.stalled)
}

function lanePercent(lane: OpPipelineLane): number | undefined {
  return runningStage(lane)?.percent
}

/** 阶段文案走 i18n，缺失时退回阶段键（便于定位漏配文案） */
function stageLabel(key: PipelineStageKey): string {
  return props.i18n[PIPELINE_STAGE_LABEL_KEY[key]] ?? key
}

/** lane 状态图标：复用已注册的 mdi 图标，避免新增子集 */
function laneIcon(lane: OpPipelineLane): string {
  switch (lane.status) {
    case "done": return "mdi:check-circle"
    case "fail": return "mdi:alert-circle"
    case "canceled":
    case "skipped": return "mdi:minus-circle-outline"
    default: return "mdi:loading"
  }
}
</script>

<style lang="scss">
@use "../../styles/OpPipeline.scss";
</style>
