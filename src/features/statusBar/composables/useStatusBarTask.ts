/**
 * 状态栏后台任务管理
 *
 * 为需要后台执行并显示进度的功能提供统一的状态栏展示能力。
 * 使用模块级 reactive store，任何 feature 导入后即可创建和管理任务。
 *
 * 用法：
 *   const task = useStatusBarTask('my-feature', 'ph:archive')
 *   task.progress({ label: '导出中', percent: 45, phase: '压缩' })
 *   task.complete('导出完成', '已导出 100 条数据')  // 5s 后自动消失
 *   task.fail('导出失败')
 */

import type { ResourceLevel } from "../types/index"
import {
  computed,
  reactive,
} from "vue"

// ============================================================
// 类型
// ============================================================

export interface StatusBarTaskInfo {
  id: string
  icon: string
  display: string
  tooltip: string
  level: ResourceLevel
}

export interface TaskProgressOpts {
  label: string
  percent?: number
  phase?: string
}

export interface TaskHandle {
  /** 更新进度 */
  progress: (opts: TaskProgressOpts) => void
  /** 标记完成，显示结果 5 秒后自动清除 */
  complete: (label: string, detail?: string) => void
  /** 标记失败，短暂显示后清除 */
  fail: (label: string) => void
  /** 立即清除 */
  clear: () => void
}

// ============================================================
// 模块级共享 reactive store
// ============================================================

const tasks = reactive<Map<string, StatusBarTaskInfo>>(new Map())
const clearTimers = new Map<string, ReturnType<typeof setTimeout>>()
const AUTO_CLEAR_MS = 5000
const FAIL_CLEAR_MS = 3000

/**
 * 当前活跃的任务列表（供 statusBar 模板读取）
 */
export const activeTasks = computed<StatusBarTaskInfo[]>(() =>
  Array.from(tasks.values()),
)

// ============================================================
// Composable
// ============================================================

export function useStatusBarTask(taskId: string, icon: string): TaskHandle {
  const ensureTask = (): StatusBarTaskInfo => {
    const existing = tasks.get(taskId)
    if (existing) return existing
    const info: StatusBarTaskInfo = {
      id: taskId,
      icon,
      display: "",
      tooltip: "",
      level: "normal",
    }
    tasks.set(taskId, info)
    return info
  }

  const cancelTimer = () => {
    const t = clearTimers.get(taskId)
    if (t) {
      clearTimeout(t)
      clearTimers.delete(taskId)
    }
  }

  const remove = () => {
    cancelTimer()
    tasks.delete(taskId)
  }

  return {
    progress(opts: TaskProgressOpts) {
      cancelTimer()
      const info = ensureTask()
      const pct = opts.percent != null ? ` ${Math.round(opts.percent)}%` : ""
      info.display = `${opts.label}${pct}`
      info.tooltip = opts.phase ? `${opts.label}\n阶段: ${opts.phase}` : opts.label
      info.level = opts.percent != null ? "medium" : "normal"
    },

    complete(label: string, detail?: string) {
      cancelTimer()
      const info = ensureTask()
      info.display = label
      info.tooltip = detail || label
      info.level = "normal"
      clearTimers.set(taskId, setTimeout(remove, AUTO_CLEAR_MS))
    },

    fail(label: string) {
      cancelTimer()
      const info = ensureTask()
      info.display = label
      info.tooltip = label
      info.level = "high"
      clearTimers.set(taskId, setTimeout(remove, FAIL_CLEAR_MS))
    },

    clear: remove,
  }
}
