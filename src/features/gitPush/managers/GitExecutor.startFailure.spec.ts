// 子进程「启动即失败」路径的计数正确性（execFile / spawn 同步抛错）
//
// 为什么值得单独测：这条路径低概率但后果不可逆 —— 计数已加、回调永不到来，
// 不回滚就会永久漏掉一个并发槽位（池子越跑越小），scheduleNext 不执行则排队命令全部悬挂。
// 外部表现只是「用久了某些 git 操作不再执行」，黑盒几乎测不出来，所以这里直接读私有计数器。
import type { GitPushStorage } from "../types/storage"
import { describe, expect, it } from "vitest"
import { GitExecutor } from "./GitExecutor"

interface ExecutorInternals {
  getProcess: () => { execFile: unknown, spawn: unknown } | null | undefined
  gitRunning: number
  networkRunning: number
}

function internals(executor: GitExecutor): ExecutorInternals {
  return executor as unknown as ExecutorInternals
}

/** 只让目标 API 抛错，其余能力（含恢复后的正常调用）保持真实 */
function breakChildProcess(executor: GitExecutor, which: "execFile" | "spawn"): void {
  const hook = internals(executor)
  const real = hook.getProcess.bind(executor)
  hook.getProcess = () => {
    const cp = real()
    if (!cp) return cp
    const broken = { ...cp } as { execFile: unknown, spawn: unknown }
    broken[which] = () => {
      throw new Error(`模拟 ${which} 同步抛错`)
    }
    return broken
  }
}

function restoreChildProcess(executor: GitExecutor): void {
  const hook = internals(executor)
  delete (hook as { getProcess?: unknown }).getProcess
}

const storage = {} as GitPushStorage

describe("GitExecutor 子进程启动失败", () => {
  it("execFile 同步抛错：错误可读、并发计数回滚、后续命令照常执行", async () => {
    const executor = new GitExecutor(storage)
    breakChildProcess(executor, "execFile")

    await expect(executor.execGit(process.cwd(), ["--version"])).rejects.toThrow("git 命令启动失败")
    expect(internals(executor).gitRunning).toBe(0)
    expect(internals(executor).networkRunning).toBe(0)

    // 槽位没泄漏：恢复后立刻能跑通（若计数漏减，并发上限会被慢慢吃光）
    restoreChildProcess(executor)
    await expect(executor.execGit(process.cwd(), ["rev-parse", "--git-dir"])).resolves.toContain(".git")

    // 失败也要记账（进程计数诊断不因启动失败而漏记）
    const stats = executor.getGitStats()
    expect(stats.total).toBe(2)
    expect(Object.values(stats.byCommand).reduce((sum, s) => sum + s.failures, 0)).toBe(1)
  })

  it("spawn 同步抛错：流式命令同样回滚计数并回收", async () => {
    const executor = new GitExecutor(storage)
    breakChildProcess(executor, "spawn")

    await expect(
      executor.execGitStreaming(process.cwd(), ["hash-object", "--stdin"], "hello\n"),
    ).rejects.toThrow("git 命令启动失败")
    expect(internals(executor).gitRunning).toBe(0)

    restoreChildProcess(executor)
    const out = await executor.execGitStreaming(process.cwd(), ["hash-object", "--stdin"], "hello\n")
    expect(out.toString("utf8").trim()).toHaveLength(40)
  })
})
