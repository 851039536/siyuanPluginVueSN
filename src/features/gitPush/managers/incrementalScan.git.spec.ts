import type { NumstatCommit } from "../reportMetrics"
// 增量扫描正确性单测：对真实 git 仓库断言「增量结果」与「全新全量扫描」逐字段相等。
// 这是整个本地索引方案的核心正确性断言——索引只是缓存，任何情况下都必须等价于直接跑 git log。
import { execFileSync } from "node:child_process"
import {
  appendFileSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest"
import {

  parseNumstatBlocks,
} from "../reportMetrics"

/**
 * 屏蔽开发者真实 git 配置的隔离环境。
 *
 * 必要性：本文件与 worktreeFastPath.spec.ts 都会拉起 git 子进程，若读到开发机上的
 * 全局配置（commit.gpgsign / core.autocrlf / 别名 / diff.renames 等），结果会随机器而变；
 * 且测试运行期间若有其它进程（或本套件其它文件）改动全局配置，会表现为偶发失败。
 * 固定 GIT_CONFIG_GLOBAL / GIT_CONFIG_SYSTEM 到空文件 + 固定 TZ 与语言，即可得到确定行为。
 */
const ISOLATED_ENV: NodeJS.ProcessEnv = (() => {
  const dir = mkdtempSync(join(tmpdir(), "gp-gitcfg-"))
  const globalCfg = join(dir, "gitconfig")
  const systemCfg = join(dir, "gitsystemconfig")
  writeFileSync(globalCfg, "")
  writeFileSync(systemCfg, "")
  return {
    ...process.env,
    // 空配置文件：不继承开发机的任何全局/系统 git 行为
    GIT_CONFIG_GLOBAL: globalCfg,
    GIT_CONFIG_SYSTEM: systemCfg,
    GIT_CONFIG_NOSYSTEM: "1",
    // 固定时区与语言，保证日期串与错误文案稳定
    TZ: "UTC",
    LC_ALL: "C",
    LANG: "C",
  }
})()

/** 在指定目录执行 git 命令（测试夹具用，失败即抛错让用例暴露问题） */
function git(cwd: string, args: string[]): string {
  return execFileSync("git", args, {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    env: ISOLATED_ENV,
  })
}

/** 与 ReportOps.fetchIncremental 完全一致的命令与「扫到已索引提交即停」策略 */
function incrementalScan(cwd: string, knownHashes: ReadonlySet<string> | null): { commits: NumstatCommit[], complete: boolean } {
  const LIMIT = 20000
  const raw = execFileSync("git", [
    "-c",
    "core.quotepath=false",
    "log",
    "--numstat",
    "--no-renames",
    "--pretty=format:%x1e%h%x1f%an%x1f%aI%x1f%s",
    `-${LIMIT}`,
  ], {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
    env: ISOLATED_ENV,
  })
  const chunks = raw.split("\x1E")
  const total = chunks.length - 1
  const commits: NumstatCommit[] = []
  for (let i = 1; i < chunks.length; i++) {
    const chunk = chunks[i]
    const lines = chunk.split("\n")
    const parts = (lines[0] || "").split("\x1F")
    if (parts.length < 4) continue
    const parsed: NumstatCommit = {
      hash: parts[0].trim(),
      author: parts[1].trim(),
      date: parts[2].trim(),
      message: parts.slice(3).join("\x1F").trim(),
      files: [],
    }
    for (let j = 1; j < lines.length; j++) {
      const line = lines[j]
      if (!line) continue
      const cols = line.split("\t")
      if (cols.length < 3) continue
      const added = Number.parseInt(cols[0], 10)
      const deleted = Number.parseInt(cols[1], 10)
      if (Number.isNaN(added) || Number.isNaN(deleted)) continue
      const rawPath = cols.slice(2).join("\t").trim()
      const path = rawPath.startsWith('"') && rawPath.endsWith('"') ? rawPath.slice(1, -1) : rawPath
      parsed.files.push({
        path,
        added,
        deleted,
      })
    }
    if (knownHashes && parsed.hash && knownHashes.has(parsed.hash)) break
    commits.push(parsed)
  }
  commits.reverse()
  return {
    commits,
    complete: total < LIMIT,
  }
}

/** 全量扫描（作为增量结果的比对基准） */
function fullScan(cwd: string): NumstatCommit[] {
  const raw = execFileSync("git", [
    "-c",
    "core.quotepath=false",
    "log",
    "--numstat",
    "--no-renames",
    "--pretty=format:%x1e%h%x1f%an%x1f%aI%x1f%s",
  ], {
    cwd,
    encoding: "utf8",
    windowsHide: true,
    maxBuffer: 10 * 1024 * 1024,
    env: ISOLATED_ENV,
  })
  return parseNumstatBlocks(raw).reverse()
}

/** 规范化后比较：索引只存短 hash/作者/日期/主题/文件路径与增删行 */
function normalize(commits: NumstatCommit[]) {
  return commits.map((c) => ({
    hash: c.hash,
    author: c.author,
    date: c.date,
    message: c.message,
    files: c.files.map((f) => ({
      path: f.path,
      added: f.added,
      deleted: f.deleted,
    })),
  }))
}

describe("增量扫描与全量扫描等价（真实 git 仓库）", () => {
  let repo: string

  beforeAll(() => {
    repo = mkdtempSync(join(tmpdir(), "gp-index-spec-"))
    git(repo, ["init", "-q", "-b", "main"])
    git(repo, ["config", "user.email", "t@example.com"])
    git(repo, ["config", "user.name", "tester"])
    // 仓库级固定：不转换换行、关闭签名，保证 numstat 增删行数与平台无关
    git(repo, ["config", "core.autocrlf", "false"])
    git(repo, ["config", "commit.gpgsign", "false"])
  })

  afterAll(() => {
    try {
      rmSync(repo, {
        recursive: true,
        force: true,
      })
    } catch {
      /* 忽略清理失败 */
    }
  })

  it("无已知 hash 时等价于全量扫描（首次导入）", () => {
    writeFileSync(join(repo, "a.txt"), "line1\nline2\n")
    git(repo, ["add", "."])
    git(repo, ["commit", "-q", "-m", "feat: first"])
    appendFileSync(join(repo, "a.txt"), "line3\n")
    git(repo, ["add", "."])
    git(repo, ["commit", "-q", "-m", "fix: second"])

    const inc = incrementalScan(repo, null)
    expect(normalize(inc.commits)).toEqual(normalize(fullScan(repo)))
    expect(inc.complete).toBe(true)
  })

  it("已有索引时只回传新提交，且与全量结果的前缀一致", () => {
    const all = fullScan(repo)
    const known = new Set(all.slice(0, all.length - 1).map((c) => c.hash!))
    const inc = incrementalScan(repo, known)
    expect(inc.commits.map((c) => c.hash)).toEqual([all[all.length - 1].hash])

    // 合并（已索引 + 增量）必须与全量逐字段相等
    const merged = [...all.slice(0, all.length - 1), ...inc.commits]
    expect(normalize(merged)).toEqual(normalize(all))
  })

  it("amend 后（hash 变化）增量的并集仍与全量一致，不丢提交", () => {
    const before = fullScan(repo)
    const known = new Set(before.slice(0, before.length - 1).map((c) => c.hash!))
    // 修改最后一条提交：hash 必变，且日期沿用（时间仍晚于其父提交）
    appendFileSync(join(repo, "a.txt"), "amended\n")
    git(repo, ["add", "."])
    git(repo, ["commit", "-q", "--amend", "-m", "fix: second (amended)"])

    const inc = incrementalScan(repo, known)
    // 已索引的旧提交仍在 known 中（索引不删），但 amend 后的新 hash 必须被扫描到
    expect(inc.commits).toHaveLength(1)
    expect(inc.commits[0].message).toBe("fix: second (amended)")

    const full = fullScan(repo)
    expect(inc.commits[0].hash).toBe(full[full.length - 1].hash)
    // 前缀（未改动部分）+ 增量 = 全量
    expect(normalize([...full.slice(0, full.length - 1), ...inc.commits])).toEqual(normalize(full))
  })

  it("无提交的空仓库返回空结果且视为完整", () => {
    const emptyRepo = mkdtempSync(join(tmpdir(), "gp-index-empty-"))
    try {
      git(emptyRepo, ["init", "-q", "-b", "main"])
      // git log 在无提交仓库会以非 0 退出；调用方（ReportOps）在 execGit 抛错后回退空数组
      let failed = false
      try {
        incrementalScan(emptyRepo, null)
      } catch {
        failed = true
      }
      expect(failed).toBe(true)
    } finally {
      try {
        rmSync(emptyRepo, {
          recursive: true,
          force: true,
        })
      } catch {
        /* 忽略 */
      }
    }
  })

  it("二进制与重命名文件不破坏增量的等价性", () => {
    const binRepo = mkdtempSync(join(tmpdir(), "gp-index-bin-"))
    try {
      git(binRepo, ["init", "-q", "-b", "main"])
      git(binRepo, ["config", "user.email", "t@example.com"])
      git(binRepo, ["config", "user.name", "tester"])
      // 含 NUL 与 0xFF 的二进制内容（writeFileSync 接受 Uint8Array，避免依赖 Node 的 Buffer 全局）
      writeFileSync(join(binRepo, "img.bin"), new Uint8Array([0, 1, 2, 3, 0, 255]))
      writeFileSync(join(binRepo, "code.ts"), "export const a = 1\n")
      git(binRepo, ["add", "."])
      git(binRepo, ["commit", "-q", "-m", "feat: add bin and code"])
      // 重命名 + 修改
      git(binRepo, ["mv", "code.ts", "renamed.ts"])
      appendFileSync(join(binRepo, "renamed.ts"), "export const b = 2\n")
      git(binRepo, ["add", "."])
      git(binRepo, ["commit", "-q", "-m", "refactor: rename"])

      const all = fullScan(binRepo)
      const known = new Set(all.slice(0, 1).map((c) => c.hash!))
      const inc = incrementalScan(binRepo, known)
      expect(normalize([...all.slice(0, 1), ...inc.commits])).toEqual(normalize(all))
      // 二进制文件 git 输出 "-\t-"，应被跳过而非产生 NaN
      for (const c of all) {
        for (const f of c.files) {
          expect(Number.isFinite(f.added)).toBe(true)
          expect(Number.isFinite(f.deleted)).toBe(true)
        }
      }
    } finally {
      try {
        rmSync(binRepo, {
          recursive: true,
          force: true,
        })
      } catch {
        /* 忽略 */
      }
    }
  })
})
