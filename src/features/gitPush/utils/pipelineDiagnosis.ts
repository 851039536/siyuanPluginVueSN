// 失败诊断：把真实错误文本匹配到常见 git 失败原因，给出可执行建议（纯函数，无 Vue / DOM）

/** 一条诊断规则：正则 → 标题 / 建议文案键（文案真源在 zh_CN.json） */
export interface DiagnosisRule {
  id: string
  pattern: RegExp
  titleKey: string
  hintKey: string
}

/**
 * 规则按「越具体越靠前」排列：
 * 标签已存在、分支不存在、分支保护都会附带 failed to push 的通用尾句，
 * 必须先于非快进规则匹配，否则建议会指错方向。
 */
export const DIAGNOSIS_RULES: readonly DiagnosisRule[] = [
  {
    id: "indexLock",
    pattern: /index\.lock|another git process seems to be running|unable to create .*index\.lock/i,
    titleKey: "pipelineDiagIndexLockTitle",
    hintKey: "pipelineDiagIndexLockHint",
  },
  {
    id: "auth",
    pattern: /authentication failed|could not read username|invalid username or password|terminal prompts disabled|support for password authentication was removed|http 401/i,
    titleKey: "pipelineDiagAuthTitle",
    hintKey: "pipelineDiagAuthHint",
  },
  {
    id: "sshKey",
    pattern: /permission denied \(publickey\)|no supported authentication methods/i,
    titleKey: "pipelineDiagSshKeyTitle",
    hintKey: "pipelineDiagSshKeyHint",
  },
  {
    id: "accessDenied",
    pattern: /requested url returned error: 403|access denied|http 403/i,
    titleKey: "pipelineDiagAccessTitle",
    hintKey: "pipelineDiagAccessHint",
  },
  {
    id: "ssl",
    pattern: /ssl certificate problem|certificate verify failed|unable to get local issuer certificate|server certificate verification failed/i,
    titleKey: "pipelineDiagSslTitle",
    hintKey: "pipelineDiagSslHint",
  },
  {
    id: "repoMissing",
    pattern: /repository .*not found|does not appear to be a git repository|http 404/i,
    titleKey: "pipelineDiagRepoMissingTitle",
    hintKey: "pipelineDiagRepoMissingHint",
  },
  {
    id: "noRemote",
    pattern: /没有远程|该平台远程未配置|no configured remote|no remote/i,
    titleKey: "pipelineDiagNoRemoteTitle",
    hintKey: "pipelineDiagNoRemoteHint",
  },
  {
    id: "branchMissing",
    pattern: /couldn't find remote ref|remote branch .*not found|src refspec .* does not match any|no such ref|has no upstream branch/i,
    titleKey: "pipelineDiagBranchTitle",
    hintKey: "pipelineDiagBranchHint",
  },
  {
    id: "tagExists",
    pattern: /\(already exists\)|tag .*already exists|would clobber existing tag|cannot update ref .*tag/i,
    titleKey: "pipelineDiagTagTitle",
    hintKey: "pipelineDiagTagHint",
  },
  {
    id: "protected",
    pattern: /protected branch|pre-receive hook declined|hook declined|remote rejected|gh006|branch protection/i,
    titleKey: "pipelineDiagProtectedTitle",
    hintKey: "pipelineDiagProtectedHint",
  },
  {
    id: "nonFastForward",
    pattern: /non-fast-forward|fetch first|failed to push some refs|updates were rejected/i,
    titleKey: "pipelineDiagNonFfTitle",
    hintKey: "pipelineDiagNonFfHint",
  },
  {
    id: "diverged",
    pattern: /have diverged|need to specify how to reconcile divergent branches/i,
    titleKey: "pipelineDiagDivergedTitle",
    hintKey: "pipelineDiagDivergedHint",
  },
  {
    id: "localConflict",
    pattern: /would be overwritten|please commit your changes or stash them|local changes to the following files/i,
    titleKey: "pipelineDiagConflictTitle",
    hintKey: "pipelineDiagConflictHint",
  },
  {
    id: "notRepo",
    pattern: /not a git repository/i,
    titleKey: "pipelineDiagNotRepoTitle",
    hintKey: "pipelineDiagNotRepoHint",
  },
  {
    id: "timeout",
    pattern: /timed out|etimedout|timeout/i,
    titleKey: "pipelineDiagTimeoutTitle",
    hintKey: "pipelineDiagTimeoutHint",
  },
  {
    id: "network",
    pattern: /could not resolve host|network is unreachable|connection refused|connection reset|failed to connect|unable to access|no route to host/i,
    titleKey: "pipelineDiagNetworkTitle",
    hintKey: "pipelineDiagNetworkHint",
  },
]

/** 未命中规则时的兜底：仍给出「看真实输出」的建议，而不是空白 */
const UNKNOWN_RULE: DiagnosisRule = {
  id: "unknown",
  pattern: /.*/,
  titleKey: "pipelineDiagUnknownTitle",
  hintKey: "pipelineDiagUnknownHint",
}

/** 诊断结果（已解析成展示文案） */
export interface PipelineDiagnosis {
  id: string
  title: string
  hint: string
}

/**
 * 用真实错误文本匹配诊断规则。
 * 空文本返回 null（没有错误就不该显示诊断）；非空但未命中时返回兜底项。
 */
export function diagnosePipelineFailure(
  text: string | undefined,
  i18n: Record<string, unknown>,
): PipelineDiagnosis | null {
  const detail = text?.trim()
  if (!detail) return null
  const rule = DIAGNOSIS_RULES.find((item) => item.pattern.test(detail)) ?? UNKNOWN_RULE
  const title = i18n[rule.titleKey]
  if (typeof title !== "string" || title.length === 0) return null
  const hint = i18n[rule.hintKey]
  return {
    id: rule.id,
    title,
    hint: typeof hint === "string" && hint.length > 0 ? hint : "",
  }
}
