---
name: wordQuery-refactor
overview: 审查 wordQuery 模块(22 文件)：修复 CLAUDE_RULES.md 违规（自定义 copyToClipboard）、补充 onunload 清理、消除 apiBase 冗余层、统一重复数据源、合并 SCSS 重复样式、收紧类型安全。
todos:
  - id: fix-p0-clipboard
    content: P0 修复：index.vue 中用 @/utils/domUtils 的 copyToClipboard 替换自定义实现，删除本地 copyToClipboard 函数
    status: completed
  - id: fix-p0-destroy
    content: P0 修复：src/index.ts onunload 中补充 __wordQuery.destroy() 调用
    status: completed
  - id: remove-apibase
    content: 删除 utils/apiBase.ts，更新 api.ts/codeUtils.ts/codeTranslation.ts/useCodeFeature.ts 共 4 个文件的导入为直接从 @/utils/aiApi 导入
    status: completed
  - id: merge-field-content-patterns
    content: 合并 FIELD_MAPPINGS 与 CONTENT_PATTERNS：在 FIELD_MAPPINGS 中增加 contentPatterns 字段，删除独立的 CONTENT_PATTERNS 常量，更新 extractContentParts computed
    status: completed
  - id: unify-language-map
    content: 提取 LANGUAGE_MAP 到 types/index.ts，index.vue 的 LANGUAGE_OPTIONS/NAMES 和 types 的 langNames 统一复用此常量
    status: completed
  - id: tighten-i18n-type
    content: 收紧 index.vue Props.i18n 类型从 Record
    status: completed
---

## 产品概述

对 `src/features/wordQuery/` 模块（22 文件）进行代码审查与重构，修复 CLAUDE_RULES 规范违规，消除数据与样式冗余，收紧类型安全，并补充扩展建议。

## 核心修复内容

### P0 - CLAUDE_RULES 规范违规

1. **替换自定义 `copyToClipboard`**：`index.vue` 中直接使用 `navigator.clipboard.writeText`，改为使用项目统一的 `copyToClipboard` / `fallbackCopyToClipboard` from `@/utils/domUtils`，符合 CLAUDE.md 剪贴板统一入口规则
2. **补充 onunload 清理**：`src/index.ts` 的 `onunload()` 中增加 `__wordQuery.destroy()` 调用，对齐其他功能模块的资源清理模式

### P1 - 数据与架构冗余

3. **删除 `utils/apiBase.ts` 纯 re-export 层**：消除 10 行间接导入层，4 个文件（api.ts / codeUtils.ts / codeTranslation.ts / useCodeFeature.ts）改为直接从 `@/utils/aiApi` 导入，减少模块依赖链深度
4. **合并 `FIELD_MAPPINGS` 与 `CONTENT_PATTERNS`**：二者定义了相同的字段集（单词/音标/释义/谐音/发音/例句），将 CONTENT_PATTERNS 作为 FIELD_MAPPINGS 的衍生属性，消除 ~40 行重复定义
5. **统一语言名称映射**：`index.vue` 的 `LANGUAGE_OPTIONS` + `LANGUAGE_NAMES` 与 `types/index.ts` 的 `langNames` 各自维护语言名称表，提取为共享常量 `LANGUAGE_MAP`
6. **收紧 i18n 类型**：`Props.i18n: Record<string, any>` 改为结构化 `WordQueryI18n` 接口

### P2 - SCSS 样式去重

7. **合并 `codeTranslation.scss` 与 `codeUtils.scss` 共享样式**：约 150 行重复的 `.input-section`、`.style-section`、`.action-section`、`.result-section`、`.error-section` 提取到 `codeUtils.scss`，`CodeTranslationPanel.vue` 改为引用 `codeUtils.scss`

### 扩展建议

README 追加可扩展方向：发音 API 集成、历史记录、批量查询、快捷粘贴等

## 技术方案

### 整体策略

不改变任何外部 API 接口，所有重构仅限于 `wordQuery/` 内部实现和 `src/index.ts` 的 onunload 补充。按 P0→P1→P2 优先级分步执行，每步可独立验证。

### 实现要点

#### 1. 替换剪贴板调用（index.vue）

```typescript
// 旧：自定义实现
const copyToClipboard = async (text: string, errorMessage?: string) => { ... }

// 新：使用统一入口
import { copyToClipboard, fallbackCopyToClipboard } from "@/utils/domUtils"
// 调用处改为 await copyToClipboard(text) 或带 fallback 的版本
```

注意 `@/utils/domUtils` 的 `copyToClipboard` 返回 `Promise<boolean>` 且内置降级逻辑（`fallbackCopyToClipboard`），与现有调用签名兼容。原代码中的 `showMessage` 错误提示在校验失败后由调用方处理，无需在工具函数内处理。

#### 2. 删除 apiBase.ts，更新 4 个导入文件

- `api.ts` L2-5：`import { callAI, getApiConfigFromPlugin } from "@/utils/aiApi"`，本地 `callAPI` 别名通过 `const callAPI = callAI` 实现
- `codeUtils.ts` L2-5：同上
- `codeTranslation.ts` L2-5：同上
- `useCodeFeature.ts` L4：`import { getApiConfigFromPlugin } from "@/utils/aiApi"`
- 删除 `utils/apiBase.ts` 文件

#### 3. 合并 FIELD_MAPPINGS 与 CONTENT_PATTERNS

在 `FIELD_MAPPINGS` 条目中增加 `contentPatterns: RegExp[]` 字段：

```typescript
const FIELD_MAPPINGS = [
  {
    pattern: /(单词|词语)：/, class: "word-section", label: "$1：",
    contentPatterns: [], // word 类型不需要复制提取
  },
  {
    pattern: /(拼音|音标)：/, class: "phonetic-section", label: "$1：",
    contentPatterns: [/音标：[^\n]+/, /拼音：[^\n]+/],
  },
  // ... 其他条目
]
```

删除独立的 `CONTENT_PATTERNS` 常量。`extractContentParts` computed 改为遍历 `FIELD_MAPPINGS` 中 `contentPatterns` 非空的条目。

#### 4. 提取 LANGUAGE_MAP 常量

在 `types/index.ts` 顶部添加：

```typescript
export const LANGUAGE_MAP: Record<string, string> = {
  auto: "自动检测", zh: "中文", en: "英文", ja: "日文",
  ko: "韩文", fr: "法文", de: "德文", es: "西班牙文",
}
```

`index.vue` 的 `LANGUAGE_OPTIONS` 从此常量生成，`types/index.ts` 的 `langNames` 直接复用 `LANGUAGE_MAP`。

#### 5. SCSS 去重

- `codeUtils.scss` 保留所有共享样式（`.input-section`、`.style-section`、`.action-section`、`.result-section`、`.error-section`）
- `codeTranslation.scss` 仅保留翻译面板特有样式（`.code-translation-panel`、`.translation-header`、`.translation-content`、`.result-item`、`.suggestions` 等）
- `CodeTranslationPanel.vue` 中修改：`@use "../styles/codeUtils.scss";` + 追加 `@use "../styles/codeTranslation.scss";`（或合并到单个 import）

### 向下兼容

- `registerWordQuery()` 签名不变，返回 `WordQueryManager` 实例不变
- `WordQueryManager` 公共 API（`queryWord`、`translateText`、`getApiConfig`）不变
- 4 个代码子组件 props 接口不变
- superPanel 通过 FEATURE_CONFIG 的引用路径不变

### 受影响的文件清单

| 文件 | 操作 | 说明 |
| --- | --- | --- |
| `src/index.ts` | MODIFY | onunload 中补 `__wordQuery.destroy()` |
| `features/wordQuery/index.vue` | MODIFY | 替换 copyToClipboard，收紧 i18n 类型，合并 FIELD_MAPPINGS/CONTENT_PATTERNS，统一语言常量 |
| `features/wordQuery/utils/apiBase.ts` | DELETE | 纯 re-export 层，删除 |
| `features/wordQuery/utils/api.ts` | MODIFY | 改从 @/utils/aiApi 直接导入 |
| `features/wordQuery/utils/codeUtils.ts` | MODIFY | 改从 @/utils/aiApi 直接导入 |
| `features/wordQuery/utils/codeTranslation.ts` | MODIFY | 改从 @/utils/aiApi 直接导入 |
| `features/wordQuery/composables/useCodeFeature.ts` | MODIFY | 改从 @/utils/aiApi 直接导入 |
| `features/wordQuery/types/index.ts` | MODIFY | 提取 LANGUAGE_MAP，复用 langNames |
| `features/wordQuery/styles/codeTranslation.scss` | MODIFY | 删除与 codeUtils.scss 重复的 ~150 行 |
| `features/wordQuery/components/CodeTranslationPanel.vue` | MODIFY | style import 改为 codeUtils.scss |
| `features/wordQuery/README.md` | MODIFY | 追加扩展建议章节 |