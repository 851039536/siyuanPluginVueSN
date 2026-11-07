// gitPush 工作区文件列表加载（按需拉取 + 会话缓存 + 手动刷新）
//
// 为什么不在卡片挂载时预取：N 张卡 = N 次 git 进程启动（Windows 单次 300–500ms），
// 首页会被拖慢。文件浏览属低频操作，只在弹窗打开时拉一次；重开时先用缓存出内容，再后台刷新。
import type { Ref } from "vue"
import { ref } from "vue"
import { getErrorMessage } from "@/utils/stringUtils"

/** 缓存上限（项目数通常几十，超限淘汰最旧，防已删项目条目常驻） */
const CACHE_MAX = 16

/** 目录 → 上次拉取的文件列表（会话内有效，磁盘变化靠手动刷新/重开时的后台刷新兜底） */
const cache = new Map<string, string[]>()

function remember(dir: string, list: string[]): void {
  cache.delete(dir)
  cache.set(dir, list)
  while (cache.size > CACHE_MAX) {
    const oldest = cache.keys().next().value
    if (oldest === undefined) break
    cache.delete(oldest)
  }
}

/**
 * 工作区文件列表状态。
 * @param resolvePath 取当前项目有效路径（多设备适配，每次调用实时检测）
 * @param loadFiles 实际拉取（由调用方注入 manager 方法，composable 不直接依赖 GitPushManager）
 */
export function useWorkspaceFiles(
  resolvePath: () => string,
  loadFiles: (dir: string) => Promise<string[]>,
): {
  files: Ref<string[]>
  loading: Ref<boolean>
  error: Ref<string>
  refresh: () => Promise<void>
} {
  const initialDir = resolvePath()
  const files = ref<string[]>(cache.get(initialDir) ?? [])
  const loading = ref(false)
  const error = ref("")

  // 请求序号：连续刷新/关闭重开时只用最后一次结果，避免慢请求覆盖新结果
  let seq = 0

  async function refresh(): Promise<void> {
    const dir = resolvePath()
    if (!dir) {
      files.value = []
      error.value = ""
      return
    }
    const my = ++seq
    loading.value = true
    error.value = ""
    try {
      const list = await loadFiles(dir)
      if (my !== seq) return
      // git 输出（tracked 后接 untracked）不是全局有序，浏览器按路径字典序展示
      const sorted = [...list].sort()
      files.value = sorted
      remember(dir, sorted)
    } catch (e) {
      if (my !== seq) return
      error.value = getErrorMessage(e)
    } finally {
      if (my === seq) loading.value = false
    }
  }

  return { files, loading, error, refresh }
}
