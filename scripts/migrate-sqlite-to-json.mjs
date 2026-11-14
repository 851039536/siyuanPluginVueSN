#!/usr/bin/env node
/**
 * 一次性迁移：plugin.db（SQLite） → 思源 saveData JSON 槽
 *
 * 背景：插件已移除 SQLite（`plugin.db` 位于思源同步目录，Windows 下连接持有文件句柄
 * 会让同步引擎的 rename 覆盖失败）。本脚本把旧库里的数据写成插件运行时读取的 JSON
 * 槽文件，避免升级后书签等数据丢失。
 *
 * 用法：
 *   node scripts/migrate-sqlite-to-json.mjs                 # 自动从 .env.local 解析工作区
 *   node scripts/migrate-sqlite-to-json.mjs --data-dir=E:/siyuan/data/storage/petal/siyuan-plugin-vite-vue-sn
 *   node scripts/migrate-sqlite-to-json.mjs --workspace=E:/siyuan
 *   node scripts/migrate-sqlite-to-json.mjs --delete-db     # 迁移成功后删除 plugin.db / -wal / -shm
 *   node scripts/migrate-sqlite-to-json.mjs --force         # 覆盖已存在的非空 JSON 槽
 *
 * 特点：
 * - **建议先禁用插件（或退出思源）再运行**，避免运行中的插件同时读写同一份数据；
 * - 只读 plugin.db；默认不删除原库；
 * - 目标 JSON 槽已存在且非空时跳过（除非 --force），避免覆盖新数据；
 * - 写出后立即读回校验；
 * - 本脚本不参与插件打包，Node 24+ 才能运行（依赖 node:sqlite）。
 */
import fs from "node:fs"
import path from "node:path"
import process from "node:process"
import { DatabaseSync } from "node:sqlite"

const DEFAULT_PLUGIN_NAME = "siyuan-plugin-vite-vue-sn"

function parseArgs(argv) {
  const args = {
    workspace: "",
    dataDir: "",
    pluginName: DEFAULT_PLUGIN_NAME,
    deleteDb: false,
    force: false,
  }
  for (const raw of argv) {
    if (raw === "--delete-db") args.deleteDb = true
    else if (raw === "--force") args.force = true
    else if (raw.startsWith("--workspace=")) args.workspace = raw.slice("--workspace=".length)
    else if (raw.startsWith("--data-dir=")) args.dataDir = raw.slice("--data-dir=".length)
    else if (raw.startsWith("--plugin-name=")) args.pluginName = raw.slice("--plugin-name=".length)
    else {
      console.warn(`[migrate] 忽略未知参数: ${raw}`)
    }
  }
  return args
}

/** 从 .env.local 读取 VITE_SIYUAN_WORKSPACE_PATH（缺失返回空串） */
function readWorkspaceFromEnvFile() {
  const file = path.join(process.cwd(), ".env.local")
  if (!fs.existsSync(file)) return ""
  const text = fs.readFileSync(file, "utf8")
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*VITE_SIYUAN_WORKSPACE_PATH\s*=\s*(.+?)\s*$/)
    if (match) return match[1].replace(/^["']|["']$/g, "")
  }
  return ""
}

function resolveDataDir(args) {
  if (args.dataDir) return path.resolve(args.dataDir)
  if (args.workspace) {
    return path.join(path.resolve(args.workspace), "data", "storage", "petal", args.pluginName)
  }
  const fromEnv = readWorkspaceFromEnvFile()
  if (fromEnv) {
    return path.join(path.resolve(fromEnv), "data", "storage", "petal", args.pluginName)
  }
  return ""
}

/** 读取目标 JSON 槽（不存在 / 空串 / 解析失败返回 null） */
function readTargetJson(file) {
  if (!fs.existsSync(file)) return null
  try {
    const raw = fs.readFileSync(file, "utf8")
    if (!raw.trim()) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

function isEmptyJsonValue(value) {
  if (value === null) return true
  if (Array.isArray(value)) return value.length === 0
  if (typeof value === "object") return Object.keys(value).length === 0
  return false
}

function writeJsonSlot(dataDir, fileName, value, { force, written, skipped }) {
  const file = path.join(dataDir, fileName)
  const existing = readTargetJson(file)
  if (!isEmptyJsonValue(existing) && !force) {
    skipped.push(`${fileName}（已存在非空 JSON 槽，跳过；用 --force 覆盖）`)
    return
  }
  const text = JSON.stringify(value)
  fs.writeFileSync(file, text, "utf8")
  // 读回校验：保证插件 loadData 能解析
  const check = JSON.parse(fs.readFileSync(file, "utf8"))
  if (JSON.stringify(check) !== text) {
    throw new Error(`写出后校验失败: ${fileName}`)
  }
  written.push(`${fileName}（${text.length} 字节）`)
}

function tableExists(db, name) {
  const row = db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name)
  return Boolean(row)
}

function rows(db, name) {
  if (!tableExists(db, name)) return []
  return db.prepare(`SELECT * FROM "${name}"`).all()
}

function toNumber(value) {
  const n = Number(value)
  return Number.isFinite(n) ? n : 0
}

function toNullableNumber(value) {
  if (value === null || value === undefined) return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

const args = parseArgs(process.argv.slice(2))
const dataDir = resolveDataDir(args)
if (!dataDir) {
  console.error("[migrate] 无法确定插件数据目录。请传 --data-dir=<petal 目录> 或 --workspace=<工作区>。")
  process.exit(1)
}
const dbPath = path.join(dataDir, "plugin.db")
if (!fs.existsSync(dbPath)) {
  console.log(`[migrate] 未找到 plugin.db（${dbPath}），无需迁移。`)
  process.exit(0)
}

fs.mkdirSync(dataDir, { recursive: true })
const db = new DatabaseSync(dbPath)
const written = []
const skipped = []

try {
  // ---------- 网站导航 / 极简浏览器 ----------
  const wnEntries = rows(db, "wn_entries")
  if (wnEntries.length) {
    writeJsonSlot(dataDir, "website-navigation-entries", wnEntries.map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ""),
      url: String(row.url ?? ""),
      category: String(row.category ?? "default"),
      description: String(row.description ?? ""),
      createdAt: toNumber(row.created_at),
      updatedAt: toNumber(row.updated_at),
    })), { force: args.force, written, skipped })
  }
  const wnCategories = rows(db, "wn_categories")
  if (wnCategories.length) {
    writeJsonSlot(dataDir, "website-navigation-categories", wnCategories.map((row) => ({
      id: String(row.id),
      name: String(row.name ?? ""),
      color: String(row.color ?? "#b0aea5"),
    })), { force: args.force, written, skipped })
  }

  // ---------- Everything 缓存清理历史 ----------
  const esHistory = rows(db, "es_clean_history")
  if (esHistory.length) {
    writeJsonSlot(dataDir, "everything-search-clean-history", esHistory.map((row) => ({
      cleanedAt: toNumber(row.cleaned_at),
      mode: row.mode === "permanent" ? "permanent" : "recycle",
      entries: toNumber(row.entries),
      failed: toNumber(row.failed),
      freed: toNumber(row.freed),
    })), { force: args.force, written, skipped })
  }

  // ---------- S3 文件管理器操作日志 ----------
  const s3Logs = rows(db, "s3fm_logs")
  if (s3Logs.length) {
    writeJsonSlot(dataDir, "s3-file-manager-log", {
      logs: s3Logs.map((row) => {
        let detail
        if (row.detail_json) {
          try {
            detail = JSON.parse(row.detail_json)
          } catch {
            detail = undefined
          }
        }
        return {
          id: String(row.id),
          time: new Date(toNumber(row.time)).toISOString(),
          type: String(row.type ?? ""),
          action: String(row.action ?? ""),
          fileName: String(row.file_name ?? ""),
          itemCount: row.item_count === null ? undefined : toNumber(row.item_count),
          fileSize: row.file_size === null ? undefined : toNumber(row.file_size),
          success: toNumber(row.success) === 1,
          message: row.message ?? undefined,
          hostname: row.hostname ?? undefined,
          detail,
        }
      }),
    }, { force: args.force, written, skipped })
  }

  // ---------- gitPush 行数统计 ----------
  const gpStats = rows(db, "gp_project_stats")
  if (gpStats.length) {
    const filesByProject = new Map()
    for (const row of rows(db, "gp_file_lines")) {
      const projectId = String(row.project_id)
      const list = filesByProject.get(projectId) || []
      list.push([
        String(row.path),
        toNullableNumber(row.lines),
        toNumber(row.mtime_ms),
        toNumber(row.size),
      ])
      filesByProject.set(projectId, list)
    }
    const projects = {}
    for (const row of gpStats) {
      const projectId = String(row.project_id)
      projects[projectId] = {
        projectId,
        name: String(row.name ?? ""),
        totalLines: toNumber(row.total_lines),
        fileCount: toNumber(row.file_count),
        firstCommit: String(row.first_commit ?? ""),
        lastCommit: String(row.last_commit ?? ""),
        headOid: String(row.head_oid ?? ""),
        repoId: String(row.repo_id ?? ""),
        analyzedAt: String(row.analyzed_at ?? ""),
        files: filesByProject.get(projectId) || [],
      }
    }
    writeJsonSlot(dataDir, "git-push-line-stats-store", {
      version: 1,
      projects,
    }, { force: args.force, written, skipped })
  }
} finally {
  db.close()
}

console.log("[migrate] 迁移完成")
for (const item of written) console.log(`  ✓ 写入 ${item}`)
for (const item of skipped) console.log(`  - 跳过 ${item}`)
if (!written.length) console.log("  （没有需要写入的数据）")

if (args.deleteDb) {
  if (skipped.length && !args.force) {
    console.warn("[migrate] 有槽位因已存在非空数据被跳过，为避免丢数据未删除 plugin.db（确认后可加 --force 重跑）。")
    process.exit(0)
  }
  for (const suffix of ["", "-wal", "-shm"]) {
    const file = dbPath + suffix
    try {
      fs.rmSync(file, { force: true })
      if (fs.existsSync(file)) console.warn(`  ! 未能删除 ${file}`)
      else console.log(`  ✓ 已删除 ${path.basename(file)}`)
    } catch (error) {
      console.warn(`  ! 删除 ${file} 失败: ${error instanceof Error ? error.message : String(error)}`)
    }
  }
  console.log("[migrate] 已请求删除 plugin.db；请重启思源后确认同步正常。")
} else {
  console.log("[migrate] plugin.db 保留。确认数据无误后可手动删除（或下次加 --delete-db 重跑）。")
}
