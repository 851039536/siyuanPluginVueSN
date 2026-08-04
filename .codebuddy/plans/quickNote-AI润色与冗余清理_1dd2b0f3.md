---
name: quickNote-AI润色与冗余清理
overview: 为速记（quickNote）模块新增"AI 润色"能力：在新增速记区与条目编辑态各加一个润色按钮，润色结果流式回填输入框由用户确认；同时审查并清理模块内发现的冗余代码。
todos:
  - id: create-ai-polish
    content: 新建 composables/useAiPolish.ts（并发锁 + API Key 校验 + callAISmart 流式 + 错误码）
    status: completed
  - id: add-polish-addarea
    content: index.vue 新增区加润色按钮并流式回填 draft，抽取 syncPosition 统一 i18n 引用
    status: completed
    dependencies:
      - create-ai-polish
  - id: add-polish-edit
    content: NoteItem.vue 增加 plugin prop，编辑态加润色按钮流式回填 editDraft
    status: completed
    dependencies:
      - create-ai-polish
  - id: polish-i18n
    content: zh_CN/en_US quickNote.json 新增 polish/polishing/polishFailed/polishNoApiKey 四键
    status: completed
  - id: style-dedup
    content: index.scss 提取共享图标按钮类，NoteItem.scss 删重复仅留变体，新增操作行样式
    status: completed
    dependencies:
      - add-polish-addarea
      - add-polish-edit
  - id: docs-readme
    content: 更新 quickNote README.md 补充 AI 润色功能与 composables 职责说明
    status: completed
    dependencies:
      - polish-i18n
      - style-dedup
---

## 产品概述

为速记（quickNote）模块增加「AI 润色」能力，并审查清理模块内的冗余代码。

## 核心功能

- 新增速记区：草稿 textarea 旁新增「AI 润色」按钮，点击后对草稿内容调用 AI 润色，流式回填到输入框（不直接保存），由用户确认后再点击「添加」
- 条目编辑态：编辑框的操作栏新增「AI 润色」按钮，点击后对正在编辑的内容润色并流式回填 editDraft，用户确认后保存（Ctrl+Enter）
- 交互状态：润色过程中按钮禁用并显示加载态，防止并发触发；未配置 AI API 密钥或调用失败时通过思源通知（pushMsg）提示对应文案，失败时恢复润色前的原文
- 视觉：按钮沿用现有 Codex 风格（边框卡片、Token 化尺寸、禁用 box-shadow），使用已注册的 sparkles 图标

## 冗余审查（随本次一并清理）

- 清理：index.vue 中 `props.manager.getPosition()` 三处重复调用（onMounted / handleToggleMenu / handleToggleMinimize）→ 抽取 syncPosition() 小函数；`props.i18n.deleteConfirm` 与解构 i18n 混用 → 统一用解构 i18n；index.scss 的 `.close-btn` 与 NoteItem.scss 的 `.note-item__action-btn` 为几乎相同的 20x20 图标按钮样式 → 提取为共享类
- 保留（Rule of Three / 完整性要求）：`POSITION_MINIMIZE_META` 中 center/custom/top 三项重复（Record 完整性所需，已有注释）；`.mini-bar__count` 与 `.filter-tab__count` 徽标样式；useQuickNotes 中 update/toggleDone 的 updatedAt 赋值

## 技术栈

- 沿用现有 Vue 3 + TypeScript + SCSS 技术栈，不引入新依赖
- AI 调用统一走 `@/utils/aiApi` 的 `callAISmart`（传 onChunk 自动流式）+ `getApiConfigFromPlugin(plugin)` 读取超级面板配置，禁止直接 fetch LLM API 或硬编码 Key
- 错误提示统一走 `@/api` 的 `pushMsg(msg, timeout, type)`（符合统一入口原则）
- 图标使用 `src/config/icons.ts` 已注册的 `sparkles`（mdi:auto-fix）

## 实现方案

### 新增 useAiPolish composable（两个视图复用）

新建 `src/features/quickNote/composables/useAiPolish.ts`：

- 输入 `plugin`，返回 `{ polishing, polish }`：`polishing` 为响应式并发锁（润色中按钮禁用）；`polish(text, onChunk?)` 先经 `getApiConfigFromPlugin` 取配置，`apiKey` 为空时抛 `NO_API_KEY` 错误码，否则调 `callAISmart` 流式调用（systemPrompt 指定润色角色、temperature 0.5、maxTokens 1000、enableThinking false），onChunk 逐字输出
- 错误分类：`NO_API_KEY`（提示"请先在超级面板配置 AI API 密钥"）与 `CALL_FAILED`（提示"润色失败，请重试"），由调用方 catch 后据错误码显示不同 i18n 文案

### 两个视图接入（同一回填模式）

index.vue（新增区）与 NoteItem.vue（编辑态）均实现：点击润色 → 缓存原稿 → 清空输入框 → onChunk 流式回填 → 成功后保留润色结果（用户确认后添加/保存）；失败时恢复原稿 + pushMsg 提示。润色期间输入框内容持续更新，按钮显示 loading 且 disabled。

### 冗余清理

1. index.vue：抽 `syncPosition()`（同步 Manager 定位到本地 position ref），onMounted/handleToggleMenu/handleToggleMinimize 三处复用；`props.i18n.deleteConfirm` 改为解构的 `i18n.deleteConfirm`
2. 样式去重：在 index.scss 定义共享图标按钮类（提取自 `.close-btn` 的 20x20 基础样式），index.vue 头部按钮与 NoteItem.vue 编辑操作按钮均改用该类；NoteItem.scss 仅保留 `--danger` 与 `:disabled` 变体

### 性能与可靠性

- 短文本润色采用流式逐字回填，无额外请求；`polishing` 并发锁避免重复触发导致的多请求
- 失败恢复原稿保证用户输入不丢失；pushMsg 提示及时且非阻断
- 不涉及新依赖、不影响既有位置/拖拽/最小化逻辑（仅模板加按钮 + 新增局部方法）

## 目录结构

```
src/features/quickNote/
├── composables/
│   └── useAiPolish.ts     # [NEW] AI 润色 composable：并发锁 + API Key 校验 + 流式调用 + 错误码
├── index.vue              # [MODIFY] 新增区润色按钮（流式回填 draft）+ syncPosition/i18n 冗余清理
├── components/
│   └── NoteItem.vue       # [MODIFY] props 增加 plugin；编辑态润色按钮（流式回填 editDraft）
├── styles/
│   ├── index.scss         # [MODIFY] 共享图标按钮类提取 + .add-area__actions 操作行样式
│   └── NoteItem.scss      # [MODIFY] 删除重复按钮基础样式，保留 --danger/:disabled 变体
└── README.md              # [MODIFY] 补充 AI 润色功能说明与 composables 目录职责
src/i18n/
├── zh_CN/quickNote.json   # [MODIFY] 新增 polish/polishing/polishFailed/polishNoApiKey 四键
└── en_US/quickNote.json   # [MODIFY] 同上英文键（与 zh_CN 对齐）
```

## 关键代码结构

```ts
// useAiPolish.ts 核心契约（composable 返回结构）
export type PolishErrorCode = "NO_API_KEY" | "CALL_FAILED"

export interface AiPolishApi {
  /** 润色进行中（并发锁，供按钮 loading/disabled） */
  polishing: Ref<boolean>
  /** 润色文本；未配置 API Key 抛 NO_API_KEY；onChunk 提供流式增量 */
  polish: (text: string, onChunk?: (chunk: string) => void) => Promise<string>
}
```

## 实施注意事项

- 润色 prompt：要求"优化措辞、修正语病、保持原意与换行/列表结构不变，只输出润色后文本，无解释/前后缀"
- NoteItem.vue 增加 `plugin: Plugin` prop（父层 index.vue 已持有 plugin，直接透传），符合"子组件自包含数据流"规则
- 模板 i18n 键上方必须加中文 HTML 注释；字体三要素用设计 Token；SCSS 双行导入（组件专属 + index.scss）
- 禁止执行 pnpm lint / pnpm vite build / npx tsc；完成后由用户运行 `pnpm i18n:verify` 验证键对齐

## Agent Extensions

### Skill

- **codex-ui-style-guide**
- 用途：编写/修改 quickNote 的 SCSS（共享图标按钮类、操作行、loading 态样式）时强制遵循 Codex UI 规范（禁用 box-shadow、全 Token 化尺寸与字体三要素、BEM 命名）
- 预期结果：新增与合并的样式全部通过 Codex 规范审查，无硬编码 px/字体值，与现有 .vp-* 组件模式库保持一致