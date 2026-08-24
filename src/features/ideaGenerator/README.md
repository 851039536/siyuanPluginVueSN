# 灵感生成器（Idea Generator）

面向程序开发者的 AI 创意工具：选择预设开发方向分类（可附带关键词），AI 一次批量生成 5 条功能/小工具灵感；可展开查看、一键复制，或对感兴趣的灵感让 AI 流式细化为完整技术方案（含技术栈与实现要点）。

## 功能

- **预设分类 + 可选关键词定向生成**：桌面工具 / 命令行脚本 / 思源插件 / Web 应用 / 效率工具 / 自动化 六类预设方向，支持单选分类并附带关键词；切换分类或重新生成时自动取消进行中的请求。
- **批量灵感卡片**：AI 单次非流式返回 5 条灵感（标题 + 一句话描述），卡片支持展开/收起完整描述、一键复制灵感文本。
- **AI 流式细化技术方案**：选中灵感后点击「AI 细化」，流式输出需求说明 / 技术栈建议 / 实现要点 / 扩展方向的完整 Markdown 方案，支持中途停止与复制全文。
- **独立浮动窗口承载（纯官方 API）**：`plugin.addTab` 注册自定义 Tab 模型 + `openTab({custom})` 在主窗口创建页签；快捷键 `⌃⌥I` 打开，超级面板「打开」动作经 `openIdeaGenerator` 事件联动，可配合 `openWindow({tab})` 移入浮动窗口。

## AI 输出契约

- **批量生成**：`callAI` 非流式，system prompt 引导输出 Markdown 列表（`- **标题**：描述`）；`utils.ts` 的 `parseIdeasResponse` 解析为 `IdeaItem[]`，格式漂移时按行拆分兜底，保证界面不空白。
- **方案细化**：`callAIStream` 流式输出，逐 chunk 追加到详情区。

## 目录结构

```
ideaGenerator/
├── index.ts              # 注册入口：自挂载 __ideaGenerator、快捷键(⌃⌥I)、Tab 图标
├── index.vue             # 主面板：操作区 + 状态条 + 卡片列表 + 详情区
├── types/index.ts        # IdeaCategory/IdeaItem 类型 + IDEA_CATEGORIES 常量 + IdeaGeneratorManager
├── utils.ts              # parseIdeasResponse / prompt 构建 / resolveI18nLabel（纯函数）
├── composables/
│   └── useIdeaGenerator.ts  # 生成/细化/复制/展开状态与副作用（AbortController 取消）
├── components/
│   ├── CategorySelector.vue # 预设分类胶囊选择器
│   ├── IdeaCard.vue         # 单条灵感卡片
│   └── IdeaDetail.vue       # 详情区 + 流式技术方案
└── styles/               # Codex SCSS（分类/卡片/详情/主面板）
```

## 设计说明

- **不持久化**：分类选择、关键词与生成结果均为会话内状态，灵感不落盘，故不引入 `types/storage.ts`。
- **双 AbortController**：生成与细化各自独立取消，切换分类、重新生成、停止细化均不会产生竞态。
- **分类共享常量**：`IDEA_CATEGORIES` 位于 `types/index.ts`，供分类选择器 UI 与 prompt 构建复用；分类标签经 `resolveI18nLabel` 从 i18n 解析。
