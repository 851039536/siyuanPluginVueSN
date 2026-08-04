---
name: gitPush-AI错误分析按钮
overview: 为 gitPush 模块的 OutputPanel（拉取/推送输出日志）新增「AI 分析」按钮：当输出条目存在失败项时显示按钮，点击后弹出弹窗，调用 AI 流式分析 Git 报错日志并展示原因与解决方案。
design:
  architecture:
    framework: vue
  styleKeywords:
    - Codex 风格
    - 等宽字体
    - 边框卡片
    - 流式反馈
    - 克制配色
  fontSystem:
    fontFamily: PingFang SC, $vp-mono
    heading:
      size: 12px
      weight: 600
    subheading:
      size: 12px
      weight: 500
    body:
      size: 12px
      weight: 400
  colorSystem:
    primary:
      - "#B3B1AD"
      - "#8A8F98"
    background:
      - var(--b3-theme-background)
      - var(--b3-theme-surface)
    text:
      - var(--b3-theme-on-background)
      - var(--b3-theme-on-surface)
    functional:
      - var(--b3-theme-error)
      - var(--b3-border-color)
      - var(--b3-theme-success)
todos:
  - id: manager-ai-config
    content: 在 GitPushManager 新增 public getAiConfig() 方法暴露 AI 配置
    status: completed
  - id: ai-dialog
    content: 新建 AiErrorAnalysisDialog.vue 与 AiErrorAnalysisDialog.scss，实现流式 AI 分析弹窗（用 [skill:codex-ui-style-guide] 保证样式合规）
    status: completed
    dependencies:
      - manager-ai-config
  - id: output-panel-button
    content: 改造 OutputPanel.vue：新增 i18n/projectName/action props、失败检测与 AI 分析按钮并接入弹窗
    status: completed
    dependencies:
      - ai-dialog
  - id: i18n-readme
    content: 补充 zh_CN/en_US gitPush.json 的 AI 分析相关 i18n 键并更新 gitPush README 组件树
    status: completed
    dependencies:
      - output-panel-button
---

## 产品概述

在 gitPush 功能中，当 Git 推送/拉取操作失败时，日志面板（OutputPanel）显示错误输出，并在面板底部新增「AI 分析」按钮。点击按钮后弹出独立弹窗，调用 AI 以流式输出方式分析失败日志，给出错误原因、解决方案与预防建议。

## 核心功能

- 推送/拉取日志中存在失败条目（非 skipped 且失败）时，OutputPanel 底部显示「AI 分析」按钮；无失败时隐藏
- 点击按钮弹出 AI 错误分析弹窗，流式（打字机效果）展示 AI 分析结果
- 分析内容基于失败平台、错误摘要与完整 stderr 输出组装 prompt，AI 以 Git 专家身份输出「错误原因 + 解决方案 + 预防建议」
- 弹窗支持复制分析结果、失败重试、关闭；分析中显示加载状态
- 未配置 AI 密钥或调用失败时给出明确错误提示

## 技术选型

沿用项目现有技术栈：Vue 3 + TypeScript + SCSS（Codex 设计风格），AI 调用统一走 `@/utils/aiApi` 的 `callAISmart`（传 `onChunk` 自动流式）+ `getApiConfigFromPlugin(plugin)`，弹窗采用本地条件渲染 overlay 模式（参考 `WorkingTreeDiffDialog.vue`）。

## 实现方案

### 关键决策

1. **AI 配置获取**：`GitPushManager` 持有私有 `plugin` 且无 getter，新增 public `getAiConfig()` 返回 `getApiConfigFromPlugin(this.plugin)`。卡片系组件经 `inject(CARD_SERVICES_KEY)` 已持有 manager 实例，无需改动 `CardServices` 接口与 provide 链路，符合"统一入口"原则。
2. **弹窗自包含**：`AiErrorAnalysisDialog` 作为子组件内部完成 prompt 组装、AI 流式调用与状态管理，父组件（OutputPanel）只管开关，符合项目"子组件数据流规则"。
3. **流式渲染**：`callAISmart(prompt, config, { onChunk, temperature: 0.3, maxTokens: 1024, enableThinking: false })`，`onChunk` 累积文本实时渲染；AI 输出为 Markdown，复用 `@/utils/mdRenderer` 的 `parseMarkdown` 渲染（与 MarkdownPreviewDialog 同管线），保证排版可读性。
4. **Prompt 防膨胀**：失败文本取 `summary` + `fullStderr` 全文并截断至 4000 字符，避免超长导致 token 溢出；systemPrompt 限定 Git 专家角色与输出结构（错误原因/解决方案/预防建议），temperature 调低保证稳定。

### 性能与可靠性

- 流式输出避免长时间空白等待，交互反馈即时
- 弹窗 `v-if` 条件渲染，关闭即销毁实例，无常驻监听器与定时器
- 失败条目标记 `!ok && !skipped`，按钮仅在存在失败时出现，无额外渲染开销
- AI 调用异常捕获后 UI 显示错误并支持重新分析，`console.error` 记录（不输出敏感信息）

## 实施要点

- 新增文件顶部必须带 10~30 字文件头注释（.ts/.vue）
- 样式必须独立 SCSS 文件，禁止 .vue 内联 `<style>` 写样式；使用 `@/index.scss` 全局 Token（`$font-size-*`/`$font-weight-*`/`$line-height-*`/`$radius-*`/`$spacing-*`），禁止 box-shadow 与硬编码字体三要素；弹窗 overlay 需显式 `font-size: $font-size-xs` 基准
- 模板 i18n 位置上方加中文 HTML 注释；禁止硬编码中文兜底
- 弹窗图标选用已注册可用的 Iconify 图标（如 `mdi:creation`/`mdi:auto-fix`，若离线图标集缺失则回退 `mdi:history` 类已知图标）

## 架构设计

```
ProjectCard.vue（提供 i18n/projectName/entries）
  └─ OutputPanel.vue（props: entries/i18n/projectName/action；inject CARD_SERVICES_KEY 取 manager）
       ├─ computed failedEntries（!ok && !skipped）
       ├─ 失败时底部渲染「AI 分析」按钮
       └─ v-if 渲染 AiErrorAnalysisDialog
            ├─ props: i18n/projectName/action/failedEntries
            ├─ inject manager → manager.getAiConfig()
            └─ callAISmart 流式 → parseMarkdown 渲染结果 → 复制/重试/关闭
```

## 目录结构

```
src/features/gitPush/
├── GitPushManager.ts                                # [MODIFY] 新增 public getAiConfig(): AiApiConfig（getApiConfigFromPlugin(this.plugin)）
├── components/list/
│   ├── OutputPanel.vue                              # [MODIFY] 新增 i18n/projectName/action props；失败检测；底部 AI 分析按钮；接入弹窗
│   └── AiErrorAnalysisDialog.vue                    # [NEW] AI 错误分析弹窗：prompt 组装 + callAISmart 流式 + parseMarkdown 渲染 + 复制/重试/关闭
├── styles/
│   └── AiErrorAnalysisDialog.scss                   # [NEW] 弹窗样式（overlay 参考 WorkingTreeDiffDialog.scss，Codex Token）
└── README.md                                        # [MODIFY] 组件树补充 AiErrorAnalysisDialog 说明
src/i18n/zh_CN/gitPush.json                          # [MODIFY] 新增 aiAnalyze/aiAnalyzeTitle/aiAnalyzing/aiAnalyzeFailed/aiAnalyzeRetry/aiAnalyzeCopy/aiAnalyzeCopied 等键
src/i18n/en_US/gitPush.json                          # [MODIFY] 同步新增对应英文键
```

## 设计风格

遵循项目 Codex 设计语言，与现有 WorkingTreeDiffDialog 弹窗体系保持一致。

- **弹窗容器**：fixed 全屏遮罩（rgba 半透明 + 轻微 blur），居中卡片式弹窗，思源主题色背景（var(--b3-theme-background)）+ 细边框（var(--b3-border-color)）+ 圆角，标题栏为 surface 底 + 底部边框分隔，无投影（边框替代阴影）
- **头部**：左侧「AI 错误分析」标题（等宽字体、semibold）+ 操作徽标；右侧操作按钮（重新分析/复制/关闭）
- **内容区**：flex 撑满剩余高度内部滚动；AI 分析结果以 Markdown 渲染（标题/列表/代码块层次清晰），错误日志原始输出以等宽字体 + 弱化色展示在折叠摘要区
- **交互**：分析中按钮呈 loading 旋转态 + 「AI 分析中...」提示；流式文本实时增长；复制成功 2 秒反馈；调用失败显示错误态与「重新分析」按钮
- **按钮**：面板底部为 ghost 风格小按钮 + 图标（mdi:creation），hover 边框高亮，与卡片内现有 vp-btn 体系一致

## Agent Extensions

### Skill

- **codex-ui-style-guide**
- 用途：编写 `AiErrorAnalysisDialog.scss` 与 OutputPanel 按钮样式时强制执行项目 Codex 风格规范（设计 Token、禁止 box-shadow、禁止硬编码字体三要素、SCSS 分离规则），保证新 UI 与现有体系一致
- 预期结果：新增样式通过 Codex 规范审查，无违规硬编码，与 WorkingTreeDiffDialog.scss 风格统一