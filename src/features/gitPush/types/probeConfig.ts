// 实时探测配置（纯类型 + 默认值 + 钳位纯函数；零依赖，保证可在 Node 单测加载）
//
// 设计依据（实测，Windows 10 / git 2.53，见 README「实时探测」）：
//   git --version                ≈ 207ms   ← 纯进程启动，什么都不做
//   git rev-parse HEAD           ≈ 250ms   ← 能做到的最廉价探测
//   git status --porcelain       ≈ 250ms   ← 全量工作区扫描
// 即**最廉价的探测与全量查询同价**（进程启动费主导）。故：
//   ① 能用文件系统信号（0 次 spawn）就不用 git；
//   ② 必须轮询时，靠「可见性门控 + 指数退避」把空闲成本压到近零；
//   ③ 网络（fetch）绝不上定时器——它是唯一无法变便宜的部分。

/** 文件系统监听（第 1 层，0 次 git 进程）配置 */
export interface ProbeWatchConfig {
  /** 总开关：监听 .git 关键文件，提交/fetch/切分支即时感知 */
  enabled: boolean
  /**
   * 事件合并窗口（ms）。git 一次操作会连续触发多个文件事件
   * （如 commit 同时改 index / refs / logs），需防抖合并成一次标脏。
   */
  debounceMs: number
}

/** 工作区本地轮询（第 2 层，捕获「编辑器改了文件」这类无 .git 信号的变化）配置 */
export interface ProbePollConfig {
  /** 总开关 */
  enabled: boolean
  /**
   * 基准轮询间隔（ms）。仅在面板可见且窗口聚焦时生效；
   * 默认 15000 是「体感够快」与「后台成本可忽略」的折中。
   */
  intervalMs: number
  /**
   * 连续无变化时的退避上限（ms）。每轮无变化则间隔翻倍直至本上限，
   * 一旦探测到变化立即回到 intervalMs。空闲项目因此几乎零消耗。
   */
  maxIntervalMs: number
  /**
   * 是否启用「index mtime 预筛」：先用一次 fs.stat（微秒级、零子进程）
   * 比对 .git/index 的 mtime，未变则跳过本轮 git status。
   * 这是减少 spawn 的关键——工作区干净时完全不启动 git。
   */
  statPrefilter: boolean
}

/** 网络轮询（第 3 层，唯一能发现「需拉取」的层）配置 */
export interface ProbeNetworkConfig {
  /** 总开关（默认关闭：fetch 是网络往返，不该默认骚扰远程） */
  enabled: boolean
  /** 轮询间隔（ms）。下限由 clampProbeConfig 强制 ≥ 5 分钟（PROBE_NETWORK_INTERVAL_MIN） */
  intervalMs: number
  /** 窗口离开超过该时长后重新聚焦时，立即补一次 fetch（0 = 禁用该行为） */
  fetchOnRefocusAfterMs: number
}

/** 实时探测完整配置 */
export interface ProbeConfig {
  watch: ProbeWatchConfig
  poll: ProbePollConfig
  network: ProbeNetworkConfig
}

// ── 钳位范围（设置弹窗输入与此处钳位的单一数据源）──

/** 文件监听防抖允许范围（ms） */
export const PROBE_DEBOUNCE_MIN = 100
export const PROBE_DEBOUNCE_MAX = 5000

/** 工作区轮询基准间隔允许范围（ms）；下限 5s 防止用户把 CPU 烧穿 */
export const PROBE_INTERVAL_MIN = 5000
export const PROBE_INTERVAL_MAX = 300000

/** 退避上限允许范围（ms）；下限由 clampProbeConfig 保证 ≥ 基准间隔 */
export const PROBE_MAX_INTERVAL_MIN = 10000
export const PROBE_MAX_INTERVAL_MAX = 1800000

/**
 * 网络轮询间隔允许范围（ms）。
 * 下限 5 分钟是刻意的：fetch 是网络往返，更频繁只会给远程服务端和自己添堵，
 * 且「需拉取」的时效性要求本就远低于「有变更」。
 */
export const PROBE_NETWORK_INTERVAL_MIN = 300000
export const PROBE_NETWORK_INTERVAL_MAX = 3600000

/** 重聚焦补 fetch 阈值允许范围（ms）；0 = 禁用 */
export const PROBE_REFOCUS_MIN = 0
export const PROBE_REFOCUS_MAX = 3600000

/** 默认配置：监听开 / 轮询 15s 开 / 网络 fetch 关 */
export const DEFAULT_PROBE_CONFIG: ProbeConfig = {
  watch: {
    enabled: true,
    debounceMs: 600,
  },
  poll: {
    enabled: true,
    intervalMs: 15000,
    maxIntervalMs: 120000,
    statPrefilter: true,
  },
  network: {
    enabled: false,
    intervalMs: 600000,
    fetchOnRefocusAfterMs: 1800000,
  },
}

/** 整数化并钳位到 [min, max]（非法输入回退到 fallback） */
function clampInt(n: number, min: number, max: number, fallback: number): number {
  const num = Math.round(Number(n))
  if (!Number.isFinite(num)) return fallback
  return Math.max(min, Math.min(max, num))
}

/**
 * 归一化一份可能来自旧版本 / 被手改过的配置。
 *
 * 逐字段兜底而非整体回退：新增字段时旧存储里没有该键，整体回退会丢掉用户已调好的其余项。
 * 同时保证 `maxIntervalMs ≥ intervalMs`（否则退避逻辑会「越退越快」）。
 */
export function clampProbeConfig(raw: Partial<ProbeConfig> | null | undefined): ProbeConfig {
  const d = DEFAULT_PROBE_CONFIG
  const watch = raw?.watch ?? d.watch
  const poll = raw?.poll ?? d.poll
  const network = raw?.network ?? d.network

  const intervalMs = clampInt(poll.intervalMs, PROBE_INTERVAL_MIN, PROBE_INTERVAL_MAX, d.poll.intervalMs)
  // 退避上限不得低于基准间隔：等于基准间隔即「不退避」，仍是合法配置
  const maxIntervalMs = Math.max(
    intervalMs,
    clampInt(poll.maxIntervalMs, PROBE_MAX_INTERVAL_MIN, PROBE_MAX_INTERVAL_MAX, d.poll.maxIntervalMs),
  )

  return {
    watch: {
      enabled: watch.enabled !== false,
      debounceMs: clampInt(watch.debounceMs, PROBE_DEBOUNCE_MIN, PROBE_DEBOUNCE_MAX, d.watch.debounceMs),
    },
    poll: {
      enabled: poll.enabled !== false,
      intervalMs,
      maxIntervalMs,
      statPrefilter: poll.statPrefilter !== false,
    },
    network: {
      enabled: network.enabled === true,
      intervalMs: clampInt(
        network.intervalMs,
        PROBE_NETWORK_INTERVAL_MIN,
        PROBE_NETWORK_INTERVAL_MAX,
        d.network.intervalMs,
      ),
      fetchOnRefocusAfterMs: clampInt(
        network.fetchOnRefocusAfterMs,
        PROBE_REFOCUS_MIN,
        PROBE_REFOCUS_MAX,
        d.network.fetchOnRefocusAfterMs,
      ),
    },
  }
}

/**
 * 退避推进：本轮无变化则间隔翻倍，有变化则回到基准间隔。
 * 纯函数（不读时钟、不持有状态），便于单测。
 *
 * @param current 当前间隔（ms）
 * @param changed 本轮是否探测到变化
 * @param base 基准间隔（ms）
 * @param cap 退避上限（ms）
 */
export function nextProbeInterval(current: number, changed: boolean, base: number, cap: number): number {
  if (changed) return base
  return Math.min(cap, Math.max(base, current * 2))
}
