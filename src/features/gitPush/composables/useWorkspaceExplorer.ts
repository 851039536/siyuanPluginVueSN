// gitPush 工作区文件浏览器开关与定位请求（ProjectCard 编排层瘦身）
//
// 两块状态彼此独立：visible 控制弹窗；focus 是一次性的「角标 → 工作区 Tab 差异」定位请求
// （seq 递增保证同一文件重复点击也能触发，请求在下一帧清空避免切回 Tab 时重开旧差异）。
import type { Ref } from "vue"
import type { FileChange } from "../types"
import { nextTick, ref } from "vue"

export interface WorkspaceExplorerOptions {
  /** 当前工作区变更文件（角标数据源 + 定位目标） */
  changes: () => FileChange[] | undefined
  /** 切到工作区 Tab（Tab 状态与持久化由父层负责） */
  openWorktreeTab: () => void
}

export function useWorkspaceExplorer(opts: WorkspaceExplorerOptions): {
  visible: Ref<boolean>
  focus: Ref<{ file: FileChange, seq: number } | null>
  open: () => void
  locate: (path: string) => void
} {
  const visible = ref(false)
  const focus = ref<{ file: FileChange, seq: number } | null>(null)
  let seq = 0

  /** 打开文件浏览器（列表在弹窗内按需拉取，卡片挂载时不访问磁盘；底部脚本面板由用户就地展开） */
  function open() {
    visible.value = true
  }

  /**
   * 文件树变更角标点击：关闭浏览器 → 切到工作区 Tab → 打开该文件差异。
   * 复用 WorkingTreePanel 既有的差异弹窗链路（不复制 diff 缓存/暂存/丢弃逻辑）。
   * @param path 目标文件相对路径
   */
  function locate(path: string) {
    visible.value = false
    opts.openWorktreeTab()
    const file = opts.changes()?.find((f) => f.path === path)
    if (!file) return
    focus.value = { file, seq: ++seq }
    void nextTick(() => { focus.value = null })
  }

  return { visible, focus, open, locate }
}
