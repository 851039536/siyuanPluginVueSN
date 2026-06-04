/**
 * 脚本启动器 - 脚本执行组合式函数
 */
import type {
  Script,
  ScriptLanguage,
} from "../types"
import { ref } from "vue"

function getNodeModules(): { child_process: any } | null {
  try {
    const child_process = require("node:child_process")
    return { child_process }
  } catch {
    return null
  }
}

export interface RunResult {
  stdout: string
  stderr: string
  exitCode: number | null
}

export function useScriptRunner() {
  const running = ref(false)
  const output = ref<string>("")
  const error = ref<string>("")

  const runScript = async (
    script: Script,
    filePath: string,
    timeout = 30000,
  ): Promise<RunResult> => {
    running.value = true
    output.value = ""
    error.value = ""

    const node = getNodeModules()
    if (!node) {
      running.value = false
      error.value = "Node.js environment not available"
      throw new Error("Node.js environment not available")
    }

    const { child_process } = node
    const command = buildCommand(script.language, filePath)

    return new Promise<RunResult>((resolve, _reject) => {
      const proc = child_process.exec(
        command,
        {
          timeout,
          encoding: "utf-8",
          shell: "cmd.exe",
          env: { ...process.env, PYTHONIOENCODING: "utf-8" },
        },
        (err: any, stdout: string, stderr: string): void => {
          running.value = false
          output.value = stdout || ""
          error.value = stderr || ""

          if (err && err.killed) {
            error.value = `Script timed out after ${timeout}ms`
          }

          resolve({
            stdout: stdout || "",
            stderr: stderr || "",
            exitCode: err ? (err.code ?? 1) : 0,
          })
        },
      )

      proc.stdout?.on("data", (data: string) => {
        output.value += data
      })

      proc.stderr?.on("data", (data: string) => {
        error.value += data
      })
    })
  }

  return {
    running,
    output,
    error,
    runScript,
  }
}

function buildCommand(language: ScriptLanguage, filePath: string): string {
  switch (language) {
    case "python":
      return `set PYTHONIOENCODING=utf-8 && python "${filePath}"`
    case "bash":
      return `bash "${filePath}"`
    case "powershell":
      return `powershell -ExecutionPolicy Bypass -Command "[Console]::OutputEncoding=[Text.Encoding]::UTF8; & '${filePath}'"`
    case "nodejs":
      return `node "${filePath}"`
    case "batch":
      return `chcp 65001 >nul && call "${filePath}"`
    default:
      return `cat "${filePath}"`
  }
}
