---
name: quicknote-reset-button
overview: 为 quickNote 速记弹窗新增"恢复"兜底按钮：新增 QuickNoteManager.reset() 方法（清除弹窗遮罩/容器上全部 Manager 写入的内联样式残留、重置定位为居中、退出最小化、重新应用并持久化），并在状态栏添加恢复按钮（点击派发 resetQuickNote 事件 → App.vue 调度调用 reset()），解决弹窗被拖到顶部后点击无反应无法拖动时的自救问题。
todos:
  - id: add-reset-method
    content: 在 quickNote/index.ts 的 QuickNoteManager 中新增 reset() 方法，重置位置/坐标/最小化状态并持久化后 open() 应用
    status: completed
  - id: add-statusbar-button
    content: 在 statusBar/index.vue 添加恢复按钮并派发 resetQuickNote 事件，styles/index.scss 新增样式，使用 [skill:codex-ui-style-guide] 校验样式合规
    status: completed
    dependencies:
      - add-reset-method
  - id: add-app-listener
    content: 在 App.vue onMounted 注册 resetQuickNote 事件监听，调用 plugin.__quickNote?.reset()
    status: completed
    dependencies:
      - add-statusbar-button
  - id: add-i18n-keys
    content: 在 zh_CN/en_US quickNote.json 分片新增 reset 翻译键
    status: completed
  - id: sync-docs
    content: 更新 quickNote README.md 补充恢复按钮说明，并同步工作记忆文件
    status: completed
    dependencies:
      - add-reset-method
---

## 用户需求

quickNote 速记弹窗被拖到顶部后出现点击无反应、无法拖拽移动的问题。不再排查根因，改为新增一个**恢复（兜底）按钮**，当弹窗卡死/位置异常时，用户可一键将弹窗复位为默认状态（居中、展开、可交互）。

## 产品概述

- 在状态栏速记入口附近新增一个独立的"恢复"图标按钮（独立于弹窗，弹窗卡死时依然可点击）
- 点击后：弹窗位置恢复为居中、清除自定义坐标与最小化状态、确保弹窗可见且可交互

## 核心功能

- QuickNoteManager 新增 `reset()` 方法：重置 `position="center"`、`customX/customY=0`、`minimized=false`，持久化后调用 `open()` 重新应用定位与最小化状态（`open()` 内部已有 `applyPosition()` + `applyMinimized()`）
- 状态栏新增恢复按钮：仅在 quickNote 功能启用时显示，点击派发 `resetQuickNote` 自定义事件
- App.vue 监听 `resetQuickNote` 事件，调用 `plugin.__quickNote?.reset()`
- i18n 新增 `reset` 翻译键（中/英），作为按钮 tooltip

## 技术栈

沿用项目现有技术栈：Vue 3 + TypeScript + Vite 思源笔记插件，无新增依赖。事件走 `emitCustomEvent` 统一入口，样式走状态栏独立 SCSS + 设计 Token。

## 实现方案

### 核心逻辑（src/features/quickNote/index.ts）

在 `QuickNoteManager` 中新增公开方法 `reset()`，复用现有 `open()` 的应用链路，保证幂等：

```
reset()
  ├─ position = "center"（清除自定义坐标与预设残留）
  ├─ customX = 0, customY = 0
  ├─ minimized = false（取消最小化，还原遮罩与容器尺寸）
  ├─ await persistSettings()（持久化，重启后保持复位状态）
  └─ this.open()（内部依次 modal.open → applyPosition → applyMinimized）
```

关键点：

- `applyPosition()` 的 center 分支会清除容器 `position:absolute/left/top` 残留并还原遮罩 `align-items/justify-content:center`、`padding:0`，彻底解决"卡在顶部"的定位问题
- `applyMinimized()` 的展开分支会还原 `mask.pointerEvents="auto"`、`mask.background` 与容器尺寸 `624px/70vh`，解决"点击没反应"的遮罩交互问题
- `open()` 在 persistent 模式下无论弹窗当前可见与否都会重新应用状态，幂等安全；弹窗从未打开过时也会创建 DOM 后正常显示

### 入口链路（状态栏按钮 → 事件 → Manager）

```
状态栏恢复按钮（MonitorItem）
  └─ emitCustomEvent("resetQuickNote")          // statusBar/index.vue
       └─ App.vue onMounted 监听 resetQuickNote  // 仿照 toggleQuickNote 模式
            └─ pluginInstance.__quickNote?.reset()
```

- 状态栏按钮使用现有 `MonitorItem` 组件（props：icon/title/itemClass，点击 emit click），图标直接传 Iconify 字符串（如 `ph:arrow-counter-clockwise`），无需注册 FEATURE_ICONS
- `v-if="isFeatureEnabled('quickNote')"` 控制显隐，与功能开关联动；`isFeatureEnabled` 已基于响应式 `enabledSettings`，用 `computed` 包裹即可响应开关变更

### 性能与可靠性

- reset() 仅 4 次字段赋值 + 1 次异步存储 + 1 次 DOM 样式应用，无遍历、无额外开销
- 事件链路与现有 `toggleQuickNote` 完全同构，零新增模式
- 按钮点击失败无副作用（`__quickNote` 未初始化时可选链短路）

### 避免技术债

- 完全复用现有 applyPosition/applyMinimized/open/persistSettings 方法，不复制定位逻辑
- 事件名 `resetQuickNote` 遵循 camelCase 动词短语规范，在 eventBus 中唯一
- 不新增组件文件（按钮仅数行模板），符合"薄壳包装禁止拆分"的模块提取判定标准

## 目录结构

```
src/features/quickNote/index.ts              # [MODIFY] 新增 reset() 公开方法（重置位置/坐标/最小化 + 持久化 + open 应用）
src/features/statusBar/index.vue             # [MODIFY] 模板新增恢复按钮（quickNote 启用时显示）+ script 新增 handleResetQuickNote 与 quickNoteEnabled computed
src/features/statusBar/styles/index.scss     # [MODIFY] 新增 .quick-note-reset-item 颜色样式（复用 .action-item 通用 hover）
src/App.vue                                  # [MODIFY] onMounted 新增 window.addEventListener("resetQuickNote", ...) 监听
src/i18n/zh_CN/quickNote.json                # [MODIFY] 新增 "reset": "恢复默认位置"
src/i18n/en_US/quickNote.json                # [MODIFY] 新增 "reset": "Reset position"
src/features/quickNote/README.md             # [MODIFY] 补充恢复按钮功能说明
```

## 实施注意

- i18n 仅改分片文件，顶层 `zh_CN.json`/`en_US.json` 由 `pnpm i18n:merge` 自动生成，禁止手改
- SCSS 使用设计 Token（颜色用 `var(--b3-theme-warning)` 等主题变量），禁止硬编码色值
- 事件名与 `toggleQuickNote` 并列注册在 App.vue 同一 onMounted 区块，保持调度集中
- 修改完成后由用户自行执行验证：`pnpm i18n:verify`、`npx tsc --noEmit`、`pnpm lint`

## Agent Extensions

### Skill

- **codex-ui-style-guide**
- 用途：新增状态栏恢复按钮的 SCSS 样式时，确保遵循 Codex UI 风格（设计 Token、边框代替阴影、禁止硬编码尺寸/色值）
- 预期产出：`.quick-note-reset-item` 样式通过 Codex 规范审查，与现有 `.action-item` 体系一致