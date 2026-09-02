# websiteNavigation 样式布局重构（对齐 gitPush 风格）+ 冗余审查

## Summary

参照 `src/features/gitPush/` 的样式体系重构 `src/features/websiteNavigation/`：紧凑单行头部（含搜索框）、`wn-` 类名前缀隔离、SCSS 按组件拆分、gitPush 字体规格（12px 基准 / 等宽徽章 / 0.12s 过渡）、单层弹窗过渡。卡片保持单列。同步清理审查发现的冗余（未使用 i18n 键、手写省略号、双层 Transition、独立搜索图标等）。纯样式与模板重构，不改任何业务逻辑与数据流。

## Current State Analysis

### websiteNavigation 现状
- [styles/index.scss](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/websiteNavigation/styles/index.scss)（370 行）单文件包含：面板、头部、筛选栏、卡片、两个弹窗、分类管理、过渡动画 — 违反「SCSS 按组件拆分」规范
- 类名无前缀且通用（`.panel-header`、`.form-group`、`.dialog-header`、`.empty-state`、`.category-filter`），样式全局注入有碰撞风险
- 头部为 `h2` + 底边框 + 大 padding（`$spacing-4`），非 gitPush 的紧凑工具栏风格
- 搜索框独立一行，靠 `:deep(.si-input)` hack 撑宽 + 独立 `IconWrapper name="search"`（gitPush 用 `Input` 的 `prefix-icon="search"`）
- 面板根容器显式声明 `background`/`color`（gitPush 不覆盖，跟随主题）
- 弹窗双层 Transition（外层 fade 0.2s + 内层 scale 0.2s），遮罩 z-index 10001
- 省略号（`overflow/ellipsis/nowrap`）在 `.entry-name`/`.url-text`/`.entry-desc` 3 处手写
- FilterBar 根节点是无类名 `<div>`
- 宽面板（min(42vw, 630px)）下卡片单列

### gitPush 参考基准（已探明）
- 头部 [PanelHeader.scss](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/styles/PanelHeader.scss)：`padding: $spacing-2px 10px`、无底边框；标题 span `font-size: $font-size-xs` + `$font-weight-semibold`；计数徽章 18px 高、`$vp-mono`/`$font-size-2xs`/bold、`--b3-theme-primary-lightest` 底、`$radius-full`；按钮区 `gap: $spacing-1`；搜索框 `flex: 0 0 200px`，`Input size="xsmall" prefix-icon="search" clearable`
- 面板根 [index.scss](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/styles/index.scss)：`padding: 5px 3px`（注释说明无 Token）、`font-size: $font-size-xs`、不覆盖背景色；`.gp-divider` 分隔头部与内容
- 卡片 `.gp-card`：`border: 1px solid var(--b3-border-color)` + `$vp-radius` + `padding: 8px 10px` + `transition: border-color 0.15s` + hover 主色
- 弹窗 [Dialog.scss](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/styles/Dialog.scss)：`.gp-mask`（`rgba(0,0,0,0.5)`、z-index 10000）+ `.gp-dialog`（`$radius-md`）+ 单层 fade 过渡 0.12s（内层 scale 0.98）
- SCSS 组织：`styles/_mixins.scss`（`text-ellipsis` 等）+ `styles/<Component>.scss`（组件专属）+ `index.scss`（共享基座，`@use` 基础文件）
- 表单标签 `gp-label-base` mixin：`$font-size-2xs`/bold/`letter-spacing: 0.06em`/uppercase/opacity 0.45

## Proposed Changes

> 所有改动限于 `src/features/websiteNavigation/` 与 `src/i18n/{zh_CN,en_US}/websiteNavigation.json`。行为逻辑（数据流、emit、存储）零改动。

### 1. SCSS 拆分与 `wn-` 前缀（核心）

新建 `styles/_mixins.scss`（partial）：
- `@mixin wn-text-ellipsis`（单行省略，卡片 3 处使用）

重写 `styles/index.scss`（共享基座，约 150 行）：
- 根容器 `.wn-panel`：`display:flex; flex-direction:column; height:100%; padding:5px 3px; font-size:$font-size-xs; overflow:hidden`（去掉 `background`/`color` 显式覆盖，与 gitPush 一致；`5px 3px` 加注释说明无对应 Token）
- `.wn-divider`：`border-bottom: 1px solid var(--b3-border-color); margin: 10px 0`（分隔头部与内容，替代原 header 的 border-bottom）
- 空状态 `.wn-empty`：对齐 `.gp-empty`（`color: var(--b3-theme-on-surface-light)`，图标容器 opacity 0.3，去掉 `font-style: italic` 与 0.35 整体透明度）
- 弹窗共享基座（对齐 gitPush Dialog.scss）：`.wn-mask`（`rgba(0,0,0,0.5)`、`z-index: 10000`、`font-size: $font-size-xs`）、`.wn-dialog`（`width: 440px; max-width: 90vw; max-height: 85vh; overflow-y: auto; border-radius: $radius-md`，去掉 `width: 90vw`）、`.wn-dialog-header/body/footer`、`.wn-form-group` + `.wn-label`（对齐 `gp-label-base`：2xs/bold/uppercase/0.06em/opacity 0.45）
- 过渡：`.wn-dialog-fade-*` 单层 fade 0.12s，内层 `.wn-dialog` transform scale 0.98（替换原 `.website-fade-*`/`.website-scale-*` 0.2s 双层）

新建组件专属 SCSS（`@use "@/variables.scss" as *;` 头部）：
- `styles/PanelHeader.scss`：`.wn-header`（`padding: $spacing-2px 10px; gap: $spacing-2`，无底边框）、`.wn-header-left`、`.wn-title`（span，`$font-size-xs` + `$font-weight-semibold`）、`.wn-count-badge`（胶囊形态：`height: 18px; padding: 0 7px; $radius-full; background: var(--b3-theme-primary-lightest); color: var(--b3-theme-primary); $font-size-2xs/$vp-mono/$font-weight-bold; font-variant-numeric: tabular-nums`，显示 `n/m`）、`.wn-header-btns`、`.wn-header-search`（`flex: 0 0 200px; min-width: 130px`）
- `styles/FilterBar.scss`：`.wn-category-filter`（chips 行）+ `.wn-category-chip`（沿用现有分类色交互：hover/active 边框与 `color-mix` 背景、`--cat-color` 变量、`$dot-size: 6px` 局部常量保留）
- `styles/WebsiteCard.scss`：`.wn-card`（对齐 `.gp-card`：`$vp-radius`、`padding: 8px 10px`、`transition: border-color 0.15s`、hover 主色；单列，`width: 100%`）、`.wn-card-name`/`.wn-card-url`/`.wn-card-desc`（用 `wn-text-ellipsis` mixin）/`.wn-card-tag`（沿用分类色着色，规格对齐 gitPush 徽章：2xs/bold）
- `styles/CategoryManager.scss`：`.wn-add-category-row`、`.wn-color-option`（`$color-option-size: 20px` 局部常量保留）、`.wn-category-list`/`.wn-category-row`/`.wn-cat-dot`/`.wn-cat-name`/`.wn-default-badge`

旧局部常量处理：`$transition-fast: 0.12s` 保留在用它的文件内；`$dot-size`/`$color-option-size` 归入各自组件 SCSS。

### 2. 模板改动

- **[index.vue](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/websiteNavigation/index.vue)**
  - 根类名 `website-navigation-panel` → `wn-panel`；`entries-list` → `wn-list`（样式：`flex:1; overflow-y:auto; display:flex; flex-direction:column; gap:4px; min-height:0` + 4px 细滚动条，对齐 `.gp-list` 单列形态）；`empty-state` → `wn-empty`
  - `PanelHeader` 增加 `v-model:searchQuery`；`FilterBar` 移除 searchQuery 相关 props/emit
  - PanelHeader 与 FilterBar 之间插入 `<div class="wn-divider" />`
- **[PanelHeader.vue](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/websiteNavigation/components/PanelHeader.vue)**
  - `h2` → `<span class="wn-title">`；`entry-count` span → `.wn-count-badge`
  - 按钮区末尾新增搜索框（仅当 `totalCount > 0` 时显示，对齐 gitPush）：`<Input v-model="searchQuery" size="xsmall" prefix-icon="search" clearable :placeholder="i18n.searchPlaceholder" autocomplete="off" />`
  - 新增 `defineModel<string>("searchQuery")` 与 `totalCount` 既有 prop 复用
- **[FilterBar.vue](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/websiteNavigation/components/FilterBar.vue)**
  - 删除搜索区块（IconWrapper `search` + Input + `.filter-bar` 行）与 `searchQuery` prop/emit；根节点直接为 `.wn-category-filter`（消除无类名 wrapper div）
- **[WebsiteCard.vue](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/websiteNavigation/components/WebsiteCard.vue)**
  - 类名改 `wn-card-*` 前缀；URL 行补 `:title="i18n.openUrl"` 悬停提示（项目规则：UI 元素需 tooltip，且使 `openUrl` 键被使用）
- **[WebsiteDialog.vue](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/websiteNavigation/components/WebsiteDialog.vue) / [CategoryManager.vue](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/websiteNavigation/components/CategoryManager.vue)**
  - `website-dialog-overlay` → `wn-mask`；`website-dialog` → `wn-dialog`（CategoryManager 保留 `wn-category-manager` 修饰类）；dialog-header/body/footer、form-group/label 改 `wn-` 前缀
  - 双层 `<Transition name="website-fade"><Transition name="website-scale">` → 单层 `<Transition name="wn-dialog-fade">`（内层 `.wn-dialog` 随过渡类做 scale，对齐 gitPush Dialog.scss 结构）
  - style 块导入：WebsiteDialog.vue → `@use '../styles/index.scss';`；CategoryManager.vue → 双行 `@use '../styles/CategoryManager.scss';` + `@use '../styles/index.scss';`
  - PanelHeader.vue / FilterBar.vue / WebsiteCard.vue 的 style 块各自单行/双行导入对应 SCSS
- **[types/index.ts](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/websiteNavigation/types/index.ts)**：弹窗宽度 `min(42vw, 630px)` 保持不变

### 3. 冗余清理（审查结论）

| 项 | 处理 |
|---|---|
| 独立搜索 `IconWrapper` + `:deep(.si-input)` flex hack | 删除，改 `Input prefix-icon="search"` |
| 双层 Transition（0.2s fade + 0.2s scale） | 合并为单层 `wn-dialog-fade`（0.12s + scale 0.98） |
| 3 处手写省略号 | 提取 `_mixins.scss` 的 `wn-text-ellipsis` |
| `h2` 标签及其 margin 重置样式 | 改 `span.wn-title`，删除重置样式 |
| FilterBar 无类名根 `<div>` | 移除（搜索迁走后根节点即分类行） |
| 遮罩 z-index 10001 | 对齐 gitPush 的 10000 |
| i18n 未使用键：`title`、`newCategory`、`loadFailed`、`saveSuccess` | 从 `src/i18n/{zh_CN,en_US}/websiteNavigation.json` 与 `types/index.ts` 的 `I18n` 接口中删除（已 grep 验证无引用） |
| `openUrl` i18n 键 | 保留，补为 URL 行 title 悬停提示 |
| `window.confirm` 删除确认 | 不改（gitPush 的 ConfirmDialog 在其组件目录内，跨功能导入违规；如需统一另立任务） |

### 4. 不做的事

- 不改 `composables/useWebsiteNavigation.ts`、`utils/sharedStorage/websiteStorage`、注册链路、事件与存储逻辑
- 不改卡片为双列（用户已确认单列）
- 不引入 gitPush 的 `vp-btn--sm` 裸类按钮写法，继续使用共享 `Button` 组件（等效规格、更规范）
- 不新建 README（已有）

## Assumptions & Decisions

1. **单列卡片**：用户确认；`.wn-list` 借鉴 `.gp-list` 的间距/细滚动条但保持 `flex-direction: column`
2. **搜索框进头部**：用户确认迁移；`totalCount === 0` 时隐藏（对齐 gitPush 空态不显示搜索）
3. **`wn-` 前缀**：遵循项目「SCSS 前缀隔离」惯例（gitPush `gp-`、toolCollection `gca-` 先例），模板与 SCSS 同步更名
4. **过渡时长 0.12s**：Codex 规范 + gitPush 先例
5. **根容器 padding 5px 3px**：与 gitPush 视觉一致；websiteNavigation 是 Modal 面板不适用 Dock 侧边栏间距规则
6. **图标**：继续用 `IconWrapper` 注册键（`browser`/`search` 由 prefix-icon 承担），不新增图标注册

## Verification

AI 不执行 `pnpm lint` / `vite build`，以下由用户验证：

```bash
pnpm i18n:verify    # 删除 4 个键后中英分片键对齐
npx tsc --noEmit    # 类型检查（I18n 接口删键 + defineModel 新增）
pnpm lint
```

人工检查项：
1. 面板头部：标题 + `n/m` 等宽徽章 + 添加按钮 + 搜索框单行排布，搜索实时过滤生效
2. 分类 chips 悬停/选中态颜色正常，删除分类后自动回「全部」
3. 卡片单列、hover 主色边框、长名称/URL/描述截断省略
4. 两个弹窗开合动画正常（0.12s fade + scale）、遮罩点击关闭、ESC/按钮行为不变
5. 空状态（无网站 / 搜索无结果）展示正常
6. 全局搜索确认无旧类名残留（`website-fade`、`website-scale`、`website-dialog`、`website-navigation-panel`）
