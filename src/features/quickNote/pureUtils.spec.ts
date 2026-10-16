// src/features/quickNote/pureUtils.spec.ts — 速记无依赖纯函数行为断言
// 覆盖日期换算 / 周界计算 / 标签拆分 / 逾期判定 / 每日自动顺延
import type { TodoItem } from "./types"
import {
  describe,
  expect,
  it,
} from "vitest"
import {
  getWeekStart,
  isOverdueAgainst,
  parseDateStr,
  rolloverOverdue,
  splitTags,
  toDateStr,
  WEEK_MS,
} from "./pureUtils"

/** 本地时间戳（避免测试受运行机时区影响） */
function localMs(y: number, m: number, d: number, h = 12, min = 0): number {
  return new Date(y, m - 1, d, h, min).getTime()
}

/** 取时间戳对应的本地星期（周一=1 … 周日=7） */
function localDay(ts: number): number {
  const day = new Date(ts).getDay()
  return day === 0 ? 7 : day
}

/** 构造待办条目（仅覆盖被测字段，其余给安全默认值） */
function makeTodo(partial: Partial<TodoItem> & { id: string }): TodoItem {
  return {
    content: "任务",
    priority: "medium",
    dueDate: null,
    done: false,
    doneAt: null,
    projectId: null,
    rolloverCount: 0,
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  }
}

describe("toDateStr", () => {
  it("格式化为 YYYY-MM-DD 且补零", () => {
    expect(toDateStr(new Date(2026, 0, 5))).toBe("2026-01-05")
    expect(toDateStr(new Date(2026, 11, 31))).toBe("2026-12-31")
  })

  it("使用本地时间而非 UTC（跨时区不偏移）", () => {
    expect(toDateStr(new Date(2026, 5, 15, 0, 30))).toBe("2026-06-15")
    expect(toDateStr(new Date(2026, 5, 15, 23, 30))).toBe("2026-06-15")
  })
})

describe("parseDateStr", () => {
  it("解析合法日期为当天零点", () => {
    const d = parseDateStr("2026-06-15")
    expect(d).not.toBeNull()
    expect(d!.getFullYear()).toBe(2026)
    expect(d!.getMonth()).toBe(5)
    expect(d!.getDate()).toBe(15)
    expect(d!.getHours()).toBe(0)
    expect(d!.getMinutes()).toBe(0)
  })

  it("非法格式返回 null", () => {
    expect(parseDateStr("")).toBeNull()
    expect(parseDateStr("2026/06/15")).toBeNull()
    expect(parseDateStr("2026-6-15")).toBeNull()
    expect(parseDateStr("abc")).toBeNull()
    expect(parseDateStr("2026-06-15T00:00")).toBeNull()
  })

  it("与 toDateStr 互为逆运算", () => {
    const original = "2026-03-09"
    expect(toDateStr(parseDateStr(original)!)).toBe(original)
  })
})

describe("getWeekStart", () => {
  it("offset=0 返回所在周的周一零点", () => {
    // 2026-06-17 是周三 → 本周一为 2026-06-15
    const result = getWeekStart(0, localMs(2026, 6, 17))
    const d = new Date(result)
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(5)
    expect(d.getDate()).toBe(15)
    expect(d.getHours()).toBe(0)
    expect(d.getMinutes()).toBe(0)
    expect(d.getSeconds()).toBe(0)
    expect(localDay(result)).toBe(1)
  })

  it("offset=1 回退到上周（更早），而非前进到下周", () => {
    const thisWeek = getWeekStart(0, localMs(2026, 6, 17))
    const lastWeek = getWeekStart(1, localMs(2026, 6, 17))
    const d = new Date(lastWeek)
    expect(d.getMonth()).toBe(5)
    expect(d.getDate()).toBe(8)
    expect(thisWeek - lastWeek).toBe(WEEK_MS)
  })

  it("周一当天返回当天零点（含边界）", () => {
    const result = getWeekStart(0, localMs(2026, 6, 15, 9, 30))
    expect(new Date(result).getDate()).toBe(15)
    expect(new Date(result).getHours()).toBe(0)
  })

  it("周日归入「本周」而非下一周（day===0 归一化为 7）", () => {
    // 2026-06-21 是周日 → 本周一仍是 2026-06-15
    const result = getWeekStart(0, localMs(2026, 6, 21, 23, 59))
    expect(new Date(result).getDate()).toBe(15)
    expect(localDay(result)).toBe(1)
  })

  it("周日与次周一属于不同周", () => {
    const sunday = getWeekStart(0, localMs(2026, 6, 21))
    const monday = getWeekStart(0, localMs(2026, 6, 22))
    expect(monday - sunday).toBe(WEEK_MS)
  })

  it("返回结果恒为周一", () => {
    for (let day = 1; day <= 28; day++) {
      expect(localDay(getWeekStart(0, localMs(2026, 6, day)))).toBe(1)
    }
  })

  it("跨月边界：月初回退到上个月末的周一", () => {
    // 2026-07-01 是周三 → 本周一为 2026-06-29
    const d = new Date(getWeekStart(0, localMs(2026, 7, 1)))
    expect(d.getMonth()).toBe(5)
    expect(d.getDate()).toBe(29)
  })

  it("跨年边界：元旦回退到上一年末的周一", () => {
    // 2027-01-01 是周五 → 本周一为 2026-12-28
    const d = new Date(getWeekStart(0, localMs(2027, 1, 1)))
    expect(d.getFullYear()).toBe(2026)
    expect(d.getMonth()).toBe(11)
    expect(d.getDate()).toBe(28)
  })

  it("大 offset 累加正确（7 周前更早）", () => {
    const thisWeek = getWeekStart(0, localMs(2026, 6, 17))
    const sevenWeeksAgo = getWeekStart(7, localMs(2026, 6, 17))
    expect(thisWeek - sevenWeeksAgo).toBe(WEEK_MS * 7)
    expect(localDay(sevenWeeksAgo)).toBe(1)
  })

  it("同一周内任意时刻得到相同周界", () => {
    const mon = getWeekStart(0, localMs(2026, 6, 15, 0, 0))
    const wed = getWeekStart(0, localMs(2026, 6, 17, 12, 0))
    const sun = getWeekStart(0, localMs(2026, 6, 21, 23, 59))
    expect(mon).toBe(wed)
    expect(wed).toBe(sun)
  })
})

describe("splitTags", () => {
  it("空输入返回空数组", () => {
    expect(splitTags("")).toEqual([])
    expect(splitTags("   ")).toEqual([])
    expect(splitTags("\n\t ")).toEqual([])
  })

  it("英文逗号分隔", () => {
    expect(splitTags("a,b,c")).toEqual(["a", "b", "c"])
  })

  it("中文逗号分隔", () => {
    expect(splitTags("a，b，c")).toEqual(["a", "b", "c"])
  })

  it("顿号分隔", () => {
    expect(splitTags("a、b、c")).toEqual(["a", "b", "c"])
  })

  it("空白分隔（空格/制表/换行）", () => {
    expect(splitTags("a b\tc\nd")).toEqual(["a", "b", "c", "d"])
  })

  it("混合分隔符统一处理", () => {
    expect(splitTags("a, b、c d，e")).toEqual(["a", "b", "c", "d", "e"])
  })

  it("去除首尾空白", () => {
    expect(splitTags("  a  ,  b  ")).toEqual(["a", "b"])
  })

  it("去重并保留首次出现顺序", () => {
    expect(splitTags("b,a,b,c,a")).toEqual(["b", "a", "c"])
  })

  it("连续分隔符不产生空标签", () => {
    expect(splitTags("a,,,b")).toEqual(["a", "b"])
    expect(splitTags(",,,")).toEqual([])
  })

  it("支持中文标签", () => {
    expect(splitTags("工作、学习、生活")).toEqual(["工作", "学习", "生活"])
  })

  it("支持单个标签", () => {
    expect(splitTags("solo")).toEqual(["solo"])
  })
})

describe("isOverdueAgainst", () => {
  const todayStart = parseDateStr("2026-06-15")

  it("截止日期严格早于今天且未完成 → 逾期", () => {
    expect(isOverdueAgainst(makeTodo({
      id: "a",
      dueDate: "2026-06-14",
    }), todayStart)).toBe(true)
  })

  it("今天到期不算逾期", () => {
    expect(isOverdueAgainst(makeTodo({
      id: "a",
      dueDate: "2026-06-15",
    }), todayStart)).toBe(false)
  })

  it("未来到期不算逾期", () => {
    expect(isOverdueAgainst(makeTodo({
      id: "a",
      dueDate: "2026-06-16",
    }), todayStart)).toBe(false)
  })

  it("已完成不算逾期", () => {
    expect(isOverdueAgainst(makeTodo({
      id: "a",
      dueDate: "2026-06-01",
      done: true,
    }), todayStart)).toBe(false)
  })

  it("无截止日期不算逾期", () => {
    expect(isOverdueAgainst(makeTodo({
      id: "a",
      dueDate: null,
    }), todayStart)).toBe(false)
    expect(isOverdueAgainst(makeTodo({
      id: "a",
      dueDate: "   ",
    }), todayStart)).toBe(false)
  })

  it("非法截止日期不算逾期", () => {
    expect(isOverdueAgainst(makeTodo({
      id: "a",
      dueDate: "bad",
    }), todayStart)).toBe(false)
  })

  it("todayStart 为 null 时安全返回 false", () => {
    expect(isOverdueAgainst(makeTodo({
      id: "a",
      dueDate: "2026-06-01",
    }), null)).toBe(false)
  })
})

describe("rolloverOverdue", () => {
  const today = localMs(2026, 6, 15)

  it("同一天重复调用幂等（lastRolloverDate 已为今天则不处理）", () => {
    const list = [makeTodo({
      id: "a",
      dueDate: "2026-06-10",
      rolloverCount: 1,
    })]
    const result = rolloverOverdue(list, "2026-06-15", today)
    expect(result.changed).toBe(false)
    // 原数组引用直接透传，不做无谓拷贝
    expect(result.list).toBe(list)
    expect(result.list[0].dueDate).toBe("2026-06-10")
    expect(result.list[0].rolloverCount).toBe(1)
  })

  it("首次顺延：逾期未完成项改到今天并累计次数", () => {
    const list = [makeTodo({
      id: "a",
      dueDate: "2026-06-10",
    })]
    const result = rolloverOverdue(list, null, today)
    expect(result.changed).toBe(true)
    expect(result.lastRolloverDate).toBe("2026-06-15")
    expect(result.list[0].dueDate).toBe("2026-06-15")
    expect(result.list[0].rolloverCount).toBe(1)
  })

  it("已完成项不顺延（即使已逾期）", () => {
    const list = [makeTodo({
      id: "a",
      dueDate: "2026-06-10",
      done: true,
      doneAt: 1,
    })]
    const result = rolloverOverdue(list, null, today)
    expect(result.changed).toBe(false)
    expect(result.list[0].dueDate).toBe("2026-06-10")
    expect(result.list[0].rolloverCount).toBe(0)
  })

  it("无截止日期的项不顺延", () => {
    const list = [makeTodo({
      id: "a",
      dueDate: null,
    })]
    const result = rolloverOverdue(list, null, today)
    expect(result.changed).toBe(false)
    expect(result.list[0].dueDate).toBeNull()
  })

  it("今天到期与未来到期都不算逾期", () => {
    const list = [
      makeTodo({
        id: "today",
        dueDate: "2026-06-15",
      }),
      makeTodo({
        id: "future",
        dueDate: "2026-06-20",
      }),
    ]
    const result = rolloverOverdue(list, null, today)
    expect(result.changed).toBe(false)
    expect(result.list[0].dueDate).toBe("2026-06-15")
    expect(result.list[1].dueDate).toBe("2026-06-20")
  })

  it("非法截止日期不被顺延（解析失败跳过）", () => {
    const list = [makeTodo({
      id: "a",
      dueDate: "not-a-date",
    })]
    const result = rolloverOverdue(list, null, today)
    expect(result.changed).toBe(false)
    expect(result.list[0].dueDate).toBe("not-a-date")
  })

  it("多条目混合：仅逾期未完成项被改写，其余保持原引用", () => {
    const overdue = makeTodo({
      id: "overdue",
      dueDate: "2026-06-01",
    })
    const done = makeTodo({
      id: "done",
      dueDate: "2026-06-01",
      done: true,
    })
    const future = makeTodo({
      id: "future",
      dueDate: "2026-07-01",
    })
    const result = rolloverOverdue([overdue, done, future], null, today)

    expect(result.changed).toBe(true)
    expect(result.list[0].dueDate).toBe("2026-06-15")
    // 未变更项保持同一对象引用（减少无谓渲染）
    expect(result.list[1]).toBe(done)
    expect(result.list[2]).toBe(future)
  })

  it("累计顺延次数：原有次数上继续累加", () => {
    const list = [makeTodo({
      id: "a",
      dueDate: "2026-06-10",
      rolloverCount: 3,
    })]
    const result = rolloverOverdue(list, "2026-06-14", today)
    expect(result.list[0].rolloverCount).toBe(4)
  })

  it("跨年边界：去年末逾期项顺延到今年", () => {
    const newYear = localMs(2027, 1, 2)
    const list = [makeTodo({
      id: "a",
      dueDate: "2026-12-31",
    })]
    const result = rolloverOverdue(list, null, newYear)
    expect(result.changed).toBe(true)
    expect(result.list[0].dueDate).toBe("2027-01-02")
  })

  it("lastRolloverDate 为过期历史值时执行顺延并更新为今天", () => {
    const list = [makeTodo({
      id: "a",
      dueDate: "2026-06-10",
    })]
    const result = rolloverOverdue(list, "2026-06-12", today)
    expect(result.changed).toBe(true)
    expect(result.lastRolloverDate).toBe("2026-06-15")
  })

  it("空列表返回 changed=false 且 lastRolloverDate 更新为今天", () => {
    const result = rolloverOverdue([], null, today)
    expect(result.changed).toBe(false)
    expect(result.lastRolloverDate).toBe("2026-06-15")
  })

  it("顺延不对源数组产生副作用（不可变更新）", () => {
    const list = [makeTodo({
      id: "a",
      dueDate: "2026-06-10",
    })]
    const before = list[0].dueDate
    rolloverOverdue(list, null, today)
    expect(list[0].dueDate).toBe(before)
  })
})
