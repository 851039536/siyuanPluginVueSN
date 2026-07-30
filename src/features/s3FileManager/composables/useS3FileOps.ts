/**
 * S3 文件管理器文件操作 composable
 *
 * 新建文件夹、重命名、复制、移动（复制全部成功后才删除源）、递归删除。
 * 每个操作统一 try/catch → 记录日志 → 失效缓存并刷新当前目录。
 */
import { ref } from "vue"
import { showMessage } from "siyuan"
import type { S3Client } from "@/utils/s3/s3Client"
import { copyObject, createFolder } from "@/utils/s3/s3ObjectOps"
import { runWithConcurrency } from "@/utils/s3/concurrency"
import { getErrorMessage } from "@/utils/stringUtils"
import type { FileOpLog, S3Entry, S3FileManagerI18n } from "../types"
import { FILE_OP_CONCURRENCY } from "../types"
import { buildFailDetail, joinPrefix, parentPrefix } from "../utils"

/** 复制任务对：源 key → 目标 key */
interface CopyPair {
  src: string
  dest: string
}

export function useS3FileOps(deps: {
  requireClient: () => S3Client
  i18n: S3FileManagerI18n
  addLog: (entry: Omit<FileOpLog, "id" | "time" | "hostname">) => void
  /** 写操作完成后回调：失效全部缓存 + 刷新当前目录 */
  afterMutation: () => Promise<void>
}) {
  const { i18n } = deps

  /** 是否有文件操作进行中（工具栏/菜单禁用依据） */
  const opBusy = ref(false)
  /** 批量操作进度（null 表示无进行中操作） */
  const opProgress = ref<{ label: string; done: number; total: number } | null>(null)

  // ========== 内部工具 ==========

  /** 收集条目涉及的全部对象 key（文件夹递归列举，含占位对象） */
  async function collectKeys(entry: S3Entry): Promise<string[]> {
    if (!entry.isFolder) { return [entry.key] }
    const client = deps.requireClient()
    const all = await client.list(entry.key)
    const keys = all.map((f) => f.key)
    // 文件夹占位对象可能不在列举结果中，补入以保证空文件夹也被处理
    if (!keys.includes(entry.key)) { keys.push(entry.key) }
    return keys
  }

  /** 构造条目到目标目录的复制任务对（文件夹保持相对结构） */
  async function buildCopyPairs(entry: S3Entry, destPrefix: string): Promise<CopyPair[]> {
    if (!entry.isFolder) {
      const dest = joinPrefix(destPrefix, entry.name, false)
      // 目标与源相同：复制自身后再删源会直接删掉文件，必须拦截
      if (dest === entry.key) {
        throw new Error(i18n.destSameAsSource)
      }
      return [{ src: entry.key, dest }]
    }
    const destBase = joinPrefix(destPrefix, entry.name, true)
    // 目标不能是自身或自身子目录（复制/移动进自己会无限嵌套或自毁；startsWith 已覆盖相等情形）
    if (destBase.startsWith(entry.key)) {
      throw new Error(i18n.destInsideSelf)
    }
    const keys = await collectKeys(entry)
    return keys.map((src) => ({ src, dest: destBase + src.slice(entry.key.length) }))
  }

  /** 并发执行复制任务对，返回失败的源 key 列表 */
  async function runCopies(pairs: CopyPair[], label: string): Promise<string[]> {
    const client = deps.requireClient()
    const failed: string[] = []
    let done = 0
    opProgress.value = { label, done, total: pairs.length }
    await runWithConcurrency(pairs, FILE_OP_CONCURRENCY, async (pair) => {
      try {
        await copyObject(client, pair.src, pair.dest)
      } catch (err) {
        console.warn("[S3文件管理] 复制失败:", pair.src, getErrorMessage(err))
        failed.push(pair.src)
      }
      done++
      opProgress.value = { label, done, total: pairs.length }
    })
    return failed
  }

  /** 并发删除 key 列表，返回失败的 key 列表 */
  async function runDeletes(keys: string[], label: string): Promise<string[]> {
    const client = deps.requireClient()
    const failed: string[] = []
    let done = 0
    opProgress.value = { label, done, total: keys.length }
    await runWithConcurrency(keys, FILE_OP_CONCURRENCY, async (key) => {
      try {
        await client.delete(key)
      } catch (err) {
        console.warn("[S3文件管理] 删除失败:", key, getErrorMessage(err))
        failed.push(key)
      }
      done++
      opProgress.value = { label, done, total: keys.length }
    })
    return failed
  }

  /** 操作骨架：busy 状态、统一错误提示、日志与刷新 */
  async function runOp(fn: () => Promise<void>): Promise<void> {
    if (opBusy.value) { return }
    opBusy.value = true
    try {
      await fn()
    } catch (err) {
      showMessage(getErrorMessage(err), 5000, "error")
    } finally {
      opBusy.value = false
      opProgress.value = null
      await deps.afterMutation()
    }
  }

  /** 批量条目名摘要（单条用名称，多条用数量） */
  function summarizeNames(entries: S3Entry[]): string {
    return entries.length === 1 ? entries[0].name : `${entries.length} ${i18n.itemsUnit}`
  }

  /** 过滤掉已位于目标目录的条目；全部被过滤时提示并返回 null（不产生日志与刷新） */
  function filterMovableEntries(entries: S3Entry[], destPrefix: string): S3Entry[] | null {
    const movable = entries.filter((e) => parentPrefix(e.key) !== destPrefix)
    if (movable.length === 0) {
      // 提示："目标位置与源相同，无需移动/复制"
      showMessage(i18n.destSameAsSource, 3000, "info")
      return null
    }
    return movable
  }

  // ========== 公开操作 ==========

  /** 新建文件夹（名称合法性由调用方 FmNameDialog 校验） */
  async function createNewFolder(parentDirPrefix: string, name: string): Promise<void> {
    await runOp(async () => {
      const client = deps.requireClient()
      try {
        await createFolder(client, joinPrefix(parentDirPrefix, name.trim(), true))
        deps.addLog({ type: "createFolder", action: i18n.actionCreateFolder, fileName: name.trim(), success: true })
        showMessage(i18n.createFolderSuccess, 2000, "info")
      } catch (err) {
        deps.addLog({ type: "createFolder", action: i18n.actionCreateFolder, fileName: name.trim(), success: false, message: getErrorMessage(err) })
        throw err
      }
    })
  }

  /** 重命名（复制到新名 → 全部成功后删除源） */
  async function renameEntry(entry: S3Entry, newName: string): Promise<void> {
    await runOp(async () => {
      const parent = parentPrefix(entry.key)
      const trimmed = newName.trim()
      try {
        // 借用 buildCopyPairs：key 仍为旧路径（源），name 换新名（目标拼接用）
        const pairs = await buildCopyPairs({ ...entry, name: trimmed }, parent)
        const copyFailed = await runCopies(pairs, i18n.statusCopying)
        if (copyFailed.length > 0) {
          deps.addLog({ type: "rename", action: i18n.actionRename, fileName: entry.name, success: false, message: i18n.renameFailed, detail: buildFailDetail(copyFailed) })
          throw new Error(i18n.renameFailed)
        }
        const deleteFailed = await runDeletes(pairs.map((p) => p.src), i18n.statusDeleting)
        deps.addLog({
          type: "rename", action: i18n.actionRename,
          fileName: `${entry.name} → ${trimmed}`,
          success: deleteFailed.length === 0,
          message: deleteFailed.length > 0 ? i18n.moveDeleteFailed : undefined,
          detail: buildFailDetail(deleteFailed),
        })
        showMessage(deleteFailed.length === 0 ? i18n.renameSuccess : i18n.moveDeleteFailed, 3000, deleteFailed.length === 0 ? "info" : "error")
      } catch (err) {
        if (getErrorMessage(err) !== i18n.renameFailed) {
          deps.addLog({ type: "rename", action: i18n.actionRename, fileName: entry.name, success: false, message: getErrorMessage(err) })
        }
        throw err
      }
    })
  }

  /** 复制条目到目标目录（已在目标目录的条目跳过） */
  async function copyEntries(entries: S3Entry[], destPrefix: string): Promise<void> {
    const movable = filterMovableEntries(entries, destPrefix)
    if (!movable) { return }
    await runOp(async () => {
      const pairs: CopyPair[] = []
      for (const entry of movable) {
        pairs.push(...await buildCopyPairs(entry, destPrefix))
      }
      const failed = await runCopies(pairs, i18n.statusCopying)
      deps.addLog({
        type: "copy", action: i18n.actionCopy,
        fileName: summarizeNames(movable), itemCount: pairs.length,
        success: failed.length === 0,
        message: failed.length > 0 ? `${failed.length} ${i18n.logFailed}` : undefined,
        detail: buildFailDetail(failed),
      })
      if (failed.length > 0) { throw new Error(i18n.copyFailed) }
      showMessage(i18n.copySuccess, 2000, "info")
    })
  }

  /** 移动条目到目标目录（全部复制成功后才批量删除源，失败不删源；已在目标目录的条目跳过） */
  async function moveEntries(entries: S3Entry[], destPrefix: string): Promise<void> {
    const movable = filterMovableEntries(entries, destPrefix)
    if (!movable) { return }
    await runOp(async () => {
      const pairs: CopyPair[] = []
      for (const entry of movable) {
        pairs.push(...await buildCopyPairs(entry, destPrefix))
      }
      const copyFailed = await runCopies(pairs, i18n.statusCopying)
      if (copyFailed.length > 0) {
        deps.addLog({
          type: "move", action: i18n.actionMove,
          fileName: summarizeNames(movable), itemCount: pairs.length,
          success: false, message: i18n.moveFailed, detail: buildFailDetail(copyFailed),
        })
        throw new Error(i18n.moveFailed)
      }
      const deleteFailed = await runDeletes(pairs.map((p) => p.src), i18n.statusDeleting)
      deps.addLog({
        type: "move", action: i18n.actionMove,
        fileName: summarizeNames(movable), itemCount: pairs.length,
        success: deleteFailed.length === 0,
        message: deleteFailed.length > 0 ? i18n.moveDeleteFailed : undefined,
        detail: buildFailDetail(deleteFailed),
      })
      showMessage(deleteFailed.length === 0 ? i18n.moveSuccess : i18n.moveDeleteFailed, 3000, deleteFailed.length === 0 ? "info" : "error")
    })
  }

  /** 删除条目（文件夹递归；确认弹窗由调用方处理） */
  async function deleteEntries(entries: S3Entry[]): Promise<void> {
    await runOp(async () => {
      const keySet = new Set<string>()
      for (const entry of entries) {
        for (const key of await collectKeys(entry)) { keySet.add(key) }
      }
      const failed = await runDeletes([...keySet], i18n.statusDeleting)
      deps.addLog({
        type: "delete", action: i18n.actionDelete,
        fileName: summarizeNames(entries), itemCount: keySet.size,
        success: failed.length === 0,
        message: failed.length > 0 ? `${failed.length} ${i18n.logFailed}` : undefined,
        detail: buildFailDetail(failed),
      })
      if (failed.length > 0) { throw new Error(i18n.deleteFailed) }
      showMessage(i18n.deleteSuccess, 2000, "info")
    })
  }

  return {
    opBusy,
    opProgress,
    createNewFolder,
    renameEntry,
    copyEntries,
    moveEntries,
    deleteEntries,
  }
}
