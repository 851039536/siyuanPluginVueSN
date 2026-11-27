/**
 * 提权助手 - 面板共享状态与动作
 *
 * 负责：加载工具、诊断、创建/重建/删除快捷方式、以管理员身份运行、当前权限刷新。
 * 诊断结果只存在内存；持久化仅包含工具元数据与快捷方式路径。
 */
import type { Plugin } from "siyuan"
import type {
  CreateShortcutOutcome,
  ElevationTool,
  PermissionDiagnosis,
  PrivilegeResult,
  RunOutcome,
  ShortcutLocation,
  ToolDraft,
} from "../types"
import {
  computed,
  onUnmounted,
  reactive,
  ref,
} from "vue"
import { getNodeModules } from "@/utils/nodeModules"
import { diagnoseExecutable } from "../managers/diagnostics"
import { deleteShortcutFile, inspectShortcut } from "../managers/shortcutFiles"
import type { WindowsShellService } from "../managers/WindowsShell"
import { ElevationAssistantStorage } from "../types/storage"
import {
  MAX_SHORTCUTS_PER_TOOL,
  MAX_TOOLS,
  createToolId,
  findShortcutOwner,
} from "../utils/tools"
import {
  normalizeShortcutName,
  validateShortcutName,
} from "../utils/shortcut"
import {
  defaultWorkingDir,
  normalizeTargetPath,
  validateTargetPathInput,
  validateWorkingDirInput,
  windowsDirname,
} from "../utils/validation"

export interface ShortcutStatus {
  exists: boolean
  valid: boolean
  runAsAdmin: boolean
  error?: string
}

export interface CreateToolResult {
  ok: boolean
  error?: string
  tool?: ElevationTool
  shortcut?: CreateShortcutOutcome
}

export interface UpdateToolResult {
  ok: boolean
  error?: string
  shortcutResults?: CreateShortcutOutcome[]
}

export interface DeleteToolResult {
  failures: { path: string, error?: string }[]
}

export interface UseElevationAssistantOptions {
  plugin: Plugin
  shell: WindowsShellService
  i18n: Record<string, string>
}

export function useElevationAssistant(options: UseElevationAssistantOptions) {
  const storage = new ElevationAssistantStorage(options.plugin)
  const tools = ref<ElevationTool[]>([])
  const diagnoses = reactive(new Map<string, PermissionDiagnosis>())
  const shortcutStatuses = reactive(new Map<string, ShortcutStatus>())
  const busyIds = reactive(new Set<string>())
  const loading = ref(false)
  const refreshing = ref(false)
  const privilege = ref<PrivilegeResult | null>(null)
  const privilegeLoading = ref(false)
  const saveError = ref("")
  let disposed = false

  const i18n = options.i18n
  const shell = options.shell

  const hasTools = computed(() => tools.value.length > 0)

  function diagnosisFor(toolId: string): PermissionDiagnosis | undefined {
    return diagnoses.get(toolId)
  }

  function shortcutStatusFor(path: string): ShortcutStatus | undefined {
    return shortcutStatuses.get(path.toLowerCase())
  }

  function isBusy(toolId: string): boolean {
    return busyIds.has(toolId)
  }

  function errorText(key: string): string {
    return i18n[key] || key
  }

  async function persist(): Promise<boolean> {
    try {
      const ok = await storage.saveTools(tools.value)
      saveError.value = ok ? "" : (i18n.saveFailed)
      return ok
    } catch (error) {
      saveError.value = error instanceof Error ? error.message : String(error)
      return false
    }
  }

  async function validateDraft(draft: ToolDraft): Promise<string | null> {
    const nameError = validateShortcutName(draft.name)
    if (nameError === "empty") return errorText("nameRequired")
    if (nameError === "tooLong") return errorText("nameTooLong")
    if (nameError === "invalidChars") return errorText("nameInvalidChars")
    if (nameError === "reserved") return errorText("nameReserved")
    if (nameError === "trailing") return errorText("nameTrailing")

    const pathError = validateTargetPathInput(draft.path)
    if (pathError === "empty") return errorText("pathRequired")
    if (pathError === "notAbsolute") return errorText("pathNotAbsolute")
    if (pathError === "notExe") return errorText("pathNotExe")
    if (pathError === "tooLong") return errorText("pathTooLong")

    const workDirError = validateWorkingDirInput(draft.workingDir)
    if (workDirError === "notAbsolute") return errorText("workDirNotAbsolute")
    if (workDirError === "tooLong") return errorText("workDirTooLong")

    if (draft.location === "custom" && !normalizeTargetPath(draft.customDir)) {
      return errorText("customDirRequired")
    }

    const node = getNodeModules()
    if (!node) return errorText("envNotSupported")
    try {
      const target = normalizeTargetPath(draft.path)
      const stat = await node.fs.promises.stat(target)
      if (!stat.isFile()) return errorText("pathNotFile")
    } catch {
      return errorText("pathMissing")
    }

    if (normalizeTargetPath(draft.workingDir)) {
      try {
        const dirStat = await node.fs.promises.stat(normalizeTargetPath(draft.workingDir))
        if (!dirStat.isDirectory()) return errorText("workDirNotDir")
      } catch {
        return errorText("workDirMissing")
      }
    }

    if (draft.location === "custom") {
      const customDir = normalizeTargetPath(draft.customDir)
      try {
        const customStat = await node.fs.promises.stat(customDir)
        if (!customStat.isDirectory()) return errorText("customDirNotDir")
      } catch {
        return errorText("customDirMissing")
      }
    }

    return null
  }

  async function refreshPrivilege(): Promise<void> {
    if (privilegeLoading.value) return
    privilegeLoading.value = true
    try {
      const result = await shell.getPrivilegeStatus()
      // 面板已卸载时不再写入：组件销毁后更新状态没有意义，也避免持在旧实例上
      if (disposed) return
      privilege.value = result
    } finally {
      privilegeLoading.value = false
    }
  }

  async function refreshShortcutStatuses(tool: ElevationTool): Promise<boolean> {
    let changed = false
    for (const record of tool.shortcuts) {
      const status = await inspectShortcut(record.path)
      if (disposed) return changed
      shortcutStatuses.set(record.path.toLowerCase(), status)
      if (status.exists && status.valid && status.runAsAdmin !== record.runAsAdmin) {
        record.runAsAdmin = status.runAsAdmin
        changed = true
      }
    }
    return changed
  }

  async function diagnoseTool(tool: ElevationTool): Promise<void> {
    try {
      const diagnosis = await diagnoseExecutable(tool.path)
      if (disposed) return
      diagnoses.set(tool.id, diagnosis)
    } catch (error) {
      if (disposed) return
      diagnoses.set(tool.id, {
        checkedAt: Date.now(),
        exists: false,
        kind: "error",
        arch: "unknown",
        size: 0,
        manifestSource: "unreadable",
        manifestLevel: "unknown",
        uiAccess: false,
        requiresAdmin: false,
        recommendedElevate: false,
        recommendation: "unknown",
        reasonCode: "readError",
        error: error instanceof Error ? error.message : String(error),
      })
    }
    const changed = await refreshShortcutStatuses(tool)
    if (changed && !disposed) await persist()
  }

  async function refreshAll(): Promise<void> {
    if (refreshing.value) return
    refreshing.value = true
    try {
      const queue = [...tools.value]
      let changed = false
      const worker = async () => {
        while (queue.length > 0) {
          if (disposed) return
          const tool = queue.shift()
          if (!tool) return
          try {
            const diagnosis = await diagnoseExecutable(tool.path)
            if (disposed) return
            diagnoses.set(tool.id, diagnosis)
            if (await refreshShortcutStatuses(tool)) changed = true
          } catch (error) {
            if (disposed) return
            diagnoses.set(tool.id, {
              checkedAt: Date.now(),
              exists: false,
              kind: "error",
              arch: "unknown",
              size: 0,
              manifestSource: "unreadable",
              manifestLevel: "unknown",
              uiAccess: false,
              requiresAdmin: false,
              recommendedElevate: false,
              recommendation: "unknown",
              reasonCode: "readError",
              error: error instanceof Error ? error.message : String(error),
            })
          }
        }
      }
      const concurrency = Math.min(4, Math.max(1, queue.length))
      await Promise.all(Array.from({ length: concurrency }, () => worker()))
      if (changed && !disposed) await persist()
    } finally {
      refreshing.value = false
    }
  }

  async function load(): Promise<void> {
    if (loading.value) return
    loading.value = true
    try {
      const loaded = await storage.loadTools()
      if (disposed) return
      tools.value = loaded
      await Promise.all([
        refreshAll(),
        refreshPrivilege(),
      ])
    } catch (error) {
      saveError.value = error instanceof Error ? error.message : String(error)
    } finally {
      loading.value = false
    }
  }

  async function createTool(draft: ToolDraft, createShortcut: boolean): Promise<CreateToolResult> {
    if (tools.value.length >= MAX_TOOLS) {
      return {
        ok: false,
        error: errorText("toolLimitReached"),
      }
    }
    const error = await validateDraft(draft)
    if (error) return { ok: false, error }

    const now = Date.now()
    const path = normalizeTargetPath(draft.path)
    const tool: ElevationTool = {
      id: createToolId(),
      name: normalizeShortcutName(draft.name),
      path,
      args: draft.args,
      workingDir: normalizeTargetPath(draft.workingDir) || defaultWorkingDir(path),
      requireAdmin: draft.requireAdmin,
      shortcuts: [],
      createdAt: now,
      updatedAt: now,
    }
    tools.value = [tool, ...tools.value]
    await persist()
    await diagnoseTool(tool)

    if (!createShortcut) return { ok: true, tool }

    const shortcut = await createShortcutFor(tool.id, {
      location: draft.location,
      customDir: draft.customDir,
      overwrite: false,
    })
    return {
      ok: true,
      tool,
      shortcut,
    }
  }

  async function updateTool(
    toolId: string,
    draft: ToolDraft,
    rebuildShortcuts: boolean,
  ): Promise<UpdateToolResult> {
    const tool = tools.value.find((item) => item.id === toolId)
    if (!tool) return { ok: false, error: errorText("toolMissing") }

    const error = await validateDraft(draft)
    if (error) return { ok: false, error }

    const path = normalizeTargetPath(draft.path)
    tool.name = normalizeShortcutName(draft.name)
    tool.path = path
    tool.args = draft.args
    tool.workingDir = normalizeTargetPath(draft.workingDir) || defaultWorkingDir(path)
    tool.requireAdmin = draft.requireAdmin
    tool.updatedAt = Date.now()
    tools.value = [...tools.value].sort((a, b) => b.updatedAt - a.updatedAt)
    await persist()
    await diagnoseTool(tool)

    if (!rebuildShortcuts || tool.shortcuts.length === 0) return { ok: true }

    const shortcutResults: CreateShortcutOutcome[] = []
    for (const record of [...tool.shortcuts]) {
      const oldPath = record.path
      const result = await shell.createShortcut({
        // 名称可能已改：用当前工具名生成新文件名，旧 .lnk 成功后删除
        fileName: normalizeShortcutName(tool.name),
        targetPath: tool.path,
        args: tool.args,
        workingDir: tool.workingDir,
        description: "",
        location: "custom",
        customDir: windowsDirname(oldPath),
        runAsAdmin: tool.requireAdmin,
        overwrite: true,
      })
      shortcutResults.push(result)
      if (!result.ok) continue

      // 重命名导致路径变化时清理旧文件与旧记录（失败则保留孤儿文件，不影响新记录）
      if (result.path.toLowerCase() !== oldPath.toLowerCase()) {
        await deleteShortcutFile(oldPath)
        shortcutStatuses.delete(oldPath.toLowerCase())
        record.path = result.path
      }
      record.runAsAdmin = result.runAsAdmin
      shortcutStatuses.set(result.path.toLowerCase(), {
        exists: true,
        valid: true,
        runAsAdmin: result.runAsAdmin,
      })
    }
    await persist()
    return { ok: true, shortcutResults }
  }

  async function createShortcutFor(
    toolId: string,
    opts: { location: ShortcutLocation, customDir: string, overwrite: boolean },
  ): Promise<CreateShortcutOutcome> {
    const tool = tools.value.find((item) => item.id === toolId)
    if (!tool) {
      return {
        ok: false,
        kind: "unknown",
        message: errorText("toolMissing"),
      }
    }

    busyIds.add(toolId)
    try {
      const result = await shell.createShortcut({
        fileName: normalizeShortcutName(tool.name),
        targetPath: tool.path,
        args: tool.args,
        workingDir: tool.workingDir || defaultWorkingDir(tool.path),
        description: "",
        location: opts.location,
        customDir: normalizeTargetPath(opts.customDir),
        runAsAdmin: tool.requireAdmin,
        overwrite: opts.overwrite,
      })
      if (!result.ok) return result

      // 同一个 .lnk 只能由一个工具管理：新创建方接管，旧记录移除，
      // 否则两个工具会各自展示/删除同一文件，删除时互相影响
      const previousOwner = findShortcutOwner(tools.value, result.path, tool.id)
      if (previousOwner) {
        const target = result.path.toLowerCase()
        previousOwner.shortcuts = previousOwner.shortcuts.filter(
          (record) => record.path.toLowerCase() !== target,
        )
        previousOwner.updatedAt = Date.now()
      }

      const existing = tool.shortcuts.findIndex(
        (record) => record.path.toLowerCase() === result.path.toLowerCase(),
      )
      const record = {
        path: result.path,
        location: opts.location,
        runAsAdmin: result.runAsAdmin,
        createdAt: Date.now(),
      }
      if (existing >= 0) {
        tool.shortcuts[existing] = record
      } else {
        tool.shortcuts = [record, ...tool.shortcuts].slice(0, MAX_SHORTCUTS_PER_TOOL)
      }
      tool.updatedAt = Date.now()
      shortcutStatuses.set(record.path.toLowerCase(), {
        exists: true,
        valid: true,
        runAsAdmin: record.runAsAdmin,
      })
      await persist()
      return result
    } finally {
      busyIds.delete(toolId)
    }
  }

  async function runTool(toolId: string): Promise<RunOutcome> {
    const tool = tools.value.find((item) => item.id === toolId)
    if (!tool) {
      return {
        ok: false,
        kind: "unknown",
        message: errorText("toolMissing"),
      }
    }
    busyIds.add(toolId)
    try {
      const result = await shell.runAsAdmin(
        tool.path,
        tool.args,
        tool.workingDir || defaultWorkingDir(tool.path),
      )
      if (result.ok) {
        tool.lastRunAt = Date.now()
        tool.updatedAt = Date.now()
        await persist()
      }
      return result
    } finally {
      busyIds.delete(toolId)
    }
  }

  async function deleteTool(toolId: string): Promise<DeleteToolResult> {
    const tool = tools.value.find((item) => item.id === toolId)
    if (!tool) return { failures: [] }

    busyIds.add(toolId)
    const failures: { path: string, error?: string }[] = []
    try {
      for (const record of tool.shortcuts) {
        const result = await deleteShortcutFile(record.path)
        if (!result.ok) failures.push({ path: record.path, error: result.error })
        shortcutStatuses.delete(record.path.toLowerCase())
      }
      tools.value = tools.value.filter((item) => item.id !== toolId)
      diagnoses.delete(toolId)
      await persist()
      return { failures }
    } finally {
      busyIds.delete(toolId)
    }
  }

  async function deleteShortcut(toolId: string, shortcutPath: string): Promise<{ ok: boolean, error?: string }> {
    const tool = tools.value.find((item) => item.id === toolId)
    if (!tool) return { ok: false, error: errorText("toolMissing") }
    const exists = tool.shortcuts.some(
      (record) => record.path.toLowerCase() === shortcutPath.toLowerCase(),
    )
    if (!exists) return { ok: false, error: errorText("shortcutMissing") }

    const result = await deleteShortcutFile(shortcutPath)
    if (!result.ok) return result
    tool.shortcuts = tool.shortcuts.filter(
      (record) => record.path.toLowerCase() !== shortcutPath.toLowerCase(),
    )
    tool.updatedAt = Date.now()
    shortcutStatuses.delete(shortcutPath.toLowerCase())
    await persist()
    return { ok: true }
  }

  async function refreshTool(toolId: string): Promise<void> {
    const tool = tools.value.find((item) => item.id === toolId)
    if (!tool) return
    busyIds.add(toolId)
    try {
      await diagnoseTool(tool)
    } finally {
      busyIds.delete(toolId)
    }
  }

  function makeDraft(tool?: ElevationTool): ToolDraft {
    if (!tool) {
      return {
        name: "",
        path: "",
        args: "",
        workingDir: "",
        requireAdmin: false,
        location: "desktop",
        customDir: "",
      }
    }
    return {
      name: tool.name,
      path: tool.path,
      args: tool.args,
      workingDir: tool.workingDir,
      requireAdmin: tool.requireAdmin,
      location: tool.shortcuts[0]?.location ?? "desktop",
      customDir: tool.shortcuts[0]?.location === "custom"
        ? windowsDirname(tool.shortcuts[0].path)
        : "",
    }
  }

  onUnmounted(() => {
    disposed = true
    shell.cancelActive()
  })

  return {
    tools,
    hasTools,
    loading,
    refreshing,
    privilege,
    privilegeLoading,
    saveError,
    busyIds,
    load,
    refreshPrivilege,
    refreshAll,
    refreshTool,
    diagnoseFor: diagnosisFor,
    shortcutStatusFor,
    isBusy,
    createTool,
    updateTool,
    createShortcutFor,
    runTool,
    deleteTool,
    deleteShortcut,
    makeDraft,
    persist,
  }
}
