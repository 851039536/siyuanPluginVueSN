/**
 * SQLite 一致性快照回归测试
 *
 * 关键回归：`node:sqlite` 的 `backup()` 是**异步** API，未 await 会得到 0 字节快照，
 * 进而让备份 zip 里的 plugin.db 为空（真实事故：还原时静默丢表）。
 */
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import { afterEach, describe, expect, it, vi } from "vitest"

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

import { snapshotDatabaseFile, snapshotDatabasesInDir } from "./sqliteSnapshot"

const temps: string[] = []

function makeTempDir(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sqlite-snapshot-"))
  temps.push(dir)
  return dir
}

function createDb(filePath: string): void {
  const db = new realSqlite!.DatabaseSync(filePath)
  db.exec("CREATE TABLE t(x INTEGER)")
  db.exec("INSERT INTO t VALUES (1),(2)")
  db.close()
}

afterEach(() => {
  for (const dir of temps.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true })
  }
})

describe.skipIf(!realSqlite)("snapshotDatabaseFile", () => {
  it("等待异步备份完成后才返回，快照非空且数据完整", async () => {
    const dir = makeTempDir()
    const src = path.join(dir, "src.db")
    const dest = path.join(dir, "dest.db")
    createDb(src)

    await expect(snapshotDatabaseFile(src, dest)).resolves.toBe(true)
    expect(fs.statSync(dest).size).toBeGreaterThan(0)

    const snapshot = new realSqlite!.DatabaseSync(dest, { readOnly: true })
    const row = snapshot.prepare("SELECT COUNT(*) AS c FROM t").get() as { c: number }
    snapshot.close()
    expect(row.c).toBe(2)
  })

  it("snapshotDatabasesInDir 产出可用快照并记录相对路径", async () => {
    const scanDir = makeTempDir()
    const tempDir = makeTempDir()
    createDb(path.join(scanDir, "a.db"))

    const entries = await snapshotDatabasesInDir(scanDir, tempDir)

    expect(entries).toHaveLength(1)
    expect(entries[0].relPath).toBe("a.db")
    expect(entries[0].snapshotPath).toBeTruthy()
    expect(fs.statSync(entries[0].snapshotPath!).size).toBeGreaterThan(0)
  })
})
