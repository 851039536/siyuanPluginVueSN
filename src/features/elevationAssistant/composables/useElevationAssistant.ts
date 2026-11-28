/**
 * 提权助手 - 面板共享状态与动作
 *
 * 负责：加载工具、诊断、创建/重建/删除快捷方式、扫描本机程序、以管理员身份运行、当前权限刷新。
 * 诊断结果只存在内存；持久化仅包含工具元数据与快捷方式路径。
 */
import type { Plugin } from "siyuan"
import type { WindowsShellService } from "../managers/WindowsShell"
import type {
  CreateShortcutOutcome,
  ElevationTool,
  PermissionDiagnosis,
  PrivilegeResult,
  ProgramCandidate,
  ProgramScanOutcome,
  RunOutcome,
  ShortcutLocation,
  ShortcutStatus,
  ToolDraft,
} from "../types"
import {
  onUnmounted,
  reactive,
  ref,
} from "vue"
import { getNodeModules } from "@/utils/nodeModules"
import { runWithConcurrency } from "@/utils/s3/concurrency"
import {
  createFailedDiagnosis,
  diagnoseExecutable,
} from "../managers/diagnostics"
import {
  deleteShortcutFile,
  inspectShortcut,
} from "../managers/shortcutFiles"
import { ElevationAssistantStorage } from "../types/storage"
import {
  planProgramAdditions,
  suggestProgramName,
} from "../utils/programs"
import {
  normalizeShortcutName,
  validateShortcutName,
} from "../utils/shortcut"
import {
  createToolId,
  findShortcutOwner,
  MAX_SHORTCUTS_PER_TOOL,
  MAX_TOOLS,
} from "../utils/tools"
import {
  defaultWorkingDir,
  normalizeTargetPath,
  validateTargetPathInput,
  validateWorkingDirInput,
  windowsDirname,
} from "../utils/validation"

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
  ok: boolean
  failures: { path: string, error?: string }[]
  /** 因快捷方式删除失败而保留工具时为 true */
  retained: boolean
  error?: string
}

export interface AddProgramsResult {
  ok: boolean
  added: number
  duplicates: number
  overflow: number
  error?: string
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
  /** 操作锁：创建/更新/删除/运行/检测同一工具时互斥 */
  const busyIds = reactive(new Set<string>())
  /** 仅表示「正在读取诊断」，与操作锁分离，避免刷新时禁用按钮 */
  const diagnosingIds = reactive(new Set<string>())
  const loading = ref(false)
  const refreshing = ref(false)
  const scanning = ref(false)
  const addingPrograms = ref(false)
  const privilege = ref<PrivilegeResult | null>(null)
  const privilegeLoading = ref(false)
  const saveError = ref("")
  let disposed = false
  let persistChain: Promise<unknown> = Promise.resolve()

  const i18n = options.i18n
  const shell = options.shell

  function diagnosisFor(toolId: string): PermissionDiagnosis | undefined {
    return diagnoses.get(toolId)
  }

  function shortcutStatusFor(path: string): ShortcutStatus | undefined {
    return shortcutStatuses.get(path.toLowerCase())
  }

  function isBusy(toolId: string): boolean {
    return busyIds.has(toolId)
  }

  function isDiagnosing(toolId: string): boolean {
    return diagnosingIds.has(toolId)
  }

  function errorText(key: string): string {
    return i18n[key] || key
  }

  function acquire(toolId: string): boolean {
    if (disposed || busyIds.has(toolId)) return false
    busyIds.add(toolId)
    return true
  }

  function release(toolId: string): void {
    busyIds.delete(toolId)
  }

  /**
   * 整份写盘（串行链）。
   * 队列任务在真正执行时才读取 tools.value，避免旧快照后写覆盖新状态。
   */
  function persist(): Promise<boolean> {
    const run = persistChain.then(async () => {
      try {
        const ok = await storage.saveTools(tools.value)
        saveError.value = ok ? "" : errorText("saveFailed")
        return ok
      } catch (error) {
        saveError.value = error instanceof Error ? error.message : String(error)
        return false
      }
    })
    persistChain = run.catch(() => false)
    return run
  }

  /** 按 id 替换工具并按更新时间重排（不存在时插入） */
  function replaceTool(tool: ElevationTool): void {
    tools.value = [tool, ...tools.value.filter((item) => item.id !== tool.id)]
      .sort((a, b) => b.updatedAt - a.updatedAt)
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

  /** 统一的诊断入口：所有调用方（列表 / 编辑器 / 临时检测 / 扫描）共用 */
  async function diagnosePath(path: string): Promise<PermissionDiagnosis> {
    const target = normalizeTargetPath(path)
    if (!target) return createFailedDiagnosis("Empty target path")
    try {
      return await diagnoseExecutable(target)
    } catch (error) {
      return createFailedDiagnosis(error)
    }
  }

  async function refreshShortcutStatuses(tool: ElevationTool): Promise<boolean> {
    let changed = false
    for (const record of [...tool.shortcuts]) {
      const status = await inspectShortcut(record.path)
      if (disposed) return changed
      shortcutStatuses.set(record.path.toLowerCase(), status)
      // 只有确认存在且有效时才同步提权标记；未检测/无法检测不覆盖用户意图
      if (status.state === "exists" && status.valid && status.runAsAdmin !== record.runAsAdmin) {
        record.runAsAdmin = status.runAsAdmin
        changed = true
      }
    }
    return changed
  }

  async function diagnoseTool(tool: ElevationTool): Promise<void> {
    diagnosingIds.add(tool.id)
    try {
      const diagnosis = await diagnosePath(tool.path)
      if (disposed) return
      diagnoses.set(tool.id, diagnosis)
      const changed = await refreshShortcutStatuses(tool)
      if (changed && !disposed) await persist()
    } finally {
      diagnosingIds.delete(tool.id)
    }
  }

  async function refreshAll(): Promise<void> {
    if (refreshing.value) return
    refreshing.value = true
    try {
      const queue = tools.value.filter((tool) => !busyIds.has(tool.id))
      let changed = false
      await runWithConcurrency(queue, 4, async (tool) => {
        if (disposed) return
        diagnosingIds.add(tool.id)
        try {
          const diagnosis = await diagnosePath(tool.path)
          if (disposed) return
          diagnoses.set(tool.id, diagnosis)
          if (await refreshShortcutStatuses(tool)) changed = true
        } finally {
          diagnosingIds.delete(tool.id)
        }
      })
      if (changed && !disposed) await persist()
    } finally {
      refreshing.value = false
    }
  }

  async function load(): Promise<void> {
    if (loading.value) return
    loading.value = true
    try {
      // 重新加载前清空内存态，避免旧条目残留
      diagnoses.clear()
      shortcutStatuses.clear()
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
    if (error) {
      return {
        ok: false,
        error,
      }
    }

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
    if (!(await persist())) {
      tools.value = tools.value.filter((item) => item.id !== tool.id)
      return {
        ok: false,
        error: errorText("saveFailed"),
      }
    }
    await diagnoseTool(tool)

    if (!createShortcut) {
      return {
        ok: true,
        tool,
      }
    }

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
    const current = tools.value.find((item) => item.id === toolId)
    if (!current) {
      return {
        ok: false,
        error: errorText("toolMissing"),
      }
    }
    if (!acquire(toolId)) {
      return {
        ok: false,
        error: errorText("toolBusy"),
      }
    }

    try {
      const error = await validateDraft(draft)
      if (error) {
        return {
          ok: false,
          error,
        }
      }

      const path = normalizeTargetPath(draft.path)
      const next: ElevationTool = {
        ...current,
        name: normalizeShortcutName(draft.name),
        path,
        args: draft.args,
        workingDir: normalizeTargetPath(draft.workingDir) || defaultWorkingDir(path),
        requireAdmin: draft.requireAdmin,
        // 复制快捷方式数组：保存失败时可直接回滚引用
        shortcuts: current.shortcuts.map((record) => ({ ...record })),
        updatedAt: Date.now(),
      }
      replaceTool(next)
      if (!(await persist())) {
        replaceTool(current)
        return {
          ok: false,
          error: errorText("saveFailed"),
        }
      }
      await diagnoseTool(next)

      if (!rebuildShortcuts || next.shortcuts.length === 0) return { ok: true }

      const shortcutResults: CreateShortcutOutcome[] = []
      for (const record of [...next.shortcuts]) {
        // 每个 await 之后复核工具是否仍在列表（可能已被删除）
        if (!tools.value.some((item) => item.id === toolId)) {
          return {
            ok: false,
            error: errorText("toolMissing"),
            shortcutResults,
          }
        }
        const oldPath = record.path
        const result = await shell.createShortcut({
          // 名称可能已改：用当前工具名生成新文件名，旧 .lnk 成功后删除
          fileName: normalizeShortcutName(next.name),
          targetPath: next.path,
          args: next.args,
          workingDir: next.workingDir,
          location: "custom",
          customDir: windowsDirname(oldPath),
          runAsAdmin: next.requireAdmin,
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
          state: "exists",
          valid: true,
          runAsAdmin: result.runAsAdmin,
        })
      }
      if (!(await persist())) {
        return {
          ok: false,
          error: errorText("saveFailed"),
          shortcutResults,
        }
      }
      return {
        ok: true,
        shortcutResults,
      }
    } finally {
      release(toolId)
    }
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
    if (!acquire(toolId)) {
      return {
        ok: false,
        kind: "unknown",
        message: errorText("toolBusy"),
      }
    }
    try {
      // 达到上限时拒绝创建：不生成文件、也不静默淘汰旧记录
      if (tool.shortcuts.length >= MAX_SHORTCUTS_PER_TOOL) {
        return {
          ok: false,
          kind: "limit",
          message: errorText("shortcutLimitReached"),
        }
      }

      const result = await shell.createShortcut({
        fileName: normalizeShortcutName(tool.name),
        targetPath: tool.path,
        args: tool.args,
        workingDir: tool.workingDir || defaultWorkingDir(tool.path),
        location: opts.location,
        customDir: normalizeTargetPath(opts.customDir),
        runAsAdmin: tool.requireAdmin,
        overwrite: opts.overwrite,
      })
      if (!result.ok) return result

      // PowerShell 返回后工具可能已被删除：不再写入，只把已生成的路径告知调用方
      const live = tools.value.find((item) => item.id === toolId)
      if (!live) {
        return {
          ok: false,
          kind: "unknown",
          message: `${errorText("toolMissing")} ${result.path}`,
        }
      }

      const beforeShortcuts = live.shortcuts.map((record) => ({ ...record }))
      const beforeUpdatedAt = live.updatedAt
      // 同一个 .lnk 只能由一个工具管理：新创建方接管，旧记录移除，
      // 否则两个工具会各自展示/删除同一文件，删除时互相影响
      const previousOwner = findShortcutOwner(tools.value, result.path, toolId)
      const previousOwnerShortcuts = previousOwner ? [...previousOwner.shortcuts] : null
      const previousOwnerUpdatedAt = previousOwner?.updatedAt ?? 0
      if (previousOwner) {
        const target = result.path.toLowerCase()
        previousOwner.shortcuts = previousOwner.shortcuts.filter(
          (record) => record.path.toLowerCase() !== target,
        )
        previousOwner.updatedAt = Date.now()
      }

      const existing = live.shortcuts.findIndex(
        (record) => record.path.toLowerCase() === result.path.toLowerCase(),
      )
      const record = {
        path: result.path,
        location: opts.location,
        runAsAdmin: result.runAsAdmin,
        createdAt: Date.now(),
      }
      if (existing >= 0) {
        live.shortcuts[existing] = record
      } else {
        live.shortcuts = [record, ...live.shortcuts]
      }
      live.updatedAt = Date.now()
      shortcutStatuses.set(record.path.toLowerCase(), {
        state: "exists",
        valid: true,
        runAsAdmin: record.runAsAdmin,
      })

      if (!(await persist())) {
        // 记录未落盘：回滚内存，避免重启后记录与磁盘不一致
        live.shortcuts = beforeShortcuts
        live.updatedAt = beforeUpdatedAt
        if (previousOwner && previousOwnerShortcuts) {
          previousOwner.shortcuts = previousOwnerShortcuts
          previousOwner.updatedAt = previousOwnerUpdatedAt
        }
        shortcutStatuses.delete(record.path.toLowerCase())
        return {
          ok: false,
          kind: "unknown",
          message: `${errorText("shortcutSaveFailed")} ${result.path}`,
        }
      }
      return result
    } finally {
      release(toolId)
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
    if (!acquire(toolId)) {
      return {
        ok: false,
        kind: "unknown",
        message: errorText("toolBusy"),
      }
    }
    try {
      const result = await shell.runAsAdmin(
        tool.path,
        tool.args,
        tool.workingDir || defaultWorkingDir(tool.path),
      )
      if (result.ok) {
        const live = tools.value.find((item) => item.id === toolId)
        if (live) {
          live.lastRunAt = Date.now()
          live.updatedAt = Date.now()
          // 仅记录“最近运行”，保存失败不阻断运行结果，但会设置 saveError
          await persist()
        }
      }
      return result
    } finally {
      release(toolId)
    }
  }

  async function deleteTool(toolId: string): Promise<DeleteToolResult> {
    const tool = tools.value.find((item) => item.id === toolId)
    if (!tool) {
      return {
        ok: false,
        failures: [],
        retained: false,
      }
    }
    if (!acquire(toolId)) {
      return {
        ok: false,
        failures: [],
        retained: true,
        error: errorText("toolBusy"),
      }
    }

    try {
      const failures: { path: string, error?: string }[] = []
      const removed = new Set<string>()
      for (const record of [...tool.shortcuts]) {
        const result = await deleteShortcutFile(record.path)
        if (result.ok) {
          removed.add(record.path.toLowerCase())
          shortcutStatuses.delete(record.path.toLowerCase())
        } else {
          failures.push({
            path: record.path,
            error: result.error,
          })
        }
      }

      if (failures.length > 0) {
        // 删除失败的 .lnk 仍是孤儿文件：保留工具与失败记录，用户可重试
        tool.shortcuts = tool.shortcuts.filter(
          (record) => !removed.has(record.path.toLowerCase()),
        )
        tool.updatedAt = Date.now()
        await persist()
        return {
          ok: false,
          failures,
          retained: true,
        }
      }

      tools.value = tools.value.filter((item) => item.id !== toolId)
      diagnoses.delete(toolId)
      if (!(await persist())) {
        // 落盘失败时恢复工具，避免 UI 与磁盘分叉
        replaceTool(tool)
        return {
          ok: false,
          failures: [],
          retained: true,
          error: errorText("saveFailed"),
        }
      }
      return {
        ok: true,
        failures: [],
        retained: false,
      }
    } finally {
      release(toolId)
    }
  }

  async function deleteShortcut(
    toolId: string,
    shortcutPath: string,
  ): Promise<{ ok: boolean, error?: string }> {
    const tool = tools.value.find((item) => item.id === toolId)
    if (!tool) {
      return {
        ok: false,
        error: errorText("toolMissing"),
      }
    }
    if (!acquire(toolId)) {
      return {
        ok: false,
        error: errorText("toolBusy"),
      }
    }
    try {
      const exists = tool.shortcuts.some(
        (record) => record.path.toLowerCase() === shortcutPath.toLowerCase(),
      )
      if (!exists) {
        return {
          ok: false,
          error: errorText("shortcutMissing"),
        }
      }

      const result = await deleteShortcutFile(shortcutPath)
      if (!result.ok) return result

      const beforeShortcuts = [...tool.shortcuts]
      const beforeUpdatedAt = tool.updatedAt
      tool.shortcuts = tool.shortcuts.filter(
        (record) => record.path.toLowerCase() !== shortcutPath.toLowerCase(),
      )
      tool.updatedAt = Date.now()
      shortcutStatuses.delete(shortcutPath.toLowerCase())
      if (!(await persist())) {
        tool.shortcuts = beforeShortcuts
        tool.updatedAt = beforeUpdatedAt
        return {
          ok: false,
          error: errorText("saveFailed"),
        }
      }
      return { ok: true }
    } finally {
      release(toolId)
    }
  }

  async function refreshTool(toolId: string): Promise<void> {
    const tool = tools.value.find((item) => item.id === toolId)
    if (!tool) return
    if (!acquire(toolId)) return
    try {
      await diagnoseTool(tool)
    } finally {
      release(toolId)
    }
  }

  async function scanPrograms(): Promise<ProgramScanOutcome> {
    if (scanning.value) {
      return {
        ok: false,
        kind: "unknown",
        message: errorText("operationInProgress"),
      }
    }
    scanning.value = true
    try {
      const outcome = await shell.scanPrograms()
      if (disposed) {
        return {
          ok: false,
          kind: "unknown",
          message: errorText("operationInProgress"),
        }
      }
      return outcome
    } finally {
      scanning.value = false
    }
  }

  /** 批量加入扫描结果：一次落盘，失败整体回滚 */
  async function addPrograms(candidates: ProgramCandidate[]): Promise<AddProgramsResult> {
    if (addingPrograms.value) {
      return {
        ok: false,
        added: 0,
        duplicates: 0,
        overflow: 0,
        error: errorText("operationInProgress"),
      }
    }
    addingPrograms.value = true
    try {
      const plan = planProgramAdditions(
        tools.value.map((tool) => tool.path),
        candidates,
        MAX_TOOLS,
      )
      if (plan.accepted.length === 0) {
        return {
          ok: true,
          added: 0,
          duplicates: plan.duplicateCount,
          overflow: plan.overflowCount,
        }
      }

      const created: (ElevationTool | null)[] = Array.from(
        { length: plan.accepted.length },
        () => null,
      )
      const pendingDiagnoses = new Map<string, PermissionDiagnosis>()
      await runWithConcurrency(
        plan.accepted.map((candidate, index) => ({
          candidate,
          index,
        })),
        4,
        async ({
          candidate,
          index,
        }) => {
          const diagnosis = await diagnosePath(candidate.path)
          if (disposed) return
          const now = Date.now()
          const tool: ElevationTool = {
            id: createToolId(),
            name: suggestProgramName(candidate, i18n.defaultToolName),
            path: candidate.path,
            args: "",
            workingDir: defaultWorkingDir(candidate.path),
            requireAdmin: diagnosis.recommendedElevate,
            shortcuts: [],
            createdAt: now,
            updatedAt: now,
          }
          created[index] = tool
          pendingDiagnoses.set(tool.id, diagnosis)
        },
      )

      const list = created.filter((tool): tool is ElevationTool => tool !== null)
      if (list.length === 0) {
        return {
          ok: true,
          added: 0,
          duplicates: plan.duplicateCount,
          overflow: plan.overflowCount,
        }
      }

      const previous = tools.value
      tools.value = [...list, ...previous].sort((a, b) => b.updatedAt - a.updatedAt)
      for (const [id, diagnosis] of pendingDiagnoses) diagnoses.set(id, diagnosis)
      if (!(await persist())) {
        tools.value = previous
        for (const tool of list) diagnoses.delete(tool.id)
        return {
          ok: false,
          added: 0,
          duplicates: plan.duplicateCount,
          overflow: plan.overflowCount,
          error: errorText("saveFailed"),
        }
      }
      return {
        ok: true,
        added: list.length,
        duplicates: plan.duplicateCount,
        overflow: plan.overflowCount,
      }
    } finally {
      addingPrograms.value = false
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
    loading,
    refreshing,
    scanning,
    addingPrograms,
    privilege,
    privilegeLoading,
    saveError,
    load,
    refreshPrivilege,
    refreshAll,
    refreshTool,
    diagnosePath,
    diagnoseFor: diagnosisFor,
    shortcutStatusFor,
    isBusy,
    isDiagnosing,
    createTool,
    updateTool,
    createShortcutFor,
    runTool,
    deleteTool,
    deleteShortcut,
    scanPrograms,
    addPrograms,
    makeDraft,
  }
}
