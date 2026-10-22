// 脚本执行器辅助单测 —— 启动清扫按 pid 补杀遗留进程，误判映像名会杀无辜进程
import { describe, expect, it } from "vitest"
import { isSweepableImage } from "./ScriptExecutor"

describe("isSweepableImage", () => {
  it("接受脚本运行时映像名（含 .exe / 路径 / 大小写）", () => {
    expect(isSweepableImage("node.exe")).toBe(true)
    expect(isSweepableImage("cmd.exe")).toBe(true)
    expect(isSweepableImage("powershell.exe")).toBe(true)
    expect(isSweepableImage("C:\\Windows\\System32\\cmd.exe")).toBe(true)
    expect(isSweepableImage("Node.EXE")).toBe(true)
  })

  it("拒绝无关进程与 tasklist 空结果提示", () => {
    expect(isSweepableImage("chrome.exe")).toBe(false)
    expect(isSweepableImage("svchost.exe")).toBe(false)
    expect(isSweepableImage("信息: 没有运行的任务匹配指定标准。")).toBe(false)
    expect(isSweepableImage("")).toBe(false)
  })
})
