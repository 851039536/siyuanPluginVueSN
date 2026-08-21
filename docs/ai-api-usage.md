# AI 调用统一文档（ai-api-usage）

> 本文档是**唯一**的 AI 调用参考文档，覆盖"如何读取超级面板 AI 设置"与"如何发起 AI 调用"的完整用法。
> 所有新增功能的 AI 功能**必须**遵循本文档的入口与模式（见 AGENTS_API.md「强制规则：AI 调用」）。

## 1. 背景与唯一入口

项目中所有 AI 调用统一收敛到 `src/utils/aiApi.ts`，禁止任何功能模块直接 `fetch` 第三方 LLM API 或硬编码 API Key / 端点。

超级面板（`PluginSettings`）中配置了 **AI 供应商（provider）、API Key、模型、思考模式、联网搜索** 等全局设置。功能模块通过 `getApiConfigFromPlugin(plugin)` 自动读取这些设置，无需感知设置面板的实现细节。

```
Feature 组件
  → getApiConfigFromPlugin(plugin)   // 自动读取超级面板设置（含迁移降级）
  → callAI / callAISmart / ...        // 统一调用入口（内部处理请求体/请求头/SSE 解析）
  → 返回 Promise<string>（完整回答文本）
```

## 2. API 总览

`src/utils/aiApi.ts` 共导出 5 个函数 + 类型重导出：

| 函数 | 签名 | 用途 |
|------|------|------|
| `callAI` | `(prompt, config, options?) => Promise<string>` | 非流式调用，一次性返回完整文本 |
| `callAIStream` | `(prompt, config, onChunk, options?) => Promise<string>` | 流式调用，通过 `onChunk` 增量返回正文 |
| `callAISmart` | `(prompt, config, options?) => Promise<string>` | **推荐入口**：传入 `onChunk` 自动走流式，否则走非流式 |
| `callAIChat` | `(messages, config, options?) => Promise<string>` | 多轮对话：接收完整 `messages` 数组（含历史），不走 RAG/systemPrompt |
| `getApiConfigFromPlugin` | `(plugin) => AiApiConfig` | 从插件实例读取超级面板 AI 配置（含迁移降级） |

> **推荐入口是 `callAISmart`**：调用方只需在 `options.onChunk` 上判断是否需要流式，由它自动选择底层实现。`callAI` / `callAIStream` 保留给明确只需要单一模式的场景。

类型定义（`src/types/ai.ts`，也可从 `@/utils/aiApi` 直接导入）：

```typescript
export type AiProvider = "tongyi" | "deepseek" | "xiaomi" | "custom"

export interface AiApiConfig {
  provider: AiProvider
  model: string
  apiKey: string
  customEndpoint: string
  enableThinking?: boolean
  searchConfig?: SearchApiConfig   // 联网搜索配置（RAG 模式）
}

export type DeepSeekReasoningEffort = "low" | "high" | "max"

export interface AiCallOptions {
  systemPrompt?: string
  temperature?: number
  maxTokens?: number
  signal?: AbortSignal                // 取消请求（AbortController）
  onChunk?: (chunk: string) => void   // 流式正文增量
  onReasoningChunk?: (chunk: string) => void // DeepSeek 思考过程增量
  enableThinking?: boolean            // 覆盖全局思考开关
  reasoningEffort?: DeepSeekReasoningEffort // 思考强度（默认 "high"）
  webSearch?: boolean                 // 联网搜索（RAG 先搜后答）
  searchQuery?: string                // 显式搜索关键词
  onSearchStart?: () => void
  onSearchResults?: (results: SearchResult[]) => void
  onSearchError?: (error: string) => void
  responseFormat?: { type: "json_object" } | { type: "text" } // 仅兼容 OpenAI 格式
}
```

内置供应商端点与默认模型（`API_PROVIDERS` 常量）：

| provider | 端点 | 默认模型 |
|----------|------|----------|
| `tongyi` | `https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation` | `qwen-plus` |
| `deepseek` | `https://api.deepseek.com/v1/chat/completions` | `deepseek-v4-flash` |
| `xiaomi` | `https://api.xiaomimimo.com/v1/chat/completions` | `mimo-v2-flash` |
| `custom` | 用户配置的 `customEndpoint` | `default` |

## 3. 读取超级面板设置：`getApiConfigFromPlugin`

```typescript
import { getApiConfigFromPlugin } from "@/utils/aiApi"

const config = getApiConfigFromPlugin(plugin)
// 结果示例：
// {
//   provider: "deepseek",
//   model: "deepseek-v4-flash",   // 若选择"自定义模型"则取 aiCustomModel
//   apiKey: "sk-xxx",             // 按 provider 自动取 aiApiKeys[provider]（无则回退 aiApiKey）
//   customEndpoint: "",
//   enableThinking: false,        // 全局思考开关
//   searchConfig: { searchProvider, bochaApiKey, jinaApiKey, ... },
// }
```

要点：
- `model`：超级面板选择"自定义模型"时返回 `aiCustomModel`，否则返回所选模型 ID。
- `apiKey`：优先取 `aiApiKeys[provider]`，缺失时回退到旧字段 `aiApiKey`。
- **迁移降级**：已废弃的 `openai` / `zhipu` 供应商会自动降级为 `tongyi`，调用方无需感知。

## 4. 标准调用模式（非流式）

```typescript
import { callAI, getApiConfigFromPlugin } from "@/utils/aiApi"

const config = getApiConfigFromPlugin(plugin)
const result = await callAI(prompt, config, {
  systemPrompt: "你是一个专业的代码审查助手。",
  temperature: 0.7,
  maxTokens: 1000,
})
```

未配置 API Key 时抛出错误：`请先在超级面板中配置API密钥`。

## 5. 流式调用模式

```typescript
import { callAISmart, getApiConfigFromPlugin } from "@/utils/aiApi"

const config = getApiConfigFromPlugin(plugin)
const result = await callAISmart(prompt, config, {
  onChunk: (chunk) => { /* 追加到 UI 正文 */ },
  onReasoningChunk: (chunk) => { /* 展示 DeepSeek 思考过程 */ },
})
```

- 传入 `onChunk` → 自动走 `callAIStream`；不传 → 走 `callAI`（推荐用 `callAISmart` 省去分支）。
- 内部使用 SSE 逐行解析，`try` 仅包住 JSON 解析，非 JSON 行（如通义 `event:`/`id:` 行）自动忽略。
- 响应完成前取消：`signal` 传入 `AbortController.signal`。

## 6. DeepSeek 思考模式

仅 `deepseek-v4-` 前缀模型启用思考模式（`supportsThinkingMode` 判断）。

```typescript
import { callAISmart, getApiConfigFromPlugin } from "@/utils/aiApi"

const config = getApiConfigFromPlugin(plugin)
const result = await callAISmart(prompt, config, {
  enableThinking: true,        // 覆盖全局思考开关（单次调用 > 全局）
  reasoningEffort: "high",     // "low" | "high" | "max"，默认 "high"
  onReasoningChunk: (chunk) => { /* 思考过程增量 */ },
  model: "deepseek-v4-pro",    // 可选，覆盖全局模型
})
```

请求体结构（由 `buildRequestBody` 生成，调用方无需关心）：

```json
{
  "model": "deepseek-v4-pro",
  "messages": [...],
  "thinking": {
    "type": "enabled",
    "reasoning_effort": "high"
  }
}
```

**关键约束（调用方必须知道的 3 点）**：
1. `reasoning_effort` 必须放在 `thinking` 对象**内**（DeepSeek 官方规范），放在顶层会被忽略。
2. 思考模式下 DeepSeek **不接受 `temperature`**，`buildRequestBody` 会自动不传该字段。
3. 显式 `enableThinking: false` 时必须传 `thinking: { type: "disabled" }`，否则 DeepSeek API 仍默认开启思考——这已由 `buildRequestBody` 内部处理。

思考模式优先级：单次调用 `options.enableThinking` > 全局 `config.enableThinking`（`mergeOptions` 实现）。

## 7. 联网搜索（RAG 先搜后答）

所有 provider 通用。开启后内部先调用搜索 API 取真实数据，重排序后注入 system prompt，再让 LLM 基于真实数据回答。

```typescript
import { callAISmart, getApiConfigFromPlugin } from "@/utils/aiApi"

const config = getApiConfigFromPlugin(plugin) // searchConfig 已自动带上
const result = await callAISmart(prompt, config, {
  webSearch: true,
  searchQuery: "思源笔记 插件开发",  // 可选，显式关键词优先于自动提取
  onSearchStart: () => { /* 显示"正在搜索..." */ },
  onSearchResults: (results) => { /* 展示来源列表 */ },
  onSearchError: (err) => { /* 搜索失败提示 */ },
})
```

- 搜索供应商由超级面板配置（`bocha` / `jina` / `searxng`），配置在 `config.searchConfig` 中。
- 未显式传 `searchQuery` 时，自动从 prompt 提取（去代码块/标题/链接后取前 200 字）。
- 搜索失败不中断生成：降级为"无搜索结果继续回答"，并注入失败说明。

## 8. 多轮对话：`callAIChat`

适用于智能体问答等需要传递对话历史的场景。**不走 RAG / systemPrompt**——系统提示词应直接作为 `messages[0]` 传入。

```typescript
import { callAIChat, getApiConfigFromPlugin } from "@/utils/aiApi"

const config = getApiConfigFromPlugin(plugin)
const result = await callAIChat(
  [
    { role: "system", content: "你是客服助手。" },
    { role: "user", content: "第一轮问题" },
    { role: "assistant", content: "第一轮回答" },
    { role: "user", content: "当前问题" },
  ],
  config,
  { temperature: 0.5 },
)
```

传入 `onChunk` 同样自动切流式。

## 9. 已有调用方清单（参考实现）

以下模块均已通过 `getApiConfigFromPlugin` + `callAI`/`callAISmart` 接入超级面板设置，新增功能可对照实现：

| 功能 | 文件 | 用途 |
|------|------|------|
| wordQuery 工具 | `src/features/toolCollection/tools/wordQuery/`（6 处） | 翻译、代码注释、代码解释、正则、字段翻译 |
| imageCreation | `src/features/imageCreation/components/CoverTab.vue` | 提取关键字、AI 配图 |
| gitPush | `src/features/gitPush/managers/CommitMsgGenerator.ts` | 生成 commit message |
| generalSettings | `src/features/generalSettings/modules/WordExplainer.ts` | 单词解释 |
| skillLearning | `src/features/skillLearning/components/SkillDialog.vue` | 技能卡片内容生成 |
| floatingToolbar | `src/features/floatingToolbar/core/actions/translate.ts`、`components/PronunciationDialog.vue` | 划词翻译、发音 |
| aiContentGenerator | `src/features/aiContentGenerator/modules/AIContentGenerator.ts` | 内容生成（`callAISmart` + 思考模式 + 审核） |

**完整链路参考**（aiContentGenerator，最完整的流式 + 思考 + 审核用例）：
- `src/features/aiContentGenerator/composables/useGeneration.ts` — 构建 `GenerateOptions`（`reasoningEffort` 等）
- `src/features/aiContentGenerator/modules/AIContentGenerator.ts` — `generateContent()` 调用 `callAISmart` 透传 `enableThinking` / `reasoningEffort` / `onReasoningChunk`

## 10. 禁止事项

- ❌ 禁止在功能模块中直接 `fetch` 第三方 LLM API——必须走 `@/utils/aiApi` 的统一入口
- ❌ 禁止硬编码 API Key / 模型名 / 端点 URL——必须通过 `getApiConfigFromPlugin(plugin)` 读取超级面板设置
- ❌ 禁止手写 `thinking.reasoning_effort` 到顶层字段或自行拼 SSE 解析——请求体构建与流式解析已封装
- ❌ 禁止使用 `(window as any).siyuan` 访问插件实例——`plugin` 实例必须通过 props / 注册参数传入
- ✅ `callAISmart` 是推荐入口（自动选择流式/非流式）；仅需固定模式时才用 `callAI` / `callAIStream`

## 11. 相关文件

| 文件 | 说明 |
|------|------|
| `src/utils/aiApi.ts` | 统一 AI 调用入口（5 个导出函数 + 内部请求体/SSE/RAG 实现） |
| `src/types/ai.ts` | `AiProvider` / `AiApiConfig` / `AiCallOptions` / `SearchApiConfig` 等类型 |
| `src/utils/webSearch.ts` | RAG 搜索实现（`searchWeb` / `rerankResults` / `formatSearchResults`） |
| `src/features/aiContentGenerator/` | 最完整的参考实现（流式 + 思考 + 审核） |
