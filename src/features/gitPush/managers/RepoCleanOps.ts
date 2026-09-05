// 仓库清理编排：体检扫描（纯 git 可达大文件统计）+ BFG mirror 六步清理工作流
import type { RepoBlobItem, RepoScanResult, BfgCleanPlan, BfgCleanResult } from "../types/meta"
import type { GitExecutor } from "./GitExecutor"
import type { BfgOps } from "./BfgOps"
import type { WorktreeOps } from "./WorktreeOps"
import { getWorkspaceDir } from "@/api"
import { getNodeFsPathOs } from "@/utils/nodeModules"

/** 体检扫描超时（大仓库对象遍历耗时较长） */
const SCAN_TIMEOUT_MS = 120000
/** 备份 bundle 保留份数（每项目） */
const BACKUP_KEEP = 3
/** 清理各阶段超时（mirror clone/bundle/gc 视仓库大小，统一放宽） */
const CLEAN_TIMEOUT_MS = 600000

/** 清理工作流阶段标识（onStep 回传给 UI 步骤条） */
export type RepoCleanStep = "backup" | "mirror" | "bfg" | "gc" | "sync"

/** "12.50 MiB" / "1.2 MB" 人类可读体积 → 字节（count-objects -vH 输出解析） */
function parseHumanSizeToBytes(s: string): number {
  const m = s.match(/([\d.]+)\s*(B|KB?|MB?|GB?|TB?)/i)
  if (!m) return 0
  const n = Number(m[1]) || 0
  const unit = m[2].toUpperCase().replace("B", "")
  const pow = unit === "" ? 0 : unit === "K" ? 1 : unit === "M" ? 2 : unit === "G" ? 3 : unit === "T" ? 4 : 0
  return Math.round(n * 1024 ** pow)
}

export class RepoCleanOps {
  private executor: GitExecutor
  private bfgOps: BfgOps
  private worktreeOps: WorktreeOps
  /** 插件名（备份目录定位用，构造时注入） */
  private pluginName: string

  constructor(executor: GitExecutor, bfgOps: BfgOps, worktreeOps: WorktreeOps, pluginName: string) {
    this.executor = executor
    this.bfgOps = bfgOps
    this.worktreeOps = worktreeOps
    this.pluginName = pluginName
  }

  // ── 体检扫描（纯 git，零外部依赖）──

  /**
   * 仓库体检：.git 体积汇总 + 可达 blob 大文件 Top N
   * 三命令 join：count-objects（体积）+ cat-file --batch-check（hash→size）+ rev-list --objects（hash→path）
   */
  async scan(projectPath: string, thresholdMb: number, topN = 50): Promise<RepoScanResult> {
    const thresholdBytes = thresholdMb * 1024 * 1024

    // 1. 体积汇总（size-pack / size 为人类可读串）
    const countRaw = await this.executor.execGit(projectPath, ["count-objects", "-vH"], undefined, SCAN_TIMEOUT_MS)
    let packSize = 0
    let looseSize = 0
    let objectCount = 0
    for (const line of countRaw.split("\n")) {
      const [k, v] = line.split(":").map((p) => p.trim())
      if (k === "size-pack") packSize = parseHumanSizeToBytes(v || "")
      else if (k === "size") looseSize = parseHumanSizeToBytes(v || "")
      else if (k === "count" || k === "in-pack") objectCount += Number(v) || 0
    }

    // 2. 全部对象 hash→type+size（--batch-all-objects 无需 stdin；--unordered 提速，顺序无关）
    const catRaw = await this.executor.execGit(
      projectPath,
      ["cat-file", "--batch-check", "--batch-all-objects", "--unordered"],
      undefined, SCAN_TIMEOUT_MS,
    )
    const blobSizes = new Map<string, number>()
    for (const line of catRaw.split("\n")) {
      const parts = line.trim().split(/\s+/)
      // 输出格式：<hash> <type> <size>（missing 对象无 size，跳过）
      if (parts.length >= 3 && parts[1] === "blob") {
        blobSizes.set(parts[0], Number(parts[2]) || 0)
      }
    }

    // 3. 可达对象 hash→路径（树对象行无路径；blob 行路径即文件路径；同 blob 多路径时保留最后出现）
    const revRaw = await this.executor.execGit(
      projectPath,
      ["-c", "core.quotepath=false", "rev-list", "--objects", "--all"],
      undefined, SCAN_TIMEOUT_MS,
    )
    const pathByHash = new Map<string, string>()
    for (const line of revRaw.split("\n")) {
      const idx = line.indexOf(" ")
      if (idx > 0) {
        pathByHash.set(line.slice(0, idx), line.slice(idx + 1).trim())
      }
    }

    // 4. join：仅统计「可达」blob（不可达对象会在 gc 后消失，纳入统计误导）
    const all: RepoBlobItem[] = []
    for (const [hash, size] of blobSizes) {
      const p = pathByHash.get(hash)
      if (p) all.push({ hash, path: p, size })
    }
    all.sort((a, b) => b.size - a.size)

    // 5. 锚定来源分类（BFG 清理后残留诊断）：
    //    本地分支/标签可达集（--branches --tags）与远程跟踪引用可达集（--glob refs/remotes/*）各跑一遍，
    //    仅被远程跟踪引用锚定 → "remote"（远端仍是旧历史）；两者皆非 → "other"（stash 等其他引用）
    if (all.length > 0) {
      const hashSetOf = (raw: string): Set<string> => {
        const set = new Set<string>()
        for (const line of raw.split("\n")) {
          const hash = line.split(" ")[0]
          if (hash) set.add(hash)
        }
        return set
      }
      const [localRaw, remoteRaw] = await Promise.all([
        this.executor.execGit(projectPath, ["rev-list", "--objects", "--branches", "--tags"], undefined, SCAN_TIMEOUT_MS),
        this.executor.execGit(projectPath, ["rev-list", "--objects", "--glob=refs/remotes/*"], undefined, SCAN_TIMEOUT_MS),
      ])
      const localSet = hashSetOf(localRaw)
      const remoteSet = hashSetOf(remoteRaw)
      for (const item of all) {
        if (localSet.has(item.hash)) continue
        item.anchor = remoteSet.has(item.hash) ? "remote" : "other"
      }
    }

    const oversized = all.filter((b) => b.size > thresholdBytes)
    return {
      packSize,
      looseSize,
      objectCount,
      topBlobs: all.slice(0, topN),
      oversizedCount: oversized.length,
      oversizedBytes: oversized.reduce((acc, b) => acc + b.size, 0),
      scannedAt: new Date().toISOString(),
    }
  }

  // ── BFG 六步清理工作流 ──

  /** 依据清理计划组装 bfg 命令行参数（多 glob 合并为单值 {g1,g2} — BFG fileMatcher 单值语义） */
  private buildBfgArgs(plan: BfgCleanPlan, replaceRulesFile?: string): string[] {
    const args: string[] = []
    if (plan.stripBiggerThanMb > 0) args.push("--strip-blobs-bigger-than", `${plan.stripBiggerThanMb}M`)
    if (plan.deleteFileGlobs.length > 0) args.push("--delete-files", `{${plan.deleteFileGlobs.join(",")}}`)
    if (plan.deleteFolderGlobs.length > 0) args.push("--delete-folders", `{${plan.deleteFolderGlobs.join(",")}}`)
    if (plan.replaceRules.length > 0 && replaceRulesFile) args.push("--replace-text", replaceRulesFile)
    return args
  }

  /** 备份 bundle 目录（<workspace>/data/storage/petal/<plugin.name>/bfg-backups/<项目名>/） */
  private async backupDirFor(projectPath: string): Promise<string> {
    const node = getNodeFsPathOs()
    if (!node) throw new Error("Node 环境不可用")
    const { path } = node
    const workspaceRoot = await this.getWorkspaceRoot()
    const projectName = path.basename(projectPath)
    return path.join(workspaceRoot, "data", "storage", "petal", this.pluginName, "bfg-backups", projectName)
  }

  /** 工作区根目录（懒加载缓存） */
  private workspaceRootCache = ""
  private async getWorkspaceRoot(): Promise<string> {
    if (this.workspaceRootCache) return this.workspaceRootCache
    this.workspaceRootCache = await getWorkspaceDir()
    if (!this.workspaceRootCache) throw new Error("无法获取工作区路径，无法创建备份")
    return this.workspaceRootCache
  }

  /** 清理旧备份：仅保留最近 KEEP 份（按文件名时间戳排序） */
  private pruneBackups(dir: string, keep = BACKUP_KEEP): void {
    const node = getNodeFsPathOs()
    if (!node) return
    const { fs, path } = node
    try {
      const files = fs.readdirSync(dir).filter((f: string) => f.endsWith(".bundle")).sort()
      while (files.length > keep) {
        const oldest = files.shift()
        if (oldest) {
          try { fs.rmSync(path.join(dir, oldest), { force: true }) } catch { /* 忽略 */ }
        }
      }
    } catch { /* 目录不存在等，忽略 */ }
  }

  /**
   * BFG 清理六步工作流（全程只读原仓库工作区，回写阶段才动引用）：
   * backup(bundle 全量备份) → mirror(clone --mirror) → bfg(重写) → gc(镜像压缩) → sync(CAS 回写引用 + 本地 gc)
   */
  async cleanRepo(
    projectPath: string,
    plan: BfgCleanPlan,
    callbacks: {
      onStep?: (step: RepoCleanStep, current: number, total: number) => void
      onOutput?: (chunk: string) => void
    } = {},
  ): Promise<BfgCleanResult> {
    const node = getNodeFsPathOs()
    if (!node) throw new Error("Node 环境不可用")
    const { fs, path, os } = node

    // ── 前置检查：rebase 残留 / 脏工作区 ──
    if (await this.worktreeOps.isInRebaseState(projectPath)) {
      throw new Error("仓库处于 rebase 中断状态，请先完成或中止 rebase 再执行清理")
    }
    const wt = await this.worktreeOps.getWorkingTreeStatus(projectPath)
    if (wt.hasChanges) {
      throw new Error("工作区存在未提交变更，请先提交或暂存（stash）后再执行清理")
    }

    const durations: Record<string, number> = {}
    const stepTotal = 5
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "gpclean-"))
    const mirrorPath = path.join(tmpDir, "mirror.git")

    // 清理前体积（必须在任何重写/gc 之前测量，否则前后对比失真）
    const sizeBefore = await this.measureGitSize(projectPath)

    try {
      // ── 步骤 1：bundle 全量备份（单文件可用 git clone 恢复）──
      const stepStart = (name: string) => { durations[name] = Date.now() }
      const stepEnd = (name: string) => { durations[name] = Date.now() - durations[name] }

      callbacks.onStep?.("backup", 1, stepTotal)
      stepStart("backup")
      const backupDir = await this.backupDirFor(projectPath)
      fs.mkdirSync(backupDir, { recursive: true })
      const ts = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19)
      const backupPath = path.join(backupDir, `${path.basename(projectPath)}-${ts}.bundle`)
      await this.executor.execGit(projectPath, ["bundle", "create", backupPath, "--all"], undefined, CLEAN_TIMEOUT_MS)
      this.pruneBackups(backupDir)
      stepEnd("backup")

      // ── 步骤 2：mirror 裸仓库克隆（本地克隆，对象 hardlink 共享）──
      callbacks.onStep?.("mirror", 2, stepTotal)
      stepStart("mirror")
      await this.executor.execGit(projectPath, ["clone", "--mirror", projectPath, mirrorPath], undefined, CLEAN_TIMEOUT_MS, callbacks.onOutput)
      stepEnd("mirror")

      // ── 步骤 3：bfg 重写（replace 规则写临时文件，随 tmpDir 销毁）──
      callbacks.onStep?.("bfg", 3, stepTotal)
      stepStart("bfg")
      const java = await this.bfgOps.detectJava()
      if (!java.ok) throw new Error("未检测到可用的 Java 运行时，请安装 Java 后重试")
      const { jarPath, jarOk } = await this.bfgOps.getJarState()
      if (!jarOk) throw new Error("bfg.jar 不存在，请先下载或手动指定路径")

      let replaceFile: string | undefined
      if (plan.replaceRules.length > 0) {
        replaceFile = path.join(tmpDir, "replace-rules.txt")
        fs.writeFileSync(replaceFile, plan.replaceRules.join("\n"), "utf8")
      }
      const bfgArgs = this.buildBfgArgs(plan, replaceFile)
      if (bfgArgs.length === 0) throw new Error("清理计划为空：至少配置一项清理策略")
      await this.bfgOps.runBfg(jarPath, java.path, [...bfgArgs, mirrorPath], path.dirname(mirrorPath), callbacks.onOutput)
      stepEnd("bfg")

      // ── 步骤 4：镜像内 gc 压缩（reflog 过期 + 立即 prune，物理清除被替换 blob）──
      callbacks.onStep?.("gc", 4, stepTotal)
      stepStart("gc")
      await this.executor.execGit(mirrorPath, ["reflog", "expire", "--expire=now", "--all"], undefined, CLEAN_TIMEOUT_MS)
      await this.executor.execGit(mirrorPath, ["gc", "--prune=now", "--aggressive"], undefined, CLEAN_TIMEOUT_MS, callbacks.onOutput)
      stepEnd("gc")

      // ── 步骤 5：回写原仓库（CAS update-ref 逐引用校验，失败即中断保持原状）──
      callbacks.onStep?.("sync", 5, stepTotal)
      stepStart("sync")
      await this.executor.execGit(
        projectPath,
        ["fetch", mirrorPath, "+refs/heads/*:refs/bfg-clean/heads/*", "+refs/tags/*:refs/bfg-clean/tags/*"],
        undefined, CLEAN_TIMEOUT_MS,
      )

      // 分支/标签 CAS 回写：旧值校验（期间有其他改动则失败），复制 rebuildHistoryWithNewMessage 的安全模式。
      // fetch 已将 mirror 分支写入 refs/bfg-clean/heads/<short>、标签写入 refs/bfg-clean/tags/<short>
      const casUpdate = async (kind: "heads" | "tags") => {
        const refPrefix = `refs/${kind}`
        const localRefs = await this.executor.execGit(projectPath, ["for-each-ref", "--format=%(refname)", refPrefix])
        for (const ref of localRefs.split("\n").filter(Boolean)) {
          const short = ref.slice(refPrefix.length + 1)
          const newHash = await this.executor.execGit(projectPath, ["rev-parse", `refs/bfg-clean/${kind}/${short}`])
          // update-ref 三参形式：<ref> <newvalue> <oldvalue>（旧值不匹配即失败，防覆盖并发改动）
          const oldHash = await this.executor.execGit(projectPath, ["rev-parse", ref])
          await this.executor.execGit(projectPath, ["update-ref", ref, newHash, oldHash])
        }
      }
      await casUpdate("heads")
      await casUpdate("tags")

      // 当前分支 reset 同步 index/worktree（HEAD 受 BFG 保护，内容理论不变；防操作期间有残留差异）
      await this.executor.execGit(projectPath, ["reset", "--hard"], undefined, CLEAN_TIMEOUT_MS)

      // 删除临时命名空间引用
      const tmpRefs = await this.executor.execGit(projectPath, ["for-each-ref", "--format=%(refname)", "refs/bfg-clean"])
      for (const ref of tmpRefs.split("\n").filter(Boolean)) {
        await this.executor.execGit(projectPath, ["update-ref", "-d", ref])
      }

      // 原仓库本地瘦身（不带 --aggressive 提速；远端强推后仍需 fetch --prune 才完全瘦身）
      await this.executor.execGit(projectPath, ["reflog", "expire", "--expire=now", "--all"], undefined, CLEAN_TIMEOUT_MS)
      await this.executor.execGit(projectPath, ["gc", "--prune=now"], undefined, CLEAN_TIMEOUT_MS, callbacks.onOutput)
      stepEnd("sync")

      // ── 前后体积对比 ──
      const countRaw = await this.executor.execGit(projectPath, ["count-objects", "-vH"], undefined, SCAN_TIMEOUT_MS)
      let sizeAfter = 0
      for (const line of countRaw.split("\n")) {
        const [k, v] = line.split(":").map((p) => p.trim())
        if (k === "size-pack") sizeAfter = parseHumanSizeToBytes(v || "")
      }

      return {
        sizeBefore,
        sizeAfter,
        backupPath,
        durations,
      }
    } finally {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }) } catch { /* 忽略清理失败 */ }
    }
  }

  /** 测量仓库 .git 体积（size-pack，字节；扫描前记录用） */
  private async measureGitSize(projectPath: string): Promise<number> {
    const countRaw = await this.executor.execGit(projectPath, ["count-objects", "-vH"], undefined, SCAN_TIMEOUT_MS)
    for (const line of countRaw.split("\n")) {
      const [k, v] = line.split(":").map((p) => p.trim())
      if (k === "size-pack") return parseHumanSizeToBytes(v || "")
      }
    return 0
  }

  /**
   * BFG 强推后收尾：fetch --prune 同步全部远程跟踪引用（推送已更新的引用随 push 即时刷新，
   * 远端已删除的分支被 prune）+ reflog 过期 + gc 物理清除本地残留。
   * 注意：远端仍存在的未重写分支（如旧发布分支）不会被 prune —— 体检将以「远程引用」标注其锚定的大文件。
   */
  async finalizeBfgClean(
    projectPath: string,
    onOutput?: (chunk: string) => void,
  ): Promise<{ fetchErrors: { remote: string, error: string }[] }> {
    const remotesRaw = await this.executor.execGit(projectPath, ["remote"])
    const remotes = remotesRaw.split("\n").map((s) => s.trim()).filter(Boolean)

    const fetchErrors: { remote: string, error: string }[] = []
    for (const remote of remotes) {
      try {
        await this.executor.execGit(projectPath, ["fetch", "--prune", remote], undefined, CLEAN_TIMEOUT_MS, onOutput)
      } catch (e) {
        // 单个远程 fetch 失败不阻断收尾（其余远程 + gc 照常执行）
        fetchErrors.push({ remote, error: e instanceof Error ? e.message : String(e) })
      }
    }

    await this.executor.execGit(projectPath, ["reflog", "expire", "--expire=now", "--all"], undefined, CLEAN_TIMEOUT_MS)
    await this.executor.execGit(projectPath, ["gc", "--prune=now"], undefined, CLEAN_TIMEOUT_MS, onOutput)
    return { fetchErrors }
  }
}
