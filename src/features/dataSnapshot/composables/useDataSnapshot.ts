import type { Plugin } from "siyuan"
import type {
  CloudSnapshotTag,
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
  const selectedSnapshot = ref<SnapshotInfo | null>(null)
  const memo = ref("")
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

  function viewSnapshot(snap: SnapshotInfo) {
    selectedSnapshot.value = snap
    currentView.value = "detail"
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

  function backToList() {
    currentView.value = "local"
    selectedSnapshot.value = null
  }

  function switchTab(tab: SnapshotView) {
    currentView.value = tab
    selectedSnapshot.value = null
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
    memo,
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
    backToList,
    switchTab,
  }
}
