// 工作区本地操作：状态/差异/暂存/提交/stash/分支/提交日志
import type {
  BranchInfo,
  CommitLogEntry,
  CommitStat,
  DiscardTarget,
  FileChange,
  StashEntry,
  WorkingTreeInfo,
} from "../types/storage"
import type { GitExecutor } from "./GitExecutor"
import type { FileDiffResult } from "../types/diff"
import type { RefSyncSnapshot } from "../types/gitRefs"
import type { NumstatEntry } from "../utils/gitOutput"
import { getNodeFsPathOs } from "@/utils/nodeModules"
// 直连纯模块而非 "../utils" 桶：桶会转出依赖运行时 "siyuan" 的模块，
// 使 WorktreeOps 无法在 Node 单测环境加载（branchDelete.git.spec.ts 需要真实实例）
import { buildDiffContext, detectBinaryDiff } from "../utils/diffText"
import { GitBufferOverflowError } from "../utils/errors"
import { DEFAULT_LOG_LIMIT } from "../utils/format"
import {
  buildNoIndexDiffArgs,
  buildShowPatchArgs,
  buildWorktreeDiffArgs,
} from "../utils/gitDiffArgs"
import {
  parseBranches,
  parseChangesetDiff,
  parseCommitFiles,
  parseCommitLog,
  parseCommitShortStats,
  parseNumstatZ,
  parseRefSnapshot,
  parseStashList,
  parseWorktreeStatus,
  parseWorktreeStatusV2,
} from "../utils/gitOutput"
import { HistoryRewriter } from "./HistoryRewriter"

/**
 * 提交变更规模统计的条数上限。
 * --shortstat 需为每条提交计算 diff，实测 200 条约 2.3s、500 条约 3.0s；
 * 上限取 500 兼顾覆盖率与耗时，超出部分的行不展示悬停统计（降级为原 title）。
 */
const LOG_STAT_LIMIT = 500

export class WorktreeOps {
  private executor: GitExecutor
  /** 提交历史 DAG 重建器（消息改写 / 提交删除共享骨架） */
  private historyRewriter: HistoryRewriter

  constructor(executor: GitExecutor) {
    this.executor = executor
    this.historyRewriter = new HistoryRewriter(executor)
  }

  /**
   * 获取工作区变更状态（单次 `git status --porcelain=v2 --branch -z`）。
   *
   * 为什么不做「先探测再全量」的快速路径：实测（Windows 10 / git 2.53，i7-11800H）
   *   `status --porcelain`        ≈ 255ms
   *   `status --porcelain -uno`   ≈ 250ms   ← 与全量几乎同价，探测省不下时间
   *   探测 + 全量                  ≈ 505ms   ← 恰为单次全量的 2 倍
   * 根因：`git --version` 单独就要 ~310ms，即**每次 git 调用都由「进程启动费」主导**，
   * 文件扫描量（1000 → 5000 文件仅 251ms → 278ms）几乎不影响耗时。
   * 故有效方向只有「减少 git 进程调用次数」，凡不能减少调用次数的探测式路径都是负收益。
   */
  async getWorkingTreeStatus(projectPath: string, opts?: { branch?: string }): Promise<WorkingTreeInfo> {
    const empty: WorkingTreeInfo = {
      branch: "",
      files: [],
      stagedCount: 0,
      unstagedCount: 0,
      untrackedCount: 0,
      hasChanges: false,
    }

    // 统一走 porcelain v2 + `-z`：一次调用同时取分支名与工作区状态，且路径不再受控制字符影响。
    // `opts.branch` 从「决定走哪条解析路径」降级为「v2 不可用时的回退提示」——
    // 若调用方认为分支名已知就改跑 v1，等于把两套解析器永久保留下来（P2-3 要消除的正是这个）。
    return this.readWorktreeStatusV2(projectPath, opts?.branch ?? "", empty)
  }

  /**
   * v2 单调用路径（分支名 + 工作区一次取齐，`-z` 分隔）。
   *
   * ⚠️ 失败时**不得**静默返回「无变更」：这会让卡片把「查询失败」误呈现为「工作区干净」。
   * 故此处 catch 后回退到 v1 双调用路径重试一次 —— 若连 v1 也失败，才按空结果降级
   * （与既有 v1 行为一致，避免引入新的失败语义）。用户最多多付一次进程，但结果正确。
   */
  private async readWorktreeStatusV2(
    projectPath: string,
    fallbackBranch: string,
    empty: WorkingTreeInfo,
  ): Promise<WorkingTreeInfo> {
    try {
      const raw = await this.executor.execGit(projectPath, [
        "status",
        "--porcelain=v2",
        "--branch",
        "-z",
      ])
      // 注意：即便工作区干净，v2 也总会输出 # branch.* 头部行，故 raw 正常非空。
      // 但极端情况下（git 版本过旧不支持 v2）可能抛错，由下方 catch 回退。
      const parsed = parseWorktreeStatusV2(raw)
      return {
        // v2 的 branch 已在解析层把 (detached) 归一化为空串
        branch: parsed.branch,
        files: parsed.files,
        stagedCount: parsed.stagedCount,
        unstagedCount: parsed.unstagedCount,
        untrackedCount: parsed.untrackedCount,
        hasChanges: parsed.files.length > 0,
      }
    } catch {
      // 回退：v1 文本解析（兼容极旧 git / v2 被禁用等情形）。
      // 分支名优先用调用方提示，其次走 getCurrentBranch（detached 归一化为空串，语义与 v2 一致）；
      // 拿不到分支名也继续读状态 —— detached / 空仓库的工作区仍然需要如实呈现。
      const branch = fallbackBranch || await this.executor.getCurrentBranch(projectPath)
      return this.readFullWorktreeStatus(projectPath, branch, empty)
    }
  }

  /** v1 兼容回退：仅当 v2 不可用时使用（旧 git），不再是任何调用方的首选路径 */
  private async readFullWorktreeStatus(
    projectPath: string,
    branch: string,
    empty: WorkingTreeInfo,
  ): Promise<WorkingTreeInfo> {
    try {
      // git status 内部自带 index stat 刷新（无 --no-optional-locks 时会回写 index），
      // 无需先跑 update-index --refresh——那等于对工作区做两次全量扫描
      const raw = await this.executor.execGit(projectPath, ["status", "--porcelain"])
      if (!raw) { return {
        ...empty,
        branch,
      } }

      // porcelain v1 文本解析（状态归属 / 未跟踪计数 / 重命名路径拆分）见 utils/gitOutput.parseWorktreeStatus
      const {
        files,
        stagedCount,
        unstagedCount,
        untrackedCount,
      } = parseWorktreeStatus(raw)
      return {
        branch,
        files,
        stagedCount,
        unstagedCount,
        untrackedCount,
        hasChanges: files.length > 0,
      }
    } catch {
      // 解析失败按「无变更」呈现（分支名已取到则保留）
      return {
        ...empty,
        branch,
      }
    }
  }

  /**
   * 获取文件差异（失败返回空串，不产出面向用户的文案——空态/加载态由视图层经 i18n 呈现）。
   * 常规 `git diff` 对未跟踪文件恒为空（该文件不在 index 中），此时若文件也不在 HEAD 中，
   * 回退 `git diff --no-index -- /dev/null <file>` 展示完整的新增内容（有差异时退出码为 1，需白名单容忍）。
   *
   * ⚠️ `status` 提示参数：调用方（工作区面板）在点击时已持有 porcelain 状态，透传可走快速路径——
   * `untracked` 且未暂存的文件**必然**不在 index 中（git diff 恒空、ls-files 必然 miss），
   * 直接走 `--no-index`，省掉前两次注定空手的 git 进程（每次进程启动费 ~0.3s，3 → 1）。
   * status 缺省时行为与旧签名完全一致（向后兼容）。
   *
   * ⚠️ `context` 为展开折叠条时请求的上下文行数（`-U<n>`）；0/缺省按 git 默认 3 行，
   * 与既有调用完全一致。未跟踪文件走 `--no-index` 展示全文，上下文对其无意义。
   */
  async getFileDiff(projectPath: string, file: string, staged = false, status?: string, context = 0): Promise<string> {
    return (await this.getFileDiffResult(projectPath, file, staged, status, context)).text
  }

  /**
   * 获取文件差异及取数状态（二进制 / 超出缓冲区 / 失败与「无差异」分开）。
   * 视图层必须区分这几类，否则只能显示空态，用户无从得知是文件没改还是加载失败。
   */
  async getFileDiffResult(projectPath: string, file: string, staged = false, status?: string, context = 0): Promise<FileDiffResult> {
    try {
      // 快速路径：未跟踪文件的常规 diff 与基线检查都是注定空手的进程，直接展示完整新增内容
      if (!staged && status === "untracked") {
        return this.classifyPatch(await this.execNoIndexDiff(projectPath, file))
      }
      const text = await this.executor.execGit(
        projectPath,
        buildWorktreeDiffArgs({
          staged,
          context,
          paths: [file],
        }),
      )
      if (text) return this.classifyPatch(text)
      // 空差异按比较基线判定是否兜底：工作区范围比 index、暂存范围比 HEAD——
      // 文件在基线中而 diff 为空 = 真无差异；不在基线中（未跟踪 / git rm --cached / 新增未提交）则回退 --no-index
      const inBaseline = staged
        ? await this.isFileInHead(projectPath, file)
        : await this.isFileInIndex(projectPath, file)
      if (inBaseline) return { status: "empty", text: "" }
      return this.classifyPatch(await this.execNoIndexDiff(projectPath, file))
    } catch (e: unknown) {
      return this.failureResult(e)
    }
  }

  /** 把补丁文本归类为 ok / empty / binary */
  private classifyPatch(text: string): FileDiffResult {
    if (!text) return { status: "empty", text: "" }
    if (detectBinaryDiff(text)) return { status: "binary", text }
    return { status: "ok", text }
  }

  /** 取数失败归类：缓冲区溢出与其它错误分开，前者是「太大」而非「读不到」 */
  private failureResult(e: unknown): FileDiffResult {
    return e instanceof GitBufferOverflowError
      ? { status: "tooLarge", text: "" }
      : { status: "error", text: "" }
  }

  /**
   * 一次性取回整个变更集的补丁，按文件路径切分为「路径 → 补丁」。
   *
   * 审阅流（多文件连续浏览）用它替代 N 次单文件 `git diff`：一次进程覆盖所有 tracked 变更，
   * 代价从「每个文件 ~0.3s 进程启动」降到一次。
   *
   * 失败（git 报错 / 输出超 maxBuffer）返回 `null` 而不是空对象：调用方必须能区分
   * 「变更集为空（确实没有改动）」与「取数失败」。前者按缺失路径回退是正常路径，
   * 后者若也静默成空对象，视图层会以为每个文件都不在变更集里，于是为每个可见文件各 spawn
   * 一个 `git diff` —— 本该 2 个进程的场景退化成 20+ 个，且界面上看不出原因。
   *
   * ⚠️ 未跟踪文件不在 `git diff` 输出中（既不在 index 也不在 HEAD），必须由调用方按需回退。
   */
  async getChangesetDiff(projectPath: string, staged = false): Promise<Record<string, string> | null> {
    try {
      const raw = await this.executor.execGit(projectPath, buildWorktreeDiffArgs({ staged }))
      return Object.fromEntries(parseChangesetDiff(raw))
    } catch {
      return null
    }
  }

  /**
   * 变更集规模概览（git diff --numstat -z）。
   * 仅在整包补丁取数失败后使用：按文件规模决定哪些自动拉取、哪些等用户点击，
   * 避免 20+ 个文件同时 spawn。失败返回 null（调用方按「规模未知」处理）。
   */
  async getChangesetOverview(projectPath: string, staged = false): Promise<Record<string, NumstatEntry> | null> {
    try {
      const args = ["diff", "--numstat", "-z", "--no-color", "--no-ext-diff", "--no-textconv"]
      if (staged) args.push("--cached")
      return parseNumstatZ(await this.executor.execGit(projectPath, args))
    } catch {
      return null
    }
  }

  /** `git diff --no-index -- /dev/null <file>`：未跟踪/新增文件展示完整内容（有差异时退出码 1，白名单容忍） */
  private async execNoIndexDiff(projectPath: string, file: string): Promise<string> {
    return await this.executor.execGit(
      projectPath,
      buildNoIndexDiffArgs(file),
      undefined,
      undefined,
      undefined,
      { allowExitCodes: [1] },
    )
  }

  /** 文件是否已存在于 HEAD（无提交 / 命令失败按 false 处理，使新仓库提交前的新增文件同样可见内容） */
  private async isFileInHead(projectPath: string, file: string): Promise<boolean> {
    try {
      const raw = await this.executor.execGit(projectPath, ["ls-tree", "HEAD", "--", file])
      return !!raw.trim()
    } catch {
      return false
    }
  }

  /** 文件是否已存在于 index（`git rm --cached` 后移出 index 但仍在 HEAD，命令失败按 false 处理） */
  private async isFileInIndex(projectPath: string, file: string): Promise<boolean> {
    try {
      // --error-unmatch：路径不命中 index 时退出码非 0，由 execGit reject 后按 false 处理
      await this.executor.execGit(projectPath, ["ls-files", "--error-unmatch", "--", file])
      return true
    } catch {
      return false
    }
  }

  async stageFile(projectPath: string, file: string): Promise<void> {
    await this.executor.execGit(projectPath, ["add", "--", file])
  }

  async stageAll(projectPath: string): Promise<void> {
    await this.executor.execGit(projectPath, ["add", "-A"])
  }

  async unstageFile(projectPath: string, file: string): Promise<void> {
    await this.executor.execGit(projectPath, ["reset", "HEAD", "--", file])
  }

  async unstageAll(projectPath: string): Promise<void> {
    await this.executor.execGit(projectPath, ["reset", "HEAD"])
  }

  async discardFile(projectPath: string, file: string, staged: boolean, status: string): Promise<void> {
    if (staged) {
      // 破坏性操作失败必须向上抛（由调用方呈现），不得静默吞错——否则用户以为已丢弃实际未丢弃。
      // 新增类（A/AM/AD）不在 HEAD 中：reset 退出 index 后文件变未跟踪，checkout 会报 pathspec 错误 ⇒ 走 clean 删工作区文件
      if (await this.isFileInHead(projectPath, file)) {
        await this.executor.execGit(projectPath, ["reset", "HEAD", "--", file])
        await this.executor.execGit(projectPath, ["checkout", "--", file])
      } else {
        await this.executor.execGit(projectPath, ["reset", "HEAD", "--", file])
        await this.executor.execGit(projectPath, ["clean", "-f", "--", file])
      }
    } else if (status === "untracked") {
      await this.executor.execGit(projectPath, ["clean", "-f", "--", file])
    } else {
      await this.executor.execGit(projectPath, ["checkout", "--", file])
    }
  }

  /**
   * 批量丢弃（一次写锁、最多三条 git 命令，与文件数无关）。
   *
   * 单个 `discardFile` 每个文件要 1~2 个进程（还需 `ls-tree` 判 HEAD），
   * 一次丢弃几十上百个文件就是几十秒的进程创建 —— 批量必须按操作分组，一次覆盖全部路径。
   *
   * 分组判据直接取 `FileChangeStatus`（**不是** porcelain 的 A/M/D 字母），**不再逐文件 `ls-tree`**：
   *   · `staged`                    ⇒ 先 `reset HEAD --`（一次覆盖）
   *   · `added`（已暂存的新增）      ⇒ reset 后成未跟踪 ⇒ 只能 `clean -f` 删文件
   *   · `untracked`                 ⇒ 直接 `clean -f`
   *   · `renamed`                   ⇒ 同新增处理（reset 后新路径成未跟踪；旧路径的删除由后续丢弃/还原收尾，
   *                                    与单文件实现的 `isFileInHead=false → clean` 行为一致）
   *   · 其余                        ⇒ `checkout --` 从 HEAD 还原工作区
   *
   * ⚠️ 顺序不能换：`checkout --` 从 **index** 取内容还原工作区，必须先 reset 再 checkout，
   *    否则「已暂存的改动」会被原样写回工作区，看起来像没丢成功。
   * ⚠️ `checkout --` 只要有一条路径不在 HEAD 就整条失败，这就是必须按状态拆成三组的原因。
   *
   * 失败语义：分组命令任一失败即向上抛（由调用方提示）。此处刻意不做「逐文件容错重试」——
   * 那会把一次批量退化成 N 次进程，与批量丢弃的初衷相悖。
   */
  async discardFiles(projectPath: string, files: DiscardTarget[]): Promise<void> {
    if (files.length === 0) return
    // 冲突文件（unmerged）任何一条 checkout 都会整组失败（git: "path is unmerged"），
    // 且「丢弃」对冲突没有正确语义（应走解决冲突流程）⇒ 一键前置于任何写操作，绝不半途而废。
    const unmerged = files.filter((f) => f.status === "unmerged")
    if (unmerged.length > 0) {
      throw new Error(`存在 ${unmerged.length} 个未解决的冲突文件，请先解决冲突后再丢弃`)
    }
    // ⚠️ 判据是 `FileChangeStatus` 的枚举值（"added"），不是 porcelain 的 'A' 字母。
    //    写成 startsWith("A") 会把新增文件误分到 checkout 组，整批以
    //    `pathspec ... did not match any file(s)` 失败（本模块有真实仓库用例守着）。
    const isAdded = (status: string): boolean => status === "added"
    /** 需要 reset 的（全部已暂存路径） */
    const resetPaths: string[] = []
    /** reset 后需要从工作区删除的（新增 / 重命名 / 未跟踪） */
    const cleanPaths: string[] = []
    /** 需要从 HEAD 还原到工作区的 */
    const checkoutPaths: string[] = []

    for (const file of files) {
      if (file.staged) resetPaths.push(file.path)
      if (file.status === "untracked" || file.status === "renamed" || (file.staged && isAdded(file.status))) {
        cleanPaths.push(file.path)
      } else {
        checkoutPaths.push(file.path)
      }
    }

    if (resetPaths.length > 0) {
      await this.executor.execGit(projectPath, ["reset", "HEAD", "--", ...resetPaths])
    }
    if (checkoutPaths.length > 0) {
      await this.executor.execGit(projectPath, ["checkout", "--", ...checkoutPaths])
    }
    if (cleanPaths.length > 0) {
      // -d：目录型新增（整目录未跟踪）也能一并清掉；不带它时 git 会跳过这些路径而不报错
      await this.executor.execGit(projectPath, ["clean", "-f", "-d", "--", ...cleanPaths])
    }
  }

  async commit(projectPath: string, message: string): Promise<string> {
    return await this.executor.execGit(projectPath, ["commit", "-m", message])
  }

  /**
   * 切换分支
   */
  async switchBranch(projectPath: string, branch: string): Promise<string> {
    const wtInfo = await this.getWorkingTreeStatus(projectPath)
    if (wtInfo.hasChanges) {
      throw new Error(
        `工作区有 ${wtInfo.stagedCount + wtInfo.unstagedCount + wtInfo.untrackedCount} 个未提交的变更，请先提交或暂存`,
      )
    }
    return await this.executor.execGit(projectPath, ["checkout", branch])
  }

  /**
   * 删除本地分支。
   * - 默认 `-d`：git 会拒绝删除含未合并提交的分支（由调用方二次确认后再强制）；
   * - `force=true` 时 `-D`：连同未合并提交一并删除；
   * - 当前分支前置拦截，避免只拿到 git 的英文报错。
   */
  async deleteBranch(projectPath: string, branch: string, force = false): Promise<string> {
    const current = await this.executor.getCurrentBranch(projectPath)
    if (current === branch) {
      throw new Error(`不能删除当前分支 ${branch}，请先切换到其他分支`)
    }
    return await this.executor.execGit(projectPath, ["branch", force ? "-D" : "-d", "--", branch])
  }

  /** 暂存当前工作区变更 */
  async stashSave(projectPath: string, message?: string): Promise<void> {
    const args = ["stash", "push", "--include-untracked"]
    if (message) args.push("-m", message)
    await this.executor.execGit(projectPath, args)
  }

  /**
   * 列出所有 stash 条目。
   *
   * ⚠️ 命令失败时**抛出**，不吞成 `[]`：调用方（卡片详情）必须能区分「没有 stash」与
   * 「读不到仓库」。后者伪装成空列表会让卡片显示「无 stash」并把详情标记为已加载，
   * 此后再不重试；失败抛出才能进入错误态与失败冷却（见 useCardData.ensureDetailsLoaded）。
   */
  async stashList(projectPath: string): Promise<StashEntry[]> {
    const raw = await this.executor.execGit(projectPath, ["stash", "list"])
    if (!raw) return []
    return parseStashList(raw)
  }

  /** 恢复最近一次 stash（pop） */
  async stashPop(projectPath: string, index = 0): Promise<void> {
    await this.executor.execGit(projectPath, ["stash", "pop", `stash@{${index}}`])
  }

  /** 应用 stash 但不删除 */
  async stashApply(projectPath: string, index = 0): Promise<void> {
    await this.executor.execGit(projectPath, ["stash", "apply", `stash@{${index}}`])
  }

  /** 删除 stash 条目 */
  async stashDrop(projectPath: string, index = 0): Promise<void> {
    await this.executor.execGit(projectPath, ["stash", "drop", `stash@{${index}}`])
  }

  /**
   * 获取当前分支最近 N 条提交记录。
   *
   * ⚠️ 命令失败时**抛出**（同 `stashList`）：空仓库/无提交属于「成功但为空」，返回 `[]`；
   * 仓库被删、路径失效、git 报错则抛出，交给调用方呈现错误态并进入失败冷却。
   */
  async getCommitLog(projectPath: string, count: number | "all" = 30): Promise<CommitLogEntry[]> {
    // 每行一条的格式串；末行 `%P%x1f%D` = 完整父 hash + 引用装饰（0x1f 保证根提交行非空）。
    // 解析见 utils/gitOutput.parseCommitLog。
    // %H 完整 hash 作为单一真源：UI 需要短展示时自行截取前 7 位；修正/删除/打 Tag 等
    // 后续 git 定位直接拿完整 hash（短 hash 在大仓库有歧义风险，见 HistoryRewriter 注释）
    const format = "%H%n%s%n%an%n%ar%n%aI%n%P%x1f%D"
    // "all" 加 -n 5000 保护上限：全量输出在大仓库可能超 10MB maxBuffer 直接 reject
    const args = count === "all"
      ? ["log", "-n", "5000", `--format=${format}`]
      : ["log", `-${count}`, `--format=${format}`]
    const raw = await this.executor.execGit(projectPath, args)
    if (!raw) return []
    return parseCommitLog(raw)
  }

  /**
   * 获取最近 N 条提交的变更规模（文件数 + 增删行数），供 LOG Tab 行悬停提示。
   *
   * ⚠️ **必须批量取**，不能按需逐个 `git show --shortstat`：
   * `--shortstat` 会让 git 为每条提交计算一次 diff（实测本仓库 200 条提交：
   * 不带该选项 ~0.3s，带则 ~2.3s；单条 `git show --shortstat` 约 260ms）。
   * 逐条懒加载 200 行 ≈ 52s，批量一次约 2.3s，故采用「后台一次性取 + 前端映射」。
   *
   * 上限 LOG_STAT_LIMIT 条：500 条实测约 3.0s，超过后 git 侧耗时增长趋缓但收益递减，
   * 且远超 LOG 列表默认展示的 200 条；超出部分的行不展示悬停统计（降级为原 title）。
   *
   * merge 提交按 git 约定无 shortstat 行，不会出现在返回的 Map 中（UI 跳过提示）。
   */
  async getCommitShortStats(projectPath: string, count: number | "all" = DEFAULT_LOG_LIMIT): Promise<Map<string, CommitStat>> {
    try {
      // 与 getCommitLog 的条数上限口径一致；"all" 同样加保护上限，避免超长历史上限击穿 maxBuffer
      const limit = count === "all" ? LOG_STAT_LIMIT : Math.min(count, LOG_STAT_LIMIT)
      // %x01 作记录分隔：shortstat 是可选行，换行切分无法定界（详见 parseCommitShortStats 注释）。
      // 键用 %H 与 getCommitLog 的完整 hash 同口径（UI 按 entry.hash 直接命中）
      const raw = await this.executor.execGit(projectPath, [
        "log",
        `-${limit}`,
        "--shortstat",
        "--format=%x01%H",
      ])
      if (!raw) return new Map()
      return parseCommitShortStats(raw)
    } catch {
      // 统计失败按「无数据」降级：LOG Tab 仅少一层悬停提示，不影响列表本身
      return new Map()
    }
  }

  /**
   * 获取本地分支列表。
   *
   * ⚠️ 命令失败时**抛出**（同 `getCommitLog`）：空仓库没有分支属于「成功但为空」。
   */
  async getBranches(projectPath: string): Promise<BranchInfo[]> {
    const raw = await this.executor.execGit(projectPath, ["branch", "--format=%(refname:short)%00%(HEAD)"])
    if (!raw) return []
    return parseBranches(raw)
  }

  /** 当前分支名（detached 归一化为空串；与 RemoteOps 共用 GitExecutor 的单一实现） */
  async getBranch(projectPath: string): Promise<string> {
    return this.executor.getCurrentBranch(projectPath)
  }

  /** 列出全部远程跟踪分支短名（如 origin/main），供一致性比对（本地读取，失败返回 []） */
  async getRemoteTrackingRefs(projectPath: string): Promise<string[]> {
    try {
      const raw = await this.executor.execGit(projectPath, [
        "for-each-ref",
        "refs/remotes",
        "--format=%(refname:short)",
      ])
      // 排除 origin/HEAD 之类的符号 ref（其 short 名为 origin -> origin/HEAD 形式或直接以 /HEAD 结尾）
      return raw.split("\n").map((l) => l.trim()).filter((l) => l && !l.endsWith("/HEAD"))
    } catch {
      return []
    }
  }

  /**
   * 一次 `for-each-ref` 取齐「本地分支 + 远程跟踪 ref」的名字与 sha（一致性分析专用）。
   *
   * 取代原先的 `getBranches` + `getRemoteTrackingRefs` 两次进程；更关键的是带上 sha：
   * 本地分支 sha 与远程跟踪 ref sha 相等即「已同步」，无需再跑
   * `rev-list --left-right --count`（健康仓库里绝大多数分支都命中，B×R 次进程直接归零）。
   *
   * @param remoteNames 已知远程名（用于切分 `refs/remotes/<remote>/<branch>`）
   */
  async getRefSnapshot(projectPath: string, remoteNames: string[]): Promise<RefSyncSnapshot> {
    try {
      const raw = await this.executor.execGit(projectPath, [
        "for-each-ref",
        // %(HEAD) 对当前分支输出 "*"，其余为空格 —— 用来标记「当前分支」而不额外跑一次解析
        "--format=%(refname)%00%(objectname)%00%(HEAD)",
        "refs/heads",
        "refs/remotes",
      ])
      return parseRefSnapshot(raw, remoteNames)
    } catch {
      // 失败返回空快照：审计侧会把该项目呈现为「无分支/无远程」，与原来两次调用都失败时一致
      return {
        branches: [],
        remoteRefs: [],
      }
    }
  }

  /**
   * 计算 localBranch 相对 remoteRef 的领先/落后提交数
   * rev-list --left-right --count remoteRef...localBranch：左侧(remote)独有计入 behind，右侧(local)独有计入 ahead
   * 调换 ... 两侧会静默反转 ahead/behind，切勿改动顺序
   */
  async countAheadBehind(projectPath: string, remoteRef: string, localBranch: string): Promise<{ ahead: number, behind: number }> {
    const counts = await this.executor.execGit(projectPath, [
      "rev-list",
      "--left-right",
      "--count",
      `${remoteRef}...${localBranch}`,
    ])
    const parts = counts.split("\t")
    return {
      behind: Number.parseInt(parts[0] || "0", 10) || 0,
      ahead: Number.parseInt(parts[1] || "0", 10) || 0,
    }
  }

  async getHeadHash(projectPath: string): Promise<string> {
    try {
      return (await this.executor.execGit(projectPath, ["rev-parse", "HEAD"])).trim()
    } catch {
      return ""
    }
  }

  async checkIsGitRepo(projectPath: string): Promise<boolean> {
    try {
      await this.executor.execGit(projectPath, ["rev-parse", "--is-inside-work-tree"])
      return true
    } catch {
      return false
    }
  }

  /**
   * 解析 gitdir 绝对路径（供 .git 文件监听定位目标）。
   *
   * 用 `--absolute-git-dir` 而非拼接 `${projectPath}/.git`：worktree / submodule / 分离式
   * gitdir（`.git` 是文件而非目录）下拼接结果错误，监听会全部落空且静默无效。
   * 单次 git 调用（~250ms），仅在建监听与周期性重建时发生，不进轮询热路径。
   * 失败（非仓库 / git 不可用）返回空串，调用方据此跳过监听并降级到轮询层。
   */
  async getGitDir(projectPath: string): Promise<string> {
    try {
      return (await this.executor.execGit(projectPath, ["rev-parse", "--absolute-git-dir"])).trim()
    } catch {
      return ""
    }
  }

  /**
   * 获取暂存区完整 diff 补丁（供 AI 深度生成理解实际改动），失败返回空串。
   * 与 getCommitDeepContext 配对：一个面向历史提交（git show），一个面向暂存区（git diff --cached）；
   * 输出已是纯 diff（无提交信息头），调用方直接交给 buildDiffContext 分块分配预算。
   */
  async getStagedDiff(projectPath: string): Promise<string> {
    try {
      return await this.executor.execGit(projectPath, buildWorktreeDiffArgs({ staged: true })) || ""
    } catch {
      return ""
    }
  }

  /** 解析暂存区变更文件列表（git diff --cached --name-status；无暂存内容/失败返回空数组） */
  async getStagedFiles(projectPath: string): Promise<FileChange[]> {
    try {
      const raw = await this.executor.execGit(projectPath, [
        "diff",
        "--cached",
        "--name-status",
      ])
      if (!raw) return []
      // 清单全部来自暂存区 ⇒ 覆写 staged 标记（parseCommitFiles 面向历史提交，默认 false）
      return parseCommitFiles(raw).map((f) => ({
        ...f,
        staged: true,
      }))
    } catch {
      return []
    }
  }

  /**
   * 获取某次提交的完整 diff 补丁（供 AI 修正/深度分析理解实际改动），失败返回空串。
   * 提交信息头原样保留不占预算；diff 部分按文件分块分配 budget（与暂存区生成的 diffContextBudget 同一配置），
   * 替代旧的 substring(0, 10000) 整体硬截断——单提交多文件时首个大文件会挤占其余文件的可见性。
   */
  async getCommitDeepContext(projectPath: string, hash: string, budget = 10000): Promise<string> {
    try {
      const text = await this.executor.execGit(
        projectPath,
        buildShowPatchArgs({ hash, format: "--format=%B" }),
      ) || ""
      // 行首锚定匹配 diff 起点，防提交消息体恰好包含 "diff --git " 字符串时误判为 diff 开头
      const diffStart = /^diff --git /m.exec(text)?.index ?? -1
      if (diffStart < 0) { return text.substring(0, 10000) }
      return text.substring(0, diffStart) + buildDiffContext(text.substring(diffStart), budget)
    } catch {
      return ""
    }
  }

  /** 获取某次提交的完整原始提交信息（%B 含多行 body；提交日志的 %s 会把多行折叠成单行导致格式丢失），失败返回空串 */
  async getCommitFullMessage(projectPath: string, hash: string): Promise<string> {
    try {
      const raw = await this.executor.execGit(projectPath, [
        "show",
        "-s",
        "--format=%B",
        hash,
      ])
      return (raw || "").trim()
    } catch {
      return ""
    }
  }

  /** 解析某次提交涉及的文件变更列表（git show --name-status；merge/无文件提交返回空数组，UI 据 isMerge 提示） */
  async getCommitFiles(projectPath: string, hash: string): Promise<FileChange[]> {
    try {
      const raw = await this.executor.execGit(projectPath, [
        "show",
        "--name-status",
        "--format=",
        hash,
      ])
      if (!raw) return []
      return parseCommitFiles(raw)
    } catch {
      return []
    }
  }

  /** 获取某次提交对指定文件的补丁（git show --format= <hash> -- <path>），无内容/失败返回空串 */
  async getCommitFilePatch(projectPath: string, hash: string, filePath: string): Promise<string> {
    return (await this.getCommitFilePatchResult(projectPath, hash, filePath)).text
  }

  /** 提交内单文件补丁及状态（二进制 / 超限 / 失败与无差异分开） */
  async getCommitFilePatchResult(projectPath: string, hash: string, filePath: string): Promise<FileDiffResult> {
    try {
      const text = await this.executor.execGit(projectPath, buildShowPatchArgs({ hash, filePath }))
      return this.classifyPatch(text)
    } catch (e: unknown) {
      return this.failureResult(e)
    }
  }

  /** 修改当前 HEAD 提交信息（仅允许最近一次提交，调用方负责前置校验） */
  async amendCommitMessage(projectPath: string, message: string): Promise<string> {
    return await this.executor.execGit(projectPath, [
      "commit",
      "--amend",
      "-m",
      message,
    ])
  }

  /** 仓库是否处于 rebase 中断状态（rebase-merge/rebase-apply 目录存在，如上次重写失败的残留） */
  async isInRebaseState(projectPath: string): Promise<boolean> {
    const node = getNodeFsPathOs()
    if (!node) return false
    const {
      fs,
      path,
    } = node
    try {
      // --git-path 无论目录是否存在都返回相对 projectPath 的路径，需 existsSync 判定
      const [mergeDir, applyDir] = await Promise.all([
        this.executor.execGit(projectPath, ["rev-parse", "--git-path", "rebase-merge"]),
        this.executor.execGit(projectPath, ["rev-parse", "--git-path", "rebase-apply"]),
      ])
      return [mergeDir, applyDir].some((d) => !!d.trim() && fs.existsSync(path.resolve(projectPath, d.trim())))
    } catch {
      return false
    }
  }

  /** 是否 merge 提交（存在第二父；批量修正弹窗据此标记不可修正项），无法解析时按非 merge 处理 */
  async isMergeCommit(projectPath: string, hash: string): Promise<boolean> {
    const info = await this.resolveCommitInfo(projectPath, hash)
    return info.isMerge
  }

  /**
   * 一次解析提交的完整 hash 与第二父信息（merge 判定）。
   *
   * 合并原先分散在 isMergeCommit / isAncestorOfHead / dropCommit / rewriteCommitMessage
   * 的重复调用：每处都先 `rev-parse <hash>^{commit}` 再 `rev-parse --verify <fullHash>^2`，
   * 而 dropCommit 等调用方在调用前已自行解析过一次 fullHash，造成同一次用户操作内
   * 对同一 hash 反复 spawn git 子进程（Windows 下单次进程创建 20~50ms）。
   *
   * @param knownFullHash 调用方已知的完整 hash，传入可省一次 `rev-parse ^{commit}`
   * @returns fullHash 为空串表示解析失败（提交不存在）
   */
  private async resolveCommitInfo(
    projectPath: string,
    hash: string,
    knownFullHash?: string,
  ): Promise<{ fullHash: string, isMerge: boolean }> {
    const fullHash = (knownFullHash
      || await this.executor.execGit(projectPath, ["rev-parse", `${hash}^{commit}`]).catch(() => "")).trim()
    if (!fullHash) { return {
      fullHash: "",
      isMerge: false,
    }
    }
    const secondParent = (await this.executor.execGit(
      projectPath,
      ["rev-parse", "--verify", `${fullHash}^2`],
    ).catch(() => "")).trim()
    return {
      fullHash,
      isMerge: !!secondParent,
    }
  }

  /**
   * 重写指定提交信息（个人项目安全版）：
   * - 目标是 HEAD 时直接 amend；
   * - 历史提交用 fast-import 单进程流式重建提交图（纯消息改写：树与父子结构原样保留），
   *   不走 rebase——线性 rebase 会拍平下游 merge 的侧链导致必现冲突，且重放触碰
   *   工作区文件（可能被 IDE/资源管理器占用）；fast-import 全程只建对象不碰工作区，
   *   失败时引用未被更新，仓库保持原状。
   */
  async rewriteCommitMessage(
    projectPath: string,
    hash: string,
    message: string,
    preserveDate = false,
    onProgress?: (current: number, total: number) => void,
  ): Promise<string> {
    // 前置检测：仓库处于 rebase 中断状态（如用户终端操作残留）时直接报错，避免在其上叠加改写
    if (await this.isInRebaseState(projectPath)) {
      throw new Error("仓库处于 rebase 中断状态（可能由上次操作失败残留），请先在终端执行 git rebase --abort 恢复后重试")
    }

    // 解析完整 hash 避免短 hash 定位错误，同时取第二父供 merge 判定（一次命令取代原先两次）
    const info = await this.resolveCommitInfo(projectPath, hash)
    const fullHash = info.fullHash
    if (!fullHash) throw new Error("找不到指定提交")

    // merge 提交直接拒绝：其消息由 git 自动生成（非用户书写），修正无意义
    if (info.isMerge) {
      throw new Error("该提交是 merge 提交，不支持修正：merge 消息由 git 自动生成")
    }

    const headHash = (await this.getHeadHash(projectPath)).trim()
    // HEAD 直接走 amend，无后代需重建
    if (headHash === fullHash) {
      if (preserveDate) {
        // 保留原提交的 committer date，避免 GitHub 显示为当前时间
        const originalDate = (await this.executor.execGit(projectPath, ["log", "-1", "--format=%cI", fullHash])).trim()
        if (originalDate) {
          // timeoutMs 传 undefined：commit 是本地命令，走 GitExecutor 的可配置本地超时（默认 60s，设置面板持久化）
          return await this.executor.execGit(
            projectPath,
            ["commit", "--amend", "-m", message],
            undefined,
            undefined,
            undefined,
            { env: { GIT_COMMITTER_DATE: originalDate } },
          )
        }
      }
      return await this.amendCommitMessage(projectPath, message)
    }

    return await this.historyRewriter.rewriteMessage(projectPath, fullHash, headHash, message, preserveDate, onProgress)
  }

  /**
   * 删除指定历史提交（记录级删除、内容不变语义，个人项目安全版）：
   * 目标提交从历史跳过，其变更并入下一提交（后代以原树重建、父指针重指向目标的父），
   * 最终 HEAD 的 tree 与删除前完全一致；后代 hash 必然重写，已推送需 --force-with-lease 强推。
   * 走 fast-import 图重建（同 rewriteCommitMessage，不碰工作区，失败时引用未更新仓库保持原状）。
   */
  async dropCommit(
    projectPath: string,
    hash: string,
    onProgress?: (current: number, total: number) => void,
  ): Promise<string> {
    // 前置检测：仓库处于 rebase 中断状态（如用户终端操作残留）时直接报错，避免在其上叠加改写
    if (await this.isInRebaseState(projectPath)) {
      throw new Error("仓库处于 rebase 中断状态（可能由上次操作失败残留），请先在终端执行 git rebase --abort 恢复后重试")
    }

    // 解析完整 hash，避免短 hash 在后续定位中匹配错误；同时取第二父信息供 merge 判定
    // （fullHash 复用给 isMergeCommit / isAncestorOfHead，省去两处重复 rev-parse）
    const info = await this.resolveCommitInfo(projectPath, hash)
    const fullHash = info.fullHash
    if (!fullHash) throw new Error("找不到指定提交")

    const headHash = (await this.getHeadHash(projectPath)).trim()
    // HEAD 拒绝：删 HEAD = reset 语义（记录与内容一并丢失），与"内容不变"语义相悖
    if (headHash === fullHash) {
      throw new Error("不支持删除最新提交（HEAD）：该操作会同时丢失其内容变更，请使用丢弃变更或重置功能")
    }
    // merge 拒绝：多父提交被跳过后，子提交的父指向存在歧义（该接第一父还是合并两侧？）
    if (info.isMerge) {
      throw new Error("该提交是 merge 提交，不支持删除：跳过后子提交的父指向存在歧义")
    }
    // 祖先校验：目标不在 HEAD 历史上时重建范围抓不到它的后代，操作会静默无效，必须显式报错
    if (!(await this.isAncestorOfHead(projectPath, fullHash, headHash))) {
      throw new Error("该提交不在当前分支的历史上（可能在其他分支），无法从当前分支删除")
    }

    return await this.historyRewriter.drop(projectPath, fullHash, headHash, onProgress)
  }

  /**
   * 目标提交是否为当前 HEAD 的祖先（hash 支持短/完整；merge-base --is-ancestor 退出码判定；解析失败按否处理）
   *  @param knownFullHash 调用方已知的完整 hash（省一次 rev-parse）
   *  @param knownHeadHash 调用方已知的 HEAD hash（省一次 rev-parse）
   */
  async isAncestorOfHead(projectPath: string, hash: string, knownFullHash?: string, knownHeadHash?: string): Promise<boolean> {
    try {
      const fullHash = (knownFullHash
        || await this.executor.execGit(projectPath, ["rev-parse", `${hash}^{commit}`])).trim()
      if (!fullHash) return false
      const headHash = knownHeadHash !== undefined ? knownHeadHash : await this.getHeadHash(projectPath)
      if (!headHash) return false
      await this.executor.execGit(projectPath, ["merge-base", "--is-ancestor", fullHash, headHash])
      return true
    } catch {
      return false
    }
  }
}
