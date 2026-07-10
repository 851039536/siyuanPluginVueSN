---
name: pronunciation-dialog-review-fix
overview: 修复 PronunciationDialog.vue 审查中发现的 9 类问题，按优先级分 3 批：架构违规 + XSS 安全（P0）、i18n 硬编码 + 重复触发（P1）、SCSS 违规 + 代码质量（P2）。涉及 4-5 个文件的修改。
todos:
  - id: extract-flashcard-storage
    content: 将 Flashcard 类型 + FlashcardStorage 类提取到 src/utils/sharedStorage/flashcardStorage.ts，3 个 floatingToolbar 文件 + flashcardReading 内部文件全部改为从公共模块导入
    status: completed
  - id: fix-xss-and-format
    content: 移除 v-html，在 domUtils 新增 simpleHtmlEscape 函数，formatResult 改为安全渲染
    status: completed
  - id: fix-i18n
    content: 模板中 20+ 处硬编码中文改为 props.i18n 读取，脚本中 10+ 处 showMessage 消息改用 i18n，补全中英文 pronunciation.json 翻译键
    status: completed
  - id: fix-duplicate-watch
    content: 合并 watch(content) 和 watch(visible) 的触发逻辑，避免重复请求
    status: completed
  - id: fix-duplicate-categories
    content: 提取 DEFAULT_CATEGORIES 模块级常量，消除 loadCategories 中的重复定义
    status: completed
  - id: fix-scss-codex
    content: 使用 [skill:codex-ui-style-guide] 审查并修复 pronunciation.scss 的 8 处 Codex 规范违规
    status: completed
  - id: fix-code-quality
    content: 补充文件头注释、onUnmounted 清理缓存、props.i18n 改为具体接口、showMessage 导入路径统一为 @/ 别名
    status: completed
---

## 用户需求

修复 `src/features/floatingToolbar/components/PronunciationDialog.vue` 审查中发现的所有问题，按优先级分为三级。

## 核心修复项

### P0 — 架构违规与安全漏洞

1. **解除跨 Feature 直接导入**：将 `Flashcard` 类型和 `FlashcardStorage` 类提取到 `src/utils/` 公共层，消除 floatingToolbar → flashcardReading 的直接硬依赖。联动修复 `HeatmapMarker.ts` 和 `FloatingToolbar.ts` 中同样的违规导入。
2. **修复 XSS 安全漏洞**：移除 `v-html`，改用安全的 HTML 转义函数，确保 AI 返回内容不会被注入恶意脚本。

### P1 — i18n 补全与逻辑修复

3. **补全 i18n**：模板中 20+ 处硬编码中文和脚本中 10+ 处中文提示消息全部改用 `props.i18n` 读取，同步补全中英文翻译文件。
4. **消除重复触发**：`watch(content)` 和 `watch(visible)` 同时触发 `generatePronunciation()` 时引入防重复机制。
5. **消除重复定义**：默认类别列表提取为模块级常量，`loadCategories` 复用同一常量。

### P2 — SCSS 规范与代码质量

6. **SCSS Codex 规范修复**：修复 8 处违反 Codex 规则的硬编码（缺少本地 Token、硬编码颜色/间距/圆角）。
7. **补充文件头注释**。
8. **onUnmounted 中清理模块级缓存**。
9. **props.i18n 类型从 `any` 改为具体接口**。
10. **统一导入路径**：`showMessage` 改为 `@/` 别名。

## 技术方案

### 1. 解除跨 Feature 直接导入

**当前问题**：3 个 floatingToolbar 文件直接 import flashcardReading：

| 文件 | 导入内容 |
| --- | --- |
| `PronunciationDialog.vue` | `Flashcard` 类型 + `FlashcardStorage` 类 |
| `HeatmapMarker.ts` | `FlashcardStorage` 类 |
| `FloatingToolbar.ts` | `FlashcardStorage` 类 |


**方案**：将 `FlashcardStorage` 和 `Flashcard`（含 `CreateFlashcardDTO`）提取到 `src/utils/sharedStorage/flashcardStorage.ts`：

- `Flashcard` 接口是纯数据模型，与 flashcardReading 业务逻辑解耦，提取后不会形成循环依赖
- `FlashcardStorage` 类依赖 `PluginStorage`（已在 `@/utils/` 下），提取不引入新依赖
- flashcardReading 内部从 `@/utils/sharedStorage/flashcardStorage` 重导出，保持对外 API 兼容
- floatingToolbar 中 3 个文件改为从公共模块导入

**目录变化**：

```
src/utils/sharedStorage/
├── flashcardStorage.ts    # [NEW] Flashcard 类型 + FlashcardStorage 类
└── index.ts               # [NEW] 统一导出
```

### 2. XSS 安全修复

`formatResult` 当前实现：

```typescript
function formatResult(result: string): string {
  return result
    .replace(/####\s+(.+)\n*/g, "")
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\n/g, "<br/>")
}
```

**方案**：在 `@/utils/domUtils` 中新增 `simpleHtmlEscape` 函数，formatResult 先转义全部 HTML，再按规则替换 markdown 标记为安全标签（仅 `<strong>` 和 `<br>`）。

### 3. i18n 补全

新增 20+ 个翻译键到 `src/i18n/{zh_CN,en_US}/pronunciation.json`：

```
{
  "dialogTitle": "谐音翻译",
  "close": "关闭",
  "inputLabel": "输入内容",
  "inputPlaceholder": "输入中文或英文...",
  "generateBtn": "生成",
  "generatingBtn": "生成中...",
  "resultTitle": "谐音记忆",
  "sourceAI": "AI生成",
  "sourceLocal": "来自单词本",
  "addToCard": "添加到单词本",
  "copyResult": "复制结果",
  "emptyText": "输入单词或短语以生成谐音记忆",
  "addCardTitle": "添加到单词本",
  "wordLabel": "单词:",
  "selectCategory": "选择类别",
  "selectCategoryPlaceholder": "请选择类别",
  "customCategory": "自定义...",
  "customCategoryPlaceholder": "输入自定义类别",
  "cancel": "取消",
  "add": "添加",
  "msgInputRequired": "请输入内容",
  "msgLoadFromLocal": "从单词本加载",
  "msgGenerated": "谐音记忆已生成",
  "msgGenerateFailed": "生成失败，请重试",
  "msgIncompleteData": "数据不完整",
  "msgSelectCategory": "请选择类别",
  "msgAdded": "已添加到单词本",
  "msgTitleExists": "该单词已存在于单词本中",
  "msgCopySuccess": "已复制到剪贴板",
  "msgCopyFailed": "复制失败"
}
```

### 4. 重复触发修复

两个 watch 都调用 `generatePronunciation()`。修复后：

- 当 content 变化且 visible 为 true → 第一个 watch 已处理
- 当 visible 从 false→true 且 inputWord 已有值 → 第二个 watch 处理
- 添加 `isGenerating` 防并发锁（已存在，但需检查边界情况）

合并策略：第二个 watch 检测当前是否已有缓存结果（来源相同 + 内容相同），避免重复请求。

### 5. 默认类别去重

```typescript
// 模块级常量
const DEFAULT_CATEGORIES = ["C#", "编程单词", "JavaScript", "TypeScript", "Vue", "Rust"] as const

// 初始化
const availableCategories = ref<string[]>([...DEFAULT_CATEGORIES])

// loadCategories 中复用
availableCategories.value = [...DEFAULT_CATEGORIES, ...categories]
```

### 6. SCSS Codex 规范修复

所有修复在 `src/features/floatingToolbar/styles/pronunciation.scss` 中：

| 行号 | 违规 | 修复 |
| --- | --- | --- |
| 顶部 | 缺少 `$vp-radius` 声明 | 添加 `$vp-radius: 6px;` |
| L51 | `margin-top: 8px` | → `margin-top: g.$spacing-2` |
| L80 | `gap: 4px` | → `gap: g.$spacing-1` |
| L94 | `padding: 4px 8px` | → `padding: g.$spacing-1 g.$spacing-2` |
| L95 | `border-radius: 12px` | → `border-radius: $radius-lg` |
| L102-103 | `#667eea`, `#764ba2`, `#fff` | → `var(--b3-theme-primary)`, `var(--b3-theme-on-primary)` |
| L147 | `margin-bottom: 16px` | → `margin-bottom: g.$spacing-4` |
| L183/232 | `padding: 14px 18px` | → `padding: g.$spacing-3 g.$spacing-4` |
| L226 | `gap: 6px` | → `gap: g.$spacing-2` |
| L231 | `gap: 10px` | → `gap: g.$spacing-3` |


## 使用的 Agent 扩展

### Skill

- **codex-ui-style-guide**
- 用途：审查并修复 `pronunciation.scss` 中违反 Codex UI 规范的 SCSS 代码
- 预期结果：所有硬编码 px/spacing/color/border-radius 替换为设计 Token，补充本地 `$vp-radius` 声明

### SubAgent

- **code-explorer**
- 用途：在修复过程中探索受影响文件的完整调用链，确保提取 FlashcardStorage 后不遗漏任何引用
- 预期结果：确认 `FlashcardStorage` 的所有导入点（7 个文件）均已更新为新路径