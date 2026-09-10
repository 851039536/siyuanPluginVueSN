# AI 内容生成模块 —— 共享组件合规审查报告

审查对象：`src/features/aiContentGenerator/`（12 个 `.vue` + 13 个 `.scss` + 5 个 composable + `types` / `modules`）
审查依据：`AGENTS.md § 共享组件库使用规则（强制）`、`§ 硬规则`、`AGENTS_STYLE.md § 强制规则：按钮交互与无障碍`、`AGENTS_I18N.md § 强制规则：禁止 i18n 硬编码兜底值`
审查日期：2026-09-10

---

## 一、结论摘要

| 维度 | 违规数 | 严重度 | 处置 |
|---|---|---|---|
| 图标体系（自建图标组件 + 内联 sprite） | 1 个组件 + 30 处内联 `<svg>` | P0 | 全部改走 `IconWrapper` + `IconKey` |
| 表单控件（原生 select / input / checkbox） | 6 处 | P0 | 改走 `Select` / `Input` / `Switch` |
| 自建按钮（原生 `<button>`） | 12 处（含 1 处合规例外） | P1 | 11 处改走 `Button`，1 处保留 |
| 硬编码 UI 中文文案 | 约 62 处 | P1 | 改走 i18n 分片（zh_CN / en_US 同步） |
| 文件头注释缺失 | 1 处（`index.vue`） | P2 | 补齐 |
| 单文件行数 | 1 处超 300 警戒线（`MainContentArea.vue` 375 行） | P2 | 抽出 `ResultActionsBar.vue` |
| 功能注册清单（8 步） | 0 | — | 链路完整，不涉及 |

`src/components/` 共享组件本次**零改动**：经逐一核对，`Button` / `Select` / `Input` / `Switch` 的现有 props 已覆盖本模块全部需求，因此不触发 `componentPreview/previewData` 同步要求，改动半径锁死在 `aiContentGenerator` 内。

> 实际实施时 `Select` 暴露了两项能力缺口（已选项富内容、附加检索词），按规则「缺能力时先扩展共享组件」做了**向后兼容**扩展，并同步了预览清单——见 § 八「共享组件扩展」。

---

## 二、P0-A：图标体系

### 违规点

| # | 位置 | 问题 | 违反规则 |
|---|---|---|---|
| A1 | `components/SvgIcon.vue`（22 行） | 与共享 `src/components/IconWrapper.vue` 职责完全重叠；接受任意 `#iconXxx` 字符串而非 `IconKey`，绕过图标注册体系。全项目**仅此一份** | 共享组件库规则 § 2「需要图标时必须使用共享组件」 |
| A2 | 30 处内联 `<svg><use xlink:href="#iconXxx">`（见下表） | 绕过统一图标入口，且与 `SvgIcon` 形成**两套并存方案** | 同上 |
| A3 | `types/index.ts:34-84` `ACTION_META[].icon: string` | 类型为裸字符串，注释明写「思源内置图标 symbol id（含 # 前缀）」，TS 无法约束合法性 | 硬规则「图标注册」 |
| A4 | `modules/AIContentGenerator.ts:91-95` `registerIcons()` | 通过 `plugin.addIcons()` 注入自定义 `#iconColumns` symbol（仅 `MainContentArea.vue:79` 使用） | 同上 |

### 内联 SVG 分布（30 处）

| 文件 | 处数 | 行号 | `#iconXxx` |
|---|---|---|---|
| `components/MainContentArea.vue` | 14 | 17-23, 50-53, 63-66, 76-79, 90-93, 108-111, 125-129, 144-148, 162-166, 174-177, 187-190, 201-204, 213-216, 268-272 | `#iconCloseRound`(48) `#iconTime`(11) `#iconEye`(14) `#iconColumns`(14) `#iconSparkles`(14) `#iconClose`(14) `#iconCheck`(14) `#iconAdd`(14) `#iconUndo`(14) `#iconCopy`(14) `#iconSparkles`(14) `#iconRefresh`(14) `#iconTrashcan`(14) `#iconSparkles`(22) |
| `components/BottomInputArea.vue` | 8 | 18, 27, 43, 62, 79, 126, 152, 162 | `#iconFile`(14) `#iconEdit`(14) `#iconClose`(12) `#iconSearch`(12) 动态 `action.icon`(12) `#iconCheck`(11) `#iconSparkles`(16) `#iconClose`(16) |
| `components/SkillSection.vue` | 3 | 27-31, 40-43, 51-54 | `#iconDown`(10) `#iconEye`(11) `#iconSearch`(12) |
| `components/ReviewPanel.vue` | 6 | 8, 35, 49, 131, 173, 194 | 经 `SvgIcon` 间接使用 |
| `components/CollapsibleSection.vue` | 2 | 8-15, 16-20 | `#iconRight`(12) 动态 `icon` prop(14) |
| `components/ContentAreaEmpty.vue` | 1 | 4-10 | `#iconSparkles`(48) |
| `components/SkillPreviewModal.vue` | 1 | 22-25 | `#iconClose`(16) |
| `components/SvgIcon.vue` | 1 | 3-7 | 动态 `name` prop |

> `ReasoningSection.vue:6`（`icon="#iconSparkles"`）与 `SearchResultsSection.vue:6`（`icon="#iconSearch"`）不直接写 `<svg>`，而是以 prop 传给 `CollapsibleSection`。

### 图标映射表（sprite → IconKey，已逐一核实存在）

| 现用 sprite | 目标 IconKey | 现用 sprite | 目标 IconKey |
|---|---|---|---|
| `#iconFile` | `file` | `#iconAdd` | `plus` |
| `#iconEdit` | `edit` | `#iconUndo` | `refreshLeft` |
| `#iconClose` | `close` | `#iconCopy` | `copy` |
| `#iconCloseRound` | `cancel` | `#iconRefresh` | `refresh` |
| `#iconSearch` | `search` | `#iconTrashcan` | `delete` |
| `#iconSparkles` | `sparkles` | `#iconList` | `list` |
| `#iconCheck` | `check` | `#iconTime` | `timerOutline` |
| `#iconRight` | `chevronRight` | `#iconColumns` | `columns`（**需新增**） |
| `#iconDown` | `chevronDown` | `#iconMin` | `minus`（**需新增**） |
| `#iconEye` | `eye` | | |

`minus`（`mdi:minus`）与 `columns`（`mdi:view-column`）需补入 `src/config/icons.ts` 的 `COMMON_ICONS`；`IconKey = FeatureIconKey | CommonIconKey` 自动扩展，无需改类型定义。

### 改造动作

1. `src/config/icons.ts` → `COMMON_ICONS` 新增 `minus`、`columns`
2. `types/index.ts` → `EditActionMeta.icon: string` 改为 `IconKey`
3. 全模块 30 处内联 `<svg><use>` → `<IconWrapper :name="..." :size="..." />`
4. 删除 `components/SvgIcon.vue`（引用点仅 `ReviewPanel.vue` 6 处）
5. 删除 `modules/AIContentGenerator.ts` 的 `registerIcons()` 及 `init()` 中的调用

---

## 三、P0-B：表单控件

| # | 位置 | 原生元素 | 目标共享组件 | 关键能力对齐 |
|---|---|---|---|---|
| B1 | `BottomInputArea.vue:93-107` | `<select>` + `<optgroup>` ×2 | `Select.vue` | 分组用 `SelectGroupOption { isGroup: true, label, options }` |
| B2 | `BottomInputArea.vue:113-123` | `<select>`（思考强度 low/high/max） | `Select.vue` | 3 个普通 option |
| B3 | `BottomInputArea.vue:86-92` | `<input>`（自定义模型名） | `Input.vue` | `placeholder` + `v-model` |
| B4 | `BottomInputArea.vue:61-65` | `<label>` + `<input type="checkbox">`（联网） | `Switch.vue` | `xsmall` + 默认 slot（放图标+文字） |
| B5 | `BottomInputArea.vue:108-111` | `<label>` + `<input type="checkbox">`（思考） | `Switch.vue` | 同上 |
| B6 | `BottomInputArea.vue:124-127` | `<label>` + `<input type="checkbox">`（审核） | `Switch.vue` | 同上 |
| B7 | `SkillSection.vue:55-62` | `<input type="text">`（技能搜索） | 随整体替换为 `Select.vue filterable` | `filterable` + `filterPlaceholder` + `emptyText` |
| B8 | `SkillSection.vue:8-98` | 自建「触发器 + 下拉面板 + 点击外部关闭」整套（约 90 行） | `Select.vue` | `filterable` / `emptyText` / 点击外部关闭内置 |

> `BottomInputArea.vue:132-142` 已在用共享 `Input`（`type="textarea"`），无需改动。全目录无原生 `<textarea>`。

**B8 说明**：`SkillSection.vue` 自建了带搜索的下拉选择器（`skill-select-trigger` + `skill-dropdown` + `skill-search-input` + `handleClickOutside`），与 `Select.vue` 的 `filterable` 能力完全重复，是本次最典型的「feature 内自建同类控件」违规。替换后 `SkillSection.vue` 的 `document.addEventListener` 监听器随之移除，属净收益。

---

## 四、P1：自建按钮

| # | 位置 | class | 语义 | 目标 |
|---|---|---|---|---|
| C1 | `BottomInputArea.vue:71-81` | `.quick-action-btn`（v-for ×6） | 图标+文字快捷动作 | `Button variant="ghost" size="xsmall"` + `icon` |
| C2 | `MainContentArea.vue:57-68` | `.view-mode-btn` | 分段切换（预览） | `Button` + `text` 外观，选中态切 `variant` |
| C3 | `MainContentArea.vue:69-81` | `.view-mode-btn` | 分段切换（对比） | 同上 |
| C4 | `MainContentArea.vue:83-95` | `.view-mode-btn` | 分段切换（审查） | 同上 |
| C5 | `DiffPreview.vue:14-21` | `.mode-btn` | 分段切换（合并） | 同上 |
| C6 | `DiffPreview.vue:22-29` | `.mode-btn` | 分段切换（分栏） | 同上 |
| C7 | `ReviewPanel.vue:88-96` | `.issue-filter-btn`（v-for） | 筛选 chip 组（全部/高/中/低 + 计数） | `Button text` + 选中态 `variant` |
| C8 | `ReviewPanel.vue:126-136` | `.fix-issue-btn` | 行内定向修复 | `Button variant="primary" size="xsmall"` |
| C9 | `ReviewPanel.vue:167-178` | `.review-footer-btn` | footer 重新审核 | `Button variant="ghost" size="xsmall"` |
| C10 | `ReviewPanel.vue:188-199` | `.review-footer-btn.auto-fix-btn` | footer 自动修复 | `Button variant="primary" size="xsmall"` |
| C11 | `SkillSection.vue:34-44` | `.skill-preview-btn`（11×11 纯图标） | 预览技能细则 | `Button text` 纯图标 + `ariaLabel` |
| C12 | `SkillPreviewModal.vue:18-26` | `.skill-preview-close`（16×16 纯图标） | 关闭弹窗 | `Button text` 纯图标 + `ariaLabel` |
| C13 | `SkillPreviewModal.vue:36-39` | `.skill-preview-btn-close` | 关闭弹窗 | `Button variant="ghost"` |

### 判定为合规例外（保留原生 `<button>`）

| 位置 | class | 保留理由 |
|---|---|---|
| `CollapsibleSection.vue:4-30` | `.collapsible-toggle` | 折叠区块头部是「chevron + 图标 + 标题 + 状态点 + `headerRight` slot」的复合布局容器，非标准按钮控件；且全项目仅此一处使用（Rule of Three 未满足，不提升为共享组件）。**仅补 `aria-expanded` / `aria-controls`** |
| `ReviewPanel.vue:44-56` | `.subsection-toggle` | 与 `CollapsibleSection` 语义重复，改为**复用模块内 `CollapsibleSection`**，从而消除该处自建 `<button>` 与重复的折叠实现（DRY） |

### 样式死代码清单（替换后须同轮删除）

| SCSS 文件 | 待删选择器 |
|---|---|
| `styles/MainContentArea.scss` | `.view-mode-btn`(149)（`.view-mode-toggle`(140) 分组容器保留） |
| `styles/DiffPreview.scss` | `.mode-btn`(65)（`.diff-mode-toggle`(57) 分组容器保留） |
| `styles/ReviewPanel.scss` | `.subsection-toggle`(114)、`.subsection-chevron`(133)、`.issue-filter-btn`(193)、`.fix-issue-btn`(288)、`.review-footer-btn`(354)（`.issue-filter`(188)、`.review-footer-actions`(347) 分组容器保留） |
| `components/styles/BottomInputArea.scss` | `.quick-action-btn`(74)（`.quick-actions-bar`(66) 保留）、`.rag-toggle`(119)、`.thinking-toggle` / `.review-toggle`(206)、`.thinking-label`(244)、`.review-label`(252)、`.model-select`(176)、`.model-custom-input`(191)、`.reasoning-effort-select`(226) |
| `components/styles/SkillSection.scss` | `.skill-select-trigger`(10)、`.skill-select-value`(36)、`.skill-select-arrow`(58)、`.skill-preview-btn`(67)、`.skill-dropdown`(90)、`.skill-dropdown-search`(104)、`.skill-search-input`(112)、`.skill-dropdown-list`(126)、`.skill-dropdown-item`(132)、`.skill-item-main`(153)、`.skill-item-name`(159)、`.skill-dropdown-empty`(165)；`.skill-source-dots`(43) / `.source-dot`(50) 视 `Select` 的 option slot 方案保留或改造 |
| `components/styles/SkillPreviewModal.scss` | `.skill-preview-close`(51)、`.skill-preview-btn-close`(120) |

---

## 五、P1：硬编码中文文案（约 62 处）

> 仅 UI 文案需 i18n 化。业务枚举键（`ReviewPanel.vue` 的 `RATING_CLASS_MAP` / `sevKeyMap` 键名）、传给 AI 的 prompt 文案（`ACTION_META[].prompt` / `reviewLabel`、`DEFAULT_SYSTEM_PROMPTS`、`reviewPrompt`）、`console.*` 日志**不在本次 i18n 范围内**。

| 文件 | 处数 | 行号 |
|---|---|---|
| `index.vue` | 5 | 236, 247, 259, 265, 273（`showMessage` 提示 + `executeGeneration` 名称） |
| `components/MainContentArea.vue` | 14 | 39, 60, 67, 73, 80, 103, 112, 117, 130, 135, 153, 169, 196, 208 |
| `components/BottomInputArea.vue` | 26 | 15, 19, 24, 28, 34, 40, 61, 64, 90, 99, 100, 103, 106, 108, 110, 117, 120, 121, 122, 124, 126, 156, 257, 258, 262, 263 |
| `components/ContentAreaEmpty.vue` | 4 | 12, 17, 21, 25 |
| `components/DiffPreview.vue` | 5 | 6, 17, 20, 25, 28 |
| `components/SkillSection.vue` | 5 | 10, 25, 37, 59, 70, 95（6 处） |
| `components/SkillPreviewModal.vue` | 2 | 35, 39 |
| `components/ReasoningSection.vue` | 1 | 5（`title="思考过程"`） |
| `components/SearchResultsSection.vue` | 1 | 5（`title="搜索来源"`） |
| `components/ReviewRadarChart.vue` | 1 | 9（`aria-label="分项评分雷达图"`） |
| `types/index.ts` | 6 | 49, 55, 61, 67, 73, 79（`ACTION_META[].label`，须改为 `labelKey`） |

现状：该 feature 分片文件已有 27 个键（全部 `review*` / `directReview*`），其余文案未 i18n 化。

**约束**：只改分片 `src/i18n/{zh_CN,en_US}/aiContentGenerator.json`，禁止手改顶层 `zh_CN.json` / `en_US.json`；键名沿用**扁平无前缀**风格；模板中每处 i18n 使用位置上方补中文 HTML 注释；禁止 `|| '中文兜底'`。

---

## 六、P2：其余硬规则

| 项 | 详情 | 处置 |
|---|---|---|
| 文件头注释缺失 | 仅 `index.vue`（第 1 行直接是 `<template>`）。其余 22 个 `.ts`/`.vue` 均有 | 补 `<!-- ... -->` 头部说明 |
| 单文件行数 | `components/MainContentArea.vue` 375 行（>300 警戒线，未破 500 硬阈值） | 抽出 `ResultActionsBar.vue`（8 个操作按钮），主文件降至 281 行 |
| 跨组件 scoped 样式失效隐患 | `ReviewPanel.vue:184` 使用 `.dot-flashing`，但该类定义在 `MainContentArea.scss:91`，而 `ReviewPanel.vue` 的 `<style>` 只 `@use` 了 `ReviewPanel.scss` + `index.scss` | 改造时将 `.dot-flashing` 上移至共享 `styles/index.scss` |
| 行数警戒线（改造后仍未达 300 以下，未破 500 硬阈值） | `index.vue` 349 行（改造前 347，为既有超标项）；`components/BottomInputArea.vue` 319 行（改造前 251，因模板改用共享组件后 props 展开而增长） | 本次未拆分（计划仅指定拆分 `MainContentArea.vue`）。后续如需收敛，建议将「模型选择 + 思考开关 + 思考强度 + 审核开关」整块抽为 `GenerationOptionsBar.vue`，预计主文件降至约 225 行 |

---

## 七、本次不处理的既有问题（记录备查）

| 位置 | 问题 | 不处理理由 |
|---|---|---|
| `components/ReviewRadarChart.vue`（181 行 + 77 行 SCSS） | 自建 SVG 雷达图，未使用共享 `Chart.vue`（规则要求「图表必须用共享组件」） | 共享 `Chart.vue`（chart.js）当前仅注册 line/bar/pie/doughnut/area 控制器，**不支持 radar**；本次声明的改造范围为「按钮类 / 表单控件类 / 图标体系 / 注释文案」，图表类未纳入。若需合规，应为 `Chart.vue` 扩展 `radar` 类型（注册 `RadarController` + `RadialLinearScale`，同步 `previewData/display.ts` 与 `componentPreview/README.md`），再删除本文件 |
| `DiffPreview.vue` 的 `diffStats` computed | 对全文跑 `diff-match-patch`（O(ND)），大文档下有热点风险 | 性能问题，与「共享组件合规」无关；已在原实现注释中说明用途 |
| `toolCollection/tools/{wordQuery,unitConverter,deepSeekCost,base64Image}/index.vue` | 同类自建 `.mode-tab` / `.dc-tab` / `.converter-tab` 分段按钮 | 本次范围锁定 `aiContentGenerator`，避免跨 feature 扩大回归面 |
| `composables/*.ts` 的 `showMessage` 中文提示 | 约 50 处中文提示未 i18n（`index.vue` 的 4 处已随本次改造 i18n 化） | 属逻辑层提示文案，与「通用组件审查」主题不同；建议单独立项 |

---

## 八、改造结果

### 新增 / 删除 / 修改

| 类型 | 文件 |
|---|---|
| 新增 | `components/ResultActionsBar.vue`（从 `MainContentArea.vue` 抽出的结果操作按钮组） |
| 删除 | `components/SvgIcon.vue`（职责与共享 `IconWrapper` 重叠） |
| 修改（模块内） | `index.vue`、`README.md`、`types/index.ts`、`modules/AIContentGenerator.ts`、`components/{MainContentArea,BottomInputArea,SkillSection,SkillPreviewModal,ReviewPanel,DiffPreview,CollapsibleSection,ContentAreaEmpty,ReasoningSection,SearchResultsSection,ReviewRadarChart}.vue`、`styles/{index,MainContentArea,DiffPreview,ReviewPanel}.scss`、`components/styles/{BottomInputArea,SkillSection,SkillPreviewModal}.scss` |
| 修改（图标 / 文案资源） | `src/config/icons.ts`（`COMMON_ICONS` 新增 `minus` / `columns`）、`src/i18n/{zh_CN,en_US}/aiContentGenerator.json`（26 → 90 键） |

### 共享组件扩展（已按规则同步预览清单）

改造中发现 `Select` 缺少两项能力，按「缺能力时先扩展共享组件」处理（向后兼容，不传时行为不变）：

| 扩展 | 内容 | 同步位置 |
|---|---|---|
| `#selected` 插槽 | 作用域 `{ option }`，用于已选项富内容（技能名 + 来源工具色点）；不传时回退纯文本 | `componentPreview/README.md` § 具名插槽 |
| `SelectOption.keywords?: string` | `filterable` 的附加检索词（标签之外的别名/描述），保留原自建下拉的多字段检索能力 | `previewData/control.ts` 新增「关键词筛选（keywords）」示例 + `componentPreview/README.md` |

### 量化结果

| 指标 | 改造前 | 改造后 |
|---|---|---|
| 内联 `<svg><use xlink:href="#iconXxx">` | 30 处 | 0 处（`ReviewRadarChart` 的图表 SVG 除外，非图标用途） |
| 原生 `<button>` | 13 处 | 1 处（`CollapsibleSection` 折叠头，已判定为合规例外） |
| 原生 `<select>` / `<input>` / `<input type="checkbox">` | 6 处 | 0 处 |
| 硬编码 UI 中文文案 | 约 62 处 | 0 处（模板与 `showMessage` 提示均已 i18n 化） |
| 模块内 `IconKey` 之外的图标引用 | `ACTION_META[].icon` 为裸字符串 | 0 处（类型收敛为 `IconKey`） |
| `MainContentArea.vue` | 375 行 | 281 行 |
| 死代码 SCSS 类 | — | 已全部清理（含无引用的 `ai-spinner-rotate` 关键帧） |

### 已核实的关键约束

- `src/components/` 除 `Select.vue` 的上述两项向后兼容扩展外，无其他改动
- i18n 仅改分片文件；已执行 `pnpm i18n:merge` 重新生成顶层合并文件（zh_CN / en_US 均为 1059 个顶层键，一一对齐）
- 未触碰 8 步功能注册清单；未改动其他 feature 的同类遗留
- 未执行 `pnpm vite build` / `pnpm lint` / `npx tsc --noEmit`

## 九、验收清单

改造后由用户执行：

```bash
pnpm lint            # ESLint 代码规范
pnpm i18n:verify     # 中英文键对齐
pnpm validate:icons  # 图标注册有效性
npx tsc --noEmit     # TypeScript 类型检查
```

人工回归要点：
1. Dock 面板打开 → 选择文档/块 → 6 个快捷动作按钮可点且图标正确
2. 模型下拉（常用/全部/自定义）与思考强度下拉可选，自定义模型名可输入
3. 联网 / 思考 / 审核三个开关可切换且状态持久化（重启后保持）
4. 生成后：预览 / 对比 / 审查三个 Tab 可切换，选中态可见
5. 技能选择器可搜索、可选中、点击外部可关闭；技能预览弹窗可开关
6. 审核面板：分项评分可折叠、严重度筛选可切换、定向修复 / 重新审核 / 自动修复按钮可用
7. 空状态三步引导文案与英文环境（切思源语言为 English）显示正常
