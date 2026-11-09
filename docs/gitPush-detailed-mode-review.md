# gitPush 详细模式审查（2026-11-09）

> 审查对象：`src/features/gitPush/` 列表视图的**详细模式**（`cardLayout = "detailed"`，默认布局），
> 重点为 `components/ListView/ProjectCard.vue`、`CardHeader.vue`、`CardHeaderActions.vue`、
> `CardRemotes.vue`、`CardTabs.vue`、`CardActionBar.vue` 与相关 SCSS。
> 基线：`30397072`。方式：静态走查 + 对照 GitHub Desktop / GitHub 仓库页的卡片信息层级；
> **未做真机手测**（几何/视觉类结论需用户回归）。
> 依据：`AGENTS_STYLE.md`（Codex、边框优先）、手风琴审查（`docs/completed/gitPush-accordion-review.md`）的既有决策。

## 一、现状（与结论相关的最小事实）

- 详细模式是默认布局（`composables/useCardLayout.ts:15`、`types/storage.ts:643`）；
  该模式下所有卡片恒展开（`composables/useCardAccordion.ts:55`）。
- 双列网格：`.gp-card { flex: 1 1 calc(50% - 10px); min-width: 390px }`（`styles/index.scss:95-107`），
  容器 `.gp-list` 为 `flex-wrap` + `align-content: flex-start`，未设置 `align-items`（默认 stretch，`:72-93`）。
- 卡片区块顺序：顶栏 → 远程区 → 四个页签 → 冲突区 → **操作栏** → 拉取/推送输出
  （`ProjectCard.vue:19-164`）。
- 详细模式挂载即刷新：`onMounted(syncWorkingTreeOnEnter)`，有变更且用户未切页签就自动跳到「变更」
  （`ProjectCard.vue:337-351`、`:375-376`）。
- 详情（log / branches / stash / tags）懒加载：仅在切页签或点击卡片时发起；当前页签是「变更」时，
  挂载**不**加载详情（`useCardData.ts:288-321`、`ProjectCard.vue:529-535`、`:537-544`）。
- 分支列表为**全量本地分支**（`managers/WorktreeOps.ts:369-377`）；Markdown 徽章与项目标签各自只展示前 3 个
  （`CardHeader.vue:236-258`）。
- 折叠高度：工作区 420px（`styles/WorkingTreePanel.scss:50-56`）、提交日志 160px
  （`styles/BranchCommitList.scss:62-70`）、Stash 120px（`styles/index.scss:191-196`）。

## 二、对照 GitHub 的信息层级差距（只列有行动价值的）

| 习惯 | 当前实现 | 差距 |
|---|---|---|
| 主操作（推送/拉取）在卡片可见区内固定可及 | 操作栏在四个页签内容**之后** | 卡片稍长就要滚动才找到主操作（S3） |
| 列表网格保持等宽列 | `flex-grow: 1` 让奇数尾卡横跨整行 | 最后一张卡宽度与其它卡不一致（S1） |
| 同行卡片按内容自然高度 | 默认 `stretch`，短卡被拉到与最高卡等高 | 卡内底部出现大片空白，页签一换整行高度跳变（S1） |
| 次要元信息可折叠 | md 徽章 / 标签限 3 个，分支**不限** | 分支多的仓库顶栏被撑高（S2） |
| 进入列表只做必要查询 | 详细模式下每张卡挂载都强制重刷状态 | 切分类 = N 个项目各查一轮（S4） |

## 三、问题清单

### P1（建议本轮处理）

**S1 双列网格的两处几何问题**（证据：`styles/index.scss:95-107`）
- ① `flex: 1 1 calc(50% - 10px)` 带 `flex-grow: 1`：奇数个项目时，最后一行只有一张卡，
  会被拉成**整行宽**，与其它卡宽度不一致。
- ② `.gp-list` 未设 `align-items`，默认 `stretch`：同一行里最矮的卡被拉到最高卡的高度，
  多出来的空间留在卡内底部（边框里的空白）；任一张卡切页签改变高度，整行都跟着变。
- 建议：`flex: 0 1 calc(50% - 2px)`（保留 `min-width` 保底）+ 卡片 `align-self: flex-start`
  （或容器 `align-items: flex-start`）。只改两条声明，不动 DOM；手风琴模式不受影响（卡宽恒 100%）。

**S2 分支行全量渲染，无折叠**（证据：`CardHeader.vue:121-147`、`managers/WorktreeOps.ts:369-377`）
- `git branch` 返回全部本地分支，逐个渲染为可点击 chip；同一顶栏里 Markdown 徽章与标签都已限 3 个 + 「+N」。
- 影响：分支多（10+）的仓库，顶栏会多出数行，把页签与操作区整体推低；卡片间高度差也被放大。
- 建议：与 md / tag 同一规则（前 3~4 个 + 「+N」展开），当前分支始终展示；纯前端切片，无新增 git 调用。

**S3 操作栏沉在四个页签之下**（证据：`ProjectCard.vue:37-129` 与 `:131-164`）
- 操作栏（拉取 / 推送 / 强制推送 / 推送全部）与冲突区都在页签内容之后；工作区页签自身可到 420px+，
  双列卡里主操作经常落在首屏之外，且页签切换时按钮位置随之漂移。
- 建议（择一）：
  - 方案 A（推荐，稳定）：把「冲突区 → 操作栏 → 输出面板」整体上移到远程区与页签之间
    （冲突是阻断性信息，也应更靠上）；页签内容仍在其下滚动。
  - 方案 B：保持顺序，给操作栏 `position: sticky; bottom: 0` + 卡片底色；
    但会与卡片自身滚动/边框叠加，Codex 下观感风险更高。
- 成本：仅模板顺序调整，无数据逻辑改动。

**S4 详细模式挂载刷新没有跨项目节流**（证据：`ProjectCard.vue:342-351`、`:375-376`；
`composables/useProjectQueryScheduler.ts:212-216`）
- 详细模式所有卡片恒展开 ⇒ 每次进入分类 / 切回列表 / 切布局，每张可见卡都走一次
  `refreshProjectStatus`（`git status` + ahead/behind）。调度器只做「同项目单飞 + 2s 节流」，
  **不跨项目限流**，最终只靠 git 并发池兜底。
- 影响：以 30 个项目计，每次切分类约 30 个 `git status`（注释里实测单次约 310ms），
  属于「用户没要求的大批量查询」。
- 建议：进入刷新用更大的最小间隔（如 10s；项目数据刚加载过就跳过），手动刷新/切页签仍保持 2s；
  或只对「视口内」卡片刷新（IntersectionObserver，成本略高）。前者一行参数，先做前者。

### P2（可与 P1 同批，或下一批）

| ID | 问题 | 证据 | 建议 |
|---|---|---|---|
| S5 | 当前分支名在两处出现：加载详情前在远程区，加载后移到分支行（点击卡片会看到「跳位」）；分支切换入口在点击前不可见 | `CardRemotes.vue:20-29`、`:39`；`CardHeader.vue:121-147`；`ProjectCard.vue:529-535` | 分支行常驻：先用 `pushStatus.branch` 渲染当前分支（暂不可切换），详情就绪后并入可选分支；远程区不再展示分支名，`branchRowVisible` 可删。 |
| S6 | 详细模式下「有变更就自动跳变更页签」会覆盖会话级页签记忆：在 LOG 读日志 → 切分类再回来，卡被拉回变更 | `ProjectCard.vue:344-350`；`composables/useCardData.ts:8-16` | 详细模式不做自动切页签（卡片本来常开，刷新已解决旧内容）；或每项目每会话只自动切一次。手风琴保留现行为。 |
| S7 | 页签内容高度悬殊（工作区 420 / 日志 160 / Stash 120），切页签时整卡高度突变，双列列表整体跳动 | `WorkingTreePanel.scss:50-56`、`BranchCommitList.scss:62-70`、`index.scss:191-196` | 详细模式给页签内容区统一上限（如 300~360px，内部滚动），或至少把日志的 160px 提到与工作区同一量级。 |
| S8 | 顶栏 6 个常驻图标按钮 + 项目名不省略：双列窄卡（≈390px）下名称换行/被挤，长名更明显 | `CardHeaderActions.vue:4-252`、`CardHeader.scss:17-30`、`:209-214` | 名称 `min-width: 0` + 单行省略 + `title`；窄宽时把「Git 配置 / 删除」等收进「…」菜单（可用现有 `MenuPopover`）。 |
| S9 | 页签上的 LOG 数字是「已加载条数」而非总数：默认上限 200，仓库有上千提交也显示 200 | `CardTabs.vue:20-25`、`utils/format.ts:6` | 达到上限且未选「全部」时显示 `200+`，与「已加载」语义一致。 |
| S10 | 根节点 `@click.capture` 让点击卡内**任意**控件（编辑 / Git 配置 / 删除）也触发 `ensureDetailsLoaded`，一次 4 条 git | `ProjectCard.vue:7`、`:537-544`；`useCardData.ts:288-321` | 只在点击「非交互区域」或首次展开页签时加载；详细模式可改为进入视口后加载一次。 |

### P3（低优先，记录用）

- 卡片根节点没有名称 heading / 区域标签，读屏无法按项目跳转（名称是普通 `span`）。
- `.gp-card:hover` 整卡主色描边，双列多卡时悬停对比偏强（Codex 允许，但可降到 `border-color` 混色）。

## 四、冗余与一致性

| ID | 结论 | 证据 | 处理 |
|---|---|---|---|
| R1 | `CardRemotes.remoteRows` 的 `variant: view.kind ? ... : "success"` 是**不可达兜底**（kind 为空时 label 也为空，Tag 不渲染） | `CardRemotes.vue:80-87`；`usePushStatusView.ts:19` | 与手风琴审查 R2 同款清理：先判空再 map，或删三元兜底 |
| R2 | 路径行硬上限 280px：宽卡（双列 1200px 窗口下约 590px）里路径过早省略，右侧留白 | `CardHeader.scss:137-155` | 改为 `max-width: 100%` 或按卡片宽度自适应；路径是识别项目的关键信息 |
| R3 | `ensureDetailsLoaded` 有三个触发点（挂载、点击捕获、切页签），语义重叠 | `ProjectCard.vue:517-544` | 合并为「页签激活 / 首次进入视口」两类入口，减少「点哪儿都发 4 条 git」的意外 |
| R4 | 挂载刷新 + 切回变更页签各触发一次 `refreshProjectStatus` | `ProjectCard.vue:342-351`、`:517-527` | **不是冗余**：调度器同项目单飞 + 2s 节流收口，保留（同手风琴审查 R4） |

## 五、扩展建议（按性价比）

| ID | 建议 | 价值 | 成本 | 备注 |
|---|---|---|---|---|
| E1 | 「紧凑密度」开关：详细模式下隐藏 md/标签/备注/活动时间行，只留名称 + 分支 + 页签 | 高（信息密度可控） | 低 | 用现有 `cardLayout` 之外再存一个布尔；手风琴不受影响 |
| E2 | 单卡折叠 / 「全部收起」：详细模式允许把单张卡收成手风琴摘要行 | 中（长列表清理已完成项） | 中 | 需要 `expandedId` 从单值扩为集合，或按卡持有布尔；与 Esc 无关 |
| E3 | `.gp-card { content-visibility: auto; contain-intrinsic-size: auto <估高> }`（仅详细模式） | 中（大列表首屏渲染） | 低 | Chromium 已支持；估高不准会有滚动条微跳，需目测 |
| E4 | 列表排序（最近提交 / 变更数 / 名称） | 中 | 中 | 目前只有分类顺序 + 星标置顶；排序键 `lastActivity` / `changesCount` 已在共享层 |

## 六、建议实施顺序

1. **批次 1（低风险、纯收益）**：S1 网格几何、S2 分支折叠、R1 不可达兜底、R2 路径上限。
2. **批次 2（交互/性能）**：S4 进入刷新节流、S3 操作栏/冲突区上移、S5 分支行常驻、S6 详细模式不抢页签。
3. **批次 3（可选）**：S7 页签高度、S9 `200+`、S10 点击加载收敛、E1 / E3。

## 七、验证方式（提交前）

- 代码级：`pnpm typecheck`、`pnpm test`、`pnpm i18n:verify`（若新增文案）、`pnpm validate:icons`（若换图标）。
- 手测清单（需用户执行）：
  - 3 个项目的好处：最后一张卡不再横跨整行；同一行高低不同的卡不再出现卡内底部空白。
  - 分支 10+ 的项目：顶栏最多 3~4 个分支 chip + 「+N」，展开/收起正常，当前分支始终可见。
  - 双列卡内滚到页签区：拉取/推送/推送全部在首屏可及（批次 2 后）。
  - 在 LOG 页签停留 → 切分类 → 回来：仍停在 LOG（批次 2 后），工作区内容仍是最新。
  - 切分类时观察 git 进程数：只在数据过期时刷新（批次 2 后）。
  - 点「编辑」按钮：不再伴随 4 条 git 查询（批次 3 后）。
  - 卡片内切换四个页签：卡片高度变化明显收敛（日志 300 / Stash 220 / 工作区 420）。
  - 顶栏 LOG 徽标在默认 200 条上限下显示 `200+`，切到「全部」后显示真实条数。
  - 长项目名在双列窄卡里单行省略，悬停 tooltip 给完整名称。
  - 工具栏「紧凑密度」开启后：Markdown / 标签 / 备注 / 活动时间行消失，关闭后恢复；重载插件后开关状态保持。

## 八、实施记录（2026-11-09）

批次 1、2、3 已落地；`E2 单卡折叠` 未做（会改变「详细模式 = 全部展开」的既有语义，留待单独确认）。

| ID | 状态 | 落地内容 | 主要文件 |
|---|---|---|---|
| S1 | ✅ | 详细模式改网格：`repeat(auto-fill, minmax(max(390px, calc(50% - 2px)), 1fr))` + `align-items: start`。奇数尾卡不再拉满整行，同行短卡不再被拉伸；< 784px 自动单列铺满 | `components/ListView/index.vue`、`styles/index.scss` |
| S2 | ✅ | 分支行按前 4 个 + 「+N」折叠，当前分支置顶且始终可见；新增 `branchesExpand` / `branchesCollapse` 文案 | `CardHeader.vue`、`styles/CardHeader.scss`、i18n 分片 |
| R1 | ✅ | `CardRemotes` 徽章改为 `badge` 子对象（无文案即 null），删除「kind 为空给 success」的不可达兜底 | `CardRemotes.vue` |
| R2 | ✅ | 路径行 `max-width: 280px` → `100%`，宽卡不再过早省略路径 | `styles/CardHeader.scss` |
| S3 | ✅ | 冲突区 / 操作栏 / 拉取推送输出整体上移到页签之前，主操作不再被长页签内容推到首屏外 | `ProjectCard.vue` |
| S4 | ✅ | 进入刷新支持 `minIntervalMs`：卡片挂载传 10s，手动刷新与切回页签仍为 2s | `ProjectCard.vue`、`composables/useGitOps.ts`、`types/cardServices.ts` |
| S5 | ✅ | 分支行常驻：当前分支先用 `pushStatus.branch` 渲染，分支列表就绪后补上可切换项；远程区删除重复分支名与 `branchRowVisible` | `CardHeader.vue`、`CardRemotes.vue`、`ProjectCard.vue` |
| S6 | ✅ | 自动跳「变更」页签只在手风琴展开时执行；详细模式保留会话级页签记忆 | `ProjectCard.vue` |
| S7 | ✅ | 页签列表高度收敛到同一量级：提交日志 160→300px、Stash 120→220px（工作区仍 420px），切页签时卡片高度不再突变 | `styles/BranchCommitList.scss`、`styles/index.scss` |
| S8 | ◐ | 长项目名单行省略 + tooltip（`flex: 1 1 auto` + ellipsis）；顶栏按钮收进「…」未做（保持常驻可见，避免隐藏高频操作） | `CardHeader.vue`、`styles/CardHeader.scss` |
| S9 | ✅ | LOG 徽标达到抓取上限（未选「全部」）时显示 `N+`，不再把已加载数误当总数 | `CardTabs.vue`、`ProjectCard.vue` |
| S10 | ✅ | 点击交互控件（按钮 / 输入框 / 菜单项 / 页签 / role=button）只补项目状态，不再顺带触发 4 条 git 的详情加载；空白处点击仍按需加载 | `ProjectCard.vue` |
| E1 | ✅ | 工具栏「紧凑密度」开关：隐藏 Markdown / 标签 / 备注 / 活动时间；新增持久化槽 `git-push-card-compact` 与存储注册表条目 | `useCardCompact.ts`、`ListViewToolbar.vue`、`types/storage.ts`、`config/storage/jsonSlots.ts`、`styles/ListView.scss` |
| E3 | — | **不做**：卡内弹窗（`Dialog` 系）为就地 `position: fixed`，`content-visibility` 跳过时的 `contain: layout` 会成为 fixed 后代的包含块，卡片滚出视口后弹窗会被裁切/错位 | — |
| E2 | — | 单卡折叠未做：需要把「详细模式恒展开」改为可收起集合，属语义变更，留待确认 | — |
| E4 | — | 列表排序未做 | — |
| R3 / R4 | — | 维持不改：详情加载的页签触发属既有懒加载设计；刷新双触发由调度器单飞 + 节流收口 | — |

验证：`pnpm typecheck`、`pnpm test`（71 文件 / 1128 项）、`pnpm i18n:verify`、`pnpm i18n:merge`、
`pnpm validate:icons`（新增 `viewCompact`）、`pnpm audit:storage`（新增 `gitPush.cardCompact`）均通过。
**未做浏览器/真机手测**（按协作约定由用户执行 §七 清单）。
