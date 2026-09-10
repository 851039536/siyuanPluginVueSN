---
name: 新增共享组件 Paginator 并迁移三处自建分页
overview: 参考 PrimeVue Paginator，在 src/components/ 新增第 26 个共享组件 Paginator（项目风格：`page`/`rows`/`total` + 显式布尔 props；内部复用 Button/Select/Input/IconWrapper，页码窗口算法抽私有纯函数），并把 imageCompressor / flashcardReading / skillLearning 三处自建分页迁移过来，顺带消除 skillLearning 的原生 button 与字符图标。
todos:
  - id: build-paginator-core
    content: 用 [subagent:code-explorer] 复核三处迁移影响面，并新建 paginator/types.ts 与 pageLinks.ts
    status: completed
  - id: build-paginator-component
    content: 新建 Paginator.vue 与 styles/Paginator.scss，实现 page/rows/total 模型、显式 props 组成与边界兜底
    status: completed
    dependencies:
      - build-paginator-core
  - id: create-preview-data
    content: 新建 previewData/paginator.ts 接入聚合，并对页码窗口纯函数做数值断言
    status: completed
    dependencies:
      - build-paginator-component
  - id: migrate-three-sites
    content: 迁移 imageCompressor、flashcardReading、skillLearning 三处分页并清理各自样式与死代码
    status: completed
    dependencies:
      - build-paginator-component
  - id: sync-docs
    content: 同步 AGENTS.md 五处计数与清单表、README.md、componentPreview/README.md 能力与事件契约
    status: completed
    dependencies:
      - create-preview-data
  - id: arch-review-and-checks
    content: 用 [skill:universal-arch-skill] 审查并修复，再跑 read_lints、tsc 过滤与 SFC/SCSS 离线编译
    status: completed
    dependencies:
      - migrate-three-sites
      - sync-docs
---

## 产品概述

在项目共享组件库中新增第 26 个通用组件 `Paginator`（分页器），并把项目中三处自建分页统一迁移过来，消除重复实现与一处规范违规。

## 核心功能

- **分页状态**：由「当前页（1 基）+ 每页条数 + 总条数」三者驱动，页码能正确换算总页数、当前页首末条序号
- **上一页 / 下一页 / 首页 / 末页**：首末跳转可整体开关；到达边界时对应按钮自动禁用
- **页码链接**：按页码窗口大小（默认 5 个）滑动展示，两端超出部分折叠为省略号，首页与末页始终可见
- **数字页码报告**：默认展示「当前页 / 总页数」形式的状态文本（如 `1 / 3`），展示内容与位置可配置，也支持 `{page}`、`{totalPages}`、`{rows}`、`{first}`、`{last}`、`{total}` 占位符自定义
- **每页条数切换**：可选下拉，候选项既支持纯数字，也支持带本地化文案的选项（如「30/页」）；切换后自动回到第 1 页
- **跳页输入**：可选，输入页码后回车或失焦跳转；非法/越界输入自动收敛到合法范围
- **单页隐藏**：可配置只有一页时是否仍显示整块分页
- **整体禁用**：禁用时所有子控件不可操作
- **四档尺寸**：`xsmall` / `small` / `medium` / `large`（默认 `small`），与全库控件尺寸阶梯一致

## 视觉呈现

- 与项目现有分页完全同源：导航按钮为项目统一的文字型按钮外观（悬停弱底色、键盘焦点环、禁用降透明度），页码链接选中态用主色实底/主色文字表达，未选中为中性文字
- 整块为单行横向排布，控件间保持项目统一间距；页码链接、报告文本、下拉、跳页输入在同一行内对齐
- 页码链接的选中态与项目既有的「分段组」观感一致（选中强对比、未选中弱对比），不引入新的视觉语言
- 数字文本使用等宽数字，避免页码跳动时宽度抖动

## 迁移后的统一效果

- 三处旧分页（图片压缩工具栏、卡片列表视图、技能列表）统一为同一控件、同一配色与尺寸，彻底消除「一处用原生按钮 + 字符当图标、另两处按钮配色不一致」的问题
- 三处原有文案（首页/上一页/下一页/末页、每页条数模板）继续生效，用户可见文本零变化

## 技术栈

- Vue 3.5.42（`<script setup lang="ts">` + `defineProps` / `defineEmits` / `defineExpose` / `withDefaults`）+ TypeScript
- SCSS（项目既有 `_variables.scss` 设计 Token 与 `styles/_mixins.scss`），样式外置到 `src/components/styles/Paginator.scss`
- **零新依赖**：内部全部复用既有共享组件 `Button` / `Select` / `Input` / `IconWrapper`；图标只用 `src/config/icons.ts` 已注册的 `chevronLeft` / `chevronRight` / `chevronDoubleLeft` / `chevronDoubleRight`（**零图标新增**）
- 私有实现目录 `src/components/paginator/`（照 `datePicker/`、`select/`、`textarea/`、`speedDial/` 既有范式）

## 实施方案

### 总体策略

新增公开组件 `src/components/Paginator.vue`（平铺，保持 `import Paginator from "@/components/Paginator.vue"` 单一导入约定），把「页码窗口折叠算法」与「类型 / 默认文案常量」下沉到同名小写私有目录 `src/components/paginator/`；组件内部**不复制任何按钮样式**，导航按钮与页码链接都是共享 `Button`，每页条数下拉是共享 `Select`，跳页输入是共享 `Input` —— Paginator 只负责「状态换算 + 组成编排 + 边界兜底 + 无障碍」。

随后把三处自建分页迁移过来，并删除各自被取代的样式与死代码。

### 关键决策与取舍

| 决策 | 理由 |
| --- | --- |
| 状态模型用 `page`(1 基) / `rows` / `total`，而非 PrimeVue 的 `first`(零基行偏移) / `rows` / `totalRecords` | 用户选定。三处迁移点现有心智都是 `currentPage`(1 基) / `totalPages`，迁移只需换数据源、无需零基换算，调用方无认知负担 |
| 组成控制用显式 props（`showFirstLast` / `showPageLinks` / `pageLinkSize` / `showReport` / `rowsPerPageOptions` / `showJumpInput` / `alwaysShow` / `disabled`） | 用户选定。`interface Props` 即文档、类型安全，与项目其他共享组件惯例一致；不引入 PrimeVue v5 的 `template` 字符串（弱类型 + 需自写解析器与容错） |
| `rowsPerPageOptions` 类型放宽为 `Array<number \ | SelectOption>` | `imageCompressor` 现有下拉的 label 由 i18n 模板 `"{num}/页"` 生成。若只支持 `number[]`，迁移会丢掉本地化文案并使 i18n 键变成孤儿；放宽后可直接把现有 `SelectOption[]` 透传给共享 `Select` |
| 默认 `reportTemplate` 取 `"{page} / {totalPages}"` | 三处现状都是 `{{ currentPage }} / {{ totalPages }}`，该默认值可精确复现「1 / 3」，迁移零文案变化 |
| 新增 `labels` prop + `DEFAULT_LABELS` 中文兜底 | 组件内禁止硬编码中文 UI 文案，但项目允许「中文默认 prop 值」（先例：`Select.clearLabel` 默认「清除」、`DatePicker` 的 `DEFAULT_ARIA_LABELS` + `ariaLabels` 覆盖）。`labels` 承载导航按钮的 `aria-label`，调用方可覆盖为项目 i18n 文案，且三处迁移经由它继续消费现有 i18n 键 ⇒ **零 i18n 分片改动、无孤儿键** |
| `rows` 变更时自动回到第 1 页 | 与 `imageCompressor` 现有行为一致（其下拉 `@update:model-value` 里就是 `pageSize = v; currentPage = 1`），迁移后零行为差异 |
| `page` 越界自动收敛并回派 `update:page` | `total` / `rows` 变化后若 `page > totalPages`，会停在空页并显示「第 3 / 2 页」这类脏状态，必须收敛 |
| 默认 `showPageLinks: true`（对齐 PrimeVue 默认观感），但**三处迁移显式传 `:show-page-links="false"`** | 三处现状都没有页码链接。默认开启保持组件自身能力完整；迁移处显式关闭以做到「观感与迁移前完全一致」，需要页码链接的场景再自行开启。**此点为预设，需在方案中标注供用户确认** |
| 三处迁移统一改用 `:always-show="false"` | 取代各自外层的 `v-if="totalPages > 1"` / `v-if="paginated"` 守卫，使调用方模板更简单，并让 `flashcardReading` 的 `totalPages` computed 变成死代码（可删除） |
| 不做 `start` / `end` 具名插槽 | 三处迁移都不需要；且具名插槽无法在预览快照呈现，会额外增加 `componentPreview/README.md` 的登记负担。需要「共 N 条」时调用方在外部包一层 flex 行即可 |
| 不做 PrimeVue 的各图标槽 | 与项目「图标集中注册、`IconKey` 查表」硬规则冲突 |
| 不做 `pt` / `dt` / `ptOptions` / `unstyled` | 项目无 PassThrough 与 design-token 覆盖体系 |


### 无障碍与键盘

- 导航按钮用纯图标 `Button`（`chevron*`），必须给 `aria-label`（取 `labels` / `DEFAULT_LABELS`），满足「纯图标按钮必须有无障碍名称」约定
- 页码链接按钮用 `:aria-pressed` 表达选中态（沿用项目分段组范式），并附 `aria-label`（如「第 3 页」）
- 数字报告区加 `aria-live="polite"`，翻页后屏幕阅读器可播报当前页
- 跳页输入用共享 `Input`（数字语义），回车提交、失焦收敛；`disabled` 时全部子控件禁用
- 键盘可达性完全交给原生 `<button>` / `<select>` / `<input>`（共享组件均基于原生元素），不自造键盘逻辑

### 性能与可靠性

- 页码窗口为**一次 `computed`**：O(pageLinkSize) 产出 `Array<number | "ellipsis">`，无嵌套循环、无逐帧计算
- 所有派生（`totalPages` / `first` / `last` / `pageLinks`）均为 `computed`，模板只读；页码链接列表加稳定的 `:key`
- 组件无定时器、无 `ResizeObserver`、无 `document` 监听、无 `:deep()` 覆写共享组件内部样式（不触碰 Button/Select/Input 内部结构）
- 边界兜底必须覆盖：`rows <= 0` / 非整数 ⇒ 兜底为 `1`（否则 `Math.ceil(total / 0)` 得 `Infinity`）；`total <= 0` ⇒ `totalPages = 1`；`page < 1` 或 `page > totalPages` ⇒ 收敛并回派
- 越界收敛放在 `watch` 中并判定「仅在真的需要改时才派发」，避免 `update:page` 回环

## 架构设计

组件位于共享组件层，仅依赖同层 `Button` / `Select` / `Input` 与设计 Token，无业务耦合；私有目录承载纯算法与类型。

```mermaid
graph LR
  A["imageCompressor"] --> P["Paginator.vue"]
  B["flashcardReading"] --> P
  C["skillLearning/SkillListView"] --> P
  D["预览面板 previewData/paginator.ts"] --> P
  P --> E["Button.vue 导航与页码链接"]
  P --> F["Select.vue 每页条数"]
  P --> G["Input.vue 跳页"]
  P -.->|纯函数| H["paginator/pageLinks.ts"]
  P -.->|类型与默认文案| I["paginator/types.ts"]
  P -.->|@use| J["styles/Paginator.scss"]
  M["useFilteredCards.ts 增补返回 pageSize"] -.-> C
```

数据流：`page` / `rows` / `total` 入参 → `computed` 派生 `totalPages` / `first` / `last` / `pageLinks` → 用户操作导航按钮或页码 → 派发 `update:page`（实时跟随）+ `change`（一次性提交，载荷含完整分页状态）→ 调用方更新状态并重新切片数据。`rows` 变更时组件内部先回落第 1 页再派发。

## 目录结构

```
siyuanPluginVueSN/
├── src/
│   ├── components/
│   │   ├── Paginator.vue                    # [NEW] 公开入口（平铺）
│   │   ├── paginator/                       # [NEW] 私有实现目录（禁止 feature 直接导入）
│   │   │   ├── types.ts                     # 类型 + DEFAULT_LABELS + 默认常量
│   │   │   └── pageLinks.ts                 # 页码窗口折叠纯函数
│   │   └── styles/
│   │       └── Paginator.scss               # [NEW] 布局与页码链接选中态（无按钮外观）
│   └── features/
│       ├── componentPreview/
│       │   ├── previewData/
│       │   │   ├── paginator.ts             # [NEW] 预览清单（双导出）
│       │   │   └── index.ts                 # [MODIFY] 接入聚合
│       │   └── README.md                    # [MODIFY] 计数 + 能力 + 事件契约
│       ├── imageCompressor/
│       │   ├── index.vue                    # [MODIFY] 迁移分页块
│       │   └── styles/index.scss            # [MODIFY] 删除 .pagination-controls / .page-info
│       ├── flashcardReading/
│       │   ├── index.vue                    # [MODIFY] 迁移分页块 + 删除死代码 totalPages
│       │   └── styles/index.scss            # [MODIFY] 删除 .pagination / .page-info
│       └── skillLearning/
│           ├── components/SkillListView.vue # [MODIFY] 迁移（消除原生 button 与字符图标）
│           ├── composables/useFilteredCards.ts  # [MODIFY] 返回中增补 pageSize（向后兼容）
│           └── styles/SkillListView.scss    # [MODIFY] 删除 .skill-list-view__pagination
├── AGENTS.md                                # [MODIFY] 5 处计数 + 清单表行 + 复用枚举
└── README.md                                # [MODIFY] 共享组件计数
```

## 关键代码结构

```ts
// src/components/paginator/pageLinks.ts
/** 页码窗口：数字为可点击页码，"ellipsis" 为折叠点 */
export type PageLink = number | "ellipsis"
/**
 * 解析要展示的页码窗口：窗口大小固定，首末页恒显，
 * 超出一侧的页码折叠为单个省略号；totalPages 较小时直接全量返回。
 */
export function resolvePageLinks(page: number, totalPages: number, pageLinkSize: number): PageLink[]
```

```ts
// src/components/Paginator.vue（Props 契约，供调用方与预览清单对齐）
interface Props {
  page?: number          // 1 基当前页
  rows?: number          // 每页条数
  total?: number         // 总条数
  size?: "xsmall" | "small" | "medium" | "large"
  showFirstLast?: boolean        // 首页/末页
  showPageLinks?: boolean        // 页码链接
  pageLinkSize?: number          // 页码窗口大小
  showReport?: boolean           // 数字报告
  reportTemplate?: string        // 默认 "{page} / {totalPages}"
  rowsPerPageOptions?: Array<number | SelectOption>
  showJumpInput?: boolean
  alwaysShow?: boolean           // 默认 true，单页时是否仍显示
  disabled?: boolean
  labels?: PaginatorLabels       // 覆盖 DEFAULT_LABELS（导航按钮 aria-label）
}
interface Emits {
  (e: "update:page", value: number): void
  (e: "update:rows", value: number): void
  (e: "change", payload: PaginatorChangePayload): void   // { page, rows, total, totalPages, first, last }
}
```

## 实施要点（防止返工）

- **类型下沉与对外路径**：`.ts` 不得 `import type { X } from "@/components/Y.vue"`（tsc 不解析 `.vue` 导出 ⇒ `TS2614`）⇒ 类型全部放 `paginator/types.ts`，`Paginator.vue` 里用**类型别名再导出**保住 `@/components/Paginator.vue` 对外路径（照 `select/types.ts` + `Select.vue` 既有解法）
- **`SelectOption` 只应从 `@/components/Select.vue` 导入**（24 个文件已依赖该路径，导出路径不可变）
- **迁移必须清理死代码**：迁移后若 `totalPages` / `paginated` 等绑定在模板中不再被使用，须同步删除对应的 `ref` / `computed`（`flashcardReading` 的 `totalPages`、`SkillListView` 的 `paginated` 命中此条），否则 ESLint 报未使用变量
- **`useFilteredCards.ts` 只能增不能删**：它被 `SkillListView.vue` 与 `FlashcardView.vue` 两个消费者共用，迁移前先用 code-explorer 复核 `FlashcardView.vue` 的解构字段，**只增补 `pageSize` 与其接口字段**，不得移除 `paginated` / `totalPages`
- **`imageCompressor` 的 `pageSizeOptions` computed 不要删**：它已返回 `{ value, label }[]`，正好匹配放宽后的 `rowsPerPageOptions`，直接透传即可，保住 i18n 文案；模板里内联的「切页大小重置到第 1 页」逻辑由组件内部承担，可整段删除
- **预览清单 props 里的图标与选项必须人工核对**：`previewData` 的 `props` 为无编译期约束的映射，图标键必须是已注册 `IconKey`（写 `mdi:xxx` 原样不渲染），`rowsPerPageOptions` 的 label 用纯数字或字符串
- **不可修改** `Button.vue` / `Select.vue` / `Input.vue` / `IconWrapper.vue` 与 `Button.scss`（180+ 处调用与既有 variant 语义不可动）
- **边界**：`rows` 兜底为 `Math.max(1, rows)`；`alwaysShow: false` 且 `totalPages === 1` 时整块不渲染（可与调用方原有的 `v-if` 守卫等价替换）
- **验证可分两层**：`pageLinks` 是纯函数，可用 esbuild 转 CJS 后做数值断言（覆盖：总页数小于窗口、当前页居中、当前页贴左/贴右、两端折叠、`totalPages = 1`）；`.vue` 用 `@vue/compiler-sfc` 端到端离线编译；SCSS 用 Sass 离线编译并核对选择器展开

## 需同步的文档（当前计数均为 25，新增后为 26）

- `AGENTS.md`：**160**（全项目唯一 UI 控件来源）、**168**（预览面板说明）、**181**（「### 3. 组件清单（25 个）」标题）、**450**（目录树 `components/` 注释）、**488**（规则分片索引表 `componentPreview/README.md` 行）；组件清单表在 `SpeedDial.vue` 行附近新增 `Paginator.vue` 行；**177** 行「优先复用」枚举补「分页」
- `README.md`：**148** 行 `├── components/  # 共享 UI 组件（25 个原子组件）`
- `src/features/componentPreview/README.md`：**第 3 行**（全部 25 个组件）、**第 8 行**（「全组件覆盖」按字母序插入 `Paginator`）、**第 19 行**（`sizeable` 列表插入 `Paginator`）；新增一条能力说明（`page`/`rows`/`total` 模型、显式 props 组成、页码窗口折叠、`rowsPerPageOptions` 支持 `SelectOption`、`reportTemplate` 占位符、`alwaysShow: false`）；「事件契约」表新增一行（`update:page` / `update:rows` / `change`）；本组件**无具名插槽**，「具名插槽」表无需新增行

## 验证链条

```
pnpm lint           # AI 禁止执行
pnpm i18n:verify    # 本任务不改 i18n 分片，预期无变化；同时用于确认无孤儿键
pnpm validate:icons # 不新增图标，预期无变化
npx tsc --noEmit    # AI 可执行（不解析 .vue，故须配合 SFC 离线编译）
```

AI 可执行：`read_lints`（偶有陈旧诊断，须读回代码核对）、`npx tsc --noEmit`（过滤新增与迁移文件路径）、`@vue/compiler-sfc` 端到端离线编译、Sass 离线编译、esbuild 转 CJS 后的纯函数数值断言（临时脚本用完即删）。

## Agent Extensions

### Skill

- **universal-arch-skill**
- Purpose: 对新增的 `Paginator` 组件与三处迁移点执行架构合规审查（模式 C：目录规范、样式分离、设计 Token、命名一致性、单文件行数、私有目录隔离、统一入口），并确认迁移后不再存在「原生 button / 字符当图标」等硬规则违规
- Expected outcome: 输出合规结论与待修项清单并完成修复，使新组件与既有 25 个共享组件的规范水位一致；重点核对 `.vue` 内仅 `@use`、SCSS 零硬编码颜色与字体三要素、`paginator/` 私有目录未被 feature 直接导入、共享组件内无 `@/features` 导入，以及三处迁移点已彻底清除被取代的样式与死代码

### SubAgent

- **code-explorer**
- Purpose: 在动手迁移前复核三处迁移点的完整影响面 —— 尤其 `useFilteredCards.ts` 被 `SkillListView.vue` 与 `FlashcardView.vue` 双消费者共用的情况，以及 `imageCompressor` / `flashcardReading` 中 `currentPage` / `totalPages` / `paginated` / `pageSize` 的全部引用点，避免遗漏引用导致删除死代码后编译或运行报错
- Expected outcome: 产出「文件 → 引用点 → 迁移动作（保留 / 改造 / 删除）」的清单，明确哪些绑定可以安全删除、哪些必须保留（如 `FlashcardView.vue` 依赖的 composable 返回字段），作为迁移步骤的施工依据