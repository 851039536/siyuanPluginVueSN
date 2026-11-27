// 跨视图流水线作用域：根组件提供全局 lane 与运行入口，卡片外的视图（仓库体检等）按需注入
import type { InjectionKey, Ref } from "vue"
import type { OpPipelineLane, PipelineOp, PipelineStageKey } from "../types/pipeline"
import type { LocalPipelineStepper } from "./useOpPipeline"
import { inject, ref } from "vue"

/** 视图层可用的流水线能力（缺省实现直接执行，保证组件脱离根组件也能工作） */
export interface PipelineScope {
  /** 全局 lane（统计 / 分析 / 报告 / 体检） */
  lanes: Ref<OpPipelineLane[]>
  run: <T>(
    op: PipelineOp,
    label: string,
    plan: readonly PipelineStageKey[],
    fn: (stepper: LocalPipelineStepper) => Promise<T>,
  ) => Promise<T>
}

export const PIPELINE_SCOPE_KEY: InjectionKey<PipelineScope> = Symbol("gitPushPipelineScope")

const NOOP_STEPPER: LocalPipelineStepper = {
  step: () => undefined,
  detail: () => undefined,
  skip: () => undefined,
}

/** 注入流水线作用域；未提供时退化为无动画直跑，调用方无需分支判断 */
export function usePipelineScope(): PipelineScope {
  return inject(PIPELINE_SCOPE_KEY, {
    lanes: ref<OpPipelineLane[]>([]),
    run: (_op, _label, _plan, fn) => fn(NOOP_STEPPER),
  })
}
