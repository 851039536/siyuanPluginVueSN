# gitPush / CommitAnalysis 控件与架构规则审查报告

> 审查日期：2026-09-14 ｜ 审查范围：`src/features/gitPush/components/CommitAnalysis/`（12 个文件 / 约 1100 行）+ 其样式分片引用面
> 审查方式：逐文件通读 + 共享库 `interface Props` 实证 + 全模块横向比对（与前两份 gitPush 报告同口径）+ 架构规范复核（目录/分层/统一入口/Token/样式分离/可维护性）
> **交付性质**：首轮为纯报告（用户选定「先出全量审查报告，再分批整改」）；**报告出具后同日已执行批次 A–H 整改**（9 个源文件 + 4 个 i18n 文件），实施记录见 §五、验证见 §六。
> 结论：**违规 11 类 / 涉及 5 个文件 + 1 个共享库文件**；另有 4 项观察登记、7 项跨目录待办、10 类假阳性排除

---

## 一、规则依据

| 出处 | 条款 |
|------|------|
| `AGENTS.md` | 「共享组件库使用规则（强制）」——先查用法 → 优先复用 → 改 API 必同步；`src/components/` 是全项目唯一 UI 控件来源 |
| `AGENTS.md` | 「统一入口原则（强制）」——定时器/存储/事件/DOM/AI 等走统一封装 |
| `AGENTS.md` | 「功能模块内代码分层（强制）」——同一常量/工具被 2 个以上文件使用必须提取 |
| `AGENTS.md` | 「图标只能传 `kit/icons.ts`（真源）已注册的 `IconKey`，不能传任意 Iconify 名」 |
| `AGENTS_STYLE.md` | 「强制规则：按钮交互与无障碍（2026-09-10）」——按钮为唯一交互入口、键盘可达、纯图标须有可访问名 |
| `AGENTS_STYLE.md` | 「强制规则：字号层级与全局基准字号」——组件 `size` 档位是 10px 的唯一合法落地场景 |
| `AGENTS_STYLE.md` | 「强制规则：SCSS 必须分离到 styles/ 目录」 |
| `AGENTS_I18N.md` | 禁止 `\|\| '中文兜底'`；模板关键文案要有中文注释 |
| `AGENTS_ARCH.md` | 单文件行数上限、文件头注释强制、Rule of Three 提取判定 |
| `docs/token-shorthand.md` | Token 短名制与新旧映射（本报告用到的：`$s-1`=4px / `$s-6`=24px / `$s-16`=64px / `$s-px2`=2px / `$r-px1`=1px） |
| `docs/hardcode-audit.md:450` | 无对应 Token 的硬编码值处置约定：「①就近取 Token；②行尾加 `// 无对应 Token` 注释保留」 |
| `docs/gitPush-listview-controls-review.md`、`docs/gitPush-commitrulecheck-controls-review.md` | 同模块既有定性口径（例外登记范围、观感变化记录格式、验证章节格式） |

---

## 二、结论总览

| 严重度 | 数量 | 说明 |
|--------|------|------|
| 🔴 高 | 5 类 / 6 处 | 自建 `.vp-btn` 按钮（2 处）、原生取色器（1 处，**功能性缺陷**）、原生 `select`（2 处）、自建分段切换无 `aria-pressed`（1 处） |
| 🟡 中 | 5 类 | 可点击非交互元素缺键盘可达（2 处）、浮层 a11y 缺口（1 处）、自建计数徽标未走 `Tag`（1 处）、缺失 1 个 `IconKey`（迁移前置） |
| 🟢 低 | 5 类 / 12 处 | `:key` 用 index（1 处）、SCSS 可 Token 化 6 处 + 无 Token 建议注释 6 处、tooltip 口径不一致（1 处）、2 项响应式观察、文档登记缺口 |

**逐文件处置表**

| 文件 | 行数 | 处置 |
|------|------|------|
| `index.vue` | 138 | ✅ 合规（纯编排；唯一共享库消费点 `Loader`） |
| `AnalysisToolbar.vue` | 80 | 🔧 分析按钮 → 共享 `Button`（+ 图标补登） |
| `AnalysisOverviewCards.vue` | 43 | ✅ 合规（复用共享 mixin `stat-card*`） |
| `AnalysisSettingsForm.vue` | 110 | 🔧 **本轮最重**：分段切换 + 2 个 `select` + 原生取色器 全部迁共享组件 |
| `CommitAnalysisSettings.vue` | 71 | 🔧 齿轮按钮 → `Button`；浮层登记例外 + a11y 补强 |
| `AuthorTypeSection.vue` | 82 | ✅ 合规（模板无交互控件；百分比已 computed 预计算） |
| `DailyTrendSection.vue` | 45 | ✅ 合规（1 项 tooltip 口径登记） |
| `HeatmapCalendarSection.vue` | 58 | ✅ 合规（`v-if/v-else` 两分支均无可聚焦控件，不涉焦点移交） |
| `CommitHeatmap.vue` | 145 | 🟢 `:key` 改为稳定键；其余为性能正例 |
| `CommitCalendar.vue` | 149 | ✅ 合规（1 项跨零点观察） |
| `ProjectRankingSection.vue` | 77 | 🔴 可点击 `div` 缺键盘可达性 |
| `RecentCommitsSection.vue` | 102 | 🔴 可点击 `span` 缺键盘可达性；🟡 计数徽标 → `Tag`；1 项分页观察 |

> **结构性发现（本轮最值得记录）**：该目录**几乎未使用共享组件库**——全目录 `from "@/components/"` 仅 `index.vue:102` 的 `Loader`，其余控件要么自建（`.vp-btn`、`.gpa-settings-seg`、自绘热力图/日历），要么复用模块内 `components/common/`（`EmptyState` / `CommitCountSelect` / `LoadMoreButton`）。载体合规度明显低于已整改的 `ListView` 与 `CommitRuleCheck`，**是本目录整改的主要工作量所在**。

---

## 三、违规清单

### 3.1 🔴 自建按钮体系 `.vp-btn`（2 处）

| 位置 | 现状 |
|------|------|
| `AnalysisToolbar.vue:15-26` | 分析按钮：`<button class="vp-btn vp-btn--ghost vp-btn--sm" :disabled="analyzing">` + 裸 `<Icon :icon="analyzing ? 'mdi:loading' : 'mdi:chart-timeline-variant'" height="12" :class="{ 'gp-spin': analyzing }">` |
| `CommitAnalysisSettings.vue:5-14` | 齿轮按钮：`<button class="vp-btn vp-btn--ghost vp-btn--sm" :title="i18n.analysisDisplaySettings" @click.stop="show = !show">` + 裸 `<Icon icon="mdi:cog-outline" height="12">` |

**违反**：`AGENTS.md`「优先复用，禁止在 feature 内自建同类控件」。

**⚠️ 例外范围说明（关键判据）**：`ListView` 报告登记的例外是「**浮层内部的项按钮** + 行内二次确认」（`docs/gitPush-listview-controls-review.md:51-52,341,428`）。`CommitAnalysisSettings.vue:5-14` 是**浮层锚点按钮**（在浮层之外），**不属例外范围**，仍在违规面。

**目标写法**（与 `RuleCheckToolbar.vue` 整改后完全同构）：

```vue
<!-- 分析按钮：业务图标恒定，加载态交给 Button 的 loading（保宽 + spinner + 自动禁用） -->
<Button
  variant="ghost" size="xsmall" dense
  icon="chartTimelineVariant"
  :loading="analyzing" :disabled="analyzing"
  @click="emit('runAnalysis')"
>{{ analyzed ? i18n.auditRerun : i18n.auditRun }}</Button>

<!-- 齿轮锚点：纯图标 + dense = 20×20，无默认插槽（保 isIconOnly 与无障碍名派生） -->
<Button
  variant="ghost" size="xsmall" dense
  icon="cogOutline" :title="i18n.analysisDisplaySettings"
  @click.stop="show = !show"
/>
```

**⚠️ 迁移陷阱**
1. 两个图标都**必须先补登 `IconKey`**（见 3.5），否则 `Button.icon` 类型不通过；`mdi:cog-outline` 当前**只有业务键** `codeBlockAdvanced`（`icons.ts:358-361`，带 `#8b5cf6` 紫色），直接借用会让齿轮变紫。
2. 纯图标按钮**不得**把 `<Icon>` 放进默认插槽（会让 `isIconOnly` 恒假，尺寸档位与无障碍名派生全部失效）。
3. 删除 `import { Icon } from "@iconify/vue"` 前必须 grep 模板 `<Icon`：`AnalysisToolbar.vue:20` 与 `CommitAnalysisSettings.vue:10` 两处迁完后才可删（残留时 lint 与 typecheck 都不报）。
4. `gp-spin` 手写旋转改由 `Button.loading` 承担属**有意的观感变化**（与 CRCheck 同批登记）。

### 3.2 🔴 原生取色器（1 处，功能性缺陷）

**位置**：`AnalysisSettingsForm.vue:61-67`

```html
<input type="color" class="gp-color-input" :value="viewSettings.color" :title="viewSettings.color" @input="onColorChange">
```

**违反**：`AGENTS.md` 复用清单「颜色字段」必须用共享 `ColorField`；`ColorField.vue:1` 头部注释即写明「**思源 Electron 环境不弹出原生 `input[type=color]` 取色器，故改用自绘调色板**」。

**影响**：这不是观感问题而是**能力不可用**——用户点色块无任何弹窗，只能靠旁侧 hex 文本框手输。该缺陷已被既有审计点名在册（`docs/bookmark-marker-component-audit.md:62,88`，且 `:88` 逐字列出了本文件），处置建议为「单独立项批量替换为共享 `ColorField`」。

**目标写法**（`ColorField` 真实 props 见 `ColorField.vue:53-58`，仅 `modelValue: string` + `placeholder?`）：

```vue
<ColorField
  :model-value="viewSettings.color"
  placeholder="#3b82f6"
  @update:model-value="update({ color: $event })"
  @change="commitColor"
/>
```

**⚠️ 迁移陷阱**
1. `ColorField` 是**双事件**语义：`update:modelValue` 为实时值（文本逐字触发，仅更新内存）、`change` 为**提交信号**（blur/回车/调色板选色后触发，供落盘）（`ColorField.vue:1-2,62-66`）。现写法 `@input` 是**逐字落盘**，迁移后应挂 `@change` 提交、`update:modelValue` 只更新内存，否则等于把高频写盘换成另一种高频写盘。
2. `ColorField` 根 `.color-field { width: 100% }`（`styles/ColorField.scss:3-9`），而 `.gpa-settings-row` 是 `display:flex; justify-content: space-between`（`CommitAnalysisSettings.scss:21-27`）⇒ **放入后宽度表现未实测**（标为未确认），落地时需目视确认是否需要外层限宽（如 `flex: 0 0 auto` + `width: auto`）。
3. `.gp-color-input` 类定义在**共享** `styles/index.scss:430-436`，且仍被 `components/common/CategoryDialog.vue:59` 依赖 ⇒ **不能随迁移删除**（跨目录待办）。
4. 无 `disabled` prop（`ColorField.vue:53-58`），本处也不需要（未做禁用态）✓。

### 3.3 🔴 原生 `<select>` ×2（`AnalysisSettingsForm.vue`）

| 位置 | 用途 |
|------|------|
| `:26-38` | 显示范围（`lastYear` / 各年份，`v-for="y in years"`） |
| `:45-54` | 每周第一天（周一 / 周日） |

**违反**：`AGENTS.md` 复用清单「下拉」必须用共享 `Select`（同 `ListView` 报告 §3.2 `:93-95` 口径）。

**⚠️ 迁移陷阱**
1. `Select` 与 `Input` 均为**纯受控**组件：显示完全取自 `props.modelValue` ⇒ 必须 `:model-value` + handler 内**回写 ref**（`docs/gitPush-listview-controls-review.md:103`）。
2. 载荷类型为 `string | number | boolean | null`：现状两个 select 均已用 `String(...)` 归一（`:28,47`），迁移时 `options` 的 `value` 需与之一致（年份用 `String(y)` 或 `number` + handler 内 `Number()`，**不要混用**，否则选中态匹配失败）。
3. 现状 handler 已有类型收窄（`:92-99`）可保留，但需改为接收 `Select` 载荷（`if (typeof v !== "string") return` 之类的守卫）。
4. 迁移后 `.gpa-settings-select`（`CommitAnalysisSettings.scss:43-57`，含 `:focus { @include focus-ring }`）整块失效 ⇒ 删死样式；`max-width: 120px` 需改为挂到共享 `Select` 的根上（留在根上的 `border/background/padding` 会与组件自身 `__trigger` 外壳叠加成**双层框**——`docs/gitPush-listview-controls-review.md:187-190` 已记录该坑）。

### 3.4 🔴 自建分段切换无 `aria-pressed`（`AnalysisSettingsForm.vue:8-19`）

现状两个 `<button class="gpa-settings-seg-btn" :class="{ active: ... }">`（视图：热力图 / 日历）。

**违反**：`AGENTS.md` 复用清单——「一组互斥选项的分段切换仍用 `Button` 分组 + `:aria-pressed`」（另见 `AGENTS_STYLE.md` 按钮交互与无障碍；同构先例 `docs/gitPush-listview-controls-review.md:148-151`）。现写法用 `.active` 类表状态，读屏无法得知哪一段被选中。

**目标写法**：

```vue
<div class="gpa-settings-seg">
  <Button variant="ghost" size="xsmall" dense :aria-pressed="viewSettings.view === 'heatmap'"
    @click="update({ view: 'heatmap' })">{{ i18n.analysisViewHeatmap }}</Button>
  <Button variant="ghost" size="xsmall" dense :aria-pressed="viewSettings.view === 'calendar'"
    @click="update({ view: 'calendar' })">{{ i18n.analysisViewCalendar }}</Button>
</div>
```

**⚠️ 迁移陷阱**（`docs/gitPush-listview-controls-review.md:24-40` 的段内按钮范式已给出成熟做法）：选中态**不要**用 `:class="active"` 覆写共享 `Button`（ghost 的 hover 规则特异性可达 (0,5,0)，打不赢），而应「容器提供外框 + 段内按钮去边框去圆角 + `[aria-pressed="true"]` 换底色/字重」，覆盖规则抬到 **(0,4,0)**，例如 `.gpa-settings-seg .gpa-settings-seg-btn.si-button { border:none; border-radius:0; &[aria-pressed="true"] { … } }`。

### 3.5 🟡 `Button.icon` 能力缺口：2 个图标需补登 / 1 个键复用需谨慎

| 图标 | 状态 | 结论 |
|------|------|------|
| `mdi:chart-timeline-variant` | **未注册**（`icons.ts` 全文 0 命中） | 必须补登，建议键名 `chartTimelineVariant` |
| `mdi:cog-outline` | **只有业务键** `codeBlockAdvanced`（`icons.ts:358-361`，带 `color: "#8b5cf6"`） | 建议补通用键 `cogOutline`，避免齿轮被染成紫色或造成语义错位 |
| `mdi:source-commit` | 已注册 `sourceCommit`（`icons.ts:918-920`） | 供 `index.vue:53` 的 `EmptyState` 用（属豁免面，不必改） |
| `mdi:loading` | 已注册 `loading`（`icons.ts:523-525`） | `Button.loading` 内置，无需引用 |

**处置**：在 `COMMON_ICONS` 的「通用动作补充」（`icons.ts:851` 起的分区）追加两个键；`IconKey` 于 `icons.ts:940` 自动派生，**真源单点改动**，改完跑 `pnpm validate:icons`（该脚本只校验 `icon:` 字面量的 mdi 名是否存在于 `@iconify/json`，不管键名是否被引用）。

### 3.6 🔴 可点击非交互元素缺键盘可达性（2 处）

| 位置 | 现状 | 目标 |
|------|------|------|
| `ProjectRankingSection.vue:9-14` | `<div class="gpa-bar-row gpa-bar-row--clickable" @click="emit('viewProject', row.id)">`（无 `button`/`role`/`tabindex`/键盘处理） | 共享 `Button text`，或根元素改原生 `button` |
| `RecentCommitsSection.vue:25-29` | `<span class="gpa-commit-project" @click.stop="emit('viewProject', c.projectId)">` | 同上（列表行内建议 `Button text` 或 `<button class="gpa-commit-project">`） |

**违反**：`AGENTS_STYLE.md`「按钮交互与无障碍」——交互入口必须是按钮；键盘用户无法 Tab 到这两处，也无法用 Enter/Space 激活。

**模块内范式正例（判据来源）**：`components/common/LineRankRow.vue:1`（头部注释「clickable 时根为原生 `button` 可键盘激活」）+ `:3-9`（`:is="clickable ? 'button' : 'div'"`）+ `:74-75`（Tab 聚焦 + Enter/Space 激活并 emit select），`src/features/gitPush/README.md:105` 亦登记该范式。**本目录两处应与之对齐。**

**⚠️ 迁移陷阱**：`ProjectRankingSection` 的行是**条形图行**（标签 + 轨道 + 数字三列），改 `button` 后需重置原生按钮样式（`text-align: left; width: 100%; font: inherit`）并保留 `cursor: pointer`；`RecentCommitsSection` 的行内 span 若改 `Button`（`text` 变体）需注意 `.gpa-commit-meta` 是 flex 容器、按钮不要 `flex: 1` 撑开（原 span 有 `max-width: 40%` 截断，`CommitAnalysisPanel.scss:263`）。

### 3.7 🟡 自建浮层 a11y 缺口（`CommitAnalysisSettings.vue:16-27, 53-64`）

浮层本体**登记为允许自建例外**（见 §四.2），但其**可访问性**缺口应作为独立条目记录：

| 缺口 | 现状 | 项目内正例 |
|------|------|-----------|
| 无 Esc 关闭 | 仅 `document.addEventListener("click", closeOnOutside)`（`:63`） | `ColorField.vue:104-108`（`keydown` + `Escape`） |
| 无 `aria-expanded` / `aria-controls` | 齿轮按钮与浮层之间无关联 | `Panel.vue:36-37,52-54`（`aria-expanded` + `aria-controls`） |
| 无焦点管理 | 打开不移动焦点、关闭不归还 | `ConfirmPopup.vue:328-341`（打开记 `activeElement`、关闭归还） |

**注**：监听器**配对清理正确**（`:63` 注册 / `:64` 卸载），且有「未展开时提前返回、避免每次点击白跑 `closest()`」的性能注释（`:53-56`）✓——本条只针对 a11y，不是资源泄漏。

### 3.8 🟡 自建计数徽标未走 `Tag`（`RecentCommitsSection.vue:7`）

```html
<span class="gpa-section-count">{{ stats.entries.length }}</span>
```

样式在 `CommitAnalysisPanel.scss:129-138`（`$t-2xs` + `$ff-mono` + `primary-lightest` 底 + 圆角），与**上一轮已判违规**的 `.grc-section-count`（`docs/gitPush-commitrulecheck-controls-review.md:125`）**完全同构**。

**目标写法**：`<Tag class="gpa-section-count" variant="primary" size="xsmall" shape="square">{{ stats.entries.length }}</Tag>`

**⚠️ 迁移陷阱**：**不要用 `Tag.content`** —— 它对超过 `max`（默认 99）的数字折叠为 `99+`，会把真实提交数变成假值；必须走默认插槽。覆写等宽数字需抬到 (0,4,0)（同 CRCheck `.grc-panel .grc-section-title .grc-section-count.si-tag`，样式块只保留 `font-family/font-variant-numeric/font-weight/letter-spacing`）。

---

### 3.9 🟢 其余低危项

| # | 位置 | 问题 | 建议 |
|---|------|------|------|
| 1 | `CommitHeatmap.vue:31-32` | `v-for="(cell, idx) in cells" :key="idx"`（371 格用 index 作 key） | 改 `:key="cell.date \|\| `pad-${idx}`"`；同目录正例：`CommitCalendar.vue:33` 用 `d.date`。当前格子是无状态 `div`，故非功能性 bug，但范围/配色变化时按位复用会埋隐患 |
| 2 | `CommitAnalysisPanel.scss:105,171,186,198,214,216` | 6 处硬编码 px **存在精确等价 Token**：`4px→$s-1`（滚动条宽、条形轨道高）、`24px→$s-6`、`64px→$s-16`、`2px→$s-px2`、`1px→$r-px1` | 机械替换（「值即名称」，与 `scripts/codemod-hardcode-tokens.mjs` 的机械改口径一致） |
| 3 | `CommitAnalysisPanel.scss:76,89,117,163` + `CommitAnalysisSettings.scss:16,52` | 6 处结构性尺寸无对应 Token（`260px` grid 断点 / `320px` 限高 / `72px`·`88px` 标签列 / `200px`·`120px` 浮层宽） | 按 `docs/hardcode-audit.md:450` 处置约定，**行尾加 `// 无对应 Token` 注释**保留，不硬凑 |
| 4 | `DailyTrendSection.vue:14` | `:title="`${d.label}: ${d.count}`"` 模板拼接用户可见 tooltip，未走 i18n；同目录 `heatCellTooltip`（`utils/analysis.ts:95-102`）已走 i18n 键 | 口径不一致（非硬编码中文违规）：建议补键或在 `computed` 内预计算文案，与热力图口径统一 |

### 3.10 🟢 观察登记（无既有口径，不擅自定性）

| # | 位置 | 观察 |
|---|------|------|
| 1 | `RecentCommitsSection.vue:82-87` | `usePagedList(sortedEntries, 50)` **未在数据源变化时 `reset()`**（`composables/usePagedList.ts:5-25` 内部不 watch `source`，本文件未调用 `reset`）⇒ 重新分析后 `visibleCount` 保留旧值，仅影响默认展示条数。对照：`ViolationListSection.vue:200-204` 有 `watch(pagedSource, …)` 重置 |
| 2 | `CommitCalendar.vue:106` | `const todayStr = formatLocalDate(new Date())` 位于只依赖 props 的 `computed` 内 ⇒ **跨零点不自动重算**，「今天」描边会滞留到下次 props 变化；无响应式数据源可 watch，属已知取舍 |

---

## 四、假阳性排除与允许自建登记

### 4.1 假阳性排除（明确不改）

| 项 | 位置 | 判据 |
|----|------|------|
| `i18n: Record<string, any>` 透传（12/12） | `index.vue:113`、`AnalysisToolbar.vue:49` 等 | 模块内 94 个文件同写法（含最新 DI 范式 `types/cardServices.ts:24`），前两份报告仅登记不改 |
| 裸 `<Icon icon="mdi:*">` | `AnalysisToolbar.vue:20`、`CommitAnalysisSettings.vue:10` | 全项目通行 + `setupIconifyOffline()` 预载；前两份报告已排除 |
| `EmptyState` 的 `icon="mdi:…"` 字符串 prop | `index.vue:7,39,53` | 库内既有豁免（`EmptyState.vue:22-33` 声明 `icon: string`） |
| 12/12 组件非 scoped `<style>` + 各自双行 `@use` 分片 | `index.vue:134-137` … `RecentCommitsSection.vue:98-101` | **模块范式 + 规范正例**：`styles/index.scss:1-6` 只聚合 `Buttons/Shared/Dialog/Form`，不 `@use` 则分片不加载；且「子组件双行导入（专属分片 + 共享 index）」正是 SKILL/规范文档要求的写法 |
| KPI 卡片 `.gpa-card*` | `AnalysisOverviewCards.vue:5-16` | 纯展示局部容器例外；且已复用共享 mixin `stat-card*`（`CommitAnalysisPanel.scss:47-57` ← `_mixins.scss:137-166`），与另两处卡片统一 |
| CSS 比例条 / 区块标题 / 列表行骨架 | `AuthorTypeSection.vue:12-52`、`ProjectRankingSection.vue:15-29`、`DailyTrendSection.vue:10-20`、`RecentCommitsSection.vue:9-38` | 纯展示容器例外；`.gpa-section-title` 复用 `@include gp-label-base` |
| `usePagedList` + `LoadMoreButton` 渐进加载 | `RecentCommitsSection.vue:40-46` | 模块统一做法（`Paginator` 在 gitPush 内使用数为 0），前三份报告同口径 |
| `i18n.xxx \|\| ""` 空串兜底 | `ProjectRankingSection.vue:65`、`CommitHeatmap.vue:125,137`、`CommitCalendar.vue:72` | 空串是「无数据不显示」的显式处理，与「中文兜底掩盖 i18n 缺失」不同类 |
| 原生 `:title` 气泡（多处） | `AuthorTypeSection.vue:19`、`CommitCalendar.vue:37` 等 | 模块通行做法，前两份报告已排除 |
| 模板内联 `i18n[META[t.type].labelKey]` 查表 | `AuthorTypeSection.vue:44` | O(1) 常量映射，非大计算；同目录多处已经把重计算提到 `computed`（正例见下） |
| `transition: background 0.12s` / `color 0.12s` | `CommitAnalysisSettings.scss:76`、`CommitAnalysisPanel.scss:166,217` | 符合 gitPush 过渡范式（0.12s） |

**性能正例（应保留，勿在整改中破坏）**：`RecentCommitsSection.vue:68-79`（Schwartzian transform，注释量化「万条 ≈ 28 万次解析 → O(n)」）、`:89-95`（只对可见 50 行求 `relativeTime`）、`CommitCalendar.vue:101-105`（`formatLocalDate` 提到循环外，注释量化「12 月 × 31 天多算约 370 次」）、`CommitHeatmap.vue:86-88`（取模替代 `while` 自减，防 weekStart 被污染时死循环）、`:94-98,:109-111`（style 对象预计算）。

### 4.2 允许自建例外登记

| 例外项 | 位置 | 依据 |
|--------|------|------|
| 齿轮下拉浮层容器（承载表单，非菜单） | `CommitAnalysisSettings.vue:16-27`（`.gpa-settings-popover`） | 共享库**无** Popover/OverlayPanel 公开组件（52 个公开组件中 `ConfirmPopup` 是「气泡确认」语义不匹配、`TieredMenu`/`MegaMenu` 是导航菜单，判据同 `docs/gitPush-listview-controls-review.md:280,284`）；且已复用模块 mixin `popover-base`（`CommitAnalysisSettings.scss:11-18` ← `_mixins.scss:100-112`，与 `.gp-ide-popover` 等同源） |
| 自绘热力图 | `CommitHeatmap.vue` + `styles/CommitHeatmap.scss` | **能力缺口**：共享 `Chart.vue:79` 只支持 `line/bar/pie/doughnut/area`，无 heatmap/matrix；同类处置口径见 `docs/ai-content-generator-component-audit.md:176`（「若需合规，应为 `Chart.vue` 扩展类型，再删除本文件」） |
| 自绘月历网格 | `CommitCalendar.vue` + `styles/CommitCalendar.scss` | 同上（Chart 无日历矩阵类型） |
| 热力色阶图例色块 | `CommitHeatmap.vue:41-53,108-110` | 色块 `background` 由 `heatCellColor(level, color)` 计算，是**色阶刻度**而非徽标，不适用 `Tag` |
| 30 天柱状趋势（CSS 柱） | `DailyTrendSection.vue:8-21` | 模块既有 CSS 条形范式的一致延续；**存疑点**：`Chart.vue` 的 `bar` 类型理论上可表达，若口径收紧需另行裁决（本条为待裁决，非既成例外） |

### 4.3 跨目录待办（只登记不改，本轮范围外）

| 待办 | 位置 | 说明 |
|------|------|------|
| `LoadMoreButton` 仍含自建 `.vp-btn` | `components/common/LoadMoreButton.vue:5-10` | 被本目录 `RecentCommitsSection.vue:40-46` 消费 |
| `CategoryDialog` 仍用原生取色器 | `components/common/CategoryDialog.vue:56-61` | 与 3.2 同一缺陷（`docs/bookmark-marker-component-audit.md:88` 已点名），建议与 3.2 同批处理 |
| `.gp-color-input` 不能随迁移删除 | `styles/index.scss:430-436` | 仍被 `CategoryDialog.vue:59` 依赖 |
| 反向依赖：`common/` 消费本目录组件 | `components/common/SettingsDialog.vue:284`（用法 `:256-261`） | 改 `AnalysisSettingsForm.vue` 的 props/emits 会波及 `common/`，整改时需同批回归 |
| 图标真源缺 2 个键 | `src/components/kit/icons.ts` | `chartTimelineVariant` + `cogOutline`（见 3.5） |
| README styles 段缺 3 个分片登记 | `src/features/gitPush/README.md:191` 附近 | 实际存在但未登记：`CommitAnalysisSettings.scss` / `CommitHeatmap.scss` / `CommitCalendar.scss` |
| 共享库文档计数不一致 | `AGENTS.md:173,195`（52 个）vs `docs/components-vue3-migration-guide.md:3,62-65`（48 个） | 实测 `src/components/*.vue` = 52 个 |

---

## 五、整改实施记录（批次 A–H，已落地）

原建议顺序按「风险由低到高 / 依赖由先到后」排列，实际执行即按此序完成：

| 批次 | 内容 | 文件 | 前置依赖 | 风险点 |
|------|------|------|---------|--------|
| **A** | 补登 2 个 `IconKey`（`chartTimelineVariant` / `cogOutline`） | `src/components/kit/icons.ts` | — | `pnpm validate:icons` 必须通过；键名 camelCase、放「通用动作补充」分区 |
| **B** | 两个 `.vp-btn` → 共享 `Button`；删除 `@iconify/vue` 导入 | `AnalysisToolbar.vue`、`CommitAnalysisSettings.vue` | A | 删导入前 grep `<Icon`；纯图标不传默认插槽；观感变化登记 |
| **C** | 原生取色器 → `ColorField`（改 `@change` 落盘）；原生 select ×2 → `Select`；分段切换 → `Button` 分组 + `aria-pressed` | `AnalysisSettingsForm.vue` + `CommitAnalysisSettings.scss` | — | `Select`/`ColorField` 受控回写；受 `<SettingsDialog>` 复用需回归；删 `.gpa-settings-select` 死样式、限宽改挂 `Select` 根；`ColorField` 宽度需目视确认 |
| **D** | 可点击 `div`/`span` → 按钮语义 + 键盘可达 | `ProjectRankingSection.vue`、`RecentCommitsSection.vue` | — | 重置原生按钮样式；对齐 `LineRankRow.vue` 范式 |
| **E** | 计数徽标 → `Tag`（默认插槽）；覆写抬 (0,4,0) | `RecentCommitsSection.vue` + `CommitAnalysisPanel.scss` | — | 禁用 `Tag.content`（`99+` 折叠） |
| **F** | 浮层 a11y 补强（Esc / aria-expanded / 焦点归还） | `CommitAnalysisSettings.vue` | B | 与 `ColorField.vue` / `Panel.vue` / `ConfirmPopup.vue` 三处正例对齐；**不改浮层本体形态**（仍属例外） |
| **G** | 低危清理：`CommitHeatmap` 的 `:key`、6 处可 Token 化 px、6 处结构性 px 加注释、`DailyTrendSection` tooltip 口径 | 相应 3 文件 + 2 SCSS | — | `:key` 改动需确认格子无过渡动画依赖位次 |
| **H** | 文档同步：README styles 段补 3 行；共享库计数口径统一 | `gitPush/README.md`、`AGENTS.md` 或迁移指南 | — | 属文档面，建议与最近一次结构改动同批提交 |

**验证口径（每批均需）**：`read_lints` 0 + `pnpm typecheck`（vue-tsc，禁止 `npx tsc --noEmit`）+（涉及图标）`pnpm validate:icons` +（涉及 i18n）`pnpm i18n:merge` → `pnpm i18n:verify` + 残留断言 grep（`.vp-btn` / 原生控件 / `@iconify/vue` 导入）；`pnpm lint` 与 `pnpm vite build` 由用户执行。

### 5.1 实施结果（逐批）

| 批次 | 实际改动 | 文件 |
|------|---------|------|
| A | 新增 `cogOutline`（`mdi:cog-outline`，避开带紫色的业务键 `codeBlockAdvanced`）与 `chartTimelineVariant`（业务图标原本未注册） | `src/components/kit/icons.ts` |
| B | 分析按钮与齿轮锚点按钮迁共享 `Button`（`ghost` + `xsmall` + `dense`；分析按钮 `:loading` 承担转圈与禁用，齿轮为纯图标 20×20）；两文件移除 `@iconify/vue` 导入 | `AnalysisToolbar.vue`、`CommitAnalysisSettings.vue` |
| C | 分段切换 → `Button` 分组 + `:aria-pressed`；两个原生 `select` → `Select`（`size="xsmall"`，值为字符串、handler 收窄 + 回写受控值）；原生取色器 → `ColorField`（**新增 `colorDraft` 本地草稿：`update:modelValue` 只改草稿、`change` 才派发落盘**，避免父级 `updateViewSettings` 逐字写存储）；SCSS 交还外观、只保留限宽并放宽下拉面板 | `AnalysisSettingsForm.vue`、`CommitAnalysisSettings.scss` |
| D | 排行行（`.gpa-bar-row--clickable`）→ 共享 `Button`（行内三列布局下沉到 `.si-button__text`）；行内项目名（`.gpa-commit-project`）→ 共享 `Button` 的 `text` 变体（保留「链接式」观感） | `ProjectRankingSection.vue`、`RecentCommitsSection.vue`、`CommitAnalysisPanel.scss` |
| E | 计数徽标 → `Tag`（`primary` + `xsmall` + `square`，**走默认插槽避免 `99+` 折叠**），覆写抬到 (0,4,0) 只保留等宽数字 | `RecentCommitsSection.vue`、`CommitAnalysisPanel.scss` |
| F | 浮层补 a11y：齿轮按钮加 `aria-expanded` / `aria-controls`，浮层加 `id` + `role="dialog"` + `aria-label`；新增 Esc 关闭与**关闭时焦点归还齿轮按钮**；两个 document 监听器成对注册/清理 | `CommitAnalysisSettings.vue` |
| G | `CommitHeatmap` 格子 `:key` 改为 `cell.date \|\| pad-${idx}`；6 处硬编码 px 改用 Token（`$s-1` / `$s-6` / `$s-16` / `$s-px2` / `$r-px1`）、6 处结构性尺寸补 `// 无对应 Token` 注释；趋势柱 tooltip 改走新 i18n 键 `analysisDailyTooltip`（预计算，与热力图口径统一） | `CommitHeatmap.vue`、`DailyTrendSection.vue`、两个 SCSS、两个 i18n 分片 |
| H | `gitPush/README.md` styles 段补 `CommitAnalysisSettings.scss` / `CommitHeatmap.scss` / `CommitCalendar.scss` 三行登记 | `src/features/gitPush/README.md` |

**仍登记未做**：`components/common/LoadMoreButton.vue` 与 `CategoryDialog.vue` 的同源残留（跨目录待办）、共享库组件计数口径（`AGENTS.md` 52 vs 迁移指南 48）、`RecentCommitsSection` 的 `usePagedList` 不重置与 `CommitCalendar` 的跨零点刷新（两项观察，无既有口径）。

### 5.2 有意的观感变化（记录在案）

| 项 | 变化 | 原因 |
|----|------|------|
| 分析按钮加载态 | `gp-spin` 手写旋转图标 → `Button` 内置 spinner（保宽、绝对居中、自动禁用） | 与模块其余加载按钮统一 |
| 齿轮按钮几何 | `.vp-btn--sm` → `Button` 纯图标 `dense` 20×20（padding 0） | 与 ListView 迁移后同口径 |
| 设置浮层行内控件 | 原生 select 的 mono 等宽字体与自绘边框 → 共享 `Select`（xsmall 档）外观；取色器由 28×28 色块 → `ColorField`（40×28 色块 + hex 文本框 + 自绘调色板） | 走共享组件档位；取色器同时修复了「点了不弹窗」的功能缺陷 |
| 取色器落盘时机 | 逐字 `@input` 落盘 → `change` 提交（blur/回车/选色） | 避免高频磁盘写入；实时值仅改本地草稿 |
| 排行行悬停 | 仅标签列变主色 → 共享 `Button` 的 ghost 软底反馈 + 标签列变主色 | 行作为按钮需要统一的可交互反馈 |
| 分段切换选中态 | `.active` 类 → `[aria-pressed="true"]`（读屏可感知） | 无障碍要求 |
| 计数徽章 | 自绘色值 → `Tag` 的 `variant` 体系（补 20% 同色描边，几何取 xsmall/square 档） | 对齐共享库标准徽标观感 |

**业务行为零改动**：分页、视图切换、范围/周起始/颜色持久化路径与父子契约（`update` / `runAnalysis` / `updateCount` / `updateViewSettings` / `viewProject`）全部保持不变。

---

## 六、验证结果（批次 A–H 实测）

| 检查 | 结果 |
|------|------|
| `read_lints` | ✅ 0 诊断（CommitAnalysis 全目录 + 两个 SCSS + `icons.ts`） |
| `pnpm typecheck`（vue-tsc） | ✅ exit 0（新迁移的共享组件 props 均由 vue-tsc 校验，非 `tsc`） |
| `pnpm validate:icons` | ✅ 235 个图标全部有效（较整改前 233 增加 2：`cogOutline` / `chartTimelineVariant`） |
| `pnpm i18n:merge` → `pnpm i18n:verify` | ✅ 4501 个叶子键中英对齐、无重复键（较整改前 4500 增加 `analysisDailyTooltip`） |
| 残留断言 | ✅ CommitAnalysis 目录内 `vp-btn` / `type="checkbox"` / `type="color"` / `<select` / `@iconify/vue` / 裸 `<Icon ` **全部 0 命中** |
| 行号准确性 | ✅ 报告内所有 `路径:行号` 均经回读原文核对 |
| 换行符一致性 | ✅ 逐文件核对 `git ls-files --eol`；两个被写成 LF-only 的组件（`AnalysisSettingsForm` / `CommitAnalysisSettings`）已恢复为工作区统一的 CRLF |
| 文档同步 | ✅ `gitPush/README.md` styles 段补 3 行；⏭ 「共享库组件计数 52 vs 48」未在本轮处理（跨文档口径，登记待办） |
| 目视回归（建议） | ⏳ 需在思源内确认：设置浮层三个控件的宽度与调色板弹层定位（`ColorField` 根 `width:100%` 的观感，§3.2 已标为待确认项） |
| `pnpm lint` / `pnpm vite build` | ⏳ 由用户执行 |

**报告事实来源抽样核对**：

| 结论 | 核对依据 |
|------|---------|
| `Button` 版本形态与 dense 几何 | `src/components/Button.vue:59-91`（props）、`src/components/styles/Button.scss:80-90`（dense 仅与 xsmall 协同、纯图标 20px） |
| `ColorField` 双事件与自绘调色板 | `src/components/ColorField.vue:1-2,53-58,62-66`；迁移先例 `bookmarkMarker/components/RuleItem.vue:51-55` |
| 共享库无 Popover | `src/components/` 52 个公开组件清单 + 私有目录契约 `src/components/kit/README.md:3-4` |
| `Chart` 不支持 heatmap | `src/components/Chart.vue:79`（`line\|bar\|pie\|doughnut\|area`） |
| Token 可替代值 | `docs/token-shorthand.md:59,91,96,100`（`$r-px1`=1px、`$s-1`=4px、`$s-6`=24px、`$s-16`=64px） |
| 例外范围判据 | `docs/gitPush-listview-controls-review.md:51-52,280,284,341,428` |
