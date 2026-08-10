---
name: migrate-review-to-tab-and-add-direct-button
overview: 将审核面板从内联展示迁移到独立 Tab（在"对比"旁边新增"审查"Tab），审查冗余代码，新增"直接审查"按钮支持按需触发审核。
todos:
  - id: add-i18n-keys
    content: 新增 i18n 键：审查 Tab 标题、直接审查按钮标签及 tooltip（zh_CN + en_US 各 3 键）
    status: completed
  - id: modify-use-review-force
    content: 修改 useReview.ts：performReview 增加 force 参数，绕过 enableReview 检查
    status: completed
  - id: add-direct-review-handler
    content: 修改 index.vue：新增 handleDirectReview，向 MainContentArea 传递 directReview emit
    status: completed
    dependencies:
      - modify-use-review-force
  - id: refactor-main-content-area
    content: 重构 MainContentArea.vue：Tab 扩展为三 Tab、面板迁移到 result-content、新增直接审查按钮、删除冗余的旧幽灵按钮和内联 ReviewPanel 渲染位、新增 watch(reviewResult) 自动切 Tab
    status: completed
    dependencies:
      - add-direct-review-handler
      - add-i18n-keys
  - id: verify-styles-and-lint
    content: 使用 [skill:codex-ui-style-guide] 审查 SCSS 合规性，用户自行运行 pnpm lint + npx tsc --noEmit 终验
    status: completed
    dependencies:
      - refactor-main-content-area
---

## 用户需求

将 ReviewPanel（审核面板）从当前内联位置迁移到独立的"审查"Tab 页面，在"预览"和"对比" Tab 旁新增第三个 Tab；审计并清理迁移后产生的冗余代码；新增醒目的"直接审查"按钮，允许用户随时触发审核（不依赖 `enableReview` 开关）。

## 核心功能

- **Tab 扩展**：将 `viewMode` 从 `"preview" | "diff"` 扩展为 `"preview" | "diff" | "review"`，新增"审查" Tab 按钮
- **面板迁移**：将 ReviewPanel 从 toolbar 与内容区之间的内联位置移入 `result-content` 区域，当 Tab 选中"审查"时渲染
- **冗余清理**：删除旧的幽灵重新审核按钮（被新的直接审查按钮取代），删除旧的内联 ReviewPanel 渲染位
- **直接审查按钮**：工具栏新增醒目按钮（`variant="primary"`），任何有生成内容时均可点击，绕过 `enableReview` 开关直接发起审核
- **自动切 Tab**：审核完成后自动切换到"审查" Tab 展示结果

## 技术方案

### 实现策略

扩展现有 Tab 系统（`viewMode` ref），将 ReviewPanel 从模板中间位置迁移到 `result-content` 内作为第三个条件分支；在 `useReview.ts` 的 `performReview` 中新增 `force` 参数绕过 `enableReview` 检查。

### 数据流

```
工具栏"直接审查"按钮 click
  → MainContentArea emit("directReview")
    → index.vue handleDirectReview()
      → useReview.performReview(undefined, { force: true })
        → 跳过 enableReview 检查，直接执行审核
        → reviewResult 更新
          → MainContentArea watch(reviewResult) 自动切换到 viewMode='review'
            → ReviewPanel 在审查 Tab 中渲染
```

### 改动清单

| 文件 | 操作 | 说明 |
| --- | --- | --- |
| `MainContentArea.vue` | MODIFY | Tab 扩展、面板迁移、新增按钮、删除冗余 |
| `MainContentArea.scss` | MODIFY | 微调控件间距（如有需要） |
| `useReview.ts` | MODIFY | `performReview` 增加 `force` 参数 |
| `index.vue` | MODIFY | 新增 `handleDirectReview`，传递给 MainContentArea |
| `zh_CN/aiContentGenerator.json` | MODIFY | 新增 3 个 i18n 键 |
| `en_US/aiContentGenerator.json` | MODIFY | 新增 3 个 i18n 键 |


### 冗余清理清单

1. **旧幽灵重新审核按钮**（MainContentArea.vue 第 165-177 行）：`v-if="!isGenerating && generatedContent && !isReviewing && !reviewResult"` 的 ghost 按钮 — 功能被新的"直接审查"按钮完全覆盖，且新按钮不受 `reviewResult` 条件限制
2. **旧内联 ReviewPanel 渲染**（MainContentArea.vue 第 220-230 行）：位于 `result-header` 和 `result-content` 之间的 `<ReviewPanel v-if="isReviewing || reviewResult" .../>` — 移入 Tab 区域后变为 `v-if="viewMode === 'review'"` 驱动
3. **`reReview` emit**：保留，供 ReviewPanel 内部"重新审核"按钮使用；旧工具栏按钮移除后 `reReview` emit 仍用于面板内按钮

### Implementation Notes

- **防抖/重入**：`performReview` 内部已有 `isReviewing.value` 状态防护；直接审查按钮的 `v-if` 条件排除 `isGenerating` 和 `isReviewing`，无需额外防抖
- **Tab 切换与生成联动**：生成开始时 `viewMode` 重置为 `"preview"` 的现有逻辑保留，审核完成后通过 `watch(reviewResult)` 自动切到 `"review"`
- **无需新增依赖**：所有改动在现有模块内部完成，样式 Token 复用 `$font-size-2xs`、`$spacing-*`、`$vp-mono` 等

## Agent Extensions

### Skill

- **codex-ui-style-guide**
- Purpose: 确保新增/修改的 SCSS 和模板符合 Codex 设计规范（字号 Token、间距 Token、颜色 Token、禁止 box-shadow 等）
- Expected outcome: 所有样式改动通过 Codex 合规审查，无硬编码值

### SubAgent

- **code-explorer**
- Purpose: 在计划阶段已完成探索，执行阶段无需重复调用
- Expected outcome: N/A（已在前置探索中使用）