// src/features/gitPush/utils/gitOutput.spec.ts — git 命令输出解析单元测试
//
// 覆盖重点：porcelain v1 两位状态码语义（X 位优先、Y 位回退）、unmerged 组合
// 不重复计数、shortstat 为可选行（merge/空改动无该行）导致的记录切分差异。
import { describe, expect, it } from "vitest"
import {
  parseBranches,
  parseCommitFiles,
  parseCommitLog,
  parseCommitShortStats,
  parseStashList,
  parseWorktreeStatus,
} from "./gitOutput"

/** 取数组首元素（tsconfig lib 为 ES2020，无 Array.prototype.at，故用索引替代） */
function first<T>(arr: T[]): T | undefined {
  return arr[0]
}

describe("parseWorktreeStatus", () => {
  it("空输入返回空结果与零计数", () => {
    const r = parseWorktreeStatus("")
    expect(r.files).toEqual([])
    expect(r.stagedCount).toBe(0)
    expect(r.unstagedCount).toBe(0)
    expect(r.untrackedCount).toBe(0)
  })

  it("未跟踪文件：?? 两位置均为 ?，计入 untracked 而非 staged/unstaged", () => {
    const r = parseWorktreeStatus("?? new.txt")
    expect(r.files[0]).toMatchObject({ path: "new.txt", status: "untracked", staged: false, unstaged: false })
    expect(r.untrackedCount).toBe(1)
    expect(r.stagedCount).toBe(0)
    expect(r.unstagedCount).toBe(0)
  })

  it("已暂存修改：M 在 X 位，staged=true / unstaged=false", () => {
    const r = parseWorktreeStatus("M  a.txt")
    expect(r.files[0]).toMatchObject({ path: "a.txt", status: "modified", staged: true, unstaged: false })
    expect(r.stagedCount).toBe(1)
    expect(r.unstagedCount).toBe(0)
  })

  it("工作区修改：M 在 Y 位，staged=false / unstaged=true", () => {
    const r = parseWorktreeStatus(" M a.txt")
    expect(r.files[0]).toMatchObject({ path: "a.txt", status: "modified", staged: false, unstaged: true })
    expect(r.stagedCount).toBe(0)
    expect(r.unstagedCount).toBe(1)
  })

  it("AM（新增已暂存 + 工作区又改动）状态归属为 added 而非 modified", () => {
    // 这是 X 位优先判定的核心回归点：旧逻辑 xy.includes("M") 会误判为 modified
    const r = parseWorktreeStatus("AM a.txt")
    expect(r.files[0].status).toBe("added")
    expect(r.stagedCount).toBe(1)
    expect(r.unstagedCount).toBe(1)
  })

  it("RM（重命名已暂存 + 工作区又改动）状态归属为 renamed，且拆分新旧路径", () => {
    // 旧逻辑同样会吞成 modified 并跳过 " -> " 拆分
    const r = parseWorktreeStatus("RM old.txt -> new.txt")
    expect(r.files[0].status).toBe("renamed")
    expect(r.files[0].path).toBe("new.txt")
    expect(r.files[0].oldPath).toBe("old.txt")
  })

  it("R  重命名（无工作区改动）同样拆分新旧路径", () => {
    const r = parseWorktreeStatus("R  old.txt -> new.txt")
    expect(r.files[0]).toMatchObject({ status: "renamed", path: "new.txt", oldPath: "old.txt" })
  })

  it("MM（暂存与工作区均修改）同时计入两个计数", () => {
    const r = parseWorktreeStatus("MM a.txt")
    expect(r.files[0].status).toBe("modified")
    expect(r.stagedCount).toBe(1)
    expect(r.unstagedCount).toBe(1)
  })

  it("全部 7 种 unmerged 组合均判为 unmerged 且不计入 staged/unstaged", () => {
    // 冲突文件由 ConflictSection 单独呈现，重复计入会造成计数虚高
    for (const code of ["DD", "AU", "UD", "UA", "DU", "AA", "UU"]) {
      const r = parseWorktreeStatus(`${code} conflict.txt`)
      expect(r.files[0].status, `code=${code}`).toBe("unmerged")
      expect(r.stagedCount, `code=${code} stagedCount`).toBe(0)
      expect(r.unstagedCount, `code=${code} unstagedCount`).toBe(0)
      expect(r.untrackedCount, `code=${code} untrackedCount`).toBe(0)
    }
  })

  it("状态码 A / D / C / U 映射到对应类型", () => {
    expect(parseWorktreeStatus("A  a.txt").files[0].status).toBe("added")
    expect(parseWorktreeStatus("D  a.txt").files[0].status).toBe("deleted")
    expect(parseWorktreeStatus("C  a.txt").files[0].status).toBe("copied")
    expect(parseWorktreeStatus("UA a.txt").files[0].status).toBe("unmerged")
  })

  it("未识别状态码回退为 modified", () => {
    expect(parseWorktreeStatus("XY a.txt").files[0].status).toBe("modified")
  })

  it("多行输入逐行解析，计数累计", () => {
    const raw = ["M  a.txt", " M b.txt", "?? c.txt", "AM d.txt"].join("\n")
    const r = parseWorktreeStatus(raw)
    expect(r.files).toHaveLength(4)
    expect(r.stagedCount).toBe(2)   // a(X=M)、d(X=A)；b 的 M 在 Y 位、c 为未跟踪
    expect(r.unstagedCount).toBe(2) // b(Y=M)、d(Y=M)；a 已全部暂存、c 为未跟踪
    expect(r.untrackedCount).toBe(1)
  })

  it("空行被过滤", () => {
    expect(parseWorktreeStatus("M  a.txt\n\n\n M b.txt").files).toHaveLength(2)
  })

  it("含引号的路径被去引号（git 对特殊字符路径加引号）", () => {
    const r = parseWorktreeStatus("M  \"path with space.txt\"")
    expect(r.files[0].path).toBe("path with space.txt")
  })

  it("重命名两侧的路径各自去引号", () => {
    const r = parseWorktreeStatus("R  \"old name.txt\" -> \"new name.txt\"")
    expect(r.files[0].oldPath).toBe("old name.txt")
    expect(r.files[0].path).toBe("new name.txt")
  })

  it("非重命名状态即使路径含 \" -> \" 也不拆分", () => {
    const r = parseWorktreeStatus("M  weird -> name.txt")
    expect(r.files[0].oldPath).toBeUndefined()
    expect(r.files[0].path).toBe("weird -> name.txt")
  })

  it("路径为空的行被跳过", () => {
    expect(parseWorktreeStatus("M  ").files).toEqual([])
  })

  it("Y 位缺失（仅一位状态码）时按空格处理", () => {
    const r = parseWorktreeStatus("M")
    expect(r.files).toEqual([])
  })
})

describe("parseStashList", () => {
  it("解析 stash@{n}: message 形态", () => {
    const r = parseStashList("stash@{0}: WIP on main: abc123 init")
    expect(r).toEqual([{ index: 0, message: "WIP on main: abc123 init" }])
  })

  it("多条按行顺序，index 取自花括号内数字", () => {
    const raw = ["stash@{0}: first", "stash@{1}: second", "stash@{12}: twelfth"].join("\n")
    expect(parseStashList(raw).map((e) => e.index)).toEqual([0, 1, 12])
  })

  it("无法识别的行被忽略", () => {
    expect(parseStashList("garbage line\nstash@{0}: ok")).toHaveLength(1)
  })

  it("空输入返回空数组", () => {
    expect(parseStashList("")).toEqual([])
  })

  it("message 含冒号时完整保留", () => {
    expect(first(parseStashList("stash@{0}: WIP on main: a: b"))?.message).toBe("WIP on main: a: b")
  })

  it("message 前后空白被正则的 \\s* 吃掉", () => {
    expect(first(parseStashList("stash@{0}:    spaced"))?.message).toBe("spaced")
  })
})

describe("parseCommitLog", () => {
  /** 构造 6 行一组的 log 输出 */
  const makeEntry = (hash: string, subject: string, parents: string): string =>
    [hash, subject, "Author", "2 days ago", "2026-07-06T16:19:23+08:00", parents].join("\n")

  it("解析单条记录的全部字段", () => {
    const r = parseCommitLog(makeEntry("abc123", "feat: x", "p1"))
    expect(r).toEqual([{
      hash: "abc123",
      message: "feat: x",
      author: "Author",
      relativeDate: "2 days ago",
      date: "2026-07-06T16:19:23+08:00",
      isMerge: false,
    }])
  })

  it("单父提交 isMerge=false", () => {
    expect(parseCommitLog(makeEntry("h", "s", "p1"))[0].isMerge).toBe(false)
  })

  it("多父提交 isMerge=true（%p 父 hash 空格分隔）", () => {
    expect(parseCommitLog(makeEntry("h", "s", "p1 p2"))[0].isMerge).toBe(true)
  })

  it("根提交（%p 为空）isMerge=false", () => {
    expect(parseCommitLog(makeEntry("h", "s", ""))[0].isMerge).toBe(false)
  })

  it("多条记录按固定 6 行切分，顺序保持", () => {
    const raw = [makeEntry("h1", "s1", "p"), makeEntry("h2", "s2", "p")].join("\n")
    const r = parseCommitLog(raw)
    expect(r.map((e) => e.hash)).toEqual(["h1", "h2"])
    expect(r.map((e) => e.message)).toEqual(["s1", "s2"])
  })

  it("末尾不足 6 行的残块被丢弃（不产出半条记录）", () => {
    const raw = makeEntry("h1", "s1", "p") + "\n" + ["h2", "s2", "Author"].join("\n")
    expect(parseCommitLog(raw)).toHaveLength(1)
  })

  it("空输入返回空数组", () => {
    expect(parseCommitLog("")).toEqual([])
  })

  it("父 hash 含多余空白时仍正确判定 merge", () => {
    expect(parseCommitLog(makeEntry("h", "s", "  p1   p2  "))[0].isMerge).toBe(true)
  })
})

describe("parseCommitShortStats", () => {
  it("空输入返回空 Map", () => {
    expect(parseCommitShortStats("").size).toBe(0)
  })

  it("完整 shortstat 行（增删俱全）", () => {
    const raw = "\x01abc123\n 3 files changed, 10 insertions(+), 5 deletions(-)"
    const s = parseCommitShortStats(raw)
    expect(s.get("abc123")).toEqual({ files: 3, insertions: 10, deletions: 5 })
  })

  it("merge / 空改动提交无 shortstat 行 → 不登记（UI 据此跳过悬停提示）", () => {
    const s = parseCommitShortStats("\x01abc123")
    expect(s.has("abc123")).toBe(false)
    expect(s.size).toBe(0)
  })

  it("仅有 insertions 时 deletions 按 0", () => {
    const s = parseCommitShortStats("\x01h\n 1 file changed, 7 insertions(+)")
    expect(s.get("h")).toEqual({ files: 1, insertions: 7, deletions: 0 })
  })

  it("仅有 deletions 时 insertions 按 0", () => {
    const s = parseCommitShortStats("\x01h\n 1 file changed, 4 deletions(-)")
    expect(s.get("h")).toEqual({ files: 1, insertions: 0, deletions: 4 })
  })

  it("单数拼写（1 file changed / 1 insertion / 1 deletion）不因复数正则失配而漏取", () => {
    const s = parseCommitShortStats("\x01h\n 1 file changed, 1 insertion(+), 1 deletion(-)")
    expect(s.get("h")).toEqual({ files: 1, insertions: 1, deletions: 1 })
  })

  it("多条记录各自独立（0x01 分隔而非换行切分）", () => {
    const raw = "\x01h1\n 1 file changed, 2 insertions(+)\x01h2\n 2 files changed, 3 insertions(+), 4 deletions(-)"
    const s = parseCommitShortStats(raw)
    expect(s.get("h1")).toEqual({ files: 1, insertions: 2, deletions: 0 })
    expect(s.get("h2")).toEqual({ files: 2, insertions: 3, deletions: 4 })
  })

  it("merge 记录夹在两条正常记录之间不使后续记录错位（旧固定行数切分会错位）", () => {
    const raw = "\x01h1\n 1 file changed, 1 insertion(+)\x01mergehash\x01h3\n 5 files changed, 9 insertions(+), 2 deletions(-)"
    const s = parseCommitShortStats(raw)
    expect(s.get("h1")).toEqual({ files: 1, insertions: 1, deletions: 0 })
    expect(s.has("mergehash")).toBe(false)
    expect(s.get("h3")).toEqual({ files: 5, insertions: 9, deletions: 2 })
  })

  it("记录首尾换行与空白被容错", () => {
    const s = parseCommitShortStats("\n\x01  h  \n  1 file changed, 2 insertions(+)  \n")
    expect(s.get("h")).toEqual({ files: 1, insertions: 2, deletions: 0 })
  })

  it("空记录块被跳过", () => {
    expect(parseCommitShortStats("\x01\x01\x01").size).toBe(0)
  })

  it("大数字（千位分隔不含逗号的 git 原始输出）正确解析", () => {
    const s = parseCommitShortStats("\x01h\n 1234 files changed, 56789 insertions(+), 43210 deletions(-)")
    expect(s.get("h")).toEqual({ files: 1234, insertions: 56789, deletions: 43210 })
  })
})

describe("parseCommitFiles", () => {
  it("空输入返回空数组", () => {
    expect(parseCommitFiles("")).toEqual([])
  })

  it("修改行（M）解析为 modified", () => {
    expect(parseCommitFiles("M\tsrc/a.ts")).toEqual([
      { path: "src/a.ts", status: "modified", staged: false, oldPath: undefined },
    ])
  })

  it("新增 / 删除行映射正确", () => {
    expect(parseCommitFiles("A\tnew.ts")[0].status).toBe("added")
    expect(parseCommitFiles("D\told.ts")[0].status).toBe("deleted")
    expect(parseCommitFiles("C100\tx.ts\ty.ts")[0].status).toBe("copied")
    expect(parseCommitFiles("U\tc.ts")[0].status).toBe("unmerged")
  })

  it("R100 重命名：状态取首字母，路径取末列，oldPath 取中间列", () => {
    const r = parseCommitFiles("R100\told.ts\tnew.ts")
    expect(r[0]).toMatchObject({ status: "renamed", path: "new.ts", oldPath: "old.ts" })
  })

  it("重命名带相似度数字不干扰状态判定", () => {
    expect(parseCommitFiles("R087\ta\tb")[0].status).toBe("renamed")
  })

  it("非重命名状态即使有三列也不设置 oldPath", () => {
    expect(parseCommitFiles("M\tweird\tpath")[0].oldPath).toBeUndefined()
  })

  it("路径含 tab 时取末列（parts.slice 语义）", () => {
    const r = parseCommitFiles("M\tweird\tname.ts")
    expect(r[0].path).toBe("name.ts")
  })

  it("列数不足 2 的行被跳过", () => {
    expect(parseCommitFiles("M\nA\tsrc/b.ts")).toHaveLength(1)
  })

  it("多条变更逐行解析", () => {
    const raw = ["M\tsrc/a.ts", "A\tsrc/b.ts", "D\tsrc/c.ts"].join("\n")
    expect(parseCommitFiles(raw).map((f) => f.status)).toEqual(["modified", "added", "deleted"])
  })

  it("状态首字母小写也正确映射（charAt(0).toUpperCase）", () => {
    expect(parseCommitFiles("m\tx.ts")[0].status).toBe("modified")
  })

  it("未知状态字母回退为 modified", () => {
    expect(parseCommitFiles("Z\tx.ts")[0].status).toBe("modified")
  })
})

describe("parseBranches", () => {
  it("NUL 分隔名称与当前标记，* 表示当前分支", () => {
    const r = parseBranches("main\0*\ndev\0")
    expect(r).toEqual([
      { name: "main", current: true },
      { name: "dev", current: false },
    ])
  })

  it("空行被过滤", () => {
    expect(parseBranches("main\0*\n\ndev\0")).toHaveLength(2)
  })

  it("空输入返回空数组", () => {
    expect(parseBranches("")).toEqual([])
  })

  it("非当前分支的 head 字段非 * 即为 false", () => {
    expect(parseBranches("feature/x\0 \nmain\0*")[0].current).toBe(false)
  })

  it("分支名含斜杠（feature/x）完整保留", () => {
    expect(parseBranches("feature/login\0*")[0].name).toBe("feature/login")
  })
})
