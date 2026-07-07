---
name: compact-translation-result
overview: 重构 CodeTranslationPanel 的结果显示区域，将当前 4 个独立卡片块（原文/译文/缩写/风格）+ 备选方案卡片改为紧凑的流式布局，大幅减少垂直空间占用。
todos:
  - id: refactor-template
    content: 重构 CodeTranslationPanel.vue 模板：将 4 个 result-item 卡片合并为 2 行紧凑布局（原文+风格同行，译文+缩写同行），suggestions 改为横向标签云
    status: completed
  - id: compact-scss
    content: 在 codeUtils.scss 编程翻译特有样式区追加紧凑覆写：result-item 去除卡片样式，suggestion-item 改为小标签
    status: completed
    dependencies:
      - refactor-template
---

## 用户需求

翻译结果区域显示太占地方，需要彻底重构为紧凑布局。

## 核心改动

1. **去除卡片样式**：result-item 移除背景色、圆角、内边距，改为紧凑的行内布局
2. **结果重新组织**：原文和风格合并为一行（次要信息），译文和缩写合并为一行（突出显示）
3. **备选方案改为标签云**：suggestions 从竖向卡片列表改为横向 flex-wrap 标签云，无卡片样式
4. **仅影响翻译面板**：通过 `.code-translation-panel` 前缀覆写，不影响其他三个面板（代码注释/代码解释/正则生成器）

## 技术方案

### 实现策略

在 `codeUtils.scss` 中已有的 `.result-section` 共享样式（被 4 个面板共用）基础上，新增 `.code-translation-panel` 前缀的选择器组覆写 `.result-item` 和 `.suggestions` 的样式。模板侧将 4 个卡片块合并为 2 行 + 标签云。

### 模板重构（CodeTranslationPanel.vue L92-146）

**改前**：4 个 `.result-item` 卡片竖向堆叠于 `.main-result`，suggestions 为竖向卡片列表

**改后**：

- 第一行 `.result-row`：原文 + 风格（flex row，key:value 行内显示）
- 第二行 `.result-row.highlight`：译文 + 缩写（突出显示，大号等宽字体）
- 备选方案 `.suggestions`：取消 `.suggestions-list` 嵌套，`.suggestion-item` 直接作为 `flex-wrap` 标签，保留点击复制功能

### SCSS 覆写（codeUtils.scss）

在 `// ===== 编程翻译特有样式 =====` 块内（L182 之后）追加：

```
// 紧凑结果行（替代卡片式 result-item）
.code-translation-panel .result-item {
  padding: 0;
  background: none;
  border-radius: 0;
  gap: $spacing-1;

  .result-key {
    min-width: auto;
  }
}

// 备选方案标签云
.code-translation-panel .suggestions {
  .suggestions-list {
    flex-direction: row;
    flex-wrap: wrap;
  }

  .suggestion-item {
    padding: 1px $spacing-2;
    border: 1px solid var(--b3-border-color);
    border-radius: $radius-sm;
    font-size: $font-size-xs;
    background: none;

    &:hover {
      background: var(--b3-theme-primary-light);
    }
  }
}
```

### 影响范围

- 仅修改 2 个文件：`CodeTranslationPanel.vue` + `codeUtils.scss`
- 其他 3 个面板（CodeComment、CodeExplainer、RegexGenerator）的共享样式不受影响