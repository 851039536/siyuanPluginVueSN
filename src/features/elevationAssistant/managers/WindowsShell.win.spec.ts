/**
 * Windows 实机集成测试（默认跳过，需显式开启）：
 * - PowerShell 权限检测可返回结构化结果
 * - 快捷方式真实创建后，RunAsUser 位确实被写入/清除
 * - 真实系统 exe 的 PE manifest 诊断可用
 *
 * 只使用临时目录与系统自带程序，不弹 UAC、不改系统设置。
 *
 * ⚠️ 默认不跑：会真实拉起 whoami / reg / PowerShell 子进程，在杀软扫描或高负载机器上
 * 单次启动可达 10s+，放进 `pnpm test` 会让常规单测变慢且偶发超时。需要时显式运行：
 *   PowerShell: $env:DSH_WIN_INTEGRATION="1"; pnpm exec vitest run src/features/elevationAssistant/managers
 *   bash:       DSH_WIN_INTEGRATION=1 pnpm exec vitest run src/features/elevationAssistant/managers
 */
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterAll, describe, expect, it } from "vitest"
import { diagnoseExecutable } from "./diagnostics"
import { WindowsShellService } from "./WindowsShell"
import { hasRunAsAdminFlag, isShortcutHeader } from "../utils/shortcut"

const isWindows = process.platform === "win32"
const enabled = isWindows && process.env.DSH_WIN_INTEGRATION === "1"
const workDir = enabled ? mkdtempSync(join(tmpdir(), "dsh-elevation-")) : ""

afterAll(() => {
  if (workDir) rmSync(workDir, { recursive: true, force: true })
})

describe.skipIf(!enabled)("WindowsShellService（Windows 实机）", () => {
  const shell = new WindowsShellService()
  const target = "C:\\Windows\\System32\\notepad.exe"

  it("读取当前进程权限并映射完整性级别", async () => {
    // 高负载/杀软扫描偶发拉起 whoami 超时：重试一次，避免集成测试误报
    let result = await shell.getPrivilegeStatus()
    if (!result.ok) result = await shell.getPrivilegeStatus()
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.status.integritySid).toMatch(/^S-1-16-\d+$/)
    expect(result.status.integrity).not.toBe("unknown")
    expect(typeof result.status.isAdmin).toBe("boolean")
    expect(result.status.user).not.toBe("")
    expect(typeof result.status.uacEnabled).toBe("boolean")
    // 常规桌面环境不是 Protected/System 完整性
    expect(["low", "medium", "mediumPlus", "high"]).toContain(result.status.integrity)
  }, 90000)

  it("创建带管理员标记的快捷方式，再覆盖为普通标记", async () => {
    const base = {
      fileName: "elevation-test",
      targetPath: target,
      args: "",
      workingDir: "C:\\Windows\\System32",
      description: "elevation assistant test",
      location: "custom" as const,
      customDir: workDir,
      overwrite: false,
    }

    const created = await shell.createShortcut({ ...base, runAsAdmin: true })
    expect(created).toMatchObject({ ok: true, runAsAdmin: true })
    if (!created.ok) return
    expect(created.path.toLowerCase()).toBe(join(workDir, "elevation-test.lnk").toLowerCase())

    const bytes = readFileSync(created.path)
    expect(isShortcutHeader(bytes)).toBe(true)
    expect(hasRunAsAdminFlag(bytes)).toBe(true)

    // 同名文件存在且 overwrite=false 时必须报 exists，而不是覆盖
    const conflict = await shell.createShortcut({ ...base, runAsAdmin: false })
    expect(conflict).toMatchObject({ ok: false, kind: "exists" })

    // 覆盖为普通权限：0x20 位要被清除
    const replaced = await shell.createShortcut({ ...base, runAsAdmin: false, overwrite: true })
    expect(replaced).toMatchObject({ ok: true, runAsAdmin: false })
    if (!replaced.ok) return
    expect(hasRunAsAdminFlag(readFileSync(replaced.path))).toBe(false)
  }, 150000)
})

describe.skipIf(!enabled)("diagnoseExecutable（Windows 实机）", () => {
  const candidates = [
    "C:\\Windows\\System32\\notepad.exe",
    "C:\\Windows\\System32\\taskmgr.exe",
    "C:\\Windows\\System32\\regedt32.exe",
    "C:\\Windows\\System32\\mmc.exe",
    "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
  ]

  it("真实系统 exe 的 manifest 诊断结果自洽", async () => {
    const results = []
    for (const path of candidates) {
      if (!existsSync(path)) continue
      const diagnosis = await diagnoseExecutable(path)
      results.push({ path, diagnosis })
      expect(diagnosis.kind).toBe("exe")
      expect(diagnosis.exists).toBe(true)
      expect(["x86", "x64", "arm64"]).toContain(diagnosis.arch)
      expect(["embedded", "external", "none", "unreadable"]).toContain(diagnosis.manifestSource)
      if (diagnosis.manifestLevel === "requireAdministrator") {
        expect(diagnosis.requiresAdmin).toBe(true)
        expect(diagnosis.recommendation).toBe("required")
      }
      if (diagnosis.manifestLevel === "asInvoker") {
        expect(diagnosis.requiresAdmin).toBe(false)
        expect(diagnosis.recommendation).toBe("notRequired")
      }
    }
    expect(results.length).toBeGreaterThan(0)
    // 至少有一个系统程序带内嵌清单，证明真实 PE 资源遍历（而不只是内存构造的样本）可用
    expect(results.some(({ diagnosis }) => diagnosis.manifestSource === "embedded")).toBe(true)
  }, 90000)

  it("不存在的路径返回 missing 而不是抛错", async () => {
    const diagnosis = await diagnoseExecutable(join(workDir, "not-exists.exe"))
    expect(diagnosis.exists).toBe(false)
    expect(diagnosis.kind).toBe("missing")
  })

  it("非 exe 文件标记为不支持", async () => {
    const txt = join(workDir, "a.txt")
    const { writeFileSync } = await import("node:fs")
    writeFileSync(txt, "hello")
    const diagnosis = await diagnoseExecutable(txt)
    expect(diagnosis.kind).toBe("other")
    expect(diagnosis.reasonCode).toBe("unsupportedFile")
  })
})
