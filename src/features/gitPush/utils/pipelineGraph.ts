// 流水线关系图纯逻辑：入口目录、DAG 分层与坐标、运行中高亮聚合（无 Vue / DOM 依赖）
import type {
  OpFailureInfo,
  OpFailureMap,
  OpPipelineLane,
  PipelineOp,
  PipelineRunTimings,
  PipelineStageHistory,
  PipelineStageKey,
  PipelineStatus,
} from "../types/pipeline"
import {
  ANALYSIS_STAGE_PLAN,
  COMMIT_STAGE_PLAN,
  DISCARD_STAGE_PLAN,
  FETCH_STAGE_PLAN,
  PIPELINE_STAGE_LABEL_KEY,
  PULL_STAGE_PLAN,
  PUSH_STAGE_PLAN,
  QUICK_COMMIT_STAGE_PLAN,
  REPORT_STAGE_PLAN,
  REPO_SCAN_STAGE_PLAN,
  runningStage,
  SMART_PULL_STAGE_PLAN,
  STASH_DROP_STAGE_PLAN,
  STASH_STAGE_PLAN,
  STATS_STAGE_PLAN,
  SWITCH_STAGE_PLAN,
  TAG_PUSH_STAGE_PLAN,
} from "./opPipeline"

/** 关系图分类：远程网络 / 本地写 / 统计与分析 */
export type GraphCategory = "remote" | "local" | "stats"

/** 分类展示顺序：决定节点主色条与图例分组 */
export const GRAPH_CATEGORY_ORDER: readonly GraphCategory[] = ["remote", "local", "stats"]

/** 分类 → i18n 文案键 */
export const GRAPH_CATEGORY_LABEL_KEY: Record<GraphCategory, string> = {
  remote: "pipelineGraphCatRemote",
  local: "pipelineGraphCatLocal",
  stats: "pipelineGraphCatStats",
}

/** 节点固定尺寸（像素）：窄面板靠横向平移，不随容器缩放 */
export const GRAPH_NODE_W = 88
/** 节点高度：底部留给「上次耗时」小字，不挤占阶段名 */
export const GRAPH_NODE_H = 38
export const GRAPH_COL_GAP = 24
export const GRAPH_ROW_GAP = 12
export const GRAPH_PAD = 8

/** 一个可被高亮的操作入口（analysis / lineStats 共用同一计划，但保留各自 label） */
export interface GraphEntryDef {
  id: string
  labelKey: string
  category: GraphCategory
  /** lane.op：用于区分共用计划的入口（analysis 与 lineStats） */
  op: PipelineOp
  plan: readonly PipelineStageKey[]
  /** lane.stages 的 key 序列：同 op 不同计划靠它精确匹配（commit vs quickCommit） */
  signature: string
}

function defineEntry(
  id: string,
  labelKey: string,
  category: GraphCategory,
  op: PipelineOp,
  plan: readonly PipelineStageKey[],
): GraphEntryDef {
  return { id, labelKey, category, op, plan, signature: planSignature(plan) }
}

/** 计划签名：把阶段序列压成可精确比较的字符串 */
export function planSignature(plan: readonly PipelineStageKey[]): string {
  return plan.join(">")
}

/** lane 的签名：createLane 按计划逐项 map，所以实际 stages 与计划完全同序 */
export function laneSignature(lane: OpPipelineLane): string {
  return planSignature(lane.stages.map((stage) => stage.key))
}

/** 入口目录：顺序即图例顺序，也决定节点首次出现顺序与层内排序 */
export const PIPELINE_GRAPH_ENTRIES: readonly GraphEntryDef[] = [
  defineEntry("push", "push", "remote", "push", PUSH_STAGE_PLAN),
  defineEntry("pull", "pull", "remote", "pull", PULL_STAGE_PLAN),
  defineEntry("smartPull", "smartPull", "remote", "smartPull", SMART_PULL_STAGE_PLAN),
  defineEntry("fetch", "fetch", "remote", "fetch", FETCH_STAGE_PLAN),
  defineEntry("tagPush", "pipelineTagPush", "remote", "tagPush", TAG_PUSH_STAGE_PLAN),
  defineEntry("commit", "commit", "local", "commit", COMMIT_STAGE_PLAN),
  defineEntry("quickCommit", "quickCommit", "local", "commit", QUICK_COMMIT_STAGE_PLAN),
  defineEntry("stash", "pipelineGraphEntryStash", "local", "stash", STASH_STAGE_PLAN),
  defineEntry("stashDrop", "pipelineGraphEntryStashDrop", "local", "stash", STASH_DROP_STAGE_PLAN),
  defineEntry("switch", "switchBranch", "local", "switch", SWITCH_STAGE_PLAN),
  defineEntry("discard", "discardChanges", "local", "discard", DISCARD_STAGE_PLAN),
  defineEntry("stats", "pipelineStatsRefresh", "stats", "stats", STATS_STAGE_PLAN),
  defineEntry("analysis", "pipelineAnalysis", "stats", "analysis", ANALYSIS_STAGE_PLAN),
  // 行数统计与提交分析共用同一抓取/聚合计划：图上同一条路径，图例保留两个入口
  defineEntry("lineStats", "pipelineLineStats", "stats", "lineStats", ANALYSIS_STAGE_PLAN),
  defineEntry("report", "pipelineReport", "stats", "report", REPORT_STAGE_PLAN),
  defineEntry("repoScan", "pipelineRepoScan", "stats", "repoScan", REPO_SCAN_STAGE_PLAN),
]

/** 按计划签名匹配入口；共用计划时再按 lane.op 精确到具体入口 */
export function entryForLane(
  lane: OpPipelineLane,
  entries: readonly GraphEntryDef[] = PIPELINE_GRAPH_ENTRIES,
): GraphEntryDef | undefined {
  const signature = laneSignature(lane)
  const candidates = entries.filter((entry) => entry.signature === signature)
  if (candidates.length === 0) return undefined
  return candidates.find((entry) => entry.op === lane.op) ?? candidates[0]
}

/** 关系图节点 */
export interface GraphNode {
  key: PipelineStageKey
  labelKey: string
  layer: number
  row: number
  x: number
  y: number
  w: number
  h: number
  /** 经过该节点的入口 id（按目录顺序） */
  entries: readonly string[]
  /** 经过该节点的分类（按展示顺序）；首个为主分类 */
  categories: readonly GraphCategory[]
}

/** 关系图边（同一条阶段先后被多个计划复用时会合并为一条） */
export interface GraphEdge {
  id: string
  from: PipelineStageKey
  to: PipelineStageKey
  /** SVG 贝塞尔路径 */
  path: string
  entries: readonly string[]
}

/** 单个入口经过的节点与边 */
export interface GraphEntryPaths {
  nodeKeys: readonly PipelineStageKey[]
  edgeIds: readonly string[]
}

export interface GraphLayout {
  nodes: readonly GraphNode[]
  edges: readonly GraphEdge[]
  nodeByKey: ReadonlyMap<PipelineStageKey, GraphNode>
  edgeById: ReadonlyMap<string, GraphEdge>
  byEntry: ReadonlyMap<string, GraphEntryPaths>
  width: number
  height: number
}

/**
 * 构建关系图：节点按首次出现合并，边按 `from>to` 去重，
 * 用 Kahn 拓扑做最长路径分层（层内按首次出现排序），坐标完全由常量推导。
 */
export function buildPipelineGraph(
  entries: readonly GraphEntryDef[] = PIPELINE_GRAPH_ENTRIES,
): GraphLayout {
  const entryById = new Map(entries.map((entry) => [entry.id, entry]))
  const nodeOrder: PipelineStageKey[] = []
  const nodeEntries = new Map<PipelineStageKey, string[]>()
  const edgeMap = new Map<string, { from: PipelineStageKey, to: PipelineStageKey, entries: string[] }>()
  const adjacency = new Map<PipelineStageKey, Set<PipelineStageKey>>()
  const inDegree = new Map<PipelineStageKey, number>()

  for (const entry of entries) {
    entry.plan.forEach((key, index) => {
      if (!nodeEntries.has(key)) {
        nodeEntries.set(key, [])
        nodeOrder.push(key)
        adjacency.set(key, new Set())
        inDegree.set(key, 0)
      }
      const owners = nodeEntries.get(key)!
      if (!owners.includes(entry.id)) owners.push(entry.id)
      if (index === 0) return

      const prev = entry.plan[index - 1]!
      const edgeId = `${prev}>${key}`
      let edge = edgeMap.get(edgeId)
      if (!edge) {
        edge = { from: prev, to: key, entries: [] }
        edgeMap.set(edgeId, edge)
        adjacency.get(prev)!.add(key)
        inDegree.set(key, (inDegree.get(key) ?? 0) + 1)
      }
      if (!edge.entries.includes(entry.id)) edge.entries.push(entry.id)
    })
  }

  // 最长路径分层：就绪节点按首次出现顺序出队，保证每次构建结果一致
  const layerOf = new Map<PipelineStageKey, number>()
  for (const key of nodeOrder) layerOf.set(key, 0)
  const remaining = new Map(inDegree)
  const ready = nodeOrder.filter((key) => (remaining.get(key) ?? 0) === 0)
  const processed = new Set<PipelineStageKey>()
  for (let cursor = 0; cursor < ready.length; cursor++) {
    const key = ready[cursor]!
    if (processed.has(key)) continue
    processed.add(key)
    for (const next of adjacency.get(key) ?? []) {
      layerOf.set(next, Math.max(layerOf.get(next) ?? 0, (layerOf.get(key) ?? 0) + 1))
      const left = (remaining.get(next) ?? 0) - 1
      remaining.set(next, left)
      if (left === 0) ready.push(next)
    }
  }
  // 防御：阶段计划理论上无环；若未来引入环，剩余节点贴到首层而不是从图上消失
  if (processed.size < nodeOrder.length) {
    for (const key of nodeOrder) if (!processed.has(key)) layerOf.set(key, 0)
  }

  const layers = new Map<number, PipelineStageKey[]>()
  for (const key of nodeOrder) {
    const layer = layerOf.get(key) ?? 0
    const keys = layers.get(layer)
    if (keys) keys.push(key)
    else layers.set(layer, [key])
  }

  let maxLayer = 0
  let maxRows = 1
  const placements = new Map<PipelineStageKey, { x: number, y: number, row: number }>()
  for (const [layer, keys] of layers) {
    maxLayer = Math.max(maxLayer, layer)
    maxRows = Math.max(maxRows, keys.length)
    keys.forEach((key, row) => {
      placements.set(key, {
        x: GRAPH_PAD + layer * (GRAPH_NODE_W + GRAPH_COL_GAP),
        y: GRAPH_PAD + row * (GRAPH_NODE_H + GRAPH_ROW_GAP),
        row,
      })
    })
  }

  const nodes: GraphNode[] = nodeOrder.map((key) => {
    const place = placements.get(key)!
    const owners = nodeEntries.get(key) ?? []
    const categories = GRAPH_CATEGORY_ORDER.filter((category) =>
      owners.some((id) => entryById.get(id)?.category === category),
    )
    return {
      key,
      labelKey: PIPELINE_STAGE_LABEL_KEY[key],
      layer: layerOf.get(key) ?? 0,
      row: place.row,
      x: place.x,
      y: place.y,
      w: GRAPH_NODE_W,
      h: GRAPH_NODE_H,
      entries: owners,
      categories,
    }
  })

  const nodeByKey = new Map(nodes.map((node) => [node.key, node]))
  const edges: GraphEdge[] = [...edgeMap.entries()].map(([id, edge]) => {
    const from = nodeByKey.get(edge.from)!
    const to = nodeByKey.get(edge.to)!
    const x1 = from.x + from.w
    const y1 = from.y + from.h / 2
    const x2 = to.x
    const y2 = to.y + to.h / 2
    const dx = Math.max(GRAPH_COL_GAP / 2, (x2 - x1) / 2)
    return {
      id,
      from: edge.from,
      to: edge.to,
      path: `M ${x1} ${y1} C ${x1 + dx} ${y1}, ${x2 - dx} ${y2}, ${x2} ${y2}`,
      entries: edge.entries,
    }
  })

  const byEntry = new Map<string, GraphEntryPaths>()
  for (const entry of entries) {
    const edgeIds: string[] = []
    for (let i = 1; i < entry.plan.length; i++) {
      edgeIds.push(`${entry.plan[i - 1]}>${entry.plan[i]}`)
    }
    byEntry.set(entry.id, { nodeKeys: [...entry.plan], edgeIds })
  }

  return {
    nodes,
    edges,
    nodeByKey,
    edgeById: new Map(edges.map((edge) => [edge.id, edge])),
    byEntry,
    width: GRAPH_PAD * 2 + (maxLayer + 1) * GRAPH_NODE_W + maxLayer * GRAPH_COL_GAP,
    height: GRAPH_PAD * 2 + maxRows * GRAPH_NODE_H + (maxRows - 1) * GRAPH_ROW_GAP,
  }
}

/** 模块级单次构建：页面直接消费，避免每次渲染重复计算 */
export const PIPELINE_GRAPH_LAYOUT: GraphLayout = buildPipelineGraph()

/** 状态优先级：running 最高、pending 最低（同阶段多 lane 合并用） */
const STATUS_RANK: Record<PipelineStatus, number> = {
  pending: 0,
  skipped: 1,
  done: 2,
  canceled: 3,
  fail: 4,
  running: 5,
}

/** 单个入口的实时状态（同计划多远程 lane 合并） */
export interface EntryLive {
  entryId: string
  status: PipelineStatus
  /** 仅运行中给出当前阶段，避免终态 lane 看起来还在跑 */
  stageKey?: PipelineStageKey
  /** 真实百分比：多 lane 取已上报值最大值，未上报保持 undefined（不伪造） */
  percent?: number
  stageStartedAt?: number
  laneCount: number
  lanes: readonly { key: string, label: string, status: PipelineStatus }[]
}

/** 单个阶段的实时状态 */
export interface StageLive {
  status: PipelineStatus
  percent?: number
  stalled: boolean
  /** 运行中阶段的最后一条真实输出（多 lane 取先出现者） */
  detail?: string
  /** 运行中阶段的开始时间（多 lane 取最早） */
  startedAt?: number
}

/** 关系图实时高亮数据 */
export interface GraphLive {
  entries: ReadonlyMap<string, EntryLive>
  stages: ReadonlyMap<PipelineStageKey, StageLive>
  activeNodeKeys: ReadonlySet<PipelineStageKey>
  activeEdgeIds: ReadonlySet<string>
}

export const EMPTY_GRAPH_LIVE: GraphLive = {
  entries: new Map(),
  stages: new Map(),
  activeNodeKeys: new Set(),
  activeEdgeIds: new Set(),
}

/**
 * 聚合可见 lane 的实时状态。
 * 只消费真实上报的 percent；终态 lane 由状态机自行清理，这里不做历史缓存。
 */
export function buildPipelineGraphLive(
  lanes: readonly OpPipelineLane[],
  entries: readonly GraphEntryDef[] = PIPELINE_GRAPH_ENTRIES,
): GraphLive {
  if (lanes.length === 0) return EMPTY_GRAPH_LIVE

  const lanesByEntry = new Map<string, OpPipelineLane[]>()
  const stages = new Map<PipelineStageKey, StageLive>()
  const activeNodeKeys = new Set<PipelineStageKey>()
  const activeEdgeIds = new Set<string>()

  for (const lane of lanes) {
    const entry = entryForLane(lane, entries)
    if (!entry) continue
    const owned = lanesByEntry.get(entry.id)
    if (owned) owned.push(lane)
    else lanesByEntry.set(entry.id, [lane])

    for (const stage of lane.stages) {
      const prev = stages.get(stage.key)
      const running = stage.status === "running"
      if (!prev) {
        stages.set(stage.key, {
          status: stage.status,
          percent: running ? stage.percent : undefined,
          stalled: running ? Boolean(stage.stalled) : false,
          detail: running ? stage.detail : undefined,
          startedAt: running ? stage.startedAt : undefined,
        })
        continue
      }
      const status = STATUS_RANK[stage.status] > STATUS_RANK[prev.status] ? stage.status : prev.status
      const percents: number[] = []
      const details: string[] = []
      const starts: number[] = []
      if (status === "running") {
        if (prev.status === "running" && prev.percent !== undefined) percents.push(prev.percent)
        if (running && stage.percent !== undefined) percents.push(stage.percent)
        if (prev.status === "running" && prev.detail) details.push(prev.detail)
        if (running && stage.detail) details.push(stage.detail)
        if (prev.status === "running" && prev.startedAt !== undefined) starts.push(prev.startedAt)
        if (running && stage.startedAt !== undefined) starts.push(stage.startedAt)
      }
      stages.set(stage.key, {
        status,
        percent: percents.length > 0 ? Math.max(...percents) : undefined,
        stalled: status === "running"
          && ((prev.status === "running" && prev.stalled) || (running && Boolean(stage.stalled))),
        detail: details.length > 0 ? details[0] : undefined,
        startedAt: starts.length > 0 ? Math.min(...starts) : undefined,
      })
    }

    if (lane.status !== "running") continue
    const keys = lane.stages.map((stage) => stage.key)
    let index = lane.stages.findIndex((stage) => stage.status === "running")
    if (index < 0) index = lane.stages.reduce((max, stage, i) => (stage.status !== "pending" ? i : max), -1)
    if (index < 0) continue
    activeNodeKeys.add(keys[index]!)
    for (let i = 0; i < index; i++) {
      activeEdgeIds.add(`${keys[i]}>${keys[i + 1]}`)
    }
  }

  const entryLive = new Map<string, EntryLive>()
  for (const [entryId, owned] of lanesByEntry) {
    const status = owned.reduce<PipelineStatus>(
      (acc, lane) => (STATUS_RANK[lane.status] > STATUS_RANK[acc] ? lane.status : acc),
      "pending",
    )
    const running = owned.filter((lane) => lane.status === "running")
    const representative = running.length > 0
      ? [...running].sort((a, b) => a.startedAt - b.startedAt || a.id.localeCompare(b.id))[0]!
      : undefined
    const current = representative ? runningStage(representative) : undefined
    const percents = running
      .map((lane) => runningStage(lane)?.percent)
      .filter((value): value is number => typeof value === "number")
    entryLive.set(entryId, {
      entryId,
      status,
      stageKey: current?.key,
      percent: percents.length > 0 ? Math.max(...percents) : undefined,
      stageStartedAt: current?.startedAt,
      laneCount: owned.length,
      lanes: owned.map((lane) => ({ key: lane.key, label: lane.label, status: lane.status })),
    })
  }

  return { entries: entryLive, stages, activeNodeKeys, activeEdgeIds }
}

/**
 * 节点归属的唯一取值：共享节点只有在能唯一确定归属时才给值。
 * - 未聚焦：只认唯一归属入口（如 writing 仅属于 push）；
 * - 有聚焦：只看聚焦集合内经过该节点的入口，且各入口取到的值必须完全一致
 *   （analysis / lineStats 共用同一计划签名，天然一致）。
 */
function resolveNodeValue<T>(
  node: GraphNode,
  focused: readonly string[],
  entries: readonly GraphEntryDef[],
  valueOf: (entry: GraphEntryDef) => T | undefined,
): T | undefined {
  const owners = focused.length > 0
    ? node.entries.filter((id) => focused.includes(id))
    : node.entries
  if (owners.length === 0) return undefined
  if (focused.length === 0 && owners.length > 1) return undefined

  const values = owners.map((id) => {
    const entry = entries.find((item) => item.id === id)
    return entry ? valueOf(entry) : undefined
  })
  const first = values[0]
  if (first === undefined) return undefined
  return values.every((value) => value === first) ? first : undefined
}

/** 节点「最近一次」阶段耗时（毫秒）；归属无法唯一确定时返回 undefined */
export function nodeLastDuration(
  node: GraphNode,
  focused: readonly string[],
  history: PipelineStageHistory,
  entries: readonly GraphEntryDef[] = PIPELINE_GRAPH_ENTRIES,
): number | undefined {
  return resolveNodeValue(
    node,
    focused,
    entries,
    (entry) => history[entry.signature]?.[0]?.stages[node.key],
  )
}

/**
 * 节点「最近一次」失败记录：归属规则与耗时一致，且只落在真正失败的那个阶段，
 * 避免整条路径上的每个节点都被染红。失败时未记录阶段则不返回（图例仍会提示）。
 */
export function nodeLastFailure(
  node: GraphNode,
  focused: readonly string[],
  failures: OpFailureMap,
  entries: readonly GraphEntryDef[] = PIPELINE_GRAPH_ENTRIES,
): OpFailureInfo | undefined {
  const failure = resolveNodeValue(node, focused, entries, (entry) => failures[entry.signature])
  return failure?.stage === node.key ? failure : undefined
}

/** 入口最近一次失败记录；成功一次后由状态层清除 */
export function entryLastFailure(
  entryId: string,
  failures: OpFailureMap,
  entries: readonly GraphEntryDef[] = PIPELINE_GRAPH_ENTRIES,
): OpFailureInfo | undefined {
  const entry = entries.find((item) => item.id === entryId)
  return entry ? failures[entry.signature] : undefined
}

/** 入口最近一次整条流水线耗时（毫秒）；无记录返回 undefined */
export function entryLastTotal(
  entryId: string,
  history: PipelineStageHistory,
  entries: readonly GraphEntryDef[] = PIPELINE_GRAPH_ENTRIES,
): number | undefined {
  const entry = entries.find((item) => item.id === entryId)
  return entry ? history[entry.signature]?.[0]?.totalMs : undefined
}

/** 入口最近若干次成功运行（最新在前）；供时间线对比 */
export function entryRecentRuns(
  entryId: string,
  history: PipelineStageHistory,
  entries: readonly GraphEntryDef[] = PIPELINE_GRAPH_ENTRIES,
): readonly PipelineRunTimings[] {
  const entry = entries.find((item) => item.id === entryId)
  return entry ? history[entry.signature] ?? [] : []
}

/** 耗时文案：120ms / 1.2s / 10s / 1m05s */
export function formatDuration(ms: number): string {
  const value = Math.max(0, Math.round(ms))
  if (value < 1000) return `${value}ms`
  if (value < 60_000) {
    const seconds = value / 1000
    return `${seconds < 10 ? seconds.toFixed(1) : String(Math.round(seconds))}s`
  }
  const minutes = Math.floor(value / 60_000)
  const seconds = Math.round((value % 60_000) / 1000)
  return `${minutes}m${String(seconds).padStart(2, "0")}s`
}
