# 灵感生成器（Idea Generator）

面向程序开发者的 AI 创意工具，提供两种模式：

1. **快捷生成**：选择预设开发方向分类（可附带关键词），AI 一次批量生成 5 条功能/小工具灵感。
2. **引导发散**：输入一个主题，AI 动态多轮生成「发散方向」选项供选择，逐层深挖，随时「发散灵感」产出具体灵感。

最终灵感均支持展开查看、一键复制、AI 流式细化为完整技术方案（含技术栈与实现要点）。

## 功能

### 快捷生成模式

- **预设分类 + 可选关键词**：桌面工具 / 命令行脚本 / 思源插件 / Web 应用 / 效率工具 / 自动化 六类方向，切换分类或重新生成时自动取消进行中的请求。
- **批量灵感卡片**：单次非流式返回 5 条灵感（标题 + 描述），支持展开/复制。

### 引导发散模式

- **主题输入**：自由文本主题（如"效率工具""笔记助手"），AI 据此生成首轮发散方向。
- **多轮动态引导**：每轮 AI 根据「主题 + 已选方向路径」生成 4~5 个方向选项（目标用户/使用场景/技术形态等角度），选择方向即继续深挖。
- **过程可控**：支持「换一批」（重生成当前轮）、「回退一步」（撤销选择）、「重新开始」。
- **随时发散**：任意轮次点击「发散灵感」，AI 基于完整路径产出 5 条具体灵感。
- **路径可视化**：顶部面包屑展示「主题 → 已选方向」路径。

### 灵感后处理（两模式共用）

- 展开查看完整描述、一键复制灵感文本、AI 流式细化为完整技术方案（需求说明/技术栈建议/实现要点/扩展方向），支持中途停止与复制全文。

## 交互流程

```
快捷生成：选分类 → 生成灵感 → 卡片列表 → 展开/复制/细化
引导发散：输入主题 → 选方向（多轮深挖）→ 发散灵感 → 卡片列表 → 展开/复制/细化
```

## AI 输出契约

- **快捷生成**：`callAI` 非流式，system prompt 引导输出 Markdown 列表（`- **标题**：描述`）。
- **方向生成**：`callAI` 非流式，输出 `- **方向**：说明`，由 `parseDirectionsResponse` 解析为 `GuideDirection[]`。
- **灵感发散**：`callAI` 非流式，把主题 + 全部方向路径传给 AI，产出灵感。
- **方案细化**：`callAIStream` 流式输出，逐 chunk 追加到详情区。
- 方向与灵感共用底层 `parseOptionList` 解析器，格式漂移时按行拆分兜底。

## 目录结构

```
ideaGenerator/
├── index.ts              # 注册入口：自挂载 __ideaGenerator、快捷键(⌃⌥I)、Tab 图标
├── index.vue             # 主面板：模式 Tab（快捷生成/引导发散）+ 快捷生成视图
├── types/index.ts        # IdeaCategory/IdeaItem/GuideDirection 类型 + 常量 + IdeaGeneratorManager
├── utils.ts              # prompt 构建 + parseOptionList/parseIdeasResponse/parseDirectionsResponse + resolveI18nLabel
├── composables/
│   ├── useIdeaGenerator.ts  # 快捷生成状态与副作用
│   ├── useGuideDiverge.ts   # 引导发散状态机（input/guiding/ideas）
│   └── useIdeaDetail.ts     # 展开/复制/流式细化公共逻辑（两模式复用）
├── components/
│   ├── CategorySelector.vue # 预设分类胶囊选择器
│   ├── GuideDiverge.vue     # 引导发散主视图（三态）
│   ├── DirectionCard.vue    # 发散方向选项卡片
│   ├── IdeaCard.vue         # 单条灵感卡片
│   └── IdeaDetail.vue       # 详情区 + 流式技术方案
└── styles/               # Codex SCSS（分类/方向/卡片/详情/引导/主面板）
```

## 设计说明

- **双模式解耦**：快捷生成与引导发散状态互不共享，由 `index.vue` 的 `activeMode` 切换，避免逻辑耦合。
- **复制/细化公共化**：两模式的展开/复制/流式细化统一抽取到 `useIdeaDetail`，`refineIdea` 接收 `contextLabel`（分类标签或发散路径）作为上下文。
- **双 AbortController**：方向生成与灵感发散各自独立取消，切换模式、重新引导均无竞态。
- **不持久化**：分类选择、主题、方向路径与灵感均为会话内状态，不落盘。
- **响应式布局**：`.ig-body` 采用 `flex-wrap`，详情区窄容器下换行而非溢出被裁切。
