// diff 查看偏好的模块级单例：多个弹窗共用一份，修改后统一持久化

import type { TypedStorage } from "@/utils/typedStorage"
import type { DiffViewPrefs } from "../types/storage"
import { reactive, watch } from "vue"
import { DEFAULT_DIFF_VIEW_PREFS } from "../types/storage"
import { normalizeDiffViewPrefs } from "../utils/diffPrefs"

const prefs = reactive<DiffViewPrefs>({ ...DEFAULT_DIFF_VIEW_PREFS })

let target: TypedStorage<DiffViewPrefs> | null = null
let loading: Promise<void> | null = null
let loaded = false
let saveTimer: ReturnType<typeof setTimeout> | null = null

// 模块级 watcher：不绑定任何卡片生命周期，卡片卸载后仍能落盘
watch(prefs, saveDiffViewPrefs, { deep: true })

/** 共享偏好对象（直接读写；变更由模块级 watcher 统一落盘） */
export function diffViewPrefs(): DiffViewPrefs {
  return prefs
}

/** 幂等初始化：首次拿到 storage 时加载一次并启动保存 watcher */
export function ensureDiffViewPrefs(storage: TypedStorage<DiffViewPrefs>): void {
  target = storage
  if (loaded || loading) return
  loading = storage.loadOrDefault()
    .then((raw) => {
      Object.assign(prefs, normalizeDiffViewPrefs(raw))
    })
    .catch(() => {})
    .finally(() => {
      loaded = true
      loading = null
    })
}

function saveDiffViewPrefs(): void {
  if (!target) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    void target?.save({ ...prefs }).catch(() => {})
  }, 200)
}
