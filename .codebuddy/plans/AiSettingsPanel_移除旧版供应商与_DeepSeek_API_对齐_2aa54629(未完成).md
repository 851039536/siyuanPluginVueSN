---
name: AiSettingsPanel 移除旧版供应商与 DeepSeek API 对齐
overview: 移除 OpenAI 和智谱两个供应商，删除 DeepSeek 旧版模型（chat/reasoner/coder），按最新官方文档修复 DeepSeek thinking 参数结构（reasoning_effort 应在 thinking 对象内），并审查清理冗余代码（resolveProvider 函数、SCSS 重复样式、i18n 接口冗余键、旧供应商兼容迁移）。
todos:
  - id: remove-providers-type-config
    content: 从 ai.ts AiProvider 类型、aiModels.ts PROVIDER_MODELS、providers.ts PROVIDERS 数组、settings.ts 注释中移除 openai 和 zhipu 供应商，并删除 DeepSeek 旧模型（deepseek-chat/reasoner/coder）
    status: pending
  - id: fix-aiapi-deepseek
    content: 修复 aiApi.ts：删除 openai/zhipu 的 API_PROVIDERS 条目，移除 resolveProvider 函数并内联判断，修复 reasoning_effort 移入 thinking 对象，简化 supportsThinkingMode，添加 getApiConfigFromPlugin 迁移降级
    status: pending
    dependencies:
      - remove-providers-type-config
  - id: cleanup-i18n-panel-styles
    content: 清理 wordQuery.json(zh/en) 删除 openAI/zhipuAI 键，AiSettingsPanel.vue Props.i18n 移除冗余键，useGeneration.ts 移除 deepseek-reasoner 条件，AiSettingsPanel.scss 提取重复按钮样式并替换硬编码值为设计 Token
    status: pending
    dependencies:
      - fix-aiapi-deepseek
---

## 产品概述

对超级面板的 AI 设置面板进行供应商清理和 DeepSeek API 对齐，移除已废弃的 OpenAI 和智谱供应商，删除 DeepSeek 旧版模型，并按照 DeepSeek 最新官方 API 文档修复思考模式参数结构。

## 核心功能

- 移除 OpenAI 和智谱（Zhipu）两个供应商：从类型定义、模型配置、供应商列表、API 调用链、i18n 中彻底清除
- 移除 DeepSeek 旧版模型（deepseek-chat、deepseek-reasoner、deepseek-coder），仅保留 V4 系列
- 按 DeepSeek 最新 API 文档修复 `reasoning_effort` 参数位置（从请求体顶层移入 `thinking` 对象内部）
- 清理冗余代码：移除 `resolveProvider` 函数（不再需要 openai 映射）、合并 SCSS 重复按钮样式、清理 i18n 接口冗余键
- 添加已保存旧供应商设置的降级兼容（openai/zhipu → tongyi）

## 技术栈

- 项目现有栈：Vite + Vue 3 + TypeScript + SCSS
- 涉及模块：superPanel、aiContentGenerator、共享配置层（types/ai.ts、config/aiModels.ts、config/settings.ts、utils/aiApi.ts）

## 实现方案

### 1. 供应商移除（类型 + 配置层）

从 `AiProvider` 联合类型中移除 `"openai"` 和 `"zhipu"`，保留 `"tongyi" | "deepseek" | "xiaomi" | "custom"`。同步删除 `PROVIDER_MODELS` 和 `PROVIDERS` 数组中对应的条目。`settings.ts` 中的注释同步更新。

关键决策：`custom` 供应商使用 OpenAI 兼容格式（请求体结构），但这属于 API 调用层的内部逻辑，与 `AiProvider` 类型中是否包含 `"openai"` 无关。移除 `"openai"` 不影响 `custom` 的行为。

### 2. DeepSeek API 修复（aiApi.ts）

**Bug 修复**：当前 `buildRequestBody` 中 DeepSeek 思考模式分支将 `reasoning_effort` 放在请求体顶层，而最新 API 文档要求它作为 `thinking` 对象的字段：

```
// 当前（错误）              // 修复后（正确）
{                           {
  thinking: {                 thinking: {
    type: "enabled"             type: "enabled",
  },                            reasoning_effort: "high"
  reasoning_effort: "high"    }
}                           }
```

**`resolveProvider` 移除**：该函数将 `custom` 映射到 `"openai"` 用于格式判断。移除 openai 后返回类型不合法。由于该函数仅在 3 处被调用且都是检查 `=== "tongyi"` 或 `=== "deepseek"`，直接内联判断即可（`custom` 不等于 tongyi 也不等于 deepseek，行为正确）。

**`supportsThinkingMode` 简化**：移除 `deepseek-reasoner` 检查（旧模型已删除），仅保留 `model.startsWith("deepseek-v4-")`。

**迁移兼容**：`getApiConfigFromPlugin` 中添加校验——已保存的 `aiApiProvider` 若为 `"openai"` 或 `"zhipu"`（不再存在于 `API_PROVIDERS`），降级为 `"tongyi"`，避免运行时 `API_PROVIDERS[provider]` 为 undefined 导致报错。

### 3. 旧模型引用清理（useGeneration.ts）

`aiContentGenerator/composables/useGeneration.ts` 中的 `supportsThinking` computed 引用了 `deepseek-reasoner`，需同步移除该条件分支，仅保留 `startsWith("deepseek-v4-")`。

### 4. i18n 清理

从 `wordQuery.json`（zh_CN + en_US）中删除 `openAI`、`zhipuAI`、`zhipuAIPlaceholder` 三个键。这些键是 wordQuery 功能遗留的，现由 superPanel 的 `PROVIDERS` 数组通过 `i18nKey` 引用，删除对应供应商后不再被访问。

### 5. SCSS 冗余清理（AiSettingsPanel.scss）

`.thinking-toggle-btn` 和 `.search-provider-btn` 样式完全相同（padding、border-radius、font-size、font-weight、cursor、transition、border、background、hover、active），提取为 SCSS placeholder `%toggle-btn-base` 并用 `@extend` 引用。同时将硬编码值替换为设计 Token：`font-size: 12px` → `$font-size-xs`、`font-size: 11px` → `$font-size-2xs`、`font-weight: 600` → `$font-weight-semibold`、`border-radius: 4px` → `$radius-sm`、`line-height: 1.4` → `$line-height-sm`。

### 6. AiSettingsPanel.vue 接口清理

`Props.i18n` 接口中移除 `openAI` 和 `zhipuAI` 两个可选键（对应供应商已删除），其余键保留作为文档示意。

## 实现注意事项

- **迁移安全**：用户已保存的 `aiApiKeys` 中可能包含 `openai` 和 `zhipu` 的密钥条目，这些条目保留在 `Record<string, string>` 中不会导致错误（只是不再被使用），无需主动清除
- **向后兼容**：`custom` 供应商的 OpenAI 兼容格式请求构建逻辑保持不变，仅移除 `resolveProvider` 间接引用层
- **性能无影响**：所有改动均为静态配置删除和参数结构调整，无运行时性能影响
- **i18n 构建产物**：`zh_CN.json` 和 `en_US.json` 是构建产物，由 `merge-i18n.mjs` 自动生成，不需要手动修改

## 目录结构

```
src/
├── types/
│   └── ai.ts                                    # [MODIFY] AiProvider 联合类型移除 "openai" | "zhipu"
├── config/
│   ├── aiModels.ts                              # [MODIFY] 删除 openai/zhipu 条目 + deepseek 旧模型
│   └── settings.ts                              # [MODIFY] 更新 aiApiProvider 注释
├── utils/
│   └── aiApi.ts                                 # [MODIFY] 删除 openai/zhipu 的 API_PROVIDERS 条目；移除 resolveProvider；修复 reasoning_effort 位置；简化 supportsThinkingMode；添加迁移降级
├── i18n/
│   ├── zh_CN/wordQuery.json                     # [MODIFY] 删除 openAI/zhipuAI/zhipuAIPlaceholder 键
│   └── en_US/wordQuery.json                     # [MODIFY] 删除 openAI/zhipuAI/zhipuAIPlaceholder 键
└── features/
    ├── superPanel/
    │   ├── components/
    │   │   ├── providers.ts                     # [MODIFY] 删除 openai/zhipu 条目
    │   │   └── AiSettingsPanel.vue              # [MODIFY] Props.i18n 移除 openAI/zhipuAI 键
    │   └── styles/
    │       └── AiSettingsPanel.scss             # [MODIFY] 提取重复按钮样式 + 硬编码值替换为 Token
    └── aiContentGenerator/
        └── composables/
            └── useGeneration.ts                 # [MODIFY] supportsThinking 移除 deepseek-reasoner 条件
```

## 关键代码结构

### DeepSeek thinking 参数修复（aiApi.ts buildRequestBody）

```typescript
// 修复后：reasoning_effort 作为 thinking 对象字段
if (options?.enableThinking !== false) {
  const reasoningEffort: DeepSeekReasoningEffort =
    options?.reasoningEffort || "high"
  return {
    ...common,
    thinking: {
      type: "enabled",
      reasoning_effort: reasoningEffort,
    },
  }
}
```

### 迁移降级（aiApi.ts getApiConfigFromPlugin）

```typescript
const rawProvider = settings.aiApiProvider || "tongyi"
const provider: AiProvider =
  rawProvider in API_PROVIDERS ? (rawProvider as AiProvider) : "tongyi"
```