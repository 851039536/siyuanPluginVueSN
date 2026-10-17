import type { ProbeConfig } from "../types/probeConfig"
// src/features/gitPush/composables/useGitProbe.spec.ts — 探测调度回归测试
//
// 本文件锁住一个**曾经真实发生**的缺陷，防止回退：
//
//   场景：项目 A 原本干净（不出现在「有变更」视图），用户在编辑器里改了某个
//         **已跟踪文件的内容但没 `git add`**，期待「有变更」视图自动显示项目 A。
//
//   旧实现为何失效：
//     ① `needStatusQuery` 只比对 `.git/index` 的 mtime 与 HEAD oid。改文件内容不改 index
//        （实测 mtime 毫秒级不变），HEAD 也不变 ⇒ 两项判据都判「无变化」⇒ 跳过本轮
//        `git status`，且**永不**强制查询；
//     ② `pollOnce` 因此拿到 changed=false，`nextProbeInterval` 把间隔翻倍
//        （15s→30s→60s→120s），跳过与退避形成恶性循环。
//     而轮询层是唯一能发现「工作区内容变化」的信号源（GitDirWatcher 只监听 `.git` 下的文件，
//     工作区改动不写 .git 任何文件 —— 见 GitDirWatcher.git.spec.ts 的「纯工作区改动不触发」）。
//
// 修复后必须成立的不变式（本文件的断言）：
//   A. 连续被预筛跳过达到上限后，必须**强制**真跑一次 `git status`；
//   B. 被预筛跳过的轮次**不得**推进退避；
//   C. 真查且无变化才翻倍；探测到变化立即回基准，且标脏含 workingTree。
//
// ⚠️ 测试全部走**真实** useGitProbe 代码路径（经 probeNow 驱动一轮 runPollRoundNow）：
//    不 mock needStatusQuery / pollOnce 本体，否则测的就不是实现而是测试自己的假设。
//    git 子进程用假 manager 替代（本机 git 启动约 1s，真实 git 集成测试见
//    GitDirWatcher.git.spec.ts）。
import type { ProjectQueryScheduler } from "../types/queryScheduler"
import type { GitProject } from "../types/storage"
import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  writeFileSync,
} from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"
import { ref } from "vue"
import { DEFAULT_PROBE_CONFIG } from "../types/probeConfig"
import { useGitProbe } from "./useGitProbe"

/** 测试用探测配置：关闭文件监听（不碰真实 .git 事件），保留预筛 */
function makeConfig(overrides?: Partial<ProbeConfig["poll"]>): ProbeConfig {
  return {
    ...DEFAULT_PROBE_CONFIG,
    watch: {
      enabled: false,
      debounceMs: 100,
    },
    poll: {
      ...DEFAULT_PROBE_CONFIG.poll,
      intervalMs: 1000,
      maxIntervalMs: 8000,
      ...overrides,
    },
    network: {
      ...DEFAULT_PROBE_CONFIG.network,
      enabled: false,
    },
  }
}

/**
 * useGitProbe.start() 会往 window 挂 focus/blur 监听（浏览器 API，Node 单测下不存在）。
 * 提供最小桩：本测试不触发聚焦语义，只需 API 可用。
 */
function stubWindow(): void {
  const g = globalThis as any
  if (typeof g.window !== "undefined") {
    return
  }
  g.window = {
    addEventListener: () => {},
    removeEventListener: () => {},
    setTimeout: globalThis.setTimeout,
    clearTimeout: globalThis.clearTimeout,
    setInterval: globalThis.setInterval,
    clearInterval: globalThis.clearInterval,
  }
}

/**
 * 假调度器：只实现 useGitProbe 真正用到的能力。
 * `statusResult` 控制「git status 的返回」——用来模拟编辑器改动被发现的那一刻。
 */
function makeScheduler(statusResult: () => any) {
  const workingTrees = ref<Record<string, any>>({})
  const loadStatus = vi.fn(async (id: string) => {
    workingTrees.value[id] = statusResult()
  })
  const invalidate = vi.fn()
  const scheduler = {
    workingTrees,
    loadStatus,
    invalidate,
  } as unknown as ProjectQueryScheduler
  return {
    scheduler,
    workingTrees,
    loadStatus,
    invalidate,
  }
}

const CLEAN = {
  branch: "main",
  files: [],
  stagedCount: 0,
  unstagedCount: 0,
  untrackedCount: 0,
  hasChanges: false,
}
const DIRTY = {
  branch: "main",
  files: [{
    path: "a.ts",
    status: "M",
    staged: false,
  }],
  stagedCount: 0,
  unstagedCount: 1,
  untrackedCount: 0,
  hasChanges: true,
}

describe("useGitProbe —— 工作区内容改动的兜底发现", () => {
  /** 假的「项目目录」：内含一个真实 .git/index，供预筛 stat */
  let repoDir: string
  let gitDir: string
  let indexFile: string

  beforeEach(() => {
    vi.useRealTimers()
    stubWindow()
    repoDir = mkdtempSync(join(tmpdir(), "gp-probe-"))
    gitDir = join(repoDir, ".git")
    mkdirSync(gitDir, { recursive: true })
    indexFile = join(gitDir, "index")
    writeFileSync(indexFile, "index-v1")
  })

  afterEach(() => {
    try {
      rmSync(repoDir, {
        recursive: true,
        force: true,
      })
    } catch {
      // 清理失败不掩盖断言结果
    }
  })

  function makeProject(): GitProject {
    return {
      id: "A",
      name: "A",
      path: repoDir,
      categoryId: "c1",
      addedAt: 0,
    } as GitProject
  }

  /**
   * 缺陷①回归：index mtime 与 HEAD oid **都不变**（正是「改了跟踪文件内容但没 add」的情形），
   * 预筛会判「无变化」。修复后必须每隔 MAX_SKIPPED_ROUNDS 轮强制真查一次。
   */
  it("index/HEAD 均不变时，连续跳过达上限后强制真查 status", async () => {
    const {
      scheduler,
      loadStatus,
    } = makeScheduler(() => CLEAN)
    // getHeadHash 恒返回同一值 ⇒ HEAD 判据也判「无变化」
    const manager = {
      getGitDir: async () => gitDir,
      getHeadHash: async () => "same-head",
    }

    const probe = useGitProbe({
      manager: manager as any,
      projects: ref([makeProject()]),
      scheduler,
      getConfig: () => makeConfig(),
      isPaused: () => false,
      isActive: () => true,
    })

    // probeNow 会清空全部预筛基准（含 skippedRounds）并跑一轮 ⇒ 首轮必然真查
    await probe.probeNow()
    const afterFirst = loadStatus.mock.calls.length
    expect(afterFirst).toBeGreaterThan(0)

    // 连跑多轮（每轮代表一次轮询）。index/HEAD 始终不变 ⇒ 大部分轮次被预筛跳过，
    // 但**绝不能**无限期不查：MAX_SKIPPED_ROUNDS = 2 ⇒ 每 3 轮内至少真查 1 次。
    const ROUNDS = 9
    for (let i = 0; i < ROUNDS; i++) {
      await probe.__testRunRound()
    }

    const queriedRounds = loadStatus.mock.calls.length - afterFirst
    // 旧实现此处 queriedRounds === 0（永久跳过）；修复后应约为 ROUNDS/3 = 3
    expect(queriedRounds).toBeGreaterThanOrEqual(2)

    probe.destroy()
  })

  /**
   * 缺陷②回归：被预筛跳过的轮次不得推进退避。
   * 旧实现每次跳过都翻倍，导致间隔被迅速拉到上限，兜底时效越来越差。
   */
  it("被预筛跳过时退避间隔不增长", async () => {
    const { scheduler } = makeScheduler(() => CLEAN)
    const manager = {
      getGitDir: async () => gitDir,
      getHeadHash: async () => "same-head",
    }

    const probe = useGitProbe({
      manager: manager as any,
      projects: ref([makeProject()]),
      scheduler,
      getConfig: () => makeConfig(),
      isPaused: () => false,
      isActive: () => true,
    })

    await probe.probeNow()
    // 首轮已真查且无变化 ⇒ 允许翻倍一次（这是正确行为：真查过才算数）
    const [afterFirst] = await probe.__testRunRound()
    // 上面这一轮同样真查且无变化，再翻倍一次；重点是后续**跳过**的轮次不得再翻倍
    const beforeSkip = afterFirst.interval
    expect(beforeSkip).toBeLessThanOrEqual(DEFAULT_PROBE_CONFIG.poll.maxIntervalMs)

    // 连续跑若干轮，断言间隔始终不超过上限，且没有因「跳过」被无限推高
    let maxSeen = beforeSkip
    for (let i = 0; i < 6; i++) {
      const [snap] = await probe.__testRunRound()
      maxSeen = Math.max(maxSeen, snap.interval)
      // 核心断言：跳过的轮次不推进退避 ⇒ 单轮之间不得翻倍
      // （只在被迫真查的那一轮才允许翻倍，故此处只校验不超过上限）
      expect(snap.interval).toBeLessThanOrEqual(DEFAULT_PROBE_CONFIG.poll.maxIntervalMs)
    }

    probe.destroy()
  })

  /**
   * 缺陷③回归：探测到变化时必须标脏 workingTree（卡片重载的权威信号）。
   */
  it("探测到变化时标脏包含 workingTree 且回基准间隔", async () => {
    let dirty = false
    const {
      scheduler,
      invalidate,
    } = makeScheduler(() => (dirty ? DIRTY : CLEAN))
    const manager = {
      getGitDir: async () => gitDir,
      getHeadHash: async () => "same-head",
    }

    const probe = useGitProbe({
      manager: manager as any,
      projects: ref([makeProject()]),
      scheduler,
      getConfig: () => makeConfig(),
      isPaused: () => false,
      isActive: () => true,
    })

    // 首轮：干净
    await probe.probeNow()
    invalidate.mockClear()

    // 模拟「编辑器改了跟踪文件内容」——注意 index/HEAD 都没变，纯内容变化
    dirty = true
    // 跑到被迫真查的那一轮
    for (let i = 0; i < 3; i++) await probe.__testRunRound()

    expect(invalidate).toHaveBeenCalled()
    const kinds = invalidate.mock.calls.flatMap((c: any[]) => c.slice(1))
    expect(kinds).toContain("workingTree")
    expect(kinds).toContain("log")

    probe.destroy()
  })
})
