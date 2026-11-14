/**
 * 数据管理 - 备份 zip 解析回归测试
 *
 * 关键回归：
 * 1. SiYuan `saveData` 对字符串值原样落盘（`xsmall` / `head`），不是合法 JSON；
 * 2. 旧备份里的 plugin.db 必须跳过（插件已移除 SQLite），但 JSON 槽仍要还原；
 * 3. git-push-index 文件槽通过 fileSource 整目录写回。
 */
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import JSZip from "jszip"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { Plugin } from "siyuan"
import { loadBackupZip } from "./backup"
import type { StorageContext } from "./context"

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
  ctx.dataDir = makeTempDir()
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
    const { payload, report } = await loadBackupZip(file)

    expect(report.failed).toEqual([])
    expect(payload?.slots["component-preview-size"]).toBe("xsmall")
    expect(payload?.slots["git-push-branch-mode"]).toBe("head")
  })

  it("对象槽保留原文件文本（写回时 saveData 原样落盘）", async () => {
    const raw = "{\"aiApiKeys\":\"enc:xxx\"}"
    const file = await makeZipFile({ "plugin-settings": raw })
    const { payload, report } = await loadBackupZip(file)

    expect(report.failed).toEqual([])
    expect(payload?.slots["plugin-settings"]).toBe(raw)
  })

  it("旧备份中的 plugin.db 被跳过，JSON 槽仍可还原", async () => {
    const file = await makeZipFile({
      "component-preview-size": "small",
      "plugin.db": new Uint8Array([1, 2, 3]),
    })
    const { payload, report } = await loadBackupZip(file)

    expect(report.failed).toEqual([])
    expect(report.skipped).toContainEqual({ slotId: "core.pluginDb", reason: "sqliteRemoved" })
    expect(payload?.slots["component-preview-size"]).toBe("small")
  })

  it("git-push-index 通过 fileSource 整目录写回", async () => {
    const file = await makeZipFile({
      "git-push-index/a.commits.ndjson": "{\"h\":1}\n",
    })
    const { payload, report, fileSource } = await loadBackupZip(file)

    expect(payload).not.toBeNull()
    expect(report.failed).toEqual([])
    expect(fileSource).not.toBeNull()
    const count = await fileSource!.write(ctx)
    expect(count).toBe(1)
    expect(fs.readFileSync(path.join(ctx.dataDir, "git-push-index", "a.commits.ndjson"), "utf8")).toBe("{\"h\":1}\n")
  })

  it("没有可还原数据时显式失败", async () => {
    const file = await makeZipFile({ "unrelated.txt": "x" })
    const { payload, report } = await loadBackupZip(file)

    expect(payload).toBeNull()
    expect(report.failed).toContainEqual({ slotId: "*", error: "noRestorableData" })
  })
})
