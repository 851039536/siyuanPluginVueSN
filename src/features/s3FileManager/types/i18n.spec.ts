/**
 * S3 文件管理器文案读取测试
 *
 * 锁定白名单取值的两条契约：
 *   1. 清单内的键逐个搬运（不整体透传插件对象，避免把其他命名空间的键带进来）；
 *   2. 缺键补空串 —— 否则 `undefined` 会被拼进提示文案，渲染成 "undefined"。
 */
import { describe, it, expect } from "vitest"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import type { Plugin } from "siyuan"
import { getS3FileManagerI18n } from "./i18n"

/** 中英文分片路径（与 roots.spec.ts 同口径：vitest 的 cwd 为仓库根） */
const I18N_ZH = join(process.cwd(), "src", "i18n", "zh_CN", "s3FileManager.json")
const I18N_EN = join(process.cwd(), "src", "i18n", "en_US", "s3FileManager.json")

/** 读取分片内的 s3FileManager 命名空间 */
function readShard(filePath: string): Record<string, string> {
  const json = JSON.parse(readFileSync(filePath, "utf-8")) as { s3FileManager?: Record<string, string> }
  return json.s3FileManager ?? {}
}

/** 构造只带 i18n 的最小插件替身 */
function pluginWith(i18n: unknown): Plugin {
  return { i18n } as unknown as Plugin
}

describe("getS3FileManagerI18n", () => {
  it("按白名单搬运键值", () => {
    const i18n = getS3FileManagerI18n(pluginWith({ s3FileManager: { upload: "上传", close: "关闭" } }))

    expect(i18n.upload).toBe("上传")
    expect(i18n.close).toBe("关闭")
  })

  it("缺键补空串（而非 undefined）", () => {
    const i18n = getS3FileManagerI18n(pluginWith({ s3FileManager: { upload: "上传" } }))

    expect(i18n.overwriteConfirm).toBe("")
    expect(typeof i18n.overwriteConfirm).toBe("string")
  })

  it("插件未提供该命名空间时全部为空串", () => {
    const i18n = getS3FileManagerI18n(pluginWith({}))

    expect(i18n.upload).toBe("")
    expect(Object.values(i18n).every((v) => v === "")).toBe(true)
  })

  it("只输出白名单内的键（不整体透传 shard）", () => {
    const i18n = getS3FileManagerI18n(pluginWith({
      s3FileManager: { upload: "上传", someFutureKey: "未来新增" },
      otherFeature: { title: "别的模块" },
    }))

    expect(Object.keys(i18n)).not.toContain("someFutureKey")
    expect(Object.keys(i18n)).not.toContain("otherFeature")
  })

  it("plugin.i18n 缺失时不抛错", () => {
    expect(() => getS3FileManagerI18n({} as Plugin)).not.toThrow()
    expect(getS3FileManagerI18n({} as Plugin).upload).toBe("")
  })
})

describe("白名单与 i18n 分片的契约", () => {
  it("与 zh_CN 分片双向对齐：登记不缺失、也不多余", () => {
    const shard = readShard(I18N_ZH)
    const keys = Object.keys(getS3FileManagerI18n(pluginWith({ s3FileManager: shard }))).sort()

    // 任一方向漂移（白名单漏登记 / 白名单多登记/拼错）都会在此失败
    expect(keys).toEqual(Object.keys(shard).sort())
  })

  it("喂入完整分片后无空值：白名单里的每个键在中英文里都真实存在", () => {
    for (const path of [I18N_ZH, I18N_EN]) {
      const i18n = getS3FileManagerI18n(pluginWith({ s3FileManager: readShard(path) }))
      const missing = Object.entries(i18n).filter(([, value]) => value === "").map(([key]) => key)
      expect(missing, `${path} 缺失键`).toEqual([])
    }
  })
})
