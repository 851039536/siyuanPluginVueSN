# gitPush 设置汇总页计划

## 一、需求概述

将 gitPush 模块散落在多处的设置统一汇总到一个设置页面，方便集中管理。经确认：

- **汇总范围**：全部三类 —— ① 插件行为设置（Git 并发数 / 推送分支模式）② 提交分析显示设置（视图 / 显示范围 / 每周第一天 / 格子颜色）③ 全局 Git 配置管理（内嵌 GitConfigSection）。项目级 Git 配置仍留在项目卡片入口。
- **UI 形态**：扩展现有 SettingsDialog 为大弹窗 + 左侧分区导航，右侧显示对应分区内容。
- **入口处理**：保留原有散落入口（分析视图齿轮 popover、头部 (i) Git 配置按钮、项目卡片 Git 配置按钮），汇总页作为统一管理入口，两处修改同一份数据。

## 二、现状分析

| 设置 | 当前组件 | 入口 | 数据流 |
|------|---------|------|--------|
| 并发数 + 分支模式 | `components/common/SettingsDialog.vue`（窄弹窗 300px，仅 2 项） | PanelHeader 齿轮按钮 → index.vue `showSettings` | props `concurrency`/`pushBranchMode` + emits `save`/`saveBranchMode` → manager API → storage |
| 提交分析显示设置 | `components/CommitAnalysis/CommitAnalysisSettings.vue`（齿轮 + popover） | AnalysisToolbar 内齿轮 | emit `update(patch)` → AnalysisToolbar → CommitAnalysis/index.vue → 主 index.vue → `useCommitAnalysis.updateViewSettings`（合并 + 即时落盘 `git-push-analysis-view`） |
| 全局 Git 配置 | `components/common/GitConfigDialog.vue`（薄壳）内嵌 `GitConfigSection.vue`（自包含面板） | PanelHeader (i) 按钮 | GitConfigSection 自行 onMounted 加载、CRUD 直调 manager → 直接写 `~/.gitconfig`（不进插件存储） |

关键接线（[index.vue](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/index.vue)）：

- 第 18 行 `@open-settings="showSettings = true"`；第 167~177 行挂载 SettingsDialog（传 concurrency / pushBranchMode，绑 save / saveBranchMode）
- 第 69/72 行 CommitAnalysisPanel 传 `analysisViewSettings`、绑 `updateViewSettings`（来自第 583~584 行 useGitPush 解构，源头 `useCommitAnalysis`）
- 第 234~244 行挂载 GitConfigDialog（scope 可 global/local）

注意点：`viewSettings`（composable 内 ref）仅在进入分析视图时由 `ensureAnalysis() → loadViewSettings()` 加载；若用户从未进过分析视图就打开设置页修改显示设置，会用「默认值 + 单项 patch」覆盖已保存设置。**必须在打开设置页时先加载显示设置**（`loadViewSettings` 需从 useCommitAnalysis 导出）。

年份选项（显示设置的范围下拉）目前由 [CommitAnalysis/index.vue 第 130~139 行](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/components/CommitAnalysis/index.vue#L130-L139) 内联计算（数据年份 ∪ 今年 ∪ 已保存年份）；设置页也需要同一份逻辑 → 提取到 `utils.ts` 共享。

## 三、改动清单

### 1. 新增 `components/CommitAnalysis/AnalysisSettingsForm.vue`（提取表单）

从 `CommitAnalysisSettings.vue` 提取 popover 内部的 4 个设置行（视图两段式 / 显示范围下拉 / 每周第一天下拉 / 格子颜色 input）为独立表单组件：

- **Props**：`i18n`、`viewSettings: CommitAnalysisViewSettings`、`years: number[]`
- **Emits**：`update: [patch: Partial<CommitAnalysisViewSettings>]`（camelCase）
- 样式沿用现有 `gpa-settings-row / gpa-settings-label / gpa-settings-select / gpa-settings-seg` 类（顶层类，非 popover 嵌套，可直接复用）；组件 style 块双行导入：`@use "../../styles/CommitAnalysisSettings.scss"; @use "../../styles/index.scss";`
- 模板遵循 i18n 中文注释规则（每处 i18n 键上方加中文注释）

### 2. 修改 `components/CommitAnalysis/CommitAnalysisSettings.vue`（变薄壳 popover）

保留齿轮按钮 + popover 容器 + 点击外部关闭逻辑，内部改为渲染 `AnalysisSettingsForm`，事件直接透传 `@update`。

### 3. 重写 `components/common/SettingsDialog.vue`（汇总页主体）

结构：`gp-mask > gp-dialog gp-dialog--settings`（宽度 300px → 680px）：

```
┌─────────────────────────────────────┐
│ header：标题"设置" + 关闭按钮          │
├──────────┬──────────────────────────┤
│ 左侧导航  │ 右侧内容区                │
│ · 常规    │  （当前分区内容）          │
│ · 显示    │                          │
│ · Git 配置│                          │
└──────────┴──────────────────────────┘
```

- **Props**：现有 `i18n` / `concurrency` / `pushBranchMode` + 新增 `viewSettings: CommitAnalysisViewSettings`、`yearOptions: number[]`、`manager: GitPushManager`
- **Emits**：现有 `close` / `save` / `saveBranchMode` + 新增 `updateViewSettings: [patch]`
- **分区状态**：`activeSection = ref<"general" | "display" | "gitconfig">("general")`
- **常规分区**：沿用现有并发数行（Input + 保存按钮）与分支模式 radio（即时保存 watch），保留 `gp-set-*` 类与提示文案
- **显示分区**：渲染 `AnalysisSettingsForm`，`@update` 透传为 `updateViewSettings`；顶部加提示文案（改动即时保存生效）
- **Git 配置分区**：内嵌 `GitConfigSection :i18n :manager scope="global"`（自包含，自行加载/CRUD；其内部已有 `@keydown.enter/escape.stop` 防冲突）
- **键盘**：根遮罩保留 Esc 关闭；Enter 保存仅在 `activeSection === "general"` 时生效（saveAndClose 只保存并发数）；沿用 `useDialogKeyboard`
- **导航图标**：`mdi:tune`（常规）/ `mdi:eye-outline`（显示）/ `mdi:source-branch`（Git 配置），均为本地 MDI 集已有图标，每个导航项带 tooltip
- style 块双行导入：`@use "../../styles/SettingsDialog.scss"; @use "../../styles/index.scss";`

### 4. 新增 `styles/SettingsDialog.scss`

- `.gp-dialog--settings` 宽度 680px、`max-width: 90vw`，内容区 `max-height: min(560px, 70vh)` + `overflow-y: auto`
- 左侧导航栏：垂直按钮列表（图标 + 文案），激活态用 `var(--b3-theme-primary)` 前景色/左侧边框指示，禁用 box-shadow，全部使用设计 Token（`$spacing-*` / `$font-size-*` / `$radius-*` / `$color-*`），遵守字体三要素 Token 化
- 同时从 [styles/index.scss 第 509~512 行](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/styles/index.scss#L509-L512) 删除旧的 `.gp-dialog--settings { width: 300px }` 规则（宽度改由新文件定义）

### 5. 修改 `composables/useCommitAnalysis.ts`

- 导出 `loadViewSettings`（加入 return 列表），供打开设置页时预加载显示设置（幂等：单次存储读 + 合并）

### 6. 修改 `utils.ts`（提取年份选项工具函数）

新增纯函数 `buildYearOptions(entries: { date: string }[], viewSettings: CommitAnalysisViewSettings): number[]`（数据年份 ∪ 今年 ∪ 已保存 range 年份，降序），逻辑照搬 CommitAnalysis/index.vue 第 130~139 行；该文件改为调用此函数（遵守"2 处以上使用提取到 utils.ts"规则）。

### 7. 修改 `index.vue`（主面板接线）

- 第 18 行改为 `@open-settings="openSettings"`，新增 handler：

```ts
/** 打开设置汇总弹窗：先预加载显示设置，防止未进分析视图时以默认值覆盖已保存设置 */
function openSettings() {
  showSettings.value = true
  void loadViewSettings()
}
```

（`loadViewSettings` 来自 useGitPush 解构透出，与 `analysisViewSettings`/`updateViewSettings` 同源）

- 第 167~177 行 SettingsDialog 挂载点补充 props/事件：

```vue
<SettingsDialog
  v-if="showSettings"
  :i18n="i18n"
  :concurrency="gitConcurrency"
  :push-branch-mode="pushBranchMode"
  :view-settings="analysisViewSettings"
  :year-options="settingsYearOptions"
  :manager="props.manager"
  @close="showSettings = false"
  @save="setGitConcurrency"
  @save-branch-mode="handleSaveBranchMode"
  @update-view-settings="updateViewSettings"
/>
```

- 新增 computed：`const settingsYearOptions = computed(() => buildYearOptions(analysisStats.value.entries, analysisViewSettings.value))`
- useGitPush（`composables/useGitPush.ts`）透传 `loadViewSettings`（其内已解构 useCommitAnalysis 返回值，加一项即可）

### 8. i18n 分片（`src/i18n/zh_CN/gitPush.json` + `src/i18n/en_US/gitPush.json`）

在 `gitPush` 对象内新增 3 个键（中英同步）：

| 键 | zh_CN | en_US |
|----|-------|-------|
| `settingsSectionGeneral` | 常规 | General |
| `settingsSectionDisplay` | 显示 | Display |
| `settingsSectionGitConfig` | Git 配置 | Git Config |

其余文案（并发数/分支模式/显示设置各项/Git 配置管理）全部复用现有键，不新增。

### 9. 更新 `README.md`（gitPush 目录）

更新 `SettingsDialog.vue` 一行描述为"设置汇总弹窗（左侧分区导航：常规=并发数+分支模式 / 显示=分析显示设置 / Git 配置=全局 Git 配置管理）"。

## 四、数据流设计（汇总后）

```
[设置汇总页]
├─ 常规：emit save/saveBranchMode → index.vue → manager.setGitConcurrency / setPushBranchMode（不变）
├─ 显示：emit updateViewSettings → index.vue → useCommitAnalysis.updateViewSettings（合并 ref + 落盘）
│        与分析视图齿轮 popover 走同一链路 → 两处入口实时同步（props 同源 analysisViewSettings）
└─ Git 配置：GitConfigSection 直调 manager git config API → 写 ~/.gitconfig（自包含，不经插件存储）

[打开时机] openSettings() → loadViewSettings() 预载 → props 下发，杜绝默认值覆盖已保存设置
```

不新增存储槽、不改变任何持久化 key，纯 UI 汇总。

## 五、验证步骤（用户执行）

1. `npx tsc --noEmit` — 类型检查
2. `pnpm i18n:verify` — 中英文键对齐
3. `pnpm lint` — 代码规范
4. 手动验证：
   - 头部齿轮打开汇总页，三个分区导航切换正常
   - 常规分区改并发数保存后生效；分支模式切换即时保存
   - 显示分区改颜色/范围 → 打开分析视图，popover 中同步显示新值（反向亦然）
   - 未进入分析视图直接打开设置页修改显示设置 → 重启后设置保留（验证 loadViewSettings 预载）
   - Git 配置分区可查看/编辑/新增/删除全局配置（与头部 (i) 按钮入口行为一致）
   - 原有入口（分析视图齿轮、头部 (i)、项目卡片 Git 配置）全部仍可用
