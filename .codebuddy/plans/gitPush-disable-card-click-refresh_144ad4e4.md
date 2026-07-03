---
name: gitPush-disable-card-click-refresh
overview: 取消点击项目列表卡片时自动触发的 git 刷新操作，保留手动 Fetch 按钮和全局刷新按钮。
todos:
  - id: comment-out-handle-refresh
    content: 在 index.vue 的 handleCardClick 函数中注释掉 handleRefresh(projectId) 调用
    status: completed
---

## 用户需求

禁用点击项目卡片空白区域时自动执行的 git 刷新操作。

## 问题背景

当前点击项目列表卡片空白区域会通过 `handleCardClick` → `handleRefresh` 串联执行大量 git 操作（refreshRemotes + fetch push status + load working tree + commit log + branches + stash），用户不希望点击卡片时自动触发这些耗时的后台操作。

## 修改范围

仅修改 `handleCardClick` 函数（`index.vue` L1342-1352），注释掉对 `handleRefresh(projectId)` 的调用。保留防抖缓存逻辑（`lastRefreshTime`、`refreshing` 检查）以便后续可能复用。

其他全部手动触发的 git 操作入口不受影响：Fetch 按钮、刷新全部按钮、分类 TAB 切换、首屏加载、WorkingTree 面板展开。

## 技术方案

### 修改文件

单文件修改：`src/features/gitPush/index.vue`

### 修改内容

将 `handleCardClick` 函数中第 1351 行的 `handleRefresh(projectId)` 调用注释掉，保留完整的防抖逻辑框架，以防后续需要恢复此功能时只需取消注释即可。

### 修改前（L1341-1352）

```typescript
/** 卡片点击：排除交互元素后，轻量刷新 git 状态 */
function handleCardClick(projectId: string, event: MouseEvent) {
  const target = event.target as HTMLElement
  // 点击按钮/输入框/选择框/标签/IDE 弹窗时不触发刷新
  if (target.closest("button, input, select, textarea, .gp-ide-popover, .gp-card-name, .gp-card-name-input")) return
  // 防抖：正在刷新或冷却期内跳过
  if (refreshing.value === projectId) return
  const lastTime = lastRefreshTime.get(projectId)
  if (lastTime && Date.now() - lastTime < REFRESH_COOLDOWN_MS) return
  lastRefreshTime.set(projectId, Date.now())
  handleRefresh(projectId)
}
```

### 修改后

```typescript
/** 卡片点击：排除交互元素后，轻量刷新 git 状态 */
function handleCardClick(projectId: string, event: MouseEvent) {
  const target = event.target as HTMLElement
  // 点击按钮/输入框/选择框/标签/IDE 弹窗时不触发刷新
  if (target.closest("button, input, select, textarea, .gp-ide-popover, .gp-card-name, .gp-card-name-input")) return
  // 防抖：正在刷新或冷却期内跳过
  if (refreshing.value === projectId) return
  const lastTime = lastRefreshTime.get(projectId)
  if (lastTime && Date.now() - lastTime < REFRESH_COOLDOWN_MS) return
  lastRefreshTime.set(projectId, Date.now())
  // 已禁用点击卡片自动刷新 git 状态，用户需通过 Fetch/刷新全部按钮手动触发
  // handleRefresh(projectId)
}
```

### 影响分析

- 不影响所有手动触发的 git 操作入口
- 不影响 `@click` 事件绑定本身（仍用于排除交互元素、防抖记录）
- 不影响 `handleRefresh` 函数（仍被其他地方调用）