import { describe, expect, it } from "vitest"
import zhCN from "../../../i18n/zh_CN.json"
import type { PipelineStageKey } from "../types/pipeline"
import { PIPELINE_STAGE_LABEL_KEY } from "./opPipeline"
import { resolveStageDoc, STAGE_DOC_KEYS } from "./stageDocs"

const I18N = zhCN.gitPush as Record<string, string>

describe("stageDocs", () => {
  it("每个阶段都有教学卡，且必填说明存在", () => {
    const stages = Object.keys(PIPELINE_STAGE_LABEL_KEY) as PipelineStageKey[]
    for (const key of stages) {
      expect(STAGE_DOC_KEYS[key], key).toBeTruthy()
      const doc = resolveStageDoc(key, I18N)
      expect(doc, key).toBeTruthy()
      expect(doc!.what.length).toBeGreaterThan(0)
    }
  })

  it("命令与常见问题的文案键都能解析出内容", () => {
    for (const keys of Object.values(STAGE_DOC_KEYS)) {
      if (keys.cmd) expect(I18N[keys.cmd], keys.cmd).toBeTruthy()
      if (keys.pitfall) expect(I18N[keys.pitfall], keys.pitfall).toBeTruthy()
    }
  })

  it("必填说明缺失时整块隐藏，而不是返回半张卡片", () => {
    expect(resolveStageDoc("prepare", {})).toBeNull()
  })

  it("可选内容缺失时只隐藏对应行", () => {
    const doc = resolveStageDoc("prepare", I18N)
    expect(doc?.cmd).toBeUndefined()
    expect(doc?.pitfall).toBeTruthy()
  })
})
