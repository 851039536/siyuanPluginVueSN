---
name: quicknote-reset-tool-and-minimize-position
overview: 将速记恢复按钮从状态栏迁移到工具合集（新增「速记恢复」工具 Tab），并修复速记弹窗自定义拖拽后最小化时小条不贴最左侧的问题。
design:
  architecture:
    framework: vue
  styleKeywords:
    - Minimalism
    - Codex
    - Border-based layering
  fontSystem:
    fontFamily: PingFang SC
    heading:
      size: 12px
      weight: 600
    subheading:
      size: 12px
      weight: 400
    body:
      size: 12px
      weight: 400
  colorSystem:
    primary:
      - "#F59E0B"
      - "#16A34A"
    background:
      - "#FFFFFF"
      - "#F5F5F5"
    text:
      - "#212121"
    functional:
      - "#D97706"
      - "#16A34A"
todos:
  - id: fix-minimize-position
    content: 修复 quickNote/index.ts applyMinimized() minimized 分支 custom 定位：清除 absolute 残留并贴左边缘，保留展开还原
    status: completed
  - id: create-reset-tool
    content: 新建 toolCollection/tools/quickNoteReset/ 工具组件与样式（含 i18n 分片、registry.ts 注册），使用 [skill:codex-ui-style-guide] 校验样式合规
    status: completed
  - id: remove-statusbar-button
    content: 从 statusBar/index.vue 与 styles/index.scss 移除恢复按钮相关代码，删除 quickNote.json 的 reset 键
    status: completed
  - id: sync-docs
    content: 更新 toolCollection/quickNote 两份 README（工具清单与恢复入口链路），并追加工作记忆
    status: completed
    dependencies:
      - create-reset-tool
      - remove-statusbar-button
---

## 产品概述

两个需求：

1. **恢复按钮迁移到工具合集**：将速记弹窗的「恢复默认位置」兜底按钮从状态栏移除，迁移到工具合集（toolCollection）底部面板中，作为独立工具 Tab。用户打开工具合集 → 切换到「速记恢复」Tab → 点击恢复按钮，即可将卡死的速记弹窗一键复位为居中展开态。

2. **修复最小化小条位置 bug**：速记弹窗被拖到自定义位置（如最右侧）后，展开态下点击最小化，小条仍停留在最右侧拖拽坐标处，而非用户期望的最左边。修复后：自定义位置下最小化时，小条以横条形态贴最左边缘、垂直居中；展开时仍回到原拖拽坐标。

## 核心功能

- 工具合集新增「速记恢复」工具：显示标题 + 说明文案 + 恢复按钮，点击后派发 `resetQuickNote` 事件（App.vue 既有监听调用 `plugin.__quickNote?.reset()`），按钮带「已恢复」短暂反馈
- 状态栏彻底移除恢复按钮：模板、computed、事件处理函数、专用样式、i18n `reset` 键全部清理（`quickNoteI18n` 常量保留，FEATURES quickNote 条目仍在用）
- 最小化小条定位修复：`applyMinimized()` minimized 分支在 `position === "custom"` 时清除容器 absolute 定位内联样式，回归遮罩 flex 流并左对齐贴边
- 保留 App.vue `resetQuickNote` 监听（工具合集派发同一事件，零新增事件）

## 技术栈

沿用项目现有技术栈：Vue 3 + TypeScript + Vite 思源笔记插件。无新增依赖。工具组件走 toolCollection 既有注册机制（registry.ts 集中注册），跨 feature 通信走 `emitCustomEvent` + App.vue 调度，最小化修复在 quickNote Manager 内完成。

## 实现方案

### 一、最小化小条位置修复（src/features/quickNote/index.ts）

在 `applyMinimized()` 的 `minimized` 分支中追加 custom 定位处理：

- 根因：拖拽后 `position === "custom"`，容器处于 `position: absolute; left: customX; top: customY`（customX 约等于视口宽 - 624px），最小化只改容器尺寸为 auto，小条跟随 left 停留在最右
- 修复：当 `this.position === "custom"` 时，清除 `container.style.position/left/top`（回归遮罩 flex 流），设置 `mask.style.alignItems = "center"`、`justifyContent = "flex-start"`、`padding = EDGE_PADDING`（8px，与 left 预设贴边档一致），小条即贴最左边缘垂直居中
- customX/customY 缓存保留不动；展开分支（else）已调用 `applyPosition()`，custom 模式下会用缓存坐标 + clamp 重新设置 absolute 定位，展开位置不受影响，无需改动
- 预设位置（center/top/bottom/left/right）最小化不受影响（mask 对齐已由 applyPosition 设置）

### 二、工具合集新增「速记恢复」工具

按 toolCollection「注册新工具」标准流程（4 步）：

1. 新建 `src/features/toolCollection/tools/quickNoteReset/index.vue` + `styles/index.scss`

- Props 统一为 `{ plugin: Plugin, i18n: Record<string, any> }`（与 colorPicker 等工具一致）
- 内容：标题（`i18n.quickNoteReset?.title`）+ 说明文案（`description`）+ 恢复按钮（`reset`），点击 `emitCustomEvent("resetQuickNote")` 并短暂显示「已恢复」（`done`）反馈 2 秒
- 样式遵循 Codex 规范：独立 .scss、`@use '@/variables.scss' as *`、$spacing- */ $font-size-* / $vp-radius / $radius- */ $font-weight-* Token、`var(--b3-*)` 主题色、边框代替阴影、transition 0.12s、文件头注释

2. 新建 i18n 分片 `src/i18n/{zh_CN,en_US}/quickNoteReset.json`（title/description/reset/done 四键，中英对齐）
3. `registry.ts` 添加 import + TOOL_REGISTRY 条目（id: "quickNoteReset"，icon: "ph:arrow-counter-clockwise"）+ TOOL_LABEL_KEYS 映射
4. 运行 `pnpm i18n:verify` 验证（由用户执行）

### 三、状态栏恢复按钮移除（清理）

- `src/features/statusBar/index.vue`：删除模板 MonitorItem 恢复按钮块、`quickNoteResetTitle` computed、`handleResetQuickNote` 函数（保留 `quickNoteI18n` 常量，L344 FEATURES quickNote 条目仍引用）
- `src/features/statusBar/styles/index.scss`：删除 `.quick-note-reset-item` 样式块
- `src/i18n/{zh_CN,en_US}/quickNote.json`：删除 `reset` 键（已确认仅状态栏引用，工具合集用独立分片 quickNoteReset.json 承载文案）

### 四、文档同步

- `toolCollection/README.md`：已集成工具表格新增「速记恢复」行
- `quickNote/README.md`：「恢复兜底」小节与联动链路更新——入口从状态栏改为工具合集工具，链路改为 toolCollection quickNoteReset 工具 → emitCustomEvent("resetQuickNote") → App.vue → reset()
- 工作记忆：今日记忆文件追加本次变更记录

## 性能与可靠性

- 最小化修复仅 4 行内联样式赋值，无遍历无额外开销；与现有 applyPosition/applyMinimized 模式完全一致
- 工具组件点击派发事件走既有事件总线，App.vue 可选链短路，`__quickNote` 未初始化时无副作用
- 迁移后事件链路唯一（resetQuickNote），无重复监听

## 避免技术债

- 完全复用 toolCollection 既有注册机制与工具组件 Props 约定，不新增模式
- 复用 quickNote 现有 reset()/applyPosition()/applyMinimized()，不复制定位逻辑
- 状态栏清理彻底，无死代码残留

## 设计风格

工具合集「速记恢复」工具采用 Codex 极简风格，与 colorPicker 等既有工具保持视觉一致：白色卡片布局、边框分层、等宽/无衬线字体、克制的警示色点缀。

## 页面规划

工具内容为单个功能块，自上而下：

- 标题行：工具图标 + 名称（速记恢复），辅助文字级样式
- 说明卡：边框卡片，描述功能用途（弹窗卡死/位置异常时一键复位为居中展开态）
- 操作区：居中「恢复默认位置」按钮（警示色边框 + hover 填充），点击后按钮短暂切换为「已恢复」状态（2 秒，绿色反馈），随后复原

## 交互

- 按钮 hover 0.12s 过渡（边框/背景色变化），点击即时反馈
- 「已恢复」状态用成功色 + 对勾语义，视觉区分于默认警示色

## Agent Extensions

### Skill

- **codex-ui-style-guide**
- 用途：新建 quickNoteReset 工具组件的 SCSS 样式时，确保遵循 Codex UI 规范（设计 Token、边框代替阴影、禁止硬编码尺寸/色值、0.12s 过渡）
- 预期产出：`tools/quickNoteReset/styles/index.scss` 通过 Codex 规范审查，与 colorPicker 等既有工具样式体系一致