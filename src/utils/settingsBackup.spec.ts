/**
 * 插件整目录备份回归测试
 *
 * 备份目录可能同时包含 JSON 槽、NDJSON 与图片文件；zip 必须原样收录，
 * 还原时必须原样写回。插件已不使用 SQLite，因此不再有快照/ WAL 特殊处理。
 */
import * as fs from "node:fs"
import * as os from "node:os"
import * as path from "node:path"
import JSZip from "jszip"
import { afterEach, describe, expect, it, vi } from "vitest"
import type { Plugin } from "siyuan"
import {
  backupPluginData,
  deletePluginBackup,
  listPluginBackups,
  restoreFromUpload,
} from "./settingsBackup"

vi.mock("@/utils/nodeModules", async () => {
  const fsModule = await import("node:fs")
  const pathModule = await import("node:path")
  const osModule = await import("node:os")
  return {
    getNodeModules: () => ({ fs: fsModule, path: pathModule }),
    getNodeFsPathOs: () => ({ fs: fsModule, path: pathModule, os: osModule }),
  }
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

describe("backupPluginData", () => {
  it("整目录打包，包含 JSON 槽与嵌套文件", async () => {
    const workspaceRoot = makeTempDir("backup-ws-")
    const pluginDir = makeTempDir("backup-plugin-")
    fs.writeFileSync(path.join(pluginDir, "component-preview-size"), "xsmall", "utf8")
    fs.writeFileSync(
      path.join(pluginDir, "website-navigation-entries"),
      JSON.stringify([{ id: "a", name: "A" }]),
      "utf8",
    )
    fs.mkdirSync(path.join(pluginDir, "git-push-index"), { recursive: true })
    fs.writeFileSync(path.join(pluginDir, "git-push-index", "a.commits.ndjson"), "{\"h\":1}\n", "utf8")

    const plugin = { name: "test-plugin", dataDir: pluginDir } as unknown as Plugin
    const result = await backupPluginData(plugin, workspaceRoot)

    const zip = await JSZip.loadAsync(fs.readFileSync(result.filePath))
    expect(await zip.file("component-preview-size")!.async("string")).toBe("xsmall")
    expect(await zip.file("website-navigation-entries")!.async("string")).toBe("[{\"id\":\"a\",\"name\":\"A\"}]")
    expect(await zip.file("git-push-index/a.commits.ndjson")!.async("string")).toBe("{\"h\":1}\n")
  })

  it("列出与删除备份", async () => {
    const workspaceRoot = makeTempDir("backup-ws-")
    const pluginDir = makeTempDir("backup-plugin-")
    fs.writeFileSync(path.join(pluginDir, "a"), "1", "utf8")
    const plugin = { name: "test-plugin", dataDir: pluginDir } as unknown as Plugin

    const result = await backupPluginData(plugin, workspaceRoot)
    const list = listPluginBackups(workspaceRoot)
    expect(list.map((item) => item.fileName)).toContain(result.fileName)
    expect(deletePluginBackup(workspaceRoot, result.fileName)).toBe(true)
    expect(listPluginBackups(workspaceRoot)).toHaveLength(0)
  })
})

describe("restoreFromUpload", () => {
  it("把 zip 内容原样解压到插件数据目录", async () => {
    const workspaceRoot = makeTempDir("backup-ws-")
    const targetDir = makeTempDir("backup-target-")

    const zip = new JSZip()
    zip.file("website-navigation-entries", "[{\"id\":\"b\"}]")
    zip.folder("git-push-index")!.file("b.commits.ndjson", "{\"h\":2}\n")
    const buffer = await zip.generateAsync({ type: "nodebuffer" })
    const file = new File([new Uint8Array(buffer)], "sn.zip", { type: "application/zip" })

    const plugin = { name: "test-plugin", dataDir: targetDir } as unknown as Plugin
    const result = await restoreFromUpload(file, plugin, workspaceRoot)

    expect(result.restored).toBe(2)
    expect(fs.readFileSync(path.join(targetDir, "website-navigation-entries"), "utf8")).toBe("[{\"id\":\"b\"}]")
    expect(fs.readFileSync(path.join(targetDir, "git-push-index", "b.commits.ndjson"), "utf8")).toBe("{\"h\":2}\n")
  })
})
