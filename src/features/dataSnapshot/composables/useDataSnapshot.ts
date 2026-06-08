import type { Plugin } from "siyuan"
import type {
  CloudSnapshotTag,
  SnapshotDetail,
  SnapshotDiffData,
  SnapshotInfo,
  SnapshotOperationState,
  SnapshotView,
} from "../types"
import {
  computed,
  onMounted,
  reactive,
  ref,
} from "vue"
import {
  createSnapshot,
  downloadCloudSnapshot,
  getCloudRepoTagSnapshots,
  getRepoSnapshotContent,
  getRepoSnapshots,
  importRepo,
  removeCloudRepoTag,
} from "@/api"
import { useStatusBarTask } from "@/features/statusBar/composables/useStatusBarTask"

export function useDataSnapshot(plugin: Plugin) {
  const snapshotTask = useStatusBarTask("dataSnapshot", "mdi:camera-marker")

  const i18n = computed(() => (plugin.i18n as any)?.dataSnapshot || {})

  const currentView = ref<SnapshotView>("local")
  const snapshots = ref<SnapshotInfo[]>([])
  const cloudTags = ref<CloudSnapshotTag[]>([])
  const selectedSnapshot = ref<SnapshotDetail | null>(null)
  const diffData = ref<SnapshotDiffData | null>(null)
  const memo = ref("")
  const compareMode = ref(false)
  const compareIds = ref<[string, string] | null>(null)
  const loading = ref(false)
  const cloudLoading = ref(false)

  const op = reactive<SnapshotOperationState>({
    creating: false,
    restoring: null,
    uploading: null,
    downloading: null,
    removing: null,
    loadingContent: null,
  })

  async function loadLocalSnapshots() {
    loading.value = true
    try {
      snapshots.value = await getRepoSnapshots()
    } catch {
      snapshots.value = []
    } finally {
      loading.value = false
    }
  }

  async function createSnapshotAction() {
    if (op.creating) return
    const memoText = memo.value.trim() || `${i18n.value.createSnapshot || "快照"} ${new Date().toLocaleString()}`
    op.creating = true
    snapshotTask.progress({ label: i18n.value.createSnapshot || "创建快照" })
    try {
      await createSnapshot(memoText)
      memo.value = ""
      await loadLocalSnapshots()
      snapshotTask.complete(i18n.value.createSuccess || "快照创建成功")
    } catch {
      snapshotTask.fail(i18n.value.createFailed || "快照创建失败")
    } finally {
      op.creating = false
    }
  }

  async function viewSnapshot(id: string) {
    op.loadingContent = id
    try {
      const files = await getRepoSnapshotContent(id)
      const snapshot = snapshots.value.find(s => s.id === id)
      if (snapshot) {
        selectedSnapshot.value = { snapshot, files }
        currentView.value = "detail"
      }
    } catch {
      // ignore
    } finally {
      op.loadingContent = null
    }
  }

  async function restoreSnapshot(id: string) {
    if (op.restoring) return
    op.restoring = id
    snapshotTask.progress({ label: i18n.value.restoring || "正在恢复..." })
    try {
      await importRepo(id)
      snapshotTask.complete(i18n.value.restoreSuccess || "快照恢复成功")
    } catch (e: any) {
      console.error("[dataSnapshot] restore error:", e?.message || e)
      snapshotTask.fail(e?.message || i18n.value.restoreFailed || "快照恢复失败")
    } finally {
      op.restoring = null
    }
  }

  async function loadCloudSnapshots() {
    cloudLoading.value = true
    try {
      cloudTags.value = await getCloudRepoTagSnapshots()
    } catch {
      cloudTags.value = []
    } finally {
      cloudLoading.value = false
    }
  }

  async function downloadFromCloud(tag: string, id: string) {
    if (op.downloading) return
    op.downloading = id
    snapshotTask.progress({ label: i18n.value.downloading || "正在下载..." })
    try {
      await downloadCloudSnapshot(tag, id)
      await loadLocalSnapshots()
      snapshotTask.complete(i18n.value.downloadSuccess || "快照下载成功")
    } catch (e: any) {
      console.error("[dataSnapshot] download error:", e?.message || e)
      snapshotTask.fail(e?.message || i18n.value.downloadFailed || "快照下载失败")
    } finally {
      op.downloading = null
    }
  }

  async function removeCloudTag(tag: string) {
    if (op.removing) return
    op.removing = tag
    try {
      await removeCloudRepoTag(tag)
      await loadCloudSnapshots()
    } catch {
      // ignore
    } finally {
      op.removing = null
    }
  }

  function toggleCompare(id: string) {
    if (!compareIds.value) {
      compareIds.value = [id, ""] as [string, string]
    } else if (compareIds.value[0] === id) {
      compareIds.value = null
    } else if (!compareIds.value[1]) {
      compareIds.value = [compareIds.value[0], id]
    } else {
      compareIds.value = [id, ""] as [string, string]
    }
  }

  async function compareSnapshots() {
    if (!compareIds.value || !compareIds.value[0] || !compareIds.value[1]) return
    const [idA, idB] = compareIds.value
    const snapA = snapshots.value.find(s => s.id === idA)
    const snapB = snapshots.value.find(s => s.id === idB)
    if (!snapA || !snapB) return

    loading.value = true
    try {
      const [filesA, filesB] = await Promise.all([
        getRepoSnapshotContent(idA),
        getRepoSnapshotContent(idB),
      ])
      diffData.value = {
        snapshotA: { snapshot: snapA, files: filesA },
        snapshotB: { snapshot: snapB, files: filesB },
      }
      currentView.value = "diff"
    } catch {
      // ignore
    } finally {
      loading.value = false
    }
  }

  function backToList() {
    currentView.value = "local"
    selectedSnapshot.value = null
    diffData.value = null
    compareMode.value = false
    compareIds.value = null
  }

  function switchTab(tab: SnapshotView) {
    currentView.value = tab
    selectedSnapshot.value = null
    diffData.value = null
    if (tab === "cloud" && cloudTags.value.length === 0) {
      loadCloudSnapshots()
    }
  }

  onMounted(() => {
    loadLocalSnapshots()
  })

  return {
    currentView,
    snapshots,
    cloudTags,
    selectedSnapshot,
    diffData,
    memo,
    compareMode,
    compareIds,
    loading,
    cloudLoading,
    op,
    i18n,
    loadLocalSnapshots,
    createSnapshotAction,
    viewSnapshot,
    restoreSnapshot,
    loadCloudSnapshots,
    downloadFromCloud,
    removeCloudTag,
    toggleCompare,
    compareSnapshots,
    backToList,
    switchTab,
  }
}
