---
name: 新增共享组件 RadioButton
overview: 参照 PrimeVue RadioButton，在 src/components/ 新增第 22 个共享组件 RadioButton（内置 label + 默认插槽、4 档尺寸、圆点描边/实底变体、disabled/readonly、hint/error 校验态），并完成 previewData 清单接入与全项目文档计数同步（21 → 22）。本次不动任何 feature 代码。
design:
  architecture:
    framework: vue
  styleKeywords:
    - Codex 设计语言
    - 暖色中性
    - 边框优先
    - 无发光阴影
    - 主题自适应
  fontSystem:
    fontFamily: PingFang SC
    heading:
      size: 16px
      weight: 500
    subheading:
      size: 14px
      weight: 400
    body:
      size: 12px
      weight: 400
  colorSystem:
    primary:
      - "#1C1917"
      - "#2B2724"
    background:
      - "#F8F8F6"
      - "#F4F3F1"
    text:
      - "#0E0C0B"
      - "#A9A6A1"
    functional:
      - "#DC2B2B"
      - "#E2E0DE"
todos:
  - id: create-radio-button
    content: 用 [mcp:Context7] 核对 PrimeVue RadioButton 语义后，新建 RadioButton.vue 与 styles/RadioButton.scss（单选组 + 二值模式 + 四档尺寸 + 描边实底 + 禁用只读校验态）
    status: completed
  - id: register-preview
    content: 新建 previewData/radioButton.ts 并在 previewData/index.ts 紧随 checkbox 分组接入，示例 props 与 code 严格一致
    status: completed
    dependencies:
      - create-radio-button
  - id: sync-docs
    content: 同步组件计数 21→22 与清单行：AGENTS.md 五处 + 组件清单表 + 复用枚举、README.md、componentPreview/README.md（含单选组快照局限说明）
    status: completed
    dependencies:
      - register-preview
  - id: update-memory
    content: 更新 .codebuddy/memory/MEMORY.md：计数改 22、新增 RadioButton 条目、改写「无共享 Radio 组件」并清理陈旧计数
    status: completed
    dependencies:
      - sync-docs
  - id: verify
    content: 用 [skill:universal-arch-skill] 做架构合规审查，并跑 read_lints 与 npx tsc --noEmit 确认无新增问题
    status: completed
    dependencies:
      - update-memory
---

## 产品概述

为插件的共享组件库新增一个「单选框（RadioButton）」原子组件，供所有功能模块在需要「一组互斥选项里选一个」时直接复用，替代目前在 feature 内各写一份原生 `<input type="radio">` + 自建样式的做法。组件视觉与交互参照 PrimeVue 的 RadioButton，并统一到项目既有的 Codex 设计语言（与同族的 Checkbox、Switch 保持一致的观感与档位）。

## 核心功能

- **单选组**：同组内多个单选项共享同一个绑定值，点击任一项即把该值切换为自己代表的值（不可取消），组内天然互斥。
- **二值模式**：不传选项值时可直接绑定布尔值，用作「是/否」这类仅一个单选项的场景。
- **两种外观变体**：描边（默认）与实底，实底在未选中时带浅色填充，强调度更高。
- **四档尺寸**：超小 / 小 / 中 / 大，默认小档；圆框与标签文字随档位同步放大，可参与全局尺寸档位切换。
- **可点击标签**：内联标签文案（或自定义内容）整行可点击；标签也可放到圆框左侧。
- **状态与校验**：禁用（整体弱化 + 禁止交互）、只读（可聚焦但不可修改）、校验失败（圆框描红并展示错误文案）、辅助说明。
- **无障碍与键盘**：沿用浏览器原生单选组行为，Tab 进入组内、方向键在选项间移动、空格选中；圆框获得焦点时展示清晰焦点环。

## 视觉与交互效果

圆框为细描边圆形，选中后内部实心圆点从小放大淡入（过渡统一 0.12s）；悬停未选中项时圆框转为主题强调色。禁用态整体降透明度并使用禁止光标，焦点态使用环形高亮轮廓，在描边与实底两种外观下均清晰可见。

## 技术栈

- **Vue 3 + TypeScript + SCSS**（项目既有栈，不新增任何依赖、不引入第三方 UI 库）
- 复用项目既有共享组件 `FormField.vue`（hint / error / size）与既有设计 Token（`@/variables.scss`、`components/styles/_mixins.scss`）
- 样式遵循项目约定：SCSS 必须从 `.vue` 外置到 `src/components/styles/<Name>.scss`，`.vue` 内只保留 `@use`

## 实现方案

### 总体策略

新增 1 个共享组件（2 个文件），完全对齐同族实现 `src/components/Checkbox.vue` 的结构、命名、事件与样式约束，只把「方框 + 勾选图标」替换为「圆框 + CSS 实心圆点」。改动面收敛在「新增组件 + 预览清单接入 + 文档计数同步」，不触碰任何 feature 代码。

### 关键决策与理由

1. **不引入 `IconWrapper`**：选中圆点是纯 CSS 实心圆（`scale(0) → scale(1)`），无需图标资源，也避免为一个圆点增加组件依赖（与 `Checkbox` 需要勾选/半选图标的情况不同）。
2. **保留原生 `radio` 语义，不自造键盘逻辑**：内部使用视觉隐藏的原生 `<input type="radio">` 承载表单语义；同组传入同一 `name` 时，Tab / ←→↑↓ / Space 的键盘行为与 ARIA 单选组语义由浏览器原生提供（与 PrimeVue 的实现思路一致），无需手写 `aria-activedescendant` 那类逻辑。
3. **`binary` 二值模式**：沿用 PrimeVue 语义（`binary` 时不传 `value`，`modelValue` 直接作为选中值）。与 `Checkbox` 不同的是**不做数组分组模式**（radio 天然单选，数组语义无意义）。
4. **校验态命名按项目约定用 `error`（非 PrimeVue 的 `invalid`）**：与 `Checkbox` 完全一致——内嵌 `FormField`，支持 `hint` 与 `error`（描红 + 文案），`error` 优先于 `hint` 显示。
5. **尺寸档位采用项目 4 档而非 PrimeVue 的 2 档**：`xsmall / small / medium / large`（默认 `small`），圆框 14/16/18/20px、标签 10/12/14/16px，与 `Checkbox`、`Switch` 严格对齐并参与预览面板全局档位切换。
6. **外观变体对齐 `Checkbox`**：`variant: "outlined" | "filled"`，复用同一套视觉语言（Codex 边框优先、实底强调）。
7. **组件自包含**：`hint` / `error` / `size` 由组件内部转交 `FormField`，调用方只写 `<RadioButton v-model=... value=... label=... />`，不需要额外包一层表单容器。

### 性能与可靠性

- 组件为纯展示 + 受控输入，无 `watch` 之外的副作用、无定时器/监听器，渲染与更新均为 O(1)。
- 仅在「受控父级忽略更新」场景下需要把状态回写原生 input：沿用 `Checkbox` 的 `nextTick(syncNativeState)` 模式，避免视觉与真实值漂移；不使用 `indeterminate`（radio 无半选态），故无需 `onMounted` 回写。

## 实现细节与注意事项（基于代码库实测）

### 组件结构（对齐 `Checkbox.vue`）

```
<div class="si-radiobutton si-radiobutton--{size} si-radiobutton--{variant} ...状态修饰符">
  <FormField :hint :error :size>
    <label class="si-radiobutton__control" [--label-before]>
      <input type="radio" class="si-radiobutton__input" ... />   <!-- 视觉隐藏 -->
      <span class="si-radiobutton__box"><span class="si-radiobutton__dot" /></span>
      <span class="si-radiobutton__label"><slot>{{ label }}</slot></span>
    </label>
  </FormField>
</div>
```

- 视觉隐藏原生 input 沿用 `Checkbox` 的 `.si-checkbox__input` 写法：`position:absolute; left/top:0; width:1px; height:1px; margin/padding/border:0; opacity:0; pointer-events:none`（`1px` 无对应 Token，需加注释）。
- `checked` 判定：`props.binary ? !!props.modelValue : props.modelValue === props.value`。
- `handleChange` 只发 `emit("update:modelValue", nextValue)`（binary 时 `nextValue = true`，否则 `nextValue = props.value`）+ `emit("change", nextValue, event)`；随后 `nextTick(syncNativeState)`。
- 只读态沿用 `Checkbox`：`handleClick` / `handleSpace` 中 `event.preventDefault()`（`disabled` 交给原生属性）。
- `defineExpose({ focus, blur, inputElement })` 与 `Checkbox` 保持一致。

### SCSS 强制约束（`src/components/styles/RadioButton.scss`，以 `Checkbox.scss` 为模板）

1. 颜色一律 `var(--b3-theme-*, $color-*)` 双保险；**错误色必须写 `--b3-theme-error`**，**禁止写 `--b3-theme-destructive`**（本项目未定义该变量，等于恒走 fallback 且暗色偏暗——已在 `Label.scss` 修过，`Tag/Slider/Badge` 尚有残留）。
2. 档位变体必须写**反向选择器**（`.si-radiobutton--xsmall & { ... }`），不能写嵌套后代链；圆框尺寸 14px（无 Token）/ `$spacing-4`(16px) / 18px（无 Token）/ `$spacing-5`(20px)。
3. **焦点环用 `outline`**（`&__input:focus-visible + &__box` + `outline-offset: 2px`），**不得用 `focus-ring` mixin**（它只改 `border-color`，实底变体边框为 transparent 时完全不可见）。
4. 圆框 `border-radius: 50%`；圆点用 `transform: scale()` 过渡；过渡统一 `0.12s ease`；禁用整体 `opacity: m.$opacity-disabled` + `cursor: not-allowed`。
5. 间距用 `$spacing-2`(8px) / `m.$gap-xs`(6px，xsmall 档)；禁止硬编码 `font-size` / `font-weight` / `line-height` / 颜色。

### 预览清单接入

- `PreviewGroup` 类型（`src/features/componentPreview/types/index.ts`）字段：`id` / `component` / `name` / `summary` / `importCode` / `sizeable?` / `examples[{title, props?, slotText?, render?, code}]`。本组件无需 `render`（`render` 是默认插槽内容，而 RadioButton 的插槽只承载标签文案，**无法在单卡片快照里渲染出「一组多个选项」**）。
- 因此**单选组语义只能通过 `code` 模板与 README 说明体现**（示例 `code` 中给出「同组共享同一 `v-model` + 同一 `name`、`value` 各异」的完整两选项写法），需在 `src/features/componentPreview/README.md` 增补一条说明。
- **硬规则：每个示例的 `props` 与 `code` 必须严格一致**（预览面板是唯一目视回归入口）。
- `PREVIEW_GROUPS` 中应紧随 `checkboxPreviewGroups` 之后插入，保持「表单类控件相邻」的稳定顺序。

### 文档计数同步（必须逐处核对，禁止凭记忆）

当前计数为 **21**，新增后为 **22**，已定位到全部 9 处：

- `AGENTS.md`：L160 `（21 个组件）`、L168 `21 个组件的**真实渲染**快照`、L181 `### 3. 组件清单（21 个）`、L449 目录树注释 `# 共享组件库 21 个（...）`、L487 分片索引引用表 `（21 个组件的用法快照...）`；另需在 L181 起的**组件清单表**中 `Checkbox.vue` 行（L195）后新增 `RadioButton.vue` 行，并在 L177 的「优先复用」控件枚举中补「单选框」。
- `README.md`：L148 `# 共享 UI 组件（21 个原子组件）`。
- `src/features/componentPreview/README.md`：L3「全部 21 个组件」、L8 全组件枚举按字母序插入 `RadioButton`、L16 `sizeable` 组件枚举加入 `RadioButton`（并按需在 L17 四档字号说明段补一句圆框/标签随档变化）。

### 风险与边界

- **禁止私自执行** `pnpm vite build` / `pnpm lint`（由用户自行验证）。允许执行的只读校验：`read_lints`、`npx tsc --noEmit`。
- 本次不新增 i18n 键、不新增图标，故 `pnpm i18n:verify` / `pnpm validate:icons` 预期无变化，无需执行。
- 共享组件只新增、不修改既有组件 API，无向后兼容风险。
- 行数控制：`RadioButton.vue` 预计 ~250 行、`RadioButton.scss` 预计 ~160 行，均在 300 警戒线内。
- `.ts` 文件不得 `import type` 任何 `.vue` 出类型（`TS2614` 陷阱）；本组件不导出类型供 `.ts` 使用，预览数据按结构化字面量书写。

## 目录结构

```
siyuanPluginVueSN/
├── src/
│   ├── components/
│   │   ├── RadioButton.vue                 # [NEW] 单选框组件本体
│   │   └── styles/
│   │       └── RadioButton.scss            # [NEW] 单选框样式（必须外置）
│   └── features/
│       └── componentPreview/
│           ├── previewData/
│           │   ├── radioButton.ts          # [NEW] RadioButton 预览分组数据
│           │   └── index.ts                # [MODIFY] 聚合入口，紧随 checkbox 分组插入
│           └── README.md                   # [MODIFY] 计数 21→22、全组件枚举、sizeable 枚举、单选组快照局限说明
├── AGENTS.md                               # [MODIFY] 5 处计数 + 组件清单表增行 + 复用枚举补「单选框」
├── README.md                               # [MODIFY] 组件数 21→22
└── .codebuddy/memory/
    └── MEMORY.md                           # [MODIFY] 组件数 21→22 + RadioButton 条目 + 改写「无共享 Radio 组件」
```

### 文件说明

- **`src/components/RadioButton.vue`**（新增，~250 行）
- 目的：提供全项目唯一的单选框控件。
- 功能：单选组 / 二值模式、四档尺寸、描边与实底变体、标签前置、禁用 / 只读 / 校验态、`update:modelValue` / `change` / `focus` / `blur` 事件、`focus()` / `blur()` / `inputElement` 暴露。
- 实现要求：文件头注释 `<!-- 单选框：单选组 / 二值模式 / 四档尺寸与描边实底变体 / 禁用只读 / 校验态 -->`；class 前缀 `si-radiobutton`，子元素 `__control` / `__input` / `__box` / `__dot` / `__label`；`interface Props` 每项加 JSDoc；`withDefaults` 默认 `binary: false`、`size: "small"`、`variant: "outlined"`、`disabled/readonly/required/autofocus/labelBefore: false`；`<style scoped lang="scss">@use './styles/RadioButton.scss';</style>` 单独收尾。
- **`src/components/styles/RadioButton.scss`**（新增，~160 行）
- 目的：单选框全部视觉与状态样式（`.vue` 内不得写样式）。
- 功能：圆框（`border-radius: 50%`）四档尺寸、圆点 `scale` 过渡、描边/实底变体、hover/error/disabled/readonly/checked 状态、`focus-visible` outline 焦点环、标签四档字号与 `--label-before` 行反转。
- 实现要求：`@use './_mixins.scss' as m;` + `@use '@/variables.scss' as *;`；档位用反向选择器；错误色用 `--b3-theme-error`；无 Token 的裸数值（1px/14px/18px）加 `// 无对应 Token` 注释。
- **`src/features/componentPreview/previewData/radioButton.ts`**（新增）
- 目的：让新组件出现在组件预览面板，作为唯一用法权威示例。
- 功能：导出 `radioButtonPreviewGroups`，含 `RadioButton` 单分组；示例覆盖：未选中 / 选中（含同组 `name` 写法）/ 二值模式 / 四档尺寸 / 实底变体 / 标签在前 / 纯圆框无标签 / 辅助说明 / 错误状态 / 禁用 / 只读。
- 实现要求：`sizeable: true`；顶部文件头注释 + `import type { PreviewGroup } from "../types"`；`importCode` 为 `import RadioButton from "@/components/RadioButton.vue"`；每个示例 `props` 与 `code` 严格一致，`code` 需体现单选组「同 `v-model` + 同 `name`」用法。
- **`src/features/componentPreview/previewData/index.ts`**（修改）
- 目的：把新分组接入面板渲染链路。
- 功能：新增 `radioButtonPreviewGroups` 的 import，并在 `PREVIEW_GROUPS` 中紧随 `...checkboxPreviewGroups` 插入 `...radioButtonPreviewGroups`。
- 实现要求：不改动既有分组的相对顺序；无需改面板渲染框架。
- **`AGENTS.md`**（修改）
- 目的：保持「组件库计数 / 清单 / 复用要求」与真实代码一致（AI 与新人都以此为准）。
- 功能：5 处 `21 个` → `22 个`；组件清单表 `Checkbox.vue` 行后新增 `RadioButton.vue` 行（职责：单选框，单选组 / 二值模式 / 四档尺寸与描边实底变体；关键 props：`v-model` / `value` / `binary` / `name` / `size` / `variant` / `label` / `hint` / `error` / `disabled` / `readonly` / `labelBefore`）；「优先复用」枚举补「单选框」。
- 实现要求：只改计数与新增行，不动其它规则文字；目录树注释括号内示例列表可顺带补 `RadioButton`。
- **`README.md`**（修改）
- 目的：根目录项目概览计数同步。
- 功能：`# 共享 UI 组件（21 个原子组件）` → `22 个`。
- **`src/features/componentPreview/README.md`**（修改）
- 目的：预览面板文档与实现保持一致。
- 功能：L3 计数 21→22；L8 全组件枚举按字母序插入 `RadioButton`；L16 `sizeable` 枚举加入 `RadioButton`；L17 补一句 RadioButton 圆框与标签随档位变化（14/16/18/20px 与 10/12/14/16px）；新增一条说明——**单选组的多实例语义无法在单卡片快照中呈现，需按 `code` 中「同 `v-model` + 同 `name`」写法使用**。
- 实现要求：新增说明放在「具名插槽」/「事件契约」表附近，风格与既有说明一致。
- **`.codebuddy/memory/MEMORY.md`**（修改）
- 目的：更新跨会话项目事实，避免后续误判。
- 功能：共享组件库标题与「当前为 21」→ 22，清单加入 `RadioButton`；「组件约定与陷阱」新增 `RadioButton` 条目（实现要点、与 `Checkbox` 的差异：无数组模式 / 无半选 / 无 `IconWrapper`、保留原生 radio 分组语义）；改写「分段单选组（档位/模式切换）无共享 Radio 组件」条目为——已有 `RadioButton`，但分段档位/模式切换仍沿用 `Button` 分组表达（更紧凑、视觉语言一致），feature 内原生 radio 迁移列为后续清理项。
- 实现要求：同步清理该文件已超限的冗余（标题里的 `19 个` 等陈旧计数一并修正为 22）。

## 关键代码结构

```ts
// src/components/RadioButton.vue —— 对外契约（多处依赖，需精确定义）
type RadioButtonSize = "xsmall" | "small" | "medium" | "large"
type RadioButtonVariant = "outlined" | "filled"

interface Props {
  /** 单选组模式：当前选中项的值；binary 模式：布尔值 */
  modelValue?: any
  /** 本项代表的值（binary 模式下不要传） */
  value?: any
  /** 二值模式：modelValue 直接作为选中值，无需 value */
  binary?: boolean
  /** 尺寸档位 */
  size?: RadioButtonSize
  /** 视觉变体：描边（默认）/ 实底 */
  variant?: RadioButtonVariant
  /** 行内可点击标签文案 */
  label?: string
  /** 辅助说明（error 优先显示） */
  hint?: string
  /** 校验失败文案（同时描红圆框） */
  error?: string
  disabled?: boolean
  readonly?: boolean
  required?: boolean
  /** 同一单选组的原生 name（同组必须一致，否则方向键与 ARIA 语义失效） */
  name?: string
  form?: string
  /** 原生 input 的 id，供外部 <label for> 关联 */
  inputId?: string
  ariaLabel?: string
  ariaLabelledby?: string
  autofocus?: boolean
  /** 标签置于圆框左侧 */
  labelBefore?: boolean
}

interface Emits {
  (e: "update:modelValue", value: any): void
  (e: "change", value: any, event: Event): void
  (e: "focus", event: FocusEvent): void
  (e: "blur", event: FocusEvent): void
}
```

## 设计风格

沿用项目既有的 Codex 设计语言（暖色中性、边框优先、无发光阴影、0.12s ease 过渡、主题自适应），与同族的 `Checkbox`、`Switch` 保持完全一致的观感与档位，使新组件在组件预览面板中与既有控件并排时无割裂感。

## 视觉规格

- **圆框**：1px 描边圆形（`border-radius: 50%`），尺寸随档位 14 / 16 / 18 / 20px；未选中为透明底 + 主题边框；悬停时边框转为主题强调色。
- **选中圆点**：圆框内居中的实心圆点，选中时由 `scale(0)` 过渡到 `scale(1)`（0.12s ease），颜色为主题主色上的对比色。
- **实底变体**：未选中即带浅色表面填充且边框透明，强调度高于描边态；选中后同样以主题主色填充。
- **校验失败**：圆框描红（`--b3-theme-error`），错误文案以红色显示在控件下方。
- **禁用 / 只读**：禁用整体降透明度至 0.5 并显示禁止光标；只读保持正常观感但点击与空格不生效。
- **焦点环**：使用 2px 环形轮廓 + 2px 偏移，在描边与实底两种外观下均清晰可见。

## 布局与交互

- 控件为「圆框 + 标签」的单行横排，整行均可点击（原生 `<label>` 包裹建立隐式关联），`labelBefore` 时标签置于圆框左侧。
- 标签文案继承主题正文色与字号阶梯（10 / 12 / 14 / 16px），与圆框同步随档位缩放。
- 表单类场景下，`hint` / `error` 文案渲染在控件行下方，与 `Checkbox` 的排版完全一致。
- 交互反馈克制、无位移与缩放抖动，符合密集设置面板中的使用习惯。

## Agent Extensions

### MCP

- **Context7**
- Purpose: 用 `resolve-library-id` 定位 PrimeVue 后，通过 `query-docs` 拉取 RadioButton 的权威 Props / Events / Pass Through 分区与键盘无障碍约定，交叉校验本项目要落地的 `binary` / `name` / `variant` / `disabled` 语义，避免仅凭页面正文（该页正文不含 API 表格）推断。
- Expected outcome: 产出经官方文档核对过的 RadioButton 属性与行为清单，确认本项目对 PrimeVue 的每一处有意偏离（4 档尺寸、`error` 替代 `invalid`、额外 `label` 与插槽）都有明确记录。

### Skill

- **universal-arch-skill**
- Purpose: 在组件与文档改动完成后，对新增文件执行架构规范审查——校验共享组件「4 类位置」是否齐全（`<Name>.vue` / `styles/<Name>.scss` / `previewData/<name>.ts` / 文档计数）、样式是否全部外置、是否使用设计 Token（无硬编码字号/颜色）、单文件行数是否在 300 警戒线内、以及文档中 9 处计数是否与真实组件数一致。
- Expected outcome: 一份架构合规审查结论，确认新增组件无规范违规、无遗漏的文档同步点；如发现违规点则作为修复清单交付。