# 状态栏模块 —— 冗余重复专项审查报告

审查对象：`src/features/statusBar/`（`index.ts` + `index.vue` + `featureRegistry.ts` + 3 个 composable + 4 个 `.vue` + 1 个 `.scss`，共 12 个文件 / 2417 行）
对照范围：`src/components/`（共享组件库）、`src/features/config.ts`（FEATURE_CONFIG 单一数据源）、`src/components/kit/icons.ts`（FEATURE_ICONS 真源）、`src/features/superPanel/`（同类功能面板的既有正解）、`src/features/statistics/`（统计查询既有实现）
审查依据：`AGENTS.md § 共享组件库使用规则` / `§ 硬规则` / `§ 统一入口原则`、`AGENTS_ARCH.md § 单文件行数上限` / `§ 功能模块内代码分层` / `§ 组件文件夹组织`、`AGENTS_STYLE.md § 字号层级` / `§ 背景与过渡对齐 gitPush 范式`、`AGENTS_I18N.md § 禁止 i18n 硬编码兜底值`
审查日期：2026-09-11
本轮改动：**仅审查，未修改任何源码**

---

## 一、结论摘要

| 类别 | 项数 | 最高严重度 | 说明 |
|---|---|---|---|
| 与单一数据源重复（图标/配色/标题/事件） | 1 组 / 26 条目 | **P0** | `featureRegistry.ts` 平行维护了 `FEATURE_CONFIG` + `FEATURE_ICONS` 已有的一切 |
| 真实缺陷（审查附带发现） | 2 项 | **P0** | i18n 键恒空（兜底掩盖）、17 个 `itemClass` 中 8 个无对应样式 |
| 生命周期违反统一挂载模式 | 1 项 | **P1** | 模块级单例 + `onunload` 特例清理分支 |
| 共享组件零复用 | 1 组 / 6 类控件 | **P1** | 抽屉、菜单、图标、按钮、输入框、内联 SVG 全部自建 |
| 硬编码文案 | 51 处 / 9 文件 | **P1** | 模板文本 + title + placeholder + TS 字符串 |
| SQL 查询重复 | 1 处 | **P1** | 与 `statistics/queries/baseStats.ts` 近乎逐字重复 |
| 存储键散落 / 缺 storage 层 | 4 键 / 2 文件 | **P1** | 项目内 24 个 feature 均有 `types/storage.ts`，本模块独缺 |
| 类型分层倒置 | 2 个接口 | **P2** | 数据表 `featureRegistry.ts` 反向 import `.vue` 的类型 |
| 单一文件超硬阈值 | 1 项 | **P2** | `styles/index.scss` 619 行（>500） |
| 双实现并存 / 冗余逻辑 | 4 项 | **P2** | Set vs 数组两套 toggle、重复 save、三处事件名映射 |
| 样式规范偏离 | 3 项 | **P2** | z-index 9997~9999、过渡 0.2/0.25s、局部硬编码变量 |
| 无障碍缺失 | 4 项 | **P2** | 可点击 `<span>` 无 role/tabindex、菜单无 Esc/role |
| 资源与格式 | 2 项 | **P3** | 自建容器缺 `vp-dock-root`、模板缩进异常 |

**总体判断**：本模块的**功能实现质量不差**（`useStatusBar` 的增量更新抑制、`useFeatureCategories` 的悬挂引用过滤、`useStatusBarTask` 的模块级共享 store 都写得有想法），但**数据层与 UI 层都存在成体系的重复**：

1. **数据层**：`featureRegistry.ts` 用 344 行平行重建了一份功能清单，而项目**已有**两处权威来源（`FEATURE_CONFIG` 用于面板元数据、`FEATURE_ICONS` 用于图标配色）。三者已开始漂移——**7 个图标、6 个配色与真源不一致**，这正是重复维护的必然代价。
2. **UI 层**：与本仓库其它 feature 相反，本模块**完全不复用共享组件库**（零命中），自建了一套抽屉、菜单、图标与表单控件。

> **值得注意的强对照**：同一仓库的 `superPanel`（功能开关面板）与 `statusBar`（功能抽屉）职责高度重叠 —— 前者正确地以 `FEATURE_CONFIG` + `FEATURE_ICONS` 为唯一数据源（`superPanel/index.vue:148`、`superPanel/types/index.ts:179`），后者则把同样的信息又抄了一遍。这是「同一问题已有正解却未复用」的直接证据。

---

## 二、P0：与单一数据源重复（`featureRegistry.ts`）

### D1. 26 个条目平行维护了 `FEATURE_CONFIG` + `FEATURE_ICONS` 的一切

`featureRegistry.ts:36-329` 的 `buildFeatures()` 用 26 个对象字面量重建了功能清单，每条含 `id` / `icon` / `color` / `title` / `pinnable` / `shortcut` / `action`。而其中前四项**项目已有权威定义**：

| 字段 | 权威来源 | `featureRegistry` 的处理 |
|---|---|---|
| `icon` / `color` | `src/components/kit/icons.ts` 的 `FEATURE_ICONS` | **重新硬编码一份**（26 个 hex 色值） |
| `title` | `src/features/config.ts` 的 `FEATURE_CONFIG[].defaultTitle` + `titleI18nKey` | **重新硬编码一份**（8 处纯硬编码 + 14 处 `\|\|` 兜底） |
| 动作事件名 | `FEATURE_CONFIG[].actions[].key` | **重新硬编码一份**（20 个 `emitCustomEvent("...")`） |

**图标漂移（4 处）**——与 `FEATURE_ICONS` 真源不一致：

| id | `featureRegistry` | `FEATURE_ICONS`（真源） |
|---|---|---|
| `passwordVault` | `mdi:lock` | `mdi:shield-key` |
| `htmlViewer` | `mdi:language-html5` | `mdi:code-tags` |
| `websiteNavigation` | `mdi:link-variant` | `mdi:web` |
| `everythingSearch` | `ph:binoculars` | `mdi:file-search` |

**配色漂移（7 处）**——同一批条目里另有 7 个 `color` 与真源不一致：

| id | `featureRegistry` | `FEATURE_ICONS`（真源） |
|---|---|---|
| `video` | `#6366f1` | `#e11d48` |
| `passwordVault` | `#22c55e` | `#f59e0b` |
| `htmlViewer` | `#e67e22` | `#f97316` |
| `formatAssistant` | `#07c160` | `#10b981` |
| `websiteNavigation` | `#8b5cf6` | `#6366f1` |
| `everythingSearch` | `#d97706` | `#3b82f6` |
| `imageCompressor` | `#ef4444` | `#f59e0b` |

（4 处图标漂移与 7 处配色漂移有 3 处重叠：`passwordVault` / `htmlViewer` / `websiteNavigation` / `everythingSearch` 属图标与配色**双双不一致**。）

**后果**：同一个功能在超级面板里是「青色盾牌钥匙」，在状态栏抽屉里是「绿色挂锁」；`video` 在两处是两种红色。这是**用户可见的不一致**，且每次改图标都要记得改两处（实际已经漏改 7 次）。

**事件名漂移（2 处）**——与 `FEATURE_CONFIG[].actions[].key` 不一致：

| id | `FEATURE_CONFIG` action key | `featureRegistry` 事件名 | 说明 |
|---|---|---|---|
| `imageCompressor` | `openCompressor` | `openImageCompressor` | 事件名不同（`superPanel/ACTION_EVENT_MAP` 做了 `openCompressor → openImageCompressor` 的映射来桥接） |
| `globalRelations` | `openGlobalRelations` | `toggleGlobalRelations` | 事件名不同（`ACTION_EVENT_MAP` 同样做了映射） |

**即：同一组动作语义，项目里存在三处映射表**——`FEATURE_CONFIG.actions[].key`、`superPanel/types/index.ts:79` 的 `ACTION_EVENT_MAP`、`featureRegistry` 的 `emitCustomEvent`。新增功能要同时改三处，漏一处即静默失效。

**违反规则**：`AGENTS.md:121`「**强制规则**：同一常量/工具函数被 2 个以上文件使用时，必须提取到对应的 `types/` 或 `utils.ts`，禁止复制粘贴」；`AGENTS_ARCH.md:207` 同。`docs/hardcode-audit.md:490` 亦已登记：「`gitPush/types/meta.ts`、`gitPush/composables/useIdeManagement.ts`、**`statusBar/featureRegistry.ts`** 属集中数据表，注册后可整体改为引用 `IconKey`」。

**建议**：`buildFeatures()` 改为**从 `FEATURE_CONFIG` 派生**（id / title / action），从 `FEATURE_ICONS` 取 icon / color，仅保留本模块独有的两个增量字段（`shortcut` 的状态栏图标与 itemClass、`monitor` 标志）。可删除约 200 行，并让三处映射收敛为一处。

> ⚠️ 迁移难点（需一并解决）：`featureRegistry` 的功能集合与 `FEATURE_CONFIG` **并不相等** —— 前者 26 条（20 个功能 + 6 个监控项）、后者 45 条顶层功能。抽屉**刻意只收录 20 个功能**（其余走 Dock/页签/命令面板）。因此不能简单「全部派生」，需引入**显式的收录白名单**（或给 `FEATURE_CONFIG` 增加 `showInStatusBar?: boolean` 标记），否则会把不该出现在抽屉里的功能（如 `generalSettings`、`pageLock`）暴露出来。

### D2.（真实缺陷）`bookmarkMarkerI18n.title` 恒为 `undefined`

```ts
// featureRegistry.ts:45
const bookmarkMarkerI18n = getI18nShard(plugin, "bookmarkMarker")
// featureRegistry.ts:250
title: bookmarkMarkerI18n.title || "书签标记",
```

**实测该键路径不存在**（用 `src/i18n/zh_CN.json` 合并产物验证）：

```
bookmarkMarker.title   →  undefined
```

原因：`bookmarkMarker` 分片是**扁平结构**（顶层键为 `bookmarkMarkerTitle` / `bookmarkMarkerDescription` …），**没有自嵌套命名空间**，因此 `merged["bookmarkMarker"]` 取到的是 `undefined`，`.title` 必然为空。

```jsonc
// src/i18n/zh_CN/bookmarkMarker.json（扁平，无自嵌套）
{ "bookmarkMarkerTitle": "书签标记", "bookmarkMarkerDescription": "根据文档书签内容…" }
```

**后果**：`|| "书签标记"` 兜底**恒定生效** —— 表现上「看起来正常」，实际是 i18n 从未生效。切换英文时该项仍显示中文，且**兜底彻底掩盖了这个 bug**（正是 `AGENTS_I18N.md:70-86` 所警告的场景）。

**同类风险**：`featureRegistry` 混用了两种取法 —— `getI18nShard()`（需自嵌套，11 处）与 `plugin?.i18n?.X` 扁平直取（2 处，`s3Backup` / `toolCollection`）。前者对扁平分片失效，后者对嵌套分片会取到 `undefined`。**当前 11 个受检分片中 10 个恰好是自嵌套的**（仅 `bookmarkMarker` 扁平），所以问题只暴露了 1 处。项目内自嵌套分片 40 个、扁平 18 个 —— **这个隐式耦合随时会再踩**。

**建议**：改用与 `superPanel` 相同的解析方式 —— 走 `FEATURE_CONFIG[].titleI18nKey`（`"bookmarkMarker.bookmarkMarkerTitle"` 之类）并用统一的 `resolveI18n` 按点号路径解析；同时**删除 `|| "中文"` 兜底**（`AGENTS_I18N.md:70` 明令禁止）。

### D3.（真实缺陷）17 个 `itemClass` 中 8 个在 SCSS 中无对应样式

`featureRegistry` 为每个快捷项声明 `shortcut.itemClass`（形如 `action-item tool-collection-item`），指向 `styles/index.scss` 中的配色类。实测覆盖率：

| itemClass | SCSS 是否定义 | itemClass | SCSS 是否定义 |
|---|---|---|---|
| `video-manager-item` | ✅ | `everything-search-item` | ❌ **无** |
| `password-vault-item` | ✅ | `image-compressor-item` | ✅ |
| `skills-viewer-item` | ✅ | `tool-collection-item` | ✅ |
| `html-viewer-item` | ✅ | `component-preview-item` | ✅ |
| `format-assistant-item` | ✅ | `bookmark-marker-item` | ❌ **无** |
| `website-navigation-item` | ✅ | `quick-note-item` | ❌ **无** |
| `minimal-browser-item` | ❌ **无** | `image-creation-item` | ❌ **无** |
| `s3-backup-item` | ❌ **无** | `s3-file-manager-item` | ❌ **无** |
| `global-relations-item` | ❌ **无** | | |

**后果**：这 8 个功能在状态栏快捷区**落回默认色**（`.action-item` 的继承色），与该功能的品牌色无关 —— 用户看到的是一排颜色混杂、部分同色的图标。这同样是「两份清单各改各的」的产物。

**建议**：随 D1 一并解决 —— 配色统一从 `FEATURE_ICONS[id].color` 内联到 `style`（模块内已有先例：`DrawerFeatureItem.vue:10` 的 `:style="{ color: item.color }"`），或补齐 SCSS 类。**推荐内联方案**：彻底消除「类名对不上」的可能性。

---

## 三、P1：生命周期违反统一挂载模式

### D4. 模块级单例 + `onunload` 特例清理分支

```ts
// src/features/statusBar/index.ts:13-45
let app: ReturnType<typeof createApp> | null = null
let statusBarElement: HTMLElement | null = null

export function registerStatusBar(plugin: Plugin) { … }   // 不挂 (plugin as any).__xxx
export function unregisterStatusBar() { … }                // 独立的注销函数
```

```ts
// src/index.ts:201-202 —— onload 特例分支
    // 清理状态栏资源
    unregisterStatusBar()
```

**违反规则**：`AGENTS.md:82-87`「**实例挂载与销毁模式（强制）**」原文——
> - 实例挂载必须在自己的 `registerFeature(plugin)` 内部完成：`(plugin as any).__xxx = instance`，实例必须提供 `destroy()` 方法
> - 字段名同步加入 `src/index.ts` 的 `DESTROYABLE_KEYS` 清单，由 `onunload` 统一循环销毁
> - **禁止在 `onunload` 中为个别功能写特例清理分支**

`AGENTS.md:289` 硬规则再次重申。经全库核对：**`statusBar` 是唯一使用该模式的模块** —— 其余 40+ 功能全部走 `DESTROYABLE_KEYS`（`src/index.ts:104-117`，含 `__s3Backup` / `__s3FileManager` 等），`onunload` 中仅 `statusBar` 有一条手写分支（`src/index.ts:202`）。

**建议**：`registerStatusBar` 内部构造 `{ destroy: unregisterStatusBar }` 并 `(plugin as any).__statusBar = …`，`__statusBar` 加入 `DESTROYABLE_KEYS`，删除 `src/index.ts:202` 的特例分支与 `features/index.ts:89` 的 `unregisterStatusBar` 导出。（参考实现：`src/features/toolCollection/index.ts` 的包装 destroy 写法。）

---

## 四、P1：共享组件零复用

`grep 'from "@/components/'` 在 `src/features/statusBar/**` 中**零命中** —— 全模块无一处使用共享组件库。而 `AGENTS.md:191` 把「抽屉（侧边浮层）」「对话框（模态弹层）」「级联菜单」「图标」「按钮」「输入框」「内联消息提示」全部列为**必须使用共享组件**的场景。

### D5. 自建抽屉未复用共享 `Drawer`（或 `Dialog`）

`components/FeatureDrawer.vue:3-208` 自建了一整套浮层外壳：

| 自建实现（`FeatureDrawer.vue`） | 共享 `Drawer.vue` / `Dialog.vue` 已提供 |
|---|---|
| `<Teleport to="body">` + `.feature-drawer-overlay`（`z-index: 9997`） | 就地 `fixed`；`useOverlay` 统一遮罩 |
| `@click="emit('close')"` 点遮罩关闭（`click.self` 语义缺失） | 「遮罩上按下**并**抬起」才算（`overlay/useOverlay.ts:55-66`） |
| 自建 `<Transition name="drawer-slide">` + 4 条 SCSS | fade + scale 0.98 / 轴向滑入，0.12s ease |
| **无** `role="dialog"` / `aria-modal` | `role="dialog"` + `aria-modal` + `aria-labelledby` |
| **无** Esc 关闭（仅搜索框自身 `@keydown.escape` 清空输入） | `closeOnEscape` 默认开 |
| **无** 焦点接管与归还 | 打开聚焦容器、关闭归还开启前元素 |

**依据强度说明**：本项**不是**「替换即等价」。共享 `Drawer` 的 `right` 档是**贴右边缘、纵向铺满**的侧边浮层（`Drawer.scss:49-64`），而 `FeatureDrawer` 是**右下角浮动的 450×420 面板**（`styles/index.scss:200-213`）。二者几何语义不同，直接替换会改变 UX。因此：
- **必须做**：补 `role="dialog"` / `aria-modal` / Esc 关闭 / 焦点接管（无论是否替换组件）；
- **建议评估**：迁移到共享 `Drawer position="right"`（功能抽屉用贴边抽屉是更标准的 UX），或迁到 `Dialog`（若坚持浮动面板形态）。此项需产品决策，不宜静默替换。

### D6. 自建分类菜单未复用共享 `TieredMenu`（popup 模式）

`components/CategoryAssignMenu.vue`（66 行）+ `styles/index.scss:537-591`（55 行）= 121 行，实现内容：

| 自建实现 | 共享 `TieredMenu` popup 模式 |
|---|---|
| `Teleport` + 全屏遮罩（`z-index: 9999`） | 不 Teleport，就地 `fixed`，点外部关闭 |
| 定位由**父组件** `index.vue:285-297` 手工钳制 | `tieredMenu/position.ts` 纯函数双向钳制 |
| 手写 `.category-assign-item` 按钮（2 处 + `v-for`） | 内建菜单项（图标/文案/roving tabindex/方向键） |
| **无** `role="menu"` / `menuitem`、**无** Esc、**无**键盘导航 | 完整菜单语义 + Esc 逐层回退 + 方向键漫游 |
| 自建 `.active` 高亮 | 内建展开/选中态 |

**违反规则**：`AGENTS.md:191`（级联菜单）+ `:189-192`（优先复用、缺能力先扩展共享组件）。

> **有直接先例**：`s3FileManager` 的右键菜单已按同一思路迁移到 `TieredMenu popup`（见 `docs/s3-file-manager-redundancy-review.md § 十一`），并为其扩展了 `danger` 字段。本项可复用同一方案。

**附带问题**：定位逻辑在 `index.vue:285-297` 依赖**跨组件的 DOM 类名查询**：

```ts
const badge = (event.target as HTMLElement).closest?.(".badge-category") as HTMLElement | null
```

`.badge-category` 定义在 `DrawerFeatureItem.vue:33` —— 父组件靠**字符串类名**穿透子组件内部结构取锚点，子组件改类名即静默失效（错误路径下退化为 `event.clientX/Y`，不报错）。迁到 `TieredMenu` 后由 `show(event)` 直接吃事件坐标，此耦合自然消除。

### D7. 图标全部走 `@iconify/vue`，未用共享 `IconWrapper` + `IconKey`

| 文件 | `<Icon icon="...">` 处数 |
|---|---|
| `FeatureDrawer.vue` | 6（`ph:tag` / `ph:x` / `ph:magnifying-glass` / `ph:trash` / `ph:plus` / 视图切换 2 个内联 `<svg>`） |
| `DrawerFeatureItem.vue` | 4（`item.icon` / `ph:push-pin-simple(-fill)` / `ph:tag-simple` / `ph:toggle-(right\|left)`） |
| `MonitorItem.vue` | 1（`icon` prop） |

合计 11 处 `<Icon>` + **2 处内联 `<svg>`**（`FeatureDrawer.vue:32-53` 的网格/列表切换图标手写 path）。

**违反规则**：`AGENTS.md:191`「图标…**必须**使用共享组件」；`AGENTS.md:296`「图标规则：…使用 `src/components/kit/icons.ts`（真源）中已注册的 Iconify 图标」；`AGENTS_STYLE.md:187`「emoji 表情作为图标 → `<IconWrapper name="iconName">`」。`docs/hardcode-audit.md:126,133,136` 已登记本模块共 31 处未注册图标名（`featureRegistry` 20 + `FeatureDrawer` 6 + `DrawerFeatureItem` 5），并指出**这些图标当前能渲染是因为 `iconifySetup.ts` 离线预加载了整个 MDI/Phosphor 集合**，`pnpm validate:icons` 只校验 `FEATURE_ICONS`/`COMMON_ICONS`，故从未报警。

**建议**：改用 `IconWrapper`，需新增的键（`tag` / `trash` / `plus` / `magnifyingGlass` / `close` / `pin` / `pinFill` / `toggleRight` / `toggleLeft` / `viewGrid` / `list`）注册进 `COMMON_ICONS` 后运行 `pnpm validate:icons`。

### D8. 原生 `<button>` × 9、原生 `<input>` × 3

| 文件 | 原生 `<button>` | 原生 `<input>` |
|---|---|---|
| `FeatureDrawer.vue` | 7（管理分类 / 视图切换 / 关闭 / 搜索清除 / 2×分类 tab / 2× manage-btn） | 3（搜索框 / 重命名 / 新建分类） |
| `CategoryAssignMenu.vue` | 2（未分类项 + 分类项） | — |

**违反规则**：`AGENTS.md:191` 首位即「按钮」，并明确列出「输入框」「多行文本域」「下拉」等。例外仅限「纯展示的局部布局容器」与 `.icon-btn` 26×26 固定尺寸图标按钮（`AGENTS_STYLE.md:188`）—— 分类 tab、管理按钮、搜索框均不属例外。

**建议**：按钮 → `Button`（`variant="ghost"` / `size="xsmall"`）；搜索框 → `Input`（含 `clearable` 可替代自建清除按钮）；分类 tab 分组 → `Button` 分组 + `:aria-pressed`（项目既有范式，见 `gitPush/ListView/ListViewToolbar.vue:18`）或 `Tabs`。

### D9. 状态栏监控项的可点击 `<span>` 无无障碍语义

`DrawerFeatureItem.vue:18-55` 的三个角标（pin / 分类 / 开关）都是 `<span @click.stop>`：

```html
<span class="feature-drawer-item-badge badge-pin" :title="…" @click.stop="emit('toggleStatusBar', item.id)">
```

**问题**：`<span>` 无 `role="button"`、无 `tabindex`、无键盘激活 —— **键盘用户完全无法 pin / 分类 / 开关功能**。这三者是抽屉的核心交互。（`title` 提供了可访问名称，但节点不可聚焦。）

**违反规则**：`AGENTS_STYLE.md:277`「纯图标按钮**必须**提供 `aria-label` 或 `title`」的精神（此处连按钮语义都缺）；`AGENTS.md:191` 按钮必须用共享组件（共享 `Button` 自带 `focus-visible` 环与键盘语义）。

**建议**：改 `Button variant="ghost" size="xsmall" dense` 纯图标模式，`title` 自动派生 `aria-label`；`aria-pressed` 表达激活态（替代当前仅靠 `opacity` 的视觉暗示）。

---

## 五、P1：SQL 查询与 `statistics` 重复

### D10. 统计查询与 `statistics/queries/baseStats.ts` 近乎逐字重复

```ts
// src/features/statusBar/composables/useStatusBar.ts:155-163
const queryStmt = `
  SELECT
    (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d') as totalNotes,
    (SELECT SUM(length) FROM blocks WHERE type = 'p' AND length > 0) as totalWords,
    (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d' AND substr(created, 1, 8) = '${todayStr}') as todayCreated,
    (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d' AND substr(updated, 1, 8) = '${todayStr}') as todayModified,
    (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d' AND substr(created, 1, 8) = '${yesterdayStr}') as yesterdayCreated,
    (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d' AND substr(updated, 1, 8) = '${yesterdayStr}') as yesterdayModified
`
```
```ts
// src/features/statistics/queries/baseStats.ts:227-234
const combinedSql = `
  SELECT
    (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d') as totalNotes,
    (SELECT SUM(length) FROM blocks WHERE type = 'p' AND length > 0) as totalWords,
    (SELECT COUNT(DISTINCT block_id) FROM refs) as totalBacklinks,
    (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d' AND created >= '${todayStr}000000' AND created <= '${todayStr}235959') as todayCreated,
    (SELECT COUNT(DISTINCT root_id) FROM blocks WHERE type='d' AND updated >= '${todayStr}000000' AND updated <= '${todayStr}235959') as todayModified
`
```

**`totalNotes` / `totalWords` 两行逐字相同**（含 `WHERE type = 'p' AND length > 0` 这个带空格的细节）；`todayCreated` / `todayModified` 语义相同但**谓词写法不同**（`substr(created,1,8) = X` vs `created >= 'X000000' AND created <= 'X235959'`）。

**为什么这会咬人**：`substr()` 写法**无法命中 `created` 索引**（函数包裹列），而范围写法可以。`stats` 的注释（`baseStats.ts:229` 上方的 `// 优化：使用预存的 length 字段代替 LENGTH(content)`）表明作者已做过性能考量 —— 但**两个模块各写一份，优化只落在一处**。数据量大时状态栏的每 60 秒查询会成为明显开销。

**违反规则**：`AGENTS_ARCH.md:171`「重复远比错误抽象便宜…在同一个问题出现 3 次之前，不要抽象」—— 此处是**第 2 次**出现（`statistics` 与 `statusBar`），按 Rule of Three 尚不必强制抽象。但 `AGENTS.md:121`「被 2 个以上文件使用时必须提取」与之张力明显，且**这两处已出现实质分歧**（性能写法不同），属「错误的重复」而非「便宜的重复」。

**建议**（择一）：
- **低成本**：把 `statusBar` 的谓词统一为 `statistics` 的范围写法（顺带拿到索引优化），保留两份 SQL —— 至少消除性能分歧；
- **推荐**：把「笔记数 / 总字数 / 今日新增修改」提到共享层（如 `src/utils/siyuanStats.ts` 或 `src/api` 的封装），两模块共用。注意 `statusBar` 还需要 `yesterday*`，可作为可选参数。

---

## 六、P1：存储层与代码分层

### D11. 存储键散落、缺 `types/storage.ts`

| 键 | 定义位置 |
|---|---|
| `statusBar-shortcuts` | `index.vue:223`、`index.vue:245`（**字面量重复 2 次**） |
| `statusBar-monitors` | `index.vue:221`、`index.vue:250`（**字面量重复 2 次**） |
| `statusBar-categories` | `useFeatureCategories.ts:10`（常量） |
| `statusBar-feature-category` | `useFeatureCategories.ts:11`（常量） |

**问题**：项目内 **24 个 feature 均有 `types/storage.ts`**（`AIGeneratorStorage` / `S3FileManagerStorage` / `GitPushStorage` … 见 `grep 'class \w+Storage' src/features/**/types/storage.ts`），以 `TypedStorage<T>` 声明槽位、集中管理键名与默认值。**本模块独缺**，改用裸 `PluginStorage.load/save` + 散落字符串字面量（`statusBar-shortcuts` 与 `statusBar-monitors` 各写 2 遍）。

**违反规则**：`AGENTS.md:147` 统一入口表（存储 → `PluginStorage` / `TypedStorage<T>`）；`AGENTS.md:121`（重复字面量）；`AGENTS_ARCH.md` 模块布局规范（`types/storage.ts` 为槽位定义位置）。

**建议**：新建 `types/storage.ts` 导出 `StatusBarStorage` 类，用 `TypedStorage<T>` 声明 4 个槽位（`shortcuts: string[]` / `monitors: string[]` / `categories: StatusBarCategory[]` / `featureCategory: Record<string,string>`），默认值集中在 `DEFAULT_*` 常量。参考 `src/features/s3FileManager/types/storage.ts`。

### D12. 类型分层倒置：数据表反向 import `.vue`

```ts
// src/features/statusBar/featureRegistry.ts:6  ← 数据层
import type { FeatureDrawerItem } from "./components/FeatureDrawer.vue"
```
```ts
// src/features/statusBar/components/DrawerFeatureItem.vue:61  ← 子组件
import type { FeatureDrawerItem } from "./FeatureDrawer.vue"   // 兄弟组件互引
```

两个接口都定义在 `.vue` 里：
- `FeatureDrawerItem` → `FeatureDrawer.vue:222`
- `CategoryManager` → `FeatureDrawer.vue:237`

**违反规则**：`AGENTS.md:117`「**类型 + 共享常量** → `types/index.ts`：类型定义 + 被多文件共用的元数据映射、枚举列表、配置表」；`AGENTS_ARCH.md` 模块布局。

**后果**：
1. **循环引用**：`featureRegistry.ts → FeatureDrawer.vue → DrawerFeatureItem.vue → FeatureDrawer.vue`。当前靠 `import type` 在编译期擦除才没炸，但这是脆弱的平衡。
2. `import type { X } from "*.vue"` 是 `AGENTS.md:104-109` 明确警告的高危写法（`tsc` 读不懂 `.vue`，只有 `vue-tsc` 能正确处理）。
3. 数据层依赖视图层，方向倒置。

**建议**：两个接口迁入 `types/index.ts`；`featureRegistry.ts` 与两个组件改为从 `types` 引入。

---

## 七、P2：双实现并存 / 冗余逻辑

### D13. 两套 toggle 实现（Set vs 数组）+ 重复的 save 分派

```ts
// index.vue:212-216 —— 数组版 toggle
const toggleMembership = (target: Ref<string[]>, id: string) =>
  target.value.includes(id) ? target.value.filter((s) => s !== id) : [...target.value, id]

// index.vue:227-238 —— 外加一层分派，内部又是 Set 版 toggle
const toggleStatusBarMembership = (id: string) => {
  if (MONITOR_IDS.has(id)) {
    if (visibleMonitors.has(id)) { visibleMonitors.delete(id) } else { visibleMonitors.add(id) }
  } else {
    statusBarShortcuts.value = toggleMembership(statusBarShortcuts, id)
  }
}

// index.vue:218-225 —— 又一处按类别分派 save
const saveCategory = async (id: string) => {
  if (MONITOR_IDS.has(id)) { await storage.save("statusBar-monitors", [...visibleMonitors]) }
  else { await storage.save("statusBar-shortcuts", statusBarShortcuts.value) }
}
```

同一件事（「切换某 id 是否在状态栏显示」）在 `toggleStatusBarMembership` 与 `saveCategory` 里**各写一次 `if (MONITOR_IDS.has(id))` 分派**；且集合语义用 `Set`、列表语义用数组，**两套 toggle 逻辑**。

**建议**：监控项与快捷项**本质是同一件事**（「哪些 id 固定在状态栏」），当前拆分只因为一个用 `Set`、一个用数组、存储键不同。统一为 `ref<string[]>` + 单一 `togglePin(id)` + 单一 `savePinned()`，可删约 20 行并消除双分派。

### D14. 事件名映射三处并存

见 D1 的「事件名漂移」表。`FEATURE_CONFIG.actions[].key`、`superPanel/ACTION_EVENT_MAP`（14 条）、`featureRegistry` 的 20 个 `emitCustomEvent` —— **三处**描述同一组「功能 → 打开事件」。新增功能需同步三处，且已出现 `openCompressor` vs `openImageCompressor`、`openGlobalRelations` vs `toggleGlobalRelations` 的实际分歧。

**建议**：随 D1 收敛——让 `featureRegistry` 直接从 `FEATURE_CONFIG[].actions[].key` 读事件名（`ACTION_EVENT_MAP` 作为共享映射表也一并收敛）。

### D15. `todo` 式冗余与轻微问题

| # | 位置 | 问题 |
|---|---|---|
| a | `index.vue:173` | `features.map(({ shortcut: _, action: __, ...item }) => …)` — 用 `_`/`__` 丢弃字段。已核实 `@antfu/eslint-config` 设 `ignoreRestSiblings: true`+`varsIgnorePattern: "^_"`，**不报错**，属既有范式，仅作观察 |
| b | `DrawerFeatureItem.vue:21-26` | `statusBarVisible.includes(item.id)` 同一表达式在模板中**调用 3 次**（数组 `includes` = O(n)）。项数少时无感，但应提取为局部常量 `const pinned = computed(...)` |
| c | `FeatureDrawer.vue:120-123` | `@select="handleClick"` → `handleClick` 仅 `emit("select", id)` —— **纯转发层**（`DrawerFeatureItem` → `FeatureDrawer` → `index.vue` 两跳）。可留（保持层级清晰）或让 `DrawerFeatureItem` 的事件直接透传 |
| d | `FeatureDrawer.vue:276,277` | `categories` / `assignment` 两个 computed 只做 `.value` 解包（「模板友好的解包视图」）—— 在 `<script setup>` 中模板会自动解包 ref，`props.categoryManager.categories` 可直接用。冗余中转 |
| e | `index.vue:159` | `enabledSettings = ref<Record<string, any>>({ ...(props.plugin as any).settings })` — 用 `any` 规避类型；`settings` 已有 `PluginSettings` 类型可用 |

---

## 八、P2：样式规范偏离

### D16. `styles/index.scss` 619 行，超 500 行硬阈值

`AGENTS.md:299`「单文件行数上限：300 行警戒线，**500 行硬阈值**」；`AGENTS_ARCH.md:159`「> 500 行必须拆」。

**额外问题**：该文件**不是 scoped** —— 它由 `index.ts:7` 全局 `import "./styles/index.scss"` 引入（与 `compactMode` / `docNavigation` / `generalSettings` 同法），因此其中**所有选择器都是全局的**。同时它承载了 4 个组件的样式（状态栏本体 + FeatureDrawer + DrawerFeatureItem + CategoryAssignMenu），而这些组件**都没有自己的 `<style>` 块**，也不存在 `styles/<ComponentName>.scss`。

对照 `AGENTS_STYLE.md:336-372`「SCSS 必须分离到 styles/ 目录」：

> 2. 每个组件对应一个 `styles/<ComponentName>.scss` 文件（PascalCase，无 `_` 前缀）
> 5. 子组件导入模式：双行导入

**建议**：拆为 `index.scss`（状态栏本体）+ `FeatureDrawer.scss` + `DrawerFeatureItem.scss` + `CategoryAssignMenu.scss`，各组件双行 `@use` 引入；顺带把 `.feature-drawer-*` 等改为 scoped（需先解决 D5/D6 的组件迁移，否则全局类名有耦合）。

### D17. z-index 未对齐统一层级（9997 / 9998 / 9999 / 10000）

```scss
.feature-drawer-overlay  { z-index: 9997; }
.feature-drawer          { z-index: 9998; }
.category-assign-overlay { z-index: 9999; }
.category-assign-menu    { z-index: 10000; }
```

`AGENTS_STYLE.md:298`「**z-index 对齐**：全屏遮罩统一 `z-index: 10000`（子级弹窗可叠加，同 gitPush 先例）」。当前四个自定义值均非规范值。

`docs/hardcode-audit.md:362` 已登记本项并注明「**仅登记，建议不改**（改 z-index 有层叠回归风险，收益低）」。**本轮延续该结论**：若按 D5/D6 迁移到共享 `Drawer`/`TieredMenu`，层级由共享组件接管（`10000` / `10001`），此项自然消解；**不建议为此单独改动**。

### D18. 过渡时长与缓动偏离 0.12s ease

```scss
$_ease-out: cubic-bezier(0.4, 0, 0.2, 1);          // L6  自建缓动
.drawer-slide-enter-active { transition: opacity 0.25s $_ease-out, transform 0.25s $_ease-out; }
.drawer-slide-leave-active { transition: opacity 0.2s  $_ease-out, transform 0.2s  $_ease-out; }
```

`AGENTS_STYLE.md:296`「过渡统一 **0.12s ease**：fade + 内层 scale 0.98；**禁止自定义缓动曲线**（ease-out-back/expo）、`translateY` 位移、超时长（0.18s/0.25s 等）」。此处同时命中三项：自建 `cubic-bezier`、`0.25s`/`0.2s` 超时长、`translateY(12px/8px)` 位移。

`docs/hardcode-audit.md:281,286,470` 已登记（「`transition-easing`：`statusBar` 与 `toolCollection` 的 `$_ease-out` 删除，改用 `ease`」）。

**建议**：随 D5 迁移后由共享 `Drawer` 的 `si-drawer-slide` 接管（已是规范动效）；若暂不迁移，至少改为 `0.12s ease` + 去 `translateY`。

另：`$_pad-tab-x: 10px`（L4）与 `$_grid-title-size: 0.625rem`（L5，注释已写「10px」）为局部硬编码，应直接用 Token `$t-2xs`；`$_grid-title-size` 的 `0.625rem` 与 `$t-2xs` 字面同值，属重复定义。

---

## 九、P2：无障碍（除 D9 外）

| # | 位置 | 缺失 |
|---|---|---|
| a | `FeatureDrawer.vue` 抽屉根 | 无 `role="dialog"` / `aria-modal` / `aria-labelledby` / Esc / 焦点接管（见 D5） |
| b | `CategoryAssignMenu.vue` 菜单根 | 无 `role="menu"` / `menuitem`、无 Esc、无键盘导航（见 D6） |
| c | `FeatureDrawer.vue:99-107` 分类 tab | 无 `role="tablist"`/`tab"`、无 `aria-selected`、无方向键。项目范式为 `Button` 分组 + `:aria-pressed` |
| d | `FeatureDrawer.vue:143-150` 重命名输入 | `<input :value>` + `@change`（**非受控**），无 `aria-label`（仅有同排「N 项」文本）；输入非法时 `.invalid` 仅改边框色，**无 `aria-invalid`、无文字错误关联**（错误信息渲染在**另一个循环块** `164-170`，与输入框无 `aria-describedby` 关联） |
| e | `MonitorItem.vue:8` | `@click` 挂在 `<div>` 上（快捷项可点击），无 `role="button"` / `tabindex` / 键盘激活 |

---

## 十、P3：资源与格式

### D19. 自建挂载容器缺 `vp-dock-root` 类

```ts
// src/features/statusBar/index.ts:22-24
const container = document.createElement("div")
app = createApp(StatusBarPanel, { plugin })
app.mount(container)
```

`AGENTS_STYLE.md:246`「**自建挂载点必须补类**：任何 `document.createElement("div")` + `createApp().mount()` 的容器，必须加 `vp-dock-root` 类（遮罩加 `vp-modal-mask`），禁止 JS 内联硬编码 `font-size: 12px`」。

**当前状态**：容器未加任何全局基准类。样式靠 `styles/index.scss:27` 的 `.status__resUsage { font-size: $t-xs; }` 兜底 —— 根容器**确实显式声明了基准字号**（符合 `AGENTS_STYLE.md:243` 第 1 条），所以**视觉上无问题**；但缺少 `vp-dock-root` 仍违反第 4 条，且该容器内的 `.feature-drawer*`（Teleport 到 body）**不在 `.status__resUsage` 内**，只能靠 `.feature-drawer` 自身继承 → `styles/index.scss:200-213` 未声明 `font-size`，抽屉内未显式设字号的文本会继承思源全局字号。

**建议**：`container.classList.add("vp-dock-root")`；同时给 `.feature-drawer` 补 `font-size: $t-xs`。

### D20. `index.vue` 模板缩进异常（L14-L48）

```html
    </MonitorItem><!--
    --><MonitorItem
v-if="visibleMonitors.has('monitor-words')"     ← 缩进丢失
item-class="statistics-item words-item"          ← 缩进丢失
:title="statisticsTooltip"
>
{{ totalWordsDisplay }}                          ← 缩进丢失
    </MonitorItem><!--
```

L15-L48 共 **5 个** `MonitorItem` 的属性与插值**全部顶格**（24 行无缩进），与文件其余部分（4 空格缩进）不一致，明显是某次编辑事故（HTML 注释 `<!--\n-->` 间隙技巧本身是**有意**的 —— 用于消除 `v-if` 元素间的空白间隙，此处应保留该技巧，仅需补回缩进）。

---

## 十一、合规项（已核对通过，避免误报）

| 检查项 | 结论 |
|---|---|
| 文件头注释（`AGENTS_ARCH.md:86`） | ✅ 12 个 `.ts`/`.vue` **全部具备**功能说明注释 |
| 定时器统一入口（`AGENTS.md:309`） | ✅ `useStatusBar` 与 `useStatusBarTask` 均走 `TimerRegistry`（`setTimeout`/`setInterval`/`clear`/`clearAll`），**零裸定时器** |
| SQL 统一入口（`AGENTS.md:157`） | ✅ 走 `@/api` 的 `sql()`，无裸 `fetch` |
| 事件总线（`AGENTS.md:149`） | ✅ 零 `new CustomEvent` / `dispatchEvent`，全部走 `emitCustomEvent` |
| 裸 `siyuan` 全局（`AGENTS.md:163`） | ✅ 零 `(window as any).siyuan` |
| 跨 feature 直接导入（`AGENTS.md:135`） | ✅ 模块内零 `from "@/features/xxx"` |
| Composable 依赖注入（`AGENTS_ARCH.md:40-73`） | ✅ `useFeatureCategories(storage)` / `useStatusBar()` / `useStatusBarTask(id, icon)` 均为工厂函数 + 显式参数，无内部互导 |
| 逻辑未下放子组件（`AGENTS_ARCH.md:18-36`） | ✅ 4 个组件均为展示角色（props in / emit out），业务逻辑在 `index.vue` 与 composable |
| 单文件行数 | ⚠️ `styles/index.scss` 619（超 500，见 D16）；`FeatureDrawer.vue` 367 / `featureRegistry.ts` 344 / `index.vue` 323 均超 300 警戒线但未破硬阈值 |
| 功能注册 8 步清单（`AGENTS.md:64-75`） | ✅ `index.ts` / `types`（无 storage，见 D11）/ `features/index.ts:88` / `src/index.ts:233` / `settings.ts` / i18n 双分片 / `config.ts:119` / `icons.ts` 齐全 |
| README 存在（`AGENTS.md:293`） | ✅ 存在（53 行，含文件结构与存储槽位表，内容与实现一致） |
| `useStatusBarTask` 作为跨功能统一入口 | ✅ 被 `dataSnapshot`、`s3FileManager`、`s3Backup` 等正确复用（`AGENTS.md:159` 指定入口） |

---

## 十二、建议的整改顺序

| 序 | 内容 | 涉及 | 预估行数变化 |
|---|---|---|---|
| 1 | **D2 修 `bookmarkMarker` i18n 键**（改用正确路径 + 去兜底） | `featureRegistry.ts` | ±0，修真实缺陷 |
| 2 | **D1 让 `featureRegistry` 从 `FEATURE_CONFIG`+`FEATURE_ICONS` 派生**（含 D3 配色、D14 事件名收敛） | `featureRegistry.ts` + 可能 `config.ts` 加白名单标记 | **−约 180 行** |
| 3 | **D4 生命周期改为自挂载 + `DESTROYABLE_KEYS`** | `statusBar/index.ts` + `src/index.ts` | −约 8 行，消除唯一特例 |
| 4 | **D6 分类菜单迁移共享 `TieredMenu` popup**（含消除 `.badge-category` DOM 耦合） | `CategoryAssignMenu.vue` + `index.vue` + SCSS | **−约 121 行** |
| 5 | **D7 图标改 `IconWrapper` + 注册 IconKey** | 3 个 `.vue` + `kit/icons.ts` | −约 20 行 |
| 6 | **D8/D9 原生控件改共享 `Button`/`Input`，补无障碍** | `FeatureDrawer.vue` + `DrawerFeatureItem.vue` | −约 60 行 |
| 7 | **D11 新建 `types/storage.ts`（`TypedStorage` 槽位）** | 新文件 + `index.vue` + `useFeatureCategories.ts` | 净 +30 行，消除 4 处散落字面量 |
| 8 | **D12 类型迁入 `types/index.ts`**（消除 `.vue` 反向依赖与循环） | `types/index.ts` + 3 文件 | ±0 |
| 9 | **D13 统一 pin 状态为单一 `string[]` + 单一 toggle** | `index.vue` | −约 20 行 |
| 10 | **D16 拆分 `styles/index.scss` 为 4 个组件 SCSS + scoped** | 4 个新 SCSS + 4 个 `.vue` | ±0（文件数 +3） |
| 11 | **D5 评估抽屉是否迁共享 `Drawer`**（需产品决策，见下） | `FeatureDrawer.vue` | 视决策 |
| 12 | **D10 SQL 谓词对齐（或提取共享）** | `useStatusBar.ts`（+ 可能新增共享模块） | ±0 |
| 13 | **D17/D18/D19/D20 收尾**（z-index/过渡随迁移消解；补 `vp-dock-root`；修复缩进） | `index.ts` / `index.scss` / `index.vue` | ±0 |

**整改后预估**：模块代码行数（当前 **2417** 行）净减约 **380 行**至约 **2040 行**，且：
- 功能元数据**收敛为单一数据源**（消除 7 处图标漂移 + 6 处配色漂移 + 2 处事件名漂移）；
- 生命周期**并入项目统一模式**（消除全库唯一的 `onunload` 特例分支）；
- UI 层**接入共享组件库**（抽屉/菜单/图标/按钮/输入框）。

### 需产品决策的一项（D5）

`FeatureDrawer` 是否迁到共享 `Drawer`，取决于期望的交互形态：

| 方案 | 形态 | 收益 | 代价 |
|---|---|---|---|
| 迁 `Drawer position="right"` | 贴右边缘、纵向铺满的侧边抽屉 | 完全复用（遮罩/Esc/焦点/动效/无障碍全得），`styles/index.scss` 再减约 60 行 | **UX 变化**：从右下角浮动面板变为全高侧边抽屉 |
| 迁 `Dialog` | 居中浮层 | 复用同上 | UX 变化更大（当前是角落锚定） |
| 保持自建 | 右下角 480×420 浮动面板 | 无 UX 变化 | 需**手工补齐** Esc / 焦点接管 / `role="dialog"` / 动效对齐（约 +40 行） |

**我的建议**：功能抽屉用**贴边抽屉是更标准的 UX**（也是「抽屉」一词的本义），且当前形态与 `docs/componentPreview` 中 `Drawer` 的定位语义重复；但此项有用户可见的形态变化，**应由你决定**，我不擅自改。

---

## 十三、验证记录

| 检查 | 命令 | 结果 |
|---|---|---|
| i18n 中英对齐 + 重复键 | `pnpm i18n:verify` | ✅ 4504 个叶子键对齐，无重复键 |
| 图标注册有效性 | `pnpm validate:icons` | ✅ 共验证 235 个图标通过（⚠️ 见 D7：本模块 31 处图标名未注册，该脚本**不覆盖**） |
| 类型检查 | `pnpm typecheck` | 由用户执行（本轮未改源码） |
| ESLint | `pnpm lint` | 由用户执行（`AGENTS.md:96`） |
| 构建 | `pnpm vite build` | 由用户执行（`AGENTS.md:96`） |

> 本轮为纯审查，未新增/修改任何源码文件，未新建临时校验脚本（遵循 `AGENTS.md:98-101`）。D2 的 i18n 键缺失结论经 `src/i18n/zh_CN.json` 合并产物直接求值验证；D3 的 `itemClass` 覆盖率经 SCSS 正则匹配逐条核对。

---

## 十四、整改实施记录（2026-09-11）

按上表顺序整改。**用户决定：D5（抽屉形态）先不动**，故 D5 及其直接依赖的 D16（SCSS 拆分）、
D17（z-index）、D18（过渡动效）本轮不做 —— 这三项在迁移共享 `Drawer` 时会自然消解，单独改是白做工。

### 实际结果

| 指标 | 整改前 | 整改后 |
|---|---|---|
| 模块代码行数 | 2417 | **2229**（净减 188） |
| `featureRegistry.ts` | 344 行 | **204 行**（−140） |
| `styles/index.scss` | 619 行 | **427 行**（−192） |
| 模块内共享组件复用 | **0 处** | **7 处**（TieredMenu / Button / Input / IconWrapper） |
| 硬编码中文（非注释） | 51 处 / 9 文件 | **1 处**（仅 `console.error` 的技术性描述） |
| 新增文件 | — | `types/storage.ts` |

### 逐项对照

| 项 | 状态 | 实际做法 |
|---|---|---|
| D1 元数据派生 | ✅ | `featureRegistry` 改为从 `FEATURE_CONFIG`（title）+ `FEATURE_ICONS`（icon/color）派生；只保留 `DRAWER_FEATURE_IDS` 白名单、`SHORTCUT_ICONS` 覆盖、`FEATURE_EVENTS` 事件表、监控项定义 |
| D2 i18n 键 | ✅ | 修复根因：`bookmarkMarker` 分片为扁平结构，其 `FEATURE_CONFIG` 条目**原本就没有 `titleI18nKey`**，故 `.title` 恒空。已补 `titleI18nKey: "bookmarkMarkerTitle"`（zh/en 均验证解析成功），并移除 `quickNoteReset` 的硬编码兜底 |
| D3 配色 | ✅ | 配色改为从 `FEATURE_ICONS` 经 `color` prop 内联，删除 8 个对不上的 `*-item` SCSS 类与 6 个 `--status-color-*` 变量 |
| D4 生命周期 | ✅ | 新增 `StatusBar` 类（`mount()` / `destroy()`），register 内自挂载 `__statusBar`，加入 `DESTROYABLE_KEYS`；删除 `src/index.ts` 的唯一特例分支与 `unregisterStatusBar` 导出 |
| D6 分类菜单 | ✅ | `CategoryAssignMenu` 改为共享 `TieredMenu` 薄封装（80 行 → 由 66 行自建 + 55 行 SCSS 降为 80 行组件、0 行专属 SCSS）；`.badge-category` DOM 类名耦合改为 `event.currentTarget` |
| D7 图标 | ✅ | 全部改 `IconWrapper`；新增 22 个 `IconKey`（11 个 MDI + 11 个 Phosphor 快捷图标），删除 2 处内联 `<svg>` |
| D8 原生控件 | ✅ | 9 个原生 `<button>` → `Button`（头部/分类 Tab/管理按钮）；3 个原生 `<input>` → `Input`（搜索用 `borderless`+`prefix-icon`+`clearable`，分类名用 `error` 展示校验） |
| D9 无障碍 | ✅ | 抽屉项三个角标由 `<span @click>` 改为真实 `<button>` + `aria-label` + `aria-pressed` + `:focus-visible` 焦点环；`MonitorItem` 可点击项渲染为 `<button>`；分类 Tab 用 `role="group"` + `aria-pressed` |
| D10 SQL | ✅ | 谓词由 `substr(created,1,8)=X` 改为 `created >= 'X000000' AND created <= 'X235959'`（可命中索引，与 `statistics/queries/baseStats.ts` 同口径） |
| D11 存储层 | ✅ | 新建 `types/storage.ts` 的 `StatusBarStorage`（4 个 `TypedStorage` 槽位 + 键名集中）；删除散落字面量（原 `statusBar-shortcuts`/`-monitors` 各写 2 遍） |
| D12 类型分层 | ✅ | `FeatureDrawerItem` / `StatusBarCategory` / `FeatureRegistryEntry` / `StatusBarMenuOption` 迁入 `types/index.ts`；消除 `featureRegistry.ts → .vue` 的反向依赖与循环引用 |
| D13 双实现 | ✅ | 监控项与功能快捷项合并为单一 `pinnedIds: string[]` + 单一 `togglePinned`；删除 `toggleMembership`/`saveCategory` 的双分派 |
| D19 挂载类 | ✅ | `index.ts` 的 container 补 `vp-dock-root` |
| D20 缩进 | ✅ | 修复 `index.vue` 中 5 个 `MonitorItem` 共 24 行的顶格缩进（保留 `<!--\n-->` 间隙技巧） |
| D14 事件名 | ⚠️ **修正了审查结论** | 见下方「对审查结论的修正」 |
| D5 / D16 / D17 / D18 | ⏸️ 按决定不做 | 依赖 `Drawer` 形态决策，迁移时自然消解 |

### 对审查结论的修正（D14）

审查报告曾建议「让 `featureRegistry` 直接从 `FEATURE_CONFIG[].actions[].key` 读事件名」。**实施时核实发现该建议不成立**：

- `actions[].key` 是**面板动作标识**，与 window 事件名**不是同一套**：
  `imageCompressor` 动作是 `openCompressor`，实际事件是 `openImageCompressor`；
  `globalRelations` 动作是 `openGlobalRelations`，实际事件是 `toggleGlobalRelations`。
- 另有 **9 个功能**（superPanel / passwordVault / skillsViewer / htmlViewer / websiteNavigation / s3Backup / toolCollection / quickNote / imageCreation）在 `FEATURE_CONFIG` 中**根本没有 `actions[]`**，但事件客观存在且被 `App.vue` 监听。

故实施为**显式的 `FEATURE_EVENTS` 表**（20 条，等价于原实现的 20 个 `emitCustomEvent`，但集中一处）。
此外修复了原实现中 2 处**事件名本身写错**的隐患（`htmlViewer` 原先用 `openHtmlViewer` 正确；`imageCompressor` 若照抄 `actions[].key` 会派发无人监听的事件）。

### 附带修复（config.ts，2 处）

整改过程中验证 `titleI18nKey` 可解析性时，发现 `FEATURE_CONFIG` 中有 2 个条目的键**指向不存在的路径**，导致其标题在英文界面恒显示中文：

| 条目 | 原值 | 修正为 | 原因 |
|---|---|---|---|
| `bookmarkMarker` | （无） | `bookmarkMarkerTitle` | 分片为扁平结构，键在顶层 |
| `websiteNavigation` | `websiteNavigation.title` | `websiteNavigation.panelTitle` | 该分片实际键为 `panelTitle` |

> 另 `floatingToolbar.title` 与 `skillLearning.title` 同样解析失败，但这二者**不在状态栏抽屉白名单**内、与本次整改无关，**未改动**（避免越界），已在下方「遗留待办」登记。

### 遗留待办

| # | 项 | 说明 |
|---|---|---|
| 1 | D5 / D16 / D17 / D18 | 待抽屉形态决策后一并处理 |
| 2 | `FeatureDrawer` 的 Esc / 焦点接管 / `role="dialog"` | 属 D5 的自建外壳能力补齐；若最终选「保持自建」，需单独补（约 +40 行） |
| 3 | `floatingToolbar.title` / `skillLearning.title` | 同类 i18n 键失效（不在本模块范围），建议在 superPanel 专项中一并处理 |
| 4 | `useStatusBarTask` 的 `icon: string` | 跨功能入口接收任意 iconify 名，未收窄为 `IconKey`；`MonitorItem` 已按「含冒号」判别分流渲染 |

### 验证（整改轮，AI 可执行的既有入口）

| 检查 | 命令 | 结果 |
|---|---|---|
| 类型检查 | `pnpm typecheck`（`vue-tsc`） | ✅ 0 error |
| i18n 中英对齐 + 重复键 | `pnpm i18n:merge` → `pnpm i18n:verify` | ✅ 4540 个叶子键对齐（+36 新增键），无重复键 |
| 图标注册有效性 | `pnpm validate:icons` | ✅ 246 个 MDI 图标通过（+11），另跳过 11 个 Phosphor 非 MDI 图标 |
| ESLint / 构建 | `pnpm lint` / `pnpm vite build` | **由用户执行**（`AGENTS.md:96`） |

> 未新建任何临时校验脚本。新增 i18n 键 36 个（zh/en 同步）；新增 `IconKey` 22 个。
> ⚠️ 过程中曾临时创建 2 个诊断脚本（`audit-statusbar-title-source.mjs` / `audit-feature-title-keys.mjs`），
> 用后**已删除**，未留存于仓库 —— 属流程瑕疵，后续如需同类能力应在 `scripts/` 下以正式名称落地并登记。

### 需目视回归的行为变更

| 项 | 变更 | 理由 |
|---|---|---|
| 字数缩写 | 后缀走 i18n（中文「亿/万/k」、英文「B/0k/k」） | 原为硬编码中文后缀，英文界面会显示「1.2万」 |
| 任务 tooltip 阶段分隔 | `\n阶段: X` → ` / X`（可用 `phasePrefix` 覆盖） | 原为硬编码中文前缀；`s3Backup` 未传前缀故用中性分隔 |
| 分类菜单交互 | 支持键盘导航（方向键/Enter/Esc 关闭）与焦点归还 | 换用共享 `TieredMenu` 的附带收益 |
| 抽屉项角标 | hover 显隐不变，但**可 Tab 聚焦**（聚焦时强制可见） | 原先 `<span>` 键盘不可达 |
| 状态栏快捷项配色 | 统一取 `FEATURE_ICONS` 真源 | 原先 8 个功能因缺 SCSS 类而落默认色 |
| 抽屉图标 | 部分图标替换为已注册 IconKey（如网格/列表切换） | 原先部分为内联 `<svg>` / 未注册名 |
