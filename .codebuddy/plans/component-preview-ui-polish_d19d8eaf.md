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

## 需求概述
组件预览面板上一轮已完成「去尺寸卡 + 基础排版优化」。本轮继续做**逐分区细节校准**，并处理用户新增的**内存持续增长**问题（进入面板后每几秒 +100MB，峰值 1GB+）。两件事同一轮交付。

## 核心功能
### 一、舞台布局按组件类型分层（细节校准）
- **容器类满宽 + 顶对齐**：Card、Panel、Message、Paginator 在快照中不再是「被舞台收缩后的窄条」，而是组件真实使用时的满宽形态；内容高度多变的分区（Timeline、Tabs、FileUpload、Listbox、Splitter、Card、Panel、Message、Paginator）改为顶部对齐，避免垂直居中造成随机上边距。
- **纯原子控件保持居中 + 紧凑舞台**：Button / IconWrapper / Tag / Badge / Avatar / Switch / Checkbox / RadioButton / Label / Divider 的舞台高度由 96px 降到 64px，减少空白与面板滚动长度；居中风格不变。
- **横向空间重新分配**：网格列宽下限 230 → 260px；Toolbar 与 Paginator 跨两列（三段式工具栏、长分页条不再拥挤）；Chart 舞台内高度给足（图表不再贴边/溢出）。

### 二、内存治理
- **分区懒挂载 + 远区卸载**：只实例化可视区附近的分区（含预挂载余量），滚出较远后卸载并保留高度占位 —— 常驻组件实例从约 290 降到约 20-40，内存有硬上限。
- **渲染分配加固**：受控组件的 modelValue 回写加同值守卫，截断「组件 emit → 面板写回 → 重渲染 → 再 emit」的自激循环；单卡片 props 只解析一次（当前每帧被解析两次）。
- **可自助的诊断交付**：提供 DevTools Console 采样脚本（堆内存、活动舞台数、DOM 节点数、定时器/监听器净增量）与二分法定位步骤，由用户自行运行并回传结果。

## 视觉与交互效果
卡片不再被特例高度拉高，容器类组件呈现满宽真实形态、原子控件保持紧凑居中，图表与工具栏不再拥挤，面板整体更短更整齐。滚动时新进入视口的分区首次挂载（可能有一瞬空白，占位高度保证滚动条不跳），锚点跳转与搜索命中的分区会立即挂载，不会出现点不到内容的情况。


## 技术栈
沿用现状，零新依赖：Vite + Vue 3（`<script setup>` + TS）+ SCSS 短名 Token；复用共享组件与 `IntersectionObserver`（仓库既有范式：`IndexSidebar` / `docAnalysis` 的分批渲染）。

## 实施方案

### 一、舞台布局分层（数据驱动的分档，而非逐个分区手写样式）
1. **登记表升级为多类数组**：`PreviewSection.vue` 的 `STAGE_CLASS_BY_GROUP` 由 `Record<string, string>` 改为 `Record<string, string[]>`（一个分区可同时挂「满宽」与「顶对齐」），模板 `:class` 直接吃数组；`WIDE_STAGE_GROUP_IDS` 追加 `toolbar`、`paginator`（保留既有 dialog / drawer / megaMenu / tieredMenu）。
2. **新增四个修饰类**（`styles/PreviewSection.scss`，写在基础 `.cp-card__stage` 之后以同特异性后者胜）：
   - `--fill`：`justify-content: flex-start; align-items: flex-start;` + `> * { width: 100%; }` ⇒ card / panel / message / paginator（解决「根元素无 width 被 flex 收缩」这一根因）
   - `--top`：仅 `align-items: flex-start` ⇒ timeline / tabs / fileUpload / listbox / splitter
   - `--compact`：`min-height: 64px` ⇒ button / iconWrapper / tag / badge / avatar / switch / checkbox / radioButton / label / divider
   - `--chart`：`min-height: 190px`（Chart 默认档 150px 高 + 舞台上下内边距 32px）
3. **网格列宽 230 → 260px**：Card/Chart 的 200px 固有宽度在 260px 卡内（可用宽约 228px）不再贴边；`--fill` 与跨列的配合顺序写入 README。
4. **不做的事**：不动 `--loader/--speeddial/--dialog/--drawer/--megaMenu/--tieredMenu/--toast` 的既有高度与弹层沙箱覆盖（含 `(0,3,0)` 抬特异性的写法）；不给 Toolbar 加 `--fill`（其根已是 `width:100%`，只需跨列）。

### 二、内存治理
1. **分区懒挂载 + 远区卸载**（`index.vue` 主导，IO root 用已有的滚动容器 `contentRef`）：
   - IO 配置：`root: contentRef`、`rootMargin: "800px 0px"`、`threshold: 0`；回调里 `entry.isIntersecting` 直接决定挂载/卸载 —— 一个观察者同时实现「预挂载余量」与「远区卸载」，行为可预测。
   - `active` 判定 = `在预挂载区内 || 搜索命中 || 锚点跳转目标`；搜索非空时命中集合很小，直接全激活以免搜不到内容。
   - **硬约束**：`.cp-section` 外壳（含 `id="cp-group-{id}"`、分区标题与说明）**必须常驻** —— `handleContentScroll` 的滚动高亮与 `handleSelect` 的锚点滚动都依赖该元素存在；只有「import 代码块 + 卡片网格」受 `v-if` 控制。
   - **高度占位防跳**：卸载前记录该分区 `offsetHeight`（模块级 Map，按 group id 缓存），卸载后用 `:style="{ minHeight }"` 占位；无缓存时用兜底值（如 240px）。
   - 迁移到卡片级（`PreviewCard`）的代码块展开状态保持「同分区同时只开一个」的既有行为（由父传 `codeOpen` + emit 切换）。
2. **渲染分配加固**：
   - `PreviewStage` 的 `onUpdate:modelValue` 回写加**同值守卫**：`Object.is` 相等即跳过；数组/对象做浅层比较（长度 + 逐项 `===`）后相等也跳过 —— 这是对任何「组件自激 emit」的通用截断手段。
   - 抽出 `PreviewCard.vue`：卡片内用 `computed` 解析一次 props，同时供 `component-props` 与 `example-props`，消除模板里 `resolveProps(example)` 的二次调用（每帧 2×N 次对象分配）；顺带让 `PreviewSection.vue` 体积下降。
   - `SlotRenderer` 与 `PreviewStage` 一并从 `PreviewSection.vue` 拆到独立组件文件（当前是同文件内 `defineComponent`），降低单文件复杂度。
   - **约束**：分组数据不得用 `reactive()` 包装（会让组件对象被深度代理、显著放大内存），保持 `computed` + 普通数组的现写法。
3. **诊断交付物**（`docs/component-preview-memory-diagnosis.md`，用户自行执行）：
   - 脚本 A（采样）：每 2s 打印 `performance.memory.usedJSHeapSize`、`document.querySelectorAll('.cp-card__stage').length`、`document.querySelectorAll('*').length`
   - 脚本 B（计数）：monkey-patch `setInterval/clearInterval/addEventListener/removeEventListener` 统计净增量，暴露 `window.__cpStats()`
   - 步骤：预览页签所在渲染进程打开 DevTools → 执行 A/B → 60s 观察是否存在平台期 → 无平台期则二分法定位（临时缩减 `PREVIEW_GROUPS` 子集 → 逐半切分 → 定位到分区 → 定位到示例 → 定位到组件）
   - 判读标准：DOM 节点数同步增长 ⇒ DOM/实例泄漏；仅 JS 堆增长 ⇒ 闭包/缓存泄漏；两者皆平稳 ⇒ 懒挂载已足够

### 关键决策与取舍
- **分层而非逐个分区定制**：4 个修饰类覆盖 41 个分区的全部需求，新增组件只需在登记表加一行，避免 41 套样式。
- **`--fill` 从根因入手**：Card/Panel/Message 的失真不是「宽度没设」，而是「根无 width 被 flex 收缩」，用 `> * { width: 100% }` 一次解决三类组件。
- **懒挂载选「预挂载 + 卸载」而非「只挂载不卸载」**：用户已确认接受首次挂载的短暂空白，换取内存硬上限；高度缓存把滚动跳动压到最小。
- **同值守卫优先于逐组件排查**：无论真凶是哪个受控组件，回写守卫都能截断自激循环；真正定位留给用户的采样脚本结果。
- **不引入 `markRaw`/`shallowRef` 等无依据改动**：分组数据当前未被响应式代理，按现写法即可。

### 性能与可靠性
- 常驻实例数由约 290 降至约 20-40（视窗口高度与预挂载余量），内存与首屏渲染成本同步下降；IO 回调开销为 O(可见分区)，滚动高亮逻辑不变。
- 懒挂载不改变数据流：`previewData/*.ts` 仍为唯一数据源，`usePreviewSize` 持久化与 `resolveProps` 注入链路不变。
- 风险与缓解：①卸载后占位高度不准导致轻微跳动 → 用实测高度缓存 + 兜底值；②锚点跳转目标未挂载 → `handleSelect` 强制激活该分区；③并行会话同时改 `componentPreview/` → 每次编辑前先重读文件，收尾复扫（分组数、登记表名单、`--*` 修饰类集合）。

## 执行要点（防回归）
- 新增修饰类必须写在基础 `.cp-card__stage` 规则之后（同特异性靠顺序取胜），且不得改动舞台内既有弹层沙箱覆盖块。
- `.cp-section` 的 `id` 与标题不得被 `v-if` 卸载（滚动高亮与锚点跳转的落点）。
- 抽 `PreviewCard.vue` / `PreviewStage.vue` 时保持对外行为不变：受控示例仍可交互；仅声明了 `modelValue` 的组件才注入 v-model 属性；无默认插槽内容时不传插槽（避免 `$slots.default` 恒真）。
- 代码块展开仍是「同分区唯一展开」，状态上提父组件，不改成每卡各自展开。
- 文档同步：`componentPreview/README.md` 补「舞台分档（fill/top/compact/chart）+ 列宽 260 + 跨列名单追加 toolbar/paginator」与「分区懒挂载机制（IO rootMargin、高度占位、搜索与锚点强制挂载）」；`AGENTS.md` 侧只需在既有指引处保持指向 README，不改数字。
- 验证：AI 执行 `read_lints`、`npx tsc --noEmit`（过滤 componentPreview，只看新增路径）、`npx sass --no-source-map` 编译改动过的 SCSS；用户执行 `pnpm lint` 与 `pnpm dev` 目视（卡片紧凑度、容器类满宽、跨列、锚点跳转与滚动到新分区时的挂载表现）。

## 架构设计
无架构变更。面板组件树由「`index.vue`（头部 / 滚动容器 / 锚点导航）→ `PreviewSection` → 卡片」细化为「`index.vue`（新增 IO 可见性调度）→ `PreviewSection`（外壳常驻 + 内容 `v-if`）→ `PreviewCard`（单次解析 props）→ `PreviewStage`（受控桥接 + 同值守卫）」，数据源 `previewData/*.ts`、档位持久化 `usePreviewSize`、`resolveProps` 注入链路均不变。

## 目录结构
```
src/features/componentPreview/
├── index.vue                          # [MODIFY] 新增 IntersectionObserver 可见性调度（root=contentRef、rootMargin 800px）：维护 activeGroups，滚动回调挂载/卸载；搜索非空与锚点跳转 handleSelect 强制激活目标；高度缓存 Map（卸载前记录 offsetHeight，占位 minHeight）
├── components/
│   ├── PreviewSection.vue             # [MODIFY] STAGE_CLASS_BY_GROUP 改为 Record<string, string[]> 并补 fill/top/compact/chart 名单；新增 active prop，外壳（id/标题/摘要）常驻、import 代码块与网格受 v-if 控制；卡片渲染改为 <PreviewCard>
│   ├── PreviewCard.vue                # [NEW] 单示例卡片：computed 解析一次 props 同时供组件与 SlotRenderer；持有 codeOpen prop + toggle-code emit（保持同分区唯一展开）；承载卡片页脚与 CodeBlock
│   ├── PreviewStage.vue               # [NEW] 从 PreviewSection.vue 拆出（含 SlotRenderer）：受控桥接 + 同值写回守卫（Object.is / 浅比较）+ 仅在声明 modelValue 时注入 v-model 属性
│   ├── CodeBlock.vue                  # [UNCHANGED] 复制按钮与 sr-only 播报保持现状
│   └── NavSidebar.vue                 # [UNCHANGED] 导航交互与无障碍保持现状
├── styles/
│   ├── PreviewSection.scss            # [MODIFY] 网格列宽 230→260px；新增 .cp-card__stage--fill / --top / --compact / --chart（写在基础规则之后）；弹层沙箱覆盖块与既有高度类保持不动
│   ├── index.scss                     # [UNCHANGED]
│   ├── NavSidebar.scss                # [UNCHANGED]
│   └── CodeBlock.scss                 # [UNCHANGED]
└── README.md                          # [MODIFY] 补舞台分档（fill/top/compact/chart）与列宽/跨列名单；补分区懒挂载机制（IO 配置、高度占位、搜索与锚点强制挂载、锚点元素不可卸载）
docs/
└── component-preview-memory-diagnosis.md  # [NEW] 内存诊断文档：采样脚本（堆内存/活动舞台数/DOM 节点数）、定时器与监听器净增量计数脚本、二分法定位步骤、判读标准与执行前提（在预览页签所属渲染进程的 DevTools Console 执行）
```

## 关键代码结构
```ts
/** 分区 → 舞台修饰类（可多类叠加；新增组件只改这一处登记） */
const STAGE_CLASS_BY_GROUP: Record<string, string[]> = {
  card: ["cp-card__stage--fill"],
  panel: ["cp-card__stage--fill"],
  message: ["cp-card__stage--fill"],
  paginator: ["cp-card__stage--fill"],
  timeline: ["cp-card__stage--top"],
  tabs: ["cp-card__stage--top"],
  fileUpload: ["cp-card__stage--top"],
  listbox: ["cp-card__stage--top"],
  splitter: ["cp-card__stage--top"],
  button: ["cp-card__stage--compact"],
  iconWrapper: ["cp-card__stage--compact"],
  tag: ["cp-card__stage--compact"],
  badge: ["cp-card__stage--compact"],
  avatar: ["cp-card__stage--compact"],
  switch: ["cp-card__stage--compact"],
  checkbox: ["cp-card__stage--compact"],
  radioButton: ["cp-card__stage--compact"],
  label: ["cp-card__stage--compact"],
  divider: ["cp-card__stage--compact"],
  chart: ["cp-card__stage--chart"],
  // 浮层/高度特例保持既有类：loader / speedDial / dialog / drawer / megaMenu / tieredMenu / toast
}

/** 卡片跨两列（≥720px）：浮层展开需横向空间 + 三段式工具栏 + 长分页条 */
const WIDE_STAGE_GROUP_IDS: readonly string[] = [
  "dialog", "drawer", "megaMenu", "tieredMenu", "toolbar", "paginator",
]
```


## SubAgent
- **code-explorer**
  - Purpose: 在执行前复扫 `src/features/componentPreview/previewData/index.ts` 的全部分组、`styles/PreviewSection.scss` 的全部 `.cp-card__stage--*` 类与 `PreviewSection.vue` 的登记表，核对本计划的「分档名单 / 跨列名单 / 高度特例名单」是否与当前代码一致（并行会话会新增分区，如本轮前后的 `toast`、`sidebar`、`Message` 均属此类）。
  - Expected outcome: 一份「登记表 ↔ 实际分区 ↔ 现有修饰类」的三方对齐结论，指出新增或改名分区需补进的名单，避免按过期清单实现。
