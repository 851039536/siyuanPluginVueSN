// 引用快照类型（本地分支 + 远程跟踪 ref，一次 `for-each-ref` 取齐）
//
// 为什么单独一个文件：这些形状同时被 `managers/WorktreeOps`（产出）与
// `composables/useConsistencyAudit`（消费）使用，放在任一侧都会让另一侧反向依赖；
// 且它们是纯类型，可被 Node 单测安全导入（不触碰 siyuan 运行时）。

/** 本地分支引用（含 commit sha，供一致性分析做「相等即同步」短路） */
export interface LocalBranchRef {
  /** 短分支名（`feature/login` 这类含斜杠的形式保持原样） */
  name: string
  /** 该分支指向的 commit sha（完整 40 位） */
  sha: string
  /** 是否为当前 HEAD 分支 */
  current: boolean
}

/** 远程跟踪引用（`refs/remotes/<remote>/<branch>`） */
export interface RemoteTrackingRef {
  /** 远程名（按已知远程名做最长前缀匹配；未知时取首段） */
  remote: string
  /** 远程分支名（可能含斜杠） */
  branch: string
  /** 该跟踪 ref 指向的 commit sha */
  sha: string
}

/** 一次 `for-each-ref` 得到的引用快照 */
export interface RefSyncSnapshot {
  branches: LocalBranchRef[]
  remoteRefs: RemoteTrackingRef[]
}
