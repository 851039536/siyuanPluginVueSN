// 推送状态派生视图 composable：由 pushStatuses 派生徽章文案/样式类/推送判定等模板辅助函数
import type { Ref } from "vue"
import type { PushStatusInfo, RemotePushStatus } from "../types"
import { isAheadOfRemote } from "../utils"

export function usePushStatusView(pushStatuses: Ref<Record<string, PushStatusInfo>>) {
  /** 获取指定项目指定远程的推送状态 */
  function getRemoteStatus(projectId: string, remoteKey: string): RemotePushStatus | undefined {
    return pushStatuses.value[projectId]?.remotes[remoteKey]
  }

  /** 获取远程推送状态标签文案 */
  function statusLabel(projectId: string, remoteKey: string): string {
    const rs = getRemoteStatus(projectId, remoteKey)
    if (!rs) return ""
    if (rs.noUpstream) return `+${rs.ahead}`
    // 分叉（既领先又落后）时同时展示上传与下拉数量
    const parts: string[] = []
    if (rs.ahead > 0) parts.push(`↑${rs.ahead}`)
    if (rs.behind > 0) parts.push(`↓${rs.behind}`)
    return parts.join(" ")
  }

  /** 获取状态 badge 的 CSS 类 */
  function statusBadgeClass(projectId: string, remoteKey: string): string {
    const rs = getRemoteStatus(projectId, remoteKey)
    if (!rs) return ""
    // 分叉优先判断，避免被 ahead 抢先归类为 gp-ahead
    if (!rs.noUpstream && rs.ahead > 0 && rs.behind > 0) return "gp-diverged"
    if (isAheadOfRemote(rs)) return "gp-ahead"
    if (rs.behind > 0) return "gp-behind"
    return "gp-synced"
  }

  /** 判断某个远程是否需要推送（本地超前或从未推送） */
  function needsPushFor(projectId: string, remoteKey: string): boolean {
    const rs = getRemoteStatus(projectId, remoteKey)
    if (!rs) return true // 尚未检测，允许点击
    return isAheadOfRemote(rs)
  }

  /** 判断项目是否有远程落后（远程有新提交） */
  function hasBehind(projectId: string): boolean {
    const status = pushStatuses.value[projectId]
    if (!status) return false
    return Object.values(status.remotes).some((r) => r.behind > 0)
  }

  return {
    statusLabel,
    statusBadgeClass,
    needsPushFor,
    hasBehind,
  }
}
