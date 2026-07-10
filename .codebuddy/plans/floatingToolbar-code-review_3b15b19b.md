---
name: floatingToolbar-code-review
overview: 对 floatingToolbar 模块进行深度代码审查与优化：修复逻辑缺陷（重复触发翻译、锁竞争）、消除冗余代码（HeatmapMarker 清除逻辑重复、cleanupAllToolbars 与 destroy 重复）、性能优化（每帧 mouseup 触发全量闪卡查询）、以及修正 10+ 处编码规范违规（box-shadow、硬编码字体/间距、违规的工具函数调用）。
todos:
  - id: fix-logic-flaws
    content: 修复 3 处逻辑缺陷：FloatingToolbar.ts 双重检查与事件监听器注释、HeatmapMarker.ts isMarking 冗余、PronunciationDialog.vue watcher 双重触发
    status: completed
  - id: fix-performance
    content: 优化 3 处性能瓶颈：单词本高频 I/O 增加 Set 缓存、移除 TextNode 数组收集、queryFromLocalStorage 利用缓存
    status: completed
  - id: merge-redundant-code
    content: 合并 3 处冗余代码：HeatmapMarker clearMarks 提取公共 unwrap 函数、destroy 复用 cleanupAllToolbars、移除双重 isProcessing 守卫
    status: completed
  - id: fix-ts-norm-violations
    content: 修复 5 处编码规范违规：PronunciationDialog/QRCodeDialog 改用 copyToClipboard、showMessage 封装、triggerBlobDownload、index.ts 移除 any 绕过类型检查
    status: completed
  - id: fix-scss-norm-violations
    content: 修复 SCSS 规范违规：_mixins.scss 硬编码替换为全局 Token、移除所有 box-shadow 和 $shadow-* 变量、qrcode.scss footer 复用 mixin、pronunciation/qrcode 移除阴影引用
    status: completed
---

## 产品概述

对 floatingToolbar（浮动工具栏）模块进行深度代码审查与重构，共覆盖 14 个文件（7 个 TS、2 个 Vue、5 个 SCSS），修复全部 18 处问题：3 处逻辑缺陷、3 处性能瓶颈、3 处冗余代码、10+ 处编码规范违规。所有修改严格保证现有业务逻辑不受影响，完全符合 AGENTS.md/CODEBUDDY.md 编码规范（包括全局设计 Token、统一入口原则、禁止 box-shadow、SCSS 命名规则等）。

## 核心任务

### 逻辑缺陷修复（3 项）

- 移除 FloatingToolbar.ts 中对 `data-custom-buttons-added` 的双重检查冗余，并修正按钮 click 事件的 `{ once: false }` 自相矛盾问题
- 移除 HeatmapMarker.ts 中冗余的 `isMarking` 标志，统一为 `isScanning` 防并发
- 修复 PronunciationDialog.vue 两个 watcher 重复触发 `generatePronunciation()` 导致多次 AI 调用的问题

### 性能优化（3 项）

- 为 `checkAndHighlightWordInNotebook()` 增加单词集合缓存（`Set<string>`），避免每次 mouseup 都全量 I/O 读取
- 移除 `scanDocument()` 中不必要的 TextNode 数组收集步骤，改为直接边遍历边标记
- 为 `queryFromLocalStorage()` 增加按 title 直接查询的能力或利用现有缓存

### 冗余代码合并（3 项）

- 提取 `HeatmapMarker` 中 `clearDocumentMarks()` 和 `clearAllMarks()` 的公共逻辑为 `unwrapMarkNodes()`，并批量 normalize
- 让 `destroy()` 复用 `cleanupAllToolbars()` 的清理逻辑
- 移除 `handleSelectionChange()` 中的冗余 isProcessing 检查

### 编码规范合规（10+ 项）

- PronunciationDialog/QRCodeDialog 的剪贴板操作改用 `copyToClipboard` from `@/utils/domUtils`
- 两个 Vue 组件改用模块内封装的 `showMessage` 替代直接从 `siyuan` 导入
- QRCodeDialog 下载逻辑改用 `triggerBlobDownload` from `@/utils/domUtils`
- index.ts 移除 `(plugin as any)` 绕过类型检查的写法
- SCSS _mixins.scss 全部字体/间距硬编码替换为全局 Token（`$font-size-*`、`$font-weight-*`、`$line-height-*`、`$spacing-*`、`$radius-*`）
- SCSS _variables.scss 移除所有 `$shadow-*` 变量定义，_mixins.scss 移除所有 `box-shadow` 声明改用边框
- qrcode.scss 的 `.dialog-footer` 复用 `ft.dialog-footer` mixin
- pronunciation.scss/qrcode.scss 移除所有 `box-shadow` 和 `$shadow-*` 引用

## 技术栈

- TypeScript 5.x + Vue 3 (Composition API)
- SCSS（模块化 `.scss` 文件，禁止内联样式）
- 全局设计系统：`src/_variables.scss` 提供的 `$font-size-*`、`$font-weight-*`、`$line-height-*`、`$spacing-*`、`$radius-*`、`$vp-radius` 等 Token

## 实施方法

### 1. 逻辑缺陷修复

**问题1：FloatingToolbar.ts 双重检查和事件监听器自相矛盾**

- `processToolbar()` L237 检查 `toolbar.dataset.customButtonsAdded === "true"` 后 return
- `addCustomButtons()` L269 再次检查同样的条件（冗余）
- L337 注释写"一次性事件监听器"但实际 `{ once: false }`，导致每次工具栏重显都会在 DOM 重建的新按钮上累积监听器
- **修复**：移除 `processToolbar()` 中的检查（信任 addCustomButtons 的守卫），将 click 监听器注释修正为实际行为描述

**问题2：HeatmapMarker.ts isMarking 冗余**

- `isMarking` 仅在一处被检查（`observeDocumentContent` L185），而 `isScanning` 也做了同样检查
- 两者同时设为 true 后 `debounceScan` 被双重阻断，标记期间的 DOM 变更事件被静默丢弃
- **修复**：移除 `isMarking` 字段，所有检查统一用 `isScanning`

**问题3：PronunciationDialog watcher 双重触发**

- `watch(content)` 和 `watch(visible)` 都会触发 `generatePronunciation()`
- 当 content 在 visible=true 时改变，两个 watcher 都触发，导致双倍 AI API 调用
- **修复**：在 `watch(content)` 中增加 `visible` 状态判断，弹窗不可见时跳过生成

### 2. 性能优化

**问题4：单词本高频全量 I/O**

- 策略：在 FloatingToolbar 类中新增 `private wordSetCache: Set<string>` + `private wordCacheTimestamp: number`
- `checkAndHighlightWordInNotebook()` 优先检查缓存（TTL 30s），仅缓存过期或 miss 时才调 `getAllCards()`
- 首次加载后填充 Set，后续 mouseup 仅做 O(1) 的 `wordSetCache.has(word)`

**问题5：TextNode 数组收集**

- 当前：`scanDocument()` 把所有 TextNode push 到数组，再反向遍历
- 修复：直接用 TreeWalker 遍历，逐个调用 `markWordsInTextNode()`，无需数组中间存储

**问题6：queryFromLocalStorage 全量加载**

- 修复：复用 FloatingToolbar 已有的缓存机制，或改为使用 `flashcardStorage.getCardByTitle()` 如果 API 支持；若不支持则增加本地缓存

### 3. 冗余代码合并

**问题7：clearDocumentMarks / clearAllMarks**

- 提取公共函数 `unwrapMarkNodes(root: HTMLElement)`：遍历 `.heatmap-word`、替换为子节点、最后统一调用 `normalize()`
- `clearDocumentMarks()` 和 `clearAllMarks()` 各自调用这个公共函数

**问题8：cleanupAllToolbars / destroy 重复**

- `destroy()` 中调用 `this.cleanupAllToolbars()` 替代重复的手动遍历清理代码

**问题9：双重 isProcessing 守卫**

- 保留 `processSelection()` 中的 isProcessing 守卫，移除 `handleSelectionChange()` 中的冗余检查
- `handleSelectionChange` 在防抖后调用，防抖本身已保证不会快速重复触发

### 4. 编码规范合规

**统一入口违规（4处）**：

- PronunciationDialog.vue `copyResult()`: `navigator.clipboard.writeText(generatedResult.value)` → `copyToClipboard(generatedResult.value)`
- PronunciationDialog.vue `import { showMessage } from "siyuan"` → `import { showMessage } from "../core/utils"`
- QRCodeDialog.vue 同上一并修复
- QRCodeDialog.vue `downloadQRCode()`: 手动创建 `<a>` 下载 → `triggerDownload(canvas.toDataURL("image/png"), \`qrcode-\${Date.now()}.png\`)`

**any 类型绕过（1处）**：

- `index.ts L49`：`(plugin as any).__floatingToolbar` → 改为 `(plugin as PluginSample).__floatingToolbar`（需在 types/index.ts 扩展 PluginSample 接口或直接用更明确的类型断言）

**SCSS 规范违规（4项）**：

- **_mixins.scss 字体/间距硬编码**：
- `font-size: 16px` → `$font-size-base`（全局 Token 来自 `@/index.scss`）
- `font-weight: 600` → `$font-weight-semibold`
- `font-size: 14px` → `$font-size-sm`
- `font-size: 12px` → `$font-size-xs`
- `font-size: 13px` → 保留（无匹配 Token）或改为 `$font-size-sm`（14px）
- `padding: 16px 20px` → `padding: $spacing-4 $spacing-5`
- `gap: 8px` → `gap: $spacing-2`
- `gap: 12px` → `gap: $spacing-3`
- `line-height: 1.7` → `$line-height-relaxed`
- **box-shadow 移除**：
- 删除 `_variables.scss` 中所有 5 个 `$shadow-*` 变量
- 删除 `_mixins.scss` 中 `dialog-container`、`btn-primary`、`btn-base` 的 `box-shadow` 声明
- 删除 `pronunciation.scss` 和 `qrcode.scss` 中所有 `ft.$shadow-*` 引用
- 替代方案：已有 `border: 1px solid var(--b3-theme-surface-lighter)` 作为边框方案，移除 box-shadow 后视觉差异可接受

- **qrcode.scss footer 未复用 mixin**：
- `.dialog-footer` 替换为 `@include ft.dialog-footer;`

### 关键 Token 对照表

| 硬编码值 | 全局 Token |
| --- | --- |
| `font-size: 16px` | `$font-size-base` |
| `font-size: 14px` | `$font-size-sm` |
| `font-size: 12px` | `$font-size-xs` |
| `font-size: 10px` | `$font-size-2xs` |
| `font-weight: 600` | `$font-weight-semibold` |
| `font-weight: 500` | `$font-weight-medium` |
| `font-weight: 700` | `$font-weight-bold` |
| `line-height: 1.5` | `$line-height-normal` |
| `line-height: 1.7` | `$line-height-relaxed` |
| `padding: 16px 20px` | `padding: $spacing-4 $spacing-5` |
| `padding: 20px` | `padding: $spacing-5` |
| `gap: 8px` | `gap: $spacing-2` |
| `gap: 12px` | `gap: $spacing-3` |
| `gap: 16px` | `gap: $spacing-4` |
| `border-radius: 12px` | `$radius-lg` |
| `border-radius: 6px` | `$radius-base` |
| `border-radius: 4px` | `$radius-sm` |