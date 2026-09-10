---
name: 新增共享组件 SpeedDial
overview: 参考 PrimeVue SpeedDial，在 src/components/ 新增独立公开组件 SpeedDial（浮动动作按钮展开多动作）：自带角落定位档位（默认 fixed）、四档展开轨迹（linear/circle/semi-circle/quarter-circle + radius）、8 方向、动作气泡（思源 b3-tooltips）、主按钮图标旋转、三种具名插槽、buttonProps/actionButtonProps 透传，并落实官方 menu/menuitem 无障碍与键盘；配套预览清单、预览沙箱覆盖与文档计数（24→25）。
design:
  architecture:
    framework: vue
  styleKeywords:
    - Codex 组件体系继承
    - 圆形浮钮
    - 轨迹生长动画
    - 逐项递增延迟
    - 角落悬浮
  fontSystem:
    fontFamily: PingFang-SC
    heading:
      size: inherit
      weight: .nan
    subheading:
      size: inherit
      weight: .nan
    body:
      size: 10px / 12px / 14px / 16px（随四档尺寸，继承 Button 档位阶梯）
      weight: 500
  colorSystem:
    primary:
      - "#C97A5D"
    background:
      - "#FFFFFF"
      - "#F7F7F5"
    text:
      - "#0F0D0B"
      - "#9E9A96"
    functional:
      - "#E0DEDA"
      - "#E5484D"
todos:
  - id: create-speeddial-core
    content: 新建 speedDial/types.ts 与 geometry.ts：动作类型、8 向角度表、四档轨迹偏移纯函数
    status: completed
  - id: create-speeddial-component
    content: 新建 SpeedDial.vue 与 styles/SpeedDial.scss：角落定位、展开编排、气泡、图标旋转、键盘与 ARIA
    status: completed
    dependencies:
      - create-speeddial-core
  - id: create-preview-and-sandbox
    content: 新建 previewData/speedDial.ts 并接入聚合；补预览沙箱覆盖（PreviewSection.vue 与 .scss）
    status: completed
    dependencies:
      - create-speeddial-component
  - id: sync-docs
    content: 同步 AGENTS.md 五处计数与清单表、README.md、componentPreview/README.md 计数/能力/插槽/事件登记
    status: completed
    dependencies:
      - create-preview-and-sandbox
  - id: arch-review
    content: 用 [skill:universal-arch-skill] 审查样式分离、设计 Token、私有目录隔离与命名合规性并修复待修项
    status: completed
    dependencies:
      - create-speeddial-component
  - id: verify-static-checks
    content: 执行 read_lints、tsc 过滤、SFC 与 SCSS 离线编译核验，输出用户侧验证与目视回归清单
    status: completed
    dependencies:
      - arch-review
      - sync-docs
---

## 用户需求

参考 `https://primevue.dev/speeddial/`，在项目共享组件库（`src/components/`）中新增第 25 个通用组件 `SpeedDial` —— 一个悬浮于界面角落的浮动动作按钮：点击主按钮后展开一组快捷动作。

## 产品概述

界面上一个圆形主按钮，按下后在指定方向/轨迹上展开多个动作按钮；再次点击、点击组件外部或按 `Esc` 收起。每个动作带图标与气泡文案，可单独设置配色与禁用态。

## 核心功能

- **展开与收起**：主按钮点击切换；`visible` 受控；`Esc` 关闭并把焦点返还主按钮；`hideOnClickOutside`（默认开启，可显式关闭）点击组件外部收起
- **8 向展开方向**：上 / 下 / 左 / 右 / 左上 / 右上 / 左下 / 右下
- **四档展开轨迹**：`linear` 直线、`circle` 整圆、`semi-circle` 半圆、`quarter-circle` 四分之一圆；三种曲线轨迹支持自定义半径，扇区中心始终对准所选方向
- **动作列表**：每项含图标、文案、可选配色与禁用态；点击调用该项回调并向上抛出选择事件
- **逐项递增延迟**：动作按顺序依次出现，可配置每项延迟毫秒数
- **主按钮图标旋转**：展开时主按钮图标旋转（可指定展开态独立图标），带过渡动画
- **角落悬浮定位**：默认固定于视口右下角，可在四个角落间切换并按档位调整边距
- **动作气泡**：悬停动作显示文案气泡（同时作为无障碍名称）
- **自定义模板**：可整块替换主按钮、主按钮图标、每个动作项
- **四档尺寸**：`xsmall` / `small` / `medium` / `large`（默认 `small`），与全库按钮尺寸阶梯一致，且直接影响直线轨迹的项间距

## 视觉呈现

- 主按钮与动作按钮均为圆形浮钮，外观、悬停反馈、键盘焦点环、禁用态**全部沿用库内既有按钮视觉**（不新增按钮样式），配色可经透传参数调整
- 展开时动作按钮按选定轨迹排布，带「淡入 + 位移」动画，逐项递增延迟形成依次弹出的节奏；收起为反向淡出
- 悬浮于界面角落、不占布局空间；展开时动作向指定方向生长，气泡出现在动作的侧方

## 技术栈选择

- Vue 3.5.42（`&lt;script setup lang="ts"&gt;` + `defineProps` / `defineEmits` / `defineExpose` / `useId`）+ TypeScript
- SCSS（项目既有 `_variables.scss` 设计 Token 与 `styles/_mixins.scss`）
- **复用既有共享组件**：`Button.vue`（主按钮与全部动作按钮）、`IconWrapper.vue`（经 `Button` 间接使用）；**零新依赖**
- 动作气泡复用**思源内置 `b3-tooltips` + `b3-tooltips__{方向}` 类 + `aria-label`**（项目已有 2 处先例，无新依赖）

## 实施方案

### 总体策略

新增**公开组件** `src/components/SpeedDial.vue`（平铺，保持 `import SpeedDial from "@/components/SpeedDial.vue"` 单一导入约定），并把几何计算、类型、开合编排下沉到**同名小写私有子目录** `src/components/speedDial/`（照 `datePicker/` / `select/` / `textarea/` 既有范式，禁止 feature 直接导入）。组件内部**不复制任何按钮样式**——主按钮与动作按钮都是共享 `Button`，SpeedDial 只负责「定位 + 轨迹排布 + 开合编排 + 无障碍」。

### 关键决策与取舍

| 决策 | 说明 |
| --- | --- |
| 定位用**类输出**而非内联样式 | 四个角落档位写为 `.si-speeddial--bottom-right { position: fixed; right: var(--si-speeddial-offset); bottom: var(--si-speeddial-offset) }`，边距经 CSS 变量单点驱动。理由：①预览沙箱可用**一条规则**覆盖为 `absolute`；②调用方可直接覆写；③避免 4 档各写一遍内联样式 |
| 边距用 CSS 变量而非 Sass 循环 | 沿用 `DatePicker.scss` 的 `--dp-*`、`Slider.scss` 的 `--si-slider-*`、`Textarea` 的档位变量范式，Sass 中 CSS 变量值必须插值 `#{$var}` |
| 几何计算抽为纯函数 | `speedDial/geometry.ts` 只依赖「方向 + 轨迹 + 半径 + 项数 + 按钮边长 + 间隙」，输出每项的 `translate(x, y)`；与 Vue 响应式解耦、可独立验证，且把入口文件行数压回 300 警戒线内 |
| **新增 `size` prop**（PrimeVue 无） | 直线轨迹的项间距、曲线轨迹的按钮占位都依赖按钮实际边长（icon-only 档位为 22/28/36/44px）。故把 `size` 提升为显式 prop，同时把几何与按钮尺寸统一到同一数据源；文档注明「尺寸请用 `size`，不要经 `buttonProps.size` 覆盖，否则几何与渲染会脱节」 |
| **`hideOnClickOutside` 默认开启** | 该项在澄清问卷中因题目为单选而未勾选；按 PrimeVue 默认值（`true`）与浮层基本可用性保留为默认开启并提供同名 prop。**此点为预设，已在方案中显式标注** |
| **不做 `mask`** | 问卷未勾选，且与 PrimeVue 默认值（`false`）一致；同时避免预览沙箱需额外覆盖遮罩 |
| 不做 `unstyled` / `pt` / `ptOptions` / `dt` | 项目无 PassThrough 与 design-token 覆盖体系 |
| 不做 `itemicon` 插槽 | PrimeVue 该插槽 scope 含 `class` 直通语义，与本项目「图标一律走 `IconKey`」的规则冲突；只做 `item` / `button` / `icon` 三种 |
| 不接入任何 feature | 与既有 24 轮共享组件新增一致：仅新增组件 + 预览 + 文档，不动业务代码 |


### 无障碍与键盘（对齐 PrimeVue 官方约定，必须落实）

- 主按钮：`aria-label`（不传则 DEV 告警，对齐 `Button.vue` 与 `ToggleButton.vue` 的既有做法）、`aria-haspopup="menu"`、`aria-expanded`、`aria-controls`（指向列表容器 id，用 `useId()` 生成）
- 列表容器：`role="menu"` + `aria-labelledby` 指向主按钮
- 动作项：`role="menuitem"` + `aria-label`（取 `action.label`）
- 键盘：`Enter` / `Space` 切换显隐；方向键在动作项间移动焦点；`Home` / `End` 到首/末项；`Esc` 关闭并**把焦点返还主按钮**
- 焦点策略沿用 `Select` 的既有结论：**仅键盘触发才把焦点移入首项**，鼠标点击不抢焦点；`Esc` 才返还焦点

### 性能与可靠性

- 轨迹排布为一次 `computed`：`O(n)` 遍历动作项产出 `transform`，无嵌套循环、无逐帧计算
- 动画只用 `transform` + `opacity`（GPU 友好），过渡统一 `0.12s`；逐项延迟经 `transition-delay: index * transitionDelay` 内联输出，不写 `n` 条规则
- 外部点击监听在 `onMounted` 注册、`onBeforeUnmount` **成对解绑**（照 `DatePicker.vue` 的 document click 成对写法）；无 `ResizeObserver`、无定时器、无 DOM 查询
- 曲线轨迹在 `n === 1` 时退化为「沿方向单位向量 × 半径」，避免除零（`step = 跨度 / (n - 1)` 仅在 `n &gt; 1` 时计算）
- attrs 处理与 `Select` / `Slider` 一致：根元素承载 `class` / `style` 与其余 attrs

## 架构设计

组件位于共享组件层，仅依赖同层 `Button` / `IconWrapper` 与设计 Token，无业务耦合；私有目录承载纯逻辑。

```mermaid
graph LR
  A["feature 调用方"] -->|import| B["SpeedDial.vue"]
  B --> C["Button.vue 主按钮"]
  B --> D["Button.vue 动作项 xN"]
  B -.->|纯函数| E["speedDial/geometry.ts"]
  B -.->|类型与常量| F["speedDial/types.ts"]
  B -.->|开合与键盘编排| G["speedDial/useSpeedDial.ts"]
  B -.->|@use| H["styles/SpeedDial.scss"]
  I["componentPreview/previewData/speedDial.ts"] -->|真实渲染快照| B
  J["PreviewSection 沙箱覆盖"] -.->|fixed 改 absolute| B
```

数据流：点击主按钮 → `toggleVisible()` → emit `update:visible` + `show`/`hide` → 动作列表按 `--open` 态切换透明度与 `transform`（逐项 `transition-delay`）→ 点击动作项 → 调 `action.onClick` 并 emit `select` 后收起。

## 目录结构

```
siyuanPluginVueSN/
├── src/
│   ├── components/
│   │   ├── SpeedDial.vue                     # [NEW] 公开入口
│   │   ├── speedDial/                        # [NEW] 私有实现目录（禁止 feature 直接导入）
│   │   │   ├── types.ts                      # 类型 + 8 向角度常量表
│   │   │   ├── geometry.ts                   # 轨迹偏移纯函数
│   │   │   └── useSpeedDial.ts               # 开合 / 外部点击 / 键盘 / 焦点编排
│   │   └── styles/
│   │       └── SpeedDial.scss                # [NEW] 位置档位 / 开合态 / 过渡 / 图标旋转
│   └── features/
│       └── componentPreview/
│           ├── components/
│           │   └── PreviewSection.vue        # [MODIFY] 追加 cp-card__stage--speeddial 类判定
│           ├── styles/
│           │   └── PreviewSection.scss       # [MODIFY] 追加 SpeedDial 沙箱覆盖 + 舞台高度
│           ├── previewData/
│           │   ├── speedDial.ts              # [NEW] 预览清单（双导出）
│           │   └── index.ts                  # [MODIFY] 接入聚合
│           └── README.md                     # [MODIFY] 计数 + 能力 + 具名插槽 3 行 + 事件契约
├── AGENTS.md                                 # [MODIFY] 5 处计数 + 清单表行 + 复用枚举
└── README.md                                 # [MODIFY] 共享组件计数
```

### 文件明细

- **`src/components/SpeedDial.vue`** [NEW]
- 职责：公开入口，只留模板 + props/emits 契约 + 编排调用
- 实现要求：第 1 行 `.vue` 文件头注释；根 `div.si-speeddial`（`--open` / 位置档位 / `--{size}` 类）；内部为「动作列表容器 `role="menu"`」+「主按钮」两节点；主按钮与动作项均用共享 `Button`（传 `rounded`、`icon`、`iconSize`、`size`、`severity`、`disabled`、`ariaLabel`，动作项额外经 attr fallthrough 落 `role="menuitem"` 与 `b3-tooltips b3-tooltips__{dir}` 类）；`buttonProps` 展开在前、内部固定值在后（或反之，需在实现时定序并在文档写明）；`&lt;style scoped lang="scss"&gt;` 内**仅** `@use './styles/SpeedDial.scss';`；行数控制在 300 警戒线内，超出则继续下沉到 `speedDial/`
- **`src/components/speedDial/types.ts`** [NEW]
- 职责：纯 TS 类型与常量单一数据源
- 内容：`SpeedDialAction` / `SpeedDialDirection` / `SpeedDialType` / `SpeedDialPosition` / `SpeedDialSize` / `TooltipSide`；**8 向角度表**（`right 0` / `down-right 45` / `down 90` / `down-left 135` / `left 180` / `up-left 225` / `up 270` / `up-right 315`，屏幕 y 向下为正）；各档 `size` 对应的按钮边长表（22/28/36/44，与 `Button.scss` 的 icon-only 档位一致，改动需同步两处并加注释）
- **`src/components/speedDial/geometry.ts`** [NEW]
- 职责：轨迹偏移纯函数，不依赖 Vue 响应式
- 实现要求：`linear` 沿方向单位向量按「按钮边长 + 间隙」步进；`circle` 均分 360° 且起始角使扇区中心对准方向；`semi-circle` 跨 ±90°（`n &gt; 1` 时 `step = 180 / (n - 1)`）；`quarter-circle` 跨 ±45°（`step = 90 / (n - 1)`）；`n === 1` 三种曲线退化为「方向单位向量 × radius」；输出每项 `{ x, y }` 像素偏移
- **`src/components/speedDial/useSpeedDial.ts`** [NEW]
- 职责：开合状态（受控 `visible` + 内部兜底）、外部点击关闭（`onMounted` / `onBeforeUnmount` 成对）、`Esc` 关闭并返还焦点、方向键 / `Home` / `End` 的项间焦点移动、容器与按钮 id 生成
- 依赖注入：按项目强制范式接收外部 `ref` / 回调，不内部 import 其它 composable
- **`src/components/styles/SpeedDial.scss`** [NEW]
- 位置四档（`--si-speeddial-offset` 单点驱动，默认 `$spacing-4`）、`--open` 态、动作项过渡与初始 `opacity: 0` + 位移、主按钮图标旋转（`transform: rotate(45deg)` + `transition: transform 0.12s`）、焦点态沿用 `Button` 的 `:focus-visible`
- **禁止硬编码颜色/间距/圆角/字体三要素**；错误色用 `--b3-theme-error`（**`--b3-theme-destructive` 从未定义，禁止使用**）；需要可见的分隔线用 `--b3-border-color`
- **`src/features/componentPreview/previewData/speedDial.ts`** [NEW]
- 双导出 `speedDialGroup` + `speedDialPreviewGroups`；`sizeable: true`；示例覆盖：四档轨迹各一、8 向代表、气泡、图标旋转、`hideOnClickOutside=false`、禁用、动作项禁用、四档尺寸
- **清单 props 里的图标键必须写已注册的语义 `IconKey`**（写 `mdi:xxx` 原样不渲染）
- **`src/features/componentPreview/components/PreviewSection.vue`** [MODIFY]
- 在第 25-28 行的 `:class` 对象中追加 `'cp-card__stage--speeddial': group.id === 'speedDial'`（与既有 `--loader` 判定同处）
- **`src/features/componentPreview/styles/PreviewSection.scss`** [MODIFY]
- 在 `.cp-card__stage` 块（第 60-76 行）内追加 `.si-speeddial { position: absolute }` 类覆盖（**仅沙箱，不改组件本体**），并新增 `.cp-card__stage--speeddial { height: … }` 保证展开态可见
- **`src/features/componentPreview/previewData/index.ts`** [MODIFY] / **`AGENTS.md`** / **`README.md`** / **`componentPreview/README.md`** [MODIFY]：见下节计数与登记

### 需同步的文档（当前计数均为 24，新增后为 25）

- `AGENTS.md`：**160**（全项目唯一 UI 控件来源）、**168**（预览面板说明）、**181**（「### 3. 组件清单（24 个）」标题）、**450**（目录树 `components/` 注释）、**488**（规则分片索引表 `componentPreview/README.md` 行）；组件清单表在 `Button.vue` / `ToggleButton.vue` 附近新增 `SpeedDial.vue` 行；**177** 行「优先复用」枚举补「浮动动作按钮」
- `README.md`：**148** 行 `├── components/  # 共享 UI 组件（24 个原子组件）`
- `src/features/componentPreview/README.md`：**第 3 行**、**第 8 行**（按字母序插入 `SpeedDial`）、**第 19 行**（`sizeable` 列表插入 `SpeedDial`）、新增一条能力说明（定位档位、四档轨迹、气泡用 `b3-tooltips`、无 `mask`、`hideOnClickOutside` 默认开）、**「具名插槽」表新增 3 行**（`item` / `button` / `icon`）、**「事件契约」表新增 1 行**（`update:visible` / `show` / `hide` / `click` / `select`）

## 关键代码结构

```ts
// src/components/speedDial/types.ts
export type SpeedDialDirection =
  | "up" | "down" | "left" | "right"
  | "up-left" | "up-right" | "down-left" | "down-right"
export type SpeedDialType = "linear" | "circle" | "semi-circle" | "quarter-circle"
export type SpeedDialPosition = "bottom-right" | "bottom-left" | "top-right" | "top-left"
export type SpeedDialSize = "xsmall" | "small" | "medium" | "large"

/** 单个动作（气泡文案同时作为无障碍名称，故 label 必填） */
export interface SpeedDialAction {
  key: string
  label: string
  icon?: IconKey
  /** 透传给动作按钮的 Button severity */
  severity?: ButtonSeverity
  disabled?: boolean
  onClick?: (action: SpeedDialAction, event: MouseEvent) =&gt; void
}
```

```ts
// src/components/speedDial/geometry.ts
/** 计算第 index 个动作相对主按钮的像素偏移；曲线轨迹在 n === 1 时退化为沿方向 */
export function resolveActionOffset(params: {
  index: number
  total: number
  direction: SpeedDialDirection
  type: SpeedDialType
  /** 曲线轨迹半径（px），linear 时忽略 */
  radius: number
  /** 按钮边长（px，来自 size 档位表） */
  itemSize: number
  /** linear 轨迹的项间隙（px） */
  gap: number
}): { x: number, y: number }
```

## 执行注意事项

- **AI 禁止执行** `pnpm vite build` 与 `pnpm lint`（用户自行验证）。可执行：`read_lints`（偶有陈旧诊断，命中需读回代码核对）、`npx tsc --noEmit`、`pnpm i18n:merge`、离线 node / `@vue/compiler-sfc` / sass 校验脚本（**用完即删**）
- **`.ts` 不得 `import type { X } from "@/components/Y.vue"`**（tsc 不解析 `.vue` 导出 → `TS2614`）⇒ 类型下沉 `speedDial/types.ts`，`SpeedDial.vue` 用**类型别名再导出**保住 `@/components/SpeedDial.vue` 对外路径
- **文件头注释**：`.ts` 用 `// …`，`.vue` 用 `&lt;!-- … --&gt;`，`.scss` 用 `// ========== SpeedDial.scss ==========`
- **零 i18n 改动**（组件内不硬编码中文 UI 文案，文案一律经 props）；**零 `icons.ts` 改动**（图标全部来自调用方 `IconKey` + 一个已注册的 `plus` 作主按钮默认图标）
- **不得修改** `Button.vue` / `Button.scss` / `IconWrapper.vue` 的任何代码（180+ 处调用与 5 个 variant 语义不可动）
- **共享组件内禁止 `@/features` 导入**；`speedDial/` 私有目录禁止被 feature 直接导入
- 预览 `props` 为无编译期约束的映射，**图标键与 `tooltipPosition` 取值必须人工核对**；预览示例的初始 `visible` 建议给 `true`，便于目视展开形态；动作项使用**不触发副作用的空回调**，避免预览误触发副作用

## 用户侧验证链条

```
pnpm lint           # AI 禁止执行
pnpm i18n:verify    # 本任务不涉及 i18n，预期无变化
pnpm validate:icons # 不新增图标，预期无变化
npx tsc --noEmit    # AI 可执行（注意不解析 .vue）
```

另建议在思源「组件预览」面板目视 SpeedDial 分区（四档轨迹、8 向代表、气泡、图标旋转、开合过渡与逐项延迟、四档尺寸），并确认**预览卡内不会因 `position: fixed` 铺满预览窗口**（沙箱覆盖生效）。

## 设计定位

本组件不新建视觉语言，而是**严格继承项目既有 Codex 组件体系**：主按钮与动作按钮直接使用共享 `Button` 的既有外观（圆形浮钮由 `rounded` 提供），焦点环、禁用态、悬停反馈、四档尺寸与字号阶梯全部沿用库内既有约定，因此不存在需要新设计的按钮样式。

## 视觉与交互要点

- **主按钮**：圆形浮钮，默认图标 `plus`；展开时图标旋转 45 度，`0.12s` 过渡，形成「加号转叉号」的通用手感
- **动作按钮**：与主按钮同档同尺寸的圆形浮钮，图标取自动作项 `icon`，配色可经动作项 `severity` 单独调整
- **展开动效**：动作项从主按钮位置沿轨迹方向生长（`transform` 位移 + `opacity` 淡入），逐项递增延迟（默认每项 30ms）形成依次弹出的节奏；收起为反向淡出
- **四档轨迹**：直线沿方向依次排列；整圆均分一周；半圆在方向两侧各展 90 度；四分之一圆各展 45 度
- **角落悬浮**：默认右下角，边距可调；四角落可切换，位置贴合视口边缘
- **气泡**：悬停动作时在动作侧方显示文案气泡，方向随展开方向自动反向

## 层级与间距

- 浮层层级取项目既有浮层约定值，需低于全屏遮罩层级，避免与对话框互相遮挡
- 曲线轨迹半径为独立可调值；直线轨迹项间距由「按钮边长 + 项目间距 Token」构成，保证不同尺寸档位下动作不重叠

## 响应式与可访问性

- 位置固定于视口角落，不参与文档流，不随容器滚动位移
- 键盘焦点环、`aria-expanded` / `aria-haspopup` / `role="menu"` 与 `role="menuitem"` 语义齐备；`Esc` 关闭并返还焦点，气泡文案同时作为无障碍名称

## Agent Extensions

### MCP

- **Context7**
- Purpose: 核对 PrimeVue SpeedDial 的官方契约（props 默认值、8 向 `direction` 取值、`type` 四档、`tooltipOptions` 位置枚举、emits、slots），以及官方无障碍与键盘约定
- Expected outcome: 已完成 3 次查询并锁定契约：`hideOnClickOutside` 默认 `true`、`mask` 默认 `false`、`rotateAnimation` 默认 `true`、`transitionDelay` 默认 `30`、`radius` 默认 `0`；无障碍为原生按钮 + `aria-haspopup` / `aria-expanded` / `aria-controls`，弹层 `role="menu"`、动作项 `role="menuitem"`，键盘支持 Enter/Space、方向键、Home/End、Esc 关闭并返还焦点。实现阶段仅在遇到未覆盖细节（如气泡位置后缀）时补充查询

### Skill

- **universal-arch-skill**
- Purpose: 对新增组件执行架构合规审查（模式 C：目录规范、样式分离、设计 Token、命名一致性、单文件行数、私有目录隔离、统一入口）并用模式 A 做结构校验
- Expected outcome: 输出合规结论与待修项清单并修复，确保新组件与既有 24 个共享组件的规范水位一致（重点：`.vue` 内仅 `@use`、SCSS 零硬编码颜色/字体三要素、私有目录不被 feature 导入、组件内无 `@/features` 导入）