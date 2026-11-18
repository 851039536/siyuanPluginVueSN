// 跨项目批量推送编排：当前可见列表中的待推送项目串行推送，逐项汇总成败
//
// 为什么不复用卡片按钮的「预检 + 确认」路径：
//   预检是逐项目的 ls-remote（单个最长 5s），批量并行会瞬间打满网络池；
//   且命中「远程有新提交」时每个项目各弹一次确认框，用户无法连续处理。
// 因此批量模式直接调用 pushToAll（仍走项目写锁与智能跳过），
// 失败详情留在各项目输出面板，结束后给一条汇总提示。
import type { Ref } from "vue"
import type { GitProject, PushStatusInfo } from "../types"
import { ref } from "vue"
import { PLATFORM_META } from "../types"

export interface BatchPushSummary {
  ok: number
  failed: number
  canceled: number
  skipped: number
}

interface BatchPushOptions {
  /** 当前列表可见项目（按视图 / 搜索 / 分类筛选后的结果） */
  visibleProjects: () => GitProject[]
  /** 推送状态（判据与卡片主按钮一致：needsPush 才纳入） */
  pushStatuses: Ref<Record<string, PushStatusInfo>>
  isPushing: (id: string) => boolean
  pushToAll: (id: string) => Promise<Record<string, any>>
  cancelPush: (id: string) => void
}

type BatchOutcome = keyof BatchPushSummary

/** 单项目推送结果归类（参数为 AllPlatformResult 的各平台子结果） */
function classifyResult(result: Record<string, any> | undefined): BatchOutcome {
  if (!result) return "failed"
  const platforms = PLATFORM_META
    .map((pm) => result[pm.key])
    .filter((r): r is Record<string, any> => !!r)
  if (platforms.some((r) => r.canceled)) return "canceled"
  const executed = platforms.filter((r) => !r.skipped)
  if (executed.length === 0) {
    // 无远程 / 全部被智能跳过：没有真实执行，不算失败
    return platforms.length > 0 || result.allSkipped ? "skipped" : result.success ? "ok" : "failed"
  }
  return executed.every((r) => r.ok) ? "ok" : "failed"
}

export function useBatchPush(options: BatchPushOptions) {
  const running = ref(false)
  const done = ref(0)
  const total = ref(0)

  let currentId = ""
  let cancelRequested = false

  /** 当前可见且确实待推送的项目（与卡片主按钮同一判据） */
  function collectTargets(): GitProject[] {
    return options.visibleProjects().filter((p) => {
      const status = options.pushStatuses.value[p.id]
      return !!status?.needsPush && !options.isPushing(p.id)
    })
  }

  /**
   * 串行推送当前列表内所有待推送项目。
   * @returns 汇总；已有批次在跑或无目标时返回 null（调用方据此提示）
   */
  async function run(): Promise<BatchPushSummary | null> {
    if (running.value) return null
    const targets = collectTargets()
    if (targets.length === 0) return null

    running.value = true
    cancelRequested = false
    done.value = 0
    total.value = targets.length
    const summary: BatchPushSummary = { ok: 0, failed: 0, canceled: 0, skipped: 0 }

    try {
      for (const project of targets) {
        if (cancelRequested) {
          // 剩余未发起的项目统一计入取消，与「已取消」汇总语义一致
          summary.canceled += targets.length - done.value
          break
        }
        // 批次进行中用户手动推送了该项目：跳过，不能误记为失败
        if (options.isPushing(project.id)) {
          summary.skipped++
          done.value++
          continue
        }
        currentId = project.id
        const result = await options.pushToAll(project.id).catch(() => undefined)
        summary[classifyResult(result)]++
        done.value++
      }
    } finally {
      running.value = false
      currentId = ""
    }
    return summary
  }

  /** 取消批次：终止当前项目的 git 子进程，剩余项目不再发起 */
  function cancel() {
    if (!running.value) return
    cancelRequested = true
    if (currentId) options.cancelPush(currentId)
  }

  return { running, done, total, run, cancel, collectTargets }
}
