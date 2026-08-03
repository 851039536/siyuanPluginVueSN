---
name: 修复 aiContentGenerator 思考过程被加载动画遮挡
overview: 推理模型生成时，思考过程（reasoning）被 Loader 动画遮挡不可见。根因：MainContentArea.vue 的 Loader 与 result-container 互斥分支条件未考虑 reasoningContent，纯思考阶段（reasoning 已流式到达但正文为空）Loader 命中而 result-container（含 ReasoningSection）不渲染。次要问题：showReasoning 在 startGeneration 中被重置为 false，即使渲染也是折叠态。修复两处条件 + 默认展开，让思考过程在生成期间可见。
todos:
  - id: fix-loader-condition
    content: 修改 MainContentArea.vue Loader 分支条件，增加 !reasoningContent 判断
    status: completed
  - id: fix-result-container-condition
    content: 修改 MainContentArea.vue 结果容器分支条件，增加 || reasoningContent
    status: completed
    dependencies:
      - fix-loader-condition
  - id: auto-expand-reasoning
    content: 修改 useGeneration.ts startGeneration 中 showReasoning 默认值为 true
    status: completed
---

## 用户需求

用户在使用 AI 内容生成器（aiContentGenerator）时，点击生成后看不到思考过程（reasoning/thinking），怀疑是被加载动画遮挡或存在其他问题，需要定位并修复。

## 问题诊断结论

经代码追踪确认，**确属加载动画遮挡**，非数据流问题。推理模型（DeepSeek reasoner / v4 系列，需开启 enableThinking）流式输出顺序为"先思考、后正文"。在纯思考阶段，`reasoningContent` 已被填充但 `displayedContent`/`generatedContent` 仍为空，导致 `MainContentArea.vue` 的 Loader 分支命中、结果容器（内含 ReasoningSection）不渲染，思考过程被动画完全挡住。

此外存在次因：生成开始时 `showReasoning` 被重置为 `false`（折叠态），即使结果容器渲染，思考正文也被折叠隐藏。

## 核心修复点

- 修复 Loader 动画分支条件，让思考内容到达时让位给结果容器
- 修复结果容器分支条件，使其在仅有思考内容时也渲染
- 生成开始默认展开思考区，使流式思考文字可见

## 技术栈

- Vue 3 + TypeScript + Vite（思源笔记插件）
- 现有 composable 架构（useGeneration 管理流式状态）
- SCSS 分离样式（Codex 设计 Token）

## 实现方案

纯条件渲染 bugfix，不涉及新架构、新依赖、新文件。改动集中在 2 个文件、3 处，均基于已验证的现有代码结构：

### 数据流确认（无需改动，已验证正常）

- `aiApi.ts` extractOpenAIDelta 正确提取 `delta.reasoning_content`，parseSSEStream 正确调用 onReasoningChunk
- `useGeneration.ts` defaultOnReasoningChunk → reasoningBuffer → flushChunkBuffer 累加到 reasoningContent.value
- reasoningContent 数据确实被正确填充，问题仅在 UI 渲染条件

### 改动 1：MainContentArea.vue Loader 分支（第 6 行）

加载动画条件增加 `&& !reasoningContent`，使思考阶段动画让位：

- 旧：`v-if="isGenerating && !displayedContent && !generatedContent"`
- 新：`v-if="isGenerating && !displayedContent && !generatedContent && !reasoningContent"`
- `reasoningContent` 已是该组件 Props（第 288 行 `reasoningContent?: string`），无需新增 prop

### 改动 2：MainContentArea.vue 结果容器分支（第 29 行）

结果容器条件增加 `|| reasoningContent`，使仅有思考内容时也渲染（ReasoningSection 在其内部）：

- 旧：`v-else-if="displayedContent || generatedContent"`
- 新：`v-else-if="displayedContent || generatedContent || reasoningContent"`

### 改动 3：useGeneration.ts startGeneration（第 122 行）

生成开始默认展开思考区：

- 旧：`showReasoning.value = false`
- 新：`showReasoning.value = true`
- 安全性：ReasoningSection 整体有 `v-if="reasoningContent"`，非推理模型无思考内容时该区块根本不渲染，showReasoning=true 无视觉副作用；思考正文区 `.reasoning-content` 已有 `max-height: 200px; overflow-y: auto`，有界可滚动不破坏布局

## 实现注意事项

- **不改动 error 分支**（第 14 行）：思考阶段无 error 不影响；生成失败时优先显示错误，与既有行为一致
- **API 层、数据流逻辑零改动**：已确认数据流正常
- **无新增文件、无新增依赖**：纯条件修复
- **向后兼容**：非推理模型（无 reasoningContent）行为完全不变——Loader 分支与结果容器分支对空 reasoningContent 的判断结果与原来一致
- **性能**：无额外计算开销，仅 Vue 响应式条件求值多一个布尔判断

## 目录结构

```
src/features/aiContentGenerator/
├── components/
│   └── MainContentArea.vue   # [MODIFY] 第6行 Loader 条件加 && !reasoningContent；第29行结果容器条件加 || reasoningContent
└── composables/
    └── useGeneration.ts       # [MODIFY] 第122行 showReasoning.value = false → true
```