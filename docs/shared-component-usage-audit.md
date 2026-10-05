# 全项目共享组件复用情况审查报告

> 审查日期：2026-09-14 ｜ 审查范围：`src/features/**` 全量（~469 个 `.vue`）+ 共享库 `src/components/`（56 个 `.vue`）横向比对
> 审查方式：逐类控件全量 grep + 命中处**逐文件回读原文核对**（预扫描只当线索）+ 共享组件 `interface Props` 实证 + 与前序 gitPush 系列报告同口径
> **交付性质**：本轮为**纯报告**（按先例「先出全量审查报告，再分批整改」）；整改批次见 §六
> 结论：**违规 8 类 / 约 130 处 / 涉及约 70 个文件**；另有 5 类允许自建例外登记、9 项低采用度组件待逐项裁决、若干假阳性排除
> 交叉验证：`MEMORY.md:75`「待迁移：原生 radio 5 处、`input[type=color]` 8 处、`<select>` 30+ 处、`ReviewRadarChart` 未迁 `Chart`」与本轮实测**完全一致**（`<select>` 计数差异见 §3.3 注）

---

## 一、规则依据

| 出处 | 条款 |
|------|------|
| `AGENTS.md:181` | `src/components/` 是**全项目唯一的 UI 控件来源**（52 个组件）。三条强制要求：**先查用法 → 优先复用 → 改 API 必同步** |
| `AGENTS.md:185` | 写任何共享组件前先查真实 props 与示例，**禁止凭记忆猜 props 名或取值** |
| `AGENTS.md:197` | 「优先复用，**禁止在 feature 内自建同类控件**」 |
| `AGENTS.md:199` | 强制复用清单（逐字）：按钮 / 按钮式开关 / 浮动动作按钮 / 输入框 / 多行文本域 / 下拉 / 列表选择 / 开关 / 复选框 / **单选框** / 日期选择 / 滑块 / 标签 / 徽标 / 头像 / 卡片 / 图表 / 图标 / 加载态 / **颜色字段** / 输入框组合器 / 确认对话框 / 分页 / 时间线 / 分隔线 / 可折叠面板 / 可调整的分割面板 / 标签页切换 / 工具栏 / 气泡确认 / **对话框（模态弹层）** / **抽屉（侧边浮层）** / 文字提示 / 文件上传 / 大型菜单 / 级联菜单 / 侧边栏 / 内联消息提示 |
| `AGENTS.md:199` | **单按钮布尔开关用 `ToggleButton`，一组互斥选项的分段切换仍用 `Button` 分组 + `:aria-pressed`**（本报告 §3.4 判据来源） |
| `AGENTS.md:200` | 共享组件缺能力时：**先扩展共享组件**（加可选 props、保持向后兼容），禁止在 feature 内复制一份改改 |
| `AGENTS.md:264-267` | 改共享组件 props / 行为后**必须同步** `previewData/*.ts` 与 `componentPreview/README.md` |
| `AGENTS_STYLE.md` | 强制规则：按钮交互与无障碍 —— 按钮为唯一交互入口、键盘可达、纯图标须有可访问名 |
| `MEMORY.md:48` | 共享库**无 Popover/OverlayPanel**；`tooltip/ overlay/ select/` 等小写目录是**私有支撑层**（禁 feature 导入） |
| `MEMORY.md:75` | 待迁移登记：feature 内原生 radio 5 处、`input[type=color]` 8 处、`<select>` 30+ 处、`ReviewRadarChart` 未迁 `Chart` |
| `docs/gitPush-listview-controls-review.md`、`docs/gitPush-commitanalysis-controls-review.md` | 同口径先例（例外登记范围、观感变化记录格式、验证章节格式、**浮层内部项按钮**为例外而**锚点按钮仍是违规**的边界判据） |

---

## 二、结论总览

| 严重度 | 类别 | 实测规模 | 涉及文件 |
|--------|------|---------|---------|
| 🔴 高 | 自建 `.vp-btn` 按钮体系 | **~60 处** | ~28 |
| 🔴 高 | 原生 `input[type=color]`（**功能性缺陷**） | **8 处** | 6 |
| 🔴 高 | 原生 `<select>` | **~18 处** | 13 |
| 🔴 高 | 原生 `<input type="radio">`（`RadioButton` 采用数 = **0**） | **11 处** | 5 |
| 🔴 高 | 自建弹层外壳（未用 `Dialog`/`Drawer`） | **~40 处自建遮罩** | ~40 |
| 🟡 中 | 自建 Tab 切换条（未用 `Tabs` 五件套） | **4 处** | 4 |
| 🟡 中 | 自建进度条（未用 `ProgressBar`） | **~20 处** | ~14 |
| 🟡 中 | 原生 `type="checkbox"` / `type="range"` | **~34 处** | ~20 |
| 🟢 低 | 自绘图表（`Chart` 能力缺口） | 1 处 | 1 |

### 关键结构性发现（本轮最值得记录）

**发现 1｜`gitPush` 是最大集中区，且同模块内合规度落差极大**

| 子目录 | 共享导入 | 自建 `.vp-btn` | 定性 |
|--------|---------|--------------|------|
| `components/ListView/` | 多 | 0 | ✅ **合规范本**（已整改） |
| `components/CommitRuleCheck/` | 多 | 0 | ✅ **合规范本**（已整改） |
| `components/CommitAnalysis/` | 多 | 0 | ✅ **合规范本**（已整改） |
| `components/RepoCleanPanel/` | **3**（`Select`/`Loader`/`Input`） | **8** | 🔴 全项目合规度最低 |
| `components/common/` | 少 | **~35** | 🔴 重灾区 |

> **判据价值**：同模块内已有 3 个整改完毕的**可直接对照的范本**，整改无需重新设计范式，照抄即可 —— 这是本报告建议 `gitPush` 优先的核心理由。

**发现 2｜「部分迁移」是普遍形态，违规面与「是否引入过共享库」无关**

反例（已用共享组件却仍自建同类控件）：

| 文件 | 已用了什么 | 却仍自建什么 |
|------|-----------|-------------|
| `gitPush/components/common/SettingsDialog.vue` | `Input`（`:123`） | `.vp-btn`（8 处）、原生 `type="radio"`（`:97,106`）、原生 `type="checkbox"`（`:217,234,251,268`） |
| `video/components/CompressDialog.vue` | `Select`（`:28`）、`Button`（`:17`） | 自建 `dialog-overlay`（`:5`）、原生 `type="radio"`（`:41,50`）、自建进度条（`:116`） |
| `generalSettings/components/TabPinSettings.vue` | `Switch`（`:181`） | 原生 `type="color"`（`:90`） |
| `imageCreation/components/CodeImageTab.vue` | `Switch`（`:388`） | 原生 `type="color"`（`:155`）、原生 `type="range"`（`:127`） |

> **结论**：整改**不能按文件整体判定**，必须**逐控件**排查。

**发现 3｜`input[type=color]` 不是观感问题，是功能不可用（最高优先级）**

`src/components/ColorField.vue:1` 头部注释逐字写明：

> 「颜色字段：色块弹出自绘预设调色板 + 文本输入框双向联动（**思源 Electron 环境不弹出原生 `input[type=color]` 取色器，故改用自绘调色板**）」

⇒ 现存 8 处原生取色器**点击后无任何弹窗**，用户只能靠旁侧 hex 文本框手输。该缺陷已被前序报告点名在册（`docs/gitPush-commitanalysis-controls-review.md:104-106`，其中 `:106` 明言「单独立项批量替换」，本报告即该项落地）。

---

## 三、违规清单

### 3.1 🔴 自建按钮体系 `.vp-btn`（~60 处 / ~28 文件）

**现状形态**：`<button class="vp-btn vp-btn--ghost vp-btn--sm">` + 裸 `<Icon :icon="mdi:*">`。

**违反**：`AGENTS.md:199` 复用清单「按钮」；`AGENTS.md:197` 禁止在 feature 内自建同类控件。

**分布（按目录）**：

| 目录 / 文件 | 处数 |
|------------|------|
| `gitPush/components/RepoCleanPanel/CleanWizardDialog.vue` | 7（`:13,115,216,227,234,247,260`） |
| `gitPush/components/common/EditProjectDialog.vue` | 9（`:15,100,111,125,183,206,233,243,250`） |
| `gitPush/components/common/SettingsDialog.vue` | 8（`:17,77,131,148,155,199,282,307`） |
| `gitPush/components/common/EditableRemoteList.vue` | 7（`:28,35,49,61,74,85,125`） |
| `gitPush/components/common/ScanImportDialog.vue` | 6（`:16,36,46,74,126,133`） |
| `gitPush/components/common/DropCommitDialog.vue` | 6（`:13,169,179,212,221,229`） |
| `gitPush/components/common/IdeManagementDialog.vue` | 7（`:15,50,58,76,83,117,129`） |
| `gitPush/components/common/PanelHeader.vue` | 5（`:34,50,86,97,109,121`） |
| `gitPush/components/common/GitConfigSection.vue` | 5（`:17,54,184,204,215`） |
| `gitPush/components/common/CommitFileDiffDialog.vue` | 3 |
| `gitPush/components/LogPanel/LogDetailDialog.vue` | 4 |
| `gitPush/components/CodeReport/index.vue` | 2 |
| `gitPush/components/CodeReport/FileDetailModal.vue` | 1 |
| `gitPush/components/RepoCleanPanel/RepoCleanToolbar.vue` | 1 |
| `gitPush/components/RepoCleanPanel/index.vue` | 1 |
| `gitPush/components/common/LoadMoreButton.vue` | 1（`:6`，**被多处复用 ⇒ 修一处收益最大**） |
| `gitPush/components/common/TagCommitDialog.vue` | 3 |
| `gitPush/components/common/BatchFixDialog.vue` | 4 |
| `gitPush/components/common/CommitFixDialog.vue` | 4 |
| `gitPush/components/common/CommitFilesDialog.vue` | 2 |
| `gitPush/components/common/ConsistencyAuditDialog.vue` | 2 |
| `gitPush/components/common/AddProjectDialog.vue` | 5 |
| `gitPush/components/common/CategoryDialog.vue` | 3 |
| `gitPush/components/common/MarkdownPreviewDialog.vue` | 1 |
| `gitPush/components/common/CloneLogPanel.vue` | 1 |

**目标写法**（与已整改子目录同构）：

```vue
<!-- 带文案按钮 -->
<Button variant="primary" size="xsmall" dense @click="save">{{ i18n.save }}</Button>

<!-- 纯图标按钮：走 icon prop，禁把 <Icon> 塞默认插槽 -->
<Button variant="ghost" size="xsmall" dense icon="cogOutline" :title="i18n.settings" />

<!-- 加载态交给 Button.loading（保宽 + spinner + 自动禁用） -->
<Button variant="primary" size="small" :loading="running" :disabled="running" @click="run">
  {{ i18n.run }}
</Button>
```

**⚠️ 迁移陷阱**
1. **纯图标按钮禁传默认插槽** —— 会让 `isIconOnly` 恒假，尺寸档位与无障碍名派生全部失效（`MEMORY.md:17`）。
2. `Button.icon` 只收 `IconKey`（`kit/icons.ts` 已注册键）⇒ 新图标**必须先补登 `IconKey`** 并跑 `pnpm validate:icons`。
3. **删 `import { Icon } from "@iconify/vue"` 前必须 grep 模板 `<Icon`** —— 残留时 lint 与 typecheck **都不报**。
4. `dense` **仅与 `size="xsmall"` 协同生效**（去 `min-height`、padding `2px 5px`、gap `3px`、圆角 `4px`，纯图标 20px），单独使用**不产生效果**（`AGENTS.md:195`）。
5. 覆写共享 `Button` 尺寸：档位类 `min-height: 28/36/44px` 会**反向定高**（须同写 `min-height: 0`）；`--button-size` 仅 `isIconOnly` 生效；覆写统一抬到 (0,3,0)～(0,4,0)，padding/圆角须 (0,4,0)，**悬停须 6 类 (0,6,0)**（组件 hover 为 5 类）（`MEMORY.md:19,51`）。
6. `Button` 默认插槽被包进 `.si-button__text { flex:1; gap:4px }` ⇒ 整行/多列内容塞进 Button 时**布局要下沉到 `__text`**，否则行 `display:flex/gap` 失效（`MEMORY.md:51`）。
7. `.vp-btn--xs` / `--sm` / `--ghost` / `--primary` / `--danger` 迁后失效 ⇒ 删死样式前**必须 grep 全项目残留**（`.gp-color-input` 的先例教训：样式定义在共享文件且仍被他处依赖，不能随手删）。

### 3.2 🔴 原生取色器 `input[type=color]`（8 处，**功能性缺陷**）✅ **已整改（批次 A）**

> **状态**：8 处已于 2026-09-14 全部迁 `ColorField`，实施记录见 §七「批次 A」。以下保留审查时原貌以便回溯。

| 位置 | 现状 |
|------|------|
| `generalSettings/components/TabPinSettings.vue:90` | `<input :value="toPickerHex(backgroundColor)" type="color" class="color-picker" @input="onColorPickerInput($event)">` |
| `superPanel/components/FeatureCard.vue:96` | `<input type="color" :value="colorValue" @input="onColorInput">` |
| `imageCreation/components/CoverDecorationSettings.vue:53,61,69` | 3 处原生取色器 |
| `imageCreation/components/CodeImageTab.vue:155` | 原生取色器 |
| `gitPush/components/common/CategoryDialog.vue:58` | `<input type="color" class="gp-color-input" ...>` |
| `prompts/components/CategoryManageModal.vue:44` | `<input v-model="form.color" type="color" class="vp-color-input" :aria-label="...">` |

**违反**：`AGENTS.md:199` 复用清单「**颜色字段**」必须用共享 `ColorField`；`ColorField.vue:1` 明示原生取色器在思源 Electron 下不弹窗。

**目标写法**（`ColorField.vue:53-58` 实证：仅 `modelValue: string` + `placeholder?`，**无 `disabled`**）：

```vue
<ColorField
  :model-value="colorDraft"
  placeholder="#3b82f6"
  @update:model-value="colorDraft = $event"
  @change="commitColor"
/>
```

**⚠️ 迁移陷阱**
1. **双事件语义**（`ColorField.vue:1-2,62-66`）：`update:modelValue` = **实时值**（文本逐字触发，仅更新内存）/ `change` = **提交信号**（文本 blur・回车・调色板选色后触发，供落盘）。现写法 `@input` 是**逐字落盘** ⇒ 迁移后必须挂 `@change` 提交、`update:modelValue` 只改本地草稿。
2. 父级「收 patch 即写存储」时（如 `updateViewSettings` 每次 `storage.save`），`update:modelValue` 直连 patch = **逐字写盘** ⇒ **必须本地草稿 `ref`**（`MEMORY.md:50`）。已落地先例：`gitPush/components/CommitAnalysis/AnalysisSettingsForm.vue`（批次 C 整改）。
3. **无 `disabled` prop** ⇒ 需要有禁用态的场景要另行处理（本 8 处均未做禁用态 ✓）。
4. `ColorField` 根 `.color-field { width: 100% }` ⇒ 放进 `display:flex; justify-content: space-between` 的设置行时**宽度表现未实测**，落地需目视确认（可能需 `flex: 0 0 auto` + `width: auto`）。
5. `TabPinSettings.vue:94-99` 已有 `.lazy` 文本输入 + 注释「失焦/回车才提交，避免每敲一个字符触发保存」⇒ **迁移必须保留该语义**（正好与 `ColorField` 的 `change` 一致）。
6. `.gp-color-input` 定义在**共享** `styles/index.scss`，仍被他处依赖 ⇒ **不能随迁移删除**。

### 3.3 🔴 原生 `<select>`（~18 处 / 13 文件）

| 位置 | 用途 |
|------|------|
| `docAnalysis/components/SettingsPanel/QuerySection.vue:20,41,52` | 筛选条件 / 排序字段 / 升降序（`:57-58` 为硬编码「升序」「降序」） |
| `docAnalysis/components/DocListView/index.vue:75` | 排序字段（`v-for="opt in SORT_FIELD_OPTIONS"`） |
| `docAnalysis/components/DocListView/FilterSettings.vue:67` | 笔记本筛选 |
| `skillLearning/components/CategoryFilter.vue:10,27,44` | 分类 / 难度 / 状态（`:47-53` 含 `beginner`/`intermediate`/`advanced`） |
| `skillLearning/components/SkillDialog.vue:95` | 难度（`:95-101`） |
| `rssReader/components/settings/SettingsPanel.vue:87` | 排序（`:87-91` `newest`/`oldest`） |
| `gitPush/components/CommitAnalysis/AnalysisSettingsForm.vue:33,47` | 显示范围 / 每周第一天 |
| `gitPush/components/common/GitConfigSection.vue:165` | 预设选择 |
| `superPanel/components/AiProfileManager.vue:11` | AI 配置档案 |
| `superPanel/components/AiModelSelect.vue:36` | 模型（含 `value="custom"`） |
| `generalSettings/components/CodeBlockSettings.vue:191` | 代码块样式 |
| `quickNote/components/todo/TodoForm.vue:87` | 待办分类 |
| `statistics/components/heatmap/HeatmapCard.vue:75` | 统计维度 |

> **注（与 `MEMORY.md:75` 的「30+ 处」口径差异）**：本轮按「**独立控件实例**」计数得 ~18 处；`MEMORY.md` 的 30+ 疑似按 `<select>` + `<option>` 或含 `docAnalysis` 内多分支计。**本报告以回读原文的实例数为准**（`MEMORY.md:52` 已警告预扫描计数只能当线索）。差异不影响结论方向。

**违反**：`AGENTS.md:199` 复用清单「下拉」必须用共享 `Select`。

**目标写法**：

```vue
<Select
  :model-value="sortField"
  :options="SORT_FIELD_OPTIONS"
  size="xsmall"
  @update:model-value="(v) => sortField = String(v)"
/>
```

**⚠️ 迁移陷阱**
1. `Select` 是**纯受控**组件（显示全取 `props.modelValue`）⇒ 必须 `:model-value` + handler 内**回写 ref**（`MEMORY.md:27`）。
2. 载荷类型为 `string | number | boolean | null`：现状多个 select 已用 `String(...)` 归一 ⇒ `options` 的 `value` 需与之一致（年份用 `String(y)` 或 `number` + handler 内 `Number()`，**不要混用**，否则**选中态静默匹配失败**）。
3. 迁后死样式（`.sort-select` / `.filter-select` / `.notebook-select` / `.settings-select` / `.gpa-settings-select`）须删；`max-width` / 限宽须改挂共享 `Select` 根 —— 留在根上的 `border/background/padding` 会与组件自身 `__trigger` 外壳叠成**双层框**（`docs/gitPush-listview-controls-review.md:187-190`）。
4. `docAnalysis` 内 4 处同源（共用 `SORT_FIELD_OPTIONS`，`types/index.ts`）⇒ **建议同批处理**，避免两处口径再次分叉。
5. `gitPush/components/CommitAnalysis/AnalysisSettingsForm.vue:33,47` 是**已整改批次 C 的遗留**（同文件分段切换与取色器均已迁完，仅剩这两个 select）⇒ 优先收口，成本最低。
6. `QuerySection.vue:57-58` 的 `<option value="asc">升序</option>` 是**硬编码中文** ⇒ 迁 `Select` 时须同步走 i18n（另涉 `AGENTS_I18N.md` 禁令）。

### 3.4 🔴 原生 `<input type="radio">`（11 处 / 5 文件，`RadioButton` 采用数 = **0**）

| 位置 | 用途 |
|------|------|
| `video/components/CompressDialog.vue:41,50` | 压缩模式（`crf` / 目标码率），`:38` 为 `<label class="radio-label">` |
| `toolCollection/tools/wordQuery/components/WordQueryPanel.vue:78,86` | 查询模式 |
| `gitPush/components/common/BatchFixDialog.vue:38,47` | 修复范围 |
| `gitPush/components/common/CommitFixDialog.vue:109,118` | 修复策略 |
| `gitPush/components/common/SettingsDialog.vue:97,106` | 推送分支模式（`:94-111` 为 `<label class="gp-set-radio">` + `<input v-model="localBranchMode" type="radio" value="all|head">` + `<span>文案</span>`） |

**违反**：`AGENTS.md:199` 复用清单「**单选框**」必须用共享 `RadioButton`；`MEMORY.md:75` 已登记为待迁移。

**⚠️ 判据说明（关键）**：这 5 处均为「**一组互斥选项**」而非「按钮式分段切换」⇒ 按 `AGENTS.md:199` 的二分法，应用 **`RadioButton`**，**不是** `Button` 分组 + `aria-pressed`。（对照：`gitPush/components/CommitAnalysis/AnalysisTabs.vue:7-25` 的视角切换是**分段切换**，用 `Button` 分组 + `aria-pressed` 正确 ✓）

**目标写法**（`RadioButton.vue:61-105` 实证）：

```vue
<RadioButton v-model="branchMode" name="pushBranchMode" value="all" :label="i18n.pushBranchAllOpt" />
<RadioButton v-model="branchMode" name="pushBranchMode" value="head" :label="i18n.pushBranchHeadOpt" />
```

**⚠️ 迁移陷阱**
1. **同组必须共用 `name`** —— 否则方向键导航与 ARIA 单选语义失效（`RadioButton.vue:84-85` 明示）。
2. `value` 仅 `string | number` 会落到 DOM（`stringValue` computed，`RadioButton.vue:125-129`）⇒ 布尔/对象值须归一，分组态由**受控 `v-model`** 表达。
3. 事件为 `update:modelValue` / `change` / `focus` / `blur`（`RadioButton.vue:100-105`）。
4. 现状是 `<label><input><span>文案</span></label>` 结构 ⇒ 迁后原 `<span>` 文案改走 `label` prop 或默认插槽（`RadioButton.vue:38-43`），并删除外层 `.radio-label` / `.gp-set-radio` 死样式。

### 3.5 🔴 自建弹层外壳（~40 文件自建遮罩；`Dialog` 采用仅 7 处、`Drawer` 采用 **0**）

**现状**：大量 `.dialog-overlay` / `.modal-overlay` / `.vp-overlay` / `*-overlay` 自建遮罩 + 自建 `.dialog` 容器。

**代表性文件**：

| 目录 | 文件 |
|------|------|
| `video/components/` | `CompressDialog.vue` / `EncryptDialog.vue` / `DecryptDialog.vue` / `MergeDialog.vue` / `MergeAudioDialog.vue` / `VideoDownloadDialog.vue` / `VideoPlayerDialog.vue` / `FFmpegPathDialog.vue`（8 个，全用 `.dialog-overlay`） |
| `passwordVault/components/` | `ExportModal.vue` / `EntryFormModal.vue` / `ChangePasswordModal.vue` / `CategoryManagerModal.vue` |
| `htmlViewer/components/` | `SnippetLibrary.vue` / `SnippetEditModal.vue` / `CategoryManager.vue` |
| `prompts/components/` | `PromptFormModal.vue` / `DeleteConfirmModal.vue` / `CategoryManageModal.vue` |
| `statusBar/components/` | `FeatureDrawer.vue`（**抽屉语义 ⇒ 应为 `Drawer`**，`:3` 用 `Teleport to="body"`） |
| 其他 | `skillLearning/SkillDialog.vue`、`skillsViewer/{CopySkillModal,DeleteConfirmModal}.vue`、`statistics/milestones/MilestoneRuleEditor.vue`、`flashcardReading/CardDialog.vue`、`imageCompressor/CompressDialog.vue`、`floatingToolbar/{QRCodeDialog,PronunciationDialog}.vue`、`aiContentGenerator/SkillPreviewModal.vue`、`minimalBrowser/index.vue`、`gitPush/CodeReport/FileDetailModal.vue`、`gitPush/common/CommitFileDiffDialog.vue`、`gitPush/LogPanel/LogDetailDialog.vue`、`docAnalysis/{SettingsPanel,AttrsPanel}/index.vue`、`everythingSearch/index.vue` 等 |

**违反**：`AGENTS.md:199` 复用清单「**对话框（模态弹层）**」/「**抽屉（侧边浮层）**」。

**对照正例**（仅 7 处已用 `Dialog`）：`gitPush/components/ListView/{WorkingTreeDiffDialog,AiErrorAnalysisDialog}.vue`、`gitPush/components/LineStats/FetchFailuresDialog.vue`、`s3FileManager/components/{FmNameDialog,FmMoveCopyDialog,FmLogPanel,FmConfigDialog}.vue`、`toolCollection/tools/shortcut/components/ShortcutDialog.vue`。

**⚠️ 迁移陷阱**
1. ⚠️ **共享弹层不用 Teleport**（就地 `fixed` + 遮罩 `inset:0`）⇒ 带 `transform` / `filter` / `contain` 的祖先会成为**包含块把弹层裁剪**；`FeatureDrawer.vue:3` 现用 `Teleport to="body"`，迁 `Drawer` 时须一并评估（`MEMORY.md:21`）。
2. ⚠️ **遮罩点关判定**（`overlay/useOverlay.ts`）必须 `event.target === event.currentTarget`；否则 `Dialog` **点进表单第一下即关**、`ConfirmDialog` 先 cancel 再 confirm ⇒ **确认回调读 null 静默失效**（`MEMORY.md:22`）。自建实现里普遍是 `@click="$emit('close')"` + 内层 `@click.stop`（如 `video/CompressDialog.vue:6,10`），迁移时该语义由共享组件承担 ✓。
3. **不是所有自建浮层都该迁** —— 共享库**无 Popover/OverlayPanel**（`MEMORY.md:48`）⇒ 「齿轮设置浮层」这类**非模态内容承载浮层**应**登记为例外**（先例：`gitPush/components/CommitAnalysis/CommitAnalysisSettings.vue`）。判据见 §四.2。
4. **例外边界（逐字沿用先例判据）**：只含「浮层**内部**项按钮」可豁免，**浮层锚点按钮仍是违规**（`docs/gitPush-listview-controls-review.md:51-52`）。
5. `Drawer` 与 `Dialog` 的遮罩/Esc/焦点接管**全复用私有目录 `overlay/`**，事件集一致（`update:visible`/`show`/`hide`/`after-hide`）；`Dialog` 用 `header` 插槽时须把 `headerId` 打到标题元素（`MEMORY.md:73`）。

### 3.6 🟡 自建 Tab 切换条（4 处，未用 `Tabs` 五件套）

| 位置 | 现状 | 处置 |
|------|------|------|
| `docAnalysis/index.vue:5-15` | `<div class="tab-bar">` + `<button class="tab-btn" :class="{ active: ... }">` + 裸 `<Icon :icon="tab.icon" />` | 🔧 迁 `Tabs` 五件套（`:5-15` 含三 Tab：统计/列表/排版） |
| `imageCreation/index.vue:37,49` | `.tab-btn` + `.active` 类表状态 | 🔧 迁 `Tabs` |
| `statistics/components/milestones/MilestoneRuleEditor.vue:28,36,44` | 3 个 `.tab-btn` | 🔧 迁 `Tabs` |
| `gitPush/components/CommitAnalysis/AnalysisTabs.vue:5` | `role="tablist"` + **共享 `Button` 分组** + `:aria-pressed` | 🟢 **登记为观察项**（形态已合规，仅 `role` 语义与 `Tabs` 的取舍待裁决，不擅自改） |

**违反**：`AGENTS.md:199` 复用清单「**标签页切换**」必须用共享 `Tabs` 五件套；现写法用 `.active` 类表状态 ⇒ **读屏无法得知哪个标签被选中**（无障碍缺口）。

**⚠️ 迁移陷阱**
1. **迁 `Tabs` 必须 `lazy`**（`MEMORY.md:27`），否则未激活面板进 DOM、切走再回来状态不重置。
2. `Tab` / `TabPanel` 的 `value` **必填**，且**严格相等**判定激活（库内不做官方 `equals()` 深比较）⇒ 仅 `string | number`；五件套**必须成组**，脱离即抛错。
3. `docAnalysis/index.vue` 的 `<Icon>` 是**裸 Iconify 组件**，迁移时改走 `Button.icon` / `IconKey` ⇒ **删 `import { Icon }` 前必须 grep 模板 `<Icon`**（残留时 lint 与 typecheck 都不报）。
4. ⚠️ 若用 `v-if` 在两种控件间切换，**必须手动移交焦点**（`await nextTick()` 后调子组件 `focus()`），否则用户敲键盘**静默落空**（`MEMORY.md:28`）。
5. `docAnalysis/index.vue:16-28` 的「浮动窗口」「设置」按钮**同在 `.tab-bar` 内**，属**工具栏**语义 ⇒ 建议一并评估迁 `Toolbar`（与 `Tabs` 分组承载）。

### 3.7 🟡 自建进度条（~20 处，未用 `ProgressBar`）

**正例**（应作为范式）：`s3Backup/components/BackupProgressSection.vue:10`（注释明示「共享组件，自带 `role="progressbar"` 语义」）、`s3Backup/components/BackupTab.vue:94`、`s3FileManager/index.vue`、`diskBrowser/components/NavPane.vue`。

**违规分布**（自建 `.progress-bar` + `.progress-fill` 结构）：

| 目录 | 文件数 | 位置 |
|------|-------|------|
| `video/components/` | 6 | `CompressDialog.vue:116`、`EncryptDialog.vue:55`、`DecryptDialog.vue:39`、`MergeDialog.vue:87`、`MergeAudioDialog.vue:59`、`VideoDownloadDialog.vue:137` |
| `gitPush/components/common/` | 3 | `BatchFixDialog.vue:88`、`CommitFixDialog.vue:141`、`DropCommitDialog.vue:106` |
| `flashcardReading/components/StatisticsView.vue` | 1 | `:83-85` |
| `skillLearning/components/` | 3 | `ReviewView.vue:33`、`FlashcardView.vue:81`、`ProgressRing.vue:10`（环形，可能属能力缺口） |
| 其他 | 4 | `quickNote/components/project/ProjectItem.vue:77`、`imageCompressor/index.vue:105`、`generalSettings/components/MarkdownExportSettings.vue:143`、`statistics/components/milestones/MilestoneChip.vue:21` + `MilestonesCard.vue:63`（环形） |

**违反**：`AGENTS.md:199` 复用清单「图表/加载态」族 + 「徽标」；且自建版本**普遍缺 `role="progressbar"` 语义**。

**⚠️ 迁移陷阱**：环形进度（`ProgressRing.vue`、`MilestonesCard.vue:63`）**已实证不支持** —— `ProgressBar.vue:49,64` 的 `mode` 仅 `"determinate" | "indeterminate"`（`ProgressBarSize` / `ProgressBarSeverity` 无环形维度）⇒ **登记为能力缺口例外**并已写入 §4.2，不强行扭曲（同 §四.1 的热力图口径）。其余自建**线性**进度条均可直接迁 `ProgressBar`。

### 3.8 🟡 原生 `checkbox` / `range`（~34 处）

**`type="checkbox"`（~21 处 / 16 文件）**：`docAnalysis/components/SettingsPanel/HealthSection.vue:14,35`、`docAnalysis/components/PublishPanel/index.vue:94`、`video/components/{VideoDownloadDialog.vue:107,121,EncryptDialog.vue:37}`、`wordQuery/components/WordQueryPanel.vue:98`、`deepSeekCost/components/CostCalculator.vue:64`、`base64Image/index.vue:100`、`base64Image/components/{WatermarkSettings.vue:7,QrcodeGenerator.vue:28}`、`formatAssistant/index.vue:95`、`gitPush/components/common/{DropCommitDialog.vue:128,ScanImportDialog.vue:90,SettingsDialog.vue:217,234,251,268}`、`generalSettings/components/MarkdownExportSettings.vue:123`、`imageCompressor/index.vue:130`

**`type="range"`（~13 处 / 6 文件）**：`imageCreation/components/{CodeImageDecorationSettings.vue:72,86,100,114,128,CodeImageTab.vue:127}`、`base64Image/index.vue:74,87`、`base64Image/components/{WatermarkSettings.vue:36,48,QrcodeGenerator.vue:16,FilterSettings.vue:7,19,31,43,55}`、`generalSettings/components/SettingSlider.vue:14`

**⚠️ `Checkbox` 迁移陷阱**（`MEMORY.md:46`，判据最密）：
- **纯受控**（显示全取 `modelValue`，`nextTick` 拉回 DOM）
- `modelValue: boolean | any[]` —— **分组只认数组、不收 `Set`**
- **无 `title` prop**（靠单根透传到根 div，只能当 hover 提示）⇒ 无障碍名**必须 `ariaLabel`**
- 有 4 个事件：`update:modelValue` / `change` / `focus` / `blur`

> **`SettingSlider.vue` 已实证为违规（非假阳性）**：回读该文件确认它**不是** `Slider` 的薄包装 —— `:12-20` 是原生 `type="range"`，另有 `:5-11,:22-28` 两个原生 `±` 步进按钮，`:74-88` 自建钳制与小数位推导（`decimals` 避免浮点累加误差）。其对外的 `interface Props`（`:40-51`，含 `buttonStep` / `showValue` / `formatValue`）比共享 `Slider` 多「步进按钮 + 数值徽标」能力 ⇒ 两条路径二选一：**(a)** 按 `AGENTS.md:200` 「先扩展共享组件」给 `Slider` 加可选 `stepButtons` / `showValue`（保持向后兼容）后删除本文件；**(b)** 登记为有意例外。**建议 (a)**，因该形态在设置类界面可复用，且扩展属向后兼容。

### 3.9 🟢 自绘图表（`Chart` 能力缺口，1 处）

`aiContentGenerator/components/ReviewRadarChart.vue` —— 纯 SVG 六轴**雷达图**（`:1` 头注释「分项评分雷达图：纯 SVG 六轴视图」），被 `ReviewPanel.vue:53` 消费。

`Chart.vue` 仅支持 `line | bar | pie | doughnut | area`（`docs/gitPush-commitanalysis-controls-review.md:341` 实证 + `chart.types.ts`）⇒ **雷达图属能力缺口**，登记为例外（判据同 heatmap / 日历矩阵）。`MEMORY.md:75` 已登记「`ReviewRadarChart` 未迁 `Chart`」。

**处置建议**：若需合规，应为 `Chart.vue` **扩展 `radar` 类型**（属共享库能力扩展，`AGENTS.md:200` 允许「先扩展共享组件」），再删除自绘文件 —— 但**本轮不改**（超出复用整改范围，且需先改共享库 API + 同步预览清单）。

### 3.10 🟢 低采用度组件清单（待逐项裁决）

| 组件 | feature 采用数 | 定性建议 |
|------|--------------|---------|
| `RadioButton` | **0** | 🔴 违规（§3.4，11 处该用未用） |
| `Drawer` | **0** | 🔴 违规（§3.5，`FeatureDrawer.vue` 该用未用） |
| `Listbox` | 0 | ⚪ 待裁决（无「内联列表选择」场景？需逐处确认） |
| `Splitter` / `SplitterPanel` | 0 | ⚪ 待裁决（无「可调整分割面板」场景） |
| `Inplace` | 0 | ⚪ 待裁决 |
| `FocusTrap` | 0 | ⚪ 待裁决（弹层焦点管理可能已由 `overlay/useOverlay` 覆盖） |
| `MeterGroup` | 0 | ⚪ 待裁决（无「占比拆解」展示场景） |
| `SpeedDial` | 0 | ⚪ 待裁决（无「多动作浮钮」场景） |
| `Sidebar` / `SidebarMain` | 0 | ⚪ 待裁决（Dock 面板布局各有自建范式） |
| `Toast` | 0 | ⚪ 待裁决（项目用思源内置 `showMessage` 为主） |
| `Toolbar` | 4 | 🟡 偏少（大量自建 `.tab-bar` / 工具条） |
| `Tabs` 五件套 | 3 | 🟡 偏少（§3.6） |
| `Textarea` | 1 | 🟡 偏少（**新代码一律用 `Textarea`**；`Input` 的 `type="textarea"` 是旧入口、**有意保留勿改**） |
| `Panel` | 2 | 🟡 偏少 |
| `Slider` | 1 处（`SettingSlider.vue`） | 🟡 真实违规（自建 `range` + ± 按钮，**已回读确认非包装**）；建议先给 `Slider` 扩展可选 props |
| `Divider` | 1 | 🟡 偏少 |

> **裁决原则**：零采用**不等于**违规 —— 须逐项确认「本场景是否真的需要该控件」。报告中**只对已确认有对应场景者**（`RadioButton` / `Drawer`）定性为违规，其余登记待裁决，**不擅自改**。`SettingSlider.vue` 与环形进度**已回读原文实证**，故分别定性为「真实违规」与「能力缺口例外」，不留待确认。

---

## 四、假阳性排除与允许自建登记

### 4.1 假阳性排除（明确不改）

| 项 | 位置 | 判据 |
|----|------|------|
| `toolCollection/tools/colorPicker/index.vue:11` 的原生 `type="color"` | 同上 | **功能本体**：该工具的产品能力**就是**「HEX/RGB/HSL 互转 + 原生取色」（`:1` 头注释）。取色器在此是**被测对象**，非 UI 控件 ⇒ 不属违规（且 §3.2 的 8 处不含此文件） |
| `Button.isIconOnly` 陈旧 computed | `src/components/Button.vue` | `MEMORY.md:16`：**有意保留，勿改** |
| `Slider` 焦点环 `rgba(hsl(...),0.2)` | 全项目 60+ 处 | `MEMORY.md:16`：全项目同写法，**勿改** |
| `Input` 的 `type="textarea"` | `src/components/Input.vue` | `MEMORY.md:16`：**有意保留，勿改**（新代码用 `Textarea`） |
| `Message.severity` 的 `warn`/`error`/`contrast` | `src/components/Message.vue` | `MEMORY.md:18`：**照搬 PrimeVue**，与 `Button.severity` 的 `warning`/`danger` **有意不统一**，勿按库内命名「修正」 |
| 自建浮层**不用 Teleport** | `docs/*-controls-review.md` 多处 | `MEMORY.md:21`：共享弹层就地 `fixed` 是**库范式**，非缺陷 |
| `<Icon icon="mdi:*">` 裸用法 | 全项目通行 | 前序报告已排除（`setupIconifyOffline()` 预载）；**但迁 `Button` 时必须改走 `IconKey`** |
| `EmptyState` 的 `icon="mdi:…"` 字符串 prop | 多处 | 库内既有豁免（组件声明 `icon: string`） |
| `i18n: Record<string, any>` 透传 | 全项目 94+ 文件 | 前序报告仅登记不改 |
| 纯展示容器（卡片/区块标题/列表行骨架） | 多处 | 纯展示局部容器例外 |
| `usePagedList` + `LoadMoreButton` 渐进加载 | `gitPush` 内 | 模块统一做法（`Paginator` 在 gitPush 内用量 0） |

### 4.2 允许自建例外登记

| 例外项 | 位置 | 依据 |
|--------|------|------|
| 自绘雷达图 | `aiContentGenerator/components/ReviewRadarChart.vue` | **能力缺口**：`Chart.vue` 仅 `line\|bar\|pie\|doughnut\|area`，无 radar 类型（同 heatmap/日历矩阵口径） |
| 齿轮「设置」浮层（非模态内容承载） | `gitPush/components/CommitAnalysis/CommitAnalysisSettings.vue`、`docNavigation/components/FilterKeywordsEditor.vue:23-28`（`role="dialog"` 内联编辑面板） | 共享库**无 Popover/OverlayPanel**（`MEMORY.md:48`）；`ConfirmPopup` 是「气泡确认」语义不匹配、`TieredMenu`/`MegaMenu` 是导航菜单 |
| 自绘热力图 / 月历矩阵 | `gitPush/components/CommitAnalysis/{CommitHeatmap,CommitCalendar}.vue` | 同上（`Chart` 无 heatmap/matrix 类型），已在前序报告登记 |
| 环形进度 | `skillLearning/components/ProgressRing.vue`、`statistics/components/milestones/MilestonesCard.vue:63` | **能力缺口（已实证）**：`ProgressBar.vue:49` 的 `mode` 仅 `"determinate" \| "indeterminate"`，无环形形态 |
| 原生取色器（`colorPicker` 工具） | `toolCollection/tools/colorPicker/index.vue:11` | **功能本体**（§4.1） |
| 浮层**内部**项按钮 | 各处浮层内部 | 例外边界：**浮层锚点按钮仍是违规**（先例 `docs/gitPush-listview-controls-review.md:51-52,428`） |

### 4.3 跨目录待办（只登记不改）

| 待办 | 位置 | 说明 |
|------|------|------|
| `.gp-color-input` 样式不能随迁移删除 | `gitPush/styles/index.scss:430-436` | 仍被 `CategoryDialog.vue:59` 依赖；须与该文件同批处理 |
| `gitPush/SettingsDialog.vue` 存在**反向依赖** | 被 `AnalysisSettingsForm.vue` 等复用 | 改其 props/emits 会波及 `common/`，整改需同批回归 |
| `LoadMoreButton.vue` 是高复用自建按钮 | `gitPush/components/common/LoadMoreButton.vue:6` | 被多处消费 ⇒ **修一处收益最大**，建议批次 F 首个 |
| 共享库文档计数不一致 | `AGENTS.md:181`（52）vs `docs/components-vue3-migration-guide.md`（48） | 实测 `src/components/*.vue` = **56** ⇒ 收尾统一（计数用前重数） |
| `MEMORY.md:75` 待迁移行陈旧 | `.codebuddy/memory/MEMORY.md:75` | 整改后须更新（已迁项划掉、剩余登记） |

---

## 五、验证口径

| 检查 | 命令 | 门禁 |
|------|------|------|
| 规范 | `read_lints` | 0 诊断（偶有陈旧诊断，须回读代码核对） |
| TS + `.vue` props | `pnpm typecheck`（= vue-tsc） | exit 0（**禁** `npx tsc --noEmit`；`tsc` 不解析 `.vue`，既报假错又漏真错） |
| 图标 | `pnpm validate:icons` | 全部有效（涉及新增 `IconKey` 时必跑） |
| i18n | `pnpm i18n:merge` → `pnpm i18n:verify` | 中英叶子键对齐（涉及文案时必跑；**改完分片必须 merge 再 verify**） |
| 残留断言 | grep 目标文件/目录 | `.vp-btn` / `type="radio"` / `type="color"` / `type="checkbox"` / `type="range"` / `<select` / `@iconify/vue` / 裸 `<Icon ` 全 0 命中 |
| 换行符 | `git ls-files --eol <file>` | 期望 `w/crlf`（写入工具可能把 CRLF 文件整篇写成 LF-only） |
| 构建与 lint | `pnpm lint` / `pnpm vite build` | ⏳ **由用户执行**（AI 禁跑；`vite build` 才查 MISSING_EXPORT） |
| 目视回归 | 思源内确认 | `ColorField` 宽度与调色板定位、弹层裁剪与点关、Tab 切换与焦点、进度条档位 |

---

## 六、整改批次建议（按风险由低到高 / 依赖由先到后）

| 批次 | 内容 | 规模 | 前置 | 主要风险 |
|------|------|------|------|---------|
| **A** | 原生取色器 → `ColorField`，**修功能缺陷** | 8 处 / 6 文件 | 本地草稿 `ref` 范式（已有先例） | 双事件语义、逐字写盘、宽度未实测 | ✅ **已完成**（见 §七） |
| **B** | 原生 `<select>` → `Select` | ~18 处 / 13 文件 | — | 受控回写、载荷归一、双层框、死样式 |
| **C** | 原生 `radio` → `RadioButton` | 11 处 / 5 文件 | — | 同组 `name`、`value` 类型 |
| **D** | 自建 Tab → `Tabs` 五件套 | 3~4 处 | — | 必须 `lazy`、`value` 必填、焦点移交 |
| **E** | 自建弹层 → `Dialog` / `Drawer` | ~40 文件，**分两阶段** | 逐项裁决例外 | 无 Teleport、点关判定、裁剪 |
| **F** | 自建 `.vp-btn` → `Button` | ~60 处 / ~28 文件 | 图标补登 | 纯图标禁插槽、dense 协同、覆写特异性 |
| **G** | `Checkbox` / `Slider` / `ProgressBar` | ~54 处 | 确认环形能力缺口 | `Checkbox` 纯受控 + 无 `title` |
| **H** | 文档同步 + `MEMORY.md` 更新 | — | A–G | 计数口径 |

**建议执行顺序理由**：A（**修功能缺陷**，用户可感知收益最大）→ B/C（受控组件，范式成熟、风险可控）→ D（需改结构）→ E（体量大、需逐项裁决）→ F（体量最大、但同模块已有范本可抄）→ G（含能力缺口待确认）→ H（收尾）。

**每批收尾**：跑 §五 全部门禁 + 残留断言 grep 归零 + 有意观感变化逐条登记。

---

## 七、整改实施记录

### 批次 A：原生取色器 → `ColorField`（✅ 已完成 2026-09-14）

**改动文件（6 个组件 + 5 个 SCSS）**：

| 文件 | 改动 | 落盘策略 |
|------|------|---------|
| `superPanel/components/FeatureCard.vue` | `:96` 原生 `type="color"` → `ColorField`；删 `onColorInput` 处理器；`props` 改为无变量 `defineProps`（原 `props` 已无引用） | 父级 `colorChange` 事件照旧（调用方决定持久化） |
| `imageCreation/components/CoverDecorationSettings.vue` | `:53,61,69` 三处 `v-model` 原生取色器 → `ColorField` | **无草稿**：`useCoverSettings` 有 `setTimeout` 防抖保存（`:46-60`），`update:model-value` 直写 service 内存 |
| `imageCreation/components/CodeImageTab.vue` | `:155` 原生取色器 → `ColorField` | 同上（`useCodeImageSettings` 防抖 `:46-60`） |
| `gitPush/components/common/CategoryDialog.vue` | `:58` 原生取色器 → `ColorField`（`title` → `placeholder`） | 无（`newCatColor` 仅组件内 ref，添加时才 emit） |
| `prompts/components/CategoryManageModal.vue` | `:44` 原生取色器 → `ColorField` | 无（`reactive` 表单，`handleAdd` 才落库） |
| `generalSettings/components/TabPinSettings.vue` | `:88-99` 原生取色器 + hex 文本框（两个控件）→ **单个 `ColorField`**；新增 `colorDraft` 草稿 + `commitColor()` + `watch(backgroundColor)` 回填 | **有草稿**：`watch([...backgroundColor])` 直连 `emit + autoSave`（`:252-257`）⇒ 必须防逐字写盘 |

**SCSS 交还外观（删死样式 + 新增限宽）**：

| SCSS | 删除 | 新增 |
|------|------|------|
| `superPanel/styles/feature-card.scss` | `.feature-color-input input[type="color"]` | `.feature-color-field { flex:1; min-width:0 }` |
| `imageCreation/styles/CoverDecorationSettings.scss` | `.color-row input[type="color"]` | `.color-field-inline { flex:0 0 auto; width:150px }` |
| `imageCreation/styles/CodeImageTab.scss` | `.color-swatch` | `.color-swatch-field { flex:0 0 auto; width:150px }` |
| `gitPush/styles/index.scss` | `.gp-color-input`（迁移后**零消费方**，与审查阶段预判不同） | `.gp-cat-color-field { flex:0 0 auto; width:150px }` |
| `prompts/styles/CategoryManageModal.scss` | `.vp-color-input`（含 `-webkit-color-swatch*`） | `.vp-category-color-field { flex:0 0 auto; width:150px }` |
| `generalSettings/styles/TabPinSettings.scss` | `.color-picker` / `.color-picker:hover` / `.color-text` / `.color-text:focus`（及响应式内的两条） | `.tab-pin-color-field { flex:0 0 auto; width:200px }`（响应式 `width:100%`） |

**⚠️ 实施中发现的实质差异（修正审查阶段的预判）**：

1. **`TabPinSettings` 是三处中最复杂的一处，不能用朴素写法**：`DEFAULT_TABPIN_SETTINGS.backgroundColor` 实为 **`"rgba(var(--b3-theme-primary-rgb), 0.1)"`**（`types/storage.ts:273`），即**含 CSS 变量的 `rgba()` 表达式**，不是 hex；`PRESET_COLORS` 亦有多项 `rgba(...)`。故：
   - 保留 `toPickerHex()` 只用于**草稿展示归一化**（非 hex ⇒ `#000000`），真实值仍以 `backgroundColor` 为准；
   - `commitColor()` 对空串回滚草稿，避免用户清空输入框把颜色写成 `""`；
   - 新增 `watch(backgroundColor)` 在预设色板点击 / 重置 / 初次加载后**把草稿同步回 hex**（否则草稿与真实值漂移）。
   - **旧实现是「原生取色器 + 独立 hex 文本框」两个控件**，迁移后合并为**单个 `ColorField`**（色块 + 文本框 + 调色板三合一）⇒ 属**有意的 UI 收敛**。
2. **`.gp-color-input` 实际零消费方**：审查阶段据「样式定义在共享 `styles/index.scss`」推断可能被他处依赖（沿用 `.gp-color-input` 先例的谨慎口径），实测 grep 全项目仅 `CategoryDialog.vue:59` 一处引用 ⇒ 随迁移删除，**无需保留**。
3. **4 处无需草稿**：`CoverDecorationSettings` / `CodeImageTab` 的持久化层**已有防抖**（`setTimeout` + watch），`CategoryDialog` / `CategoryManageModal` 的状态**仅在提交时落库** ⇒ 只有 `TabPinSettings` 是真「收值即保存」，也只有它需要草稿。

**验证（批次 A）**：

| 检查 | 结果 |
|------|------|
| 残留断言 `type="color"` | ✅ 全项目仅剩 `toolCollection/tools/colorPicker/index.vue:11`（**已登记例外**：功能本体） |
| 残留断言 `gp-color-input` / `vp-color-input` / `onColorPickerInput` / `onColorInput` | ✅ **0 命中** |
| 死类名核对 | ✅ 7 个新类名（`feature-color-field` / `color-field-inline` / `color-swatch-field` / `gp-cat-color-field` / `vp-category-color-field` / `tab-pin-color-field`）模板与 SCSS **一一对应**，无孤立定义 |
| 类型核对 | ✅ 逐处回读：`s.colors.{bg,titleColor,accent}` / `state.bgColor` / `newCatColor` / `form.color` / `colorValue` 均为 `string`，符合 `ColorField.modelValue: string` |
| `read_lints` / `pnpm typecheck` | ⏳ **待用户执行**（本环境 `pwsh` 被沙箱 ACL 拒绝：`SetNamedSecurityInfoW failed (Win32 5)`，AI 侧无法运行命令） |
| 目视回归 | ⏳ **待确认**：6 处 `ColorField` 的宽度表现（根 `width:100%` 已逐一限宽，但实际观感需在思源内确认）；`TabPinSettings` 由两控件收敛为一控件后的行内布局 |

**有意的观感变化（记录在案）**：

| 项 | 变化 | 原因 |
|----|------|------|
| 全部 6 处取色器 | 原生 `input[type=color]` → 共享 `ColorField`（40×28 色块 + hex 文本框 + 自绘 32 色调色板） | **修复功能缺陷**：原生取色器在思源 Electron 下点击**无任何弹窗** |
| 取色器几何 | 各处自定尺寸（28×28 / 48×32 / 40×36 / 24×20 等）→ 统一 `ColorField` 档位 + 行内限宽 150/200px | 对齐共享库外观 |
| 落盘时机 | `@input` 逐字 / `.lazy` 失焦 → `change` 提交（blur・回车・选色） | 避免高频磁盘写入（`TabPinSettings`） |
| `TabPinSettings` 控件数 | 取色器 + 独立 hex 文本框（2 个）→ `ColorField`（1 个，内含文本框） | 共享组件自带文本框，消除重复控件 |
| `CategoryDialog` 提示 | 取色器的 `title` → `ColorField.placeholder`（`ColorField` 无 `title` prop） | 组件能力边界 |
| `CategoryManageModal` 无障碍 | 原生 `input` 的 `aria-label` 移除 | `ColorField` **无 `aria-label` prop**，透传只会落到根 `div`（对输入框无效）；改与库内先例一致（`AnalysisSettingsForm.vue:56-65` 用可见 `<span>` 标签 + `placeholder`） |

**业务行为零改动**：颜色值的读写路径、预设色板、重置按钮、`emit("change")` 契约、`colorChange` / `addCategory` 等对外事件全部保持不变。

---

## 八、待用户裁决事项

| # | 事项 | 默认建议 |
|---|------|---------|
| 1 | 是否先评审本报告、再进入整改？ | ✅ 建议先行评审（沿用先例「先出全量报告，再分批整改」） |
| 2 | `.vp-btn` 60 处体量大，一次性全迁 vs 按子目录分批 | 建议**分批**，`LoadMoreButton`（高复用）→ `RepoCleanPanel` → `common/` 其余 |
| 3 | `AnalysisTabs.vue` 用 `role="tablist"` + `Button` 分组是否算合规 | 建议**登记为观察项**，本轮不改 |
| 4 | 环形进度 → 是否给 `ProgressBar` 扩展环形能力？ | ✅ **已实证不支持**（`mode` 仅 determinate/indeterminate）⇒ 建议**登记例外**，不为两处改造共享库 |
| 5 | `SettingSlider.vue` 走「扩展 `Slider`」还是「登记例外」？ | 建议 **(a) 扩展共享 `Slider`**（加可选 `stepButtons` / `showValue`，向后兼容）后删除自建文件 |
| 6 | `Listbox`/`Splitter`/`Inplace`/`FocusTrap`/`MeterGroup`/`SpeedDial`/`Sidebar`/`Toast` 零采用是否要「制造使用点」 | 建议**不制造** —— 逐项确认无场景即登记「本场景不适用」，不做无意义改造 |
