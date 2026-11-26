import { describe, expect, it } from "vitest"
import zhCN from "../../../i18n/zh_CN.json"
import { diagnosePipelineFailure, DIAGNOSIS_RULES } from "./pipelineDiagnosis"

const I18N = zhCN.gitPush as Record<string, string>

describe("pipelineDiagnosis", () => {
  it("规则与兜底的文案键都能解析", () => {
    for (const rule of DIAGNOSIS_RULES) {
      expect(I18N[rule.titleKey], rule.titleKey).toBeTruthy()
      expect(I18N[rule.hintKey], rule.hintKey).toBeTruthy()
    }
    expect(I18N.pipelineDiagUnknownTitle).toBeTruthy()
    expect(I18N.pipelineDiagUnknownHint).toBeTruthy()
  })

  it("真实错误文本命中对应规则", () => {
    const cases: [string, string][] = [
      ["fatal: Unable to create '/repo/.git/index.lock': File exists.", "indexLock"],
      ["fatal: Authentication failed for 'https://example.com/repo.git/'", "auth"],
      ["git@github.com: Permission denied (publickey).", "sshKey"],
      ["The requested URL returned error: 403", "accessDenied"],
      ["SSL certificate problem: unable to get local issuer certificate", "ssl"],
      ["remote: Repository not found.", "repoMissing"],
      ["该平台远程未配置", "noRemote"],
      ["error: src refspec feature-x does not match any", "branchMissing"],
      ["! [rejected] v1.0.0 -> v1.0.0 (already exists)", "tagExists"],
      ["remote: error: GH006: Protected branch update failed for refs/heads/main.", "protected"],
      ["! [rejected]        main -> main (non-fast-forward)", "nonFastForward"],
      ["fatal: The current branch main has no upstream branch.", "branchMissing"],
      ["error: Your local changes to the following files would be overwritten by merge:", "localConflict"],
      ["fatal: not a git repository (or any of the parent directories): .git", "notRepo"],
      ["The operation timed out after 60000ms", "timeout"],
      ["fatal: unable to access 'https://example.com/': Could not resolve host: example.com", "network"],
    ]
    for (const [text, id] of cases) {
      expect(diagnosePipelineFailure(text, I18N)?.id, text).toBe(id)
    }
  })

  it("标签已存在不会被通用 failed to push 尾句带偏", () => {
    const text = [
      "To https://example.com/repo.git",
      " ! [rejected]        v1.0.0 -> v1.0.0 (already exists)",
      "error: failed to push some refs to 'https://example.com/repo.git'",
    ].join("\n")
    expect(diagnosePipelineFailure(text, I18N)?.id).toBe("tagExists")
  })

  it("空文本不产生诊断；未知错误落到兜底项", () => {
    expect(diagnosePipelineFailure("", I18N)).toBeNull()
    expect(diagnosePipelineFailure("   ", I18N)).toBeNull()
    expect(diagnosePipelineFailure("something odd happened", I18N)?.id).toBe("unknown")
  })

  it("标题文案缺失时返回 null，避免空卡片", () => {
    expect(diagnosePipelineFailure("non-fast-forward", {})).toBeNull()
  })
})
