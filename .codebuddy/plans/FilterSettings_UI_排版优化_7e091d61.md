---
name: FilterSettings UI 排版优化
overview: 审查并优化 docAnalysis/FilterSettings 过滤设置组件的排版，聚焦「间距与对齐」与「整体视觉一致性」两方面，统一控件高度、规范间距 Token、均衡第二行布局、对齐相邻区块留白。
todos:
  - id: align-row1
    content: 使用 [skill:codex-ui-style-guide] 统一第一行控件高度与行内间距
    status: completed
  - id: balance-row2
    content: 均衡第二行弹性布局、统一组内间距并对齐容器水平留白
    status: completed
    dependencies:
      - align-row1
---

## 产品概述

针对思源笔记插件「文档分析」模块中的过滤设置组件（FilterSettings）进行 UI 排版优化，聚焦解决控件对齐、间距一致性与整体视觉协调问题。组件对外接口（props/emits）与功能逻辑保持不变，模板 class 结构不改动。

## 核心功能

- 统一第一行控件（标题搜索、全文搜索、清空按钮、查询按钮）的垂直高度，消除不等高错位
- 统一容器/行/组内三级间距为一致的 4px 节奏，并改用设计 Token（$spacing-1）
- 均衡第二行布局：笔记本下拉与书签输入共同弹性分配剩余空间，避免下拉过宽或过窄
- 调整过滤区左右留白与上方 Tab 栏对齐（8px），形成竖向视觉边线一致
- 为字数区间分隔符「~」增加呼吸间距

## 技术栈

- Vue 3 + TypeScript（组件模板不动）
- SCSS（仅修改 `src/features/docAnalysis/styles/FilterSettings.scss`）
- 复用项目设计 Token：`$spacing-1`(4px)、`$spacing-2`(8px)、`$vp-radius`(6px)

## 实现方案

仅修改 `FilterSettings.scss` 一个文件，`FilterSettings.vue` 模板与脚本零改动。通过「统一控件高度、统一间距体系、均衡弹性空间、对齐水平留白」四类调整完成排版优化。

### 关键修改点

1. **统一第一行控件高度**：给 `.filter-input, .filter-select` 增加 `height: 24px; box-sizing: border-box;` 并将垂直 padding 归零（`padding: 0 6px`）；给 `.query-btn` 增加 `height: 24px; box-sizing: border-box;` 并将垂直 padding 归零（`padding: 0 12px`）；`.clear-btn` 补 `box-sizing: border-box`。使四个同排控件统一为 24px 等高，与已有的 `.clear-btn { height: 24px }` 齐平。项目无全局 `box-sizing`，需逐元素显式声明以保证 `height` 含边框。
2. **统一间距节奏**：容器 `.doc-analysis-filter` 的 `gap`、`.filter-row` 的 `gap`、`.filter-group` 的 `gap` 统一为 `$spacing-1`(4px)；删除 `.filter-row-secondary` 的独立 `gap: 4px`（继承 `.filter-row` 统一值），消除 6px/4px/2px 三级混用。
3. **均衡第二行布局**：`.bookmark-input` 由 `width: 54px` 改为 `flex: 1`，与 `.notebook-select` 均分剩余空间；两者已有的 `min-width: 0` 保证窄面板下正常收缩。
4. **对齐水平留白**：`.doc-analysis-filter` 左右 padding 由 `10px` 改为 `$spacing-2`(8px)，与上方 `.tab-bar` 的左右 8px 对齐；上下 `6px` 保持不变（视觉舒适值，无对应 Token，加注释说明）。
5. **分隔符呼吸**：`.filter-group` 的 `gap` 从 `2px` 增至 `$spacing-1`(4px)，让「~」两侧与数字输入框留出呼吸空间。

### 实现注意事项

- 不改字号层级（`$font-size-xs` 保持 12px）；不改 transition / box-shadow / 颜色 fallback 等纯规范项（本次未勾选该侧重）
- 不改 `index.scss` 中相邻区块（`.tab-bar` / `.platform-filter-bar`）样式，仅通过调整 FilterSettings 自身 padding 完成对齐
- `input`/`select` 单行文字在 `height` 内默认垂直居中，`query-btn` 由 `align-items: center` 保证内容居中
- 完成后不执行 `pnpm lint` / `tsc`，由用户自行验证

## Agent Extensions

### Skill

- **codex-ui-style-guide**
- 目的：作为 `$spacing-1` / `$spacing-2` / `$vp-radius` 等设计 Token 的准确参考，确保间距优化严格遵循项目 Codex 规范，不引入未定义变量
- 预期结果：所有新增/调整的间距使用正确的数字后缀 Token（`$spacing-1`=4px、`$spacing-2`=8px），圆角保持 `$vp-radius`，无 `$spacing-xs/sm` 等未定义变量导致的构建错误