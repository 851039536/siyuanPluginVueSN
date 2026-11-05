/**
 * 数据管理 - 备份 zip 解析回归测试
 *
 * 关键回归：
 * 1. SiYuan `saveData` 对字符串值原样落盘（`xsmall` / `head`），不是合法 JSON；
 * 2. 备份里的 `plugin.db` 可能为 0 字节（快照未 await），必须显式失败而非静默跳过；
 * 3. 正常备份需同时读出表数据与建表语句。
 */
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import JSZip from "jszip"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { Plugin } from "siyuan"
import { loadBackupZip } from "./backup"
import type { StorageContext } from "./context"

let realSqlite: typeof import("node:sqlite") | null = null
try {
  realSqlite = await import("node:sqlite")
} catch {
  // Node < 22.5 无 node:sqlite，跳过真实库用例
}

const state = vi.hoisted(() => ({ root: "" }))

vi.mock("@/utils/workspaceDir", () => ({
  readWorkspaceDir: async () => state.root,
  readWorkspaceDirSync: () => state.root,
}))

vi.mock("@/utils/sqliteDb", async () => {
  let sqlite: typeof import("node:sqlite") | null = null
  try {
    sqlite = await import("node:sqlite")
  } catch {
    sqlite = null
  }
  return { getSqlite: () => sqlite }
})

const ctx = {
  plugin: {} as Plugin,
  dataDir: "/nonexistent",
  fs,
  path,
} as StorageContext

const tempDirs: string[] = []

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "backup-spec-"))
  tempDirs.push(dir)
  return dir
}

async function makeZipFile(entries: Record<string, string | Uint8Array>): Promise<File> {
  const zip = new JSZip()
  for (const [name, content] of Object.entries(entries)) {
    zip.file(name, content)
  }
  const buffer = await zip.generateAsync({ type: "nodebuffer" })
  return new File([new Uint8Array(buffer)], "sn-plugin.zip", { type: "application/zip" })
}

beforeEach(() => {
  state.root = makeTempDir()
})

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe("loadBackupZip", () => {
  it("字符串槽按原始文本读入，不产生 invalidJson", async () => {
    const file = await makeZipFile({
      "component-preview-size": "xsmall",
      "git-push-branch-mode": "head",
    })
    const { payload, report } = await loadBackupZip(ctx, file)

    expect(report.failed).toEqual([])
    expect(payload?.slots["component-preview-size"]).toBe("xsmall")
    expect(payload?.slots["git-push-branch-mode"]).toBe("head")
  })

  it("对象槽保留原文件文本（写回时 saveData 原样落盘）", async () => {
    const raw = "{\"aiApiKeys\":\"enc:xxx\"}"
    const file = await makeZipFile({ "plugin-settings": raw })
    const { payload, report } = await loadBackupZip(ctx, file)

    expect(report.failed).toEqual([])
    expect(payload?.slots["plugin-settings"]).toBe(raw)
  })

  it("0 字节 plugin.db 显式上报 backupDbEmpty，JSON 仍可还原", async () => {
    const file = await makeZipFile({
      "component-preview-size": "small",
      "plugin.db": new Uint8Array(0),
    })
    const { payload, report } = await loadBackupZip(ctx, file)

    expect(report.failed).toContainEqual({ slotId: "core.pluginDb", error: "backupDbEmpty" })
    expect(payload?.slots["component-preview-size"]).toBe("small")
  })
})

describe.skipIf(!realSqlite)("loadBackupZip - SQLite", () => {
  it("读出表数据与建表语句", async () => {
    const dbPath = path.join(makeTempDir(), "plugin.db")
    const db = new realSqlite!.DatabaseSync(dbPath)
    db.exec("CREATE TABLE wn_entries (id TEXT PRIMARY KEY, name TEXT)")
    db.exec("INSERT INTO wn_entries VALUES ('a', 'A')")
    db.close()

    const file = await makeZipFile({ "plugin.db": new Uint8Array(fs.readFileSync(dbPath)) })
    const { payload, report } = await loadBackupZip(ctx, file)

    expect(report.failed).toEqual([])
    expect(payload?.tables["wn_entries"]).toEqual([{ id: "a", name: "A" }])
    expect(payload?.schemas?.["wn_entries"]).toMatch(/^CREATE TABLE/)
  })
})
