---
name: floatingBox-code-review-refactor
overview: 对 floatingBox 功能模块进行代码审查与重构：添加缺失文件头注释、提取重复的工厂函数为通用 helper、消除 refresh.ts 中的重复代码、修复 SCSS Token 违规、移除未使用变量、修正代码异味与类型安全问题。
todos:
  - id: add-file-headers
    content: 补全 7 个 tools/*.ts 文件的缺失文件头注释
    status: completed
  - id: extract-common-factory
    content: 新建 tools/utils.ts，提取 createEventDispatchTool() 通用工厂函数，重构 flashcardReading/passwordVault/superPanel/textDiff 四个文件为调用通用工厂
    status: completed
  - id: fix-refresh-duplicate
    content: 消除 refresh.ts 中父级 action 与 refresh-ui 子项 action 的重复代码，提取共用函数
    status: completed
  - id: fix-index-vue
    content: 修复 index.vue：移除未使用的 wrapperRef，修正 @click 代码异味，强化类型安全；修复 index.ts 中 __floatingBox 的 any 类型
    status: completed
  - id: fix-toolitem-types
    content: 修复 ToolItem.vue 中 plugin prop 类型从 any 改为 Plugin，确保类型安全
    status: completed
  - id: fix-scss-tokens
    content: 修复 styles/index.scss 中所有硬编码 Token 违规（font-size/font-weight/border-radius/padding/gap/right/min-width），替换为全局设计 Token
    status: completed
  - id: verify-i18n-consistency
    content: 核查 prompts.ts 的 i18n 读取路径，确认与其他工具一致，必要时修正
    status: completed
    dependencies:
      - extract-common-factory
---

## 需求概述

对 `src/features/floatingBox/` 模块的 13 个源文件进行深度代码审查与重构，消除冗余代码、修复规范违规、优化类型安全，同时严格保证现有业务逻辑不变。

## 核心改动

1. **补全文件头注释** — 7 个 `tools/*.ts` 文件缺少文件头注释，违反 AGENTS.md 强制规则
2. **提取通用工具工厂函数** — `flashcardReading.ts`、`passwordVault.ts`、`superPanel.ts`、`textDiff.ts` 四个文件代码结构完全一致（仅 id/icon/bgColor/eventName 不同），提取 `createEventDispatchTool()` 通用工厂到 `utils.ts`，四文件退化为简单调用
3. **消除 refresh.ts 重复代码** — 父级 action 与 `refresh-ui` 子项 action 完全相同，合并复用
4. **修复 index.vue 问题** — 移除未使用的 `wrapperRef`；修正 `@click="isMobile && toggleExpanded()"` 代码异味
5. **修复类型安全** — `ToolItem.vue` 的 `plugin` prop 从 `any` 改为 `Plugin`；`index.ts` 中 `__floatingBox` 使用更安全的方式
6. **SCSS Token 合规** — 将所有硬编码的 `font-size`、`font-weight`、`border-radius`、`padding`、`gap`、`right` 等值替换为全局设计 Token
7. **统一 i18n 读取路径** — 确认 `prompts.ts` 的 i18n 读取路径与其他工具一致，必要时修正

## 技术方案

### 实现策略

采用渐进式重构策略：先新增通用工具函数，再将各工厂函数迁移到调用通用函数，最后统一修复零散问题。确保每一步都不改变运行时行为。

### 关键技术决策

#### 1. 通用工具工厂函数设计

新增 `src/features/floatingBox/tools/utils.ts`，导出 `createEventDispatchTool()`：

```typescript
// 文件功能说明：悬浮框通用事件派发工具工厂
import type { Plugin } from "siyuan"
import type { FloatingTool } from "../types"
import { emitCustomEvent } from "@/utils/eventBus"

export interface EventDispatchToolConfig {
  id: string
  /** i18n 键前缀（不含 label/title 后缀） */
  i18nKey: string
  defaultLabel: string
  defaultTitle: string
  icon: string
  bgColor: string
  eventName: string
}

export function createEventDispatchTool(
  plugin: Plugin,
  config: EventDispatchToolConfig,
): FloatingTool {
  const i18n = (plugin.i18n as any)?.floatingBox || {}
  return {
    id: config.id,
    label: i18n[config.i18nKey] || config.defaultLabel,
    title: i18n[`${config.i18nKey}Title`] || config.defaultTitle,
    icon: config.icon,
    bgColor: config.bgColor,
    action: () => {
      emitCustomEvent(config.eventName)
    },
  }
}
```

四个工具工厂文件退化为单行调用。此设计遵循项目「功能模块内代码分层」规则——纯工具函数放入 `utils.ts`。

#### 2. refresh.ts 重复消除

父级 `action` 直接引用 `makeChildren()` 返回的 `refresh-ui` 子项相同逻辑，提取共用的 `refreshUI()` 函数：

```typescript
function refreshUI(): Promise<void> {
  return reloadUI()
}
```

父级 action 和 refresh-ui 子项 action 均调用此函数。

#### 3. SCSS Token 映射

| 硬编码值 | 替换为 |
| --- | --- |
| `font-size: 11px` (2处) | `font-size: $font-size-2xs` |
| `font-size: 12px` | `font-size: $font-size-xs` |
| `font-size: 13px` | `font-size: $font-size-sm` |
| `font-weight: 400` | `font-weight: $font-weight-normal` |
| `border-radius: 4px` | `border-radius: $radius-sm` |
| `border-radius: 6px` | `border-radius: $radius-base` |
| `border-radius: 8px` | `border-radius: $radius-md` |
| `border-radius: 10px` | `border-radius: $radius-lg` |
| `padding: 4px 8px` | `padding: $spacing-1 $spacing-2` |
| `padding: 8px 12px` | `padding: $spacing-2 $spacing-3` |
| `padding: 8px 14px` | `padding: $spacing-2 0.875rem` |
| `gap: 2px` | `gap: $spacing-2px` |
| `gap: 8px` | `gap: $spacing-2` |
| `right: 20px` | `right: $spacing-5` |
| `right: 6px` | `right: $spacing-3` |
| `min-width: 80px` | `min-width: 5rem` |
| `min-width: 90px` | `min-width: 5.625rem` |


### 性能考量

- 通用工厂函数在每次 `getToolsForPlatform()` 调用时仍会创建新对象，这是原有设计的特性（computed 响应式），未引入额外开销
- SCSS Token 替换是编译时常量替换，零运行时影响

### 兼容性保障

- 所有工具工厂的对外导出签名不变
- `FloatingTool` 接口不变
- 事件名不变（`emitCustomEvent("toggleSuperPanel")` 等）
- i18n 键名不变