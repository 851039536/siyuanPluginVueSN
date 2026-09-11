---
name: add-toolbar-shared-component
overview: 参照 PrimeVue Toolbar，在共享组件库新增第 37 个公开组件 Toolbar：三段式（start / center / end）工具栏容器，官方契约（三插槽无作用域参数、容器恒渲染、无事件）+ 项目化扩展（variant 三档 outlined/filled/borderless、padded 开关、wrap 开关、四档 size 驱动内边距与最小高度并输出 10/12/14/16 基准字号、ariaLabel）；同步预览清单与 6 份文档计数（36 → 37）。
todos:
  - id: implement-toolbar
    content: 用 [mcp:Context7] 复核官方 Toolbar 契约后实现 Toolbar.vue 与 styles/Toolbar.scss（三段布局 + variant 三档 + padded/wrap + 四档 size）
    status: in_progress
  - id: toolbar-preview
    content: 新增 previewData/toolbar.ts 十个示例并接入 PREVIEW_GROUPS 聚合入口
    status: pending
    dependencies:
      - implement-toolbar
  - id: sync-docs
    content: 同步六份文档的 36→37 计数与清单，用 [subagent:code-explorer] 复核无遗漏并校正文件数基线
    status: pending
    dependencies:
      - toolbar-preview
  - id: verify-toolbar
    content: 用 [skill:universal-arch-skill] 审查架构，跑 read_lints、tsc 与离线 Sass 编译并记录当日记忆
    status: completed
    dependencies:
      - sync-docs
---

## 产品概述

共享组件库新增「工具栏」容器组件 Toolbar：一行内三段式布局（start / center / end），用于承载按钮组、搜索框、标题等。公开组件数量由 36 增至 37。

## 核心功能

- **三段式插槽**：`start` / `center` / `end` 三个具名插槽（均无作用域参数）；三个容器**恒定渲染**（未传内容时仍占位，保证三段位置稳定、不会因内容增删而左右跳动）。
- **外观三档**：`outlined`（默认，表面底色 + 1px 边框 + 圆角）/ `filled`（实底、无边框）/ `borderless`（无边框无底色，贴合型工具栏）。
- **内边距开关**：`padded`（默认开启）；关闭后去掉内边距供贴合场景使用，**仍保留最小高度**。
- **尺寸四档**：`xsmall` / `small` / `medium` / `large`（默认 `small`），驱动容器内边距、最小高度、段间距与基准字号（10/12/14/16）。
- **换行开关**：默认单行（center 精确居中、end 靠右）；`wrap` 开启后允许换行，`start` 独占首行、`center` 与 `end` 落在次行并分居两端。
- **无障碍**：根元素 `role="toolbar"`，可访问名称由 `ariaLabel` / `ariaLabelledby` 提供（组件无内置文案）；**无自有事件、无自有状态**（纯展示容器）。

## 视觉与交互效果

默认形态为一条横向工具栏：表面底色、1px 中性边框、6px 圆角，左右留白适中；三段内容垂直居中、段间距随档位收放。`filled` 只去边框、`borderless` 连底色一并去掉，两者圆角保留以便调用方按需覆盖。四档切换时只有字号与几何量（内边距、最小高度、段间距）变化，边框宽度与圆角恒定、不会抖动。窄容器开启 `wrap` 后首行只放 `start`、次行左 `center` 右 `end`。整体配色、圆角、间距与既有组件库完全一致，明暗主题下均正常；无 hover / 过渡等交互样式（内容交互由内部共享控件承担）。

## 范围

仅组件库新增 + 预览面板用法清单 + 组件文档计数同步。项目内已有 86 个自建工具栏实现（`gitPush` 一家 6 个 `*Toolbar.vue`、`minimalBrowser`、`video`、`s3FileManager`、`shortcut`、`diskBrowser` 等），本次不动，其迁移属后续独立任务。

## 技术栈选择

- 沿用项目既有栈，**零新增依赖**：Vue 3.5.42（`script setup` + TypeScript）+ SCSS 短名 Token（`$s-*` / `$t-*` / `$r-*` / `$ff-zh` / `$c-*`）。
- **不建私有目录**：只有两个字符串联合类型与少量 props，按 Rule of Three 内联在 `.vue`（先例：`Card.vue` 内联 `CardVariant` / `CardSize`；`Textarea.vue` 内联 `TextareaVariant`；`Button.vue` 内联 `ButtonVariant` / `ButtonSize`）。
- **预览框架无需任何扩展**：三插槽均无作用域参数，用既有 `PreviewExample.slots`（键为插槽名、值为 VNode 工厂）即可渲染；根自带 `width: 100%`，无需新增舞台高度类。
- **文档计数与基线**：公开组件 36 → 37；`src/components` 递归文件数 109 → 111（新增 `Toolbar.vue` + `styles/Toolbar.scss`，实测确认后再落笔）。

## 实现方案

### 总体策略

完全对齐官方 DOM 契约（根 `div[role=toolbar]` + 三个固定顺序的容器 `div`）与插槽命名（`start` / `center` / `end`），API 面收窄到官方唯一业务 prop（`ariaLabelledby`）加本项目必需的 `ariaLabel`；在此之上按用户口径叠加三档外观、内边距开关、四档尺寸与换行开关，全部经根类输出 CSS 变量单点驱动。

### 关键契约（已从官方 d.ts 与 `index.mjs` 编译产物逐条核实）

- Props：官方仅 `ariaLabelledby`（其余 `dt` / `pt` / `ptOptions` / `unstyled` 本项目不引入）。
- 插槽：`start` / `center` / `end`，**均无作用域参数**；官方 `renderSlot` 未传 fallback、**无 `v-if`、无 key** ⇒ 三个容器**恒定渲染**。
- **无任何自定义事件**（`ToolbarEmitsOptions` 为空接口）。
- 官方根元素 `inheritAttrs: false` ⇒ 本项目**有意差异**：单根组件用默认 attrs 透传，`class` / `style` 直接落到根元素（与 `Divider` 同型），无需 PT。

### 关键决策与取舍

1. **center 精确居中的实现**：`start` / `end` 各 `flex: 1 1 0`（分别为左对齐、右对齐），`center` `flex: 0 0 auto`。这样「只有 start」「只有 end」「start + end」「三者都有」四种组合下 center 都精确居中；官方为 `justify-content: space-between`，三方俱在时 center 只能大致居中，属**有意改进**（写入文档）。同时给两端容器设 `min-width: 0`，避免长内容撑破 center。
2. **`wrap` 语义**：开启后容器 `flex-wrap: wrap` 且 `start` 强制 `flex: 1 1 100%`（独占首行），`center` 与 `end` 落在次行并保持各自对齐（**end 仍靠右**）。
3. **`padded=false` 保留 `min-height`**：去掉四向内边距但保留档位最小高度，避免贴合型工具栏高度由内容随机决定导致与相邻区域错位。
4. **`variant` 与 `padded` 解耦**：`padded` 只管内边距，与外观无关（`borderless + padded` 照样有内边距）；三档外观**圆角统一 `$r-base`（6px）**，`borderless` 也保留圆角声明以便调用方用 `class` 覆盖成 0。
5. **几何量随档位（必须写进文档）**：档位变量单点输出 `--si-toolbar-font` / `--si-toolbar-pad-y` / `--si-toolbar-pad-x` / `--si-toolbar-min-h` / `--si-toolbar-gap`，数值表如下（上下内边距取 Token，`min-height` = 同档 `Button` 最小高度 + 2×上下内边距，保证内含控件不被撑破）：

| 档位 | 基准字号 | 上下内边距 | 左右内边距 | 最小高度 | 段间距 |
| --- | --- | --- | --- | --- | --- |
| xsmall | `$t-2xs` 10px | `$s-px3` 3px | `$s-1` 4px | 28px（22 + 2×3） | `$s-px6` 6px |
| small | `$t-xs` 12px | `$s-1` 4px | `$s-2` 8px | 36px（28 + 2×4） | `$s-2` 8px |
| medium | `$t-sm` 14px | `$s-1` 4px | `$s-3` 12px | 44px（36 + 2×4） | `$s-2` 8px |
| large | `$t-base` 16px | `$s-px5` 5px | `$s-4` 16px | 54px（44 + 2×5） | `$s-3` 12px |


边框宽度 1px 与圆角 6px **恒定**，切档不抖动。表中 28/36/44/54px 无对应 Token，行内注明 `// 无对应 Token`。

6. **`size` 不能影响插槽内容**（Vue 无法向插槽注入 props）⇒ 文档必须写明「**调用方需把同档 `size` 同时传给内部共享控件**（`Button` / `Input` 等），否则档位脱节」，落点为 `AGENTS.md` 组件清单行 + `componentPreview/README.md` 档位细则。
7. **可访问名称**：同时提供 `ariaLabel` 与 `ariaLabelledby`（官方只有后者；`role="toolbar"` 需要可访问名称，项目惯例是不设中文默认值、由调用方提供，零 i18n）。
8. **不做**（明确裁剪，写入文档）：`dt` / `pt` / `ptOptions` / `unstyled`，以及任何内容型默认样式（不内置标题/按钮排列，排列交给调用方）。

### 性能与可靠性

- 组件无状态、无计算热点、无监听器；渲染固定为「1 根 + 3 容器 + 各一次 `slot`」，无 `v-if` 分支 ⇒ 更新代价与官方一致（常量级）。
- 四档与三档外观全部经根类 + CSS 变量驱动，**仅 3 个类名计算**，无逐元素内联样式（避免重排与样式抖动）。
- 纯 CSS 布局（flex），无测量、无 `ResizeObserver`、无定时器。

## 实现说明（执行要点）

- **样式归属**：三个内部容器在同一个组件内，样式写在 `styles/Toolbar.scss` 即可（不涉及跨 `.vue` 的 scoped 归属问题，无 `Splitter` 那类「分隔条由子组件渲染」的坑）。
- **Token 陷阱**：边框与分隔一律 `--b3-border-color`（`--b3-theme-surface` 与 `--b3-theme-background` 仅差约 3%，画不了细线）；底色用 `--b3-theme-surface`；禁止 `box-shadow` 作主样式（本组件不需要阴影）。
- **规范红线**：`<style scoped>` 内**只允许 `@use './styles/Toolbar.scss';`**；首行功能注释 + 一行 `import "./kit/theme"`；零 i18n / 零 plugin / 零 `siyuan` 导入；单文件 500 行上限（预计 70 行内）。
- **attrs 透传**：单根组件默认透传，`class` / `style` 落根元素；但 `ariaLabel` / `ariaLabelledby` 必须由 props 显式绑定为 `aria-label` / `aria-labelledby`，不能依赖 attrs 拼写。
- **预览示例**：一律复用共享 `Button` / `Input` / `IconWrapper`（图标名只能取 `kit/icons.ts` 已注册 `IconKey`），**不为示例新增 SCSS**；示例通过 `slots` 字段组装（工厂接收 `{}` 并忽略）；`previewData/toolbar.ts` 控制在 300 行以内。
- **文档计数一次性改全**：执行前用正则全库扫一遍 `36 个`，改完复扫确认只剩无关命中（如 `docs/hardcode-audit.md` 讲图标数）。

## 架构设计

单文件组件，无父子通信、无 provide / inject、无事件；依赖方向为「Toolbar.vue 只依赖 styles 与 kit/theme」，对外只暴露 `@/components/Toolbar.vue` 一个入口。预览侧：`previewData/toolbar.ts`（数据）→ `previewData/index.ts`（聚合）→ 既有面板渲染层，零框架改动。文档侧：`AGENTS.md` 作为组件库契约真源，另 5 份文档同步计数与清单。

## 目录结构

```
src/
├── components/
│   ├── Toolbar.vue                    # [NEW] 公开组件：单根 div[role=toolbar]，恒定渲染 start/center/end 三容器；props = variant(outlined 默认)/size(small 默认)/padded(true)/wrap(false)/ariaLabel/ariaLabelledby；内联 ToolbarVariant 与 ToolbarSize 两个联合类型并以 export type 转出；无 emits；首行功能注释 + 一行 import "./kit/theme"；<style scoped> 仅 @use 自己那份 scss
│   └── styles/
│       └── Toolbar.scss               # [NEW] 三段 flex（start/end 各 flex:1 1 0 且 min-width:0、center flex:0 0 auto 精确居中）；--padded 控制内边距（min-height 恒保留）；--wrap 时 flex-wrap 且 start 独占首行；outlined/filled/borderless 三档外观（圆角恒 $r-base）；四档输出 --si-toolbar-font/pad-y/pad-x/min-h/gap（数值表见方案）；边框恒用 --b3-border-color
└── features/componentPreview/
    ├── previewData/
    │   ├── toolbar.ts                 # [NEW] 预览分区数据（双导出 toolbarGroup + toolbarPreviewGroups，sizeable: true）。十例：基础三段 / 仅 start+end / center 放分段切换（共享 Button 分组 + aria-pressed）/ 搜索栏（start 放 Input、end 放 Button）/ variant=filled / variant=borderless / padded=false / wrap 换行 / size=large / 只有 start；均用 slots 字段组装，每例配可复制 code
    │   └── index.ts                   # [MODIFY] import toolbarPreviewGroups 并加入 PREVIEW_GROUPS
AGENTS.md                              # [MODIFY] 160/168/181/459/497 行 36→37；第 177 行「优先复用」枚举补「工具栏」；「### 3. 组件清单」表新增 Toolbar.vue 一行（信息密度对齐 Divider.vue / Panel.vue，写明三插槽无作用域参数 + 容器恒渲染 + variant 三档 + padded/wrap + 四档几何量 + 需把同档 size 传给内部控件 + 无事件）
README.md                              # [MODIFY] 第 147 行「共享 UI 组件（36 个原子组件…）」→ 37
src/features/componentPreview/README.md # [MODIFY] 第 3、8 行 36→37 且清单插 Toolbar；「## 功能」新增工具栏条目；第 27 行 sizeable 清单加入 Toolbar；第 28 行档位细则补 Toolbar 具体数值（28/36/44/54px 与内边距、段间距）；「## 具名插槽」表新增 start/center/end 三行（均无作用域参数、容器恒渲染、未传仍占位）
src/components/kit/README.md           # [MODIFY] 第 22 行 36→37
src/components/kit/theme.ts            # [MODIFY] 第 14 行「由 36 个公开组件…」→ 37
src/components/docs/components-vue3-migration-guide.md # [MODIFY] 第 3、62、146 行 36→37 且清单插 Toolbar；基线文件数 109→111（实测确认）
```

## Agent Extensions

### MCP

- **Context7**
- Purpose: 实现阶段再次核对官方 Toolbar 的插槽集合（start/center/end 是否无作用域参数）、props 面与「容器恒定渲染」语义，避免凭记忆写错契约。
- Expected outcome: 得到逐条可对照的 props / slots 事实，落实为 Toolbar.vue 的绑定与 PreviewGroup 的 slots 组装方式。

### Skill

- **universal-arch-skill**
- Purpose: 交付前按项目架构规范（模式 C 代码架构审查）检查新增组件：统一入口与命名、样式分离、设计 Token 使用、字号层级、避免过度模块化、文档注册完整性。
- Expected outcome: 产出审查结论并据此修正 Token 用法（如 `min-height` 等无 Token 值的行内注明）、类名与文件头注释等细节。

### SubAgent

- **code-explorer**
- Purpose: 全库扫描 `36 个` 等组件计数与清单式引用、以及 `src/components` 递归文件数，确认文档同步无遗漏、基线数字与实测一致。
- Expected outcome: 给出完整的待改文件行号清单与实测文件数，避免计数器与组件清单漏改。