---
name: component-preview-ui-polish
overview: 按 UI 审查报告的建议落地组件预览面板的排版优化：消除卡片行等高造成的空白、统一字号与视觉层级、改用共享 Button 并补齐无障碍属性与焦点态。
todos:
  - id: size-switcher-shared-button
    content: 档位切换器改用共享 Button 分组并补 role/aria-label/aria-pressed，清理 index.scss 自建按钮样式与边框令牌，新增 i18n 键 sizeLabel
    status: completed
  - id: card-grid-and-stage-map
    content: "PreviewSection 网格改 align-items: start 并支持宽卡片跨列，舞台特例收敛为登记表，示例名与摘要字号/截断/title 调整，删除卡片 hover 与代码按钮自建样式"
    status: completed
  - id: codeblock-shared-button-typography
    content: 代码块复制按钮改用共享 Button（icon + ariaLabel + 成功色），字号提到 12px 并改断词方式，统一代码块边框令牌
    status: completed
  - id: nav-typography-and-a11y
    content: 导航侧栏补 aria-current/aria-label 与键盘焦点环，调整行高、分组标题与计数对比度，统一边框令牌
    status: completed
  - id: sync-docs-and-verify
    content: 同步 componentPreview README 机制说明，执行 i18n merge/verify、read_lints 与 tsc 校验
    status: completed
    dependencies:
      - size-switcher-shared-button
      - card-grid-and-stage-map
      - codeblock-shared-button-typography
      - nav-typography-and-a11y
---

## 用户需求
组件预览面板的布局观感与内存暴涨问题均已修复，继续处理该功能模块内的**代码冗余**与**细节瑕疵**。本轮范围已明确为两项：代码冗余清理（样式重复输出、无用多语言键、重复的几何换算代码）与细节修复（滚动高亮节流、代码块复制按钮遮挡、受控回写守卫覆盖不足）。已明确不做「交互过的分区不再卸载」与「导航方向键移动」两项行为增强。

## 产品概述
组件预览面板（左侧组件导航 + 右侧分区卡片快照）在**外观与交互完全不变**的前提下，减少重复产出的样式与无效配置，并修正三处细节瑕疵，使模块更轻、更稳、更易维护。

## 核心功能
- **样式只输出一份**：面板级、分区级、卡片级样式各自归属清晰，子组件不再重复引入公共样式；卡片相关样式集中到独立的卡片样式文件
- **清理无人使用的文案键**：中英两侧同步删除，保持两侧键集合严格对齐
- **滚动高亮按帧合并**：滚动过程中不再每个事件都重新测量全部分区的位置，且高亮项未变化时不重复写入
- **复制按钮不再压字**：代码块右上角的复制按钮与首行代码文字互不遮挡
- **回写守卫覆盖更多取值类型**：日期对象、普通对象在内容相同时不再被重复写回，消除潜在的反复重渲染


## 技术栈
沿用项目现状，无新依赖：Vite + Vue 3（`<script setup>` + TS）+ SCSS（`@/variables.scss` 短名 Token）。

## 实施方案

三项冗余清理 + 三项细节修复，全部为「不改变行为」的收缩型改动：

1. **SCSS 去重与拆分（当前重复 5 份 → 各 1 份）**
   - 当前实测：`styles/index.scss` 被 5 处 `@use`（根 `index.vue` + `PreviewSection.vue` + `PreviewCard.vue` + `NavSidebar.vue` + `CodeBlock.vue`），`styles/PreviewSection.scss` 被 2 处 `@use`（`PreviewSection.vue` + `PreviewCard.vue`），同一批选择器在产物里重复输出 2~5 次。
   - `index.scss` 内容仅面板级类（`.cp-panel` / `.cp-header*` / `.cp-size*` / `.cp-body` / `.cp-content*` + 720px 断点），子组件**均未使用**，且根组件在 tab 挂载时必定渲染 ⇒ **只在根 `index.vue` 引入一次**即可，移除 4 个子组件的引用。
   - 新建 `styles/PreviewCard.scss`，把卡片级样式从 `PreviewSection.scss` 迁出：`.cp-card`、`.cp-card__stage`（含弹层沙箱覆盖）、舞台分档（`--compact` / `--fill` / `--top` / `--chart`）、特例高度（`--loader` / `--speeddial` / `--dialog` / `--drawer` / `--megaMenu` / `--tieredMenu` / `--toast`）、各类 demo 宿主类（`.cp-inplace-demo*` / `.cp-hook-*` / `.cp-demo-*` / `.cp-popup-demo*` / `.cp-tooltip-demo*` / `.cp-fileupload-demo` / `.cp-megamenu-demo` / `.cp-sidebar-demo*` / `.cp-tieredmenu-demo`）、`.cp-card__foot`、`.cp-card__title`。
   - `PreviewSection.scss` 只留分区级样式：`.cp-section` / `__head` / `__name` / `__summary` / `__import` / `.cp-section__grid` / `@media` 内的 `.cp-card--wide` / `.cp-section__placeholder`。
   - 两份文件首行都必须保留 `@use '@/variables.scss' as *;`（Sass 变量不跨文件传递）。
   - 引用关系调整后：`PreviewSection.vue` 只引 `PreviewSection.scss`；`PreviewCard.vue` 只引 `PreviewCard.scss`。

2. **清理 4 个未被引用的多语言键**
   - `types/index.ts` 的 `I18n` 接口中删除 `clearSearch` / `copyFailed` / `preview` / `code`；`src/i18n/zh_CN/componentPreview.json` 与 `src/i18n/en_US/componentPreview.json` 同步删除同名 4 键（顶层 JSON 由 `pnpm i18n:merge` 重新生成，不手改）。
   - 保留仍在使用的键：`title` / `subtitle` / `searchPlaceholder` / `noMatch` / `copyCode` / `copied` / `openFloatingWindow` / `viewCode` / `hideCode` / `sizeXsmall` / `sizeSmall` / `sizeMedium` / `sizeLarge` / `sizeLabel`。

3. **几何换算抽取 + 滚动高亮节流**
   - `index.vue` 中 `mountSectionsInViewport()` 与 `handleContentScroll()` 各自重复写了一遍「分区相对内容区顶部的偏移」换算 ⇒ 抽一个私有 helper（如 `resolveSectionOffset(container, id)`，返回相对容器的 top / bottom），两处复用。
   - `handleContentScroll` 改为 **rAF 节流**（一帧最多计算一次），并只在 `activeId` 真正变化时赋值（避免无意义的重渲染）；`onBeforeUnmount` 中取消挂起的帧。

4. **细节修复**
   - `styles/CodeBlock.scss`：`.cp-codeblock__pre` 当前 `padding: $s-2 $s-3`（右 12px），而复制按钮为 22px 见方且 `top/right: $s-1` ⇒ 首行文字尾部被遮。补 `padding-right: $s-10`（40px，实测 Token 存在）并注明用途。
   - `components/PreviewStage.ts` 的 `isSameValue` 扩展判定顺序：① `Object.is` 相等 → 同值；② 双方均为 `Date` → 比较 `getTime()`；③ 双方均为数组 → 长度一致且逐项 `Object.is`；④ **双方均为普通对象**（`Object.getPrototypeOf(x) === Object.prototype`）→ 键集合一致且逐键 `Object.is`；⑤ 其余（`File` / `Blob` / `Map` / `Set` 等）**回退为引用比较**。第 ④ 步的前置判断不能省：若对任意对象做浅比较，`Object.keys(file)` 为空会让两个不同文件被判为同值，反而吞掉真实变更。

### 关键决策与取舍
- **不新增任何行为特性**：卸载策略、跨列名单、舞台分档参数一律不动，只做去重与细节，确保回归面最小。
- **样式「只由根组件引入」的可行性**：根组件 `index.vue` 是面板唯一入口且必定挂载，子组件永远在其内部渲染，因此公共面板样式不会有缺失窗口；这是把 5 份重复收敛为 1 份的前提。
- **`isSameValue` 采用「白名单式」类型判定**：只对语义明确可比较的 `Date` 与普通对象做值比较，其余类型保持引用比较，宁可不判同也不误判同。

### 性能与可靠性
滚动路径的热点从「每个 scroll 事件 × 41 次强制 layout」降为「每帧至多 1 次 × 41 次读取」并在值不变时不触发渲染；样式体量按重复份数净减（`index.scss` 由 5 份降为 1 份、卡片样式由 2 份降为 1 份），首屏 CSS 解析与内存占用同步下降。`isSameValue` 的加固消除日期/对象场景下潜在的反复重渲染。无新增运行时依赖，无循环或复杂度上升。

## 目录结构

```
src/features/componentPreview/
├── index.vue                          # [MODIFY] 仅保留 styles/index.scss 引入；抽 resolveSectionOffset 供首帧挂载与滚动高亮复用；滚动高亮改 rAF 节流且只在变化时赋值，卸载时取消挂起帧
├── components/
│   ├── PreviewSection.vue             # [MODIFY] 移除 styles/index.scss 引入，仅引 styles/PreviewSection.scss
│   ├── PreviewCard.vue                # [MODIFY] 改引 styles/PreviewCard.scss（不再引 PreviewSection.scss 与 index.scss）
│   ├── PreviewStage.ts                # [MODIFY] isSameValue 依次覆盖 Object.is / Date / 数组 / 普通对象浅比较，其余类型回退引用比较
│   ├── NavSidebar.vue                 # [MODIFY] 移除 styles/index.scss 引入
│   └── CodeBlock.vue                  # [MODIFY] 移除 styles/index.scss 引入
├── styles/
│   ├── PreviewSection.scss            # [MODIFY] 只保留分区级样式（section/head/name/summary/import/grid/wide/placeholder），卡片级样式全部迁出
│   ├── PreviewCard.scss               # [NEW] 卡片级样式（card / stage 含沙箱覆盖 / 舞台分档 / 特例高度 / demo 宿主 / foot / title），首行 @use '@/variables.scss' as *
│   ├── index.scss                     # [不变] 面板级样式，改为只由根组件引入
│   └── CodeBlock.scss                 # [MODIFY] .cp-codeblock__pre 增 padding-right: $s-10（给复制按钮留位）
├── types/index.ts                     # [MODIFY] I18n 接口删除 clearSearch / copyFailed / preview / code
src/i18n/zh_CN/componentPreview.json   # [MODIFY] 同步删除同名 4 键
src/i18n/en_US/componentPreview.json   # [MODIFY] 同步删除同名 4 键
```

## 关键代码结构

```ts
/**
 * 受控回写同值判定（决定是否写回 modelValue）：
 * 1) Object.is 相等 → 同值
 * 2) 双方均为 Date → 比较 getTime()
 * 3) 双方均为 Array → 长度一致且逐项 Object.is
 * 4) 双方均为「普通对象」（原型为 Object.prototype）→ 键集合一致且逐键 Object.is
 * 5) 其余类型（File / Blob / Map / Set 等）→ 引用比较（禁止浅比较：Object.keys(file) 为空会误判同值）
 */
declare function isSameValue(current: unknown, next: unknown): boolean
```

## 执行要点
- **每次编辑前先重读文件**：`componentPreview/` 正被并行会话同时编辑（本轮已出现 `toast` 分区、`sidebar` 数据文件、`.cp-inplace-demo*` / `.cp-focustrap-demo*` 新演示类），SCSS 拆分边界必须按**重读后的当前内容**确认，不得照搬既有行号。
- 拆 SCSS 时逐类搬迁（含类内 `:deep()` / 嵌套覆盖），不改任何声明值；搬迁后核对两份文件的选择器总和与原文件一致（无遗漏、无重复）。
- 删多语言键前先用引用检索确认零引用；删后必须 `pnpm i18n:merge` + `pnpm i18n:verify`（要求中英叶子键完全对齐）。
- 验证：`read_lints`、`npx tsc --noEmit`（过滤 `componentPreview`，只看新增路径）。⚠️ `npx sass` 在本项目不可用（`@/variables.scss` 别名需自定义 importer）⇒ SCSS 语法最终由用户 `pnpm dev` 目视确认。
- 破坏半径控制：不改舞台分档参数、不改懒挂载卸载策略、不改跨列名单、不动 `previewData/*.ts` 数据。


## Agent Extensions

### Skill
- **lsp-code-analysis**
  - Purpose: 在删除 `clearSearch` / `copyFailed` / `preview` / `code` 四个多语言键与搬迁 SCSS 规则前，做符号级引用检索（`I18n` 接口成员、i18n 键名、CSS 类的使用点），确保「零引用」结论来自语义检索而非文本猜测
  - Expected outcome: 给出四个键的引用清单确认全部为零，并列出被搬迁的舞台/demo 宿主类的使用位置，使删除与拆分有据可依、不误删仍被引用的内容
