---
name: superPanel 自定义 API 兼容 OpenAI Completions 协议
overview: 为 superPanel 自定义 API 端点增加 OpenAI Chat Completions 协议兼容：支持填写基地址（如 https://api.example.com/v1）自动补全 /chat/completions，同时保持完整 URL 原样可用；顺带补齐本次涉及文案的 i18n 键。
todos:
  - id: normalize-endpoint
    content: 在 src/utils/aiApi.ts 新增 normalizeCustomEndpoint 纯函数并接入 getApiUrl custom 分支
    status: completed
  - id: update-settings-ui
    content: 更新 AiSettingsPanel.vue placeholder 与说明文案为 i18n 键渲染，移除 AI 设置区硬编码兜底
    status: completed
    dependencies:
      - add-i18n-keys
  - id: add-i18n-keys
    content: 补齐 zh_CN/en_US superPanel.json 的 AI 设置区 i18n 键并保持对齐
    status: completed
  - id: update-readme-verify
    content: 更新 superPanel README 端点兼容说明，运行 npx tsc --noEmit 自查类型
    status: completed
    dependencies:
      - normalize-endpoint
      - update-settings-ui
---

## 用户需求

对 superPanel 模块的 AI 配置进行审查（重点自定义 API），并增加 openai-completions（OpenAI Chat Completions）协议兼容。

## 审查结论

- **协议层已兼容**：`src/utils/aiApi.ts` 中 custom 供应商请求体已是 OpenAI Chat Completions 格式（`buildRequestBody` 的 model/messages/max_tokens/temperature）；非流式响应解析 `extractResponseText` 已含 `choices[0].message.content` 路径；流式解析 `extractOpenAIDelta` 已取 `choices[0].delta.content/reasoning_content`。
- **唯一缺口在 URL**：`getApiUrl` 对 custom 端点原样透传，用户必须填完整路径 `…/v1/chat/completions`。若按 OpenAI 兼容服务标准写法填基地址（如 `https://api.openai.com/v1`、Ollama `http://localhost:11434/v1`、one-api `http://127.0.0.1:3000/v1`），请求会 404。

## 补充说明

- 顺带发现 `AiSettingsPanel.vue` 存在 `i18n.xxx || '中文兜底'` 硬编码违规，且 superPanel i18n 分片缺 `aiSettings/apiProvider/apiKey/customEndpoint` 等键，本次新增文案全部走 i18n 键并顺带补齐 AI 设置区缺失键。
- `aiApi.ts` 已 711 行超 500 行阈值，属既有问题，本次仅做最小增量不拆分。

## 技术方案

### 端点规范化规则（保守、向后兼容）

在请求时规范化，不改存储值，用户配置原样保留：

1. trim + 去尾部斜杠
2. 已以 `/chat/completions` 或 `/completions` 结尾 → 原样返回（旧配置零影响）
3. 路径为空（纯域名）或以 `/v数字` 结尾（`/v1`、`/v2`、`/api/v1` 等）→ 自动追加 `/chat/completions`
4. 其他自定义路径 → 原样返回（用户明确指定的完整端点不动）

### 修改点

**1. `src/utils/aiApi.ts`（核心改动）**

- 新增导出纯函数 `normalizeCustomEndpoint(endpoint: string): string`，实现上述规范化规则（含 JSDoc 与文件头注释规范）
- `getApiUrl` 的 custom 分支改为 `normalizeCustomEndpoint(config.customEndpoint)`，非 custom 供应商不受影响

**2. `src/features/superPanel/components/AiSettingsPanel.vue`**

- 自定义 API 端点 placeholder 从完整 URL 改为基地址形式 `https://api.example.com/v1`
- 说明文字改为 i18n 键渲染（如 `i18n.customEndpointDesc`），说明支持两种写法：OpenAI 兼容基地址（自动补全 `/chat/completions`）或完整端点 URL
- 该文件使用 i18n 处补齐中文 HTML 注释（AGENTS_I18N 规则）

**3. `src/i18n/zh_CN/superPanel.json` + `src/i18n/en_US/superPanel.json`**

- 补齐 AI 设置区缺失键：`aiSettings`、`apiProvider`、`aiModel`、`apiKey`、`customEndpoint`、`customEndpointDesc`（说明两种写法）、`customApi`、`tongyiQianwen`、`deepSeek`、`xiaomiMiMo` 等
- 顺带移除 `AiSettingsPanel.vue` 中对应 `|| '中文兜底'` 硬编码（范围限定 AI 设置区，联网搜索区文案不动）
- 中英文键对齐，运行 `pnpm i18n:verify` 校验

**4. `src/features/superPanel/README.md`**

- AI 设置描述补充：自定义 API 支持 OpenAI 兼容基地址（自动补全 `/chat/completions`）与完整端点两种写法

### 实现要点

- `normalizeCustomEndpoint` 用正则 `/\/v\d+$/` 判断版本号结尾，URL 解析用 `new URL()` 提取 pathname 判空，避免手写字符串切割的边界错误
- 纯函数无副作用，`getApiUrl` 调用点仅 1 处（`resolveBaseParams`），改动爆炸半径极小；所有非 custom 调用路径（callAI/callAIStream/callAIChat/callAISmart）行为不变
- 非流式/流式响应解析已天然兼容 OpenAI 协议，无需改动
- 不新增设置字段（`aiCustomEndpoint` 存储原样），零迁移成本

### 目录结构（改动文件）

```
src/
├── utils/aiApi.ts                                     # [MODIFY] 新增 normalizeCustomEndpoint + getApiUrl 集成
├── features/superPanel/
│   ├── components/AiSettingsPanel.vue                  # [MODIFY] placeholder 更新 + i18n 键渲染 + 移除硬编码兜底
│   └── README.md                                       # [MODIFY] 补充自定义 API 端点兼容说明
└── i18n/
    ├── zh_CN/superPanel.json                           # [MODIFY] 补 AI 设置区 i18n 键
    └── en_US/superPanel.json                           # [MODIFY] 补 AI 设置区 i18n 键（与 zh_CN 对齐）
```