// gitPush 提交规则纯函数单元测试
//
// 重点钉死"AI 生成 → 规则校验"这条链路的一致性：
// 1) prompt 必须覆盖校验中会判违规的规则（尤其默认开启的"首字母大写"，历史上被漏下发）；
// 2) 规范化必须按当前规则开关处理 scope（关闭时不得把中文 scope 改写成 "----"）；
// 3) AI 常见的包裹/换行/空行细节应被确定性修复，而不是整条丢弃。
import { describe, expect, it } from "vitest"
import {
  buildCommitRulePrompt,
  checkCommitRule,
  fixCommitMessageHeuristically,
  normalizeCommitMessageFormat,
} from "./commitRuleChecker"
import { DEFAULT_COMMIT_RULE_CONFIG } from "./types/meta"

const DEFAULT = { ...DEFAULT_COMMIT_RULE_CONFIG }

describe("buildCommitRulePrompt", () => {
  it("默认配置下发最短字数、首字母大写、正文行长规则", () => {
    const prompt = buildCommitRulePrompt(DEFAULT)
    expect(prompt).toContain("描述不少于 10 个字")
    expect(prompt).toContain("不要以小写英文字母开头")
    expect(prompt).toContain("每行不超过 72 个字符")
    // scope 格式校验默认关闭，不应下发字符集约束
    expect(prompt).not.toContain("scope（可选）")
  })

  it("开关关闭的规则不下发，开启的规则下发", () => {
    const prompt = buildCommitRulePrompt({
      ...DEFAULT,
      requireCapitalizedSubject: false,
      scopeFormatEnabled: true,
      bodyLineLimitEnabled: false,
    })
    expect(prompt).not.toContain("不要以小写英文字母开头")
    expect(prompt).toContain("scope（可选）")
    expect(prompt).not.toContain("每行不超过")
  })

  it("下发用户配置的最短字数而非默认值", () => {
    expect(buildCommitRulePrompt({ ...DEFAULT, minSubjectLength: 20 })).toContain("描述不少于 20 个字")
  })
})

describe("normalizeCommitMessageFormat", () => {
  it("首字母大写规则开启时修正小写英文开头（校验口径与 prompt 同步）", () => {
    const out = normalizeCommitMessageFormat("feat: update README 说明文档", DEFAULT)
    expect(out).toBe("feat: Update README 说明文档")
    expect(checkCommitRule(out, DEFAULT)).toBeNull()
  })

  it("首字母大写规则关闭时保留原描述", () => {
    const config = { ...DEFAULT, requireCapitalizedSubject: false }
    expect(normalizeCommitMessageFormat("feat: update README 说明文档", config))
      .toBe("feat: update README 说明文档")
  })

  it("scope 格式规则关闭时保留原 scope（不得改写成短横线）", () => {
    const out = normalizeCommitMessageFormat("feat(用户模块): 修复登录接口异常问题", DEFAULT)
    expect(out).toBe("feat(用户模块): 修复登录接口异常问题")
    expect(checkCommitRule(out, DEFAULT)).toBeNull()
  })

  it("scope 格式规则开启时规范化为小写连字符", () => {
    const config = { ...DEFAULT, scopeFormatEnabled: true }
    const out = normalizeCommitMessageFormat("feat(User_Module): 修复登录接口异常问题", config)
    expect(out).toBe("feat(user-module): 修复登录接口异常问题")
    expect(checkCommitRule(out, config)).toBeNull()
  })

  it("scope 格式规则开启且 scope 无法转换（全中文）时省略该 scope", () => {
    const config = { ...DEFAULT, scopeFormatEnabled: true }
    expect(normalizeCommitMessageFormat("feat(用户模块): 修复登录接口异常问题", config))
      .toBe("feat: 修复登录接口异常问题")
  })

  it("剥离 AI 偶发输出的 Markdown 代码块与成对引号", () => {
    expect(normalizeCommitMessageFormat("```git\nfeat: 修复登录接口异常问题\n```", DEFAULT))
      .toBe("feat: 修复登录接口异常问题")
    expect(normalizeCommitMessageFormat("\"feat: 修复登录接口异常问题\"", DEFAULT))
      .toBe("feat: 修复登录接口异常问题")
  })

  it("标题与正文缺失空行时确定性补齐", () => {
    const out = normalizeCommitMessageFormat("feat: 修复登录接口异常问题\n- 要点一", DEFAULT)
    expect(out).toBe("feat: 修复登录接口异常问题\n\n- 要点一")
    expect(checkCommitRule(out, DEFAULT)).toBeNull()
  })

  it("CRLF 换行归一化为 LF", () => {
    expect(normalizeCommitMessageFormat("feat: 修复登录接口异常问题\r\n\r\n- 要点一", DEFAULT))
      .toBe("feat: 修复登录接口异常问题\n\n- 要点一")
  })

  it("正文行长超限时保留合规标题行（不整条丢弃）", () => {
    const longLine = `- ${"要点".repeat(60)}`
    const out = normalizeCommitMessageFormat(`feat: 修复登录接口异常问题\n\n${longLine}`, DEFAULT)
    expect(out).toBe("feat: 修复登录接口异常问题")
  })

  it("无法自动修正的违规仍返回空串（交回调用方降级）", () => {
    // WIP 描述：规范化无法判定删除后语义是否完整
    expect(normalizeCommitMessageFormat("feat: wip 修复登录接口异常问题", DEFAULT)).toBe("")
    // 非中文描述
    expect(normalizeCommitMessageFormat("feat: fix login crash issue", DEFAULT)).toBe("")
  })
})

describe("fixCommitMessageHeuristically", () => {
  it("缺少 type 时按描述关键词推断并补全", () => {
    expect(fixCommitMessageHeuristically("更新了登录接口相关逻辑", DEFAULT))
      .toBe("chore: 更新了登录接口相关逻辑")
    expect(fixCommitMessageHeuristically("修复登录接口异常问题", DEFAULT))
      .toBe("fix: 修复登录接口异常问题")
  })

  it("非法 type / 纯英文描述返回空串", () => {
    expect(fixCommitMessageHeuristically("perf: 修复登录接口异常问题", DEFAULT)).toBe("")
    expect(fixCommitMessageHeuristically("update README docs", DEFAULT)).toBe("")
  })

  it("原多行信息合规时保留正文，缺空行时补齐", () => {
    expect(fixCommitMessageHeuristically("feat: 修复登录接口异常问题\n\n- 要点一", DEFAULT))
      .toBe("feat: 修复登录接口异常问题\n\n- 要点一")
    expect(fixCommitMessageHeuristically("feat: 修复登录接口异常问题\n- 要点一", DEFAULT))
      .toBe("feat: 修复登录接口异常问题\n\n- 要点一")
  })

  it("启发式结果始终通过当前规则校验", () => {
    const inputs = [
      "更新了登录接口相关逻辑。",
      "feat(User_Module): 修复登录接口异常问题",
      "feat: update README 说明文档",
    ]
    for (const input of inputs) {
      const fixed = fixCommitMessageHeuristically(input, { ...DEFAULT, scopeFormatEnabled: true })
      expect(checkCommitRule(fixed, { ...DEFAULT, scopeFormatEnabled: true }), `输入：${input}`).toBeNull()
    }
  })
})
