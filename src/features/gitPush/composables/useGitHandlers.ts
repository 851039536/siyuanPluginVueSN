// Git 操作 handler 集群（暂存/提交/丢弃/AI 生成/stash/tag/冲突）
import type { Ref } from "vue"
import { ref } from "vue"
import { showMessage } from "siyuan"
import type { CardDataDomain, GitProject } from "../types"
import { findProject, getProjectRemoteNames, pruneRecordCache, acquireFlag, releaseFlag } from "../utils"
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
  doCommit: (id: string, message: string) => Promise<string>
  generateCommitMsg: (id: string) => Promise<{ message: string, source: string }>
  doStashSave: (id: string, msg: string) => Promise<void>
  doStashPop: (id: string, index: number) => Promise<void>
  doStashApply: (id: string, index: number) => Promise<void>
  doStashDrop: (id: string, index: number) => Promise<void>
  generateStashDesc: (id: string) => Promise<string>
  createTagOp: (id: string, name: string, message?: string) => Promise<void>
  deleteTagOp: (id: string, tag: string) => Promise<void>
  pushTagOp: (id: string, remote: string, tag: string) => Promise<string>
  abortMergeOp: (id: string) => Promise<void>
  resolveConflictOp: (id: string, file: string, strategy: "theirs" | "ours") => Promise<void>
  /** 按域通知卡片重载自持数据（log/tags/conflicts 已下沉 ProjectCard） */
  bumpCardRefresh: (id: string, ...domains: CardDataDomain[]) => void
  loadWorkingTree: (id: string, branch?: string) => Promise<void>
}) {
  const {
    projects, showConfirm, safeGitOp, tf,
    discardFile, doCommit, generateCommitMsg,
    doStashSave, doStashPop, doStashApply, doStashDrop, generateStashDesc,
    createTagOp, deleteTagOp, pushTagOp,
    abortMergeOp, resolveConflictOp,
    bumpCardRefresh, loadWorkingTree,
  } = deps

  /** 提交输出 id → text */
  const commitOutputs = ref<Record<string, string>>({})
  /** AI 生成状态 id → { generating, text } */
  const generatingMsgs = ref<Record<string, { generating: boolean, text: string }>>({})
  /** 暂存/取消操作加载中 id → 计数（引用计数防止并发同类操作先完成者提前清除标志） */
  const gitOpLoading = ref<Record<string, number>>({})
  /** Stash 描述生成加载中 id → true */
  const genStashDescLoading = ref<Record<string, boolean>>({})
  /** 外部生成的 stash 描述文案 */
  const generatedStashMsg = ref("")
  /** Tag 推送操作加载中 id → tagName */
  const tagPushLoading = ref<Record<string, string>>({})

  /** 统一的 git 操作错误处理包装（含 loading 状态） */
  async function handleGitOp(label: string, fn: () => Promise<void>, id: string) {
    commitOutputs.value[id] = ""
    acquireFlag(gitOpLoading.value, id)
    try {
      await fn()
    } catch (e: unknown) {
      console.error(`[gitPush] ${label} 失败:`, e)
      commitOutputs.value[id] = `${label}: ${getErrorMessage(e)}`
    } finally {
      releaseFlag(gitOpLoading.value, id)
      pruneRecordCache(commitOutputs.value)
    }
  }

  async function handleDiscard(id: string, file: string, staged: boolean, status: string) {
    const label = status === "untracked" ? tf("discardUntracked") : tf("discardChanges")
    showConfirm(tf("confirmActionTitle"), tf("discardConfirmBody", label, file), () => {
      doDiscard(id, file, staged, status, label)
    })
  }

  async function doDiscard(id: string, file: string, staged: boolean, status: string, label: string) {
    commitOutputs.value[id] = ""
    acquireFlag(gitOpLoading.value, id)
    try {
      await discardFile(id, file, staged, status)
      await loadWorkingTree(id)
    } catch (e: unknown) {
      commitOutputs.value[id] = tf("discardOpFailed", label, getErrorMessage(e))
    } finally {
      releaseFlag(gitOpLoading.value, id)
    }
  }

  // ---- Stash 操作 ----

  async function handleGenStashDesc(id: string) {
    genStashDescLoading.value[id] = true
    try {
      const desc = await generateStashDesc(id)
      if (desc) generatedStashMsg.value = desc
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

  function handleCreateTag(id: string, name: string, message?: string) {
    safeGitOp(tf("createTagFailed"), () => createTagOp(id, name, message).then(() => { bumpCardRefresh(id, "tags") }))
  }

  function handleDeleteTag(id: string, tag: string) {
    showConfirm(tf("deleteTagTitle"), tf("deleteTagConfirm", tag), () => {
      safeGitOp(tf("deleteTagFailed"), () => deleteTagOp(id, tag).then(() => { bumpCardRefresh(id, "tags") }))
    })
  }

  async function handlePushTag(id: string, tag: string) {
    const project = findProject(projects, id)
    if (!project) return
    // 收集所有已配置的远程
    const remoteNames = getProjectRemoteNames(project).map((r) => r.name)
    if (remoteNames.length === 0) { showMessage(tf("noRemoteFound"), 3000, "error"); return }
    tagPushLoading.value = {
      ...tagPushLoading.value,
      [id]: tag,
    }
    try {
      // allSettled 汇总全部失败远程：Promise.all 会 fast-fail，多远程部分成功时只报第一个错
      const results = await Promise.allSettled(remoteNames.map((name) => pushTagOp(id, name, tag)))
      const failures = results
        .filter((r): r is PromiseRejectedResult => r.status === "rejected")
        .map((r) => getErrorMessage(r.reason) || String(r.reason))
      if (failures.length > 0) {
        showMessage(tf("pushTagFailed", failures.join("; ")), 5000, "error")
      }
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

  async function handleCommit(id: string, message: string) {
    commitOutputs.value[id] = ""
    try {
      const result = await doCommit(id, message)
      commitOutputs.value[id] = result || tf("commitSuccess")
      pruneRecordCache(commitOutputs.value)
      // 提交日志已下沉卡片，提交后经信号通知重载
      bumpCardRefresh(id, "log")
    } catch (e: unknown) {
      commitOutputs.value[id] = tf("commitFailed", getErrorMessage(e))
    }
  }

  async function handleGenerateMsg(id: string) {
    generatingMsgs.value = {
      ...generatingMsgs.value,
      [id]: {
        generating: true,
        text: "",
      },
    }
    commitOutputs.value[id] = ""
    try {
      const result = await generateCommitMsg(id)
      generatingMsgs.value = {
        ...generatingMsgs.value,
        [id]: {
          generating: false,
          text: result.message,
        },
      }
      if (result.source === "heuristic") {
        commitOutputs.value[id] = tf("aiHeuristic")
      }
    } catch (e: unknown) {
      commitOutputs.value[id] = tf("generateFailed", getErrorMessage(e))
      generatingMsgs.value = {
        ...generatingMsgs.value,
        [id]: {
          generating: false,
          text: "",
        },
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
  }
}
