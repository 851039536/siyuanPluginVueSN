// src/features/gitPush/reportMetrics.spec.ts — 报告指标引擎单元测试（P0 测试安全网）
//
// 覆盖重点：numstat 解析（两种 header 格式/二进制行/引号路径）、报告组装（作者排序/债务门槛/
// 热点汇总占比/幽灵文件过滤/.md 排除/fileDetailsMap 派生/HOTSPOT_LIMIT 截断）、K 线分桶压缩
// （计数守恒/原引用返回）、7 日均线（缺日补 0）、空报告形状、债务计数单一真源。
//
// 约定：直连 ./reportMetrics 与 ./types/* 叶子模块（"./types" 桶含 GitPushManager 运行时依赖，
// Node 单测不可加载）；buildReportData 依赖真实 fs 做幽灵文件过滤与 LOC 读取，
// 用真实临时目录验证（与 lineScan.spec.ts 同策略：mock fs 验不出「结果是否正确」）。
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { GitProject } from "./types/storage"
import type { NumstatCommit } from "./reportMetrics"
import {
  aggregateFileStats,
  buildEmptyReport,
  buildReportData,
  calcMovingAverage7,
  collapseDailyStats,
  countDebtFiles,
  daysSince,
  DEBT_MIN_MOD_COUNT,
  MAX_CANDLES,
  parseNumstatBlock,
  parseNumstatBlocks,
  shouldIncludeFile,
  sumLineDeltas,
} from "./reportMetrics"

// ── 造数助手 ──

/**
 * 造一条提交。date 用「无时区后缀的本地时间」字符串（ES6 起按本地时区解析），
 * 使 formatLocalDate / hourOfDay / getDay 的期望值与运行机器时区无关。
 */
function commit(author: string, date: string, files: Array<{ path: string, added?: number, deleted?: number }>): NumstatCommit {
  return {
    author,
    date,
    files: files.map((f) => ({ path: f.path, added: f.added ?? 0, deleted: f.deleted ?? 0 })),
  }
}

/** 拼 numstat 原始块（旧格式 2 段 header） */
function rawBlock2(author: string, date: string, fileLines: string[]): string {
  return `\x1e${author}\x1f${date}\n${fileLines.join("\n")}\n`
}

/** 拼 numstat 原始块（新格式 4 段 header：hash/author/date/message） */
function rawBlock4(hash: string, author: string, date: string, message: string, fileLines: string[]): string {
  return `\x1e${hash}\x1f${author}\x1f${date}\x1f${message}\n${fileLines.join("\n")}\n`
}

// ── parseNumstatBlocks / parseNumstatBlock ──

describe("parseNumstatBlocks", () => {
  it("2 段旧格式：解析 author/date 与文件行，忽略首段前导内容", () => {
    const raw = `前导噪声${rawBlock2("alice", "2024-01-15T09:00:00", ["10\t2\tsrc/a.ts", "3\t0\tsrc/b.ts"])}`
    const commits = parseNumstatBlocks(raw)
    expect(commits).toHaveLength(1)
    expect(commits[0].author).toBe("alice")
    expect(commits[0].date).toBe("2024-01-15T09:00:00")
    expect(commits[0].hash).toBeUndefined()
    expect(commits[0].message).toBeUndefined()
    expect(commits[0].files).toEqual([
      { path: "src/a.ts", added: 10, deleted: 2 },
      { path: "src/b.ts", added: 3, deleted: 0 },
    ])
  })

  it("4 段新格式：额外解析 hash/message（getCommitStatsLog 口径）", () => {
    const raw = rawBlock4("abc1234", "bob", "2024-01-16T10:30:00", "feat: add x", ["5\t1\tsrc/c.ts"])
    const [c] = parseNumstatBlocks(raw)
    expect(c.hash).toBe("abc1234")
    expect(c.message).toBe("feat: add x")
    expect(c.author).toBe("bob")
    expect(c.files).toEqual([{ path: "src/c.ts", added: 5, deleted: 1 }])
  })

  it("message 内含 \\x1f 分隔符时用 slice(3) 保底还原，不丢内容", () => {
    const raw = rawBlock4("h1", "bob", "2024-01-16T10:30:00", "feat: a\x1fb", [])
    const [c] = parseNumstatBlocks(raw)
    expect(c.message).toBe("feat: a\x1fb")
  })

  it("二进制行（-\\t-）与无效行跳过，不产生文件条目", () => {
    const raw = rawBlock2("alice", "2024-01-15T09:00:00", ["-\t-\timg.png", "not-a-numstat-line", "7\t0\tsrc/a.ts"])
    const [c] = parseNumstatBlocks(raw)
    expect(c.files).toEqual([{ path: "src/a.ts", added: 7, deleted: 0 }])
  })

  it("C 风格引号路径剥壳；路径内含 \\t 时按 slice(2) 拼回", () => {
    const raw = rawBlock2("alice", "2024-01-15T09:00:00", [`1\t0\t"src/weird name.ts"`, "1\t0\ta\tb.ts"])
    const [c] = parseNumstatBlocks(raw)
    expect(c.files[0].path).toBe("src/weird name.ts")
    expect(c.files[1].path).toBe("a\tb.ts")
  })

  it("多提交按序返回；header 段数不足/缺作者或日期的块跳过", () => {
    const raw = rawBlock2("alice", "2024-01-15T09:00:00", ["1\t0\ta.ts"])
      + rawBlock2("", "2024-01-16T09:00:00", ["1\t0\tb.ts"])
      + "\x1eonly-one-part\n1\t0\tc.ts\n"
      + rawBlock2("bob", "2024-01-17T09:00:00", ["1\t0\td.ts"])
    const commits = parseNumstatBlocks(raw)
    expect(commits.map((c) => c.author)).toEqual(["alice", "bob"])
    expect(commits[1].files).toEqual([{ path: "d.ts", added: 1, deleted: 0 }])
  })
})

describe("parseNumstatBlock（增量扫描共用语义）", () => {
  it("单块解析与 parseNumstatBlocks 逐块结果一致（fetchIncremental 依赖此契约）", () => {
    const chunk = "h1\x1falice\x1f2024-01-15T09:00:00\x1fmsg\n2\t1\ta.ts\n"
    const single = parseNumstatBlock(chunk)
    const viaBlocks = parseNumstatBlocks(`\x1e${chunk}`)
    expect(single).toEqual(viaBlocks[0])
  })

  it("无法解析（1 段 header / 空作者 / 空日期）返回 null", () => {
    expect(parseNumstatBlock("only-one-part\n1\t0\ta.ts")).toBeNull()
    expect(parseNumstatBlock("\x1f2024-01-15T09:00:00\n1\t0\ta.ts")).toBeNull()
    expect(parseNumstatBlock("alice\x1f\n1\t0\ta.ts")).toBeNull()
  })
})

// ── aggregateFileStats（lastModified 按时间戳而非字典序） ──

describe("aggregateFileStats", () => {
  it("回归：时区偏移符号使 ISO 字典序误判先后时，lastModified 仍取真实最近时刻", () => {
    // 字典序上 +01:00 的 "23:00" > Z 的 "22:30"，但真实时刻 22:30Z 更晚
    const map = aggregateFileStats([
      commit("alice", "2024-01-15T23:00:00+01:00", [{ path: "a.ts", added: 1 }]),
      commit("alice", "2024-01-15T22:30:00Z", [{ path: "a.ts", added: 1 }]),
    ])
    expect(map.get("a.ts")?.lastIso).toBe("2024-01-15T22:30:00Z")
    expect(map.get("a.ts")?.modCount).toBe(2)
    expect(map.get("a.ts")?.added).toBe(2)
  })
})

// ── shouldIncludeFile / sumLineDeltas ──

describe("shouldIncludeFile（扩展名黑名单）", () => {
  it("空数组/undefined = 不过滤全部通过", () => {
    expect(shouldIncludeFile("a.md")).toBe(true)
    expect(shouldIncludeFile("a.md", [])).toBe(true)
  })
  it("勾选即排除，大小写不敏感", () => {
    expect(shouldIncludeFile("a.md", [".md"])).toBe(false)
    expect(shouldIncludeFile("a.MD", [".md"])).toBe(false)
    expect(shouldIncludeFile("a.ts", [".md"])).toBe(true)
  })
})

describe("sumLineDeltas", () => {
  const commits = [
    commit("alice", "2024-01-15T09:00:00", [{ path: "a.ts", added: 10, deleted: 2 }, { path: "b.md", added: 5, deleted: 1 }]),
    commit("bob", "2024-01-16T09:00:00", [{ path: "a.ts", added: 1, deleted: 1 }]),
  ]

  it("项目与作者两维度单遍产出，数值一致", () => {
    const { project, authors } = sumLineDeltas(commits)
    expect(project).toEqual({ added: 16, deleted: 4 })
    expect(authors.get("alice")).toEqual({ added: 15, deleted: 3 })
    expect(authors.get("bob")).toEqual({ added: 1, deleted: 1 })
  })

  it("扩展名黑名单过滤同时作用于项目与作者维度", () => {
    const { project, authors } = sumLineDeltas(commits, [".md"])
    expect(project).toEqual({ added: 11, deleted: 3 })
    expect(authors.get("alice")).toEqual({ added: 10, deleted: 2 })
  })
})

// ── calcMovingAverage7 ──

describe("calcMovingAverage7", () => {
  /** 只造 date/count（函数只消费这两项） */
  function daily(entries: Array<[string, number]>) {
    return entries.map(([date, count]) => ({ date, open: 9, close: 17, high: 17.5, low: 8.5, count }))
  }

  it("单日 7 次提交：窗口均值 1（7/7）", () => {
    expect(calcMovingAverage7(daily([["2024-01-01", 7]]))).toEqual([1])
  })

  it("缺日按 0 计入窗口：隔天 7 次提交，末端均线 2（7+0+7)/7）", () => {
    const ma = calcMovingAverage7(daily([["2024-01-01", 7], ["2024-01-03", 7]]))
    // 2024-01-01 窗口：01-01 及之前 6 天 → 仅 01-01 有 7 → 1
    expect(ma[0]).toBe(1)
    // 2024-01-03 窗口：01-03/01-02/01-01/… → 7+0+7=14 → 2
    expect(ma[1]).toBe(2)
  })

  it("输出长度与输入一致（每个活跃日一个值）", () => {
    const ma = calcMovingAverage7(daily([["2024-01-01", 1], ["2024-01-02", 1], ["2024-01-05", 1]]))
    expect(ma).toHaveLength(3)
  })
})

// ── collapseDailyStats ──

describe("collapseDailyStats", () => {
  /** 造 n 天连续日统计（count 递增便于验算守恒） */
  function series(n: number) {
    return Array.from({ length: n }, (_, i) => ({
      date: `2024-01-${String(i + 1).padStart(2, "0")}`,
      open: 9 + (i % 3),
      close: 10 + (i % 3),
      high: 11,
      low: 8,
      count: i + 1,
    }))
  }

  it("未超阈值：返回原数组引用（不是拷贝），bucketDays=1", () => {
    const daily = series(5)
    const r = collapseDailyStats(daily, 10)
    expect(r.list).toBe(daily)
    expect(r.bucketDays).toBe(1)
  })

  it("maxCandles<=0 或空数组：不压缩", () => {
    const daily = series(5)
    expect(collapseDailyStats(daily, 0).list).toBe(daily)
    const empty = collapseDailyStats([], 3)
    expect(empty.list).toEqual([])
    expect(empty.bucketDays).toBe(1)
  })

  it("分桶计数守恒：sum(压缩后 count) === sum(原始 count)，桶数 = ceil(n/bucketDays)", () => {
    const daily = series(10)
    const r = collapseDailyStats(daily, 3)
    // bucketDays = ceil(10/3) = 4 → 桶 [0-3][4-7][8-9] → 3 根
    expect(r.bucketDays).toBe(4)
    expect(r.list).toHaveLength(3)
    const sum = (xs: { count: number }[]) => xs.reduce((s, x) => s + x.count, 0)
    expect(sum(r.list)).toBe(sum(daily))
  })

  it("合成规则：date/open 取桶首日，close 取桶末日，high/low 取桶内极值", () => {
    const daily = [
      { date: "2024-01-01", open: 9, close: 10, high: 10.5, low: 8.5, count: 1 },
      { date: "2024-01-02", open: 8, close: 12, high: 13, low: 7, count: 2 },
      { date: "2024-01-03", open: 11, close: 11, high: 11.5, low: 10.5, count: 3 },
    ]
    const r = collapseDailyStats(daily, 1)
    expect(r.list[0]).toEqual({
      date: "2024-01-01",
      open: 9,
      close: 11,
      high: 13,
      low: 7,
      count: 6,
    })
  })

  it("MAX_CANDLES 上限常量存在且为 180（canvas 宽度预算，见注释）", () => {
    expect(MAX_CANDLES).toBe(180)
  })
})

// ── daysSince / countDebtFiles / buildEmptyReport ──

describe("daysSince", () => {
  it("无法解析/空值返回 -1；正常 ISO 返回非负天数", () => {
    expect(daysSince("")).toBe(-1)
    expect(daysSince("not-a-date")).toBe(-1)
    expect(daysSince(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString())).toBeGreaterThan(2.9)
  })
})

describe("countDebtFiles", () => {
  it("四档计数求和（面板 Tab 徽章与表头徽章共用的单一真源）", () => {
    expect(countDebtFiles({ severe: 1, high: 2, medium: 3, low: 4 })).toBe(10)
    expect(countDebtFiles({ severe: 0, high: 0, medium: 0, low: 0 })).toBe(0)
  })
})

describe("buildEmptyReport", () => {
  it("形状完整：ok=false、全零汇总、7 星期桶、12 时段桶、topWeekday 回退周一", () => {
    const r = buildEmptyReport("近6月")
    expect(r.ok).toBe(false)
    expect(r.rangeLabel).toBe("近6月")
    expect(r.totalCommits).toBe(0)
    expect(r.authors).toEqual([])
    expect(r.debtFiles).toEqual([])
    expect(r.debtSummary).toEqual({ severe: 0, high: 0, medium: 0, low: 0 })
    expect(r.hotspots).toEqual([])
    expect(r.analyzedFiles).toBe(0)
    expect(r.fileDetailsMap).toEqual({})
    expect(r.suggestionKey).toBe("")
    expect(r.dailyStats).toEqual([])
    expect(r.hotspotSummary.map((s) => s.level)).toEqual(["hot", "warm", "cool", "cold"])
    expect(r.hotspotSummary.every((s) => s.count === 0 && s.pct === 0)).toBe(true)
    expect(r.rhythm.weekday).toHaveLength(7)
    expect(r.rhythm.hourly).toHaveLength(12)
    expect(r.rhythm.maxStreak).toBe(0)
    expect(r.rhythm.topWeekday.dow).toBe(1)
  })
})

// ── buildReportData（真实临时目录：幽灵文件过滤 + LOC 读取） ──

describe("buildReportData", () => {
  let dir: string
  let project: GitProject

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), "gpush-report-"))
    mkdirSync(join(dir, "src"))
    writeFileSync(join(dir, "src", "a.ts"), "1\n2\n3\n", "utf8") // 3 行
    writeFileSync(join(dir, "src", "b.ts"), "x\ny\n", "utf8") // 2 行
    writeFileSync(join(dir, "src", "c.ts"), "z\n", "utf8") // 1 行
    writeFileSync(join(dir, "README.md"), "# doc\n\nbody\n", "utf8")
    project = { id: "p1", name: "demo", path: dir, categoryId: "c1", addedAt: 0 }
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  /**
   * 合成提交集（2024 年日期 → 距今 >30 天 → recencyBonus=0，评分确定性）：
   *   alice x2 → src/a.ts；bob → src/a.ts+src/b.ts、src/b.ts；carol x1 → src/c.ts、README.md、ghost/deleted.ts
   * a.ts: modCount 3（过债务门槛）authorCount 2；b.ts: modCount 2（不过门槛）；c.ts: modCount 1
   * README.md 被 isCodeFile 排除；ghost/deleted.ts 不在磁盘 → 幽灵过滤剔除
   */
  function synthetic(): NumstatCommit[] {
    return [
      commit("alice", "2024-01-15T09:00:00", [{ path: "src/a.ts", added: 10, deleted: 2 }]),
      commit("alice", "2024-01-16T10:00:00", [{ path: "src/a.ts", added: 5, deleted: 1 }]),
      commit("bob", "2024-01-17T11:00:00", [{ path: "src/a.ts", added: 1, deleted: 1 }, { path: "src/b.ts", added: 3, deleted: 0 }]),
      commit("bob", "2024-01-18T14:30:00", [{ path: "src/b.ts", added: 2, deleted: 0 }]),
      commit("carol", "2024-01-19T08:15:00", [{ path: "src/c.ts", added: 7, deleted: 0 }]),
      commit("carol", "2024-01-20T16:00:00", [{ path: "README.md", added: 1, deleted: 0 }]),
      commit("carol", "2024-01-21T12:00:00", [{ path: "ghost/deleted.ts", added: 9, deleted: 9 }]),
    ]
  }

  it("团队总览：成员数/总提交/总代码量/最活跃贡献者，作者按提交数降序", () => {
    const r = buildReportData(project, synthetic(), "全部")
    expect(r.ok).toBe(true)
    expect(r.rangeLabel).toBe("全部")
    expect(r.totalCommits).toBe(7)
    expect(r.teamOverview).toEqual({
      memberCount: 3,
      totalCommits: 7,
      totalLines: 38, // alice 15 + bob 6 + carol 17
      topAuthor: "carol",
    })
    expect(r.authors.map((a) => a.author)).toEqual(["carol", "alice", "bob"])
    const alice = r.authors[1]
    expect(alice.commits).toBe(2)
    expect(alice.linesAdded).toBe(15)
    expect(alice.linesDeleted).toBe(3)
    expect(alice.netLines).toBe(12)
    expect(alice.filesTouched).toBe(1)
    expect(alice.topFiles).toEqual([{ path: "src/a.ts", count: 2 }])
    expect(alice.avgCommitSize).toBe(8) // round(15/2)
    expect(alice.churnRate).toBe(0.2) // round2(3/15)
  })

  it("过滤链：.md 非代码排除、幽灵文件（历史有工作区无）剔除 → analyzedFiles=3", () => {
    const r = buildReportData(project, synthetic(), "全部")
    expect(r.analyzedFiles).toBe(3)
    expect(r.hotspots.map((h) => h.path).sort()).toEqual(["src/a.ts", "src/b.ts", "src/c.ts"])
  })

  it("技术债务：仅 modCount≥门槛入列，风险分/严重度与汇总一致", () => {
    const r = buildReportData(project, synthetic(), "全部")
    expect(DEBT_MIN_MOD_COUNT).toBe(3)
    // 只有 a.ts modCount=3 过门槛；b.ts(2)/c.ts(1) 不入列
    expect(r.debtFiles).toHaveLength(1)
    const a = r.debtFiles[0]
    expect(a.path).toBe("src/a.ts")
    // risk = sqrt(3)*10 + 2*6 + recency(2024 日期=0) ≈ 29.32 → 29 → medium（≥15）
    expect(a.riskScore).toBe(29)
    expect(a.severity).toBe("medium")
    expect(r.debtSummary).toEqual({ severe: 0, high: 0, medium: 1, low: 0 })
    expect(countDebtFiles(r.debtSummary)).toBe(1)
  })

  it("热点榜按 heat 降序，LOC 仅对榜单条目读取真实行数", () => {
    const r = buildReportData(project, synthetic(), "全部")
    // heat = modCount*2.2 + authorCount*7（recency=0）：a=20.6→21，b=11.4→11，c=9.2→9
    expect(r.hotspots.map((h) => h.path)).toEqual(["src/a.ts", "src/b.ts", "src/c.ts"])
    expect(r.hotspots.map((h) => h.heat)).toEqual([21, 11, 9])
    expect(r.hotspots.every((h) => h.level === "cold")).toBe(true) // 21/11/9 均 <25
    expect(r.hotspots.map((h) => h.loc)).toEqual([3, 2, 1]) // 真实文件行数
  })

  it("热点汇总占比分母=全部现存代码文件（非榜单截断数）", () => {
    const r = buildReportData(project, synthetic(), "全部")
    const pctBy = Object.fromEntries(r.hotspotSummary.map((s) => [s.level, s]))
    expect(pctBy.cold.count).toBe(3)
    expect(pctBy.cold.pct).toBe(100)
    expect(pctBy.hot.count).toBe(0)
    // hotPct=0 且 warmPct=0 → 正常建议
    expect(r.suggestionKey).toBe("reportSugNormal")
  })

  it("建议文案用绝对热度阈值：分位 hot 桶存在但绝对热度不足时不得误报 Warning", () => {
    // 10 个文件，heat 从 9 递增到 29（均 <75 的绝对热点线）→ 分位分级必然产生 hot 桶
    const commits: NumstatCommit[] = []
    for (let i = 0; i < 10; i++) {
      const path = `src/f${i}.ts`
      writeFileSync(join(dir, path), "x\n", "utf8")
      for (let m = 0; m <= i; m++) {
        commits.push(commit("alice", "2024-01-15T09:00:00", [{ path }]))
      }
    }
    const r = buildReportData(project, commits, "全部")
    expect(r.hotspots.filter((h) => h.level === "hot").length).toBeGreaterThan(0)
    expect(r.suggestionKey).not.toBe("reportSugWarning")
  })

  it("fileDetailsMap 由作者 topFiles 派生（含 .md/幽灵，loc 恒 null 由弹窗懒取）", () => {
    const r = buildReportData(project, synthetic(), "全部")
    expect(Object.keys(r.fileDetailsMap).sort()).toEqual([
      "README.md",
      "ghost/deleted.ts",
      "src/a.ts",
      "src/b.ts",
      "src/c.ts",
    ])
    const a = r.fileDetailsMap["src/a.ts"]
    expect(a.modCount).toBe(3)
    expect(a.authorCount).toBe(2)
    expect(a.lastModified).toBe("2024-01-17T11:00:00")
    expect(a.added).toBe(16)
    expect(a.deleted).toBe(4)
    expect(a.loc).toBeNull()
  })

  it("dailyStats/rhythm 与提交集同源：7 个活跃日、连续 7 天 streak、桶计数守恒", () => {
    const r = buildReportData(project, synthetic(), "全部")
    expect(r.dailyStats).toHaveLength(7)
    expect(r.dailyStats[0].date).toBe("2024-01-15")
    expect(r.dailyStats[6].date).toBe("2024-01-21")
    expect(r.rhythm.maxStreak).toBe(7)
    expect(r.rhythm.weekday).toHaveLength(7)
    expect(r.rhythm.hourly).toHaveLength(12)
    const sum = (xs: { count: number }[]) => xs.reduce((s, x) => s + x.count, 0)
    expect(sum(r.rhythm.weekday)).toBe(7)
    expect(sum(r.rhythm.hourly)).toBe(7)
  })

  it("HOTSPOT_LIMIT=12：超出榜单截断但 analyzedFiles 计全量", () => {
    const commits: NumstatCommit[] = []
    for (let i = 1; i <= 13; i++) {
      const p = `src/f${String(i).padStart(2, "0")}.ts`
      writeFileSync(join(dir, p), "x\n", "utf8")
      commits.push(commit("alice", `2024-02-${String(i).padStart(2, "0")}T09:00:00`, [{ path: p, added: 1 }]))
    }
    const r = buildReportData(project, commits, "全部")
    expect(r.analyzedFiles).toBe(13)
    expect(r.hotspots).toHaveLength(12)
  })

  it("空提交集：ok=true 但全零（与 buildEmptyReport 的 ok=false 区分）", () => {
    const r = buildReportData(project, [], "近3月")
    expect(r.ok).toBe(true)
    expect(r.totalCommits).toBe(0)
    expect(r.authors).toEqual([])
    expect(r.analyzedFiles).toBe(0)
  })

  // ── 分位分级（P8a：对齐 GitHub 贡献图"相对本仓库活跃度"的强度语义） ──

  it("样本 <8 回退固定档（分位统计无意义）", () => {
    const r = buildReportData(project, synthetic(), "全部")
    // 仅 3 个现存代码文件 → 分位样本不足走固定阈值（heat 21/11/9 均 <25 → 全 cold）
    expect(r.hotspots.every((h) => h.level === "cold")).toBe(true)
  })

  it("分布分散时分位分级让头部文件进入 hot（P90 阈值远低于固定档 75）", () => {
    // 10 个文件热度梯度：6×9 + 20 + 29 + 47 + 60（heat = modCount*2.2 + authorCount*7，recency=0）
    // 分位：P90=47 / P70=20 / P40=9（相邻差均 ≥1 不退化）→ star(47) 达 hot（固定档 75 下永远是 warm）
    const commits: NumstatCommit[] = []
    const plan: Array<[string, number]> = [
      ...Array.from({ length: 6 }, (_, i) => [`src/low${i}.ts`, 1] as [string, number]),
      ["src/mid.ts", 6],
      ["src/high.ts", 10],
      ["src/star.ts", 18],
      ["src/top.ts", 24],
    ]
    let day = 1
    for (const [path, mods] of plan) {
      writeFileSync(join(dir, path), "x\n", "utf8")
      for (let k = 0; k < mods; k++) {
        commits.push(commit("alice", `2024-03-${String(day).padStart(2, "0")}T09:00:00`, [{ path, added: 1 }]))
        if (k === 0) day = Math.min(day + 1, 28)
      }
      day = Math.min(day + 1, 28)
    }
    const r = buildReportData(project, commits, "全部")
    const star = r.hotspots.find((h) => h.path === "src/star.ts")
    expect(star?.heat).toBe(47)
    expect(star?.level).toBe("hot")
    const top = r.hotspots.find((h) => h.path === "src/top.ts")
    expect(top?.level).toBe("hot")
    // 低热文件在分位下仍为 cold（cool 线=9 时 heat 9 边界 ≥9 为 cool，取验证 mid）
    const mid = r.hotspots.find((h) => h.path === "src/mid.ts")
    expect(mid?.heat).toBe(20)
    expect(mid?.level).toBe("warm")
  })

  it("阈值退化（大量并列热度）回退固定档，等级不塌成非此即彼", () => {
    // 8 个文件全部同 heat（各 2 次修改 × 1 人 → 11.4→11）→ P90/P70/P40 全是 11 → 退化回固定档
    const commits: NumstatCommit[] = []
    for (let i = 1; i <= 8; i++) {
      writeFileSync(join(dir, "src", `same${i}.ts`), "x\n", "utf8")
      for (let k = 0; k < 2; k++) {
        commits.push(commit("alice", `2024-05-${String(i).padStart(2, "0")}T0${k + 9}:00:00`, [{ path: `src/same${i}.ts`, added: 1 }]))
      }
    }
    const r = buildReportData(project, commits, "全部")
    // 固定档下 heat 11 <25 → 全 cold（若分位生效会全部被拉成 hot/warm 且失去区分）
    expect(r.hotspots.every((h) => h.level === "cold")).toBe(true)
    expect(r.hotspots.every((h) => h.heat === 11)).toBe(true)
  })

})
