---
name: deepSeekCost 工具
overview: 在 toolCollection 中新增 deepSeekCost 工具，含两个 Tab：(1) 缓存命中率成本换算——内置 DeepSeek 官方价格表，输入命中/未命中/输出 token 数 + 选模型 + 峰谷时段，计算各项费用、总费用、缓存命中率与节省金额；(2) 余额查询——从 plugin.settings.aiApiKeys.deepseek 读取密钥，GET 调用 DeepSeek 余额 API 展示余额详情。
todos:
  - id: create-pricing-utils
    content: 创建 utils/pricing.ts：DeepSeek 价格常量 DEEPSEEK_PRICING + calcCost 纯计算函数，输出各项费用/总费用/命中率/节省金额
    status: completed
  - id: create-cost-calculator
    content: 创建 CostCalculator.vue：3 个 token 输入框 + 模型/峰谷选择 + 填入示例按钮 + computed 实时计算结果展示卡片
    status: completed
    dependencies:
      - create-pricing-utils
  - id: create-balance-query
    content: 创建 BalanceQuery.vue：读取 plugin.settings.aiApiKeys.deepseek 密钥 + fetch GET 余额 API（10s 超时）+ 余额明细展示 + 未配置密钥引导
    status: completed
    dependencies:
      - create-pricing-utils
  - id: create-index-and-styles
    content: 创建 index.vue Tab 外壳 + styles/index.scss Codex 样式 + README.md，使用 [skill:codex-ui-style-guide] 审查样式合规性
    status: completed
    dependencies:
      - create-cost-calculator
      - create-balance-query
  - id: register-and-i18n
    content: 在 registry.ts 添加工具注册项 + 创建 zh_CN/en_US deepSeekCost.json i18n 分片，运行 i18n:verify 验证
    status: completed
    dependencies:
      - create-index-and-styles
---

## 产品概述

在工具合集（toolCollection）中新增一个 DeepSeek 成本计算工具，集成两大功能：缓存命中率成本换算与账户余额查询。帮助用户直观了解 DeepSeek API 的缓存命中节省效果，并实时查看账户余额。

## 核心功能

- **缓存命中率成本换算**：用户输入命中缓存 token、未命中缓存 token、输出 token 三项数值，选择模型（deepseek-v4-flash / deepseek-v4-pro），可选高峰时段倍率（x1 / x2），自动计算各项费用明细、总费用、缓存命中率、缓存节省金额。提供"填入示例"快捷按钮一键填充用户提供的示例数据。
- **余额查询**：从插件设置中读取 DeepSeek API 密钥（`plugin.settings.aiApiKeys.deepseek`），调用 DeepSeek 官方余额查询 API，展示总余额、赠送余额、充值余额及可用状态。未配置密钥时引导用户前往超级面板配置。

## 技术栈

- 框架：Vue 3 + TypeScript（已有项目栈）
- 样式：SCSS + Codex 设计 Token（`$font-size-*` / `$font-weight-*` / `$vp-radius` / `$spacing-*` / `$vp-mono`）
- 组件库：项目内置 `@/components/Button.vue`、`@/components/Input.vue`、`@/components/Select.vue`、`@/components/IconWrapper.vue`
- 图标：`@iconify/vue` 的 `<Icon>` 组件，直接使用 `mdi:xxx` 字符串（工具 Tab 图标走 registry 原始字符串，无需注册到 `FEATURE_ICONS`）

## 实现方案

### 整体策略

在 `toolCollection/tools/` 下新建 `deepSeekCost/` 工具目录，遵循 unitConverter 的多 Tab 外壳模式。工具内含两个 Tab（成本换算 + 余额查询），通过 `v-if` 切换子组件。仅需修改 `registry.ts` 一处 + 新建工具文件 + i18n 分片，无需触及 8 步注册清单（toolCollection 已注册）。

### 密钥获取

余额查询需要 DeepSeek 专用密钥，直接从 `props.plugin.settings.aiApiKeys?.deepseek` 读取（`Record<string, string>`，按 provider 存储）。不使用 `getApiConfigFromPlugin`，因为该函数返回当前 AI provider 的密钥，而用户当前 provider 可能是通义等非 DeepSeek。直接读 `aiApiKeys.deepseek` 确保获取 DeepSeek 专用密钥。

### 成本计算逻辑

价格表硬编码为常量（来源 DeepSeek 官网，元/百万 tokens）：

| 计费项 | deepseek-v4-flash | deepseek-v4-pro |
| --- | --- | --- |
| 输入（缓存命中） | 0.02 | 0.025 |
| 输入（缓存未命中） | 1 | 3 |
| 输出 | 2 | 6 |


- 费用 = token 数 × 单价 ÷ 1,000,000 × 峰谷倍率
- 缓存命中率 = 命中 token ÷ (命中 + 未命中) × 100%
- 缓存节省 = 命中 token × (未命中价 - 命中价) ÷ 1,000,000 × 倍率
- 总 token 自动计算 = 命中 + 未命中 + 输出

纯计算函数放在 `utils/pricing.ts`，无 Vue 响应式依赖，可被任何文件导入。价格常量放在同文件的 `DEEPSEEK_PRICING` 导出。

### 余额查询 API

直接 `fetch` GET `https://api.deepseek.com/user/balance`，请求头 `Authorization: Bearer <apiKey>`。不走 `callAI`（callAI 是 POST chat/completions）。响应结构：`{ is_available: boolean, balance_infos: [{ currency, total_balance, granted_balance, topped_up_balance }] }`。余额字段为字符串类型，需 `parseFloat` 转换展示。

### 性能与可靠性

- 成本换算：纯前端计算，computed 驱动，无性能瓶颈
- 余额查询：用户手动触发（点击按钮），不轮询；fetch 失败时展示错误信息 + 重试按钮；设置 10s 超时（AbortController）
- 无持久化资源（无定时器/监听器/Modal），无需 destroy 方法

## 实现注意事项

- 余额查询直接使用 `fetch`，这是 toolCollection 工具内部的数据获取行为（非存储/AI/事件类统一入口管辖范围），合规
- 工具 Tab 图标使用 `mdi:currency-cny` 原始字符串，registry.ts 中直接写，无需在 `icons.ts` 注册（参照现有工具 `mdi:book`、`mdi:code-json` 模式）
- 模板中每个 i18n 键渲染处必须加中文 HTML 注释；i18n 分片文件用 `deepSeekCost.json`，禁止直接写 `zh_CN.json`/`en_US.json`
- 所有 SCSS 禁止硬编码 `font-size`/`font-weight`/`line-height`，使用 `$font-size-*`/`$font-weight-*`/`$line-height-*` Token；禁止 `box-shadow`，改用边框
- 根容器显式设置 `font-size: $font-size-xs` 防止继承思源默认大字号
- 每个文件头部需加功能注释（.ts 用 `//`，.vue 用 `<!-- -->`）
- 工具内含 2 个 Tab（< 3 个），组件保持平铺，不建子文件夹

## 架构设计

```
toolCollection (已注册)
  └── tools/deepSeekCost/ (新工具)
      ├── index.vue          # Tab 外壳：成本换算 / 余额查询
      ├── components/
      │   ├── CostCalculator.vue   # 成本换算面板
      │   └── BalanceQuery.vue     # 余额查询面板
      ├── utils/
      │   └── pricing.ts     # 价格常量 + 纯计算函数
      └── styles/
          └── index.scss     # Codex 风格样式
```

数据流：

- CostCalculator：用户输入 3 个 token 数 + 选模型 + 选峰谷 → computed 实时计算 → 展示明细
- BalanceQuery：读取 `plugin.settings.aiApiKeys.deepseek` → 用户点击查询 → fetch GET → 展示余额
- 密钥获取无跨功能导入：`plugin` 通过 toolCollection 面板的 props 传递到工具组件

## 目录结构

```
src/features/toolCollection/tools/deepSeekCost/
├── index.vue                    # [NEW] 工具主容器：Tab 切换外壳。Props { plugin, i18n }。含两个 Tab（成本换算/余额查询），通过 activeTab ref + v-if 切换子组件。参照 unitConverter/index.vue 结构。
├── components/
│   ├── CostCalculator.vue       # [NEW] 成本换算面板。3 个 Input（命中/未命中/输出 token，type=number, size=xsmall）+ Select（模型选择）+ Select（峰谷倍率 x1/x2）+ "填入示例" Button。computed 计算各项费用、总费用、命中率、节省金额。结果用 .converter-result 卡片展示。
│   └── BalanceQuery.vue         # [NEW] 余额查询面板。onMounted 检测密钥，未配置时显示引导提示。查询按钮触发 fetch GET https://api.deepseek.com/user/balance（Authorization: Bearer），10s 超时。展示 is_available 状态 + balance_infos 金额明细卡片。
├── utils/
│   └── pricing.ts               # [NEW] DeepSeek 价格常量 DEEPSEEK_PRICING（2 模型 × 3 计费项）+ 纯计算函数 calcCost(input) → CostResult。无 Vue 依赖。
├── styles/
│   └── index.scss               # [NEW] Codex 风格样式。Tab 栏 + 输入区 + 结果卡片 + 余额卡片。使用 $font-size-*$font-weight-*$vp-radius$spacing-* Token，禁 box-shadow。
└── README.md                    # [NEW] 工具说明文档

src/i18n/zh_CN/deepSeekCost.json # [NEW] 中文翻译分片
src/i18n/en_US/deepSeekCost.json # [NEW] 英文翻译分片

src/features/toolCollection/tools/registry.ts  # [MODIFY] 添加 import DeepSeekCostTool + TOOL_REGISTRY 数组项 + TOOL_LABEL_KEYS 映射（约 10 行）
```

## 关键代码结构

```typescript
// utils/pricing.ts — 价格常量与计算函数

/** DeepSeek 模型 ID */
type DeepSeekModel = "deepseek-v4-flash" | "deepseek-v4-pro"

/** 单模型价格表（元/百万 tokens） */
interface ModelPricing {
  cachedInput: number
  uncachedInput: number
  output: number
}

/** 全部模型价格表 */
const DEEPSEEK_PRICING: Record<DeepSeekModel, ModelPricing> = {
  "deepseek-v4-flash": { cachedInput: 0.02, uncachedInput: 1, output: 2 },
  "deepseek-v4-pro": { cachedInput: 0.025, uncachedInput: 3, output: 6 },
}

/** 成本计算输入 */
interface CostInput {
  cachedTokens: number
  uncachedTokens: number
  outputTokens: number
  model: DeepSeekModel
  peakMultiplier: number  // 1 = 平时, 2 = 高峰
}

/** 成本计算结果 */
interface CostResult {
  cachedCost: number
  uncachedCost: number
  outputCost: number
  totalCost: number
  cacheHitRate: number       // 0~100
  cacheSavings: number       // 缓存节省金额
  totalTokens: number
}

function calcCost(input: CostInput): CostResult
```

```typescript
// BalanceQuery.vue 内的 API 调用签名

interface DeepSeekBalanceResponse {
  is_available: boolean
  balance_infos: Array<{
    currency: string
    total_balance: string
    granted_balance: string
    topped_up_balance: string
  }>
}

// fetch GET https://api.deepseek.com/user/balance
// Header: Authorization: Bearer ${apiKey}
// 超时: AbortController 10s
```

## Agent Extensions

### Skill

- **codex-ui-style-guide**
- Purpose: 确保新增 deepSeekCost 工具的 SCSS/Vue 样式完全符合 Codex UI 规范（设计 Token 使用、字号层级、禁 box-shadow 等）
- Expected outcome: 样式零违规，所有 font-size/font-weight/line-height/radius/spacing 均使用全局 Token，通过规范审查

### MCP

- **Context7**
- Purpose: 查询 Vue 3 computed/watch 最新文档，确保响应式计算逻辑的写法符合最佳实践
- Expected outcome: 成本换算的实时计算使用正确的 computed 模式，无冗余 watch