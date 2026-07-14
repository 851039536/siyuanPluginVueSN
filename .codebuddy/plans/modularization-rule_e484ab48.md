---
name: modularization-rule
overview: 在 AGENTS_RULES.md 和 CODEBUDDY.md 中新增「强制规则：组件模块化判断标准」章节，明确什么条件下应该拆分为独立组件/文件，什么条件下属于过度模块化应保持内联。
todos:
  - id: add-rules-section
    content: 在 AGENTS_RULES.md "构建与验证"之前（L984）新增「强制规则：模块提取判定标准」章节，包含 Vue 组件/TS 工具/Composable 三类判定标准及反面案例
    status: completed
  - id: update-codebuddy-hard-rules
    content: 在 CODEBUDDY.md 硬规则区（L248 之后）新增"过度模块化判定"条目，引用 AGENTS_RULES.md 详细章节
    status: completed
    dependencies:
      - add-rules-section
  - id: sync-agents-md
    content: 同步 AGENTS.md 硬规则区，在 L249 之后插入与 CODEBUDDY.md 一致的新条目
    status: completed
    dependencies:
      - update-codebuddy-hard-rules
---

## 用户需求

在项目规范中新增「防止过度模块化」规则，明确什么条件下才应该提取为独立文件（模块化），什么条件属于过度模块化（应保持内联）。

## 背景

`CollapsibleSection.vue` 是一个仅被 `DocChangeSection.vue` 单一父组件使用的薄壳组件，~50 行，仅含 1 个 `expanded` ref + `toggleExpanded` 方法 + `<slot>` 模板。无独立业务逻辑，判定为过度模块化，已合并回父组件。当前项目缺少对此类情形的规则约束。

## 核心需求

1. 新增 **Vue 组件提取判定规则** — 当前 `components/` 目录下无提取/不提取的标准
2. 整合 **TS 工具函数提取规则** — 已有"2+ 文件复用提取"规则，需交叉引用
3. 整合 **Composable 提取规则** — 已有完备规则，需在模块化总则中引用
4. 三文件同步 — `AGENTS_RULES.md`（新增章节）、`CODEBUDDY.md`（硬规则条目）、`AGENTS.md`（与 CODEBUDDY.md 同步）

## 实现方案

### 整体策略

在现有规则体系中增加一个「模块提取判定标准」章节，作为模块化的总决策指南。不做大范围重构，仅新增规则文本并同步三个规则文件。

### 修改文件与位置

| 文件 | 操作 | 插入位置 |
| --- | --- | --- |
| `AGENTS_RULES.md` | 新增章节 | L984（"构建与验证"之前） |
| `CODEBUDDY.md` | 硬规则区新增条目 | L248 之后（"单文件行数上限"之后、"规则文件同步"之前） |
| `AGENTS.md` | 硬规则区同步新增 | L249 之后（与 CODEBUDDY.md 保持一致） |


### 规则内容设计

#### 1. Vue 组件提取判定（`components/` 目录）

| 必须提取 | 不应提取（过度模块化） |
| --- | --- |
| 被 2 个以上父组件复用 | 仅 1 个父组件使用 且 是薄壳包装（仅 slot + 极简状态 ≤2 个 ref） |
| 文件超过 500 行硬阈值 | 组件 ≤80 行且无独立业务逻辑 |
| 含有独立且复杂的内部状态管理（≥3 个 ref/reactive） | 提取后父组件反而更难阅读（需跨文件跳跃理解完整 UI 流） |
| 代表一个可独立理解/测试的 UI 概念单元 | 组件仅是对原生 HTML 元素的简单封装（如 `<div>` + CSS 类名） |


反面案例：`CollapsibleSection.vue`（1 处使用、50 行、toggle+slot 薄壳）— 应合并回父组件。

#### 2. TS 工具函数/常量提取判定（`utils.ts` / `types/index.ts`）

整合现有规则：

- **必须提取**：被 2 个以上文件使用（已有 CODEBUDDY.md L247 规则）
- **可提取但非必须**：被 1 个文件使用但逻辑复杂（>30 行），提取可改善父文件可读性
- **不应提取**：被 1 个文件使用且逻辑简单（≤10 行简单映射/常量）

#### 3. Composable 提取判定（`composables/` 目录）

引用现有完备规则（AGENTS_RULES.md L815-884）：

- ≥3 个相关 ref/函数 → 必须提取
- 被 2+ 组件共享 → 必须提取
- 1~2 个函数且仅 1 处使用 → 保留在组件内

### 规则文件同步

`AGENTS.md` 与 `CODEBUDDY.md` 必须保持内容一致（仅首行标题可不同），本次修改在两处同时插入相同条目。