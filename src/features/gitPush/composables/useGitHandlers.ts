// Git 操作 handler 集群（暂存/提交/丢弃/AI 生成/stash/tag/冲突）
import type { Ref } from "vue"
import { ref } from "vue"
import { showMessage } from "siyuan"
import { showUndoMessage } from "../notify"
import type { GitProject, ProjectQueryKind, UndoOutcome } from "../types"
import type { PipelineOp, PipelineStageKey } from "../types/pipeline"
import type { DiscardTarget } from "../types/storage"
import type { LocalPipelineStepper } from "./useOpPipeline"
import { DISCARD_STAGE_PLAN, QUICK_COMMIT_STAGE_PLAN, TAG_PUSH_STAGE_PLAN } from "../utils/opPipeline"
import { findProject, getProjectRemoteNames, pruneRecordCache, acquireFlag, releaseFlag, shouldUseDeepCommitMessage, summarizeCommitSize } from "../utils"
import type { NumstatEntry } from "../utils"
import { describeAiFallback } from "../utils/i18nFormat"
import { checkCommitRule } from "../commitRuleChecker"
import { getErrorMessage } from "@/utils/stringUtils"

export function useGitHandlers(deps: {
  projects: Ref<GitProject[]>
  /** 通用确认弹窗（由 index.vue 提供） */
  showConfirm: (title: string, message: string, onConfirm: () => void, confirmText?: string) => void
  /** 统一异步错误处理包装（由 index.vue 提供） */
  safeGitOp: (label: string, fn: () => Promise<void>) => Promise<void>
  /** i18n 取值 + 占位替换（由 index.vue 提供） */
  tf: (key: string, ...args: (string | number)[]) => string
  // ── useGitPush 领域操作 ──
  discardFile: (id: string, file: string, staged: boolean, status: string) => Promise<void>
  /** 批量丢弃（全部 / 选中）：一次写锁 + 分组命令 */
  discardFiles: (id: string, files: DiscardTarget[]) => Promise<void>
  /** 全部暂存 */
  stageAllItems: (id: string) => Promise<void>
  /** 暂存区变更规模（numstat）：一键提交据此选择简单/深度生成 */
  getStagedOverview: (id: string) => Promise<Record<string, NumstatEntry> | null>
  doCommit: (id: string, message: string) => Promise<string>
  /** 撤销上一次写操作（日志驱动；提交用 soft，merge/reset 用 hard） */
  undoLastOp: (id: string) => Promise<UndoOutcome>
  generateCommitMsg: (id: string) => Promise<{ message: string, source: string, fallback?: string, detail?: string }>
  /** 深度生成提交信息（读取暂存区完整 diff，输出多行标题 + 改动要点） */
  deepGenerateCommitMsg: (id: string) => Promise<{ message: string, source: string, fallback?: string, detail?: string }>
  doStashSave: (id: string, msg: string) => Promise<void>
  doStashPop: (id: string, index: number) => Promise<void>
  doStashApply: (id: string, index: number) => Promise<void>
  doStashDrop: (id: string, index: number) => Promise<void>
  generateStashDesc: (id: string) => Promise<string>
  createTagOp: (id: string, name: string, message?: string, commitRef?: string) => Promise<void>
  deleteTagOp: (id: string, tag: string) => Promise<void>
  pushTagOp: (id: string, remote: string, tag: string) => Promise<string>
  abortMergeOp: (id: string) => Promise<void>
  resolveConflictOp: (id: string, file: string, strategy: "theirs" | "ours") => Promise<void>
  /** 按域标记卡片自持数据为脏（log/tags/conflicts 已下沉 ProjectCard） */
  bumpCardRefresh: (id: string, ...domains: ProjectQueryKind[]) => void
  /** 重载工作区状态（调度器内部复用缓存分支名，无需调用方传 branch） */
  loadWorkingTree: (id: string) => Promise<void>
  /** 本地操作流水线（由 useGitOps 注入，包装真实 await 步骤） */
  runLocalPipeline: <T>(
    id: string,
    op: PipelineOp,
    label: string,
    plan: readonly PipelineStageKey[],
    fn: (stepper: LocalPipelineStepper) => Promise<T>,
  ) => Promise<T>
}) {
  const {
    projects, showConfirm, safeGitOp, tf,
    discardFile, discardFiles, stageAllItems, getStagedOverview, doCommit, undoLastOp, generateCommitMsg, deepGenerateCommitMsg,
    doStashSave, doStashPop, doStashApply, doStashDrop, generateStashDesc,
    createTagOp, deleteTagOp, pushTagOp,
    abortMergeOp, resolveConflictOp,
    bumpCardRefresh, loadWorkingTree,
    runLocalPipeline,
  } = deps

  /** 提交输出 id → text */
  const commitOutputs = ref<Record<string, string>>({})
  /** AI 生成状态 id → { generating, deepGenerating, text }（两标记互斥，仅一个为 true） */
  const generatingMsgs = ref<Record<string, { generating: boolean, deepGenerating: boolean, text: string }>>({})
  /** 暂存/取消操作加载中 id → 计数（引用计数防止并发同类操作先完成者提前清除标志） */
  const gitOpLoading = ref<Record<string, number>>({})
  /** Stash 描述生成加载中 id → true */
  const genStashDescLoading = ref<Record<string, boolean>>({})
  /** 外部生成的 stash 描述文案 id → text（按项目分槽：单值 ref 会让 A 项目生成的描述串到 B 项目的输入框） */
  const generatedStashMsg = ref<Record<string, string>>({})
  /** Tag 推送操作加载中 id → tagName */
  const tagPushLoading = ref<Record<string, string>>({})

  /**
   * 统一的 git 操作错误处理包装（含 loading 状态）
   */
  async function handleGitOp(label: string, fn: () => Promise<void>, id: string) {
    commitOutputs.value[id] = ""
    acquireFlag(gitOpLoading.value, id)
    try {
      await fn()
    } catch (e: unknown) {
      console.error(`[gitPush] ${label} 失败:`, e)
      reportFailure(id, `${label}: ${getErrorMessage(e)}`)
    } finally {
      releaseFlag(gitOpLoading.value, id)
      pruneRecordCache(commitOutputs.value)
    }
  }

  /**
   * 失败反馈统一入口：既写入项目输出框（保留完整细节供排查），又弹一次 toast。
   *
   * 为什么必须两条都走：输出框挂在「工作区」（CHANGES）页签内，用户当前停在
   * LOG / STASH / TAG 页签时它根本不在屏幕上 —— 失败会完全静默。此前同为失败，
   * tag 推送走 toast、丢弃/提交走输出框，可见度不一致。现统一为「toast 即时可见 +
   * 输出框保留细节」，与远端操作的失败反馈口径一致。
   */
  function reportFailure(id: string, text: string) {
    commitOutputs.value[id] = text
    showMessage(text, 5000, "error")
  }

  async function handleDiscard(id: string, file: string, staged: boolean, status: string) {
    const label = status === "untracked" ? tf("discardUntracked") : tf("discardChanges")
    showConfirm(tf("confirmActionTitle"), tf("discardConfirmBody", label, file), () => {
      doDiscard(id, file, staged, status, label)
    })
  }

  async function doDiscard(id: string, file: string, staged: boolean, status: string, label: string) {
    try {
      await runLocalPipeline(id, "discard", label, DISCARD_STAGE_PLAN, async (stepper) => {
        commitOutputs.value[id] = ""
        acquireFlag(gitOpLoading.value, id)
        try {
          stepper.step("discardExec", file)
          await discardFile(id, file, staged, status)
          stepper.step("refreshWorktree")
          await loadWorkingTree(id)
        } finally {
          releaseFlag(gitOpLoading.value, id)
        }
      })
    } catch (e: unknown) {
      reportFailure(id, tf("discardOpFailed", label, getErrorMessage(e)))
    }
  }

  /**
   * 批量丢弃入口（「全部丢弃」与「丢弃所选」共用）。
   *
   * 三件事必须做对，否则一次误操作就是不可逆事故：
   *   1. **冲突文件先剔除**：`git checkout` 对 unmerged 路径直接报错，会让整组失败；
   *      剔除同时写进确认文案，避免用户以为它们也被丢了。
   *   2. **未跟踪 / 新增文件单独点明**：这类文件是**从磁盘删除**，没有 git 历史可恢复，
   *      必须比「还原改动」更醒目（文案里给数量）。
   *   3. **确认按钮文案用「丢弃更改」**：默认「确定」对破坏性操作太轻。
   */
  function handleDiscardMany(id: string, files: DiscardTarget[]) {
    if (files.length === 0) return
    const targets = files.filter((f) => f.status !== "unmerged")
    const skipped = files.length - targets.length
    if (targets.length === 0) {
      showMessage(tf("discardAllConflictOnly"), 4000, "error")
      return
    }
    // 与 WorktreeOps.discardFiles 的 clean 分组保持一致：这些路径会被 clean -f 从磁盘删除
    // ⚠️ 状态是 FileChangeStatus 枚举值（"added"），不是 porcelain 的 'A' 字母
    const removable = targets.filter((f) =>
      f.status === "untracked" || f.status === "renamed" || (f.staged && f.status === "added"),
    ).length
    const body = removable > 0
      ? tf("discardManyConfirmUntracked", targets.length, removable)
      : tf("discardManyConfirmBody", targets.length)
    const message = skipped > 0 ? `${body} ${tf("discardConflictSkipped", skipped)}` : body
    showConfirm(tf("confirmActionTitle"), message, () => {
      void doDiscardMany(id, targets)
    }, tf("discardChanges"))
  }

  async function doDiscardMany(id: string, files: DiscardTarget[]) {
    try {
      await runLocalPipeline(id, "discard", tf("discardChanges"), DISCARD_STAGE_PLAN, async (stepper) => {
        commitOutputs.value[id] = ""
        acquireFlag(gitOpLoading.value, id)
        try {
          stepper.step("discardExec", `${files.length}`)
          await discardFiles(id, files)
          stepper.step("refreshWorktree")
          await loadWorkingTree(id)
        } finally {
          releaseFlag(gitOpLoading.value, id)
        }
      })
    } catch (e: unknown) {
      reportFailure(id, tf("discardManyOpFailed", files.length, getErrorMessage(e)))
    }
  }

  // ---- Stash 操作 ----

  async function handleGenStashDesc(id: string) {
    genStashDescLoading.value[id] = true
    try {
      const desc = await generateStashDesc(id)
      if (desc) generatedStashMsg.value[id] = desc
    } catch {
      // 失败则保持输入内容不变
    } finally {
      delete genStashDescLoading.value[id]
    }
  }

  function handleStashConfirmMsg(id: string, msg: string) {
    safeGitOp(tf("stashSaveFailed"), () => doStashSave(id, msg))
  }

  function handleStashPop(id: string, index: number) {
    showConfirm(tf("stashPopTitle"), tf("stashPopConfirm", index), () => {
      safeGitOp(tf("stashPopFailed"), () => doStashPop(id, index))
    })
  }

  function handleStashApply(id: string, index: number) {
    safeGitOp(tf("stashApplyFailed"), () => doStashApply(id, index))
  }

  function handleStashDrop(id: string, index: number) {
    showConfirm(tf("stashDropTitle"), tf("stashDropConfirm", index), () => {
      safeGitOp(tf("stashDropFailed"), () => doStashDrop(id, index))
    })
  }

  // ── Tag 操作 ──

  function handleCreateTag(id: string, name: string, message?: string, commitRef?: string) {
    safeGitOp(tf("createTagFailed"), () => createTagOp(id, name, message, commitRef).then(() => { bumpCardRefresh(id, "tags") }))
  }

  function handleDeleteTag(id: string, tag: string) {
    showConfirm(tf("deleteTagTitle"), tf("deleteTagConfirm", tag), () => {
      safeGitOp(tf("deleteTagFailed"), () => deleteTagOp(id, tag).then(() => { bumpCardRefresh(id, "tags") }))
    })
  }

  async function handlePushTag(id: string, tag: string, remoteName?: string) {
    const project = findProject(projects, id)
    if (!project) return
    // 指定远程时只推该远程；未指定时收集所有已配置的远程全部推送
    const remoteNames = remoteName ? [remoteName] : getProjectRemoteNames(project).map((r) => r.name)
    if (remoteNames.length === 0) { showMessage(tf("noRemoteFound"), 3000, "error"); return }
    tagPushLoading.value = {
      ...tagPushLoading.value,
      [id]: tag,
    }
    try {
      await runLocalPipeline(id, "tagPush", tf("pipelineTagPush"), TAG_PUSH_STAGE_PLAN, async (stepper) => {
        stepper.step("tagPushExec")
        // allSettled 汇总全部失败远程：Promise.all 会 fast-fail，多远程部分成功时只报第一个错
        const results = await Promise.allSettled(remoteNames.map((name) => pushTagOp(id, name, tag)))
        const failures = results
          .filter((r): r is PromiseRejectedResult => r.status === "rejected")
          .map((r) => getErrorMessage(r.reason) || String(r.reason))
        if (failures.length > 0) {
          showMessage(tf("pushTagFailed", failures.join("; ")), 5000, "error")
          // 让 lane 收敛为 fail；错误已通过 toast 呈现，外层不再重复提示
          throw new Error(failures.join("; "))
        }
      })
    } catch {
      // lane 已标 fail；失败详情由上方 toast 保留
    } finally {
      delete tagPushLoading.value[id]
      // ref<Record> 的 delete 不被 Vue 深层响应式追踪检测到，需手动触发浅拷贝
      tagPushLoading.value = { ...tagPushLoading.value }
    }
  }

  // ── 冲突操作 ──

  function handleAbortMerge(id: string) {
    showConfirm(tf("abortMergeTitle"), tf("abortMergeConfirm"), () => {
      safeGitOp(tf("abortMergeFailed"), () => abortMergeOp(id).then(() => { bumpCardRefresh(id, "conflicts") }))
    })
  }

  function handleResolveConflict(id: string, file: string, strategy: "theirs" | "ours") {
    // ours/theirs 直接覆盖冲突文件，另一侧未保留的改动不可恢复，必须先确认
    showConfirm(tf("resolveConflictTitle"), tf("resolveConflictConfirm", file, strategy), () => {
      safeGitOp(tf("resolveConflictFailed"), () => resolveConflictOp(id, file, strategy).then(() => { bumpCardRefresh(id, "conflicts") }))
    })
  }

  /**
   * 提交成功后的 10 秒撤销入口（F0.5 Toast + F6 日志驱动撤销）。
   * 撤销失败只提示、不改写提交输出：那时用户更需要「为什么没撤成」而不是提交回显。
   * key 与 reset 共用 `undo-<项目>`：撤销始终针对**最新一条记账操作**，
   * 否则连续提交/重置时旧 Toast 会把点击带到已经变化的历史上。
   * 刷新由 `undoLastOp` 内部完成（工作区 / 推送状态 / 各域脏标记），这里不再重复。
   */
  function offerCommitUndo(id: string) {
    showUndoMessage(tf("commitUndoAvailable"), () => {
      void (async () => {
        try {
          await undoLastOp(id)
        } catch (e: unknown) {
          showMessage(tf("commitUndoFailed", getErrorMessage(e)), 5000, "error")
        }
      })()
    }, `undo-${id}`, tf("undoAction"))
  }

  async function handleCommit(id: string, message: string) {
    commitOutputs.value[id] = ""
    try {
      const result = await doCommit(id, message)
      commitOutputs.value[id] = result || tf("commitSuccess")
      pruneRecordCache(commitOutputs.value)
      // 提交日志已下沉卡片，提交后经信号通知重载
      bumpCardRefresh(id, "log")
      offerCommitUndo(id)
    } catch (e: unknown) {
      reportFailure(id, tf("commitFailed", getErrorMessage(e)))
    }
  }

  /**
   * 提交信息生成（常规 / 深度）共用流程：两个入口只是「需要置位的加载标记」与「生成函数」不同，
   * 状态置位、输出清理、启发式提示、失败回置完全同构，故收敛到一处避免双份分支漂移。
   */
  async function runGenerateMsg(
    id: string,
    mode: "generating" | "deepGenerating",
    generate: (id: string) => Promise<{ message: string, source: string, fallback?: string, detail?: string }>,
  ) {
    // 两标记互斥：手动点击另一入口时先清掉旧标记，避免两个按钮同时转圈
    generatingMsgs.value = {
      ...generatingMsgs.value,
      [id]: {
        generating: mode === "generating",
        deepGenerating: mode === "deepGenerating",
        text: "",
      },
    }
    commitOutputs.value[id] = ""
    try {
      const result = await generate(id)
      generatingMsgs.value = {
        ...generatingMsgs.value,
        [id]: { generating: false, deepGenerating: false, text: result.message },
      }
      if (result.source === "heuristic") {
        // 按降级原因给不同提示：没配密钥 / 无改动 / 调用失败 / 输出不合规，不能都压成「AI 未返回有效信息」
        commitOutputs.value[id] = describeAiFallback(result, tf)
      }
    } catch (e: unknown) {
      reportFailure(id, tf("generateFailed", getErrorMessage(e)))
      generatingMsgs.value = {
        ...generatingMsgs.value,
        [id]: { generating: false, deepGenerating: false, text: "" },
      }
    }
  }

  async function handleGenerateMsg(id: string) {
    await runGenerateMsg(id, "generating", generateCommitMsg)
  }

  /** 深度生成提交信息：读取暂存区完整 diff 让 AI 输出多行标题 + 改动要点 */
  async function handleDeepGenerateMsg(id: string) {
    await runGenerateMsg(id, "deepGenerating", deepGenerateCommitMsg)
  }

  /**
   * 一键暂存并提交：全部暂存 → 自动生成提交信息 → 规则校验 → 提交。
   * 生成结果先写回草稿：校验不通过时只填框不提交，避免绕过硬阻止。
   */
  async function handleStageGenerateCommit(id: string) {
    commitOutputs.value[id] = ""
    // 复用生成中标记：按钮转圈并阻止重复点击
    generatingMsgs.value = {
      ...generatingMsgs.value,
      [id]: { generating: true, deepGenerating: false, text: "" },
    }
    try {
      await runLocalPipeline(
        id, "commit", tf("quickCommit"), QUICK_COMMIT_STAGE_PLAN,
        async (stepper) => {
          // 先暂存全部变更（无变更时为空操作），再按暂存区规模选择生成方式
          stepper.step("stageAll")
          await stageAllItems(id)
          stepper.step("generateMsg")
          // numstat 取规模：多文件 / 大改动走深度生成（标题 + 要点），小改动保持单行、少耗 token
          const overview = await getStagedOverview(id)
          const useDeep = shouldUseDeepCommitMessage(summarizeCommitSize(overview ?? {}))
          const result = await (useDeep ? deepGenerateCommitMsg : generateCommitMsg)(id)
          generatingMsgs.value = {
            ...generatingMsgs.value,
            [id]: { generating: false, deepGenerating: false, text: result.message },
          }
          if (!result.message.trim() || result.fallback === "no-diff") {
            commitOutputs.value[id] = tf("quickCommitNoChanges")
            return
          }
          if (checkCommitRule(result.message)) {
            commitOutputs.value[id] = tf("quickCommitInvalid")
            return
          }
          stepper.step("commitWrite")
          const commitResult = await doCommit(id, result.message)
          stepper.step("refreshState")
          let output = commitResult || tf("commitSuccess")
          if (result.source === "heuristic") {
            // 一键提交也要说明消息由启发式降级产出
            output = `${describeAiFallback(result, tf)}\n${output}`
          }
          commitOutputs.value[id] = output
          pruneRecordCache(commitOutputs.value)
          bumpCardRefresh(id, "log")
          offerCommitUndo(id)
        },
      )
    } catch (e: unknown) {
      reportFailure(id, tf("quickCommitFailed", getErrorMessage(e)))
      generatingMsgs.value = {
        ...generatingMsgs.value,
        [id]: { generating: false, deepGenerating: false, text: "" },
      }
    }
  }

  return {
    commitOutputs,
    generatingMsgs,
    gitOpLoading,
    genStashDescLoading,
    generatedStashMsg,
    tagPushLoading,
    handleGitOp,
    handleDiscard,
    handleDiscardMany,
    handleGenStashDesc,
    handleStashConfirmMsg,
    handleStashPop,
    handleStashApply,
    handleStashDrop,
    handleCreateTag,
    handleDeleteTag,
    handlePushTag,
    handleAbortMerge,
    handleResolveConflict,
    handleCommit,
    handleGenerateMsg,
    handleDeepGenerateMsg,
    handleStageGenerateCommit,
  }
}
