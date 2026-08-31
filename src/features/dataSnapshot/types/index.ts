// dataSnapshot 模块类型定义
import type { CloudSnapshotTag, SnapshotInfo } from "@/api"

export type { CloudSnapshotTag, SnapshotInfo }

export type SnapshotView = "local" | "cloud" | "detail"

export interface SnapshotOperationState {
  creating: boolean
  restoring: string | null
  downloading: string | null
  removing: string | null
}
