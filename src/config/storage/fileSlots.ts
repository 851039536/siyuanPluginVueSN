/**
 * 存储槽注册表 - 文件槽
 *
 * 相对路径均以插件数据目录 `<workspace>/data/storage/petal/<plugin.name>/` 为基准。
 */
import { fileSlot } from "./helpers"

export const FILE_SLOTS = [
  fileSlot("core.featureFlags", ["core"], "feature-flags.json", "功能开关快照", {
    notes: "由 plugin-settings 派生；旧实现因 dataDir 为空从未落盘，已修复为启动时解析真实目录",
  }),
  fileSlot("core.pluginDb", ["core"], "plugin.db", "插件数据库", {
    growth: true,
    notes: "SQLite 单库 + WAL（-wal/-shm）；备份必须走 snapshotTo，禁止直接复制",
  }),
  fileSlot("gitPush.index", ["gitPush"], "git-push-index", "提交索引目录", {
    growth: true,
    restorable: true,
    resettable: true,
    notes: "NDJSON 增量追加；可删除后重建",
  }),
  fileSlot("gitPush.bfgBackups", ["gitPush"], "bfg-backups", "BFG 备份 bundle", {
    growth: true,
    resettable: true,
    notes: "保留 3 份，可重生成",
  }),
  fileSlot("gitPush.bin", ["gitPush"], "bin", "BFG 工具二进制", {
    resettable: true,
    notes: "bfg-*.jar，可重新下载",
  }),
  fileSlot("imageCreation.coverFiles", ["imageCreation"], "cover", "封面图片", {
    resettable: true,
    notes: "putFile 写入的 logo 等图片",
  }),
  fileSlot("imageCreation.codeImageFiles", ["imageCreation"], "codeimage", "代码图片背景", {
    resettable: true,
    notes: "putFile 写入的背景图片",
  }),
] as const
