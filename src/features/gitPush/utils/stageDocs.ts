// 阶段教学卡：每个流水线阶段的说明 / 对应命令 / 常见问题（文案真源在 zh_CN.json）
import type { PipelineStageKey } from "../types/pipeline"

/** 一个阶段的教学文案键；cmd / pitfall 可选，缺失时卡片不渲染对应行 */
export interface StageDocKeys {
  what: string
  cmd?: string
  pitfall?: string
}

/** 阶段 → 文案键；显式映射便于死键检查，不做字符串拼接推导 */
export const STAGE_DOC_KEYS: Record<PipelineStageKey, StageDocKeys> = {
  prepare: { what: "opStageDocPrepare", pitfall: "opStagePitfallPrepare" },
  enumerating: { what: "opStageDocEnumerating", cmd: "opStageCmdEnumerating", pitfall: "opStagePitfallEnumerating" },
  counting: { what: "opStageDocCounting", cmd: "opStageCmdCounting", pitfall: "opStagePitfallCounting" },
  compressing: { what: "opStageDocCompressing", cmd: "opStageCmdCompressing", pitfall: "opStagePitfallCompressing" },
  writing: { what: "opStageDocWriting", cmd: "opStageCmdWriting", pitfall: "opStagePitfallWriting" },
  receiving: { what: "opStageDocReceiving", cmd: "opStageCmdReceiving", pitfall: "opStagePitfallReceiving" },
  unpacking: { what: "opStageDocUnpacking", cmd: "opStageCmdUnpacking", pitfall: "opStagePitfallUnpacking" },
  resolving: { what: "opStageDocResolving", cmd: "opStageCmdResolving", pitfall: "opStagePitfallResolving" },
  remote: { what: "opStageDocRemote", cmd: "opStageCmdRemote", pitfall: "opStagePitfallRemote" },
  updating: { what: "opStageDocUpdating", cmd: "opStageCmdUpdating", pitfall: "opStagePitfallUpdating" },

  status: { what: "opStageDocStatus", cmd: "opStageCmdStatus", pitfall: "opStagePitfallStatus" },
  fetch: { what: "opStageDocFetch", cmd: "opStageCmdFetch", pitfall: "opStagePitfallFetch" },
  inspect: { what: "opStageDocInspect", cmd: "opStageCmdInspect", pitfall: "opStagePitfallInspect" },
  compare: { what: "opStageDocCompare", cmd: "opStageCmdCompare", pitfall: "opStagePitfallCompare" },
  align: { what: "opStageDocAlign", cmd: "opStageCmdAlign", pitfall: "opStagePitfallAlign" },
  commitWrite: { what: "opStageDocCommitWrite", cmd: "opStageCmdCommitWrite", pitfall: "opStagePitfallCommitWrite" },
  switchExec: { what: "opStageDocSwitchExec", cmd: "opStageCmdSwitchExec", pitfall: "opStagePitfallSwitchExec" },
  refreshWorktree: { what: "opStageDocRefreshWorktree", cmd: "opStageCmdRefreshWorktree" },
  refreshSync: { what: "opStageDocRefreshSync", cmd: "opStageCmdRefreshSync" },
  refreshState: { what: "opStageDocRefreshState", cmd: "opStageCmdRefreshState" },
  reloadViews: { what: "opStageDocReloadViews", cmd: "opStageCmdReloadViews" },
  stashExec: { what: "opStageDocStashExec", cmd: "opStageCmdStashExec", pitfall: "opStagePitfallStashExec" },
  stashDrop: { what: "opStageDocStashDrop", cmd: "opStageCmdStashDrop", pitfall: "opStagePitfallStashDrop" },
  discardExec: { what: "opStageDocDiscardExec", cmd: "opStageCmdDiscardExec", pitfall: "opStagePitfallDiscardExec" },
  stageAll: { what: "opStageDocStageAll", cmd: "opStageCmdStageAll", pitfall: "opStagePitfallStageAll" },
  generateMsg: { what: "opStageDocGenerateMsg", cmd: "opStageCmdGenerateMsg", pitfall: "opStagePitfallGenerateMsg" },
  fetchExec: { what: "opStageDocFetchExec", cmd: "opStageCmdFetchExec", pitfall: "opStagePitfallFetchExec" },
  refreshStatus: { what: "opStageDocRefreshStatus", cmd: "opStageCmdRefreshStatus" },
  statsQuery: { what: "opStageDocStatsQuery", cmd: "opStageCmdStatsQuery", pitfall: "opStagePitfallStatsQuery" },
  analysisScan: { what: "opStageDocAnalysisScan", cmd: "opStageCmdAnalysisScan", pitfall: "opStagePitfallAnalysisScan" },
  analysisAggregate: { what: "opStageDocAnalysisAggregate", pitfall: "opStagePitfallAnalysisAggregate" },
  reportScan: { what: "opStageDocReportScan", cmd: "opStageCmdReportScan", pitfall: "opStagePitfallReportScan" },
  reportAggregate: { what: "opStageDocReportAggregate", pitfall: "opStagePitfallReportAggregate" },
  repoPackScan: { what: "opStageDocRepoPackScan", cmd: "opStageCmdRepoPackScan" },
  repoObjectScan: { what: "opStageDocRepoObjectScan", cmd: "opStageCmdRepoObjectScan", pitfall: "opStagePitfallRepoObjectScan" },
  repoPathScan: { what: "opStageDocRepoPathScan", cmd: "opStageCmdRepoPathScan", pitfall: "opStagePitfallRepoPathScan" },
  repoAnchorScan: { what: "opStageDocRepoAnchorScan", cmd: "opStageCmdRepoAnchorScan", pitfall: "opStagePitfallRepoAnchorScan" },
  tagPushExec: { what: "opStageDocTagPushExec", cmd: "opStageCmdTagPushExec", pitfall: "opStagePitfallTagPushExec" },
}

/** 解析后的教学卡内容；任一必填文案缺失即视为无内容 */
export interface StageDoc {
  what: string
  cmd?: string
  pitfall?: string
}

/**
 * 从 i18n 取某个阶段的教学卡。
 * 必填的 what 缺失时返回 null，让组件整块隐藏，而不是显示半张空卡片。
 */
export function resolveStageDoc(
  key: PipelineStageKey,
  i18n: Record<string, unknown>,
): StageDoc | null {
  const keys = STAGE_DOC_KEYS[key]
  const what = keys ? i18n[keys.what] : undefined
  if (typeof what !== "string" || what.length === 0) return null
  const cmd = keys.cmd ? i18n[keys.cmd] : undefined
  const pitfall = keys.pitfall ? i18n[keys.pitfall] : undefined
  return {
    what,
    cmd: typeof cmd === "string" && cmd.length > 0 ? cmd : undefined,
    pitfall: typeof pitfall === "string" && pitfall.length > 0 ? pitfall : undefined,
  }
}
