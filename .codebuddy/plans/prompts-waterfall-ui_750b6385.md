---
name: prompts-waterfall-ui
overview: 提示词库卡片网格改为 CSS 瀑布流布局，移除所有鼠标悬停背景色变化效果，优化整体排版。
todos:
  - id: clean-mixins
    content: _mixins.scss 删除 card-hover mixin
    status: completed
  - id: waterfall-nohover
    content: PromptsGrid.scss 瀑布流布局 + 移除hover背景色 + 排版优化（columns/break-inside/去card-hover/去hover背景/收紧padding）
    status: completed
    dependencies:
      - clean-mixins
  - id: verify
    content: lint + build 验证
    status: completed
    dependencies:
      - waterfall-nohover
---

## 用户需求

将 PromptsGrid 改为瀑布流布局，移除鼠标聚焦时的背景色效果，优化卡片排版。

## 核心变更

1. **瀑布流布局**：`.vp-grid` 从 `display: grid; grid-template-columns: repeat(3, 1fr)` 改为纯 CSS `columns: 3; column-gap` 方案
2. **移除 hover 背景色**：`.vp-card` 删除 `card-hover` mixin 和 `::before` 左侧强调条；`.vp-content-value:hover` 和 `.vp-chip:hover` 移除 `background` 变化，仅保留 `border-color` 微调
3. **排版优化**：卡片 padding 收紧为 `$spacing-3`，描述区 line-height 从 1.4 调为 1.5
4. **清理**：`_mixins.scss` 删除未使用的 `card-hover` mixin

## 技术方案

### 瀑布流：CSS columns 方案

纯 CSS `columns` 属性实现瀑布流，无需引入 JS 库，浏览器原生支持，性能最优：

```
.vp-grid {
  columns: 3;
  column-gap: $spacing-2;
}

.vp-card {
  break-inside: avoid;       // 防止卡片列内断裂
  margin-bottom: $spacing-2; // column-gap 在 Firefox 中不可靠时的兜底
  overflow: visible;          // 必须去掉 overflow: hidden，否则 break-inside 失效
}
```

**备选方案对比**：

- `CSS Grid` + `masonry`（实验性，Chrome 仅 flag 支持）→ 不可用
- `Masonry.js` / `vue-masonry` → 引入额外依赖，思源插件环境复杂
- `columns` → 零依赖，原生支持，列序从上到下（对提示词库场景可接受）

### 去 hover 背景色

| 选择器 | 当前 | 改为 |
| --- | --- | --- |
| `.vp-card:hover` | `border-color: primary` + `::before opacity: 1`（含 mixin） | 无 hover 效果（仅保留静态 border） |
| `.vp-card::before` | 左侧 4px 强调条，hover 显示 | 删除 |
| `.vp-content-value:hover` | `border-color + background: surface-light` | 仅 `border-color: primary` |
| `.vp-chip:hover` | `background: list-hover + border-color: primary` | 仅 `border-color: primary` |


### 排版微调

- 卡片 padding：`$spacing-2`（8px）→ `$spacing-3`（12px），内容呼吸感更好
- `.vp-card-desc` line-height：`1.4` → `1.5`，与项目全局行高 $line-height-normal 对齐

## 影响文件

| 文件 | 操作 |
| --- | --- |
| `src/features/prompts/styles/_mixins.scss` | 删除 `card-hover` mixin（第37-45行） |
| `src/features/prompts/styles/PromptsGrid.scss` | `.vp-grid` 改 columns；`.vp-card` 去 hover/::before + break-inside + padding；`.vp-chip:hover` 去 background；`.vp-content-value:hover` 去 background；响应式 columns:2 |
| `src/features/prompts/styles/index.scss` | 无需改动（此前已无 `.vp-grid` 响应式规则） |