// 推送状态派生视图 composable：由 pushStatuses 派生徽章文案/状态分类/推送判定等模板辅助函数
import type { Ref } from "vue"
// 直连纯模块：桶会转出依赖运行时 "siyuan" 的模块，纯派生逻辑不应被其拖累
import type { PushStatusInfo, RemotePushStatus, RemoteSyncKind, RemoteSyncView } from "../types/storage"
import { hasUnpushedCommits, mayAttemptPush } from "../utils/platform"

export function usePushStatusView(pushStatuses: Ref<Record<string, PushStatusInfo>>) {
  /** 获取指定项目指定远程的推送状态 */
  function getRemoteStatus(projectId: string, remoteKey: string): RemotePushStatus | undefined {
    return pushStatuses.value[projectId]?.remotes[remoteKey]
  }

  /**
   * 一次派生远程同步视图（分类 + 徽章文案）。
   * 卡片每个远程只应调用一次，避免 kind/label 各自重复查找同一状态。
   */
  function remoteView(projectId: string, remoteKey: string): RemoteSyncView {
    const rs = getRemoteStatus(projectId, remoteKey)
    if (!rs) return { kind: "", label: "" }

    let label: string
    if (rs.noUpstream) {
      // 远程分支尚未建立且有本地提交：用 +N 表示「首次推送将建立的提交数」；
      // 空仓库（ahead=0）没有可推送内容，不显示徽章
      label = rs.ahead > 0 ? `+${rs.ahead}` : ""
    } else {
      // 分叉（既领先又落后）时同时展示上传与下拉数量
      const parts: string[] = []
      if (rs.ahead > 0) parts.push(`↑${rs.ahead}`)
      if (rs.behind > 0) parts.push(`↓${rs.behind}`)
      label = parts.join(" ")
    }

    let kind: RemoteSyncKind
    // 分叉优先判断，避免被 ahead 抢先归类
    if (!rs.noUpstream && rs.ahead > 0 && rs.behind > 0) kind = "diverged"
    else if (hasUnpushedCommits(rs)) kind = "ahead"
    else if (rs.behind > 0) kind = "behind"
    else kind = "synced"

    return { kind, label }
  }

  /** 判断某个远程是否需要推送（本地超前或从未推送；空仓库仍允许尝试） */
  function needsPushFor(projectId: string, remoteKey: string): boolean {
    const rs = getRemoteStatus(projectId, remoteKey)
    if (!rs) return true // 尚未检测，允许点击
    return mayAttemptPush(rs)
  }

  return {
    remoteView,
    needsPushFor,
  }
}
