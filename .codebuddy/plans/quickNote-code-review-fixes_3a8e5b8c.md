---
name: quickNote-code-review-fixes
overview: 修复 quickNote 模块审查中发现的 2 个逻辑漏洞（串行锁绕过 + 跨槽写入竞态）、2 个规范违规（.close-btn 样式重复 + i18n 中文注释缺失）和 2 个冗余问题。
todos:
  - id: fix-remove-race
    content: 修复 useProjects.ts remove() 串行锁绕过与跨槽竞态问题
    status: completed
  - id: fix-css-dup
    content: 删除 styles/index.scss 中 .close-btn 样式块，index.vue 中改用 .qn-icon-btn
    status: completed
  - id: fix-i18n-comments
    content: 在 index.vue 补充 4 处 i18n 中文注释 + 关闭按钮 title 属性，删除 ProjectForm.vue 无用 submitLabel
    status: completed
---

## 问题概述

对 quickNote 模块进行全面代码审查后，发现 6 个需修复的问题，按严重程度分为三级。

## 修复清单

### P0 — 逻辑漏洞

1. **useProjects.remove() 绕过串行锁**：`remove()` 直接调用 `storage.data.loadOrDefault() + save()`，未走 `persist()` 内部的 `_saveLock` 串行锁。快速连续删除时存在 read-modify-write 竞态；且 add/update 走锁而 remove 不走，并发时 `persist()` 可能读到不含本次删除的旧数据并覆盖丢失的删除结果。
2. **remove() 跨槽写入不一致**：删除项目需同时更新 `projects` 和 `todos` 两个数组，但 `remove()` 用一次性 load+save，与 add/update 的 `persist()` 路径不统一，存在互相覆盖风险。

### P1 — 规范违规

3. **`.close-btn` 与 `.qn-icon-btn` 样式高度重复**：`styles/index.scss` 中两个 CSS 块 display/flex/align/justify/width/height/padding/border/border-radius/background/color/cursor/transition 完全一致，应复用 `.qn-icon-btn`。
4. **index.vue 缺少 i18n 中文注释**：第 11 行 `i18n.restore`、第 84 行 `i18n.minimize`、第 92-100 行关闭按钮、第 169 行 `i18n.done` 均缺中文 HTML 注释标注实际显示文案。

### P2 — 冗余

5. **ProjectForm.vue 第 88-89 行 `submitLabel` computed 未使用**：定义了但模板中无引用，且使用的 `computed` 函数未从 Vue 导入（仅导入了 `ref`），构成潜在运行时错误。
6. **index.vue 关闭按钮缺少 `:title`**：第 92-100 行，同区域的最小化按钮有 title 而关闭按钮缺失。

## 技术方案

### 修复策略

**修复 1&2：useProjects.ts remove() 串行锁**

核心思路：扩展 `persist()` 方法使其支持可选传入 `todos` 数据，让 `remove()` 复用同一套串行锁机制。

````typescript
// persist() 新增可选参数
const persist = async (todos?: TodoItem[]) => {
_saveLock = _saveLock
.catch(() => undefined)
.then(async () => {
const data = await storage.data.loadOrDefault()
const payload: AppData = { ...data, projects: projects.value }
if (todos !== undefined) {
payload.todos = todos
}
await storage.data.save(payload)
})
await _saveLock
}

// remove() 改为调用 persist(todos)
const remove = async (id: string) => {
projects.value = projects.value.filter((p) => p.id !== id)
if (todosRef) {
todosRef.value = todosRef.value.map((t) =>
t.projectId === id ? { ...t, projectId: null, updatedAt: Date.now() } : t,
)
}
await persist(todosRef?.value)
}
````

此方案：

- 利用已有的 `_saveLock` 串行化所有项目写操作（add/update/remove），消除竞态
- `add()` 和 `update()` 不传 `todos` 参数，行为不变（仅写 `projects`）
- `remove()` 传入 `todosRef?.value` 确保关联待办的 projectId 置空同步落盘
- 需要新增 `import type { AppData } from "../types"` 以支持 TypeScript 类型

**修复 3：CSS 去重**

- 删除 `styles/index.scss` 第 183-203 行 `.close-btn` 完整定义
- 修改 `index.vue` 第 83 行 `<button class="close-btn">` → `<button class="qn-icon-btn">`

**修复 4&6：i18n 注释 + title**

在 `index.vue` 模板的 4 处关键位置补充中文 HTML 注释，并为关闭按钮补 `:title="i18n.close"`。

**修复 5：删除无用 computed**

- 删除 `ProjectForm.vue` 第 88-89 行（注释行 + `const submitLabel = computed(...)`）
- 此修复同时消除了 `computed` 未导入的潜在运行时错误

### 影响范围

- 修改 4 个文件：`composables/useProjects.ts`、`styles/index.scss`、`index.vue`、`components/project/ProjectForm.vue`
- 无新增文件
- 无破坏性变更，向后完全兼容
- 不涉及 i18n 键、设置项、图标注册等注册链变更