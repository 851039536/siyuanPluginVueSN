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

组件预览面板（`src/features/componentPreview/`）已完成一轮 UI 排版审查，用户要求「根据建议」落地报告中的优化项。范围仅限该面板，含头部工具栏、导航侧栏、分区、卡片网格、代码块。本轮纳入报告的 P0（第 1-4 项）、P1（第 5-10 项）与第 14 项；不纳入第 11、12、13、15 项（超宽屏行宽上限、窄屏导航替代、import 常驻改 chip、搜索框 aria-label —— 后者需改共享组件 `Input`，超出「仅面板」范围）。

## 核心功能

- **卡片网格不再被特例舞台撑高**：网格项改为顶端对齐，卡片保持自身内容高度；MegaMenu(340px)、TieredMenu(300px)、Dialog(300px) 等特例不再把同排普通卡片拉到同高、多出的高度全部灌进舞台；展开代码块时也不再撑高同排卡片。
- **宽舞台卡片跨两列**：Dialog / Drawer / MegaMenu / TieredMenu 四类分区卡片横跨两列，获得展开浮层与三段结构所需的横向空间；Loader / SpeedDial 不跨列。窄屏（单列）不跨列，避免横向溢出。
- **三处自建按钮改为统一按钮控件**：头部档位切换器由裸按钮组改为共享按钮分组（选中为填充主色、未选中为幽灵文本），卡片代码切换按钮与代码块复制按钮同样改用共享按钮，尺寸统一为 icon-only 最小档（22px）；复制成功后按钮转为成功色。
- **键盘与读屏可用性**：档位分组带分组名称与选中态语义；导航当前分区带当前项语义、侧栏带名称；面板内唯一保留的自建可交互元素（导航项）补键盘焦点环；图标按钮补可访问名称（不再只靠悬停提示）；复制成功有状态变化可感知。
- **字号与视觉层级**：示例名由 10px 灰字升为 12px 正文色并补悬浮全文；代码块由 10px 升为 12px，取消「按任意字符断行」改为仅在必要时才断词；分区摘要限制为最多两行并补悬浮全文，长说明（如工具栏插槽告警）不再无限平铺；导航项行高加高、分组标题改用中性弱色、计数去掉过低的透明度。
- **线条一致性与去噪**：面板内承担「边框」用途的线条统一为项目边框色；同一变量用作悬停底色的地方保持不变；删除卡片整体悬停高亮（卡片本身不可点，只有角落按钮可点），避免误导。
- **舞台特例集中登记**：六条散落在模板里的分区判断收敛成一张「分区 id → 舞台修饰类」登记表，新增组件时只改一处。

## 视觉与交互效果

面板整体更整齐：卡片按内容自然高度排列、宽浮层卡片独占两列，大片空白消失；文字层级更清晰（示例名、代码块、导航均达到 12px 基准）；线条深浅一致，鼠标悬停不再产生「点了没反应」的误导；键盘 Tab 导航时焦点环可见、档位切换的选中态可被读屏播报。

## 技术栈

沿用项目现状，不新增依赖：Vite + Vue 3（`<script setup>` + TS）+ SCSS（短名 Token），复用 `src/components/` 共享组件库（`Button` / `Input` / `IconWrapper`）与既有 `@/variables.scss` 令牌体系。

## 实施方案

以「复用共享组件 + 令牌化收敛 + 单点登记」三条主线完成打磨，零新架构、零新依赖：

1. **三处自建按钮统一到共享 `Button`**（`index.vue` 档位切换器、`PreviewSection.vue` 代码切换、`CodeBlock.vue` 复制）：

- 档位切换器：外层容器加 `role="group"` + `:aria-label`，每个按钮 `size="xsmall"`，选中 `variant="primary"`，未选中 `variant="ghost"` + `text` + `:aria-pressed`（项目既有分段组范式）；仅保留 `font-family: $ff-mono` 的字形通过 class 透传，删除自建按钮的其余样式。
- 图标按钮：`Button` 支持 `icon` + `ariaLabel`/`title`，`accessibleName` 的 icon-only 回退依赖 `title`，而 DEV 下 icon-only 缺失可访问名称会告警，故**必须显式传 `ariaLabel`**；chip 状态由 `:icon` 切换（`code`/`chevronUp`、`copy`/`check`）。
- 复制成功态：用 `:severity="copied ? 'success' : undefined"` 表达（`ButtonSeverity` 已含 `success`），未复制时不传 severity，避免污染外观轴取色。
- `Button` 未设 `inheritAttrs: false`，`:aria-pressed` 与 `class` 均可正常透传到根 `<button>`，因此位置样式（复制按钮的绝对定位）仍可经 class 落在根元素上。

2. **网格等高与宽卡片**：`.cp-section__grid` 加 `align-items: start`；新增 `.cp-card--wide { grid-column: span 2 }` 并以 `@media (min-width: 720px)` 包裹（<720px 时侧栏已隐藏、内容为单列，跨列会撑出横向溢出）。宽度需求清单：`dialog` / `drawer` / `megaMenu` / `tieredMenu`。
3. **舞台特例登记表**：把模板中 6 条 `group.id === 'xxx'` 布尔判断收敛为组件内局部映射 `STAGE_CLASS_BY_GROUP`（id → 舞台修饰类）与 `WIDE_STAGE_GROUP_IDS`（跨列 id 列表），用 `:class` 数组绑定；高度值继续留在 SCSS（已注明「无对应 Token」），**不改动弹层沙箱覆盖机制与 (0,3,0) 抬特异性的既有写法**。
4. **字号与令牌**：示例名 `$t-2xs`(10px) → `$t-xs`(12px) + `--b3-theme-on-surface`；代码块 `$t-2xs` → `$t-xs`、`word-break: break-all` → `overflow-wrap: break-word`（保留 `white-space: pre-wrap` 与 `overflow-x: auto`）；分区摘要 `flex: 1; min-width: 0` + `-webkit-line-clamp: 2`（`display: -webkit-box`）；截断元素统一补 `:title`。
5. **边框令牌统一**：仅把「边框」用途的 `--b3-theme-surface-lighter` 改为 `--b3-border-color`（toolbar 下边、档位容器描边、分区标题下边、卡片描边、卡片页脚上边、代码块描边、侧栏右边）；**用作悬停/填充背景的同一变量保持原样**（导航项 hover、卡片图标按钮 hover、复制按钮底色）。
6. **焦点与语义**：导航项补 `:focus-visible { outline: 2px solid var(--b3-theme-primary); outline-offset: -2px; }`（内嵌环，因 `.cp-nav` 为 `overflow-y: auto`，外扩环会被裁；与库内 `Listbox` 的 `-2px` 先例一致）；导航项加 `aria-current`，侧栏加 `aria-label`。
7. **i18n**：新增 `sizeLabel`（档位分组名称）到 `zh_CN` / `en_US` 分片与 `I18n` 接口；顶层 JSON 由 `pnpm i18n:merge` 生成，不手改。

### 关键决策与取舍

- **不引入新组件 / 新样式文件**：仅删除自建按钮样式、替换为共享组件，符合「共享组件优先复用」硬规则，也顺带获得统一的悬停、焦点环、禁用态与图标档位几何（icon-only xsmall = 22px，与现卡片按钮一致，复制按钮由 24px 收敛到 22px）。
- **网格选择 `align-items: start` 而非强制等高**：预览面板的价值是「看到组件真实外观」，`stretch` 产生的内部空白属于负收益；行底不齐可接受，且宽卡片跨列进一步平衡观感。
- **第 15 项不做**：`Input` 的 `useAttrs()` 把属性全量透传到**容器 div**（仅剥离 class/style），`aria-label` 落在容器上对内部 `<input>` 无效；要修必须给共享组件新增 `ariaLabel` prop 并同步 AGENTS 表格 / previewData / README，超出「仅面板」范围，留待单独确认。

### 性能与可靠性

纯样式与模板属性调整，无新增运行时逻辑：无额外响应式依赖、无新增 DOM 节点（改用共享 Button 后节点数基本持平）、无循环或计算复杂度变化；网格 `align-items: start` 与 `grid-column: span 2` 均为静态布局，不触发运行时重排逻辑。风险集中在视觉回归（边框深浅、跨列后卡片宽度），由用户 `pnpm dev` 目视覆盖。

## 执行要点

- 每个文件只由一个任务负责（`index.vue`+`index.scss`｜`PreviewSection.vue`+`PreviewSection.scss`｜`CodeBlock.vue`+`CodeBlock.scss`｜`NavSidebar.vue`+`NavSidebar.scss`），避免并行改写同一文件。
- 删除自建样式时要**保留**仍被引用的钩子：档位按钮的等宽字形、复制按钮的绝对定位（`position: absolute; top: $s-1; right: $s-1`）、导航项的布局与激活态底色。
- 边框令牌替换逐处核对用途，严禁整文件替换（会破坏 hover 底色）。
- 图标按钮换共享 `Button` 后**不得再传默认插槽**（否则 `isIconOnly` 失效、几何退化为文字按钮），必须用 `icon` prop 传图标。
- 验证由用户执行 `pnpm lint` / `pnpm dev`；AI 可执行 `pnpm i18n:merge`、`pnpm i18n:verify`、`read_lints`、`npx tsc --noEmit`（仓库存在大量与本次无关的既有 tsc 报错，只看 componentPreview 新增路径）。

## 架构设计

无架构变更。面板仍为「`index.vue` 头部与布局 → `NavSidebar` / `PreviewSection`（→ `CodeBlock`）」的既有组件树，`previewData/*.ts` 数据驱动、`usePreviewSize` 持久化档位、`resolveProps` 注入档位的链路完全不变；本次仅调整模板属性绑定、样式表与两处 i18n 键。

## 目录结构

```
src/features/componentPreview/
├── index.vue                        # [MODIFY] 档位切换器改用共享 Button 分组：容器加 role="group" + :aria-label="i18n.sizeLabel"，按钮 size="xsmall"、选中 variant="primary"、未选中 variant="ghost"+text+:aria-pressed，透传 class 保留等宽字形；移除对 COMPONENT_SIZES 的裸 button 渲染
├── components/
│   ├── PreviewSection.vue           # [MODIFY] ①6 条 group.id 布尔判断收敛为 STAGE_CLASS_BY_GROUP + WIDE_STAGE_GROUP_IDS，:class 用数组绑定并追加 cp-card--wide；②卡片代码切换由裸 button + IconWrapper 改为共享 Button（icon + ariaLabel + title，icon-only 不传默认插槽）；③卡片示例名与分区摘要补 :title 全文
│   ├── CodeBlock.vue                # [MODIFY] 复制按钮由裸 button 改为共享 Button（icon copy/check、ariaLabel 随 copied 切换、:severity 仅在复制成功时传 success），保留绝对定位 class；逻辑 handleCopy 与 1600ms 复位不变
│   └── NavSidebar.vue               # [MODIFY] <aside> 加 :aria-label="i18n.title"，导航项加 :aria-current="group.id === activeId || undefined"
├── styles/
│   ├── index.scss                   # [MODIFY] 删除 .cp-size__btn 与 .cp-size__btn--active 自建样式（仅留 $ff-mono 字形与 .cp-size 容器布局）；toolbar 下边与档位容器描边改 --b3-border-color；其余（内容区 padding、空态、720px 断点）不动
│   ├── PreviewSection.scss          # [MODIFY] 网格加 align-items: start 并新增 .cp-card--wide（@media (min-width: 720px) 内 grid-column: span 2）；删除 .cp-card:hover 与 .cp-card__code-btn 样式块；.cp-card__title 改 12px + on-surface；.cp-card__summary/分区标题摘要加两行截断；分区标题下边、卡片描边、页脚上边改 --b3-border-color（hover 底色类保留）
│   ├── CodeBlock.scss               # [MODIFY] __pre 字号 12px + overflow-wrap: break-word（去 break-all）；__copy 仅保留绝对定位与层级，删除自建尺寸/配色/opacity 与 --copied 配色（交给 Button）；代码块描边改 --b3-border-color
│   └── NavSidebar.scss              # [MODIFY] .cp-nav__item 纵向 padding 提到 6px 并补 :focus-visible 内嵌焦点环；__item-count 去 opacity 改 on-surface；__label 的 opacity 改 $c-muted；.cp-nav 右边框改 --b3-border-color（导航项 hover 底色保留）
├── types/index.ts                   # [MODIFY] I18n 接口新增 sizeLabel?: string（档位分组无障碍名称，注释说明用途）
└── README.md                        # [MODIFY] 「组件尺寸档位」段补充「档位切换器复用共享 Button 的分段组写法」；「舞台/沙箱」段补充 align-items: start 与 .cp-card--wide 跨列规则（dialog/drawer/megaMenu/tieredMenu）
src/i18n/zh_CN/componentPreview.json # [MODIFY] 新增 sizeLabel（如「组件尺寸档位」）
src/i18n/en_US/componentPreview.json # [MODIFY] 新增 sizeLabel（如 "Component size"）
```

## 关键代码结构

```ts
/** 需要专属舞台尺寸的分区：id → 舞台修饰类（高度值仍在 SCSS，新增组件只改这一处） */
const STAGE_CLASS_BY_GROUP: Record<string, string> = {
  loader: "cp-card__stage--loader",
  speedDial: "cp-card__stage--speeddial",
  dialog: "cp-card__stage--dialog",
  drawer: "cp-card__stage--drawer",
  megaMenu: "cp-card__stage--megaMenu",
  tieredMenu: "cp-card__stage--tieredMenu",
}
/** 需要横向空间的浮层类分区：卡片跨两列（<720px 单列时不跨列） */
const WIDE_STAGE_GROUP_IDS: string[] = ["dialog", "drawer", "megaMenu", "tieredMenu"]
```