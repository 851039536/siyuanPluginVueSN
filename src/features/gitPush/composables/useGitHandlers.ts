// Git 操作 handler 集群（暂存/提交/丢弃/AI 生成/stash/tag/冲突）
import type { Ref } from "vue"
import { ref } from "vue"
import { showMessage } from "siyuan"
import type { GitProject } from "../types"
import { getProjectRemoteNames, pruneRecordCache } from "../utils"

export function useGitHandlers(deps: {
  projects: Ref<GitProject[]>
  /** 通用确认弹窗（由 index.vue 提供） */
  showConfirm: (title: string, message: string, onConfirm: () => void, confirmText?: string) => void
  /** 统一异步错误处理包装（由 index.vue 提供） */
  safeGitOp: (label: string, fn: () => Promise<void>) => Promise<void>
  /** i18n 取值 + 占位替换（由 index.vue 提供） */
  tf: (key: string, fallback: string, ...args: (string | number)[]) => string
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
  pushTagOp: (id: string, remote: string, tag: string) => Promise<void>
  abortMergeOp: (id: string) => Promise<void>
  resolveConflictOp: (id: string, file: string, strategy: "theirs" | "ours") => Promise<void>
  checkConflicts: (id: string) => Promise<void>
  loadTags: (id: string) => Promise<unknown>
  loadCommitLog: (id: string, count?: number) => Promise<void>
  loadWorkingTree: (id: string, skipRefresh?: boolean, branch?: string) => Promise<void>
}) {
  const {
    projects, showConfirm, safeGitOp, tf,
    discardFile, doCommit, generateCommitMsg,
    doStashSave, doStashPop, doStashApply, doStashDrop, generateStashDesc,
    createTagOp, deleteTagOp, pushTagOp,
    abortMergeOp, resolveConflictOp, checkConflicts,
    loadTags, loadCommitLog, loadWorkingTree,
  } = deps

  /** 提交输出 id → text */
  const commitOutputs = ref<Record<string, string>>({})
  /** AI 生成状态 id → { generating, text } */
  const generatingMsgs = ref<Record<string, { generating: boolean, text: string }>>({})
  /** 暂存/取消操作加载中 id → true */
  const gitOpLoading = ref<Record<string, boolean>>({})
  /** Stash 描述生成加载中 id → true */
  const genStashDescLoading = ref<Record<string, boolean>>({})
  /** 外部生成的 stash 描述文案 */
  const generatedStashMsg = ref("")
  /** Tag 推送操作加载中 id → tagName */
  const tagPushLoading = ref<Record<string, string>>({})

  /** 统一的 git 操作错误处理包装（含 loading 状态） */
  async function handleGitOp(label: string, fn: () => Promise<void>, id: string) {
    commitOutputs.value[id] = ""
    gitOpLoading.value[id] = true
    try {
      await fn()
    } catch (e: any) {
      console.error(`[gitPush] ${label} 失败:`, e)
      commitOutputs.value[id] = `${label}: ${e?.message || e}`
    } finally {
      delete gitOpLoading.value[id]
      pruneRecordCache(commitOutputs.value)
    }
  }

  async function handleDiscard(id: string, file: string, staged: boolean, status: string) {
    const label = status === "untracked" ? tf("discardUntracked", "删除未跟踪文件") : tf("discardChanges", "丢弃更改")
    showConfirm(tf("confirmActionTitle", "确认操作"), tf("discardConfirmBody", "确定要{0} \"{1}\" 吗？此操作不可撤销。", label, file), () => {
      doDiscard(id, file, staged, status, label)
    })
  }

  async function doDiscard(id: string, file: string, staged: boolean, status: string, label: string) {
    commitOutputs.value[id] = ""
    gitOpLoading.value[id] = true
    try {
      await discardFile(id, file, staged, status)
      await loadWorkingTree(id)
    } catch (e: any) {
      commitOutputs.value[id] = tf("discardOpFailed", "{0}失败: {1}", label, e?.message || e)
    } finally {
      delete gitOpLoading.value[id]
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
    safeGitOp(tf("stashSaveFailed", "暂存失败"), () => doStashSave(id, msg))
  }

  function handleStashPop(id: string, index: number) {
    showConfirm(tf("stashPopTitle", "恢复 Stash"), tf("stashPopConfirm", "确定恢复 stash@{{0}} 并删除该条目？恢复过程中如有冲突会保留该 stash。", index), () => {
      safeGitOp(tf("stashPopFailed", "恢复失败"), () => doStashPop(id, index))
    })
  }

  function handleStashApply(id: string, index: number) {
    safeGitOp(tf("stashApplyFailed", "应用失败"), () => doStashApply(id, index))
  }

  function handleStashDrop(id: string, index: number) {
    showConfirm(tf("stashDropTitle", "删除 Stash"), tf("stashDropConfirm", "确定删除 stash@{{0}}？此操作不可撤销。", index), () => {
      safeGitOp(tf("stashDropFailed", "删除失败"), () => doStashDrop(id, index))
    })
  }

  // ── Tag 操作 ──

  function handleCreateTag(id: string, name: string, message?: string) {
    safeGitOp(tf("createTagFailed", "创建 Tag 失败"), () => createTagOp(id, name, message).then(() => { loadTags(id) }))
  }

  function handleDeleteTag(id: string, tag: string) {
    showConfirm(tf("deleteTagTitle", "删除 Tag"), tf("deleteTagConfirm", "确定删除 Tag \"{0}\"？此操作不可撤销。", tag), () => {
      safeGitOp(tf("deleteTagFailed", "删除失败"), () => deleteTagOp(id, tag).then(() => { loadTags(id) }))
    })
  }

  async function handlePushTag(id: string, tag: string) {
    const project = projects.value.find((p) => p.id === id)
    if (!project) return
    // 收集所有已配置的远程
    const remoteNames = getProjectRemoteNames(project).map((r) => r.name)
    if (remoteNames.length === 0) { showMessage(tf("noRemoteFound", "未找到远程仓库"), 3000, "error"); return }
    tagPushLoading.value = {
      ...tagPushLoading.value,
      [id]: tag,
    }
    try {
      await Promise.all(remoteNames.map((name) => pushTagOp(id, name, tag)))
    } catch (e: any) {
      showMessage(tf("pushTagFailed", "推送 Tag 失败: {0}", e?.message || e), 5000, "error")
    } finally {
      delete tagPushLoading.value[id]
      // ref<Record> 的 delete 不被 Vue 深层响应式追踪检测到，需手动触发浅拷贝
      tagPushLoading.value = { ...tagPushLoading.value }
    }
  }

  // ── 冲突操作 ──

  function handleAbortMerge(id: string) {
    showConfirm(tf("abortMergeTitle", "中止合并"), tf("abortMergeConfirm", "确定中止合并操作？所有合并进度将丢失。"), () => {
      safeGitOp(tf("abortMergeFailed", "中止合并失败"), () => abortMergeOp(id))
    })
  }

  function handleResolveConflict(id: string, file: string, strategy: "theirs" | "ours") {
    safeGitOp(tf("resolveConflictFailed", "解决冲突失败"), () => resolveConflictOp(id, file, strategy).then(() => { checkConflicts(id) }))
  }

  async function handleCommit(id: string, message: string) {
    commitOutputs.value[id] = ""
    try {
      const result = await doCommit(id, message)
      commitOutputs.value[id] = result || tf("commitSuccess", "提交成功")
      pruneRecordCache(commitOutputs.value)
      await loadCommitLog(id)
    } catch (e: any) {
      commitOutputs.value[id] = tf("commitFailed", "提交失败: {0}", e?.message || e)
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
        commitOutputs.value[id] = tf("aiHeuristic", "AI 未返回有效信息，已使用启发式生成。")
      }
    } catch (e: any) {
      commitOutputs.value[id] = tf("generateFailed", "生成失败: {0}", e?.message || e)
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
