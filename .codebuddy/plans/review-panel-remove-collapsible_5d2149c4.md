---
name: review-panel-remove-collapsible
overview: 去掉 ReviewPanel 的 CollapsibleSection 折叠包装，改为固定头栏直接展示内容，与预览/Diff Tab 体验一致。
todos:
  - id: update-template
    content: 修改 ReviewPanel.vue 模板：CollapsibleSection 替换为 div.review-panel-wrapper + div.review-header + div.review-body 直接渲染
    status: completed
  - id: update-script
    content: 修改 ReviewPanel.vue script：删除 showReviewPanel ref 和 CollapsibleSection import
    status: completed
  - id: update-styles
    content: 修改 ReviewPanel.scss：新增 .review-panel-wrapper/.review-header/.review-header-left/.review-header-right/.review-header-title 样式；.review-loading-dot 改为独立定义
    status: completed
  - id: verify-lint
    content: 检查 lint 无新增错误，用户自行 pnpm lint + npx tsc --noEmit 终验
    status: completed
    dependencies:
      - update-template
      - update-script
      - update-styles
---

## 用户需求

审查 Tab 已是独立页面，不再需要 CollapsibleSection 提供的展开/折叠交互。需要移除折叠包装，改为与预览、Diff Tab 一致的"固定头栏 + 直接显示内容"风格。

## 核心改动

1. 移除 CollapsibleSection 组件包装，用普通 div 替代
2. 固定头栏保留图标 + 标题 + 右侧状态指示器（loading dot / rating badge）
3. 内容区直接渲染，不再受 open/close 状态控制
4. 清理不再使用的 showReviewPanel ref 和 CollapsibleSection import
5. .review-loading-dot 从 mixin 依赖改为独立样式定义

## 改动文件

- `src/features/aiContentGenerator/components/ReviewPanel.vue` — 模板与 script 修改
- `src/features/aiContentGenerator/styles/ReviewPanel.scss` — 样式新增与修改

## 实现细节

### 模板层

```
before: <CollapsibleSection title=... icon=... :open=... accent=... headerRight slot=...>
after:  <div.review-panel-wrapper>
          <div.review-header>
            <div.review-header-left> (svg#iconCheck + span.title)
            <div.review-header-right> (loading-dot / rating-badge)
          <div.review-body> (原 slot 内容直接渲染)
```

### Script 层

- 删除 `const showReviewPanel = ref(true)`（不再需要折叠状态）
- 删除 `import CollapsibleSection from "./CollapsibleSection.vue"`

### 样式层

- 新增 `.review-panel-wrapper`：容器，border + border-radius（沿用 collapsible-section 的边框风格）
- 新增 `.review-header`：flex row，padding，下边框分隔，`header-success` 类沿用 success accent 绿色左侧边线
- 新增 `.review-header-left`：flex center，gap，图标+标题
- 新增 `.review-header-right`：margin-left auto，容纳状态指示器
- 新增 `.review-header-title`：文案字号
- `.review-loading-dot`：从 `@include collapsible-status-dot(var(--b3-theme-success))` 改为独立定义（width/height/border-radius/background + blinking 动画），无需依赖 index.scss mixin

## 不改动

- CollapsibleSection.vue 保留（其他模块仍使用）
- CollapsibleSection.scss 保留
- MainContentArea.vue 中 ReviewPanel 的调用不变
- 分项评分的内部折叠（showScores）保留不变