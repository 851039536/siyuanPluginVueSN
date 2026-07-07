---
name: migrate-wordquery-to-toolcollection
overview: 将 wordQuery 功能从独立的 Dock 面板完整迁移到 toolCollection 底部面板中作为一个 Tab 工具，遵循 base64Image/unitConverter 的迁移先例。涉及 20+ 个文件的移动、重构和引用更新。
todos:
  - id: extract-ai-logic
    content: 从 WordQueryManager 提取 buildPrompt / translateText / isEnglishWord 到 utils/api.ts，并从 types/index.ts 移除 WordQueryManager 类和旧 index.ts
    status: completed
  - id: refactor-index-vue
    content: 改造 wordQuery index.vue：移除 onQuery/onTranslate Props，改为直接使用 callWordQueryAPI + getApiConfigFromPlugin 自包含调用
    status: completed
    dependencies:
      - extract-ai-logic
  - id: move-files-to-toolcollection
    content: 将 wordQuery 全部文件移动到 toolCollection/tools/wordQuery/ 目录，删除旧的 src/features/wordQuery/
    status: completed
  - id: integrate-toolcollection
    content: 在 toolCollection/index.vue 中注册 wordQuery 工具 Tab，添加 tools 条目和组件引用
    status: completed
    dependencies:
      - move-files-to-toolcollection
      - refactor-index-vue
  - id: update-registration-chain
    content: 更新 src/index.ts（移除 registerWordQuery 和 __wordQuery 清理）、src/features/index.ts（移除导出、_Registered→_ConfigOnly）
    status: completed
    dependencies:
      - integrate-toolcollection
---

## 产品概述

将 wordQuery 功能模块（当前独立 Dock 面板）完整迁移到 toolCollection 底部面板，作为一个新的工具 Tab。迁移后 wordQuery 不再拥有独立 Dock 注册，所有功能通过工具合集面板统一访问。

## 核心变更

- **自包含改造**：wordQuery 面板不再依赖外部 `onQuery`/`onTranslate` 回调，通过 `plugin` prop 直接调用 AI API
- **代码平移到 toolCollection**：14 个源文件整体移动到 `toolCollection/tools/wordQuery/` 目录
- **注册链更新**：移除独立 Dock 注册，标记为 Config-Only 保留功能开关
- **零功能变化**：6 个子模式（单词查询、长文翻译、编程翻译、注释生成、代码解释、正则生成）全部保持不变

## 技术方案

### 迁移策略

采用**代码平移 + 最小修改**策略。利用 wordQuery 模块内部全部使用相对路径导入的特点，整体移动到新位置后无需修改任何内部引用路径。

### 关键改动点

#### 1. 提取 AI 调用逻辑（`utils/api.ts`）

从 `types/index.ts` 的 `WordQueryManager` 类中提取两个关键方法到 `utils/api.ts`：

- `buildPrompt(word: string): string` — 构造单词查询 prompt
- `buildTranslatePrompt(text, sourceLang, targetLang): string` — 构造翻译 prompt
- `isEnglishWord(text: string): boolean` — 英文单词判断

这使 `index.vue` 可以不再依赖 `WordQueryManager` 实例，直接调用纯函数。
`WordQueryManager` 类和旧 `wordQuery/index.ts`（Dock 注册入口）将被删除。

#### 2. 改造 `index.vue` Props

移除 `onQuery`/`onTranslate` 回调 Props，改为直接从 `plugin` prop 获取 API 配置：

```ts
// 旧 Props（Dock 模式）
interface Props {
  i18n: Record<string, any> & { wordQuery?: Record<string, string> }
  plugin?: Plugin
  onQuery: (word: string) => Promise<string>
  onTranslate?: (...args) => Promise<string>
}

// 新 Props（工具模式）
interface Props {
  i18n: Record<string, any> & { wordQuery?: Record<string, string> }
  plugin?: Plugin
}
```

`handleQuery` 改为直接调用 `callWordQueryAPI(buildPrompt(word), getApiConfigFromPlugin(plugin))`。
`handleTranslate` 已有的 fallback 逻辑保留，但移除 `props.onTranslate` 分支（仅保留直接 AI 调用路径）。

#### 3. 文件移动

```
src/features/wordQuery/                     src/features/toolCollection/tools/wordQuery/
├── index.ts           → 删除（Dock注册，不再需要）
├── index.vue          → [MODIFY] 改为自包含 Props
├── README.md          → [KEEP]
├── types/
│   ├── index.ts       → [MODIFY] 移除 WordQueryManager 类，保留 LANGUAGE_MAP + WordQueryComponentProps
│   └── storage.ts     → [KEEP]
├── utils/
│   ├── api.ts         → [MODIFY] 新增 buildPrompt / buildTranslatePrompt / isEnglishWord
│   ├── codeTranslation.ts → [KEEP]
│   └── codeUtils.ts   → [KEEP]
├── composables/
│   └── useCodeFeature.ts → [KEEP]
├── components/        → [KEEP] 全部 4 个组件
└── styles/            → [KEEP] 全部 2 个 SCSS
```

内部相对导入（`./components/`、`../types/`、`../utils/` 等）因整体平移无需修改。

#### 4. toolCollection 集成

`toolCollection/index.vue` 中：

- 导入 `WordQueryTool from "./tools/wordQuery/index.vue"`
- `tools` computed 数组添加 `{ id: "wordQuery", label: i18n.wordQuery?.title || "单词查询", icon: "mdi:book" }`
- 模板添加 `<WordQueryTool v-if="currentTool === 'wordQuery'" :plugin="plugin" :i18n="plugin.i18n" />`

#### 5. 外部引用更新

| 文件 | 变更 |
| --- | --- |
| `src/index.ts` | 移除 `registerWordQuery` 导入和调用（行64、行270）；移除 `__wordQuery.destroy()` 清理（行224-226） |
| `src/features/index.ts` | 移除 `export { registerWordQuery }`（行96）；`_Registered` 中移除 `"wordQuery"`（行110）；`_ConfigOnly` 添加 `"wordQuery"` |
| `src/features/wordQuery/` | 整个目录删除 |


#### 6. 保留不变

- `src/config/settings.ts` — `enableWordQuery` 设置项
- `src/config/icons.ts` — wordQuery 图标（`mdi:book`）
- `src/i18n/zh_CN/wordQuery.json` / `en_US/wordQuery.json` — 全部 112 个翻译键
- `src/features/config.ts` — `FEATURE_CONFIG` 中 wordQuery 条目（用于 UI 开关展示）