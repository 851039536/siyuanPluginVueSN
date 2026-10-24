// 推送状态派生视图 composable：由 pushStatuses 派生徽章文案/状态分类/推送判定等模板辅助函数
import type { Ref } from "vue"
// 直连纯模块：桶会转出依赖运行时 "siyuan" 的模块，纯派生逻辑不应被其拖累
import type { PushStatusInfo, RemotePushStatus, RemoteSyncKind } from "../types/storage"
import { isAheadOfRemote } from "../utils/platform"

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

  /** 获取远程同步状态分类（徽章配色与文案判据，供卡片映射一次） */
  function statusKind(projectId: string, remoteKey: string): RemoteSyncKind {
    const rs = getRemoteStatus(projectId, remoteKey)
    if (!rs) return ""
    // 分叉优先判断，避免被 ahead 抢先归类
    if (!rs.noUpstream && rs.ahead > 0 && rs.behind > 0) return "diverged"
    if (isAheadOfRemote(rs)) return "ahead"
    if (rs.behind > 0) return "behind"
    return "synced"
  }

  /** 判断某个远程是否需要推送（本地超前或从未推送） */
  function needsPushFor(projectId: string, remoteKey: string): boolean {
    const rs = getRemoteStatus(projectId, remoteKey)
    if (!rs) return true // 尚未检测，允许点击
    return isAheadOfRemote(rs)
  }

  return {
    statusLabel,
    statusKind,
    needsPushFor,
  }
}
