/**
 * 数据管理 - 备份 zip 解析回归测试
 *
 * 关键回归：SiYuan `saveData` 对字符串值原样落盘（`xsmall` / `head`），
 * 备份 zip 里的 JSON 槽并非都是合法 JSON，不能被判为损坏。
 */
import * as fs from "node:fs"
import * as path from "node:path"
import JSZip from "jszip"
import { describe, expect, it } from "vitest"
import type { Plugin } from "siyuan"
import { loadBackupZip } from "./backup"
import type { StorageContext } from "./context"

const ctx = {
  plugin: {} as Plugin,
  dataDir: "/nonexistent",
  fs,
  path,
} as StorageContext

async function makeZipFile(entries: Record<string, string>): Promise<File> {
  const zip = new JSZip()
  for (const [name, content] of Object.entries(entries)) {
    zip.file(name, content)
  }
  const buffer = await zip.generateAsync({ type: "nodebuffer" })
  return new File([new Uint8Array(buffer)], "sn-plugin.zip", { type: "application/zip" })
}

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

  it("只有字符串槽的备份也算有可还原数据", async () => {
    const file = await makeZipFile({ "component-preview-size": "small" })
    const { payload, report } = await loadBackupZip(ctx, file)

    expect(payload).not.toBeNull()
    expect(report.failed).toEqual([])
  })
})
