---
name: everythingSearch-searchOptions-redesign
overview: 重新排版 SearchOptions 搜索选项面板：整理为清晰的两行布局（上行开关组、下行配置组），对齐间距，确保文件大小过滤值持久化。
todos:
  - id: redesign-template
    content: 重构 SearchOptions.vue 模板：移除 group 嵌套、Switch 加 labelBefore、修复 size-input 值绑定、按三行结构重排
    status: completed
  - id: rewrite-scss
    content: 重写 SearchOptions.scss：删除 __group 样式、新增 __row 换行、重写 __size-input 对齐 Select 组件尺寸
    status: completed
    dependencies:
      - redesign-template
  - id: verify-build
    content: 验证 lint 和 pnpm build 通过
    status: completed
    dependencies:
      - rewrite-scss
---

## 用户需求

1. 文件大小过滤默认值需要能显示和持久化（持久化已通过 `watch([config, options], …, { deep: true })` 实现，但输入框 `:value="options.minSize || ''"` 导致 0 显示为空）
2. 所有按钮和输入控件重新排版，目前太丑

## 核心改动

- Switch 统一加 `labelBefore: true` 使标签前置
- 移除 `vp-options__group` 嵌套，展平为单层 flex-wrap 布局
- 修复 size-input 的值绑定：`|| ''` 改为直接 `:value`
- size-input 尺寸对齐 Select 组件 small 规格（28px 高 / 6px 圆角 / 13px 字号）
- 将高级模式 Switch 与四个匹配开关放在同一行

## 技术方案

### 当前布局问题

```
第一行: [区分大小写] [全词匹配] [匹配路径] [正则]  ← 标签在右侧
第二行(group左边框): [高级模式] [数量▼] [延迟▼] [排序▼ ↑↓] [大小 ≥KB - ≤KB]
```

- group 左边框造成视觉割裂
- Switch 标签在右（`labelBefore: false` 默认），与 Select 的 `__key` 前置不一致
- size-input 高度 24px（Select small 是 28px），圆角 4px（Select small 是 6px）
- 大小过滤行包含 7 个元素，远超其他行宽度

### 目标布局

```
第一行: 区分大小写 [○]  全词匹配 [○]  匹配路径 [○]  正则 [○]  高级模式 [○]
第二行: 数量[▼50]  延迟[▼500ms]  排序[▼修改时间 ↑↓]
第三行: 大小 ≥[0]KB - ≤[0]KB
```

### 实现要点

1. **Switch 标签前置**：所有 `<Switch>` 加上 `labelBefore` 属性，标签出现在开关左侧，与 Select 的 `__key` 标签视觉对齐
2. **展平布局**：删除 `<div class="vp-options__group">` 包裹，所有元素平铺在 `vp-options` 根容器中，通过空 `<div class="vp-options__break">` 或 CSS `flex-basis: 100%` 实现换行
3. **size-input 样式对齐**：高度 24→28px，圆角 `$radius-sm`→`$radius-base`(6px)，字号 `$font-size-xs`(10px)→`$font-size-sm`(13px)，加宽至 48px
4. **值绑定修复**：`:value="options.minSize || ''"` → `:value="options.minSize"`，同样修复 maxSize

### SCSS 改动清单

- 删除 `&__group` 全部样式
- 新增 `&__row` 样式块（`flex-basis: 100%; height: 0`）用作强制换行
- 重写 `&__size-input`：height 28px、border-radius `$radius-base`、font-size `$font-size-sm`、padding 0 6px、width 48px
- `&__item--size` 调整 gap 为 `$spacing-1`

### 不改动

- `index.vue` — 持久化逻辑完整，无需改动
- `types/index.ts` / `types/storage.ts` — 字段定义已完备