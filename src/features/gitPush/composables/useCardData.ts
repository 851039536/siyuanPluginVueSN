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
import { pruneRecordCache, resolveValidPath } from "../utils"
import { scanMarkdownFiles } from "./useMarkdownFiles"

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
  const conflicts = ref<ConflictFile[]>([])
  /** 文件差异缓存（键 = staged 标记 + 文件名，如 "u::src/a.ts"） */
  const fileDiffs = ref<Record<string, string>>({})
  const mdFiles = ref<MdFileEntry[]>([])

  /** 当前项目有效路径（多设备路径解析，实时求值不缓存） */
  const path = () => resolveValidPath(project())

  async function loadBranches() {
    branches.value = await manager.getBranches(path())
  }

  /** 加载提交日志并同步项目最近活动时间（原 useGitOps.loadCommitLog 的副作用经服务回传父层） */
  async function loadLog(count?: number | "all") {
    const entries = await manager.getCommitLog(path(), count)
    logEntries.value = entries
    const latest = entries[0]?.date
    if (latest) await services.recordCommitActivity(project().id, latest)
  }

  async function loadStash() {
    stashList.value = await manager.stashList(path())
  }

  async function loadTags() {
    tags.value = await manager.getTags(path())
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
  onSignal("tags", loadTags)
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
    conflicts,
    fileDiffs,
    mdFiles,
    ensureDetailsLoaded,
    reloadLog,
    refreshTags,
    loadDiff,
  }
}
