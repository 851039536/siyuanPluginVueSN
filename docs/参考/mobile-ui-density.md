# 移动端密度与触摸目标参考（GitHub / Primer）

> 2026-11-06 起作为 [`AGENTS_STYLE.md`](../../AGENTS_STYLE.md) § 移动端密度与触摸目标的依据文档。
> 结论用于 Dock 面板类功能的窄屏适配，当前参考实现为 `src/features/rssReader/`。

## 1. 结论：GitHub 是「视觉紧凑 + 命中区单独放大」，不是「整体放大」

GitHub / Primer 在移动端的做法分两层：

1. **视觉层保持紧凑**：正文 14px、caption 12px、图标 16px、按钮默认 32px 高（Primer `medium`）。移动端排版阶梯只缩小展示型大标题（f0 40→32），正文与 caption 不变。
2. **命中层单独放大**：WCAG AA 的最低目标只有 24px；GitHub 建议移动端做到 44px（AAA）——靠行高、内边距与透明扩展区实现，而不是把带边框的盒子整体撑到 44px。

这正好解决了「为了好点而把每个按钮做成 40px 大盒子，结果一屏全是框、内容被挤走」的问题。

## 2. 出处（2026-11-06 核对）

| 来源 | 关键结论 |
|------|----------|
| [Primer · Responsive](https://primer.style/product/getting-started/foundations/responsive/) | AA 标准最低目标 24px；移动端建议提高到 44px 以达 AAA；medium 按钮高 32px，移动端建议直接用更大档 |
| [Primer · Typography utilities](https://primer.style/product/css-utilities/typography/) | 「Font sizes are smaller on mobile and scale up at the md breakpoint」；阶梯：f0 32→40、f1 26→32、f2 22→24、f3 18→20、f4 16、f5 14、f6 12 |
| [WCAG 2.1 SC 2.5.5 Target Size (Enhanced)](https://www.w3.org/WAI/WCAG21/Understanding/target-size.html) | AAA：指针目标至少 44×44 CSS px |
| [DesignSystems.one · GitHub Primer](https://www.designsystems.one/design-systems/primer) | Body Medium 14/20、Caption 12/16；间距基数 4px（4/8/16/24/32/40/48） |

## 3. 落到本项目的数值

| 元素 | 桌面 | 移动端 | 依据 |
|------|------|--------|------|
| 面板/列表正文 | 14px | 14px | Primer f5 移动端不缩 |
| 元信息/次要文字 | 12px（徽章允许 10px） | 12px | Primer caption 12 |
| 展示型大标题 | 16–18px | 同桌面 | 本项目不使用 f0–f3 的大标题 |
| 图标按钮视觉 | 22–26px | 32px，图标 16px | Primer medium 32 / octicon 16 |
| 命中区 | 控件本身 | ≥40px（伪元素扩展，不占布局） | Primer 44 建议 + AA 24 下限 |
| 工具栏高度 | 36px | 40px | 32px 控件 + 上下 4px |
| 筛选胶囊 | 20px | 28px 视觉 / 36px 竖向命中 | 胶囊不是主操作，优先保密度 |
| 列表行 | 40–48px | 44–48px | 整行可点，行高即命中区 |
| 输入 / 下拉 | 22–30px | 36px | 输入框低于 32px 聚焦手感明显变差 |
| 卡片内 gap | 3–8px | 2–6px | 间距基数 4px 的紧凑档 |

## 4. 实现约束（踩坑记录）

1. **命中区用透明伪元素**：`touch-area`（四周）/ `touch-area-y`（仅竖向）。伪元素是按钮的一部分，点击命中按钮，且不参与布局。
2. **相邻控件只做竖向扩展**：同一行内 32px 按钮若四周扩到 40px，会与邻居重叠 6px，出现「点移动却删掉订阅源」。工具栏等独立按钮保持 gap 8px（32 + 8 = 40，命中区刚好相接）。
3. **横向滚动容器里的扩展不能超出内边距**：`.rss-filter-bar` 是 `overflow-x: auto`（另一轴按规范计算为 `auto`），命中区若比条形框高，会产生 2px 的可滚动纵向溢出（回弹/滚动条）。筛选胶囊因此取 36px 竖向命中。同理，`overflow-x` 滚动容器的 `::after` 命中区一律按容器高度取值。
3. **非 scoped 样式禁用 `:deep()`**：`<style lang="scss">` 不带 `scoped` 时 `:deep()` 会原样进产物（`dist/index.css` 可验证），整条规则被浏览器丢弃。rssReader 正文的图片限宽、`pre` 横向滚动曾因此完全失效。
4. **断点必须带粗指针兜底**：`@media (max-width: $bp-mobile), (pointer: coarse) and (hover: none)`；只按宽度判断会漏掉手机横屏（≥769px），触摸目标在横屏退回 22–26px。
5. **竖向空间优先**：单个次要操作不新开一行（如列表收藏按钮并入标题行右侧）；摘要移动端限 1 行，完整内容进详情页。

## 5. rssReader 落地前后（估算）

| 区域 | 放大盒子方案 | 视觉紧凑 + 命中区扩展 |
|------|--------------|------------------------|
| 顶部三条工具带 | 52 + 48 + 48 = **148px** | 40 + 44 + 36 = **120px** |
| 文章卡片（含 2 行标题 + 摘要） | 约 **151px**（含 40px 收藏底栏） | 约 **94px**（收藏并入标题行、摘要 1 行） |
| 订阅源行操作区宽度 | 3 × 40 + 2 × 2 = **124px** | 3 × 32 + 2 × 4 = **104px**（无边框图标） |
