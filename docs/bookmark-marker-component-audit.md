# 书签标记模块 —— 共享组件合规审查报告

审查对象：`src/features/bookmarkMarker/`（2 个 `.vue` + 2 个 `.scss` + `index.ts` / `modules/` / `composables/` / `types/` / `utils.ts`）
审查依据：`AGENTS.md § 共享组件库使用规则（强制）`、`§ 硬规则`、`§ 子组件数据流规则（强制）`、`AGENTS_I18N.md`、`AGENTS_STYLE.md`
审查日期：2026-09-10

---

## 一、结论摘要

| 维度 | 违规/缺陷数 | 严重度 | 处置 |
|---|---|---|---|
| 共享组件违规（原生 button/select/input/radio/range/label/chip） | 29 处 | P0 | 改走 `Button` / `Select` / `Input` / `Slider` / `Tag` / `Label` / `ColorField` |
| **取色器功能缺陷**（原生 `input[type=color]` 在思源不弹窗） | 2 处 | **P0（功能不可用）** | 提升 `generalSettings/ColorField` 为共享组件后替换 |
| 类型弱化（`any` / 裸 `string` 联合） | 9 处 | P1 | 收敛为具名联合类型与接口 |
| 运行时缺陷（unhandled rejection / 写放大 / key 复用） | 6 处 | P1 | 补异常兜底、解耦「输入」与「提交」、key 改对象身份 |
| 数据流（`RuleItem` 直接 mutate props） | 7 处 | P1 | 改 `patch` + `commit` 双事件契约 |
| 文件头注释不在文件顶部 | 2 处 | P2 | 移到文件第 1 行 |
| 单文件行数 | 1 处超 300 警戒线（`RuleItem.vue` 422 行） | P2 | 拆出 3 个子组件 |
| i18n 结构与其它 feature 不一致 | 1 处（29 键嵌套） | P2 | 改扁平，9 个重名键重命名 |
| 功能注册清单（8 步） | 0 | — | 链路完整，不涉及 |

---

## 二、P0-A：共享组件违规清单

### `index.vue`（面板编排）

| # | 行号 | 现状 | 目标共享组件 |
|---|---|---|---|
| A1 | 14-22 | 原生 `<button class="close-btn">` 内嵌 `IconWrapper`（纯图标关闭） | `Button variant="ghost" text size="xsmall" icon="close"` + `aria-label` |
| A2 | 62-71 | 原生 `<button class="add-rule-btn">` 内嵌图标 + 文案，虚线边框整块按钮 | `Button variant="primary" outlined size="small" icon="plus" block` |
| A3 | 80-101 | 原生 `<select class="interval-select">` + 4 个 `<option>`（值 `1800000/3600000/7200000/14400000`） | `Select`（`SelectOption[]` 由 i18n 键生成） |
| A4 | 77-79 | 裸 `<label class="interval-label">`（`display: block` + `$font-size-sm`） | `Label size="small"` |

### `components/RuleItem.vue`（规则卡片）

| # | 行号 | 现状 | 目标共享组件 |
|---|---|---|---|
| B1 | 7-15 | 原生 `<button class="rule-remove-btn">` 内嵌 `IconWrapper`（22×22 纯图标） | `Button variant="ghost" text size="xsmall" icon="close"` + `aria-label` |
| B2 | 21-35 | 手写 chips：`.tag-chip` + `.tag-text` + `<span class="tag-remove">×</span>`（**用文本 `×` 当图标**） | `Tag size="xsmall" variant="primary" closable` + `@close` |
| B3 | 37-44 | 原生 `<input type="text" class="tag-input">`（chips 容器内的无边框内联输入） | `Input` + **新增可选属性 `borderless`**（共享 `Input` 自带 wrapper 边框，直接内嵌会双层边框） |
| B4 | 55-62 | 原生 `<input type="text" class="rule-input icon-input" maxlength="2">` | `Input size="small"`（`maxlength` 可透传） |
| B5 | 83-89 | `<span class="icon-option" @click>` 作预设图标选择项（39 个 emoji 字形） | `Button text` + 选中态切 `variant="primary"`（emoji 作为按钮**文本内容**，非图标 prop） |
| B6 | 99-111 | 原生 `<input type="color" class="color-picker">` + `<input type="text" class="color-text">`（文字颜色） | 共享 `ColorField`（见 § 三） |
| B7 | 121-133 | 原生 `<input type="color">` + `<input type="text">`（背景颜色） | 共享 `ColorField`（见 § 三） |
| B8 | 143-210 | 原生 `<input type="radio">` ×4（显示模式 bg/icon/icon-bg/row，藏在 `<label class="mode-option">` 里 `display: none`） | `Button` 分段组（`text` 外观 + `variant` 切换选中态；`icon` 走 `file`/`image`/`format`） |
| B9 | 239-277 | 原生 `<input type="radio">` ×3（匹配模式 exact/prefix/contains） | 同上（无图标） |
| B10 | 220-228 | 原生 `<input type="range" class="alpha-slider">` + 手写 `<span class="alpha-value">` 百分比 | `Slider`（`min=0 max=1 step=0.05` + `show-value` + `formatValue`） |
| B11 | 21/50/79/95/117/139/216/235 | 裸 `<label class="rule-label">` ×8（`width: 70px`，`$font-size-xs`=12px） | `Label size="small" width="70px"` |

**已核实的 IconKey 可用性**（`src/config/icons.ts`）：`close`(423)、`check`(426)、`plus`(480)、`refresh`(498)、`file`(619)、`image`(631)、`format`(743)、`bookmarkMarker`(278) 均已注册，本次**无需新增图标键**。

### 冗余：8 处 `.rule-label` 宽度 + 12px 字号

`.rule-label` 的 `flex-shrink: 0; width: 70px; font-size: $font-size-xs` 与共享 `Label` 的 `width` prop + `size="small"` 完全对应，替换后 `.rule-label` 样式可整块删除。

---

## 三、P0-B：【功能缺陷】原生取色器在思源不弹窗

`RuleItem.vue:99-111` 与 `:121-133` 使用原生 `<input type="color">`。在思源 Electron 环境中**点击色块不会弹出取色器**，用户只能通过旁边的 hex 文本框手输颜色，文字色/背景色的「点选」能力实际不可用。

### 源码级证据

`src/features/generalSettings/components/ColorField.vue:1` 文件头注释原文：

> 颜色字段：色块弹出自绘预设调色板 + 文本输入框双向联动（**思源 Electron 环境不弹出原生 `input[type=color]` 取色器**，故改用自绘调色板），供代码块/标题/表格/列表样式设置复用

该组件已在本项目中验证可用，但位于 `generalSettings/components/` 之下，而 `AGENTS.md` 禁止跨 feature 导入，因此 `bookmarkMarker` 无法直接复用 → 只能走「**提升为共享组件**」路线。

### 处置

把 `generalSettings/components/ColorField.vue`（109 行）+ `generalSettings/styles/ColorField.scss`（76 行）提升为 `src/components/ColorField.vue` + `src/components/styles/ColorField.scss`：

| 步骤 | 内容 |
|---|---|
| 1 | 复制为共享组件（SCSS 已确认仅依赖 `@/variables.scss` 通用 Token，无 feature 专属内容；头部注释保留「思源 Electron 不弹原生取色器」结论） |
| 2 | 改 6 个 generalSettings 文件的 import：`TableStyleSettings.vue:147`、`ListStyleSettings.vue:198`、`HighlightSettings.vue:134`、`HeadingSettings.vue:237`、`DocCountSettings.vue:197`、`CodeBlockSettings.vue:321` |
| 3 | 删除 `generalSettings/components/ColorField.vue` 与 `generalSettings/styles/ColorField.scss`（避免两份副本） |
| 4 | 同步预览清单：新增 `previewData/colorField.ts` 分组 + `previewData/index.ts` 聚合 + `componentPreview/README.md` 覆盖清单 + `AGENTS.md` 组件清单表补 `ColorField` 行（共享组件总数 15 → 16） |
| 5 | `bookmarkMarker/RuleItem.vue` 的两处颜色行改用共享 `ColorField` |

### 同一缺陷的扩散范围（本次不改，记录备查）

全项目另有 **8 个文件**使用原生 `<input type="color">`，存在同样的「点不开」问题：

`prompts/components/CategoryManageModal.vue`、`toolCollection/tools/colorPicker/index.vue`、`imageCreation/components/CoverDecorationSettings.vue`、`imageCreation/components/CodeImageTab.vue`、`superPanel/components/FeatureCard.vue`、`gitPush/components/common/CategoryDialog.vue`、`gitPush/components/CommitAnalysis/AnalysisSettingsForm.vue`、`generalSettings/components/TabPinSettings.vue`

建议单独立项批量替换为共享 `ColorField`。

---

## 四、P1：类型弱化

| # | 位置 | 现状 | 目标 |
|---|---|---|---|
| C1 | `index.vue:121` | `plugin?: any` | `plugin?: Plugin`（`import type { Plugin } from "siyuan"`） |
| C2 | `index.vue:122` | `onBookmarkMarkerChange?: (action: string, data?: any) => void` | 判别联合 `BookmarkMarkerAction` + `BookmarkMarkerActionPayload` |
| C3 | `index.ts:21` | `(plugin.i18n?.bookmarkMarker as unknown as Record<string, any>) \|\| {}`（双重断言 + `any`） | `BookmarkMarkerI18n` 接口（29 键）+ 扁平兜底 `?? plugin.i18n` |
| C4 | `index.vue:120` | `i18n: Record<string, string>` | `i18n: BookmarkMarkerI18n` |
| C5 | `RuleItem.vue:310` | `i18n: Record<string, string>` | `i18n: BookmarkMarkerI18n` |
| C6 | `utils.ts:25` | `normalizeRules(rules: any[])` | `normalizeRules(rules: unknown[])` + 类型守卫 |
| C7 | `utils.ts:16` | `resolveMode(rule): string` | `resolveMode(rule): DisplayMode` |
| C8 | `types/index.ts:8/12` | `displayMode?: "bg" \| "icon" \| "icon-bg" \| "row"` 等内联字面量 | 提为具名 `export type DisplayMode` / `MatchMode`，供 `resolveMode` 与 UI 选项表共用 |
| C9 | `modules/BookmarkMarker.ts:90` | SQL `LIMIT 999999` 硬编码 | 提为 `BOOKMARK_QUERY_LIMIT` 常量 |

---

## 五、P1：运行时缺陷与性能

### D1 书签查询异步链路无异常兜底（unhandled rejection）

`applyMarkers()` 是 async，内部 `loadBookmarkCache()` 的 `await sql(...)` 可能抛错，而以下 4 个调用点**均未 catch**：

| 行号 | 调用点 | 后果 |
|---|---|---|
| `modules/BookmarkMarker.ts:446` | `this.timers.setInterval(() => this.applyMarkers(), ...)` | 每轮定时刷新都可能产生 unhandled rejection |
| `modules/BookmarkMarker.ts:48` | `updateOptions()` → `this.applyMarkers()` | 规则/间隔变更时同上 |
| `modules/BookmarkMarker.ts:55` | `start()` → `await this.applyMarkers()` | `index.ts:65` 已 await 但无 try-catch |
| `index.ts:86` | `handleChange` → `this.bookmarkMarker.start()`（Promise 未 await） | 打开功能开关时同上 |

**处置**：`loadBookmarkCache` 内 try-catch 记日志（失败时 `cacheLoaded` 保持 `false`，让 `applyMarkersFor` 的既有守卫自然跳过本轮）；`applyMarkers` 整体兜底；所有 fire-and-forget 调用点统一 `void fn().catch(...)`。

### D2 滑块拖动写放大 + 提示刷屏

`RuleItem.vue:220-228` 的 `<input type="range">` 绑 `@input="emit('change')"`，而 `index.vue:143-148` 的 `handleRulesChange` 每次都 `await settings.save()` + `showMessage("标记规则已更新")` → **拖动过程中每像素写入一次存储并弹一次提示**。

**处置**：滑块 `@update:model-value` 只发 `patch`（内存更新，百分比实时跟随），`@change`（松手）才发 `commit`（落盘 + 通知 + 提示）。

### D3 规则列表用索引作 key

`index.vue:53` 的 `:key="index"`。`RuleItem` 当前无内部状态，故暂未出错；但改造后其内部将引入含状态（调色板开合）的共享 `ColorField`，删除中间规则时会因组件复用导致弹层状态错位。

**处置**：`:key="rule"`（对象身份），`remove` 事件携带 `rule` 对象，父级用 `indexOf` 定位。无需改持久化 schema。

### D4 `setUpdateInterval` 无条件重启定时器

`modules/BookmarkMarker.ts:76-82`：值未变化也重启。**处置**：加等值守卫短路。

### D5 `hexToRgba` 不支持 3 位 hex

`utils.ts:7` 正则仅 `^#([0-9a-fA-F]{6})$`，用户输入 `#fff` 会静默回退为透明。3 位 hex 是合法 CSS 颜色。**处置**：先展开 `#rgb` → `#rrggbb` 再解析。

### D6 MutationObserver 监听 `document.body`（观察项，本次不改）

`modules/BookmarkMarker.ts:334-339`：`childList + subtree + attributes(attributeFilter: ["data-node-id"])`，全应用级监听。已通过 `attributeFilter` 收窄，回调用 `mutations.some()` 提前短路，判定为**可接受**。收窄观察根到 `.layout__center` 收益不确定且有破坏 protyle 检测的风险，仅记录建议。

### D7 `buildRowStyle` 行内样式硬编码

`utils.ts:58-65` 硬编码 `borderRadius: "3px"` / `padding: "0 4px"`。这两个值是注入到思源 DOM 的行内样式（不经 SCSS，无法使用设计 Token），提为模块常量即可。

---

## 六、P1：数据流（`RuleItem` 直接 mutate props）

`RuleItem.vue` 直接改写父级传入的 `props.rule`：

| 行号 | 操作 |
|---|---|
| 395 | `props.rule.bookmarkNames.push(value)` |
| 411 | `props.rule.bookmarkNames.splice(tagIndex, 1)` |
| 419 | `props.rule.bookmarkNames.pop()` |
| 426 | `props.rule.icon = ...` |
| 模板 | `v-model="rule.icon"` / `v-model="rule.color"` / `v-model="rule.backgroundColor"` / `v-model.number="rule.alpha"` / `v-model="rule.displayMode"` / `v-model="rule.matchMode"` |

Vue 对嵌套突变不报错且当前可工作，但违反 `AGENTS.md § 子组件数据流规则` 的单向数据流意图。

### 处置：`patch` + `commit` 双事件契约

```ts
// RuleItem → 父级
patch:  [patch: RulePatch]   // 父级 Object.assign 到自己拥有的规则对象（仅内存生效）
commit: []                   // 父级落盘 + 通知 Manager + 提示
remove: []                   // 父级按对象身份 indexOf 定位（配合 :key="rule"）
```

- 禁止子组件直接改 props（用户点名项）
- 禁止回传全量表单数据（`AGENTS.md` 明令禁止的「中间人模式」）
- 顺带解耦「持续输入」与「提交」，修掉 D2

---

## 七、P2：注释 / 行数 / i18n

### E1 文件头注释不在文件顶部

| 文件 | 现状 |
|---|---|
| `index.vue` | 说明写在 `<script setup>` 内部的 JSDoc（第 109-112 行），文件第 1 行直接是 `<template>` |
| `components/RuleItem.vue` | 注释在 `<template>` 内的第 2 行（`<!-- 单条书签标记规则编辑卡片 -->`） |

其余文件（`index.ts`、`utils.ts`、`types/*`、`composables/*`、`modules/*`）均已合规。**处置**：补 `<!-- ... -->` 到文件第 1 行。

### E2 单文件行数

| 行数 | 文件 | 处置 |
|---|---|---|
| 422 | `components/RuleItem.vue` | **超 300 警戒线**（未破 500）。拆出 3 个子组件 |
| 397 | `modules/BookmarkMarker.ts` | 单一职责类，本次仅改异常兜底，不拆 |
| 318 | `styles/RuleItem.scss` | 随 `RuleItem.vue` 拆分同步拆为 3 个 partial |

拆分方案：

```
components/
├── RuleItem.vue                 # 卡片壳 + 头部 + 预览 + 组装（目标 < 300 行）
└── ruleItem/
    ├── TagInputField.vue        # Tag chips（closable）+ Input(borderless)；回车/逗号添加、空输入退格删末项、去重
    ├── IconSelectField.vue      # Input 图标名 + 预设字形网格（Button text + 选中态 variant）
    └── ModeGroupField.vue       # 通用单选分段组（显示模式带 icon / 匹配模式不带）
```

### E3 i18n 结构（嵌套 → 扁平）

`src/i18n/{zh_CN,en_US}/bookmarkMarker.json` 当前为嵌套结构 `{ "bookmarkMarker": { ...29 键 } }`，与 `aiContentGenerator` / `generalSettings` / `s3Backup` 等较新模块的扁平风格不一致。

**扁平化实测冲突（9 个键与他分片重名）**：

| 原键 | 冲突位置 | 重命名为 |
|---|---|---|
| `title` | 30+ 个分片（`apiUsage` / `componentPreview` / `gitPush` / ...） | `bookmarkMarkerTitle` |
| `displayMode` | `textDiff.json:13` | `markerDisplayMode` |
| `updateInterval` | `generalSettings.json:204`、`statusBar.json:14` | `markerUpdateInterval` |
| `interval30min` | `generalSettings.json:205`、`statistics.json:18` | `markerInterval30min` |
| `interval1hour` | `generalSettings.json:206`、`statistics.json:19` | `markerInterval1hour` |
| `interval2hour` | `generalSettings.json:207`、`statistics.json:20` | `markerInterval2hour` |
| `interval4hour` | `generalSettings.json:208` | `markerInterval4hour` |
| `msgEnabled` | `generalSettings.json:216` | `bookmarkMarkerMsgEnabled` |
| `msgDisabled` | `generalSettings.json:217` | `bookmarkMarkerMsgDisabled` |

其余 20 键扁平后无冲突，保持原名。

> 备注：`AGENTS_I18N.md` 明确「合并后为嵌套结构」且「代码通过 `pluginI18n.gitPush || pluginI18n` 兼容两种结构」——即两种结构都被官方支持。本次按项目主流风格（扁平）统一，代价是上表 9 个键的更名。

---

## 八、判定为「合规例外」（保留原生元素）

| 位置 | 保留理由 |
|---|---|
| `RuleItem.vue:319-359` `PRESET_ICONS`（39 个 emoji 字形）与 `markerIconPlaceholder` 中的 🔖 | 这些 emoji 是**用户可选的标记字形（业务数据）**，最终由 `createMarkerElement`（`utils.ts:87-111`）以 `textContent` 写入思源文件树/文档标题，**不是插件 UI 图标**。改为 Iconify 需把标记渲染从文本改为 SVG 挂载，属功能重设计。注意：选择这些字形的**按钮本身已改走共享 `Button`**（emoji 作为按钮文本内容），因此「按钮必须用共享组件」仍被满足 |
| `modules/BookmarkMarker.ts:402-430` `injectStyle` 的样式字符串 | 注入的目标是思源自有 DOM（`.b3-list-item__text` / `.protyle-title`），不在插件 SCSS 作用域内，无法使用设计 Token；已通过 `injectStyle`/`removeStyle` 统一入口管理生命周期 |

## 九、本次不处理（记录备查）

| 位置 | 问题 | 不处理理由 |
|---|---|---|
| 8 个 feature 的原生 `<input type="color">`（见 § 三） | 同一「点不开取色器」缺陷 | 超出本次 `bookmarkMarker` 审查范围；建议单独立项批量替换为共享 `ColorField` |
| `modules/BookmarkMarker.ts:334-339` | MutationObserver 监听 `document.body` | 已通过 `attributeFilter` 收窄 + `mutations.some()` 短路，判定可接受；收窄观察根收益不确定 |
| `modules/BookmarkMarker.ts:397` 行数 397 | 超 300 警戒线 | 单一职责类（书签缓存 + DOM 标记 + 观察器/重试/防抖 + 样式注入 + 定时更新），本次不改其业务逻辑，强行拆分反而增加回归风险 |

---

## 十、改造结果

### 新增 / 删除 / 修改

| 类型 | 文件 |
|---|---|
| 新增（共享层） | `src/components/ColorField.vue`、`src/components/styles/ColorField.scss` |
| 新增（bookmarkMarker） | `components/ruleItem/{TagInputField,IconSelectField,ModeGroupField}.vue` + `styles/{RuleItemTagInput,RuleItemIconField,RuleItemModeGroup,fieldRow}.scss` |
| 新增（预览清单） | `src/features/componentPreview/previewData/colorField.ts` |
| 删除 | `src/features/generalSettings/components/ColorField.vue`、`src/features/generalSettings/styles/ColorField.scss` |
| 修改（共享层） | `src/components/Input.vue` + `styles/Input.scss`（新增 `borderless`）、`src/components/ColorField.vue`（新增 `change` 提交事件）、`AGENTS.md`、`src/features/componentPreview/{README.md,previewData/index.ts,previewData/input.ts}` |
| 修改（generalSettings） | 6 个 `*Settings.vue` 的 import 路径改指 `@/components/ColorField.vue` |
| 修改（bookmarkMarker） | `index.vue`、`index.ts`、`README.md`、`components/RuleItem.vue`、`modules/BookmarkMarker.ts`、`composables/useBookmarkMarkerSettings.ts`、`types/{index,storage}.ts`、`utils.ts`、`styles/{index,RuleItem}.scss` |
| 修改（文案） | `src/i18n/{zh_CN,en_US}/bookmarkMarker.json`（嵌套 → 扁平，9 键更名，32 → 34 键）+ `pnpm i18n:merge` 产物 |

### 共享组件变更（已按规则同步预览清单）

| 变更 | 内容 | 同步位置 |
|---|---|---|
| **新增** `ColorField.vue` | 从 `generalSettings` 提升；头部注释保留「思源 Electron 不弹原生 `input[type=color]`」结论 | `previewData/colorField.ts` 新分组 + `previewData/index.ts` 聚合 + `componentPreview/README.md` + `AGENTS.md` 组件清单 |
| `ColorField` 新增 `change` 事件 | `update:modelValue` 仍为实时值（逐字触发），`change` 为提交信号（blur/回车/调色板选色） | `componentPreview/README.md` 新增「事件契约」表 |
| `Input` 新增 `borderless` prop | 去边框去底色，供 chips 类复合控件内嵌；用三条高特异性选择器覆盖基类 hover/focus-within | `previewData/input.ts` 新示例 + `componentPreview/README.md` + `AGENTS.md` Input 行 |
| 共享组件总数 | **15 → 16**（同期另有 `Checkbox.vue` 由外部加入，本次未涉及） | `AGENTS.md`「组件清单（16 个）」+ 目录树注释；`componentPreview/README.md` 覆盖说明 |

### 量化结果

| 指标 | 改造前 | 改造后 |
|---|---|---|
| 原生 `<button>` | 3 | 0 |
| 原生 `<select>` | 1 | 0 |
| 原生 `<input>`（text / color / range） | 6 + 1 | 0 |
| 原生 `<input type="radio">` | 7 | 0 |
| 裸 `<label>` | 8 | 0 |
| 文本 `×` 当图标 | 1 | 0 |
| `any` 使用点 | 3 | 0 |
| props 直接突变点 | 7 | 0 |
| unhandled rejection 风险点 | 4 | 0 |
| `RuleItem.vue` 行数 | 422（超警戒线） | **201** |
| `index.vue` 行数 | 165 | 201 |
| `styles/RuleItem.scss` | 318 | 63（拆为 4 个 partial） |
| `modules/BookmarkMarker.ts` | 397 | 421（仍未破 500，见 § 九） |
| 共享组件数 | 15 | 16 |
| i18n 顶层键（模块分片） | 1（嵌套 32 键） | 34（扁平） |

### 拆分时踩到的坑（记录备查）

`RuleItem.vue` 拆出子组件后，原先由父组件 scoped 样式提供的 `.rule-row` 布局在子组件里**不生效**：

- Vue scoped CSS 只把父组件的 `data-v` 属性传给子组件的**单根节点**；`IconSelectField.vue` 是**多根节点**（两行 `v-if`），因此完全收不到父组件的 scope 属性，字段行会失去 flex 布局
- 修复：抽出 `styles/fieldRow.scss`，**每个渲染 `.rule-row` 的组件各自 `@use` 一份**，让 scoped 编译时带上自身 `data-v` 属性。不要依赖父组件 scope 传递

### 已核实的关键约束

- `ColorField` 全部 6 处引用已同轮改指共享路径，本地副本与 SCSS 已删除（无残留两份实现）
- i18n 仅改分片文件；已执行 `pnpm i18n:merge`（zh_CN / en_US 均 1092 个顶层键，一一对齐；模块分片 34 键）
- 未触碰 8 步功能注册清单；未改动书签查询语句与 DOM 标记算法
- 未执行 `pnpm vite build` / `pnpm lint` / `npx tsc --noEmit`

---

## 十一、验收清单

改造后由用户执行：

```bash
pnpm lint            # ESLint 代码规范
pnpm i18n:verify     # 中英文键对齐
pnpm validate:icons  # 图标注册有效性
npx tsc --noEmit     # TypeScript 类型检查
```

人工回归要点：

1. 打开面板：标题图标、关闭按钮（悬停反馈、可关闭）、功能开关与描述显示正常
2. 关闭「书签标记」开关 → 规则区与间隔区隐藏；重新打开 → 规则与间隔保持
3. 规则卡片：书签名 chips 可用**回车/逗号**添加、**空输入退格**删除末项、点 chip 关闭位可删除、重复名不重复添加
4. 文字颜色 / 背景颜色：**点击色块能展开 32 色调色板**（本次修复的核心缺陷），选色后 hex 文本框与预览同步；点击面板外或按 Esc 关闭调色板
5. 图标：手输 emoji 与点击预设字形面板均可设置，选中态高亮，再次点击同一字形可取消
6. 显示模式四档、匹配模式三档可切换，选中态为主色文字
7. 背景透明度：拖动时百分比实时跟随且**不弹提示**，松手后提示「标记规则已更新」且设置已落盘
8. 添加规则：新规则立即持久化（添加后直接关闭弹窗不丢失）；删除中间规则后其余卡片的调色板状态不错位
9. 更新间隔切换后提示「更新间隔已修改」，且自动刷新按新间隔生效
10. 文件树与文档标题区的标记样式（bg / icon / icon-bg / row 四种模式）渲染正确；切换显示模式后旧标记被正确清理
11. 英文环境（思源语言切 English）下所有文案显示正常，无 `undefined`
