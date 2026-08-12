---
name: logpanel-optimization-and-detail-modal
overview: 优化操作日志面板（LogPanel）：新增状态统计条、失败快捷筛选、项目搜索、日期分组、复制按钮、条目详情弹窗，共 6 项改进。
todos:
  - id: icons-and-i18n
    content: 注册图标 mdi:alert-circle-outline 到 COMMON_ICONS；新增 zh_CN + en_US 各约 14 个 i18n 翻译键
    status: completed
  - id: stats-bar-and-filters
    content: 修改 LogPanel.vue：新增状态统计条 computed + 模板渲染、仅失败筛选按钮 + failOnly ref、项目搜索框 + searchQuery ref、三层过滤链 rebuilt + pagedReset 联动
    status: completed
    dependencies:
      - icons-and-i18n
  - id: date-groups
    content: 修改 LogPanel.vue：新增 groupedLogs computed 日期分组算法；模板改为嵌套 v-for 渲染分组标题 + 条目；LogPanel.scss 新增 sticky 分组标题样式
    status: completed
    dependencies:
      - stats-bar-and-filters
  - id: copy-button
    content: 修改 LogPanel.vue：每条日志头部右侧新增复制按钮（hover 显示、copyToClipboard + copied 2s 反馈）；LogPanel.scss 新增复制按钮样式
    status: completed
    dependencies:
      - date-groups
  - id: detail-dialog
    content: 使用 [skill:codex-ui-style-guide] 新建 LogDetailDialog.vue 详情弹窗（Teleport + Transition + mask + useDialogKeyboard）+ LogDetailDialog.scss；LogPanel.vue 挂载弹窗 + 条目 click 事件
    status: completed
    dependencies:
      - date-groups
---

## 产品概览

对 gitPush 操作日志页面（LogPanel）进行界面优化与交互增强，新增 6 项功能：状态统计概览、仅失败快捷筛选、项目名搜索、日期分组 sticky 标题、单条复制、条目详情弹窗。所有改动集中于 `LogPanel.vue` + `LogPanel.scss`，不改变现有数据流与存储结构。

## 核心功能

### 1. 状态统计条

工具条上方一行迷你统计，按操作类型展示成功/失败计数：

```
PUSH 12 成功 / 2 失败   PULL 8 成功   COMMIT 45 成功
```

成功数字绿色、失败数字红色，分隔符使用圆点 middot。无操作记录时隐藏。

### 2. "仅失败"快捷筛选

操作类型筛选按钮旁新增红色状态按钮（带 `mdi:alert-circle-outline` 图标），点击后仅显示 `ok === false` 的条目。与现有类型筛选 AND 叠加（如同时选中 PUSH + 仅失败 = 只看失败的 PUSH）。active 态用红色高亮。

### 3. 项目搜索框

工具条中新增文本输入框（带 `mdi:magnify` 搜索图标），输入时实时过滤 `entry.projectName`（大小写不敏感）。与类型筛选 + 失败筛选 AND 叠加。清空搜索词后恢复全量。

### 4. 日期分组标题

日志列表在日期变化处插入 sticky 分组标题。分组规则：今天显示"今天"，昨天显示"昨天"，其余显示完整日期 `2026-08-10`。标题使用 `position: sticky; top: 0` 滚动时置顶，实色背景防透出下层行。考虑到 pagedList 每页 50 条 + 环形上限 300 条，全部渲染后无虚拟滚动负担。

### 5. 复制按钮

每条日志头部右侧新增 `mdi:content-copy` 图标按钮（仅 hover 显示，降低视觉噪声）。点击将 `[HH:mm] 项目名 — 摘要` 写入剪贴板，图标切换为 `mdi:check`（绿色）2 秒后还原。使用项目已有的 `copyToClipboard` 工具函数。

### 6. 条目详情弹窗

点击日志条目行（非项目名/复制按钮区域）弹出 Modal，展示完整操作信息：

- **头部**：操作类型徽章（PUSH/PULL/COMMIT）+ 项目名（可点击跳转列表视图）+ 状态指示
- **元信息区**：时间、操作类型、整体状态（成功/失败）
- **摘要区**：完整 summary 文本（可换行，不截断）
- **平台明细区**（push/pull）：逐平台结果表格（平台名 + 状态 ✓/✗/— + 摘要），不再需要手动展开
- **提交信息区**（commit）：完整 message 文本
- **底部**：关闭按钮

弹窗复用 `ProjectLineDetail.vue` 的成熟模式：`Teleport` to body + `Transition gp-dialog-fade` + mask 点击关闭 + X 按钮 + `useDialogKeyboard` ESC 关闭。弹窗打开时 `overflow: hidden` 锁定背景滚动。

## 技术方案

### 技术栈

- Vue 3 Composition API + TypeScript
- SCSS（Codex 设计 Token 体系）
- 无新增依赖

### 实现策略

所有改动集中在 `LogPanel.vue`（模板 + script）和 `LogPanel.scss`（样式），遵循"组件自包含 + 样式独立文件"的项目规范。由于 LogPanel 当前 214 行，6 项新增后预计约 400 行，仍在 500 行硬阈值内，**无需拆分子组件**。

**数据过滤链路**：`logs` prop → 3 层顺序 computed 过滤（项目搜索 → 操作类型 → 仅失败）→ `usePagedList` 分页 → 日期分组渲染。每层过滤都是 O(n) 遍历，300 条上限下性能无瓶颈。

**日期分组算法**：在 `pagedLogs` computed 之上再加工一个 `groupedLogs` computed，生成 `Array<{ dateKey: string, dateLabel: string, entries: GitOpLogEntry[] }>`，模板用嵌套 `v-for` 渲染。

**弹窗数据流**：弹窗组件 `LogDetailDialog.vue`（新建）接收完整 `GitOpLogEntry` 对象作为 prop，纯展示无状态修改。弹窗通过 `v-if` 控制挂载/卸载，关闭后零残留。

### 目录结构

```
src/features/gitPush/
├── components/log/
│   ├── LogPanel.vue              # [MODIFY] 主面板：新增统计条、筛选、搜索、日期分组、复制、弹窗挂载
│   └── LogDetailDialog.vue       # [NEW] 条目详情弹窗：Teleport 模态框，展示完整操作信息
├── styles/
│   ├── LogPanel.scss             # [MODIFY] 新增统计条、搜索框、日期分组、复制按钮样式
│   └── LogDetailDialog.scss      # [NEW] 详情弹窗样式（Codex 规范）
├── config/
│   └── icons.ts                  # [MODIFY] COMMON_ICONS 新增 alertCircleOutline
└── i18n/
    ├── zh_CN/gitPush.json        # [MODIFY] 新增约 14 个翻译键
    └── en_US/gitPush.json        # [MODIFY] 新增约 14 个翻译键
```

### 关键数据结构

日志分组渲染用的中间类型（组件内部定义，不导出）：

```typescript
interface LogDateGroup {
  dateKey: string       // "2026-08-12" 用于唯一标识
  dateLabel: string     // "今天" / "昨天" / "2026-08-12"
  entries: GitOpLogEntry[]
}
```

### 实现要点

**性能**：300 条日志 + 3 层过滤 + 日期分组 + 分页均在 `computed` 中惰性求值，无重复遍历。搜索使用 `toLowerCase().includes()` 简单匹配，300 条下无性能问题。

**防闪烁**：筛选/搜索切换时 `pagedLogs` 变化，`usePagedList` 未做 reset 会导致新过滤结果可能为空但 `visibleCount` 未重置。需在 `activeFilter`/`failOnly`/`searchQuery` 变化时调用 `pagedReset()` 重置分页到首页。

**日期 sticky**：分组标题 `position: sticky; top: 0` 在 `.gp-log-panel`（`overflow-y: auto`）容器内生效。需要 `z-index: 1` + `background: var(--b3-theme-background)` 遮挡上滚的条目行。

**弹窗背景锁定**：弹窗打开时设置 `document.body.style.overflow = "hidden"`，关闭/卸载时还原。使用 `onMounted`/`onUnmounted` 生命周期管理。

**图标注册**：`mdi:content-copy` 和 `mdi:magnify` 已在 `COMMON_ICONS` 中注册。仅需新增 `mdi:alert-circle-outline`（已确认存在于 mdi.json icons 段，非 aliases）。

## Agent Extensions

### Skill

- **codex-ui-style-guide**
- 用途：确保新增的 LogDetailDialog.scss 和 LogPanel.scss 修改部分完全符合 Codex 设计规范（Token 优先、border 非 box-shadow、0.12s 过渡、$vp-mono 等宽字体、禁用硬编码尺寸）
- 预期结果：所有新建/修改的 SCSS 代码通过 Codex 规范审查，无违规项