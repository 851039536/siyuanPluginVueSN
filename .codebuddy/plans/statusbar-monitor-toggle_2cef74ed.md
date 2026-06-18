---
name: statusbar-monitor-toggle
overview: 为状态栏 6 个监控项（文档数/总字数/今日活动/CPU/内存/运行时间）添加独立的显示/隐藏开关，在功能抽屉中与现有功能快捷方式一起管理。
todos:
  - id: add-monitor-i18n
    content: 在 statusBar 的 i18n 文件中新增 6 个监控项标题键（zh_CN 和 en_US），并运行 pnpm i18n:verify
    status: completed
  - id: add-monitor-features
    content: 在 index.vue 的 FEATURES 数组中新增 6 个监控项注册条目（pinnable:true，无 shortcut/action）
    status: completed
    dependencies:
      - add-monitor-i18n
  - id: add-visibility-logic
    content: 在 index.vue 中新增 visibleMonitors 响应式状态、MONITOR_IDS 常量和 handleToggleStatusBar 分流逻辑
    status: completed
    dependencies:
      - add-monitor-features
  - id: add-template-vif
    content: 在 index.vue 模板中为每个 MonitorItem 添加 v-if 条件渲染，绑定 visibleMonitors
    status: completed
    dependencies:
      - add-visibility-logic
  - id: add-persistence
    content: 在 index.vue 中新增 PluginStorage load/save 逻辑，启动时加载 statusBar-monitors，变更时持久化
    status: completed
    dependencies:
      - add-visibility-logic
  - id: verify-build
    content: 运行 pnpm build 验证构建通过，确认无 TS 错误和 SCSS 警告
    status: completed
    dependencies:
      - add-template-vif
      - add-persistence
---

## 用户需求

为思源笔记插件的状态栏监控项增加独立显隐控制能力，用户可在功能抽屉中自由组合显示哪些监控数据。

## 核心功能

- **6 个监控项独立开关**：文档数、总字数、今日活动、CPU、内存、运行时间各自独立控制显隐
- **功能抽屉中管理**：每个监控项在功能抽屉（功能列表）中显示为可 pin 的条目，点击图钉图标即可切换显示/隐藏
- **持久化保存**：用户的显隐偏好持久化到 PluginStorage，重启思源笔记后保持
- **默认可见**：所有监控项默认全部显示，保持与现有行为一致
- **全局开关不受影响**：`state.showMonitor` 作为全局主开关继续生效，所有监控项仅在主开关开启时可见

## 技术栈

- Vue 3 (Composition API + `<script setup>`) + TypeScript
- 思源笔记插件框架 (`siyuan` Plugin API)
- `@iconify/vue` 图标
- SCSS (分离到 `styles/` 目录)
- `PluginStorage` 持久化

## 实现方案

### 总体思路

将 6 个监控项注册到功能抽屉的 FEATURES 注册表中，复用现有 `FeatureDrawer` 的 pin 交互机制。每个监控项设置 `pinnable: true`，在抽屉中可点击图钉图标切换显示；模板中每个 `MonitorItem` 增加 `v-if` 条件渲染；偏好存储到独立的 PluginStorage 键 `statusBar-monitors`。

### 关键设计决策

1. **复用而非新建**：复用 FeatureDrawer 现有 pin 交互（图钉图标 + toggleStatusBar 事件），不改动 FeatureDrawer 组件本身。
2. **独立存储**：新建 `statusBar-monitors` 存储键，与已有的 `statusBar-shortcuts` 分离，避免两类数据混淆。
3. **handleToggleStatusBar 分流**：根据 id 前缀判断是监控项还是快捷方式，分别写入不同存储键。
4. **默认全开**：首次加载时 `statusBar-monitors` 为空，回退到全显（与当前行为一致）。

### 涉及的文件

| 文件 | 操作 | 说明 |
| --- | --- | --- |
| `src/features/statusBar/index.vue` | 修改 | 核心变更：FEATURES 数组新增 6 个监控项、模板 MonitorItem 加 v-if、handleToggleStatusBar 分流处理、加载/保存 monitor 偏好 |
| `src/features/statusBar/styles/index.scss` | 无需修改 | 监控项样式不受影响 |
| `src/features/statusBar/components/FeatureDrawer.vue` | 无需修改 | 已支持 pinnable 项 |
| `src/features/statusBar/components/MonitorItem.vue` | 无需修改 | 纯展示组件 |
| `src/i18n/zh_CN/statusBar.json` | 修改 | 新增监控项标题的 i18n 键 |
| `src/i18n/en_US/statusBar.json` | 修改 | 新增监控项标题的 i18n 键 |


### 数据流

```
用户点击图钉 → FeatureDrawer emit('toggleStatusBar', id)
→ index.vue handleToggleStatusBar(id)
→ 判断 id 是否为监控项（monitorIds.has(id)）
→ toggleMembership(monitorVisible, id)
→ storage.save("statusBar-monitors", monitorVisible)
→ 模板 v-if="monitorVisible(id)" 响应式更新
```

## 实现细节

### 监控项注册条目（添加到 FEATURES 数组）

每个监控项仅需 `id / icon / color / title / pinnable: true`，不需要 `shortcut` 和 `action`：

```
{ id: "monitor-notes",   icon: "ph:file-text",      color, title, pinnable: true }
{ id: "monitor-words",   icon: "ph:text-aa",         color, title, pinnable: true }
{ id: "monitor-today",   icon: "ph:chart-line-up",   color, title, pinnable: true }
{ id: "monitor-cpu",     icon: "ph:cpu",             color, title, pinnable: true }
{ id: "monitor-memory",  icon: "ph:memory",          color, title, pinnable: true }
{ id: "monitor-uptime",  icon: "ph:timer",           color, title, pinnable: true }
```

### Template 变更

每个 MonitorItem 增加 `v-if`：

```html
<MonitorItem v-if="visibleMonitors.has('monitor-notes')" ...>{{ totalNotesDisplay }}</MonitorItem>
<MonitorItem v-if="visibleMonitors.has('monitor-words')" ...>{{ totalWordsDisplay }}</MonitorItem>
```

### 持久化

- 键：`statusBar-monitors`
- 值：`string[]`（启用的监控项 ID 列表）
- 默认：空数组表示全显（`visibleMonitors` 初始化时若存储为空则设为全部 6 个 ID）

### handleToggleStatusBar 分流

```ts
const MONITOR_IDS = new Set(["monitor-notes", ..., "monitor-uptime"])

const handleToggleStatusBar = async (id: string) => {
  if (MONITOR_IDS.has(id)) {
    visibleMonitors.value = toggleMembership(visibleMonitors, id)
    await storage.save("statusBar-monitors", visibleMonitors.value)
  } else {
    // 原有快捷方式逻辑
    statusBarShortcuts.value = toggleMembership(statusBarShortcuts, id)
    await storage.save("statusBar-shortcuts", statusBarShortcuts.value)
  }
}
```

## Agent Extensions

### SubAgent

- **code-explorer**
- Purpose：验证 `PluginStorage` API 签名和 FeatureDrawer 组件接口，确保 plan 中引用的属性/事件与实际代码一致
- Expected outcome：确认 `storage.save/load` 异步返回类型、`FeatureDrawerItem` 接口属性、emit 事件名称无误