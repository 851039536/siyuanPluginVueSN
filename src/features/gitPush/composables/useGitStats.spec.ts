// src/features/gitPush/composables/useGitStats.spec.ts — 「需拉取」判据回归测试
//
// 缺陷背景（曾真实发生）：智能视图「需拉取」的命中判据是
//   pushStatuses[id].remotes[*].behind > 0
// 而 behind 只有跑过 loadStatus/checkPushStatus 才有值，且其基准 refs/remotes/*
// 只有 fetch 才会更新。历史实现里 index.vue 的 viewMode watch 只给 needsPush /
// uncommitted 补载数据，漏了 needsPull，导致「刚进面板直接点需拉取」时 pushStatuses
// 为空 → 列表空白。
//
// 本测试锁住两件事：
//   A. behind > 0 的项目必须出现在 needsPullProjects（判据本身正确）；
//   B. behind === 0 / 无 pushStatus 的项目不得误入（避免「空态假阳性」）。
import type { GitProject, ProjectCategory, PushStatusInfo, WorkingTreeInfo } from "../types"
import type { Ref } from "vue"
import {
  describe,
  expect,
  it,
} from "vitest"
import { ref } from "vue"
import { useGitStats } from "./useGitStats"

/** 构造最小项目对象 */
function makeProject(id: string, path = `E:/repos/${id}`): GitProject {
  return {
    id,
    name: id,
    path,
    categoryId: "c1",
    addedAt: 0,
  } as GitProject
}

const CATEGORIES: ProjectCategory[] = [{
  id: "c1",
  name: "分类",
  color: "#000",
  order: 0,
}]

/** 构造一条 pushStatus（仅填本测试关心的字段） */
function makePushStatus(branch: string, remotes: PushStatusInfo["remotes"]): PushStatusInfo {
  return {
    branch,
    remotes,
    needsPush: Object.values(remotes).some((r) => r.ahead > 0),
  }
}

function setup(opts: {
  projects: GitProject[]
  pushStatuses?: Record<string, PushStatusInfo>
}): {
  needsPullProjects: Ref<{ project: GitProject }[]>
  needsPushProjects: Ref<{ project: GitProject }[]>
  uncommittedProjects: Ref<{ project: GitProject }[]>
} {
  const projects = ref(opts.projects)
  const categories = ref(CATEGORIES)
  const pushStatuses = ref<Record<string, PushStatusInfo>>(opts.pushStatuses ?? {})
  const workingTrees = ref<Record<string, WorkingTreeInfo>>({})
  const stats = useGitStats(
    {} as never,
    projects,
    categories,
    pushStatuses,
    workingTrees,
  )
  return {
    needsPullProjects: stats.needsPullProjects as unknown as Ref<{ project: GitProject }[]>,
    needsPushProjects: stats.needsPushProjects as unknown as Ref<{ project: GitProject }[]>,
    uncommittedProjects: stats.uncommittedProjects as unknown as Ref<{ project: GitProject }[]>,
  }
}

describe("useGitStats —— 需拉取判据", () => {
  it("behind > 0 的项目必须进入 needsPullProjects（否则「需拉取」视图永远为空）", () => {
    const { needsPullProjects } = setup({
      projects: [makeProject("p1"), makeProject("p2")],
      pushStatuses: {
        // p1 落后 2 个提交 → 需拉取。注意 remotes 的键是 PLATFORM_META 的平台 key
        // （github/gitee/gitea/cnb），不是 git remote 名（origin/upstream）
        p1: makePushStatus("main", {
          github: { ahead: 0, behind: 2, noUpstream: false, error: "" },
        }),
        // p2 已同步 → 不应出现
        p2: makePushStatus("main", {
          github: { ahead: 0, behind: 0, noUpstream: false, error: "" },
        }),
      },
    })

    expect(needsPullProjects.value.map((i) => i.project.id)).toEqual(["p1"])
    expect(needsPullProjects.value[0].project.name).toBe("p1")
  })

  it("多个平台出现 behind 时逐个记录，且合计正确", () => {
    const { needsPullProjects } = setup({
      projects: [makeProject("p1")],
      pushStatuses: {
        p1: makePushStatus("main", {
          github: { ahead: 0, behind: 3, noUpstream: false, error: "" },
          gitee: { ahead: 0, behind: 1, noUpstream: false, error: "" },
        }),
      },
    })

    const item = needsPullProjects.value[0] as unknown as {
      behindByRemote: { key: string, behind: number }[]
      totalBehind: number
    }
    expect(item.behindByRemote).toHaveLength(2)
    expect(item.totalBehind).toBe(4)
  })

  it("没有 pushStatus（尚未加载/fetch 过）时不得误报需拉取", () => {
    const { needsPullProjects } = setup({
      projects: [makeProject("p1")],
      pushStatuses: {},
    })

    // 这正是「刚进面板直接点需拉取」的历史现象：数据未加载 → 集合为空 → 列表空白。
    // index.vue 已通过 watch(viewMode) 的 ensureNeedsPullData 保证进入前会补载 + fetch；
    // 此处只断言判据本身不产生假阳性。
    expect(needsPullProjects.value).toEqual([])
  })

  it("推送与拉取两个集合互不串味", () => {
    const { needsPullProjects, needsPushProjects } = setup({
      projects: [makeProject("p1"), makeProject("p2")],
      pushStatuses: {
        p1: makePushStatus("main", {
          github: { ahead: 2, behind: 0, noUpstream: false, error: "" },
        }),
        p2: makePushStatus("main", {
          github: { ahead: 0, behind: 1, noUpstream: false, error: "" },
        }),
      },
    })

    expect(needsPushProjects.value.map((i) => i.project.id)).toEqual(["p1"])
    expect(needsPullProjects.value.map((i) => i.project.id)).toEqual(["p2"])
  })
})

describe("useGitStats —— 需推送判据（统一为 hasUnpushedCommits）", () => {
  it("noUpstream 且有本地提交必须进入 needsPushProjects；空仓库（ahead=0）不得误入", () => {
    const { needsPushProjects } = setup({
      projects: [makeProject("p1"), makeProject("p2"), makeProject("p3")],
      pushStatuses: {
        // 远程分支尚未建立，但有本地提交 → 需推送
        p1: makePushStatus("main", {
          github: { ahead: 3, behind: 0, noUpstream: true },
        }),
        // 空仓库：ahead=0，没有任何可推送内容 → 不应出现在待推送列表
        p2: makePushStatus("main", {
          github: { ahead: 0, behind: 0, noUpstream: true },
        }),
        // 已同步 → 不应出现
        p3: makePushStatus("main", {
          github: { ahead: 0, behind: 0, noUpstream: false },
        }),
      },
    })

    expect(needsPushProjects.value.map((i) => i.project.id)).toEqual(["p1"])
  })
})
