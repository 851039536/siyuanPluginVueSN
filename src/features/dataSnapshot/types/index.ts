// dataSnapshot 模块类型定义与存储类
import type { Plugin } from "siyuan"
import type {
  CloudSnapshotTag,
  SnapshotContentFile,
  SnapshotInfo,
} from "@/api"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

export type {
  CloudSnapshotTag,
  SnapshotContentFile,
  SnapshotInfo,
}

export type SnapshotView = "local" | "cloud" | "detail" | "diff"

export interface SnapshotOperationState {
  creating: boolean
  restoring: string | null
  uploading: string | null
  downloading: string | null
  removing: string | null
  loadingContent: string | null
}

export interface SnapshotDetail {
  snapshot: SnapshotInfo
  files: SnapshotContentFile[]
}

export interface SnapshotDiffData {
  snapshotA: SnapshotDetail
  snapshotB: SnapshotDetail
}

interface DataSnapshotSettings {
  lastUploadTag: string
}

const STORAGE_KEYS = {
  SETTINGS: "data-snapshot-settings",
} as const

const DEFAULT_SNAPSHOT_SETTINGS: DataSnapshotSettings = {
  lastUploadTag: "",
}

export class DataSnapshotStorage {
  readonly settings: TypedStorage<DataSnapshotSettings>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.settings = new TypedStorage(storage, STORAGE_KEYS.SETTINGS, DEFAULT_SNAPSHOT_SETTINGS)
  }
}
