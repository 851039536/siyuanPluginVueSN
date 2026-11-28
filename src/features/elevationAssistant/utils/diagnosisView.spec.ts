import type { PermissionDiagnosis } from "../types"
import {
  describe,
  expect,
  it,
} from "vitest"
import { presentDiagnosis } from "./diagnosisView"

const i18n: Record<string, string> = {
  required: "必须管理员",
  recommended: "建议管理员",
  notRequired: "无需管理员",
  manifestUnknown: "无法判断",
  targetMissing: "目标文件已不存在",
  diagnosisFailed: "无法检测",
  reasonRequireAdministrator: "require",
  reasonHighestAvailable: "highest",
  reasonAsInvoker: "asInvoker",
  reasonUiAccess: "uiAccess",
  reasonManifestMissing: "missing",
  reasonUnsupportedFile: "only exe",
  reasonReadError: "readError",
  reasonParseError: "parseError",
  reasonTargetMissing: "targetMissing",
}

function makeDiagnosis(partial: Partial<PermissionDiagnosis>): PermissionDiagnosis {
  return {
    checkedAt: 0,
    exists: true,
    kind: "exe",
    arch: "x64",
    size: 1024,
    manifestSource: "embedded",
    manifestLevel: "asInvoker",
    uiAccess: false,
    requiresAdmin: false,
    recommendedElevate: false,
    recommendation: "notRequired",
    reasonCode: "manifestAsInvoker",
    ...partial,
  }
}

describe("presentDiagnosis", () => {
  it("结论以 recommendation 为准，不按 manifestLevel 推导", () => {
    // uiAccess + asInvoker：recommendation 为 recommended，标签必须是「建议管理员」
    const view = presentDiagnosis(makeDiagnosis({
      manifestLevel: "asInvoker",
      uiAccess: true,
      recommendedElevate: true,
      recommendation: "recommended",
      reasonCode: "manifestUiAccess",
    }), i18n)
    expect(view.label).toBe("建议管理员")
    expect(view.variant).toBe("warning")
    expect(view.icon).toBe("shield")
    expect(view.reason).toBe("uiAccess")
  })

  it("requireAdministrator 为危险色", () => {
    const view = presentDiagnosis(makeDiagnosis({
      manifestLevel: "requireAdministrator",
      requiresAdmin: true,
      recommendedElevate: true,
      recommendation: "required",
      reasonCode: "manifestRequireAdministrator",
    }), i18n)
    expect(view.variant).toBe("danger")
    expect(view.label).toBe("必须管理员")
  })

  it("非 exe 文件映射到“仅支持 .exe”", () => {
    const view = presentDiagnosis(makeDiagnosis({
      kind: "other",
      manifestSource: "unreadable",
      manifestLevel: "unknown",
      recommendation: "unknown",
      reasonCode: "unsupportedFile",
    }), i18n)
    expect(view.reason).toBe("only exe")
  })

  it("目标不存在与读取失败给出独立文案", () => {
    expect(presentDiagnosis(makeDiagnosis({
      kind: "missing",
      exists: false,
    }), i18n).label)
      .toBe("目标文件已不存在")
    expect(presentDiagnosis(makeDiagnosis({ kind: "error" }), i18n).reason).toBe("readError")
  })

  it("空诊断返回未知态", () => {
    const view = presentDiagnosis(null, i18n)
    expect(view.label).toBe("无法判断")
    expect(view.variant).toBe("default")
  })
})
