// usePushStatusView 派生判据回归测试：状态分类优先级、徽章文案与推送判定
//
// 背景：卡片徽章曾以 `gp-*` CSS 类作为中间产物（类名再映射回 Tag variant），
// 现统一为 RemoteSyncKind 语义分类。本测试锁住三件事：
//   A. 分叉（既领先又落后）优先于纯 ahead，避免配色被 ahead 抢先；
//   B. noUpstream（从未推送）视为 ahead，即使 ahead 计数为 0；
//   C. 无状态时分类为空串、文案为空、needsPushFor 放行点击。
import type { PushStatusInfo } from "../types/storage"
import {
  describe,
  expect,
  it,
} from "vitest"
import { ref } from "vue"
import { usePushStatusView } from "./usePushStatusView"

function makeStatus(remotes: PushStatusInfo["remotes"]): PushStatusInfo {
  return { branch: "main", remotes, needsPush: false }
}

function setup(remotes: PushStatusInfo["remotes"]) {
  return usePushStatusView(ref({ p1: makeStatus(remotes) }))
}

describe("usePushStatusView —— 状态分类与判定", () => {
  it("分叉优先于 ahead，文案同时展示上下行数量", () => {
    const view = setup({
      github: { ahead: 2, behind: 3, noUpstream: false },
    })

    expect(view.statusKind("p1", "github")).toBe("diverged")
    expect(view.statusLabel("p1", "github")).toBe("↑2 ↓3")
    expect(view.needsPushFor("p1", "github")).toBe(true)
  })

  it("noUpstream 且有本地提交视为待推送；空仓库不显示徽章但仍允许尝试", () => {
    const view = setup({
      github: { ahead: 4, behind: 0, noUpstream: true },
      gitee: { ahead: 0, behind: 0, noUpstream: true },
    })

    expect(view.statusKind("p1", "github")).toBe("ahead")
    expect(view.statusLabel("p1", "github")).toBe("+4")
    // 空仓库：没有可推送的提交，不进入 ahead 分类、不显示 +0 徽章
    expect(view.statusKind("p1", "gitee")).toBe("synced")
    expect(view.statusLabel("p1", "gitee")).toBe("")
    // 但单平台仍放行尝试（远程分支尚未建立）
    expect(view.needsPushFor("p1", "gitee")).toBe(true)
  })

  it("落后、已同步与无状态的边界", () => {
    const view = setup({
      github: { ahead: 0, behind: 2, noUpstream: false },
      gitee: { ahead: 0, behind: 0, noUpstream: false },
    })

    expect(view.statusKind("p1", "github")).toBe("behind")
    expect(view.needsPushFor("p1", "github")).toBe(false)
    expect(view.statusKind("p1", "gitee")).toBe("synced")
    expect(view.statusLabel("p1", "gitee")).toBe("")
    // 尚未检测（无条目）：分类/文案为空，但允许点击推送
    expect(view.statusKind("p1", "cnb")).toBe("")
    expect(view.statusLabel("p1", "cnb")).toBe("")
    expect(view.needsPushFor("p1", "cnb")).toBe(true)
  })
})
