---
name: component-size-font-ladder
overview: 统一 src/components 全部 14 个组件的 size 档位字号阶梯为 10/12/14/16（$font-size-2xs/xs/sm/base），修复 XS 档与 S 档字号完全相同的问题：Button/Input/Select/Avatar 的 XS 字号 12px→10px，Card 标题全档改 10/12/14/16，Switch 标签新增四档变体，并清理过时注释、同步文档说明。
todos:
  - id: xs-font-10px
    content: 统一 Button、Input、Avatar 的 XS 档字号为 $font-size-2xs 并清理过时注释
    status: completed
  - id: select-xs-tier
    content: 将 Select 的 XS 档触发器、选项及下拉内部（筛选框/空态/分组标题）字号统一为 10px
    status: completed
  - id: card-size-ladder
    content: 重构 Card 标题为 10/12/14/16、副标题为 10/10/12/14 的四档字号阶梯
    status: completed
  - id: switch-label-tiers
    content: 为 Switch 标签新增 XS/S/M/L 四档字号变体 10/12/14/16
    status: completed
  - id: cleanup-badge-comments
    content: 清理 Badge 尺寸档位中「无对应 Token」等已过时的字号注释
    status: completed
  - id: sync-docs
    content: 同步 AGENTS_STYLE.md 档位字号阶梯说明与 componentPreview README 档位条目
    status: completed
    dependencies:
      - xs-font-10px
      - select-xs-tier
      - card-size-ladder
      - switch-label-tiers
  - id: token-compliance-check
    content: 用 [skill:universal-arch-skill] 审查组件样式改动的设计 Token 合规性
    status: completed
    dependencies:
      - xs-font-10px
      - select-xs-tier
      - card-size-ladder
      - switch-label-tiers
      - cleanup-badge-comments
---

## 产品概述

「组件预览」面板通过头部 XS / S / M / L 四档尺寸切换器，实时预览共享组件库在不同尺寸档位下的真实渲染效果。当前切到 XS 档时，组件文字字号与 S 档完全一致（同为 12px），四档之间没有形成可辨识的字号梯度，档位切换失去意义。

## 核心功能

1. **四档字号阶梯统一**：XS / S / M / L 分别对应 10px / 12px / 14px / 16px，切档后文字大小差异肉眼可辨。
2. **覆盖全部支持尺寸档位的组件**：

- Button、Input、Select、Avatar：XS 档文字由 12px 降到 10px（当前与 S 档同为 12px）
- Card：标题四档由 12 / 14 / 16 / 18 收敛为 10 / 12 / 14 / 16；副标题同步为 10 / 10 / 12 / 14，保持标题始终不小于副标题（XS 档二者同号，靠 semibold 字重与弱化颜色区分层级）
- Switch：标签字号由原来固定 14px（四档无差异）改为随档位变化 10 / 12 / 14 / 16
- Tag / Label / FormField / Slider / Badge：XS 档已是 10px，符合阶梯，保持不动

3. **Select 下拉面板内部一致性**：XS 档下筛选输入框、空态提示、分组标题字号同步降为 10px，避免出现「选项文字比筛选框小」的割裂观感；S / M / L 档下拉内部维持现状。
4. **清理过时注释**：移除组件样式中「10px 无对应 Token，统一为最小标准字号」等已失效表述，使注释与现有字号 Token 体系一致。
5. **视觉边界**：仅调整字号，不改内边距、最小高度、图标尺寸与交互行为；图标尺寸不随档位缩放属明确非目标。

## 影响范围（需知悉）

- 全插件 137+ 处使用 XS 档的工具栏与表单控件（video、s3Backup、passwordVault、minimalBrowser、apiDebugger、prompts、websiteNavigation、superPanel、statistics 等），文字由 12px 变为 10px。
- Card 与 Switch 的默认档位是 S 档，因此未显式指定尺寸的卡片标题（14→12px）、卡片副标题（12→10px）与开关标签（14→12px）也会随之变化。

## 技术栈

- 框架：Vue 3 + TypeScript（既有，无需引入新依赖）
- 样式：SCSS + 设计 Token（`src/_variables.scss`），组件样式已分离在 `src/components/styles/*.scss`
- 本次为纯样式层数值变更，无逻辑层、无 API、无持久化改动

## 实现策略

以现有设计 Token 构成档位字号阶梯，全部改动落在 `src/components/styles/` 的 SCSS 声明上，零硬编码：

| 档位 | Token | 值 |
| --- | --- | --- |
| XS | `$font-size-2xs` | 10px |
| S | `$font-size-xs` | 12px |
| M | `$font-size-sm` | 14px |
| L | `$font-size-base` | 16px |


### 关键决策与权衡

1. **XS 档使用 10px 的合规处理**：`AGENTS_STYLE.md` 的两级字号制中 `$font-size-2xs`(10px) 语义为「辅助文字」，而 Button/Input/Select 文字属正文。本次按用户确认将组件 XS 档统一为 10px，需在 `AGENTS_STYLE.md` 补一条「组件 size 档位字号阶梯」例外说明，否则后续审查会误判为违规。这是本次唯一的规范张力点。
2. **Select 下拉内部同步**：现有 L107 注释「与下拉选项字号一致（原 14px 在 12px 选项上方显突兀）」已确立「下拉内部字号需与选项一致」的设计意图。XS 档选项降到 10px 后，若不联动筛选框/空态/分组标题会重演该问题。因此仅对 XS 档补充 `__filter-input` / `__empty` / `__group-label` 覆盖，S/M/L 档不动，控制改动面。
3. **Switch 标签采用现有反向选择器写法**：该文件尺寸变体统一用 `.si-switch--xsmall &` 形式（因子元素在 DOM 中独立于根元素），标签变体沿用同一写法；基础声明降为 `$font-size-xs` 作兜底，四档全部显式覆盖，避免遗留死声明。
4. **Card 副标题派生规则**：副标题取「标题降一档、下限 10px」，即 10 / 10 / 12 / 14。相比现状（10 / 12 / 12 / 14）仅 S 档由 12px 降到 10px，M / L 不变，改动最小且保证标题不小于副标题。
5. **Card 全档收敛的代价**：标题 M(16→14)、L(18→16) 会缩小，属用户已确认接受的代价；M / L 档 Card 的标题与副标题差仍为 2px，层级不丢。
6. **图标尺寸不联动**：Button 的 `iconSize` 默认 16px 经 `IconWrapper` 以内联 px 生效，与字号无 CSS 关联。若要让图标随档位缩放需改 `Button.vue` 的 props 默认值逻辑，属独立议题，本次不做，避免扩大影响面。

### 性能与可靠性

- 纯 CSS 声明值变更，无运行时开销、无新增选择器嵌套深度、无重排风险。
- 逐文件独立改动，可单独回滚；不涉及状态、存储与生命周期，无数据风险。

## 实施要点

- 只改字号声明，**不得顺手改动** padding / min-height / gap / 图标尺寸 / 颜色，避免影响面失控。
- 仅使用 `$font-size-2xs` / `$font-size-xs` / `$font-size-sm` / `$font-size-base` Token，禁止出现 `font-size: 10px` 等硬编码。
- 注释清理只删「过时理由」，保留对 padding 等确实无 Token 项的「无对应 Token，保留」说明。
- i18n 键 `sizeXsmall` 等为纯档位名（「超小（xsmall）」），不含 px 数值，**无需改动 i18n**；顶层 `zh_CN.json` / `en_US.json` 禁止手动修改。
- AI 不执行 `pnpm vite build` 与 `pnpm lint`，改完提示用户自行验证（`pnpm lint`、`npx tsc --noEmit`，并在组件预览面板逐档目视核对）。

## 目录结构

```
siyuanPluginVueSN/
├── src/
│   └── components/
│       └── styles/
│           ├── Button.scss   # [MODIFY] &--xsmall 的 font-size：$font-size-xs → $font-size-2xs（10px）
│           ├── Input.scss    # [MODIFY] &--xsmall .si-input__field 的 font-size：12px → $font-size-2xs
│           ├── Select.scss   # [MODIFY] &--xsmall 的 .si-select__trigger/.si-select__option 改 $font-size-2xs；
│           │                 #          并在 &--xsmall 内新增 .si-select__filter-input / __empty / __group-label
│           │                 #          的 $font-size-2xs 覆盖（保持 XS 下拉内部一致）；S/M/L 档不动
│           ├── Avatar.scss   # [MODIFY] &--xsmall 的 font-size：12px → $font-size-2xs，并删除「10px 无对应 Token」过时注释
│           ├── Card.scss     # [MODIFY] 四档 .si-card__title 改为 $font-size-2xs/xs/sm/base（10/12/14/16）；
│           │                 #          四档 .si-card__subtitle 改为 10/10/12/14（仅 small 由 xs 降为 2xs）
│           ├── Switch.scss   # [MODIFY] &__label 基础声明改为 $font-size-xs 兜底，并新增四档反向选择器覆盖
│           │                 #          （.si-switch--xsmall/small/medium/large &）字号 10/12/14/16
│           └── Badge.scss    # [MODIFY] 仅清理 &--small 与 &--medium 的过时注释（「原 10px/11px 无对应 Token」），字号不动
├── AGENTS_STYLE.md           # [MODIFY] § 强制规则：字号层级与全局基准字号 —— 补充「组件 size 档位字号阶梯」
│                             #          小节，明确 XS 档使用 $font-size-2xs 属阶梯约定而非违规
└── src/features/componentPreview/
    └── README.md             # [MODIFY] 「组件尺寸档位」条目补充四档字号阶梯（10/12/14/16）与 Card/Switch 变更说明
```

## 非目标（明确不做）

- 不改动预览面板自身（切换器、持久化、`PreviewSection.resolveProps` 注入逻辑均不变）。
- 不改动 `COMPONENT_SIZES` 档位清单与 i18n 文案。
- 不让 Button 图标尺寸随档位缩放。
- 不调整 Tag / Label / FormField / Slider / Badge 的字号（已符合阶梯）。

## Agent Extensions

### Skill

- **universal-arch-skill**
- Purpose: 对本次组件样式改动执行设计 Token 合规审查，核验 `src/components/styles/` 中不出现硬编码 `font-size`（如 `10px`）、颜色、字重、行高，且档位字号严格取自 `$font-size-2xs/xs/sm/base`；同时确认 `AGENTS_STYLE.md` 已补充「组件 size 档位字号阶梯」例外说明，与两级字号制不冲突。
- Expected outcome: 输出一份 Token 合规结论（逐文件列出字号声明与其 Token 来源），明确标注是否存在硬编码或规范冲突，确保改动可通过后续审查。