// Git 推送领域 composable 聚合入口
import type { GitPushManager } from "../types"
import { useProjectCrud } from "./useProjectCrud"
import { useGitOps } from "./useGitOps"
import { useGitTagsConflicts } from "./useGitTagsConflicts"
import { useGitStats } from "./useGitStats"

/**
 * gitPush 功能的主 composable 入口。
 * 按职责分解为 4 个领域 composable：
 *   useProjectCrud    — 项目 CRUD、分类、标签、状态
 *   useGitOps         — 推送/拉取、工作区、暂存/提交、stash、远程
 *   useGitTagsConflicts — Tag 管理、冲突检测、提交模板、扫描导入
 *   useGitStats       — 统计视图 computed 属性
 */
export function useGitPush(manager: GitPushManager) {
  const projectCrud = useProjectCrud(manager)
  const gitOps = useGitOps(manager, projectCrud.projects)
  const tagsConflicts = useGitTagsConflicts(manager, projectCrud.projects)
  const stats = useGitStats(
    manager,
    projectCrud.projects,
    projectCrud.categories,
    gitOps.pushStatuses,
    gitOps.workingTrees,
  )

  return {
    // ── 项目 CRUD ──
    projects: projectCrud.projects,
    categories: projectCrud.categories,
    loading: projectCrud.loading,
    allTags: projectCrud.allTags,
    loadProjects: projectCrud.loadProjects,
    addProject: projectCrud.addProject,
    removeProject: projectCrud.removeProject,
    updateProjectMeta: projectCrud.updateProjectMeta,
    toggleStar: projectCrud.toggleStar,
    setProjectStatus: projectCrud.setProjectStatus,
    appendTag: projectCrud.appendTag,
    removeTag: projectCrud.removeTag,
    refreshRemotes: projectCrud.refreshRemotes,
    addCategory: projectCrud.addCategory,
    deleteCategory: projectCrud.deleteCategory,
    moveProject: projectCrud.moveProject,

    // ── Git 操作 ──
    pushProgress: gitOps.pushProgress,
    getPushStatus: gitOps.getPushStatus,
    isPushing: gitOps.isPushing,
    pushOutputs: gitOps.pushOutputs,
    entriesToText: gitOps.entriesToText,
    isPulling: gitOps.isPulling,
    pullOutputs: gitOps.pullOutputs,
    pushStatuses: gitOps.pushStatuses,
    workingTrees: gitOps.workingTrees,
    fileDiffs: gitOps.fileDiffs,
    committing: gitOps.committing,
    commitLogs: gitOps.commitLogs,
    branches: gitOps.branches,
    commitOutputs: gitOps.commitOutputs,
    stashEntries: gitOps.stashEntries,
    stashLoading: gitOps.stashLoading,
    loadPushStatus: gitOps.loadPushStatus,
    loadWorkingTree: gitOps.loadWorkingTree,
    loadProjectGitStatus: gitOps.loadProjectGitStatus,
    loadStatsData: gitOps.loadStatsData,
    loadFileDiff: gitOps.loadFileDiff,
    loadCommitLog: gitOps.loadCommitLog,
    loadBranches: gitOps.loadBranches,
    switchBranch: gitOps.switchBranch,
    stageItem: gitOps.stageItem,
    stageAllItems: gitOps.stageAllItems,
    unstageItem: gitOps.unstageItem,
    unstageAllItems: gitOps.unstageAllItems,
    discardFile: gitOps.discardFile,
    doCommit: gitOps.doCommit,
    generateCommitMsg: gitOps.generateCommitMsg,
    pushToAll: gitOps.pushToAll,
    pushSingle: gitOps.pushSingle,
    pullSingle: gitOps.pullSingle,
    cancelPush: gitOps.cancelPush,
    cancelPull: gitOps.cancelPull,
    loadStashList: gitOps.loadStashList,
    doStashSave: gitOps.doStashSave,
    doStashPop: gitOps.doStashPop,
    doStashApply: gitOps.doStashApply,
    doStashDrop: gitOps.doStashDrop,
    generateStashDesc: gitOps.generateStashDesc,
    addRemoteOp: gitOps.addRemoteOp,
    removeRemoteOp: gitOps.removeRemoteOp,
    editRemoteOp: gitOps.editRemoteOp,
    fetchAllRemotes: gitOps.fetchAllRemotes,

    // ── Tag + 冲突 + 模板 + 扫描 ──
    tagsCache: tagsConflicts.tagsCache,
    tagLoading: tagsConflicts.tagLoading,
    loadTags: tagsConflicts.loadTags,
    createTagOp: tagsConflicts.createTagOp,
    deleteTagOp: tagsConflicts.deleteTagOp,
    pushTagOp: tagsConflicts.pushTagOp,
    conflicts: tagsConflicts.conflicts,
    checkConflicts: tagsConflicts.checkConflicts,
    abortMergeOp: tagsConflicts.abortMergeOp,
    resolveConflictOp: tagsConflicts.resolveConflictOp,
    commitTemplates: tagsConflicts.commitTemplates,
    loadCommitTemplates: tagsConflicts.loadCommitTemplates,
    saveCommitTemplates: tagsConflicts.saveCommitTemplates,
    scanning: tagsConflicts.scanning,
    scanResults: tagsConflicts.scanResults,
    scanDirInput: tagsConflicts.scanDirInput,
    startScan: tagsConflicts.startScan,
    importScanResults: tagsConflicts.importScanResults,

    // ── 统计视图 ──
    gitConcurrency: stats.gitConcurrency,
    loadGitConcurrency: stats.loadGitConcurrency,
    setGitConcurrency: stats.setGitConcurrency,
    projectCount: stats.projectCount,
    remoteCoverage: stats.remoteCoverage,
    pushStatusStats: stats.pushStatusStats,
    needsPushProjects: stats.needsPushProjects,
    uncommittedProjects: stats.uncommittedProjects,
    platformStatusProjects: stats.platformStatusProjects,
    groupedProjects: stats.groupedProjects,
    starredProjects: stats.starredProjects,
  }
}
