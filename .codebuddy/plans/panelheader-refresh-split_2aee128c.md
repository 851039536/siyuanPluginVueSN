---
name: panelheader-refresh-split
overview: 将 PanelHeader 的单一刷新按钮改为下拉菜单，分离「本地状态刷新」「远程状态刷新」「全部刷新」三个选项，让用户按需选择，避免每次都执行最耗时的 fetch 操作。
todos:
  - id: add-i18n-keys
    content: 在 zh_CN/en_US gitPush.json 中新增 headerRefreshLocal、headerRefreshRemote 翻译键
    status: completed
  - id: update-index-vue
    content: 在 index.vue 中新增 refreshingAllLocal/refreshingAllRemote/showRefreshMenu ref，实现 handleRefreshAllLocal/Remote 两个 handler，绑定 v-model:showRefreshMenu 并扩展 closeIdeMenuOnOutside
    status: completed
  - id: refactor-panelheader
    content: 改造 PanelHeader.vue：单一刷新按钮→下拉菜单（gp-header-refresh-wrap + 3个菜单项），新增 showRefreshMenu prop 和相关 emit，gp-spin 动画根据 refreshingAllLocal/Remote/refreshingAll 综合显示
    status: completed
    dependencies:
      - update-index-vue
  - id: add-styles
    content: 在 PanelHeader.scss 中新增 .gp-header-refresh-wrap / .gp-refresh-popover / .gp-refresh-item 样式，复用 popover-base/popover-item mixins
    status: completed
    dependencies:
      - refactor-panelheader
  - id: verify-all
    content: 运行 tsc --noEmit + eslint + i18n:verify 验证无错误，确认透传链路完整
    status: completed
    dependencies:
      - add-styles
---

## 用户需求

将 PanelHeader 头部的单一刷新按钮改为下拉菜单，提供多个刷新选项，让用户可以选择性地触发刷新，避免不必要执行耗时的远程 git fetch 操作。

## 核心功能

- **下拉菜单入口**：点击刷新图标展开菜单，替代原来的单一点击触发
- **刷新本地状态（快）**：仅刷新 pushStatus + workingTree，不加 git fetch，与当前 silentRefreshAll 一致
- **刷新远程状态（慢）**：对当前分类下所有项目执行 git fetch + pushStatus 更新，含网络请求
- **全部刷新（本地+远程）**：先刷新本地状态，再刷新远程状态，覆盖完整
- 下拉菜单按钮在任意操作进行中时显示旋转动画，各菜单项选中时显示 loading 图标

## 技术方案

### 实现策略

复用 PanelHeader 中已有的 `showAddMenu` / `showPlatformMenu` 下拉菜单模式：`position: relative` 容器 + `popover-base` mixin 弹出层 + `popover-item` mixin 菜单项。通过 `v-model:showRefreshMenu` 双向绑定控制开关状态，在 `closeIdeMenuOnOutside` 中添加关闭逻辑。

### 关键决策

**操作粒度的拆分**

- **handleRefreshAllLocal**: 直接调用现有 `silentRefreshAll(true)`，不修改其内部逻辑。这是当前默认行为（本地状态，不含 fetch），速度最快，适合日常快速查看工作区变更
- **handleRefreshAllRemote**: 遍历当前分类下的项目，每个项目调用 `fetchAllRemotes(id)`（composable 已有此函数），执行 `manager.fetchAllForProject(id)` + `loadPushStatus(id)`。包含 git fetch 网络请求，较慢
- **handleRefreshAll**: 依次调用 `handleRefreshAllLocal()` → `handleRefreshAllRemote()`，覆盖全部更新

**loading 状态分离**

- `refreshingAllLocal` / `refreshingAllRemote` 两个独立 ref，避免互相干扰
- 下拉按钮的 `gp-spin` 动画在任一 loading 为 true 时显示（computed `isRefreshingHeader`）
- 下拉菜单内的菜单项各自显示对应的 loading 图标

**向后兼容**

- 保留 `refreshingAll` prop，用于"全部刷新"loading 状态
- 保留 `refreshAll` emit 用于下拉菜单中的全部刷新选项
- 新增事件不影响外部已有的 `@refresh-all` 绑定

### 实现要点

**closeIdeMenuOnOutside 扩展**
在已有的四处关闭判断中新增：

```ts
if (target && !target.closest(".gp-header-refresh-wrap")) {
  showRefreshMenu.value = false
}
```

**防抖控制**

- `handleRefreshAllLocal` 和 `handleRefreshAllRemote` 各自使用独立防抖冷却（500ms），防止用户重复点击
- `handleRefreshAll` 内部调用两个子 handler，共用冷却逻辑

### 涉及文件

```
src/features/gitPush/
├── components/
│   └── PanelHeader.vue          # [MODIFY] 刷新按钮→下拉菜单UI
├── styles/
│   └── PanelHeader.scss         # [MODIFY] 新增下拉菜单样式
├── index.vue                    # [MODIFY] 新增handler/loading/ref
src/i18n/
├── zh_CN/gitPush.json           # [MODIFY] 新增2个翻译键
└── en_US/gitPush.json           # [MODIFY] 新增2个翻译键
```