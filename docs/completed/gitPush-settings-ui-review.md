# gitPush 设置弹窗 UI 审查

> **归档说明（2026-11-09）**：审查项已全部实施（P1/P2/P3 + 组件拆分），`pnpm typecheck` / `pnpm test` / `pnpm i18n:verify` 通过；真机 UI 回归由用户按 §6 执行。后续如调整保存模型或分组，重新起文档。

> **日期**：2026-11-09
> **基线**：`186e4058`（工作区干净）
> **对象**：`src/features/gitPush/components/common/SettingsDialog.vue`（888 行）、`GitConfigSection.vue`、`PushProfilesSection.vue`、`components/CommitAnalysis/AnalysisSettingsForm.vue`、`styles/SettingsDialog.scss`、`styles/index.scss`（`.gp-set-*`）
> **方式**：静态走查（未做真机渲染验证；尺寸与高度为按样式的估算）
> **状态**：待确认。确认后再按 §5 分阶段实施

## 1. 结论摘要

设置弹窗**结构可用**，问题集中在「常规」分区：

- 16 个设置行、17 条独立说明文字、7 个「保存」按钮，纵向长度明显偏长；
- 「常规」实际混装 5 类设置（推送与链接 / 性能与超时 / 本地索引 / 实时探测 / 提交规则），只有「实时探测」有分组标题；
- 保存语义分裂：7 行需按钮保存，其余（分支模式、复选框、探测开关、显示设置、账号、Git 配置）全部即时保存；
- 发现 1 个真实输入缺陷：网络超时 / 本地超时 / Diff 预算无法正常键入低于下限的多位数。

**不建议改动的「重复」**：

- 设置弹窗「显示」与工具条齿轮 popover 共用 `AnalysisSettingsForm`（双入口是有意设计，`omitPrimary` 控制裁剪，见 `AnalysisSettingsForm.vue:137`）；
- 设置弹窗「Git 配置」与项目级 `GitConfigDialog` 共用 `GitConfigSection`（已复用，不是复制）；
- 导航底部「管理分类」是动作而非分区，但它是分类管理**唯一入口**（`CategoryDialog` 只从这里打开），建议保留，只调整视觉归属。

## 2. P1（缺陷 / 明显冗余）

### P1-1 数字输入即时钳位，导致无法键入多位数（真实缺陷）

**证据链**（基线 `186e4058`）：

- `src/components/Input.vue:312-315`：`@input` 每次击键即 `emit("update:modelValue", value)`；
- `SettingsDialog.vue:150-155`：每次收到值就 `clampNetworkTimeout(Number($event))` 并回写；
- `types/storage.ts:98-120`：网络超时下限 30、本地超时下限 10；`types/storage.ts:142-150`：Diff 预算下限 1000。

**复现路径**：网络超时当前 240，想改成 60 → 键入 `6` 立刻被抬成 `30`（输入框回显 30）→ 再键入 `0` 得到 `300`。同理本地超时输 `60` → `100`；Diff 预算输 `5000` → 先变 `1000` 再变 `10000`。

**影响字段**：网络超时、本地命令超时、Diff 上下文预算。并发数 / 描述最短字数 / 正文行长因下限为 1 未致命，但「清空输入即跳回默认值」的跳变仍在。

**已有正确范式**：同文件轮询间隔的草稿串做法（`SettingsDialog.vue:707-738`，注释里已写明「直接绑受控字段会导致无法键入多位数」），但只用在轮询间隔一处。

**建议**：所有数字字段改为「草稿串 + change/blur/Enter 时钳位提交」，可提取 `composables/useClampedNumberDraft.ts`（4 处以上使用，满足 Rule of Three）。

### P1-2 7 个逐行「保存」按钮冗余，且 Enter 语义与按钮冲突

**证据**：

- 保存按钮 7 处：`SettingsDialog.vue:76-83`（并发）、`132-139`（PR 基线）、`157-164`（网络超时）、`182-189`（本地超时）、`369-377`（最短字数）、`458-466`（正文行长）、`485-493`（Diff 预算）；
- 弹窗根节点 `@keydown.enter="onEnterKey"`（`SettingsDialog.vue:8`），`onEnterKey` 一次保存 6 项（`SettingsDialog.vue:872-881`）——按单个按钮是「存这一项」，按 Enter 却是「存一片」，两种语义并存且界面无提示；
- PR 基线输入自身还有 `@keydown.enter="saveCompareBase"`（`SettingsDialog.vue:130`），事件冒泡后同一次 Enter 会先存基线、再触发全区保存；
- 其余设置已全部即时保存：分支模式 `705`、可选规则 `865-869`、探测 `680-692`、显示设置（`AnalysisSettingsForm` 逐项 `update`）、账号与 Git 配置（组件内自持久化）。

**建议**（需确认，见 §7）：

- **A 统一即时保存（推荐）**：数字字段 blur/Enter 提交，删除 7 个按钮与全区 Enter 保存；与当前 80% 控件的语义一致，界面最紧凑；
- **B 底部统一保存栏**：保留显式保存，但收敛为内容区底部 1 个「保存」+「还原」，Enter 只提交当前草稿。

### P1-3 「常规」缺少分组层级，五类设置混排

**证据**：`SettingsDialog.vue:63-500` 全部平铺；唯一分组标题是 `253-255` 的「实时探测」。当前顺序：并发 → 分支模式 → PR 基线 → 网络超时 → 本地超时 → 本地索引 → 实时探测 → 提交规则（最短字数 / 3 个开关 / 正文行长）→ Diff 预算。规则项与 AI 预算排在弹窗最末，和「常规」的心理预期不符。

**建议**：沿用现成 `.gp-set-section-title`（`styles/index.scss:440`）加 4 个组标题并重排：

1. 推送与链接：推送分支模式、PR 基线分支
2. 性能与超时：Git 并发数、网络超时、本地命令超时
3. 本地提交索引：开关 / 查看状态 / 重建 / 状态摘要
4. 提交规则检查：最短字数、4 个可选规则、Diff 上下文预算
5. 实时探测：（保持现状）

## 3. P2（视觉压缩与合并）

| 编号 | 问题 | 证据 | 建议 |
|---|---|---|---|
| P2-1 | 17 条说明各占一行，长文案还会折成 2–3 行 | `SettingsDialog.vue` 全文 `.gp-set-hint` 17 处 | 每组最多保留 1 条组级说明；单行能说清的并入 label `title`。「实时探测」的说明承载真实行为差异，保留但压成单行 |
| P2-2 | 短字段各占一行 | 并发 / 网络超时 / 本地超时（`65-194`） | 改为两列并排（3 行 → 2 行），标签在输入框上方或左侧紧凑排布 |
| P2-3 | 索引目录整行展示完整绝对路径 | `SettingsDialog.vue:242-246` + `.gp-set-index-dir` | 只显示末级目录 + `title` 完整路径 |
| P2-4 | 导航底部「管理分类」与分区导航同形，易被当作分区 | `SettingsDialog.vue:46-57`、`.gp-settings-nav-manage` | 保留唯一入口，视觉上进一步弱化为底部动作（已有分隔线，可改小一号字重/图标） |
| P2-5 | 控件密度不一致：常规用 `xsmall`，推送账号表单用 `small` | `PushProfilesSection.vue:36,42,47,117,124` | 设置页统一 `xsmall`；账号表单如需可读性，仅表单区用 `small` 并统一说明 |

按 P1-3 + P2-1/2/3 实施后，估算「常规」纵向高度可减少约 1/3。

## 4. P3（一致性与可维护性）

| 编号 | 问题 | 证据 | 建议 |
|---|---|---|---|
| P3-1 | 共享组件与裸元素混用 | 同文件前 4 个保存按钮用裸 `vp-btn`（`76-83/132-139/157-164/182-189`），后 3 个用共享 `Button`（`369-377` 等）；`GitConfigSection.vue` 用裸 `<input>`（`121-125`、`168-177`）与裸按钮 | 统一为共享 `Button`（`size="xsmall" dense`）与 `Input`；`GitConfigSection` 裸按钮一并替换 |
| P3-2 | `SettingsDialog.vue` 888 行，超过 500 行硬阈值 | 文件行数 | 拆为 `components/common/settings/`：`GeneralSettingsSection` / `ProbeSettingsSection` / `RuleCheckSettingsSection` / `IndexSettingsSection`，外壳只留导航与事件转发 |
| P3-3 | README 漂移 | `src/features/gitPush/README.md:122` 分区列表未含「推送账号」；`README.md:497` 写并发范围 1~10，代码与提示文案为 1~16（`storage.ts:21,43`、i18n `concurrencyHint`） | 随 UI 改动同批更新 README |
| P3-4 | 关闭按钮无可访问名称 | `SettingsDialog.vue:16-24` 纯图标按钮无 `title`/`aria-label` | 补 `:title="i18n.close"` 与 `aria-label` |

## 5. 实施阶段

| 阶段 | 内容 | 风险 | 验证 |
|---|---|---|---|
| Phase 1 | P1-1 数字草稿钳位（4 个字段，抽 composable） | 低，纯输入层 | `pnpm typecheck` + 手动键入 60/5000 |
| Phase 2 | P1-2 保存模型收敛 + P1-3 分组重排 + P2-1/2/3 压缩 | 中，涉及保存时机与文案增删 | `pnpm typecheck` + 手动逐项改值重开弹窗核对持久化 |
| Phase 3 | P3-1 控件统一 + P3-2 拆分 + P3-3 文档 + P3-4 无障碍 | 低 | `pnpm typecheck` + `pnpm test` |

> `pnpm lint` / `pnpm vite build` 由用户执行；本审查未运行任何构建。

## 6. 验收标准

1. 网络超时从 240 改为 60：全选后键入 `60`，输入框显示 60（不再变成 300）；失焦后重开弹窗仍为 60。
2. 本地超时、Diff 预算同样可键入任意合法值；越界值在失焦后被纠正并回填。
3. 「常规」出现 4–5 个分组标题；无「同一功能一行标题 + 两行说明 + 保存按钮」的重复结构。
4. 打开/关闭弹窗不产生存储写入；改一项只写对应槽位。
5. 推送账号表单与常规区控件密度一致；关闭按钮可被读屏识别。
6. `pnpm typecheck` 通过、`pnpm test` 通过；lint/build 由用户执行。

## 7. 待确认（产品决策）

1. **保存模型**：A 统一即时保存（推荐）／ B 底部统一保存栏／ C 保持逐行按钮仅修输入缺陷。
2. **「提交规则检查」位置**：常规内分组（推荐，导航不膨胀）／ 独立为第 5 个导航分区。
3. **密度统一**：推送账号表单是否也降为 `xsmall`。
4. **是否执行 P3-2 组件拆分**：纯维护性收益，不改观感。

## 8. 执行记录（2026-11-09，已按推荐方案 A 实施）

**决策**：保存模型选 A「统一即时保存」；提交规则保留在常规内分组；账号表单统一 `xsmall`；执行组件拆分。

| 项 | 状态 | 落点 |
|---|---|---|
| P1-1 数字输入钳位 | ✅ | 新增 `composables/useNumberDraft.ts`；并发数 / 网络超时 / 本地超时 / 最短字数 / 正文行长 / Diff 预算 / 轮询间隔全部改为「草稿 + 失焦/回车提交」 |
| P1-2 保存按钮冗余 | ✅ | 删除 7 个逐行保存按钮与全区 Enter 保存；`onEnterKey` / `saveXxx` 一并移除 |
| P1-3 常规分组 | ✅ | 拆为 5 组：推送与链接 / 性能与超时 / 本地提交索引 / 实时探测 / 提交规则检查 |
| P2-1 说明压缩 | ✅ | 静态说明全部移入 label `title`；仅保留索引状态与「即时保存」两条可见提示 |
| P2-2 短字段并排 | ⚠️ 未采用两列 | 改为「单行 label + 控件」并去说明行，纵向收益相同而无需新增网格样式 |
| P2-3 索引目录 | ✅ | 只显示末级目录，完整路径放 `title` |
| P2-4 管理分类 | ✅ 保留 | 仍是唯一入口，未改结构（已有分隔线区分动作与分区） |
| P2-5 密度统一 | ✅ | 推送账号表单 `small` → `xsmall` |
| P3-1 控件统一 | ✅ | `SettingsDialog` 关闭按钮、索引/探测动作按钮改共享 `Button`；`GitConfigSection` 三处裸 `<input>` 改共享 `Input`，顶部/底部裸按钮改 `Button`（行内 22px 图标按钮按 icon-btn 例外保留） |
| P3-2 组件拆分 | ✅ | `SettingsDialog.vue` 888 → 231 行；新增 `components/common/settings/` 5 个分区组件（91~189 行） |
| P3-3 文档 | ✅ | 同步 `src/features/gitPush/README.md`：分区列表补「推送账号」、并发范围 1~10 → 1~16 |
| P3-4 无障碍 | ✅ | 关闭按钮补 `title` / `aria-label` |

**验证**：`pnpm typecheck` 通过；`pnpm test` 71 文件 / 1128 用例通过；`pnpm i18n:verify` 通过（新增 3 个分组标题键，中英对齐）。`pnpm lint` / `pnpm vite build` 按约定由用户执行。

**待用户真机回归**：§6 验收标准 1~5（尤其把网络超时从 240 改成 60 的键入路径、以及各数字项失焦后重开弹窗的持久化）。

