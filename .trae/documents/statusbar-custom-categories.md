# 状态栏功能抽屉：自定义分类 + 冗余清理

## Summary

将 `src/features/statusBar` 功能抽屉的分组机制重构为**用户自定义分类**：

- Tab 完全重构：仅保留系统 Tab「全部」「监控」，新增动态自定义分类 Tab
- 移除「常用/不常用」机制与「已固定/未固定」Tab（固定到状态栏的 pin 角标保留）
- 每个抽屉项新增「分类角标」：点击弹出菜单选择归属分类（单一分类）
- 抽屉头部新增「管理分类」按钮：新建 / 重命名 / 删除分类
- 顺带清理冗余：index.vue 从 613 行（超 500 硬阈值）拆分至 300 行以内

## Current State Analysis

| 文件 | 现状 | 问题 |
|------|------|------|
| `index.vue`（613 行） | FEATURES 注册表 + 快捷/监控/不常用三套状态 | 超 500 行硬阈值；10 个近乎重复的 i18n 分片声明 |
| `FeatureDrawer.vue` | 固定 Tab（全部/已固定/未固定/监控）+ 底部「不常用」折叠区 | Tab 机制将被替换 |
| `DrawerFeatureItem.vue` | pin / rarely / toggle 三个角标 | rarely 角标随机制移除 |
| `styles/index.scss`（521 行） | 含 rarely 区块样式 | rarely 样式需删除 |
| 存储槽位 | `statusBar-shortcuts` / `statusBar-monitors` / `statusBar-rarelyUsed` | `statusBar-rarelyUsed` 将废弃 |

冗余点清单（本次清理）：

1. **`statusBar-rarelyUsed` 全链路**：storage 读写、`rarelyUsedFeatures` ref、`handleToggleRarelyUsed`、`drawerPartition` 的 rare 拆分、FeatureDrawer 底部折叠区、DrawerFeatureItem `badge-rarely`、SCSS `.feature-drawer-rarely*` 与 `.badge-rarely` —— 全部删除
2. **10 个重复的 i18n 分片声明**（index.vue L151-169）：收敛为一个 `getI18nShard(plugin, name)` 辅助函数
3. **`group: "监控"` 字符串魔法值**：改为显式 `monitor: true` 标志，`MONITOR_IDS` 由该标志派生
4. **「已固定/未固定」Tab** 与 `displayItems` 中 pinned/unpinned 过滤分支 —— 删除（pin 角标功能保留）

## Proposed Changes

### 1. `types/index.ts` — 新增分类类型

```ts
export interface StatusBarCategory {
  id: string
  name: string
}
```

### 2. 新建 `featureRegistry.ts`（模块根目录）— 提取功能注册表

- 从 index.vue 迁出 `FeatureRegistryEntry` 接口（`group?: string` 改为 `monitor?: boolean`）与 `FEATURES` 全量条目（监控项加 `monitor: true`，其余删去 `group` 字段）
- 新增辅助函数 `getI18nShard(plugin, name): Record<string, string>`，替换 10 处重复声明
- 导出 `createFeatureRegistry(plugin)` → `{ features, MONITOR_IDS, featureMap }`，供 index.vue 一次性调用
- 约 280 行；index.vue 相应减少约 320 行

### 3. 新建 `composables/useFeatureCategories.ts` — 分类状态与持久化

- 入参：`PluginStorage` 实例
- 两个存储槽位：
  - `statusBar-categories`：`StatusBarCategory[]`（有序）
  - `statusBar-feature-category`：`Record<featureId, categoryId>`（单一归属）
- 启动时 `storage.load` 异步加载（与现有 shortcuts/monitors 加载模式一致）
- API：
  - `categories: Ref<StatusBarCategory[]>`
  - `assignment: Ref<Record<string, string>>`
  - `categoryOf(featureId): string | null`
  - `addCategory(name)`（重名校验、空名忽略、id 用 `crypto.randomUUID()`）
  - `renameCategory(id, name)`（重名校验）
  - `removeCategory(id)`（删除分类并清理指向它的 assignment 项）
  - `assignFeature(featureId, categoryId | null)`（null 表示移出分类）
- 每次 CRUD 后立即 `storage.save` 对应槽位

### 4. `FeatureDrawer.vue` — Tab 重构 + 管理面板

Props 变更：`items` / `rarelyUsedItems` 改为单一 `items: FeatureDrawerItem[]`（不再预分区），新增 props：

- `categories: StatusBarCategory[]`
- `assignment: Record<string, string>`
- 删除 `rarelyUsedItems` prop

结构变更：

- **Tab 栏**：`[{ key: "__all__", label: "全部" }, { key: "__monitor__", label: "监控" }, ...categories.map(c => ({ key: c.id, label: c.name }))]`
  - `__all__`：非监控项全量
  - `__monitor__`：仅监控项
  - 自定义分类 Tab：`assignment[id] === tabKey` 的非监控项
- **删除**：不常用折叠区、`rarelyExpanded`、`hasRarelyUsed` watch、pinned/unpinned 过滤分支、`toggleRarelyUsed` emit 透传
- **头部**：新增「管理分类」按钮（icon `ph:tags`，title「管理分类」），点击切换 `manageMode`
- **管理面板**（`manageMode` 时替换 Tab 栏 + 列表区域）：
  - 分类行：名称输入框（blur/回车提交重命名）+ 成员计数 + 删除按钮（icon `ph:trash`）
  - 底部添加行：输入框 + 添加按钮（icon `ph:plus`）
  - 顶部返回按钮退出管理模式；重名/空名时输入框标红提示（简单 `:class` 即可）
- **搜索**：`matchSearch` 改为匹配 title + 当前归属分类名（原 `item.group` 匹配删除）

### 5. 新建 `components/CategoryAssignMenu.vue` — 分配弹出菜单

- Props：`categories`、`currentId: string | null`、`x: number`、`y: number`（点击角标的 `getBoundingClientRect` 坐标）
- Teleport 到 body，`position: fixed` 定位于角标旁，点击外部关闭
- 菜单项：「未分类」+ 全部分类，当前归属项高亮；点击 emit `select(categoryId | null)` 后关闭
- 监控项不显示分类角标（由 DrawerFeatureItem 控制）

### 6. `DrawerFeatureItem.vue` — 角标调整

- 删除 `badge-rarely` 角标及 `toggleRarelyUsed` emit
- 新增 `badge-category` 角标（icon `ph:tag-simple`）：仅非监控项显示（`!item.monitor`）
  - 已归属时 title「更改分类」且角标常显（`active` 态），未归属时 title「分配分类」hover 显示
- 点击 emit `assignCategory(item.id)`（父级负责打开菜单）

### 7. `index.vue` — 瘦身与接线

- 删除：`rarelyUsedFeatures`、`handleToggleRarelyUsed`、`drawerPartition` 的 rare 拆分（简化为单一 `drawerItems` computed，仅附加 `enabled`/`toggleable`）、`statusBar-rarelyUsed` 读写、10 个 i18n 分片声明
- 改用 `createFeatureRegistry(props.plugin)` 获取 `features / MONITOR_IDS / featureMap`
- 接入 `useFeatureCategories(storage)`，向 FeatureDrawer 传 `categories`/`assignment`，处理 `assign` 菜单状态（记录点击坐标与目标功能 id）
- `statusBarVisible`、`handleToggleStatusBar`、`handleToggleEnabled`、监控显隐逻辑保持不变
- 预计降至 ~250 行

### 8. `styles/index.scss` — 样式增删

- 删除：`.feature-drawer-rarely`、`.feature-drawer-rarely-header`、`.feature-drawer-rarely-caret`、`.rarely-list`、`.badge-rarely` 及 grid-mode 内 `badge-rarely` 定位
- 新增：
  - `.badge-category`（复用 `.feature-drawer-item-badge` 基类，active 色用 `var(--b3-theme-primary)`）+ grid-mode 绝对定位（bottom-left，原 badge-toggle 上移或错开）
  - `.feature-drawer-manage`：管理面板行样式（复用 `$vp-radius`、`$spacing-*` token，禁 box-shadow）
  - `.category-assign-menu`：弹出菜单（`position: fixed`、边框替代阴影、`$font-size-xs`）
- 全部遵循 Codex token 规范，无硬编码色值/字号

### 9. `README.md` — 文档更新

补充自定义分类说明：Tab 结构（全部/监控/自定义分类）、管理入口、单一归属规则、存储槽位（`statusBar-categories` / `statusBar-feature-category`），移除「不常用」相关描述。

## Assumptions & Decisions

| 决策点 | 结论 | 依据 |
|--------|------|------|
| 旧机制去留 | 常用/不常用 + 已固定/未固定 Tab 全部移除 | 用户选择「完全重构 Tab」 |
| 归属关系 | 单一分类，`Record<featureId, categoryId>` | 用户确认 |
| 监控项 | 不可分配自定义分类，仅保留「监控」Tab | 监控项是显隐开关而非功能入口 |
| 删除分类 | 成员自动回到「未分类」，无确认弹窗 | 操作可逆（重新分配即可），避免过度设计 |
| i18n | 抽屉现有文案均为硬编码中文（模块既有模式），新增文案保持一致，不改 i18n 分片 | 与模块现状一致，避免不必要的 i18n 扩散 |
| 废弃存储 | `statusBar-rarelyUsed` 直接废弃不迁移 | 无价值映射目标 |
| pin 角标 | 保留（固定到状态栏功能不变） | 与分类机制正交 |

## Verification

用户自行执行（AI 不运行 lint / vite build）：

```bash
npx tsc --noEmit     # 类型检查（重点：FeatureDrawer props 变更后调用端对齐）
pnpm i18n:verify     # 本次无 i18n 改动，确认无回归
```

人工验证项：

1. 抽屉打开 → 仅「全部 / 监控」两个 Tab；「管理分类」可新建/重命名/删除
2. 分类角标点击 → 弹出菜单选择归属 → 对应 Tab 出现并过滤正确
3. 删除分类后成员回到「全部」且无残留归属
4. 固定（pin）/ 功能开关 / 监控项显隐行为与重构前一致
5. 刷新思源后分类与归属持久化恢复
6. 行数：index.vue < 300、featureRegistry.ts < 300、styles/index.scss 增删后仍 < 550
