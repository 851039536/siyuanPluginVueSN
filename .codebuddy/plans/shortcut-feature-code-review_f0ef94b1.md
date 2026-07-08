---
name: shortcut-feature-code-review
overview: 对 shortcut 功能模块进行深度代码审查与重构，修复逻辑漏洞、消除冗余代码、优化性能、确保符合项目编码规范。
todos:
  - id: fix-logic-bugs
    content: 修复逻辑漏洞：confirmDelete 补充 recentUsed 持久化并检查 removeShortcut 返回值、search() 添加 null 防护、STORAGE_KEYS 补全 SHORTCUTS_ALL_KEY
    status: completed
  - id: eliminate-redundancy
    content: 消除冗余代码：manager.ts 提取 _upsertOne 私有方法、storage.ts 提取 sanitizeStringArray 纯函数、移除 ShortcutManagerConfig 和构造函数冗余赋值
    status: completed
  - id: optimize-recentused
    content: 性能优化：将 recentUsed 从 string[] 升级为 Map<string, number>（O(1) 查找），同步更新 isRecent、addToRecent、confirmDelete、filteredShortcuts 中所有引用点
    status: completed
    dependencies:
      - fix-logic-bugs
  - id: fix-coding-standards
    content: 修正编码规范：为 5 个 .vue 组件补全文件头注释、提取 index.vue 删除确认弹窗内联 SCSS 到 styles/DeleteConfirmDialog.scss、ShortcutDialog.vue 的 Input 添加 size="small"
    status: completed
  - id: sync-category-data
    content: 同步硬编码数据：将 TOOL_CATEGORIES 和 CATEGORY_LABEL_KEYS 提取到 types/index.ts、QUICK_FILTERS 接入 i18n、index.vue 从 types 统一导入
    status: completed
    dependencies:
      - eliminate-redundancy
---

## 用户需求

对 `src/features/shortcut/` 模块进行全方位代码审查与优化，具体包括：

1. **逻辑漏洞修复**：修复 `confirmDelete()` 删除后未保存 `recentUsed` 的 bug、`removeShortcut` 返回值未检查的问题、`search()` 方法缺少 null 防护、`STORAGE_KEYS` 数组不完整的遗漏
2. **冗余代码消除**：合并 `manager.ts` 中 `addShortcut`/`addShortcuts` 的重复 upsert 逻辑、提取 `storage.ts` 中 `loadFavorites`/`saveFavorites`/`loadRecent`/`saveRecent` 的重复类型校验模式、移除 `ShortcutManagerConfig` 未使用的类型定义、清理构造函数冗余赋值
3. **性能优化**：将 `recentUsed` 从 `Array`（O(n)查找）改为 `Set` 或有序结构、优化 `filteredShortcuts` 中的重复数组复制
4. **编码规范修正**：为 5 个 `.vue` 组件补全文件头注释（PanelHeader、ShortcutCard、ShortcutDialog、ShortcutGrid、index.vue）、提取 `index.vue` 中内联的删除确认弹窗 SCSS 到独立文件、为 `ShortcutDialog.vue` 的 `<Input>` 添加 `size="small"`
5. **数据同步**：消除 `categoryLabels` 和 `TOOL_CATEGORIES` 的硬编码、为 `QUICK_FILTERS` 接入 i18n

所有修改必须保证现有业务逻辑不受影响，代码符合 CLAUDE_RULES.md 规范。

## 技术方案

### 实现策略

采用**渐进式修复**策略，按「逻辑修复 → 冗余消除 → 性能优化 → 规范修正 → 数据同步」的顺序逐层推进，每层修复后确保功能等价、零回归。

### 关键决策

| 决策点 | 方案 | 理由 |
| --- | --- | --- |
| recentUsed 数据结构 | `Map<string, number>`（id→时间戳）替代 `string[]` | 同时满足 O(1) 查找和有序遍历（按时间戳排序），避免 Set 无序问题 |
| getAllShortcuts 缓存 | 不引入缓存层，保持简单 | 数据量小（200+条），copy 开销可忽略；引入缓存需处理失效逻辑，增加复杂度得不偿失 |
| 冗余代码提取方式 | manager.ts 提取私有 `_upsertOne()` 方法；storage.ts 提取模块级 `sanitizeStringArray()` 纯函数 | 私有方法减少类暴露面；模块级函数不依赖实例状态，与项目中 `utils.ts` 分层模式一致 |
| TOOL_CATEGORIES 同步 | 从 `ShortcutCategory` 联合类型中推导出工具类分类列表 | 与 CODEBUDDY.md「同一定义被多处使用时须提取到 types/ 或 utils.ts」规则一致 |


### 实现细节

#### 1. 逻辑漏洞修复

**`confirmDelete()` 修复**（`index.vue`）：

- 在删除 success 后补充 `storage.value.saveRecent(recentUsed.value)` 调用
- 仅当 `manager.removeShortcut(id)` 返回 `true` 时才清理本地 favorites 和 recentUsed

**`search()` null 防护**（`manager.ts`）：

- 函数入口添加 `if (!keyword) return []` 快速返回

**`STORAGE_KEYS` 补全**（`index.vue`）：

- 添加 `SHORTCUTS_ALL_KEY` 到 `STORAGE_KEYS` 数组

#### 2. 冗余代码消除

**`manager.ts` 提取 upsert 逻辑**：

```ts
private _upsertOne(shortcut: ShortcutInfo): void {
  const index = this.shortcuts.findIndex((s) => s.id === shortcut.id)
  if (index !== -1) {
    this.shortcuts[index] = shortcut
  } else {
    this.shortcuts.push(shortcut)
  }
}
```

`addShortcut()` 和 `addShortcuts()` 复用此方法。

**`storage.ts` 提取 `sanitizeStringArray()`**（模块级纯函数）：

```ts
function sanitizeStringArray(data: unknown): string[] {
  if (!data || !Array.isArray(data)) return []
  return data.filter((item): item is string => typeof item === "string")
}
```

替代 4 处重复的类型校验+过滤模式。

**移除 `ShortcutManagerConfig`**（`types/index.ts`）：

- 该接口在整个仓库中无一引用，直接删除

**移除构造函数冗余赋值**（`manager.ts`）：

- 删除 `constructor() { this.shortcuts = [] }`，字段声明 `= []` 已足够

#### 3. 性能优化

**`recentUsed` 数据结构升级**（`index.vue`）：

使用 `Map<string, number>`（id→添加时间戳）替代 `string[]`：

```ts
const recentUsedMap = ref<Map<string, number>>(new Map())
const recentUsedOrdered = computed(() => {
  return Array.from(recentUsedMap.value.entries())
    .sort(([, a], [, b]) => b - a)  // 降序：最新的在前
    .slice(0, 10)
})
```

`isRecent(id)` → `recentUsedMap.value.has(id)`（O(1)）
`addToRecent(id)` → `recentUsedMap.value.set(id, Date.now())`（O(1)）

- 仅当 size > 10 时清理最旧的条目（O(n) 但 n≤10）

`filteredShortcuts` 中的 `recent` 筛选改用 `recentUsedMap.value.has(s.id)`

**`filteredShortcuts` 搜索短路**：search 结果为 `[]` 时跳过后续 tab/filter 过滤

#### 4. 编码规范修正

**文件头注释**：为 5 个 `.vue` 文件添加 `<!-- 文件功能简述 -->`（`<template>` 之前），遵循 CLAUDE_RULES.md § 强制规则：文件头注释。

**SCSS 分离**：将 `index.vue` 中 `.delete-confirm-overlay` ~ `.delete-modal-footer`（行 410-456）提取到新建 `styles/DeleteConfirmDialog.scss`，`index.vue` 的 `<style>` 块改为：

```
@use "./styles/index.scss";
@use "./styles/DeleteConfirmDialog.scss";
```

**Codex UI 合规**：`ShortcutDialog.vue` 中 4 个 `<Input>` 添加 `size="small"`，符合 CLAUDE_RULES.md § Input/Select 组件 size 强制规范。

#### 5. 数据同步

**`categoryLabels` 重构**（`index.vue`）：将硬编码的 11 个分类标签映射提取到 `types/index.ts` 作为常量 `CATEGORY_LABEL_KEYS`（只存 i18n key），在组件中通过 computed 使用 `props.i18n[key]` 动态生成。

**`TOOL_CATEGORIES` 同步**（`types/index.ts`）：从 `ShortcutCategory` 联合类型中定义工具类分类常量：

```ts
export const TOOL_CATEGORIES: readonly ShortcutCategory[] = ["npm", "nvm", "cmd", "vscode", "visual-studio"]
```

在 `index.vue` 中从 types 导入使用，`showToolBadge` 的类型签名改为 `ShortcutCategory`。

**`QUICK_FILTERS` 接入 i18n**（`index.vue`）：从 `types/index.ts` 导入 `QuickFilter` 类型定义的 filter meta 列表（含 i18n key），在组件中使用 `props.i18n` 映射。

### 目录结构调整

修改/新建的文件：

```
src/features/shortcut/
├── index.ts                          # [MODIFY] 补充导出
├── index.vue                         # [MODIFY] 核心修复：confirmDelete、recentUsed 升级、SCSS 分离、文件头注释
├── manager.ts                        # [MODIFY] search null 防护、提取 _upsertOne、移除冗余构造函数
├── types/
│   ├── index.ts                      # [MODIFY] 移除 ShortcutManagerConfig、导出 TOOL_CATEGORIES/CATEGORY_LABEL_KEYS
│   └── storage.ts                    # [MODIFY] 提取 sanitizeStringArray 纯函数
├── data/
│   └── presets.ts                    # [MODIFY] 文件头注释规范化（已有但可微调）
├── components/
│   ├── PanelHeader.vue              # [MODIFY] 添加文件头注释
│   ├── ShortcutCard.vue             # [MODIFY] 添加文件头注释
│   ├── ShortcutDialog.vue           # [MODIFY] 添加文件头注释 + Input size="small"
│   └── ShortcutGrid.vue             # [MODIFY] 添加文件头注释
└── styles/
    ├── DeleteConfirmDialog.scss      # [NEW] 删除确认弹窗样式（从 index.vue 提取）
    └── index.scss                    # [MODIFY] 移除 DeleteConfirmDialog 样式后可能需微调
```

### 不变更原则

- SCSS 文件（`.scss`）不在此次文件头注释规则适用范围内
- `presets.ts` 数据内容不修改（仅可能微调注释）
- `filteredShortcuts` 的整体过滤逻辑语义不变
- 所有 API 入口（`registerShortcut`、`addCustomShortcut`、`addCustomShortcuts`）签名不变