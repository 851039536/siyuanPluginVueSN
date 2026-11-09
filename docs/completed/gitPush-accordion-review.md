# gitPush 手风琴模式审查（2026-11-09）

> **归档说明（2026-11-09）**：审查项批次 1–2 与扩展 E1 / E3 / E4 / E5 / B6 / B7 已全部落地
> （见 §八实施记录）；E6 折叠动画与 Esc 收起明确不做。本文保留为交互决策依据，不再更新。

> 审查对象：`src/features/gitPush/` 列表视图的卡片布局（详细 / 手风琴），重点为
> `components/ListView/CardSummary.vue`、`ProjectCard.vue`、`composables/useCardAccordion.ts`、
> `ListViewToolbar.vue` 与相关 SCSS。
> 基线：`32afd68e`（工作区另含 2026-11-09 的「展开刷新 + 自动切回变更页签」改动）。
> 方式：静态走查 + 对照 GitHub 仓库列表 / GitHub Desktop 的行式交互；**未做真机手测**（交互类结论需用户回归）。
> 依据：`AGENTS_STYLE.md`（Codex / 移动端密度）、`.qoder` 协作记忆「移除/审查先出文档」。
> **实施状态（2026-11-09）**：批次 1、2 与扩展 E1 / E3 / E4 / E5 / B6 / B7 已落地（明细见 §八）；
> E6（折叠动画）与 Esc 收起明确不做。

## 一、现状（与审查结论相关的最小事实）

- 收起态只渲染 `CardSummary`，展开态才挂载 `CardHeader / CardTabs / 冲突区 / 操作栏`
  （`ProjectCard.vue:9-13`、`:33-40`）——性能上是对的，但带来「折叠即卸载」的副作用（见 A3）。
- 摘要行内容：展开按钮、项目名、归档角标、当前分支、变更数、冲突标签、各远程同步状态、「推送全部」
  （`CardSummary.vue:2-85`）。数据全部来自共享 services，无额外 git 调用。
- 展开状态由 ListView 提供的 `expandedId` 单值持有（`useCardAccordion.ts:21-35`），一次只展开一张。
- 本次刚落地：手风琴展开 / 详细模式挂载时 `refreshProjectStatus`，有变更则自动落到「变更」页签
  （`ProjectCard.vue:323-338`）。
- 已有「有变更」智能视图（`ListViewToolbar.vue:11-24`，数据源 `useGitStats.ts` 的 `uncommitted`），
  但默认「全部」视图里的可扫性仍取决于摘要行本身。

## 二、对照 GitHub 的差距（只列有行动价值的）

| GitHub 行式列表习惯 | 当前实现 | 差距 |
|---|---|---|
| 仓库/文件行整行一条，占满容器宽度 | `.gp-card` 仍按 `calc(50% - 10px)` 双列排布 | 宽面板下两张摘要并排，扫描路径变成“Z 字”，点击目标也被压窄（A1） |
| 整行可点 + 可见焦点环 + Enter/Space | 整行是 `div@click`，只有 20px 箭头按钮可聚焦 | 键盘用户无法在行间移动/展开（A2） |
| 行内主信息（名称）优先，次要信息可截断/收起 | 名称 `max-width: 42%`、分支 `26%`，其余 `flex-shrink: 0` | 窄宽 + 多远程时容易溢出（B2） |
| 变更/同步状态用语义色 chip 突出 | 变更数是 10px、`opacity: 0.6` 的灰字 | 最需要被看见的信号视觉权重最低（B1） |
| 行内展示“最近更新 / 最近提交” | 摘要不展示时间，展开后才有 `lastActivity` | 少了一个高价值的排序/扫读线索（E1） |

## 三、问题清单

### P1（建议本轮处理）

**A1 手风琴仍是双列网格**
- 证据：`styles/index.scss:95-107`（`.gp-card { flex: 1 1 calc(50% - 10px); min-width: 390px }`）；
  `ListView/index.vue:72-97` 的 `.gp-list` 没有任何布局修饰类。
- 影响：面板较宽时收起行两两并排，既不像 GitHub 的行式列表，也让「一次只展开一张」的纵向节奏被打断。
- 建议：ListView 按 `cardLayout` 加修饰类（如 `.gp-list--accordion`），仅手风琴下
  `.gp-card { flex-basis: 100% }`；详细模式保持双列。改动只在样式 + 一个 class 绑定。

**A2 摘要行只有鼠标可操作**
- 证据：`CardSummary.vue:3-18`（`div@gp-summary` + `div@click="expand"`；唯一可聚焦元素是 dense 箭头按钮）。
- 影响：键盘用户 Tab 到箭头才能展开；行本身既无 `role`/`tabindex`，也无 Enter/Space，且没有整行焦点环。
- 建议：把「名称 + 元信息」区域做成真正的 `<button>`（`flex: 1; min-width: 0; text-align: left`），
  右侧操作区保持独立并在点击时 `stop`；这样既保留整行可点，又不会出现“按钮里套按钮”。
  顺带给按钮补 `aria-controls` 指向详情容器 id（R5）。

**A3 折叠会丢未提交的提交信息草稿**
- 证据：`WorkingTreePanel.vue:420` 的 `commitMessage` 是组件本地 `ref`；
  `ProjectCard.vue:34-35` 用 `v-if="!collapsed"` 挂载 `CardTabs`。
- 影响：手风琴下切换展开项目（或切分类/切视图）时面板卸载，写到一半的提交信息直接丢失。
  详细模式下切分类也会丢，但手风琴让这个动作高频得多。
- 建议：把草稿按 `projectId` 提升到 `shared`（与 `commitTemplates` 同层）或 session 级 Record，
  `WorkingTreePanel` 改为读写该槽；提交成功后清空。不要为此保活整个面板（代价是 N 个面板常驻）。

### P2（可与 P1 同批或下一批）

| ID | 问题 | 证据 | 建议 |
|---|---|---|---|
| B1 | 变更数视觉权重最低（10px、`opacity .6`、灰色） | `CardSummary.vue:44-54`、`:110-114` | 改成语义色小巧徽章（warning/primary），tooltip 拆成「暂存 n / 未暂存 n / 未跟踪 n」，与展开态 Tab 徽标同口径 |
| B2 | 窄宽溢出风险：名称 42% + 分支 26% + 变更/冲突 + 最多 4 个远程徽章 + 推送按钮，全部不收缩、不换行 | `CardSummary.scss:29-80`；`CardRemotes` 的远程上限见 `types/meta.ts` 的 `REMOTES` | 名称改为 `flex: 1 1 auto` 优先；窄宽下远程只保留「异常态」（ahead/behind/diverged）图标，正常态隐藏；必要时允许远程区换行 |
| B3 | 远程徽章符号不统一：ahead/noUpstream 用 `+N`，behind/diverged 用 `↑N/↓N`，同一行混排 | `usePushStatusView.ts:20-38` | 统一为 `↑N/↓N`（noUpstream 也走 `↑N`，tooltip 说明「首次推送」）。注意展开态 `CardRemotes` 共用该派生，需同批回归 |
| B4 | 搜索命中词只在展开态项目名高亮，收起行不高亮 | `CardHeader.vue:232-233` 用 `highlightSegments`；`CardSummary.vue:20-23` 直接渲染 `project.name` | 收起行复用 `highlightSegments`（纯函数，零新逻辑） |
| B5 | 布局切换按钮开/关用同一图标，仅 `title` 文案变化；箭头按钮 `opacity: 0.4` 也偏低 | `ListViewToolbar.vue:53-62`；`CardSummary.scss:21-27` | 开/关用不同图标（或 `on-label/off-label`），箭头常态透明度提到 ~0.5；圆角/尺寸不变 |
| B6 | 展开项不持久：切到统计/日志/分析再回列表，`expandedId` 随 ListView 卸载重置 | `useCardAccordion.ts:21-35`；`index.vue:129-130`（`v-if`） | 只是“可选体验”：如需要，按分类持久化一个 `expandedId`；不持久也符合“每次回来先看变更”的当前默认 |
| B7 | 摘要行高约 32px（6+6 padding + 20px 控件），无 `(pointer: coarse)` 命中区兜底 | `CardSummary.scss:6-9`；gitPush 样式内 grep 无 `pointer: coarse` | gitPush 是 `DESKTOP_ONLY_FEATURE_IDS`（`features/config.ts:383-395`），优先级低；若要支持触屏笔记本，按 AGENTS_STYLE 用 40px 伪元素命中区 |

## 四、冗余与死代码（可直接修）

| ID | 结论 | 证据 | 处理 |
|---|---|---|---|
| R1 | `changesCount` 同一公式在两处重复 | `ProjectCard.vue:317-321`、`CardSummary.vue:110-114` | 收敛为 `useCardServices` 返回的 `computed`（两处消费同一份；后续工具栏/统计也能复用） |
| R2 | `remoteRows` 的 `variant: view.kind ? ... : "success"` 是**不可达兜底**（随后 `.filter(kind !== "")`） | `CardSummary.vue:121-135` | 先 `filter` 再 `map`，或删掉三元兜底；行为不变 |
| R3 | 摘要与展开态的远程投影各写一遍（`REMOTES.filter → remoteView`） | `CardSummary.vue:121-135`、`CardRemotes.vue:76-90` | 2 处未达 Rule of Three，**暂不抽**；若出现第 3 个消费方再抽 `buildRemoteSyncRows()` |
| R4 | 展开时看似有 3 次状态触发：卡片点击 `ensure` + 进入刷新 `refresh` + 切回 worktree 的 `refresh` | `ProjectCard.vue:476-483`、`:323-338`、`:456-466` | **不是冗余**：调度器按 query key 单飞 + `refresh` 2s 节流（`useProjectQueryScheduler.ts:79-108`、`:212-216`）。保留 `ensure`（详细模式点击仍依赖），不要为“少一次调用”删触发点 |
| R5 | 摘要箭头按钮缺 `aria-controls`，`aria-expanded` 为静态 `false`（收起态语义正确） | `CardSummary.vue:8-18` | 给详情容器加稳定 id，箭头补 `aria-controls`；若按 A2 改整行按钮，则一并挂在主按钮上 |

## 五、扩展建议（按性价比排序）

| ID | 建议 | 价值 | 成本 | 备注 |
|---|---|---|---|---|
| E1 | 摘要补「最近提交相对时间 + 提交消息截断」 | 高（GitHub 仓库行的 Updated 位） | 中 | 时间可先用 `project.lastActivity`（`CardHeader.vue:67-79` 已在用）；消息需懒加载首条 log，建议仅在展开/悬停时补，避免 N 次 git |
| E2 | 行级键盘导航：↑/↓ 在摘要间移动、Enter 展开、Esc 收起 | 高（可达性） | 低 | 在 `useCardAccordion` 上扩 `expandedId` + roving tabindex；与 A2 同批做最省 |
| E3 | 与「有变更」智能视图联动：切到该视图时自动展开第一项 | 中 | 低 | 复用现有 `uncommitted` 数据源，不改数据层 |
| E4 | 摘要补 stash/tag 计数（或仅异常红点） | 中低 | 低 | 信息密度已偏高，建议只显示 stash>0 与冲突（冲突已有） |
| E5 | 展开时 `scrollIntoView({ block: "nearest" })` 保证整卡可见 | 中低 | 低 | 当前刷新流程已不滚动；大列表下能减少“展开后详情在视口外”的困惑 |
| E6 | 折叠高度动画 0.12s | 低 | 中 | 高度动画会与滚动位置打架，Codex 也允许瞬时切换；不建议优先做 |

## 六、建议实施顺序

1. **批次 1（低风险、纯收益）**：A1 单列布局、R1 收敛 `changesCount`、R2 死分支、B3 符号统一、B4 搜索高亮、R5 `aria-controls`。
2. **批次 2（交互/信息）**：A2 整行可聚焦按钮 + E2 键盘导航、B1 变更徽章视觉、B2 窄宽收缩、A3 草稿保留。
3. **批次 3（可选扩展）**：E1 最近提交、E3 智能视图联动、B6 展开项持久化。

## 七、验证方式（提交前）

- 代码级：`pnpm typecheck`、`pnpm test`、`pnpm i18n:verify`（若新增文案）、`pnpm validate:icons`（若换图标）。
- 手测清单（需用户执行，含真机）：
  - 宽面板切手风琴：摘要应为整行单列；详细模式仍双列。
  - 键盘：Tab 到摘要行 → Enter 展开 → Esc/收起按钮收回；可见焦点环。
  - 窄宽（约 390px）+ 4 远程 + 冲突：摘要不横向溢出。
  - 在卡片 A 写一半提交信息 → 展开卡片 B → 回到 A：草稿仍在（A3 修完后）。
  - 外部编辑器改文件 → 展开项目：自动落在「变更」且内容为最新（本次已实现，回归即可）。
  - 搜索词命中项目名：收起行同样高亮（B4 修完后）。

## 八、实施记录（2026-11-09）

| ID | 状态 | 落地内容 | 主要文件 |
|---|---|---|---|
| A1 | ✅ | 手风琴下 `.gp-list--accordion .gp-card { flex: 1 1 100% }`，摘要整行铺满；详细模式仍双列 | `components/ListView/index.vue`、`styles/index.scss` |
| A2 | ✅ | 摘要改为「行容器点击 + 左侧名称按钮」：Enter/Space 原生展开，↑↓ 在同一列表摘要间移动；展开后焦点交给「收起」按钮 | `CardSummary.vue`、`ProjectCard.vue` |
| A3 | ✅ | 提交信息草稿提升为 `shared.commitDrafts`（会话内存，按项目 id）；面板改用 `v-model:draft`，折叠/切分类不丢 | `types/cardServices.ts`、`index.vue`、`ProjectCard.vue`、`WorkingTreePanel.vue` |
| B1 | ✅ | 变更数改为 `Tag variant="warning"`，tooltip 拆分「已暂存 / 未暂存 / 未跟踪」；新增 IconKey `fileDocumentMultipleOutline` | `CardSummary.vue`、`components/kit/icons.ts` |
| B2 | ✅ | 摘要只显示 ahead / behind / diverged 远程（正常同步留给展开态）；分支文本层省略号；名称宽度上限 42% | `CardSummary.vue`、`CardSummary.scss` |
| B3 | ✅ | noUpstream 徽章 `+N` → `↑N`，与 ahead/behind 同符号口径（含单测与注释） | `usePushStatusView.ts`、`usePushStatusView.spec.ts`、`aheadBehind.git.spec.ts` |
| B4 | ✅ | 收起行复用 `highlightSegments`，搜索命中同样高亮 | `CardSummary.vue`、`CardSummary.scss` |
| B5 | ✅ | 布局切换关闭态图标改 `layoutGrid`；箭头常态透明度 0.4 → 0.45 | `ListViewToolbar.vue`、`CardSummary.scss` |
| R1 | ✅ | `changesCount` 收敛到 `useCardServices`，ProjectCard / CardSummary 共用 | `useCardServices.ts`、`ProjectCard.vue`、`CardSummary.vue` |
| R2 | ✅ | `remoteRows` 改 `flatMap`，删除不可达 `variant` 兜底 | `CardSummary.vue` |
| R5 | ◐ | **未采用 `aria-controls`**：详情区由多个兄弟节点组成，需重构根结构才有一个容器；改为「展开后焦点交给收起按钮」达成同等键盘连续性 | `ProjectCard.vue` |
| R4 | — | 维持不改：三层状态触发由调度器单飞 + 2s 节流收口（见 §四） | — |
| E1 | ✅ | 摘要补「最近提交相对时间」（`lastActivity`，零额外 git）；消息仅在日志已缓存时展示首行并截断，tooltip 给完整时间 + 消息 | `ProjectCard.vue`、`CardSummary.vue`、`CardSummary.scss` |
| E3 | ✅ | 切到「有变更」视图（或数据就绪 / 切入手风琴）自动展开首个命中项目；每轮只展开一次，不覆盖用户后续选择 | `components/ListView/index.vue` |
| E4 | ✅ | 摘要展示已缓存的 Stash 数（>0 时才出现，不额外起 git） | `ProjectCard.vue`、`CardSummary.vue` |
| E5 | ✅ | 展开后 `scrollIntoView({ block: "nearest" })`，详情不再落在视口外 | `ProjectCard.vue` |
| B6 | ✅ | 展开项改为会话级记忆（`sessionExpandedId`），切统计/日志/分析再回列表时恢复；不落盘 | `useCardAccordion.ts` |
| B7 | ✅ | `(pointer: coarse) and (hover: none)` 下用伪元素把摘要命中区补到约 40px，视觉高度不变 | `CardSummary.scss` |
| E2 | ◐ | 键盘导航已做（Enter/Space、↑↓、展开后焦点接力）；按用户要求**不做 Esc 收起** | `CardSummary.vue`、`ProjectCard.vue` |
| E6 | — | 明确不做：折叠高度动画与滚动位置相互干扰，Codex 允许瞬时切换 | — |

验证：`pnpm typecheck`、`pnpm test`（1128 项）、`pnpm i18n:verify`、`pnpm validate:icons` 均通过。
**未做浏览器/真机手测**（按协作约定由用户执行 §七 清单）。

剩余待办：无（E6 与 Esc 收起按约定不做）。
