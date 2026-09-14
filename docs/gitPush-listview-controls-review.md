# gitPush / ListView 控件规则审查报告

> 审查日期：2026-09-14 ｜ 审查范围：`src/features/gitPush/components/ListView/`（16 个文件 / 3365 行）
> 审查方式：逐文件通读 + 全项目横向比对（`src/components/` 共享组件库、其余 40+ feature 的同类写法）
> 结论：**控件层违规 25 类 / 涉及 14 个文件**；组件库缺口 4 类登记为「允许自建」；假阳性 2 类已排除

---

## 一、规则依据

| 出处 | 条款 |
|------|------|
| `AGENTS.md` | 「共享组件库使用规则（强制）」——先查用法 → 优先复用 → 改 API 必同步；`src/components/` 是全项目唯一 UI 控件来源 |
| `AGENTS.md` | 「统一入口原则（强制）」——定时器走 `TimerRegistry` 等 |
| `AGENTS.md` | 「功能模块内代码分层（强制）」 |
| `AGENTS_STYLE.md` | 「强制规则：按钮交互与无障碍（2026-09-10）」 |
| `AGENTS_STYLE.md` | 「强制规则：背景与过渡对齐 gitPush 范式（2026-09-02）」 |
| `AGENTS_STYLE.md` | 「强制规则：字号层级与全局基准字号」——组件 `size` 档位是 10px 的唯一合法落地场景 |
| `AGENTS_STYLE.md` | 「强制规则：SCSS 必须分离到 styles/ 目录」 |
| `AGENTS_I18N.md` | i18n 分片与合并产物、禁止硬编码文案 |
| `docs/component-preview-memory-diagnosis.md` / `componentPreview/README.md` | 共享组件真实 props 与用法 |

> 本轮**不**依据「裸 `<Icon icon="mdi:*">` 必须改 `IconWrapper`」判定违规：该写法在 **87 个 `.vue` 文件**（含 6 个非 gitPush feature）中使用，属全项目既定做法；仅对「字符当图标」的个案提出建议（见 3.5）。

---

## 二、结论总览

| 严重度 | 数量 | 说明 |
|--------|------|------|
| 🔴 高 | 9 | 自建按钮体系、原生 `select`/`input`/`textarea`、手画勾选框、自建 tab（2 处）、自建弹窗（2 处）、`backdrop-filter` |
| 🟡 中 | 10 | 自建 toggle、自建分段切换、自建折叠区、徽标未用 `Tag`、10px 正文、过渡时长、`z-index` 基准、硬编码 `line-height`、i18n 硬编码文案（2 处） |
| 🟢 低 | 6 | 裸 `setTimeout`（2 文件）、字符代图标、`@use` 基线不一致（2 文件）、model 透传冗余、`Record<string, any>` 弱类型 |

---

## 三、违规清单

### 3.1 🔴 自建按钮体系 `.vp-btn`（最核心违规）

**证据**：`ListView` 内 12 个文件、约 60 个按钮使用自建类 `.vp-btn / .vp-btn--ghost|primary|danger / --sm`；样式定义在 `src/features/gitPush/styles/Buttons.scss`（`.vp-btn` 无 `scoped`，是**全局类**）。

模块级规模：`vp-btn` 在 **41 个 `.vue` 文件中共出现 485 次**，其中 `ListView` 14 个文件占约 180 次（每个按钮 3 次：`vp-btn vp-btn--ghost vp-btn--sm`）。

**违反**：`AGENTS.md`「优先复用，禁止在 feature 内自建同类控件」——按钮必须使用共享 `Button.vue`。

**逐文件按钮归属**：

| 文件 | 按钮位置（行） | 其中属「例外登记」 |
|------|---------------|------------------|
| `CardActionBar.vue` | 6, 25, 38, 56, 75, 90, 104, 112 | 25/38/75（菜单项浮层内） |
| `CardHeaderActions.vue` | 24, 45, 57, 76, 97, 109, 120, 132, 147, 153, 160, 174, 189, 206, 211, 216, 221, 227, 234, 245, 258 | 45/57/97/109/120/132/147/153/160/174/189/206/211/216/221/227/258（浮层内 + 行内二次确认） |
| `WorkingTreePanel.vue` | 28, 36, 44, 72, 108, 144, 191, 203, 222 | 144（commit type 分段，见 3.6） |
| `TagPanel.vue` | 6, 30, 40, 50, 87, 97, 104, 115, 133 | — |
| `StashSection.vue` | 27, 45, 55, 65, 102, 109, 116 | — |
| `BranchCommitList.vue` | 18, 40, 124, 132, 143 | — |
| `CardHeader.vue` | 7, 74, 85, 106 | 74/85/106（徽章按钮，见 3.4） |
| `WorkingTreeDiffDialog.vue` | 62, 76, 89, 102, 133 | — |
| `AiErrorAnalysisDialog.vue` | 23, 36, 48, 63, 109, 134 | 63（折叠头，见 3.7） |
| `ConflictSection.vue` | 23, 34, 47 | — |
| `CardRemotes.vue` | 6 | — |
| `ListViewToolbar.vue` | 9, 27, 42, 63 | 9/27/42/63（见 3.5、3.6） |
| `OutputPanel.vue` | 42 | — |

**建议改法**：

```vue
<!-- 现状 -->
<button class="vp-btn vp-btn--ghost vp-btn--sm" :disabled="loading" :title="i18n.refresh" @click="...">
  <Icon :icon="loading ? 'mdi:loading' : 'mdi:refresh'" height="12" :class="{ 'gp-spin': loading }" />
</button>

<!-- 目标（紧凑几何由新增的 dense 修饰保证观感不变） -->
<Button
  variant="ghost"
  size="xsmall"
  dense
  :icon="loading ? 'loading' : 'refresh'"
  :loading="loading"
  :title="i18n.refresh"
  @click="..."
/>
```

**注意**：`vp-btn--xs` 在本目录未被使用（仅供模块其他目录的行内按钮），本目录统一映射到 `size="xsmall" dense`。

---

### 3.2 🔴 原生表单控件未走共享组件

| 控件 | 位置 | 现状类名 | 目标组件 |
|------|------|---------|---------|
| `<select>` | `BranchCommitList.vue:29` | `.bcl-count-select` | `Select` |
| `<select>` | `CardHeaderActions.vue:6` | `.gp-cat-select` | `Select` |
| `<select>` | `WorkingTreePanel.vue:163` | `.wt-template-select` | `Select` |
| `<input>` | `BranchCommitList.vue:12` | `.bcl-search-input` | `Input` |
| `<textarea>` | `WorkingTreePanel.vue:179` | `.wt-commit-msg` | `Textarea` |
| `<button>` 手画勾选框 | `WorkingTreePanel.vue:72` | `.wt-checkbox` | `Checkbox` |

**违反**：`AGENTS.md` 复用清单——「输入框 / 多行文本域（用 `Textarea`，不用 `Input` 的 `type="textarea"`）/ 下拉 / 复选框」必须使用共享组件。

**⚠️ 迁移陷阱（必须遵守）**：
1. `Select` / `Input` 是**纯受控组件**（内部只 `emit`，显示完全取自 `props.modelValue`）。用 `:model-value` + `@update:model-value` 时**必须在 handler 内先回写 ref**，否则选中后文案与勾选态停在旧值。`Select` 载荷类型为 `string | number | boolean | null`。
2. `WorkingTreePanel.vue:29` 的条数下拉值是 `number | "all"` 联合类型，`Select` 的 `options` 需按此构造（`value` 支持任意标量）。
3. `wt-checkbox` 现以 `mdi:checkbox-marked` / `mdi:checkbox-blank-outline` 伪装，且是**整行点击查看 diff** 内的独立点击区（`@click.stop`）——改 `Checkbox` 时需保留 `@click.stop`，避免冒泡触发父行 `toggleDiff`。
4. `AGENTS_STYLE.md`：「弹窗/表单场景 `<Input>`/`<Select>` 必须显式 `size="small"`」。本目录既有 `Input` 用法（`TagPanel.vue:16,24`、`StashSection.vue:18`）用的是 `xsmall`——**保持 xsmall 与现有紧凑观感一致**，并在同批改动中确认不与「全宽搜索栏可用 medium」的例外冲突。

---

### 3.3 🔴 自建标签页（2 处）

| 位置 | 现状 | 目标 |
|------|------|------|
| `CardTabs.vue:7-20` | `.gp-stash-tag-tab` 自绘 tab 条（4 个 Tab + 计数徽标），无 `role="tab"` / `aria-selected` / 键盘导航 | `Tabs` + `TabList` + `Tab` + `TabPanels` + `TabPanel` |
| `ListViewToolbar.vue:63-77` | `.gp-tab` 分类导航（带分类色点 `.gp-tab-dot` + 计数 `.gp-tab-count`） | `Tabs` 五件套，或 `Button` 分组 + `:aria-pressed` |

**违反**：`AGENTS.md` 复用清单——「标签页切换」必须使用共享组件。

**⚠️ 迁移陷阱**：`Tabs` 五件套**必须传 `lazy`**，否则 4 个面板同时挂载（现状 `v-if="stashTagTab === 'xxx'"` 是惰性的），会带来额外渲染开销与副作用。

**建议**：`CardTabs` 用 `Tabs` 五件套（结构清晰、计数徽标可放 `Tab` 默认插槽）；`ListViewToolbar` 的分类导航带分类色点（每项颜色不同）与横向滚动，`Tabs` 未必能直接表达，**建议改用 `Button` 分组 + `:aria-pressed`**（符合「一组互斥选项的分段切换仍用 `Button` 分组」），保留色点作为按钮内装饰元素。

---

### 3.4 🔴 自建弹窗（2 处）

| 位置 | 现状 | 问题 |
|------|------|------|
| `AiErrorAnalysisDialog.vue:3-7` | `<Teleport to="body">` + 自绘 `.gp-ai-overlay` + `.gp-ai-dialog` + `@click.self` 关闭 + `window keydown` 监听 Esc | 违反「对话框（模态弹层）必须用共享组件」；`Teleport` 与共享弹层「就地 `position: fixed`」约定不符 |
| `WorkingTreeDiffDialog.vue:3-7` | `<Teleport to="body">` + 自绘 `.wt-diff-overlay` + `.wt-diff-dialog` | 同上 |

**目标**：`src/components/Dialog.vue`。

**⚠️ 迁移陷阱**：
1. 共享弹层**不用 `Teleport`**（就地 `position: fixed` + 遮罩 `inset: 0`）——迁移时必须移除 `Teleport`。
2. `Dialog.dismissableMask` **默认 `false`**（与官方一致）；现状两个弹窗都支持「点遮罩关闭」，需显式开启。
3. `WorkingTreeDiffDialog` 的 **←/→ 文件切换**必须保留「捕获阶段 `stopImmediatePropagation`」逻辑（`WorkingTreeDiffDialog.vue:296-303`），否则按键穿透触发下层弹窗的 Esc。Esc 与焦点归还由 `Dialog` 内建，但参数化键盘逻辑需自行挂 `window` 监听——**保留现有实现**，只移除 Esc 分支。
4. `WorkingTreeDiffDialog` 已有 `role="dialog"` + `aria-modal="true"` + `:aria-label="file.path"`（`:9-13`），迁移后由 `Dialog` 接管，勿重复。

---

### 3.5 🟡 自建开关与分段切换

| 位置 | 现状 | 目标 |
|------|------|------|
| `ListViewToolbar.vue:27-40` | `.gp-ft-btn`「含归档」开关（`.active` 类表状态，无 `aria-pressed`） | `ToggleButton`（`v-model` 为 boolean） |
| `ListViewToolbar.vue:42-54` | `.gp-ft-btn`「暂停 Git 状态加载」开关（无 `aria-pressed`） | `ToggleButton` |
| `ListViewToolbar.vue:9-23` | `.gp-vm-btn` × 5 的智能视图互斥分段（无 `aria-pressed`） | `Button` 分组 + `:aria-pressed` |
| `WorkingTreePanel.vue:144-152` | `.wt-type-btn` commit type 互斥分段（无 `aria-pressed`） | `Button` 分组 + `:aria-pressed` |

**违反**：`AGENTS.md`「单按钮布尔开关用 `ToggleButton`，一组互斥选项的分段切换仍用 `Button` 分组 + `:aria-pressed`」；`AGENTS_STYLE.md` 无障碍命名条款。

**⚠️ 迁移陷阱**：
- `ToggleButton` **不传 on/off 文案时会退化为方形纯图标按钮**（本项目两处开关正是「图标 + 条件文案」场景，需显式传 `title` / `ariaLabel`）。
- 不要给 `ToggleButton` 传 `--severity-*`（会污染 `--outlined` 取色）。
- 现状两个开关是「激活时才显示文案」（`v-if="showArchived"` / `v-if="gitOpsPaused"`），`ToggleButton` 的 `onLabel`/`offLabel` 是恒定文案——若要保持「仅激活时显示文案」的观感，需评估改用 `Button` + `:aria-pressed`（与分段一致）。

---

### 3.6 🟡 自建折叠区

**位置**：`AiErrorAnalysisDialog.vue:63-77`（`.gp-ai-errors-toggle`「失败日志」折叠头 + `v-if="errorsExpanded"` 内容区）

**违反**：`AGENTS.md` 复用清单——「可折叠面板」必须使用共享组件。

**目标**：`src/components/Panel.vue`（`collapsed` 受控，可选 prop 不给默认值、用 `props.collapsed === undefined` 判定非受控）。

---

### 3.7 🟡 徽标 / 标签未用共享组件

| 位置 | 现状类名 | 目标 |
|------|---------|------|
| `CardRemotes.vue:37-41` | `.gp-status-badge`（推送状态徽章） | `Tag`（`variant="success\|danger\|info"`） |
| `WorkingTreePanel.vue:9-22` | `.wt-count` > `.wt-staged/.wt-unstaged/.wt-untracked`（计数标记） | `Tag` 或保留（纯展示） |
| `BranchCommitList.vue:87-117` | `.bcl-tags` > `.bcl-tag-chip` / `.bcl-tag-more`（Tag 徽标 + `+N`） | `Tag`（`icon="tagOutline"`） |
| `WorkingTreeDiffDialog.vue:31-33` | `.wt-diff-status` / `.wt-diff-badge`（状态 + 暂存态徽章） | `Tag` |
| `CardHeader.vue:27-36` | `.gp-archived-tag`（归档角标） | `Tag` / `Badge` |

**违反**：`AGENTS.md` 复用清单——「标签 / 徽标」必须使用共享组件（`Tag.vue` / `Badge.vue`，二者职责不重叠：`Badge` 是角标，`Tag` 是独立行内标签）。

**⚠️ 注意**：`Tag.variant` 兼容库内既有命名与官方 severity 命名（`warning`≡`warn`、`danger`≡`error`、`default`≡`secondary`）。迁移时不要自造颜色类。

---

### 3.8 🟡 10px 正文违反「两级字号制」

**证据**：

| 文件:行 | 声明 | 说明 |
|---------|------|------|
| `styles/Buttons.scss:17` | `.vp-btn--sm { font-size: $t-2xs }` | 按钮文案 = 控件正文，10px |
| `styles/ListViewToolbar.scss:29` | `.gp-vm-btn { font-size: $t-2xs }` | 分段按钮文案 10px |
| `styles/ListViewToolbar.scss:59` | `.gp-ft-btn { font-size: $t-2xs }` | 开关文案 10px |
| `styles/ListViewToolbar.scss:95` | `.gp-tab { font-size: $t-2xs }` | Tab 文案 10px |
| `styles/ListViewToolbar.scss:121` | `.gp-tab-count { font-size: $t-2xs }` | 计数徽标（合法：辅助文字） |

**违反**：`AGENTS_STYLE.md`——「这是两级字号制中**唯一**允许 10px 出现在控件正文的场景（组件库 `size` 档位）……**不得**据此在 feature 业务样式中把正文降到 10px」。

**建议**：迁移到共享 `Button` 后，`.gp-vm-btn` / `.gp-ft-btn` / `.gp-tab` 三个类整体删除或用例消失，`size="xsmall"` 的档位自带的 10px 由组件库承担，合规。

---

### 3.9 🟡 过渡时长不统一

**证据**（规则要求统一 `0.12s`，`grep 'cubic-bezier|0.18s|0.2s|0.25s'` 应零命中）：

| 文件:行 | 现状 |
|---------|------|
| `styles/Buttons.scss:13` | `transition: opacity 0.15s, border-color 0.15s, background 0.15s` |
| `styles/ListViewToolbar.scss:32` | `transition: opacity 0.15s, background 0.15s` |
| `styles/ListViewToolbar.scss:62` | `transition: opacity 0.15s, border-color 0.15s, background 0.15s` |
| `styles/ListViewToolbar.scss:98` | `transition: opacity 0.15s, border-color 0.15s` |
| `styles/CardHeader.scss:177` | `transition: opacity 0.15s, border-color 0.15s` |
| `styles/CardHeader.scss:209` | `transition: opacity 0.15s, transform 0.1s` |
| `styles/BranchCommitList.scss:13,43,68` | `transition: ... 0.15s` |

正例：`styles/CardHeaderActions.scss:115`、`styles/BranchCommitList.scss:169,184`、`styles/CardTabs.scss:29` 已是 `0.12s`。

---

### 3.10 🟡 遮罩层级与背景模糊

| 文件:行 | 现状 | 规则 |
|---------|------|------|
| `styles/AiErrorAnalysisDialog.scss:14` | `backdrop-filter: blur(2px)` | 「禁止 `backdrop-filter`」（blur/saturate 在 Electron 下有滚动性能开销，且偏离全局观感）——全项目 grep 应零命中 |
| `styles/AiErrorAnalysisDialog.scss:9` | `z-index: 9999` | 「全屏遮罩统一 `z-index: 10000`」 |

---

### 3.11 🟡 硬编码 `line-height`

| 文件:行 | 现状 | Token |
|---------|------|-------|
| `styles/CardActionBar.scss:60` | `line-height: 1` | `$lh-tight`(1.25) 或显式注释豁免 |
| `styles/BranchCommitList.scss:141` | `line-height: 14px` | `$lh-tight` / `$lh-normal` |

**违反**：`AGENTS_STYLE.md` 禁止事项表——`line-height: 1.25 / 1.5` 等硬编码须用 `$line-height-*`。

---

### 3.12 🟡 i18n 硬编码文案

| 位置 | 现状 | 建议 |
|------|------|------|
| `CardTabs.vue:32-37` | `TABS` 数组 label 硬编码英文 `CHANGES` / `LOG` / `STASH` / `TAG` | 新增 4 个带语义前缀的键（如 `cardTabChanges` / `cardTabLog` / `cardTabStash` / `cardTabTag`），zh_CN + en_US 分片同步 |
| `BranchCommitList.vue:43` | `title="刷新提交日志"` 硬编码中文 | 复用已有键 `i18n.refreshCommitLog`（该键已在 `CardHeaderActions.vue:213` 使用，确认分片中已存在） |

**流程要求**：只改分片 `src/i18n/{zh_CN,en_US}/gitPush.json`，改完**必须** `pnpm i18n:merge` 再 `pnpm i18n:verify`（只改分片不 merge ⇒ 运行时读到的合并产物缺键）。

**正例**：本目录 0 处 `i18n.xxx || '中文兜底'` 写法，模板内 i18n 文案注释齐备。

---

### 3.13 🟢 定时器未走统一入口

| 位置 | 现状 | 正例对照 |
|------|------|---------|
| `AiErrorAnalysisDialog.vue:284,291,307` | 原生 `let copiedTimer: ReturnType<typeof setTimeout>` + `setTimeout` / `clearTimeout` | 同目录 `OutputPanel.vue:70,112,125,134` 已正确使用 `TimerRegistry` |
| `WorkingTreeDiffDialog.vue:268,276,308` | 同上（`COPY_FEEDBACK_MS = 2000`） | 同上 |

**违反**：`AGENTS.md` 统一入口表——「定时器：`TimerRegistry`（`setInterval` / `setTimeout` / `clear` / `clearAll`）」。

---

### 3.14 🟢 其他

| 项 | 位置 | 说明 |
|----|------|------|
| 字符代替图标 | `WorkingTreePanel.vue:227` | 关闭按钮用 `×` 文本字符，建议 `IconWrapper name="close"`（`●` / `○` 为计数图例字符，属纯展示，保留） |
| `@use` 基线不一致 | `ConflictSection.vue:78`、`StashSection.vue:219` | 只 `@use "../../styles/index.scss"`，同目录其他组件均为 `@use "@/index.scss" as *;` + 组件专属 scss 双行导入 |
| model 透传冗余 | `ListView/index.vue:48-51` 与 `ListViewToolbar.vue:92-95` | 同一个 4 个 `defineModel` 定义两遍，`index.vue` 仅做转发；可评估合并 |
| 弱类型 | 全部子组件 | `i18n` prop 统一为 `Record<string, any>`，模板内键名无编译期校验（模块既有做法，改动面大，本轮仅登记） |
| 文件行数 | `WorkingTreePanel.vue` 419、`CardHeaderActions.vue` 334、`WorkingTreeDiffDialog.vue` 318 | 300~500 区间属「需要关注」，未破 500 硬阈值，本轮不拆 |

---

## 四、例外登记表（**允许自建，本轮不改**）

依据：`AGENTS.md`「共享组件缺能力时：先扩展共享组件，再在 feature 中消费」——以下为 `src/components/` **确无对应实现**的控件，登记为模块级例外。

| 例外项 | 位置 | 自建类名 | 理由 |
|--------|------|---------|------|
| 卡片内下拉菜单浮层（拉取/推送菜单） | `CardActionBar.vue:20,70` | `.gp-inline-menu-wrap` / `.gp-inline-menu-popover` / `.gp-inline-menu-item` / `.gp-inline-menu-divider` | 共享库无 Menu / Popover；`TieredMenu` / `MegaMenu` 是多列导航菜单，语义与交互（就地窄浮层 + 互斥开关）不匹配 |
| 顶栏平台链接浮层 | `CardHeaderActions.vue:39-71` | `.gp-platform-wrap` / `.gp-platform-popover` / `.gp-platform-item` | 同上（含右键复制链接的自定义交互） |
| 顶栏 IDE 打开浮层 | `CardHeaderActions.vue:91-184` | `.gp-ide-wrap` / `.gp-ide-popover` / `.gp-ide-item` / `.gp-ide-divider` | 同上 |
| 顶栏刷新选项浮层 | `CardHeaderActions.vue:200-231` | `.gp-refresh-wrap` / `.gp-refresh-popover` / `.gp-refresh-item` | 同上 |
| 行内二次确认（自定义 IDE 删除） | `CardHeaderActions.vue:144-159` | `.gp-ide-del-confirm` / `.gp-ide-del-yes` / `.gp-ide-del-no` | 共享 `ConfirmDialog` 是模态弹窗，此处需在浮层内就地确认；`ConfirmPopup` 为气泡确认，位置能力不匹配 |
| 空状态 | `BranchCommitList.vue:65-70`、`TagPanel.vue:147-156` | `.bcl-empty` / `.gp-tag-empty` | 共享库无 EmptyState 组件（`AGENTS_STYLE.md` 只给了空状态的样式范式） |
| 复合业务卡片容器 | `ProjectCard.vue:3` | `.gp-card` | 含 11 个子区块的复合业务容器（头部/远程/切换条/4 个面板/冲突/操作栏/双输出面板），与 `Card.vue` 的「标题/主体/页脚」三段式结构不匹配；属规则允许的「纯展示的局部布局容器」 |
| 列表/树/行结构 | `.bcl-entry`、`.wt-file-row`、`.gp-stash-row`、`.gp-tag-row`、`.gp-remote-item`、`.gp-stash-pending-row` | — | 纯展示的局部布局容器，规则明确允许自建 |
| 菜单互斥开关 composable | `composables/useCardMenu.ts` | `openMenu` / `toggleMenu` | 卡片内浮层共享状态，非控件 |
| 模块内非 scoped 样式 | 目录 14/14 文件 `<style lang="scss">` 无 `scoped`（模块级共 82 个非 scoped 块） | — | `AGENTS_STYLE.md` 未明文强制 `scoped`；且存在跨组件样式依赖（`StashSection.vue:139` 使用定义在 `WorkingTreePanel.scss` 的 `.wt-file-status`），就地 `scoped` 化会**静默失效**；属模块既有范式，单独立项评估 |

---

## 五、假阳性排除（**不作为违规**）

| 项 | 排除理由 |
|----|---------|
| 裸 `import { Icon } from "@iconify/vue"` + 任意 `mdi:*` 图标（本目录 14 文件，全项目 87 文件） | 全项目通行做法，非 gitPush 独有；`setupIconifyOffline()` 已预载 mdi 集合，功能正常 |
| 原生 `:title` 气泡（本目录大量使用） | 全项目通行做法；共享 `Tooltip` 用于需富内容的场景 |
| `Button.icon` 的 IconKey 约束 | 迁移后需要 `IconKey`，**需新增约 25 个 `COMMON_ICONS` 条目**（见整改方案），不属「现状违规」 |

---

## 六、整改方案与验收标准

### 6.1 前置：共享库能力扩展

| 项 | 改动 | 说明 |
|----|------|------|
| `Button` 紧凑修饰 | `src/components/Button.vue` 新增 `dense?: boolean`（默认 `false`）；`buttonClasses` 追加 `"si-button--dense"` | 新类名路线，符合「新增能力一律走新类名」；**不改**四档字号阶梯 |
| 紧凑几何 | `src/components/styles/Button.scss` 新增 `&--dense.si-button--xsmall { min-height: 0; padding: $s-px2 $s-px5; gap: $s-px3; border-radius: $r-sm; }` | 几何对齐 `vp-btn--sm`（去 `min-height`、padding `2px 5px`、gap `3px`、圆角 `4px`）；**必须显式 `min-height: 0`** 抵消档位自带值 |
| 图标键 | `src/components/kit/icons.ts` 的 `COMMON_ICONS` 补登迁移所需 IconKey（约 25 条通用命名，零业务耦合） | 纯图标按钮**不能**把 `<Icon>` 放进默认插槽（会让 `isIconOnly` 恒假，尺寸档位与无障碍名派生全部失效） |
| 文档同步面 | `AGENTS.md`（Button 清单表行 + 复用清单 + 组件总数 4 处）、`AGENTS_STYLE.md`（按钮尺寸章节）、`componentPreview/previewData/button.ts`（`dense` 示例）、`componentPreview/README.md`、`components/kit/README.md` | 新增共享能力必须同步；陈旧数字常埋在表格单元格中间，收尾用 `\d+ 个` 全量复扫 |

### 6.2 迁移顺序（按风险从低到高）

1. **原生控件**（行为等价）：`Select` × 3、`Input` × 1、`Textarea` × 1、`Checkbox` × 1 → 试点 `BranchCommitList.vue`（改动面小、验证快）
2. **开关与分段**：`ToggleButton` × 2、`Button` 分组 `:aria-pressed` × 2
3. **标签页**：`CardTabs.vue` → `Tabs` 五件套（`lazy`）
4. **弹窗与折叠**：两个自绘弹窗 → `Dialog`；折叠区 → `Panel`；同步改 `TimerRegistry`
5. **按钮批量迁移**：`vp-btn*` → `Button size="xsmall" dense`，并按语义映射颜色轴
6. **样式收尾**：删除自建控件样式、过渡统一 `0.12s`、去 `backdrop-filter`、`z-index` 归 `10000`、`line-height` Token 化
7. **i18n**：补 `CardTabs` 4 键 + `BranchCommitList` 复用键 → `pnpm i18n:merge` → `pnpm i18n:verify`

### 6.3 颜色轴映射表（`vp-btn` → `Button`）

| 现状类 | 目标 props |
|--------|-----------|
| `vp-btn vp-btn--ghost vp-btn--sm` | `variant="ghost" size="xsmall" dense` |
| `vp-btn vp-btn--primary vp-btn--sm` | `variant="primary" size="xsmall" dense` |
| `vp-btn vp-btn--danger vp-btn--sm` | `variant="danger" size="xsmall" dense` |
| `vp-btn vp-btn--ghost vp-btn--sm gp-btn-danger` | `variant="ghost" size="xsmall" dense severity="danger"`（悬停变红语义） |

### 6.4 验收标准

- [ ] `ListView` 目录内 `vp-btn` 出现次数归零（`grep -c 'vp-btn'`）
- [ ] `ListView` 目录内裸 `<select>` / `<input>` / `<textarea>` 归零
- [ ] `ListView` 目录内 `<button` 仅剩「例外登记」范围内的菜单项与行内确认按钮
- [ ] `grep 'backdrop-filter|cubic-bezier'` 在 `gitPush/styles` 零命中
- [ ] `grep '0\.18s|0\.2[0-9]s|0\.25s'` 在 `ListView` 相关 scss 零命中
- [ ] `pnpm typecheck` 无新增错误
- [ ] `pnpm i18n:verify` 通过（中英键对齐）
- [ ] `pnpm validate:icons` 通过
- [ ] `read_lints` 对改动文件归零
- [ ] 目视回归：按钮高度 / 字号 / 圆角 / 间距与整改前一致

### 6.5 执行边界

- **不**改 `gitPush` 其余目录（27 个文件仍用 `vp-btn`，`styles/Buttons.scss` **保留**）
- **不**改任何数据获取、Git 操作、状态流转逻辑；所有 `defineEmits` 契约、`v-model` 语义、`defineExpose` 暴露面保持不变
- **不**执行 `pnpm vite build` / `pnpm lint`（由用户执行）；**不**用 `npx tsc --noEmit`（必须 `pnpm typecheck`）；**不**新建临时校验脚本

---

## 七、整改记录（2026-09-14）

### 7.1 共享库能力（先落地，后消费）

| 文件 | 改动 |
|------|------|
| `src/components/Button.vue` | 新增 `dense?: boolean`（默认 `false`），`buttonClasses` 追加 `si-button--dense` |
| `src/components/styles/Button.scss` | 新增 `&--dense.si-button--xsmall`（`min-height: 0` / `padding: 2px 5px` / `gap: 3px` / `border-radius: 4px`，纯图标 `--button-size: 20px`）；独立使用（非 xsmall）不产生效果 |
| `src/components/ToggleButton.vue` | 新增 `dense?: boolean` 透传给内部 Button（紧凑开关场景需要） |
| `src/components/kit/icons.ts` | `COMMON_ICONS` 补登 23 个 IconKey（`unfoldMoreHorizontal` / `archiveOutline` / `clockOutline` / `cloudRefreshOutline` / `deleteOutline` / `pencilOutline` / `folderOutline` / `helpCircleOutline` / `history` / `noteTextOutline` / `refreshCircle` / `undoVariant` / `applicationBrackets` / `minusBoxOutline` / `plusBoxOutline` / `pauseCircle` / `pauseCircleOutline` / `fileDocumentCheckOutline` / `fileDownloadOutline` / `tagOffOutline` / `tagPlusOutline` / `sourceBranch` / `sourceCommit`） |
| `src/features/componentPreview/previewData/button.ts` | 新增 2 条 `dense` 示例（紧凑文字按钮 / 紧凑纯图标按钮） |
| `AGENTS.md` / `AGENTS_STYLE.md` / `componentPreview/README.md` | Button 清单行 + 复用清单 + 按钮尺寸章节 + README 新增「紧凑按钮修饰」条目 |

### 7.2 控件迁移（16 文件）

| 文件 | 迁移内容 |
|------|---------|
| `BranchCommitList.vue` | 裸 `<input>` → `Input`（`clearable`）；裸 `<select>` → `Select`（受控回写 `handleCountChange`）；行内按钮 → `Button(dense)`；tag chip / `+N` → `Tag`；硬编码中文 `title` → `i18n.refreshCommitLog` |
| `ListViewToolbar.vue` | 智能视图 5 项分段 → `Button` 组 + `:aria-pressed`；归档 / 暂停开关 → `ToggleButton`（`dense` 透传，`onLabel` 仅按下态显示以保留原观感）；分类导航 → `Button` 组 + `:aria-pressed`（保留分类色点与计数）；新增 `VIEW_MODE_ICONS` 投影（IconKey） |
| `CardTabs.vue` | 自建 tab 条 → `Tabs` + `TabList` + `Tab` + `TabPanels` + `TabPanel`（`lazy`）；面板改为**具名插槽**（`#worktree/#log/#stash/#tag`）由 `ProjectCard` 下发，获得真实 `tabpanel` 语义；`TABS` 文案接 i18n（`cardTabChanges/Log/Stash/Tag`） |
| `ProjectCard.vue` | 四个 `v-if` 面板收进 `CardTabs` 的具名插槽（`TabPanel lazy` 保持「未激活不挂载」） |
| `WorkingTreePanel.vue` | `.wt-checkbox` → `Checkbox`（外包一层拦截冒泡）；`.wt-template-select` → `Select`（受控 + 占位项）；裸 `<textarea>` → `Textarea`；9 处按钮 → `Button(dense)`；丢弃按钮走 `severity="danger"`；`defineExpose.clear` 同步重置模板下拉 |
| `CardHeaderActions.vue` | `gp-cat-select` → `Select`（受控 + `handleCategoryChange`）；触发 / 编辑 / 配置 / 删除按钮 → `Button(dense)`；**保留**浮层菜单项与行内二次确认（例外登记） |
| `CardHeader.vue` | 星标 → `Button(text)`；md 徽章 / `+N` → `Button(text)`；归档角标 → `Tag(contrast + fill)`；分支标签 → `Button(text)`（当前分支高亮走 `.current` 类） |
| `CardActionBar.vue` | 拉取 / 推送触发按钮 → `Button(dense)` + `icon-position="right"`；强制推送 → `variant="danger"`；推送全部 → `variant="primary"`；取消 → `variant="danger"`；**保留**内联菜单浮层（例外登记） |
| `CardRemotes.vue` | 刷新按钮 → `Button(dense)`；`gp-status-badge` → `Tag`（新增 `statusVariant()` 映射 ahead/behind/diverged/synced → primary/warning/danger/success） |
| `ConflictSection.vue` | 3 处按钮 → `Button(dense)`（保留本地 / 保留远程 / 中止合并）；补 `@use "@/index.scss"` 基线 |
| `TagPanel.vue` | 9 处按钮 → `Button(dense)`；推送中改用 Button 内建 `loading`；清理死类 `.gp-tag-input` 与冗余 `.vp-btn--sm` |
| `StashSection.vue` | 7 处按钮 → `Button(dense)`；暂存 / 生成描述改用 Button 内建 `loading` |
| `OutputPanel.vue` | AI 分析入口 → `Button(dense)` |
| `WorkingTreeDiffDialog.vue` | `Teleport` + 自绘遮罩 → `Dialog`（`size="large"`、`dismissableMask`、`closable=false`、header 插槽承载标题行 + 操作区、`headerId` 打到标题元素）；4 处分隔线 → `Divider(vertical)`；状态 / 暂存徽章 → `Tag`；其余按钮 → `Button(dense)`；Esc 交由 Dialog 内建，**保留** ←/→ 捕获阶段拦截；`setTimeout` → `TimerRegistry` |
| `AiErrorAnalysisDialog.vue` | `Teleport` + 自绘遮罩 → `Dialog`（header 插槽 + footer 插槽）；折叠区 → `Panel`（受控 `collapsed` + `toggleable`）；按钮 → `Button(dense)`；`setTimeout` → `TimerRegistry`；移除自建 `window keydown` Esc 监听 |

### 7.3 样式与 i18n

- **过渡统一 0.12s**：`ListViewToolbar.scss`（重写）、`BranchCommitList.scss`、`CardHeader.scss`、`CardRemotes.scss`、`WorkingTreePanel.scss`、`index.scss`（`.gp-card` / `.gp-stash-help`）
- **删除自绘遮罩**：`AiErrorAnalysisDialog.scss` 的 `.gp-ai-overlay`（`backdrop-filter: blur(2px)` + `z-index: 9999` 一并消失，遮罩 / 层级 / 过渡改由共享 Dialog 承担）；`WorkingTreeDiffDialog.scss` 的 `.wt-diff-overlay` 同理
- **10px 正文清零**：`Buttons.scss` 的 `&--sm`、`ListViewToolbar.scss` 的 `.gp-vm-btn/.gp-ft-btn/.gp-tab` 三处 feature 级 `font-size: $t-2xs` 全部移除（10px 由共享组件 `xsmall` 档位合法承担）
- **`line-height` Token 化**：`CardActionBar.scss` 的 `line-height: 1`（随 `.gp-action-btn` 几何覆盖一并删除）、`BranchCommitList.scss` 的 `line-height: 14px`（随 tag chip 迁移删除）
- **特异性策略**：覆写共享组件的规则统一抬到 (0,3,0)～(0,4,0)（`.git-push-panel` / 容器类作前缀），替代原 `!important`（`.gp-action-btn--active/--ok/--fail`）
- **i18n**：新增 5 键（`cardTabChanges/cardTabLog/cardTabStash/cardTabTag/commitLogCountLabel`），中英分片同步，`pnpm i18n:merge` + `pnpm i18n:verify` 通过（4499 叶子键对齐）

### 7.4 有意的观感变化（记录在案）

| 项 | 整改前 | 整改后 | 说明 |
|----|--------|--------|------|
| `ToggleButton` 按下态 | 透明底 + 主色淡底 + 主色描边 | `severity="primary"` 填充实底 | 共享 ToggleButton 的既定配色轴（未按下 = 中性描边，按下 = 主色实底） |
| `CardTabs` 激活态 | 下划线 + 主色淡底 | 下划线 + 主色文字（无淡底） | 共享 Tab 的既定激活态（下划线 + 主色文字） |
| `Dialog` 宽度 | 自绘 90vw / max 800px | `size="large"`（680px）+ `--si-dialog-width: min(90vw, 800px)` 覆写 | 视觉等价 |
| 勾选框加载态 | 暂存中显示旋转图标 | Checkbox 置灰禁用 | 共享 Checkbox 无 loading 形态；禁用语义等价 |
| 徽章配色 | 自绘色值 | `Tag` 的 `variant` 体系 | 一一对应（ahead→primary / behind→warning / diverged→danger / synced→success） |

### 7.5 范围外残留（登记，不属本轮）

| 项 | 位置 | 说明 |
|----|------|------|
| `.vp-btn` 体系过渡 0.15s | `styles/Buttons.scss:13` | 27 个非 ListView 文件仍在用，改 0.12s 属模块级全局观感变化，随整体迁移单独立项 |
| `.gp-toggle-chip` 过渡 0.15s | `styles/index.scss` | 使用方在 ListView 之外（编辑弹窗等），同上 |
| `.gp-caret-icon { margin-left: 3px }` | `styles/Shared.scss` | 仍被 `CardHeaderActions` 的双图标触发按钮使用；Button 的 `__text` 已提供 4px gap，迁移后略增 1px，属可接受偏差 |

### 7.6 验证结果

| 检查 | 结果 |
|------|------|
| `pnpm typecheck`（vue-tsc） | ✅ 0 error |
| `pnpm i18n:verify` | ✅ 通过（4499 叶子键对齐，无重复键） |
| `pnpm validate:icons` | ✅ 通过（232 个图标全部有效） |
| `read_lints`（ListView 全目录 + 改动的共享库文件） | ✅ 0 诊断 |
| `grep 'vp-btn'`（ListView 目录） | ✅ 0 处 |
| 裸 `<select>` / `<input>` / `<textarea>`（ListView 目录） | ✅ 0 处 |
| 裸 `<button>`（ListView 目录） | 18 处，全部位于例外登记范围（下拉菜单浮层项 + 行内二次确认） |
| `grep 'backdrop-filter'`（ListView 相关 scss） | ✅ 0 处 |
| `pnpm lint` / `pnpm vite build` | ⏳ 由用户执行 |

