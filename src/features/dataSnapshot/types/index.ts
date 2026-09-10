// dataSnapshot 模块类型定义
import type { CloudSnapshotTag, SnapshotInfo } from "@/api"

export type { CloudSnapshotTag, SnapshotInfo }
// i18n 键类型与取值函数（独立文件，供 composable / 注册入口引用）
export type { DataSnapshotI18n } from "./i18n"
export { getDataSnapshotI18n } from "./i18n"

export type SnapshotView = "local" | "cloud" | "detail"

export interface SnapshotOperationState {
  creating: boolean
  restoring: string | null
  downloading: string | null
  removing: string | null
}
