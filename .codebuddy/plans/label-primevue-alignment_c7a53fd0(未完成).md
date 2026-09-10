---
name: label-primevue-alignment
overview: 参照 PrimeVue Label，优化共享组件 Label：补齐 Wrapper 包裹、禁用态联动、required 无障碍语义三项能力，修复 align 失效与错误色 Token 缺陷，并同步预览清单与文档（不改动任何 feature）。
todos:
  - id: label-api-research
    content: 用 [mcp:Context7] 查询 PrimeVue Label 官方 API，核对 for 与 data-disabled 语义后定稿新增 props 命名与默认值
    status: completed
  - id: label-component
    content: 改 Label.vue：新增 wrapper / requiredText 两个可选 prop、wrapper 分支插槽直出、补齐 aria-hidden 与 aria-disabled 语义
    status: in_progress
    dependencies:
      - label-api-research
  - id: label-styles
    content: 改 Label.scss：wrapper 修饰类、margin-bottom 豁免、data-disabled 与 :has() 邻近兜底、required-text 视觉隐藏、align 文本对齐、错误色 Token 修正 3 处
    status: completed
    dependencies:
      - label-component
  - id: label-preview
    content: 为 previewData/input.ts 的 labelGroup 追加 wrapper（render）、data-disabled、disabled、required+requiredText、align 两档示例，props 与 code 严格一致
    status: completed
    dependencies:
      - label-styles
  - id: label-docs
    content: 同步 componentPreview/README.md 插槽表与能力说明（含禁用联动覆盖范围限制）及 AGENTS.md 的 Label 行，不动组件计数
    status: completed
    dependencies:
      - label-preview
  - id: label-verify
    content: 用 [skill:universal-arch-skill] 审查合规，跑 read_lints 与 npx tsc --noEmit，回归核对 5 个调用点与错误色 Token 残留，并更新记忆文件
    status: completed
    dependencies:
      - label-docs
---

## 产品概述

对现有共享 UI 组件库中的表单标签组件做一次能力升级：参照 PrimeVue Label 补齐三项缺失能力，并修掉两处已失效的行为。本次只改组件本身与配套的预览、文档，不改动任何业务功能页面。

## 核心功能

- **标签包裹控件（Wrapper 隐式关联）**：标签根元素可以直接把表单控件包在里面，从而无需 `for` 即建立原生关联；点击标签文本区域等同点击被包裹的控件。开启包裹模式后，插槽内容不再被塞进文本层，因此可以并排放置多个子元素（控件 + 说明文字），也不会出现宽度挤压与文字样式串染。
- **禁用态联动**：三种入口等价生效——显式 `disabled` 属性、容器上标记 `data-disabled`、以及相邻兄弟本身就是被禁用控件时的自动跟随。禁用后整块标签降透明度、指针变为不可用，并对外暴露 `aria-disabled` 语义。
- **必填的无障碍语义**：`required` 时为视觉标记补上屏幕阅读器屏蔽，避免被念成「星号」；可选传入替代文案，以视觉隐藏的方式仅向屏幕阅读器播报「必填」。
- **对齐真实生效**：`align` 左/中/右三档此前在实际渲染中不起作用（文本层占满剩余宽度导致无空间可对齐），修复后在标签设定了固定宽度时文本可按档位对齐。
- **错误色随主题正确变化**：错误状态与必填标记改用设计基准里真正定义过的错误色变量，明暗主题切换时颜色正确跟随（此前引用了未定义变量，恒为一个偏暗的固定红色）。

## 视觉与交互效果

- 默认模式（不开启包裹）的外观与现在完全一致，密度、字号、图标位置、必填星号位置均无变化。
- 包裹模式下文本换行不再被强行禁止，可以呈现「标题 + 说明」两行的卡片式选项排布；文字字重回落为常规，避免把加粗字重串染到相邻控件的文字上。
- 禁用态为整体降透明度约一半并显示禁用光标，与库内其他控件的禁用观感一致；相邻控件禁用时标签同步变灰，无跳变。
- 错误态与必填星号在暗色主题下呈较亮的红色，与输入框、按钮的错误色保持一致。
- 对齐档位在固定宽度标签上呈现左对齐、居中、右对齐三种文本落位。

## 技术栈选择

沿用项目既有栈，不引入任何新依赖：

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 组件 | Vue 3 `<script setup>` + TypeScript | 与 `src/components/` 内 20 个既有共享组件一致 |
| 样式 | SCSS 外置 + 设计 Token | `.vue` 内 `<style scoped>` 只保留 `@use './styles/Label.scss'` |
| 预览 | 既有 `componentPreview` 清单驱动框架 | `previewData/input.ts` 的 `labelGroup`，复用上轮新增的 `PreviewExample.render` 字段 |


## 实现思路

**核心策略：能力靠「新增可选 props + CSS 属性钩子」实现，默认路径零改动；失效行为按最小侵入方式修正。**

1. **Wrapper 隐式关联**：新增可选 prop `wrapper`（默认 `false`）。为真时不再渲染 `.si-label__text` 包裹层，插槽内容直出，并输出 `si-label--wrapper` 修饰类；为假时保持现有 DOM 结构与样式完全不变。理由：不能用「自动检测插槽里是否为控件」来判断——Vue 的 `slots` 不是响应式（项目既有结论），且文本/控件的判定不可靠；显式 prop 是唯一零魔法且向后兼容的方案。
2. **禁用态联动**：走「受控入口 + 纯 CSS 兜底」，不引入 DOM 查询或 `MutationObserver`（容器组件不应探测兄弟节点）。组件为单根且未设 `inheritAttrs: false`，因此容器上的 `data-disabled` 属性会自然透传到根元素，CSS 用 `&[data-disabled]:not([data-disabled="false"])` 命中（排除 `:data-disabled="false"` 反被判定禁用的情况）；邻近兜底用 `:has(+ :disabled)` 与 `:has(+ [data-disabled])`（思源 Electron 的 Chromium 版本远高于 `:has()` 所需的 105）。`aria-disabled` 只由 `disabled` prop 驱动，不读 `attrs`，规避 attrs 响应式边界问题。
3. **required 无障碍语义**：`*` 标记加 `aria-hidden="true"`；新增可选 prop `requiredText`，传入时渲染视觉隐藏文本供屏幕阅读器播报。**有意不在 `<label>` 上加 `aria-required`**——该属性属于输入类角色，放在标签元素上是无效 ARIA；改为在文档中明确「控件侧仍需加 `required` / `aria-required`」（与 PrimeVue 文档口径一致）。
4. **align 修复**：`__text` 的 `flex: 1` 是维持「必填星号贴右、图标分列两侧」现有视觉的关键，不能删。改为保留该声明，把对齐落到文本层内部——`&--align-center/--align-right .si-label__text { text-align: center/right }`（flex 子项会被 blockify，`text-align` 生效）；根 `justify-content` 保留，继续服务于无 `flex:1` 的包裹模式。
5. **错误色 Token**：把 `Label.scss` 三处 `var(--b3-theme-destructive, $color-danger)` 改为 `var(--b3-theme-error, $color-danger)`。已实测：设计基准 `docs/codex-ui-reference.html` 在明暗两套主题中只定义 `--b3-theme-error`（暗色 `#f87171`），从未定义 `--b3-theme-destructive`；`AGENTS_STYLE.md` 亦以 `--b3-theme-error` 为 danger 语义 token。故原写法恒走 fallback，属真实缺陷而非风格偏好。
6. **有意不做的事**：不迁移 feature 内 59 处原生 `<label>`（用户明确排除）；不改 `FormField.vue` 自带的原生标签实现（共享层内部收敛，另立项）；不改动 `Tag.scss` / `Slider.scss` / `Badge.scss` 的同根因 6 处（同属「同一根因、本次不改」清单，见实现说明）。

**性能与可靠性**：运行时新增零副作用——无监听器、无定时器、无 DOM 查询、无新增依赖（体积零增长）；新增 props 全部可选且默认值等价于现行为；新增样式只作用于 `si-label--wrapper` / `[data-disabled]` / `:has()` 三类新条件，非匹配元素不受影响，无选择器层级的全局影响。

## 实现说明（执行要点）

- **不得触碰 `CompactModeSettings` 的覆盖规则**：该文件用高特异性选择器 `.compact-mode-settings .area-row .si-label` 覆盖 `margin-bottom`；`wrapper` 模式需要豁免 `margin-bottom`，实现上**不要**去扩大 `.si-label:not(.si-label--inline)` 的特异性（会连带影响 feature 侧覆盖），而是在文件末尾新增同特异性的 `.si-label.si-label--wrapper { margin-bottom: 0 }`，靠源码顺序取胜。
- **不可对 `<Label>` 加 `inheritAttrs: false`**：禁用联动依赖属性自然透传到根元素。
- **`wrapper` 与 `tag` 的组合约束**：要拿到原生隐式关联，`wrapper` 模式需配合 `tag="label"`（默认值即是）；若同时传 `tag="span"/"div"`，会额外命中既有的 `si-label--inline` 内联外观（背景 + 内边距），语义冲突，需在文档中写明。
- **禁用联动的已知覆盖范围（必须写进文档）**：`Switch`（根为原生 `<button>`）、原生 `input` 这类「禁用态就在根元素上」的成员可被 `+ :disabled` 自动命中；而 `Input` / `Select` / `DatePicker` 的禁用态加在内部元素（`.si-input__field` / `.si-select__trigger` / `.si-datepicker__wrapper`）上，根元素无 `disabled`，故**命中不到**——这类成员需由包装层显式加 `data-disabled`。不得在文档中夸大覆盖率。
- **包裹模式下放开字重**：根元素现有 `font-weight: $font-weight-medium` 会被相邻控件文本继承（如 `Input` 的输入内容未自设字重），故 `si-label--wrapper` 内将字重回落为 `$font-weight-normal` 并注明原因。
- **视觉隐藏文本（sr-only）无项目先例**：`Label.scss` 内自行定义 `__required-text` 的裁剪式隐藏（`position: absolute` + `overflow: hidden` + `clip-path: inset(50%)`），尺寸与负边距用 `$spacing-px` Token 表达（值本身被裁剪，不影响可访问性），避免新增硬编码 px。
- **SCSS 嵌套**：`&--align-center .si-label__text` 这类**有意形成后代链**的写法可用；但档位/状态变体若要与当前元素自身成修饰关系，仍须 `.si-label--tier &` 反向选择器写法。
- **行数**：`Label.vue` 现 113 行、`Label.scss` 现 123 行，本次变更后仍在 300 行警戒线内，无需拆分。
- **AI 不执行** `pnpm vite build` / `pnpm lint`；`read_lints` 与只读的 `npx tsc --noEmit` 可用。

## 架构设计

无新增架构模式，全部在既有分层内完成：共享组件层（`src/components/` 组件 + `styles/` 外置样式）→ 预览层（`componentPreview/previewData/` 清单 → 聚合 → 面板渲染）→ 文档层（`AGENTS.md` 清单表 + `componentPreview/README.md` 机制说明）。无状态流转、无跨功能导入、无事件总线参与、无 i18n 变更、无图标新增。

## 目录结构

本次改动 2 个组件文件 + 1 个预览清单 + 3 份文档，不新增文件、不涉及任何 feature 目录。

```
siyuanPluginVueSN/
├── src/
│   ├── components/
│   │   ├── Label.vue                    # [MODIFY] 表单标签共享组件。新增两个可选 prop：
│   │   │                                #   wrapper?: boolean（默认 false，为真时插槽内容直出、不包 __text 文本层，
│   │   │                                #   并输出 si-label--wrapper，用于包裹控件建立原生隐式关联）；
│   │   │                                #   requiredText?: string（必填的无障碍替代文本）。
│   │   │                                #   模板：required 分支的 * 标记补 aria-hidden="true"，requiredText 存在时额外
│   │   │                                #   渲染 .si-label__required-text；根元素补 :aria-disabled="disabled ? 'true' : undefined"。
│   │   │                                #   约束：不得设置 inheritAttrs:false（禁用联动依赖属性透传）；
│   │   │                                #   class 绑定保持 computed 数组形式，新增 si-label--wrapper 项。
│   │   │                                #   头部注释需补充 wrapper 用法与禁用联动覆盖范围。
│   │   └── styles/
│   │       └── Label.scss               # [MODIFY] 标签样式（本任务核心）。内容：
│   │                                    #   ① 修正错误色 Token 三处：L37-39 / L56-60 / L107-110 的
│   │                                    #      var(--b3-theme-destructive, $color-danger) → var(--b3-theme-error, $color-danger)
│   │                                    #   ② 新增 &--wrapper 修饰：white-space: normal、font-weight 回落 $font-weight-normal
│   │                                    #      （避免 medium 字重被相邻控件继承），其余继承基类
│   │                                    #   ③ 新增 &__required-text 视觉隐藏规则（position:absolute + overflow:hidden +
│   │                                    #      clip-path: inset(50%) + width/height/margin 用 $spacing-px），仅供屏幕阅读器
│   │                                    #   ④ 扩展禁用态：在既有 &--disabled 基础上并联 &[data-disabled]:not([data-disabled="false"])；
│   │                                    #      另加 &:has(+ :disabled) 与 &:has(+ [data-disabled]:not([data-disabled="false"])) 邻近兜底
│   │                                    #   ⑤ 修复 align：在既有 &--align-* 三档之外，补
│   │                                    #      &--align-center/--align-right .si-label__text 的 text-align（根 justify-content 保留）
│   │                                    #   ⑥ 文件末尾新增 .si-label.si-label--wrapper { margin-bottom: 0 }（同特异性、靠源码顺序胜出，
│   │                                    #      不得修改 L120 的 :not(.si-label--inline) 选择器以免抬高特异性影响 feature 覆盖）
│   └── features/
│       └── componentPreview/
│           ├── previewData/
│           │   └── input.ts             # [MODIFY] labelGroup（L181 起，当前 7 个示例）追加示例，每例 props 与 code 严格一致：
│           │                            #   包裹控件（wrapper:true，用 render 放 Switch + 说明文本，展示点击标签即触发控件）、
│           │                            #   禁用态-容器标记（props 传 "data-disabled": "true"）、
│           │                            #   禁用态-手动 prop（disabled:true）、
│           │                            #   必填无障碍（required + requiredText:"必填"）、
│           │                            #   对齐两档（align:"center"/"right" 配 width:"120px"，否则无宽度看不出效果）。
│           │                            #   需新增 import：h（vue）与 Switch 组件；保持 sizeable:true 不变。
│           │                            #   注意：相邻控件禁用自动跟随无法在本分区快照中构造（Label 的插槽只能放子元素、放不出兄弟），
│           │                            #   仅入 README 说明，不强行造示例。
│           └── README.md                # [MODIFY] 机制文档：具名插槽表补 Label 默认插槽（wrapper 模式直出 / 其余模式包进
│                                        #   .si-label__text）；能力条目补「wrapper 隐式关联」「data-disabled 与邻近兜底」
│                                        #   并如实写明覆盖范围限制（Input/Select/DatePicker 需包装层显式标记）；
│                                        #   清单扩展指南旁补一句 required 需由控件侧同时声明 required/aria-required。
├── AGENTS.md                            # [MODIFY] 仅改组件清单表中 Label.vue 一行：职责补「包裹控件（wrapper）与禁用态联动」，
│                                        #   关键 props 补 wrapper / requiredText。禁止改动任何组件计数（当前为 20，由并行变更维护）。
└── .codebuddy/memory/
    ├── MEMORY.md                        # [MODIFY] 共享组件库章节补 Label 新能力与两条陷阱结论
    └── 2026-09-10.md                    # [MODIFY] 追加本轮改动小结：能力清单、align 根因、错误色 Token 缺陷证据
                                         #   （含 Tag/Slider/Badge 同根因未修清单）、禁用联动覆盖范围限制
```

## 关键代码结构

仅列跨模块契约（其余为常规 Vue 组件与 SCSS 写法）：

```ts
// src/components/Label.vue —— 新增的可选 props（默认值等价于现行为，零破坏）
interface Props {
  /** 包裹模式：插槽内容直出（不包文本层），用于把控件包进标签以建立原生隐式关联；建议配合 tag="label" */
  wrapper?: boolean
  /** 必填的无障碍替代文本（视觉隐藏，仅供屏幕阅读器）；控件侧仍需自行声明 required / aria-required */
  requiredText?: string
}
```

## 验证

- `read_lints` 覆盖全部改动文件，要求 0 错误
- `npx tsc --noEmit`（只读命令，允许执行）过滤 `Label` / `input.ts` 路径，确认无新增类型错误（全项目既有噪声不计）
- 回归核对 5 个既有调用点，逐一确认未使用 `align` / `state` / `variant` / `for` / `disabled` / `required`，并确认 `CompactModeSettings` 的 `margin-bottom` 覆盖仍生效
- `--b3-theme-destructive` 残留 grep 应仅剩 `Tag.scss` / `Slider.scss` / `Badge.scss`
- 结构合规由 `[skill:universal-arch-skill]` 审查（样式分离、设计 Token、文件头注释、行数、组件 API 变更同步清单）
- `pnpm lint` 与预览面板逐项目视由用户自行执行

## Agent Extensions

### MCP

- **Context7**
- Purpose: 官方 PrimeVue Label 页面（https://primevue.dev/label/）的 API 区块为客户端动态渲染、抓取为空，且 `raw.githubusercontent.com` 与文档 markdown 端点均不可达；用 Context7 检索 PrimeVue 官方文档库，取回 Label 组件的权威 props 列表、`for` 与 `data-disabled` 的确切语义，用于定稿本次新增 props 的命名与默认值，避免凭空设计。
- Expected outcome: 给出一份 PrimeVue Label 的 props / 无障碍约定核对结论（含 `for`、`data-disabled`、必填语义的官方表述），并据此确认 `wrapper` / `requiredText` 命名与语义不与官方冲突；若官方确实无对应 prop，则明确记录「本项目自定语义、功能目标对齐」这一结论。

### Skill

- **universal-arch-skill**
- Purpose: 作为架构规范审查工具，校验本轮组件能力扩展是否合规——目录规范（改动只落在 `src/components/` 与 `componentPreview/`）、样式分离（`.vue` 内仅保留 `@use`）、设计 Token 使用（无硬编码字号/颜色/间距）、文件头注释齐备、单文件行数在阈值内，以及「改共享组件 API 必同步预览清单与文档」这一强制链条是否完整闭环。
- Expected outcome: 输出结构合规检查结论，明确列出违规项与缺失的同步位置；补齐前不进入最终交付判定，补齐后复检归零。