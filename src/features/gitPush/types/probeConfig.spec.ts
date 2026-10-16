// src/features/gitPush/types/probeConfig.spec.ts — 实时探测配置纯函数单元测试
//
// 覆盖重点（这些是「不卡」的契约，必须有断言锁住）：
//   ① 钳位：非法/越界输入不得产生会烧 CPU 的配置（尤其轮询间隔不得低于下限）
//   ② 归一化：maxIntervalMs ≥ intervalMs（否则退避会「越退越快」）
//   ③ 退避：无变化翻倍至上限、有变化立即回基准
import { describe, expect, it } from "vitest"
import {
  clampProbeConfig,
  DEFAULT_PROBE_CONFIG,
  nextProbeInterval,
  PROBE_INTERVAL_MIN,
  PROBE_NETWORK_INTERVAL_MIN,
} from "./probeConfig"

describe("clampProbeConfig", () => {
  it("空/未定义输入回退到默认配置", () => {
    expect(clampProbeConfig(null)).toEqual(DEFAULT_PROBE_CONFIG)
    expect(clampProbeConfig(undefined)).toEqual(DEFAULT_PROBE_CONFIG)
  })

  it("默认关闭网络轮询（fetch 不该默认骚扰远程）", () => {
    expect(DEFAULT_PROBE_CONFIG.network.enabled).toBe(false)
    expect(clampProbeConfig({}).network.enabled).toBe(false)
  })

  it("轮询间隔低于下限时被抬到下限（防止把 CPU 烧穿）", () => {
    const cfg = clampProbeConfig({ poll: { ...DEFAULT_PROBE_CONFIG.poll, intervalMs: 100 } })
    expect(cfg.poll.intervalMs).toBe(PROBE_INTERVAL_MIN)
  })

  it("轮询间隔高于上限时被压到上限", () => {
    const cfg = clampProbeConfig({ poll: { ...DEFAULT_PROBE_CONFIG.poll, intervalMs: 99999999 } })
    expect(cfg.poll.intervalMs).toBeLessThanOrEqual(300000)
  })

  it("网络轮询间隔不得低于 5 分钟", () => {
    const cfg = clampProbeConfig({
      network: { ...DEFAULT_PROBE_CONFIG.network, intervalMs: 1000 },
    })
    expect(cfg.network.intervalMs).toBe(PROBE_NETWORK_INTERVAL_MIN)
  })

  it("maxIntervalMs 不得低于 intervalMs（否则退避逻辑会越退越快）", () => {
    const cfg = clampProbeConfig({
      poll: {
        enabled: true,
        intervalMs: 60000,
        maxIntervalMs: 10000,
        statPrefilter: true,
      },
    })
    expect(cfg.poll.maxIntervalMs).toBeGreaterThanOrEqual(cfg.poll.intervalMs)
  })

  it("NaN / 非有限值回退到默认而非产生 NaN 定时器", () => {
    const cfg = clampProbeConfig({
      poll: { ...DEFAULT_PROBE_CONFIG.poll, intervalMs: Number.NaN },
    })
    expect(Number.isFinite(cfg.poll.intervalMs)).toBe(true)
    expect(cfg.poll.intervalMs).toBe(DEFAULT_PROBE_CONFIG.poll.intervalMs)
  })

  it("逐字段兜底：部分字段缺失时其余用户设置不被丢弃", () => {
    // 模拟旧版本存储：只有 watch 一个键，poll/network 完全缺失
    const cfg = clampProbeConfig({ watch: { enabled: false, debounceMs: 800 } })
    expect(cfg.watch).toEqual({ enabled: false, debounceMs: 800 })
    // 缺失的层回退默认，而不是整体作废
    expect(cfg.poll).toEqual(DEFAULT_PROBE_CONFIG.poll)
    expect(cfg.network).toEqual(DEFAULT_PROBE_CONFIG.network)
  })

  it("防抖窗口越界被钳位", () => {
    const low = clampProbeConfig({ watch: { enabled: true, debounceMs: 1 } })
    const high = clampProbeConfig({ watch: { enabled: true, debounceMs: 999999 } })
    expect(low.watch.debounceMs).toBe(100)
    expect(high.watch.debounceMs).toBe(5000)
  })

  it("network.enabled 仅显式 true 才为真（缺省/非 true 一律关闭）", () => {
    expect(clampProbeConfig({ network: {} as any }).network.enabled).toBe(false)
    expect(clampProbeConfig({ network: { enabled: true } as any }).network.enabled).toBe(true)
  })

  it("watch/poll 的 enabled 缺省时为真（默认开启本地探测）", () => {
    const cfg = clampProbeConfig({})
    expect(cfg.watch.enabled).toBe(true)
    expect(cfg.poll.enabled).toBe(true)
  })
})

describe("nextProbeInterval", () => {
  const BASE = 15000
  const CAP = 120000

  it("探测到变化时立即回到基准间隔", () => {
    expect(nextProbeInterval(CAP, true, BASE, CAP)).toBe(BASE)
    expect(nextProbeInterval(BASE * 4, true, BASE, CAP)).toBe(BASE)
  })

  it("无变化时翻倍", () => {
    expect(nextProbeInterval(BASE, false, BASE, CAP)).toBe(BASE * 2)
    expect(nextProbeInterval(BASE * 2, false, BASE, CAP)).toBe(BASE * 4)
  })

  it("无变化时不超过上限", () => {
    expect(nextProbeInterval(CAP, false, BASE, CAP)).toBe(CAP)
    expect(nextProbeInterval(CAP / 2, false, BASE, CAP)).toBe(CAP)
  })

  it("单调不减：连续无变化只会越来越慢（验证退避方向正确）", () => {
    let cur = BASE
    const seq: number[] = []
    for (let i = 0; i < 10; i++) {
      cur = nextProbeInterval(cur, false, BASE, CAP)
      seq.push(cur)
    }
    for (let i = 1; i < seq.length; i++) {
      expect(seq[i]).toBeGreaterThanOrEqual(seq[i - 1])
    }
    expect(seq[seq.length - 1]).toBe(CAP)
  })

  it("当前值小于基准时被拉回基准（配置改小后不残留旧的小间隔）", () => {
    expect(nextProbeInterval(1000, false, BASE, CAP)).toBe(BASE)
  })
})
