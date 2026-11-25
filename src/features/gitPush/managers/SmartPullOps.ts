// 判断拉取：fetch 后按 patch-id 判断本地独有提交；确认全是远端改写后的旧副本时，
// 直接 reset --hard 对齐远端；有真实独有提交则不做任何修改。
import type { PlatformKey } from "../types/meta"
import type { GitExecutor } from "./GitExecutor"
import type { ProjectStore } from "./ProjectStore"
import type { ProjectWriteLock } from "./ProjectWriteLock"
import type { RemoteOpResult } from "./RemoteOps"
import type { RemoteOpOptions, PipelineStageKey } from "../types/pipeline"
import { createGitProgressParser } from "../utils/gitProgress"
import { parseAheadBehind, parseWorktreeStatusV2, findBlockingUntracked } from "../utils/gitOutput"
import { getProjectRemoteName } from "../utils/platform"
import { resolveValidPathWithSource } from "../utils/project"
import { getErrorMessage } from "@/utils/stringUtils"

/** 判断拉取中最多列出的阻塞提交数（避免错误提示刷屏） */
const MAX_LISTED_COMMITS = 10
/** 判断拉取中最多列出的冲突未跟踪文件数 */
const MAX_LISTED_UNTRACKED = 10

export class SmartPullOps {
  constructor(
    private executor: GitExecutor,
    private store: ProjectStore,
    private writeLock: ProjectWriteLock,
  ) {}

  /**
   * 判断拉取指定远程。
   *
   * 判据（缺一不可）：
   *   1. 工作区无已跟踪文件的未提交改动；
   *   2. 本地领先提交按 patch-id 比较后，均为远程已包含的旧副本（提交信息/SHA 重写不会产生独有提交）；
   *   3. 未跟踪文件不会与远端新树冲突（reset --hard 只删除「挡路」的未跟踪文件）。
   * 满足时直接强制对齐远端（不建备份分支，旧提交仅能通过 reflog 找回）；任一不满足则不改动仓库。
   */
  async smartPullSingle(
    id: string,
    target: PlatformKey,
    opts?: RemoteOpOptions,
  ): Promise<RemoteOpResult> {
    const project = await this.store.getProjectById(id)
    if (!project) return { ok: false, stdout: "", stderr: "项目未找到" }

    const resolved = resolveValidPathWithSource(project)
    const cwd = resolved.path
    const pathWarning = resolved.source === "fallback"
      ? "⚠ 所有已知路径均不存在，已回退主路径，请检查项目路径配置"
      : ""
    const remoteName = getProjectRemoteName(project, target)
    if (!remoteName) return { ok: false, stdout: "", stderr: "该平台远程未配置" }

    return this.executor.withAbortController(id, "pull", (signal) =>
      this.writeLock.runExclusive(cwd, async () => {
        const startedAt = Date.now()
        const fail = (msg: string, canceled = false): RemoteOpResult => ({
          ok: false,
          stdout: "",
          stderr: canceled ? "操作已取消" : (pathWarning ? `${pathWarning}\n${msg}` : msg),
          canceled,
          durationMs: Date.now() - startedAt,
        })
        const done = (stdout: string): RemoteOpResult => ({
          ok: true,
          stdout,
          stderr: "",
          durationMs: Date.now() - startedAt,
        })
        const canceled = () => fail("操作已取消", true)
        const emitStage = (stage: PipelineStageKey) =>
          opts?.onProgress?.({ target, kind: "stage", stage })
        const emitDetail = (detail: string) =>
          opts?.onProgress?.({ target, kind: "detail", detail })

        if (signal.aborted) return canceled()
        try {
          // 1. 一次调用同时拿「分支 + 工作区」：porcelain v2 的 `# branch.head` 与文件列表同源，
          //    取代原先 `getCurrentBranch` + `status --porcelain` 的两次进程（省 1 次进程/次操作）。
          //    顺带把「工作区必须干净」的判定提到 fetch **之前** —— 脏工作区连网络都不必发，
          //    也不必先动远程跟踪引用。v2 的 branch 已在解析层把 `(detached)` 归一化为空串。
          //    `-z` 让含换行/制表符的文件名不再错位（未跟踪清单会直接用于 reset --hard 的挡路判定）。
          emitStage("status")
          const statusRaw = await this.executor.execGit(
            cwd, ["status", "--porcelain=v2", "--branch", "-z"], signal,
          )
          const status = parseWorktreeStatusV2(statusRaw)
          const branch = status.branch
          if (!branch) {
            return fail("判断拉取失败：当前处于 detached HEAD，无法确定要覆盖的本地分支。")
          }

          // 2. 工作区必须干净：reset --hard 会丢弃已跟踪文件的未提交改动
          const dirtyTracked = status.files.filter((f) => f.status !== "untracked")
          if (dirtyTracked.length > 0) {
            return fail(
              `判断拉取已中止：工作区有 ${dirtyTracked.length} 个已跟踪文件存在未提交改动。\n`
              + "请先提交或 stash 后再试（判断拉取只在工作区干净时覆盖本地）。",
            )
          }

          // 3. 只更新远程跟踪引用，不动工作区（失败时工作区与分支均保持原状）
          emitStage("fetch")
          // fetch 的真实进度统一映射到 fetch 阶段；stdout/stderr 各持一份解析器
          const fetchParsers = {
            stdout: createGitProgressParser(),
            stderr: createGitProgressParser(),
          }
          await this.executor.execGit(
            cwd,
            ["fetch", "--progress", "--prune", remoteName],
            signal,
            undefined,
            (chunk, stream) => {
              for (const line of fetchParsers[stream].push(chunk)) {
                // 只有数据接收/解包/解析增量的百分比有意义；枚举/计数/压缩的 100% 不能当传输进度
                const percent = line.stage === "receiving" || line.stage === "unpacking" || line.stage === "resolving"
                  ? line.percent
                  : undefined
                opts?.onProgress?.({
                  target,
                  kind: "stage",
                  stage: "fetch",
                  percent,
                  detail: line.detail,
                })
              }
            },
          )
          // 4. 远程分支必须存在，且相对 HEAD 的领先/落后关系可判定
          emitStage("inspect")
          const ref = `${remoteName}/${branch}`
          const refRaw = await this.executor.execGit(cwd, [
            "for-each-ref",
            "--format=%(refname:short)%00%(ahead-behind:HEAD)",
            `refs/remotes/${remoteName}/${branch}`,
          ], signal)
          const stat = parseAheadBehind(refRaw).get(ref)
          if (!stat) {
            return fail(`判断拉取失败：远程分支 ${ref} 不存在（可能已被删除，或远程配置指向了别的仓库）。`)
          }
          if (stat.behind === 0) {
            return done(`远程 ${ref} 没有新提交，本地无需覆盖（本地领先 ${stat.ahead} 个提交）。`)
          }
          if (stat.ahead === 0) {
            // 本地严格落后：快进即可（merge --ff-only 遇到挡路未跟踪文件会报错而非删除）
            emitStage("align")
            await this.executor.execGit(cwd, ["merge", "--ff-only", ref], signal)
            return done(`判断拉取完成：本地无独有提交，已快进到 ${ref}。`)
          }

          // 5. 关键判据：patch-id 忽略提交信息与 SHA，只有真正独有的改动才计入
          emitStage("compare")
          const uniqueRaw = await this.executor.execGit(cwd, [
            "rev-list", "--cherry-pick", "--right-only", "--count", `${ref}...HEAD`,
          ], signal)
          const uniqueLocal = Number.parseInt(uniqueRaw.trim(), 10) || 0
          if (uniqueLocal > 0) {
            const listRaw = await this.executor.execGit(cwd, [
              "rev-list", "--oneline", "--cherry-pick", "--right-only", `${ref}...HEAD`,
            ], signal)
            const list = listRaw.split("\n").filter(Boolean).slice(0, MAX_LISTED_COMMITS)
            return fail([
              `判断拉取已中止：本地有 ${uniqueLocal} 个远端未包含的独有提交，为避免丢失工作未做任何修改。`,
              ...list,
              uniqueLocal > list.length ? `… 其余 ${uniqueLocal - list.length} 个提交未列出` : "",
              `如确认要放弃这些提交，请在终端手动执行 git reset --hard ${ref}（可先建备份分支）。`,
            ].filter(Boolean).join("\n"))
          }

          // 6. 未跟踪文件只在会与远端新树冲突时阻塞（reset --hard 会删除挡路项）
          const untracked = status.files.filter((f) => f.status === "untracked").map((f) => f.path)
          if (untracked.length > 0) {
            const treeRaw = await this.executor.execGit(
              cwd, ["ls-tree", "-r", "--name-only", ref], signal,
            )
            const blocked = findBlockingUntracked(untracked, treeRaw.split("\n").filter(Boolean))
            if (blocked.length > 0) {
              return fail([
                "判断拉取已中止：以下未跟踪文件会被强制对齐覆盖，已保留原状：",
                ...blocked.slice(0, MAX_LISTED_UNTRACKED).map((p) => `  ${p}`),
                blocked.length > MAX_LISTED_UNTRACKED
                  ? `… 其余 ${blocked.length - MAX_LISTED_UNTRACKED} 个文件未列出`
                  : "",
                "请先移走这些文件或将其加入 .gitignore 后重试。",
              ].filter(Boolean).join("\n"))
            }
          }

          // 7. 强制对齐（调用方已二次确认，不建备份分支）
          emitStage("align")
          await this.executor.execGit(cwd, ["reset", "--hard", ref], signal)

          return done(
            `判断拉取完成：本地 ${stat.ahead} 个提交均为远端已包含的旧副本（历史被重写），已对齐到 ${ref}。\n`
            + "未创建备份分支；如需找回旧提交，可在该仓库执行 git reflog 查看并复位。",
          )
        } catch (e: unknown) {
          if (signal.aborted) return canceled()
          const msg = getErrorMessage(e) || String(e)
          emitDetail(msg)
          return fail(`判断拉取失败：${msg}`)
        }
      }),
    )
  }
}
