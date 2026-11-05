/**
 * 插件整目录备份回归测试
 *
 * 关键回归：`node:sqlite` 的 backup() 是异步 API。此前未 await，
 * 导致生成的 zip 内 plugin.db 恒为 0 字节（真实备份实测），还原时静默丢表。
 * 本用例直接走 backupPluginData → 解压 zip → 打开快照查数据，锁死该契约。
 */
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import JSZip from "jszip"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { Plugin } from "siyuan"
import { backupPluginData } from "./settingsBackup"

let realSqlite: typeof import("node:sqlite") | null = null
try {
  realSqlite = await import("node:sqlite")
} catch {
  // Node < 22.5 无 node:sqlite，跳过真实库用例
}

vi.mock("@/utils/nodeModules", async () => {
  const fsModule = await import("node:fs")
  const pathModule = await import("node:path")
  const osModule = await import("node:os")
  return {
    getNodeModules: () => ({ fs: fsModule, path: pathModule }),
    getNodeFsPathOs: () => ({ fs: fsModule, path: pathModule, os: osModule }),
  }
})

vi.mock("@/utils/sqliteDb", async () => {
  let sqlite: typeof import("node:sqlite") | null = null
  try {
    sqlite = await import("node:sqlite")
  } catch {
    sqlite = null
  }
  return { getSqlite: () => sqlite }
})

const temps: string[] = []

function makeTempDir(prefix: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix))
  temps.push(dir)
  return dir
}

afterEach(() => {
  for (const dir of temps.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe.skipIf(!realSqlite)("backupPluginData", () => {
  it("zip 内 plugin.db 非空、可查，且不含 -wal/-shm", async () => {
    const workspaceRoot = makeTempDir("backup-ws-")
    const pluginDir = makeTempDir("backup-plugin-")
    const dbPath = path.join(pluginDir, "plugin.db")

    const db = new realSqlite!.DatabaseSync(dbPath)
    db.exec("PRAGMA journal_mode=WAL")
    db.exec("CREATE TABLE t (id TEXT PRIMARY KEY, name TEXT)")
    db.exec("INSERT INTO t VALUES ('a', 'A'), ('b', 'B')")
    db.close()

    fs.writeFileSync(path.join(pluginDir, "component-preview-size"), "xsmall", "utf8")

    const plugin = { name: "test-plugin", dataDir: pluginDir } as unknown as Plugin
    const result = await backupPluginData(plugin, workspaceRoot)

    const zip = await JSZip.loadAsync(fs.readFileSync(result.filePath))
    const dbEntry = zip.file("plugin.db")
    expect(dbEntry).toBeTruthy()
    const snapshot = await dbEntry!.async("nodebuffer")
    expect(snapshot.length).toBeGreaterThan(0)
    expect(Object.keys(zip.files).some((name) => /-wal$|-shm$/.test(name))).toBe(false)
    expect(await zip.file("component-preview-size")!.async("string")).toBe("xsmall")

    const snapPath = path.join(makeTempDir("backup-snap-"), "plugin.db")
    fs.writeFileSync(snapPath, snapshot)
    const opened = new realSqlite!.DatabaseSync(snapPath, { readOnly: true })
    const row = opened.prepare("SELECT COUNT(*) AS c FROM t").get() as { c: number }
    opened.close()
    expect(row.c).toBe(2)
  })
})
