// Splitter 尺寸持久化：Web Storage 读写（私有模块）
// 用浏览器原生 Storage 而非插件存储 —— 组件库要保持「整体复制到普通项目即可用」

/** 持久化位置（与官方 stateStorage 取值一致） */
export type SplitterStateStorage = "session" | "local"

/** 取对应 Storage；非浏览器环境返回 null */
export function resolveStorage(kind: SplitterStateStorage): Storage | null {
  if (typeof window === "undefined") return null
  return kind === "local" ? window.localStorage : window.sessionStorage
}

/** 读取已保存尺寸：缺失 / 格式非法 / 读写抛错（隐私模式、超配额）时一律返回 null */
export function readStoredSizes(storage: Storage | null, key: string): number[] | null {
  if (!storage || !key) return null
  try {
    const raw = storage.getItem(key)
    if (!raw) return null
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed) || parsed.length === 0) return null
    if (!parsed.every((value) => typeof value === "number" && Number.isFinite(value))) return null
    return parsed as number[]
  } catch (error) {
    console.error("[Splitter] 读取已保存的面板尺寸失败：", error)
    return null
  }
}

/** 写入尺寸：失败只记录日志，不阻断交互 */
export function writeStoredSizes(storage: Storage | null, key: string, sizes: number[]): void {
  if (!storage || !key) return
  try {
    storage.setItem(key, JSON.stringify(sizes))
  } catch (error) {
    console.error("[Splitter] 保存面板尺寸失败：", error)
  }
}
