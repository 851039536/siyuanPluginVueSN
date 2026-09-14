# 快捷键模块重构变更规格（shortcut）

> 状态：执行中 · 日期：2026-09-14 · 变更类型：重构（UI 排版 + 数据持久化）
> 变更来源：用户请求「完全重构功能：UI 显示排版，和数据持久化」，经需求确认后锁定范围。

---

## 一、变更范围

### 1. 做什么

| 编号 | 变更项 | 说明 |
|------|--------|------|
| A | UI 排版 | 2 列卡片网格（分组吸顶 + 会话级折叠）；卡片为「内容行 / 名称行 / 描述」三段结构 |
| B | 持久化单键 | 预置不落盘（代码即真源）+ 自定义单独存 `plugin-shortcuts-custom`；启动时幂等迁移旧键 |
| C | 导入 / 导出 JSON | 只覆盖自定义项；导入结果按「新增 / 覆盖 / 忽略」计数反馈 |
| D | 重置为默认 | 二次确认后清空全部自定义项，预置不受影响 |
| E | 内容显示自适应（CR-007） | 主内容取「要复制的内容」（`copyContent \|\| keys`）：自动判定按键组合 → 按键徽章组，命令 / 路径 / 文本 → 等宽代码芯片；快捷键与主内容不同且本身是按键组合时，在内容行右侧弱化次显 |

### 2. 明确不做（范围边界）

- 预置项**不可**隐藏、**不可**编辑（预置只读）
- 不做平台（Win/Mac）过滤
- 不引入分页与虚拟滚动
- 折叠状态不持久化（会话级）
- 不新增分类（分类标识与 i18n 文案保留；当前数据仅 npm / nvm / visual-studio 三类共 42 条）
- 不新增「显示类型」字段或表单选项：内容形态由纯函数自动判定（CR-007）
- 不影响注册链（`config.ts` / `features/index.ts` / `settings.ts` / `icons.ts` 均不改）

---

## 二、数据模型与存储契约

### 1. 存储键

| 键 | 类型 | 状态 | 说明 |
|----|------|------|------|
| `plugin-shortcuts-custom` | `ShortcutInfo[]` | 新增 | 仅用户自定义项，唯一可写数据 |
| `plugin-shortcuts-favorites` | `string[]` | 沿用 | 收藏 id 列表 |
| `plugin-shortcuts-recent` | `string[]` | 沿用 | 最近使用 id 列表（上限 10） |
| `plugin-shortcuts-all` | `ShortcutInfo[]` | 旧键 | **只读迁移源**，迁移成功后删除 |

### 2. 预置 / 自定义判定

由 `PRESET_SHORTCUTS` 派生 `PRESET_IDS: ReadonlySet<string>`，替代原 `category === "custom"` 硬编码判定。双层设防：

- UI 层：编辑 / 删除按钮仅对非预置项渲染
- 数据层：`manager.addOrUpdateCustom` / `removeCustom` 对预置 id 直接拒绝（返回 `false`）

### 3. 迁移算法（幂等）

判定依据是「**新键是否存在**」而非「新键是否非空」——否则用户删光自定义项后会被旧数据复活。

| 步骤 | 行为 |
|------|------|
| 1 | 读新键 `custom`：已存在（含空数组）⇒ 迁移已完成，直接返回 |
| 2 | 读旧键 `all`：不存在 ⇒ 首次安装，返回空数组且**不写盘** |
| 3 | 过滤旧数据：仅保留 id ∉ 预置集合的条目，并清洗字段（强制 `category: "custom"`、必填字段缺失即丢弃） |
| 4 | 写新键：**写入成功才删除旧键**；写入失败保留旧键，下次启动重试（不丢数据） |
| 5 | 收藏 / 最近记录按「实际存在的 id」剪枝，有变化才回写 |

### 4. 导入 / 导出载荷

```jsonc
// 导出（仅自定义）
{
  "type": "siyuan-plugin-shortcuts",
  "version": 1,
  "exportedAt": "2026-09-14T10:00:00.000Z",
  "shortcuts": [ /* ShortcutInfo[]，category 恒为 custom */ ]
}
```

导入合并规则：非法条目忽略并计数；`id` 属于预置集合 ⇒ 忽略；同 id 已存在 ⇒ 覆盖；新 id ⇒ 追加。

---

## 三、UI 结构与交互规格

### 工具栏（两行，面板顶部）

- 第一行：搜索输入（前置放大镜，占满剩余宽度）+ 分类下拉（选项带条目数）+ 新增按钮（主色）
- 第二行：条目总数（`可见 / 总数`）+ 导入 / 导出 / 重置（图标按钮，`title` 提示；重置用警示色）

### 列表主体

- 2 列卡片网格（`repeat(2, minmax(0, 1fr))`，同行等高）；按 `group || i18n.other` 分组
- 组头吸顶：左侧 3px 主色竖条 + 组名 + 数量胶囊 + 折叠按钮（`aria-expanded`）
- **卡片三段结构（CR-007）**：
  - 内容行：`主内容芯片`（自适应：按键组合 → 徽章组；命令 / 路径 / 文本 → 等宽代码芯片，单行省略 + `title` 全文）+ `弱化快捷键徽章`（仅当快捷键与主内容不同且本身是按键组合）+ `操作按钮`（复制；编辑 / 删除仅自定义项，默认隐藏但恒定预留空间，悬停 / 聚焦淡入）
  - 名称行：名称（加粗、单行省略）+ 平台标签（+ 工具类分类标签，组头已同名时不重复）
  - 描述行：次级色、单行省略；`flex-wrap` + `flex-basis` 自适应折行（名称短则与名称同行）
- 空态：共享 `IconWrapper` 搜索图标 + 文案

### 内容显示模型（CR-007）

| 纯函数 | 契约 |
|--------|------|
| `isKeyCombo(text)` | 按 `,` 拆多序列 → 每段按 `+` 拆 token → 逐 token 白名单校验（修饰键 / `F1`–`F12` / 命名键 / 单字符符号 / 单字母数字）；**全部命中**才判为按键组合 |
| `resolveShortcutDisplay(item)` | 返回 `{ content, kind, hotkey? }`：`content = copyContent \|\| keys`；`kind = isKeyCombo(content) ? "keys" : "code"`；`hotkey` 仅当「`copyContent` 存在 且 ≠ `keys` 且 `keys` 是按键组合」时给出 |
| 判定失败的方向 | **偏保守**：宁可把按键当文本渲染成代码芯片，也不把命令误渲染成徽章；序列拆分只在 `kind === "keys"` 时进行（含逗号的命令不会被误拆） |
| 复制与显示同源 | `copyShortcut` 消费 `resolveShortcutDisplay(item).content`，杜绝「显示一套、复制另一套」 |

### 表单字段映射（CR-007）

- 新增 / 编辑对话框字段：**内容（必填，→ `copyContent`）**、**快捷键（可选，→ `keys`，留空时写入内容副本）**、名称（必填）、描述、分组（下拉）
- `ShortcutInfo` 结构不变、零迁移：老数据（`keys` 里存的其实是命令）经自动判定即可正确渲染为代码芯片
- `sanitizeShortcutArray` 增补防御：`keys` 缺失时回退取 `copyContent`，避免外部导入文件被丢弃

### 交互

- 点击主内容芯片或复制按钮 → `copyToClipboard(内容)` + 成功提示；主内容芯片的可访问名为「复制：<内容>」
- 删除 / 重置走共享 `ConfirmDialog`；新增 / 编辑走共享 `Dialog`
- 折叠与悬停过渡 120ms ease；悬停 / 聚焦统一为「surface 底 + 主色描边」

---

## 四、验收清单（Given-When-Then）

| 编号 | 验收点 |
|------|--------|
| AC-01 | **Given** 已完成一次旧版迁移的用户，**When** 插件升级到新版并打开面板，**Then** 其自定义快捷键全部保留在列表中，且旧键 `plugin-shortcuts-all` 已删除 |
| AC-02 | **Given** 用户删除了全部自定义快捷键，**When** 重新加载插件并打开面板，**Then** 列表不再出现任何自定义项（旧数据不被复活） |
| AC-03 | **Given** 代码中新增了一条预置快捷键，**When** 用户升级插件并打开面板，**Then** 新预置立即可见（无需清空存储） |
| AC-04 | **Given** 旧键写入新键失败，**When** 下次启动，**Then** 旧键仍存在并被再次尝试迁移（数据不丢） |
| AC-05 | **Given** 面板已加载，**When** 新增 / 编辑 / 删除自定义快捷键，**Then** 列表与总数立即更新且写入新键 |
| AC-06 | **Given** 列表中的预置项，**When** 查看行内操作，**Then** 不出现编辑与删除按钮 |
| AC-07 | **Given** 冲突检测开启，**When** 列表中存在两项归一化后相同的按键组合，**Then** 这些行高亮并可查看冲突对象；选择「冲突」筛选后只显示冲突项 |
| AC-08 | **Given** 用户点击导出，**When** 下载完成，**Then** 得到含 version / exportedAt / shortcuts 的 JSON，且只包含自定义项 |
| AC-09 | **Given** 用户导入合法 JSON，**When** 解析完成，**Then** 依次按「与预置 id 冲突忽略 / 同 id 覆盖 / 新 id 追加」合并，并提示新增 / 覆盖 / 忽略数量 |
| AC-10 | **Given** 用户导入非法 JSON，**When** 解析失败，**Then** 给出错误提示且不修改现有数据 |
| AC-11 | **Given** 用户点击重置并确认，**When** 操作完成，**Then** 自定义、收藏、最近均被清空，预置完整保留 |
| AC-12 | **Given** 面板宽度收窄到约 360px，**When** 渲染长名称与长按键组合，**Then** 名称与描述省略、按键徽章不被压缩、操作按钮不换行 |
| AC-13 | **Given** 键盘用户，**When** 遍历筛选按钮与组头，**Then** 可通过 `aria-pressed` / `aria-expanded` 感知状态并触发切换 |
| AC-14 | **Given** 重构后的模块，**When** 运行 `pnpm typecheck` / `pnpm i18n:verify` / `pnpm validate:icons`，**Then** 全部通过且无新增 `read_lints` 报错 |
| AC-15 | **Given** 一条内容为按键组合的条目（如 `Ctrl+Alt+N`），**When** 卡片渲染，**Then** 主内容渲染为按键徽章组，且不重复出现同内容的快捷键徽章 |
| AC-16 | **Given** 一条内容为命令行的条目（如 npm 项 `copyContent: "npm install"`），**When** 卡片渲染，**Then** 主内容渲染为等宽代码芯片（单行省略 + 悬停可看全文），右侧出现弱化快捷键徽章 |
| AC-17 | **Given** 内容文本中含逗号，**When** 渲染与复制，**Then** 内容不被按逗号拆分（整体作为一则内容芯片），复制得到完整原文 |
| AC-18 | **Given** 用户点击主内容芯片或复制按钮，**When** 复制完成，**Then** 剪贴板内容为 `copyContent \|\| keys`，并给出成功提示；主内容芯片的可访问名形如「复制：<内容>」 |
| AC-19 | **Given** 用户在表单填写内容与快捷键，**When** 保存，**Then** 内容写入 `copyContent`、快捷键写入 `keys`；快捷键留空时 `keys` 写入内容副本；仅填名称与内容即可通过校验 |
| AC-20 | **Given** 用户在搜索框输入只出现在命令内容里的关键词，**When** 搜索，**Then** 命中该条目（搜索覆盖 `copyContent`） |
| AC-21 | **Given** 表单「内容」留空，**When** 点击确认，**Then** 就地报错并阻止提交，不写入任何数据 |
| AC-22 | **Given** 模块 5 个 SCSS，**When** 完成冗余审查，**Then** 不存在未使用类 / 未被引用的局部变量 / 已删功能残留选择器，且字号、字重、行高、圆角全部走设计 Token |

> AC-07（冲突检测）、AC-11（重置含收藏 / 最近）、AC-13（筛选按钮 `aria-pressed`）已分别随 CR-006（移除最近使用与冲突）、CR-003（移除收藏）废止；CR-007 新增 AC-15 ~ AC-22。

---

## 五、任务分解与依赖

| 任务 | 内容 | 依赖 |
|------|------|------|
| 1 | 本变更规格与验收清单 | — |
| 2 | 数据层：三键分离、幂等迁移、预置 id 判定与纯函数（types / storage / manager / utils / dataTransfer） | 1 |
| 3 | 紧凑行式列表 UI（PanelHeader / ShortcutList / ShortcutRow / ShortcutDialog + 样式，移除 Grid / Card） | 2 |
| 4 | composables：`useShortcutData` + `useShortcutFilter`，`index.vue` 收敛为编排层 | 2 |
| 5 | 导入导出、重置二次确认、冲突筛选接入；中英文 i18n 新键；同步 README | 3、4 |
| 6 | 架构规范校验 + `read_lints` / `typecheck` / `i18n:verify` / `validate:icons` | 5 |

---

## 变更日志 (Change Log)

### CR-001: 快捷键模块完全重构（UI 排版 + 数据持久化）(2026-09-14)

**变更类型**：重构
**变更原因**：用户提出「完全重构功能：UI 显示排版，和数据持久化」；现状 2 列卡片网格在 89 条预置下滚动过长，且预置与自定义混存单键导致插件升级后新增预置永远不可见。
**变更内容**：

- UI：2 列卡片网格 → 单列紧凑行式列表（分组吸顶 + 可折叠 + 冲突高亮）
- 持久化：单键全量混存 → 预置不落盘 + 自定义 / 收藏 / 最近三键分离，附幂等迁移
- 新增：导入 / 导出 JSON（仅自定义）、重置为默认（二次确认）、快捷键冲突检测与「冲突」筛选
- 修正：预置判定由 `category === "custom"` 改为预置 id 集合双层设防；筛选按钮补齐 `aria-pressed`；空态改用共享 `IconWrapper`
- 边界：不做预置隐藏 / 编辑、不做平台过滤、不做分页与虚拟滚动

### CR-002: 列表改为 2 列卡片网格 (2026-09-14)

**变更类型**：微调
**变更原因**：用户要求「排版 2 列」——每行放 2 条快捷键，提高一屏可见条目数。
**变更内容**：

- `ShortcutList` 分组内容区由「单列纵向堆叠」改为「2 列卡片网格」（`repeat(2, minmax(0, 1fr))`，`align-items: stretch` 保证同行卡片等高）
- `ShortcutRow` 由横向 4 列行式改为纵向两行卡片：上行 = 按键徽章 + 行内操作（悬停浮出），下行 = 名称 + 平台标签 + 冲突警示 + 描述（与名称同行、次级色、单行省略）
- 操作按钮改为 `visibility: hidden` **恒定预留空间** + 悬停 / 聚焦淡入，避免悬停时卡片尺寸抖动；收藏态下常显
- 卡片外观：中性边框 + 8px 内边距 + 左侧 3px 状态竖条；冲突卡警告色淡底、收藏卡极浅主色底
- 卡片内不再重复显示与组头同名的分类标签（`showToolBadge` 增加组名比对）
- AC-12（窄面板下省略与不换行）继续适用：按键徽章单行省略、名称最大 68% 宽、标签与警示图标不压缩

### CR-003: 移除「收藏」功能 (2026-09-14)

**变更类型**：微调（功能删减）
**变更原因**：用户要求「移除收藏」。
**变更内容**：

- UI：卡片上的星标按钮、工具栏「收藏」筛选按钮、收藏态卡片样式全部移除；筛选区仅保留「最近 / 冲突」
- 类型与纯函数：`ShortcutFilterMode` 去掉 `"favorite"`；`ShortcutQuery` 去掉 `favoriteIds`；`filterShortcuts` 去掉收藏分支
- 存储：`ShortcutStorage` 去掉 `favorites` 槽位与 `loadFavorites` / `saveFavorites`；`pruneUserState` 收窄为 `pruneRecent`；`clearUserData` 只清自定义与最近使用
- composable：`useShortcutData` 去掉 `favorites` 状态与 `toggleFavorite`（`persistUserState` 收窄为 `persistRecent`）；`useShortcutFilter` 去掉 `favoriteIds` 依赖
- **i18n 键 `favorite` / `unFavorite` / `filterFavorite` 保留不清除**：合并后的命名空间是全局扁平的，其他模块可能读取同名顶层键（如 `minimalBrowser` 用了 `i18n.favorite`），删除存在跨模块风险
- 数据兼容：`plugin-shortcuts-favorites` 键不再读写，旧数据留在用户数据目录但不参与业务，不影响运行
- 验收影响：AC-01 / AC-05 / AC-11 中涉及「收藏」的表述失效，验收点收敛为「自定义 + 最近使用」

### CR-004: 移除 4 类预设快捷键 (2026-09-14)

**变更类型**：微调（数据删减）
**变更原因**：用户要求「移除预设的：插件快捷键、思源笔记、vscode、windows cmd」。
**变更内容**：

- 删除 `data/siyuan.ts`（9 条）、`data/plugin.ts`（3 条）、`data/vscode.ts`（16 条）、`data/cmd.ts`（19 条），共移除 47 条预置
- `data/presets.ts` 聚合收窄为 NPM(10) / NVM(9) / Visual Studio(23)，**预置总数 89 → 42**；文件头注释补记被移除的分类与恢复方式
- **分类标识与文案保留**：`ShortcutCategory` / `CATEGORY_LABEL_I18N_KEYS` / `TOOL_CATEGORIES` / i18n 分片均不动 —— 与「`openspec` 有标识无数据」的既有状态一致；面板分类由数据驱动，无数据即不显示。需要恢复时补回 `data/<分类>.ts` 并在 `presets.ts` 引入即可
- 覆盖前文：CR-001 边界中「不改动 `data/` 下 89 条预置数据」一条按本次要求失效，其余边界不变
- 无迁移影响：预置不落盘（CR-001 之后），用户自定义快捷键不受影响；若「最近使用」中残留被移除分类的 id，由启动时的 `pruneRecent` 自动剪枝

### CR-005: 表单「分组」改为下拉选择 (2026-09-14)

**变更类型**：微调
**变更原因**：用户要求「分组应该是可以选的下拉分类」。
**变更内容**：

- `ShortcutDialog` 的「分组」字段由自由文本 `Input` 改为共享 `Select`（`filterable`）。选项 = 默认分组（`customShortcuts` 文案）+ 当前数据中的现有分组 + 当前值，去重升序；显式带上默认分组与当前值，避免「尚无自定义项」与「编辑一个用旧分组名的条目」两种情况下下拉空白
- 末尾追加「新建分组…」哨兵项（`__new_group__`，仅在下拉内部流转，不写入表单数据）：选中后切换为输入框，并提供「从列表选择」按钮切回下拉（切回时分组回落为默认分组）
- 新增纯函数 `utils.listGroups(shortcuts)`（去重 / 忽略空值 / 升序）并从模块入口导出；`index.vue` 以 `computed(() => listGroups(allShortcuts.value))` 传给对话框
- i18n 新增 `scNewGroup` / `scPickFromList`（中英双侧，`pnpm i18n:verify` 通过）
- 分组仍非必填：留空时 `buildCustomShortcut` 回落为默认分组；`ShortcutInfo.group` 数据模型不变

### CR-006: 移除「最近使用」与「冲突检测」，优化卡片显示 (2026-09-14)

**变更类型**：微调（功能删减 + UI 优化）
**变更原因**：用户要求「移除最近使用，和冲突，优化卡片显示」。
**变更内容**：

- **移除最近使用**：删除筛选按钮、卡片圆点标记、「复制即计入最近使用」的逻辑，以及存储读写；`ShortcutStorage` 不再使用 `plugin-shortcuts-recent`（旧数据留在用户数据目录不参与业务）
- **移除冲突检测**：删除 `normalizeShortcutKeys` / `buildConflictMap` / `isConflicting`、卡片冲突高亮与警示气泡、工具栏「冲突」筛选；`ShortcutFilterMode` / `ShortcutQuery.filter` / `ShortcutConflictMap` 一并删除 —— 筛选管道收敛为「关键词 + 分类」，工具栏第二行仅剩计数与导入 / 导出 / 重置
- **存储与类型瘦身**：`ShortcutStorage` 只剩「自定义 + 旧键迁移」；`useShortcutData` 不再需要 `plugin`（无用户态读取）与 `RECENT_LIMIT`；`pruneIds` / `sanitizeStringArray` / `clearUserData` 等随之删除
- **卡片显示优化**：下行改为 `flex-wrap` + 描述 `flex-basis: 120px` 的**自适应折行**（名称短则与描述同行，名称长则描述自动落第二行）；统一卡片外观为中性边框 + `$r-base` 圆角 + 按键徽章 `$r-sm` 圆角；悬停 / 焦点反馈统一为「surface 底 + 主色描边」（取代原收藏态、冲突态的两套着色）；按键徽章 hover 加深描边
- 保留：i18n 键 `filterRecent` / `scFilterConflict` 等**不清除**（合并后命名空间全局扁平，删键有跨模块风险，与 CR-003 的处理一致）
- 数据兼容：无迁移需求（`ShortcutInfo` 结构不变，自定义数据完整保留）

### CR-007: 内容显示自适应重构 + 表单内容字段 + 模块样式审查 (2026-09-14)

**变更类型**：重构（显示模型 + UI 打磨 + 样式瘦身）
**变更原因**：用户提出「继续重构：修改快捷键的显示，内容可能是快捷键，可能是命令行，可能是其他方便快捷复制的，优化 ui 审查 css 冗余」。现状卡片固定把 `keys` 当主内容显示，而复制取的却是 `copyContent || keys` —— npm / nvm 类条目的卡片主视觉是热键、真正的命令只出现在名称位，显示与复制语义不一致。
**变更内容**：

- **显示模型收敛为纯函数**：新增 `isKeyCombo(text)` 与 `resolveShortcutDisplay(item)`（→ `{ content, kind, hotkey? }`），视图与复制逻辑共用同一契约；序列拆分只在判定为按键组合后进行，含逗号的命令不会被误拆
- **卡片主内容自适应**：按键组合 → 按键徽章组；命令 / 路径 / 文本 → 等宽代码芯片（中性描边 + `surface-lighter` 底，刻意避开与卡底仅差约 3% 灰度的 `surface`），单行省略 + `title` 看全文；快捷键与主内容不同且本身是按键组合时，在内容行右侧弱化次显（不重复显示、不参与压缩）
- **复制与显示同源**：`useShortcutData.copyShortcut` 改为消费 `resolveShortcutDisplay(item).content`
- **表单承载内容 + 可选快捷键**：字段改为「内容（必填 → `copyContent`）」「快捷键（可选 → `keys`，留空写入内容副本）」，`ShortcutFormData` 扩展 `content` 字段
- **搜索覆盖内容**：`searchShortcuts` 增加对 `copyContent` 的匹配
- **数据零迁移**：`ShortcutInfo` 结构不变；`sanitizeShortcutArray` 增补「`keys` 缺失时回退 `copyContent`」的防御，保证外部导入文件不被丢弃
- **悬停看全文用原生 `title`**（不引入共享 `Tooltip`）：与本模块既有交互（图标按钮统一 `title`）一致，且省去 42+ 张卡片 × 多个锚点的实例与引用开销；`title` 同时充当可访问名
- **模块样式审查（仅 5 个 SCSS）**：清理已删功能的残留选择器、无模板对应的类与未被引用的局部变量，合并同族芯片与重复规则，复核 Token 合规
- 保留：已废弃功能的 i18n 旧键（`shortcutKeys` / `keysPlaceholder` / `filterRecent` / `scFilterConflict` 等）不删（扁平命名空间跨模块读取风险）
- 验收：新增 AC-15 ~ AC-22；AC-07 / AC-11 / AC-13 明示废止

### CR-008: 清理 CLI 预置的编造快捷键，`keys` 放开为可选 (2026-09-14)

**变更类型**：微调（数据清理 + 类型放宽）
**变更原因**：用户提问「npm 为什么会有快捷键？」—— npm / nvm 是命令行工具，**本身没有原生快捷键**。这批 `Ctrl+Alt+X` 是当初 `keys` 既为必填、又是卡片唯一主显示字段时被塞入的编造数据；CR-007 之后它们仍以弱化徽章形式显示，反而误导（让人以为按了真能触发命令）。
**变更内容**：

- **类型放宽**：`ShortcutInfo.keys` 由必填改为可选（`keys?: string`）—— 命令行类条目只承载 `copyContent`。配套 2 处兜底：`searchShortcuts` 的 `s.keys` 改可选链（否则搜索命中 undefined 会抛错）、`ShortcutDialog` 编辑回填 `keys ?? ""`（表单侧恒为字符串）
- **数据清理**：`data/npm.ts`（10 条）与 `data/nvm.ts`（9 条）删除全部编造键位，仅保留 `copyContent`；`data/visualStudio.ts` 的 23 条**真键位不动**
- **文件头注释修正**：两个 CLI 数据文件原注释「用于首次使用时 seed 到本地持久化存储」已过期（CR-001 起预置不落盘）⇒ 改为「预置不落盘（代码即真源）」并写明为何不写 `keys`
- 运行时无迁移：预置不落盘；显示侧 `resolveShortcutDisplay` 对空 `keys` 本就兜底（`kind` 判为 `code`、`hotkey` 为空）；`sanitizeShortcutArray` 的 `readString(keys) ?? copyContent` 保证自定义与导入数据不失真
- 验收影响：AC-16 中「右侧出现弱化快捷键徽章」只适用于真键位条目（如 Visual Studio）；npm / nvm 条目按预期**只显示命令芯片**
