# gitPush / CommitRuleCheck 控件规则审查报告

> 审查日期：2026-09-14 ｜ 审查范围：`src/features/gitPush/components/CommitRuleCheck/`（5 个文件 / 565 行）
> 审查方式：逐文件通读 + 共享库 `interface Props` 实证 + 全模块横向比对（`docs/gitPush-listview-controls-review.md` 同口径）+ 架构规范复核
> 结论：**违规 6 类 / 涉及 3 个业务文件 + 1 个共享库文件**；假阳性排除 5 类、允许自建登记 5 类

---

## 一、规则依据

| 出处 | 条款 |
|------|------|
| `AGENTS.md` | 「共享组件库使用规则（强制）」——先查用法 → 优先复用 → 改 API 必同步；`src/components/` 是全项目唯一 UI 控件来源 |
| `AGENTS.md` | 「统一入口原则（强制）」——定时器/存储/DOM/事件等走统一封装入口 |
| `AGENTS.md` | 「功能模块内代码分层（强制）」——同一工具被 2 个以上文件使用必须提取到 `types/` 或 `utils.ts` |
| `AGENTS.md` | 「图标只能传 `kit/icons.ts`（真源）已注册的 `IconKey`，不能传任意 Iconify 名」 |
| `AGENTS_STYLE.md` | 「强制规则：按钮交互与无障碍（2026-09-10）」——纯图标按钮必须有可访问名 |
| `AGENTS_STYLE.md` | 「强制规则：字号层级与全局基准字号」——组件 `size` 档位是 10px 的唯一合法落地场景 |
| `AGENTS_STYLE.md` | 「强制规则：SCSS 必须分离到 styles/ 目录」 |
| `AGENTS_I18N.md` | i18n 分片与合并产物、禁止硬编码文案 |
| `AGENTS_ARCH.md` | 单文件行数上限 500 行、文件头注释强制 |
| `docs/gitPush-listview-controls-review.md` | 同模块上一轮（ListView）的定性口径：`.vp-btn` 属违规；`Tag` 迁移接受「有意的观感变化」并记录在案；覆写共享组件样式须抬到 (0,3,0)～(0,4,0) |

> 本轮**不**依据「裸 `<Icon icon="mdi:*">` 必须改 `IconWrapper`」判定违规：该写法全项目通行（上一轮报告 §L23/L301 已排除），且 `setupIconifyOffline()` 已预载图标集。
> 本轮**不**依据「`i18n: Record<string, any>` 透传」判定违规：模块内 94 个文件同此写法（含最新 DI 范式 `types/cardServices.ts:24`），上一轮报告亦仅登记不改。

---

## 二、结论总览

| 严重度 | 数量 | 说明 |
|--------|------|------|
| 🔴 高 | 2 类 / 6 处 | 自建按钮体系 `.vp-btn`（4 处）、原生 `input[type=checkbox]`（2 处） |
| 🟡 中 | 2 类 | 徽标未走共享 `Tag`（2 处）、`Button.icon` 前置能力缺口（1 个图标未注册） |
| 🟢 低 | 2 类 | 违规行唯一键 3 处重复拼接、迁移后失效的样式覆写与死样式 |

**逐文件处置**

| 文件 | 行数 | 处置 |
|------|------|------|
| `index.vue` | 199 | ✅ 合规无需改动（纯编排容器，无自建控件） |
| `RuleCheckToolbar.vue` | 95 | 🔧 分析按钮 → 共享 `Button`；删除 `@iconify/vue` 导入 |
| `RuleCheckOverview.vue` | 51 | ✅ KPI 卡登记为允许自建例外，无需改动 |
| `ReasonDistributionSection.vue` | 36 | ✅ 复合 chip 登记为允许自建例外，无需改动 |
| `ViolationListSection.vue` | 186 | 🔧 4 处控件替换 + 键去重（核心改动文件） |
| `styles/CommitRuleCheckPanel.scss` | 277 | 🔧 死样式清理 + 覆写特异性抬档 |

---

## 三、违规清单

### 3.1 🔴 自建按钮体系 `.vp-btn`（4 处）

**证据**：4 个按钮使用自建类 `.vp-btn / --ghost / --sm`（类定义在 `styles/Buttons.scss`，属**全局类**）：

| 位置 | 现状 |
|------|------|
| `RuleCheckToolbar.vue:25-36` | 分析按钮（文案 + 前导图标 + `gp-spin` 旋转） |
| `ViolationListSection.vue:20-32` | 批量修正按钮（图标 + 文案 + 选中计数徽章） |
| `ViolationListSection.vue:59-65` | 行内修正纯图标按钮（`.grc-item-fix`） |
| `ViolationListSection.vue:67-73` | 行内删除纯图标按钮（`.grc-item-drop`） |

**违反**：`AGENTS.md`「优先复用，禁止在 feature 内自建同类控件」——按钮必须使用共享 `Button.vue`。

**说明**：上一轮 ListView 报告的整改边界为「不改 gitPush 其余目录」，本目录属**未覆盖的残留**，本轮清除。

**目标写法**（`size="xsmall" dense` 替代 `.vp-btn--sm` 的紧凑几何，与 ListView 迁移后完全一致）：

```vue
<!-- 有文案：业务图标恒定，加载态交给 Button 的 loading（保宽 + spinner） -->
<Button
  variant="ghost" size="xsmall" dense
  icon="clipboardCheckOutline"
  :loading="analyzing" :disabled="analyzing"
  @click="emit('runAnalysis')"
>{{ analyzed ? i18n.auditRerun : i18n.auditRun }}</Button>

<!-- 纯图标：绝不把 <Icon> 放进默认插槽（会让 isIconOnly 恒假，尺寸档位与无障碍名派生全部失效） -->
<Button class="grc-item-fix" variant="ghost" size="xsmall" dense
  icon="pencilOutline" :title="i18n.ruleFixOpen" @click.stop="emit('openFix', row)" />
```

**⚠️ 迁移陷阱**
1. `Button.icon` 类型是 `IconKey`（注册表键名），**不能**原样搬运 `mdi:pencil-outline`。
2. 纯图标按钮必须给 `title` 或 `aria-label`（现有 3 处已有 `title`，迁移后保留）。
3. 删除 `import { Icon } from "@iconify/vue"` 前必须 grep 模板 `<Icon` —— 残留时 lint 与 typecheck **都不报错**（静默漏改）。

---

### 3.2 🔴 原生表单控件未走共享组件（2 处）

| 位置 | 现状 | 目标组件 |
|------|------|---------|
| `ViolationListSection.vue:11-16` | `<label class="grc-select-all"><input type="checkbox" :checked="allSelected" @change="toggleSelectAll"> 文案</label>` | `Checkbox`（`binary` + `label`） |
| `ViolationListSection.vue:44-50` | `<input type="checkbox" class="grc-item-check" :checked="selectedKeys.has(row.key)" @change="toggleSelect(row.key)">` | `Checkbox`（`binary`，仅图标无文案 → 必须 `ariaLabel`） |

**违反**：`AGENTS.md` 复用清单——「复选框」必须使用共享组件。

**目标写法**

```vue
<Checkbox class="grc-select-all" binary size="xsmall"
  :model-value="allSelected" :label="i18n.ruleCheckSelectAll"
  :title="i18n.ruleCheckSelectAll" @update:model-value="toggleSelectAll" />

<Checkbox binary size="xsmall"
  :model-value="selectedKeys.has(row.key)"
  :aria-label="i18n.ruleCheckBatchFix" :title="i18n.ruleCheckBatchFix"
  @update:model-value="toggleSelect(row.key)" />
```

**⚠️ 迁移陷阱（已实证，必须遵守）**
1. **`Checkbox` 是纯受控组件**：`checked` 完全取自 `props.modelValue`（`Checkbox.vue:165-170`），内部只 `emit` 不写状态，并在 `nextTick` 把 DOM 拉回受控值（`:191-198`、`:218`）。必须用 `:model-value` + `@update:model-value`，**不可用 `v-model` 之外的本地状态兜底**。
2. **不接受 `Set`**：`modelValue` 类型为 `boolean | any[]`（`Checkbox.vue:92`），分组模式只认数组（`:205-211` 用 `filter` / 展开）。本处逐行传布尔（`binary` 模式），`selectedKeys` 因此**保持 `Set` 不变**，无需改判据与业务逻辑。
3. **事件名不是 `@change` 而是 `@update:model-value`**：载荷为 `boolean | any[]` 并集（`Checkbox.vue:136`）。本处 handler 沿用「忽略载荷、按当前态翻转」的原有语义（与改造前的 `@change="toggleSelect(row.key)"` 完全一致），`selectedKeys` 仍以「复制 → 整体替换」方式更新，响应式触发不受影响。
4. **`title` 不是声明的 prop**：它会经 Vue 单根默认透传落到 `.si-checkbox` 根 `div`（`Checkbox.vue:3` 单根且无 `inheritAttrs: false`），用于 hover 提示；**无障碍名必须走 `ariaLabel` prop**（绑定到原生 input，`Checkbox.vue:24`/`:126`），`title` 不能充当可访问名。
5. **`.grc-select-all` 不能靠自身类名取胜**：Checkbox 的样式是 scoped（`.si-checkbox[data-v-*]` = (0,2,0)），原 `.grc-select-all` 的 `display/gap/font-size/cursor` 会被组件规则压过，属「半失效遗留类」⇒ 迁移时把布局声明整体交还组件（xsmall 档内建 10px 字号与 6px 间距），只保留原有 `opacity: 0.75`，并抬到 (0,4,0)。

---

### 3.3 🟡 自建徽标未走共享 `Tag`（2 处）

| 位置 | 现状类名 | 目标 |
|------|---------|------|
| `ViolationListSection.vue:7` | `.grc-section-count`（标题右侧计数徽章） | `Tag variant="primary" size="xsmall" shape="square"` |
| `ViolationListSection.vue:58` | `.grc-item-reason`（违规原因胶囊） | `Tag variant="warning" size="xsmall" shape="circle"` |

**违反**：`AGENTS.md` 复用清单——「标签 / 徽标」必须使用共享组件。

**⚠️ 迁移陷阱**
1. 计数徽章**不要用 `content` prop**：`Tag.content` 对超过 `max`（默认 99）的数字会折叠为 `99+`，违规数可能破百 ⇒ 用**默认插槽**渲染原始计数。
2. `variant` 只有 `Tag.vue:57-67` 的 10 个合法值，**禁止自造颜色类**（`warning` ≡ `warn`、`danger` ≡ `error` 为同义别名）。
3. 观感微差需登记（见 §四）。

---

### 3.4 🟡 `Button.icon` 前置能力缺口：1 个图标未注册

**证据**：`mdi:clipboard-check-outline` 未在 `src/components/kit/icons.ts` 注册，而它是分析按钮的业务图标（现以裸 `<Icon>` 使用）。迁移到 `Button.icon`（要求 `IconKey`）前必须补注册。

**处置**：在 `COMMON_ICONS` 的「通用动作补充」分区新增 `clipboardCheckOutline: { icon: "mdi:clipboard-check-outline" }`（`IconKey` 于 `icons.ts:940` 自动派生，真源单点改动 + `pnpm validate:icons`）。

**同文件其余图标已就位**：`pencilOutline`(L867)、`deleteOutline`(L864)、`sparkles`≡`mdi:auto-fix`(L794)、`loading`(L523)。

> `index.vue` 的两处裸图标（`mdi:source-repository` / `mdi:check-decagram`、`mdi:clipboard-check-outline`）随 `EmptyState` 的 `icon` 字符串传递，属模块通行做法，不属本类违规、不改。

---

### 3.5 🟢 违规行唯一键 3 处重复拼接

**证据**：`` `${v.projectId}-${v.hash}-${v.reason}` `` 在 `ViolationListSection.vue` 出现 3 次——`:147`（`toggleSelectAll`）、`:152`（`openBatch`）、`:172`（`pagedRows`），另有 `:43`/`:108-110`/`:128` 三条注释解释同一格式。

**违反**：`AGENTS.md`「同一常量/工具函数被 2 个以上文件使用时必须提取」；此处虽在同一文件内，但三处独立拼接已成「隐式契约」，行 `key`、选中集 `key`、批量筛选三者必须永远一致，散落即隐患。

**处置**：提取组件内纯函数 `violationKey(v: CommitRuleViolation)` 作为唯一事实源（落位判据见 §四）。

---

### 3.6 🟢 迁移后失效的样式覆写与死样式

| 位置 | 问题 |
|------|------|
| `CommitRuleCheckPanel.scss:266-275` | `.grc-item-fix / .grc-item-drop` 覆写 `padding/border-radius/opacity` 现为 (0,1,0)，迁移到共享 `Button` 后**必输**于 dense 档位规则（`.si-button--dense.si-button--xsmall[data-v-*]`） |
| `CommitRuleCheckPanel.scss:133-135` | `.grc-select-all input[type="checkbox"] { accent-color }` 迁移后只会命中 Checkbox 内部**视觉隐藏**的原生 input（1px + `opacity: 0`），成为**无视觉效果的死样式** |
| `CommitRuleCheckPanel.scss:144-149` | `.grc-item-check`（`margin: 0` / `accent-color` / `cursor`）整块被共享 `Checkbox` 接管后**全部失效** |

**处置**：覆写统一抬到 (0,4,0)（`.grc-panel` 作前缀，与模块既有 `ListViewToolbar.scss:24` / `:65` 同写法），死样式删除。

---

## 四、假阳性排除与允许自建登记

### 4.1 假阳性排除（明确不改）

| 项 | 判据 |
|----|------|
| 裸 `<Icon icon="mdi:*">` | 全项目通行写法，上一轮报告已排除；`setupIconifyOffline()` 已预载图标集 |
| 每组件各自 `@use "../../styles/CommitRuleCheckPanel.scss"` + `"../../styles/index.scss"` | **全模块范式**：`styles/index.scss` 只聚合 `Buttons/Shared/Dialog/Form`，**不聚合任何面板分片**（`styles/index.scss:1-6`），故分片必须由消费组件自行引入。模块内 `@use "../../styles/index.scss"` 62 个文件、面板分片 ≥74 个文件；上一轮报告亦仅登记「@use 基线不一致」 |
| `i18n: Record<string, any>` 逐层透传 | 模块内 **94 个文件**同写法（含 `types/cardServices.ts:24` 最新 DI 范式），上一轮报告「改动面大，本轮仅登记」 |
| 组件内 `Set<string>` 选择态 | 为 `Checkbox` 保持布尔载荷的最自然载体；换成数组会连带改写 `allSelected` 判据与 `openBatch` 筛选，属无收益改造 |
| `complianceRate` 无除零兜底 | 父级 `index.vue:46` 以 `stats.totalCommits === 0` 前置拦截，仅在 `> 0` 时渲染，非缺陷（已有注释说明） |

### 4.2 允许自建例外登记

| 项 | 依据 |
|----|------|
| **KPI 卡片容器**（`.grc-cards / .grc-card / .grc-card-value / .grc-card-label`，`RuleCheckOverview.vue:5-21`） | 共享 `Card.vue` 的结构语义是 header(title/subtitle) + cover + body + footer，无「大数值 + 小标签」原语（`Card.vue:92-127` 无对应 props），迁移只能靠大量覆写且仍要自绘字号/居中；属规则允许的「纯展示的局部布局容器」。模块内已有同构范式 `styles/_mixins.scss:137-166` 的 `stat-card*` |
| **复合 chip**（`.grc-reason-chip` + `.grc-reason-chip-num`，`ReasonDistributionSection.vue:10-17`） | 内容为「原因文案 + 计数圆片」两个语义层级，`Tag` 无等价形态（其计数语义入口 `content` 会折叠为 `99+`，会损失真实计数）⇒ 登记为组件库缺口，保留自建 |
| **按钮内计数徽章**（`.grc-select-count`，`ViolationListSection.vue:28-31`） | 随文案同行的小号等宽数字（`$ff-mono` + `tabular-nums`），非独立徽标；塞入 `Tag` 会引入内边距与描边、在 dense 按钮里撑高 |
| **列表行骨架**（`.grc-list / .grc-item / .grc-item-head / .grc-item-msg / .grc-item-meta`） | 纯展示的局部布局容器，规则明确允许自建（同上一轮报告 §L291） |
| **区块标题**（`.grc-section-title / .grc-reason-title`，`@include gp-label-base`） | 纯展示排版原语，模块范式 |

### 4.3 「加载更多」分页维持现状（本轮新增判据）

`usePagedList` + `LoadMoreButton` 是模块统一的**渐进加载**模式（`ViolationListSection.vue:88-94/159-166`、`LogPanel/index.vue:50/128-135`、`CommitAnalysis/RecentCommitsSection.vue:40/81-87`、`RepoCleanPanel/LargeBlobSection.vue:44/80-87`），与「页码分页器」（`Paginator`）不是同一交互场景；`Paginator` 在 gitPush 模块内使用数为 **0**。本轮**不改**，以免制造目录间不一致。

### 4.4 跨文件键格式重复（范围外，登记待办）

`components/common/BatchFixDialog.vue:422` 独立复制了同格式的行键 `` `${t.projectId}-${t.hash}-${t.reason ?? ""}` ``（**未** import 本目录函数）。该文件位于 `common/`，不在本轮审查范围；且 `utils/` 现有 12 个模块按「项目/平台/文件状态/差异/输出/分析/格式化/指标/搜索/运行时/错误」分域，**无规则检查归属模块**，新建模块属独立设计决策。

⇒ 本轮把键函数落在**消费侧组件内**（`ViolationListSection` 是唯一的行键生产者），并登记待办：`BatchFixDialog` 对齐与落位 `utils/` 需另立小任务（建议与 `commitRuleChecker.ts` 域一并考虑）。

---

## 五、改动清单

| 文件 | 改动 |
|------|------|
| `src/components/kit/icons.ts` | 新增 `clipboardCheckOutline`（供迁移后的分析按钮 `icon` prop 使用） |
| `components/CommitRuleCheck/RuleCheckToolbar.vue` | 分析按钮 → `Button`（`ghost/xsmall/dense` + `:loading`）；移除 `@iconify/vue` 导入 |
| `components/CommitRuleCheck/ViolationListSection.vue` | 全选与行内复选框 → `Checkbox`（`binary`）；批量修正/修正/删除 3 个按钮 → `Button`；提取 `violationKey()`；移除 `@iconify/vue` 导入与 `.grc-item-check` 类 |
| `styles/CommitRuleCheckPanel.scss` | 删死样式（`.grc-select-all` 布局与子规则、`.grc-item-check`）；`.grc-select-all` 保留 `opacity` 并抬到 (0,4,0)；`.grc-section-count` / `.grc-item-reason` / `.grc-item-fix` / `.grc-item-drop` 覆写抬到 (0,4,0)、交还几何给共享组件 |
| `components/CommitRuleCheck/index.vue`、`RuleCheckOverview.vue`、`ReasonDistributionSection.vue` | 无需改动（合规 / 登记例外） |

**有意的观感变化（记录在案）**

| 项 | 变化 | 原因 |
|----|------|------|
| 徽章配色 | 自绘色值 → `Tag` 的 `variant` 体系（`primary` / `warning`），并按默认外观补上 20% 同色描边 | 对齐共享库标准徽标观感；色相一一对应，无色系偏移（沿用上一轮报告 §7.4 同类登记） |
| 批量修正按钮图标 | `mdi:auto-fix` 继承文字色 → `sparkles`（同图标，注册表带 `#a855f7` AI 强调色） | `Button.icon` 只接受 `IconKey`；模块内 AI 类按钮已统一用 `sparkles`（`ListView/WorkingTreePanel.vue:197`、`StashSection.vue:31`、`OutputPanel.vue:47`） |
| 分析按钮加载态 | 手写 `gp-spin` 旋转图标 → `Button` 内置 spinner（保宽、绝对居中、自动禁用） | 与模块其余加载按钮统一（`AiErrorAnalysisDialog.vue:124-130`） |
| 全选复选框 | 原生控件 + `accent-color` → `Checkbox` 自绘方框（尺寸 14px、内建主色填充） | 共享组件标准外观；字号与间距档位已对齐原样式 |
| 计数/原因徽章几何 | 计数徽章 padding `0 6px` → Tag xsmall `1px 4px`；原因胶囊 padding `0 6px` → circle `1px 5px` | 采用共享组件档位几何，差异 ≤1px |

**业务行为零改动**：分页重置、选中清空、分析触发、弹窗回调（`runAnalysis` / `updateCount` / `updateProject` / `viewProject` / `openFix` / `openDrop` / `openBatchFix`）与父子契约全部保持不变。

---

## 六、验证结果

| 检查 | 结果 |
|------|------|
| `read_lints` | ✅ 0 诊断（4 个改动文件） |
| `pnpm typecheck`（vue-tsc --noEmit） | ✅ exit 0（`.vue` props 类型经 vue-tsc 校验，非 `tsc`） |
| `pnpm validate:icons` | ✅ 233 个图标全部有效（本轮新增 `clipboardCheckOutline`，较此前 232 增加 1 个） |
| `pnpm i18n:verify` | ✅ 4500 个叶子键中英对齐、无重复键（本轮未增删 i18n 键） |
| 残留断言 | ✅ CommitRuleCheck 目录内 `vp-btn` / `type="checkbox"` / `@iconify/vue` / 裸 `<Icon` / `grc-item-check` **全部 0 命中** |
| 模块文档同步 | ✅ `gitPush/README.md` 无需改动：文件职责清单未变（未新增/改名文件），`Buttons.scss` 仍服务模块其余目录、`gp-spin` 仍被 `common/` 弹窗使用，登记项依旧有效 |
| `pnpm lint` / `pnpm vite build` | ⏳ 由用户执行 |
