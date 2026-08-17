// AI 提交信息与 stash 描述生成（含启发式降级）
import type { Plugin } from "siyuan"
import { COMMIT_TYPE_VALUES } from "../types/storage"
import type { CommitTemplate, GitPushStorage } from "../types/storage"
import { checkCommitRule, fixCommitMessageHeuristically } from "../commitRuleChecker"
import { callAI, getApiConfigFromPlugin } from "@/utils/aiApi"
import type { GitExecutor } from "./GitExecutor"
import type { WorktreeOps } from "./WorktreeOps"

export class CommitMsgGenerator {
  private plugin: Plugin
  private executor: GitExecutor
  private worktreeOps: WorktreeOps
  private storage: GitPushStorage

  constructor(plugin: Plugin, executor: GitExecutor, worktreeOps: WorktreeOps, storage: GitPushStorage) {
    this.plugin = plugin
    this.executor = executor
    this.worktreeOps = worktreeOps
    this.storage = storage
  }

  /**
   * 根据暂存区差异自动生成提交信息
   */
  async generateCommitMessage(projectPath: string): Promise<{ message: string, source: "ai" | "heuristic" }> {
    try {
      const diffText = await this.executor.execGit(projectPath, [
        "-c", "core.quotepath=false", "diff", "--text", "--cached", "--stat",
      ])
      if (!diffText) { return { message: "chore: update files", source: "heuristic" } }

      const aiConfig = getApiConfigFromPlugin(this.plugin)
      if (!aiConfig.apiKey) {
        return { message: this.heuristicCommitMessage(diffText), source: "heuristic" }
      }

      const fullDiff = await this.executor.execGit(projectPath, [
        "-c", "core.quotepath=false", "diff", "--text", "--cached",
      ])
      const diffSnippet = (fullDiff || diffText).substring(0, 3000)

      try {
        const result = await callAI(
          `根据以下 git diff，生成一条中文 conventional commit 信息。\n格式：type: 中文描述\ntype 必须为 ${COMMIT_TYPE_VALUES.join("/")} 之一。\n示例：refactor: 重构 userService 为策略模式\n示例：fix: 修复订单列表空指针异常\n示例：feat: 新增导出 PDF 功能\n重要：只输出一行提交信息，不要输出分析、解释、Markdown 或任何别的内容。\nDiff:\n${diffSnippet}`,
          aiConfig,
          {
            systemPrompt: "输出要求：只输出一行 conventional commit 格式的提交信息。禁止输出解释、分析、额外文字。",
            temperature: 0.1,
            maxTokens: 60,
            enableThinking: false,
          },
        )
        const trimmed = result?.trim() ?? ""
        const typesPattern = COMMIT_TYPE_VALUES.join("|")
        const match = trimmed.match(new RegExp(`(${typesPattern})(?:\\([^)]+\\))?\\s*:\\s*(.+)`, "i"))
        if (match) {
          return { message: `${match[1].toLowerCase()}: ${match[2].trim()}`, source: "ai" }
        }
        console.warn("[gitPush] AI 未返回有效 commit 格式，降级启发式:", trimmed.substring(0, 80))
      } catch (e: unknown) {
        console.error("[gitPush] AI 调用失败:", e)
      }

      return { message: this.heuristicCommitMessage(diffText), source: "heuristic" }
    } catch {
      return { message: "chore: update files", source: "heuristic" }
    }
  }

  private heuristicCommitMessage(statText: string): string {
    const lines = statText.split("\n").filter(Boolean)
    const files = lines.slice(0, -1).map((l) => l.split("|")[0]?.trim()).filter(Boolean)
    if (files.length === 0) { return "chore: update files" }

    let type = "chore"
    const allPaths = files.join(" ").toLowerCase()

    if (files.some((f) => f.match(/\.(test|spec)\./))) type = "test"
    else if (files.some((f) => f.match(/\.(css|scss|less|style)/))) type = "style"
    else if (allPaths.includes("fix") || allPaths.includes("bug")) type = "fix"
    else if (allPaths.includes("readme") || allPaths.includes("doc")) type = "docs"
    else if (allPaths.includes("refactor") || allPaths.includes("rename")) type = "refactor"
    else if (allPaths.includes(".d.ts") || allPaths.includes("types/")) type = "refactor"
    else if (files.length >= 5) type = "feat"

    const fileList = files.slice(0, 3).map((f) => f.split("/").pop() || f).join(", ")
    const more = files.length > 3 ? ` 等 ${files.length} 个文件` : ""

    return `${type}: ${fileList}${more}`
  }

  /** 根据原提交信息 + 提交变更摘要，生成符合提交规则的修正提交信息 */
  async generateCommitFix(projectPath: string, hash: string, currentMessage: string): Promise<{ message: string, source: "ai" | "heuristic" }> {
    const aiConfig = getApiConfigFromPlugin(this.plugin)
    const context = await this.worktreeOps.getCommitFixContext(projectPath, hash)

    const heuristic = fixCommitMessageHeuristically(currentMessage)
    if (!aiConfig.apiKey) {
      return { message: heuristic, source: "heuristic" }
    }

    try {
      const result = await callAI(
        `请修正以下不符合提交规则的 Git 提交信息。
规则：type(scope)!: 描述
type 必须为 ${COMMIT_TYPE_VALUES.join("/")} 之一。
要求：保留原意；只输出一行修正后的提交信息，不要输出解释、分析、Markdown 或任何别的内容。

原提交信息：${currentMessage}

提交变更摘要：
${context || "（无变更摘要）"}`,
        aiConfig,
        {
          systemPrompt: "输出要求：只输出一行 conventional commit 格式的提交信息。禁止输出解释、分析、额外文字。",
          temperature: 0.1,
          maxTokens: 60,
          enableThinking: false,
        },
      )
      const trimmed = result?.trim() ?? ""
      if (trimmed && checkCommitRule(trimmed) === null) {
        return { message: trimmed, source: "ai" }
      }
      console.warn("[gitPush] AI 未返回有效提交规则格式，降级启发式:", trimmed.substring(0, 80))
    } catch (e: unknown) {
      console.error("[gitPush] AI 修正提交信息失败:", e)
    }

    return { message: heuristic, source: "heuristic" }
  }

  /** AI 生成 stash 描述 */
  async generateStashDescription(projectPath: string): Promise<string> {
    const wt = await this.worktreeOps.getWorkingTreeStatus(projectPath)
    if (!wt.hasChanges) return ""
    const names = wt.files.slice(0, 8).map((f) => f.path.split("/").pop() || f.path).join("、")
    const more = wt.files.length > 8 ? `等${wt.files.length}个文件` : ""
    const desc = `${wt.files.length}个文件: ${names}${more}`

    const aiConfig = getApiConfigFromPlugin(this.plugin)
    if (!aiConfig.apiKey) {
      return desc
    }

    try {
      const result = await callAI(
        `根据以下 git 工作区变更的文件，推断改动意图，生成一条不超过 12 个字的简短描述。只返回描述本身，不要解释。\n示例：README.md → "更新README文档"；index.ts+types.ts → "重构类型定义"；App.vue+style.css → "调整页面布局和样式"；package.json → "更新依赖配置"\n变更文件：${names}${more}`,
        aiConfig,
        { temperature: 0.5, maxTokens: 40 },
      )
      const t = result?.trim()
      return t && t.length > 0 ? t : desc
    } catch {
      return desc
    }
  }

  // ── 提交信息模板 ──

  async getCommitTemplates(): Promise<CommitTemplate[]> {
    return this.storage.commitTemplates.loadOrDefault()
  }

  async saveCommitTemplates(templates: CommitTemplate[]): Promise<void> {
    await this.storage.commitTemplates.save(templates)
  }
}
