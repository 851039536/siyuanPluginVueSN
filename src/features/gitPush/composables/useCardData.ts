// gitPush 项目卡片 Tab 数据自包含（log/branches/stash/tags/冲突/diff/md 卡内经 manager 直取，父层操作经 cardRefreshSignals 通知重载）
import type {
  BranchInfo,
  CardDataDomain,
  CommitLogEntry,
  ConflictFile,
  GitProject,
  StashEntry,
  TagInfo,
} from "../types"
import type { MdFileEntry } from "./useMarkdownFiles"
import { inject, onMounted, ref, watch } from "vue"
import { CARD_SERVICES_KEY } from "../types"
import { getProjectRemoteNames, pruneRecordCache, resolveValidPath } from "../utils"
import { scanMarkdownFiles } from "./useMarkdownFiles"

/** Tag→commit 映射拉取上限（防异常大仓库失控） */
const TAG_COMMIT_MAP_LIMIT = 500

export function useCardData(project: () => GitProject) {
  const services = inject(CARD_SERVICES_KEY)!
  const { manager } = services

  // ── 卡片自持数据（单项目值，替代父层 Record<projectId, T> 切片 props）──
  const branches = ref<BranchInfo[]>([])
  const logEntries = ref<CommitLogEntry[]>([])
  const logLoading = ref(false)
  const stashList = ref<StashEntry[]>([])
  const tags = ref<TagInfo[]>([])
  const tagsLoading = ref(false)
  /** Tag 指向 commit 的映射（hash → Tag 名数组），供 LOG Tab 行内展示；上限 500 防异常大仓库失控 */
  const tagCommitMap = ref<Map<string, string[]>>(new Map())
  /** 各远程已有的 Tag 名列表（remote 名 → Tag 名数组），供 LOG Tab 展示 Tag 推送状态；失败远程不记录 */
  const remoteTags = ref<Map<string, string[]>>(new Map())
  const conflicts = ref<ConflictFile[]>([])
  /** 文件差异缓存（键 = staged 标记 + 文件名，如 "u::src/a.ts"） */
  const fileDiffs = ref<Record<string, string>>({})
  const mdFiles = ref<MdFileEntry[]>([])

  /** 当前项目有效路径（多设备路径解析，实时求值不缓存） */
  const path = () => resolveValidPath(project())

  async function loadBranches() {
    branches.value = await manager.getBranches(path())
  }

  /** 提交日志显示条数（卡片级共享真源：决定无参加载/重载的抓取条数；默认与 LOG 列表选择框一致） */
  const logLimit = ref<number | "all">(200)

  /** 更新显示条数（LOG 列表选择框变化时同步，保证后续无参刷新沿用当前选择） */
  function setLogLimit(count: number | "all") {
    logLimit.value = count
  }

  /** 加载提交日志并同步项目最近活动时间（count 缺省走 logLimit，即列表选择框当前值，替代原 30 条默认） */
  async function loadLog(count?: number | "all") {
    const entries = await manager.getCommitLog(path(), count ?? logLimit.value)
    logEntries.value = entries
    const latest = entries[0]?.date
    if (latest) await services.recordCommitActivity(project().id, latest)
  }

  async function loadStash() {
    stashList.value = await manager.stashList(path())
  }

  async function loadTags() {
    // 一次拉取足够多的 Tag：前 10 条供 TagPanel 展示（保持原 limit 10 行为），全量构建 hash → Tag 名映射供 LOG Tab 使用
    const all = await manager.getTags(path(), TAG_COMMIT_MAP_LIMIT)
    tags.value = all.slice(0, 10)
    const map = new Map<string, string[]>()
    for (const t of all) {
      if (!t.hash) continue
      const names = map.get(t.hash)
      if (names) names.push(t.name)
      else map.set(t.hash, [t.name])
    }
    tagCommitMap.value = map
  }

  /** 后台拉取各远程已有的 Tag 名列表（ls-remote 网络命令并行执行，失败远程静默跳过，不阻塞 UI） */
  async function loadRemoteTags() {
    const names = getProjectRemoteNames(project()).map((r) => r.name)
    if (names.length === 0) {
      remoteTags.value = new Map()
      return
    }
    const results = await Promise.all(names.map(async (name) => {
      try {
        return [name, await manager.getRemoteTags(path(), name)] as const
      } catch {
        // 单远程拉取失败（网络/超时）不记录，UI 不显示该远程的推送状态，避免误标"未推送"
        return null
      }
    }))
    const map = new Map<string, string[]>()
    for (const r of results) {
      if (r) map.set(r[0], r[1])
    }
    remoteTags.value = map
  }

  async function loadConflicts() {
    conflicts.value = await manager.getConflictFiles(path())
  }

  // ── 懒加载与手动刷新入口 ──

  /** 首次点卡片 / 切 Tab 时懒加载详情（失败不标记，下次展开可重试） */
  let detailsLoaded = false
  async function ensureDetailsLoaded() {
    if (detailsLoaded) return
    logLoading.value = true
    try {
      await Promise.all([loadLog(), loadBranches(), loadStash(), loadTags()])
      detailsLoaded = true
      // 远程 Tag 状态为网络命令，后台异步刷新不阻塞详情展示
      void loadRemoteTags()
    } catch {
      // 加载失败不标记为已加载，允许重试
    } finally {
      logLoading.value = false
    }
  }

  /** LOG Tab 手动刷新 / 变更显示条数 */
  async function reloadLog(count?: number | "all") {
    logLoading.value = true
    try {
      await loadLog(count)
    } finally {
      logLoading.value = false
    }
  }

  /** TAG Tab 手动刷新 */
  async function refreshTags() {
    tagsLoading.value = true
    try {
      await loadTags()
    } finally {
      tagsLoading.value = false
    }
  }

  /** 查看文件差异（原父层 fileDiffs Record 的卡内版） */
  async function loadDiff(file: string, staged: boolean) {
    const key = `${staged ? "s" : "u"}::${file}`
    fileDiffs.value[key] = await manager.getFileDiff(path(), file, staged)
    pruneRecordCache(fileDiffs.value, 30)
  }

  // ── 父层刷新信号响应（提交/stash/tag/冲突/批量刷新完成后按域重载）──
  function onSignal(domain: CardDataDomain, reload: () => Promise<void>) {
    watch(
      () => services.cardRefreshSignals.value[project().id]?.[domain],
      (tick, prev) => {
        if (tick !== undefined && tick !== prev) void reload()
      },
    )
  }
  onSignal("log", () => reloadLog())
  onSignal("branches", loadBranches)
  onSignal("stash", loadStash)
  onSignal("tags", async () => {
    await loadTags()
    // 推送/删除 Tag 后同步刷新远程 Tag 状态（网络命令后台执行）
    void loadRemoteTags()
  })
  onSignal("conflicts", loadConflicts)

  // Markdown 文件标识：挂载时扫描一次（原父层懒扫描缓存的卡内版）
  onMounted(() => {
    mdFiles.value = scanMarkdownFiles(path())
  })

  return {
    branches,
    logEntries,
    logLoading,
    stashList,
    tags,
    tagsLoading,
    tagCommitMap,
    remoteTags,
    conflicts,
    fileDiffs,
    mdFiles,
    ensureDetailsLoaded,
    reloadLog,
    refreshTags,
    loadDiff,
    logLimit,
    setLogLimit,
  }
}
