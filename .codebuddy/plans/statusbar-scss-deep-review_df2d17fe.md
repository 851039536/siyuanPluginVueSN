---
name: statusbar-scss-deep-review
overview: 对 statusBar/styles/index.scss（503行）进行深度 SCSS 审查，消除10处冗余选择器与重复属性，优化2处性能瓶颈，按 CODEBUDDY.md 规范重构。
todos:
  - id: add-local-vars-and-placeholders
    content: 在 index.scss 顶部添加本地变量（$_gap-xs, $_pad-tab-y, $_pad-tab-x, $_grid-title-size）、占位选择器（%flex-center, %flex-shrink-0）、mixin（hover-lift）、缓动变量（$_ease-out）
    status: completed
  - id: refactor-statusbar-panel
    content: 重构状态栏面板区域（L4-L165）：应用 %flex-center/%flex-shrink-0、合并 data-level 图标规则到对应颜色块、hover-lift mixin 替换 4 处 opacity hover 模式、功能色值提取为 CSS 自定义属性
    status: completed
    dependencies:
      - add-local-vars-and-placeholders
  - id: refactor-feature-drawer
    content: 重构功能抽屉区域（L167-L502）：应用占位选择器、修复 transition 多余属性、修复 .rarely-list 作用域嵌套、硬编码 10px/3px 替换为本地变量、grid-mode 下 3px gap 替换
    status: completed
    dependencies:
      - add-local-vars-and-placeholders
  - id: verify-output
    content: 验证编译后 CSS 输出无变化：确认所有选择器特异性、属性值、媒体查询与优化前完全一致
    status: completed
    dependencies:
      - refactor-statusbar-panel
      - refactor-feature-drawer
---

## 用户需求

对 statusBar 模块 `styles/index.scss`（503行）进行 CSS/SCSS 深度审查与重构：

1. **冗余合并**：识别并合并重复的选择器与样式属性（12处 `flex-center`、10处 `flex-shrink:0`、4处 hover-opacity 模式等）
2. **性能优化**：降低 3-4 层选择器嵌套深度、移除 transition 中多余的属性声明
3. **规范合规**：修复硬编码的 `10px`/`3px` 等无 token 对应值，使用本地变量替代；修复 `.rarely-list` 作用域问题
4. **严格约束**：所有修改不改变现有视觉表现与业务逻辑

## 核心发现（15 个问题）

| 类别 | 数量 | 典型问题 |
| --- | --- | --- |
| 冗余选择器/属性 | 8 | flex-center×12、flex-shrink-0×10、hover-opacity×4、cubic-bezier×2、硬编码色值×6、background:transparent×4、border-bottom×3、color:on-surface×9 |
| 渲染性能 | 2 | L42-44 data-level 选择器嵌套降层、L224/L312 transition 多余属性 |
| 规范合规 | 3 | L416 font-size:10px、L409 gap:3px、L303 padding:3px 10px |
| 作用域 | 1 | L468 .rarely-list 顶层应嵌套到 .feature-drawer-rarely |
| 结构优化 | 1 | L31-44 data-level 图标规则可合并到已有 color/background 块 |


## 技术方案

### 整体策略

**不引入外部依赖，仅用 SCSS 内置特性**（`%placeholder`、`@mixin`、`@extend`、局部变量）完成重构。所有优化编译后生成的 CSS 选择器与属性值完全一致，确保零视觉差异。

### 冗余合并方案

#### 1. `display: flex; align-items: center;` 重复 12 处 → `%flex-center` 占位选择器

在文件顶部定义：

```
%flex-center {
  display: flex;
  align-items: center;
}
```

12 处调用点替换为 `@extend %flex-center;`。SCSS `%placeholder` 编译后不产生额外选择器（silent class），各调用处原地展开为 `display:flex;align-items:center`，CSS 输出完全不变。

#### 2. `flex-shrink: 0` 重复 10 处 → `%flex-shrink-0` 占位选择器

同上模式。10 处调用点替换为 `@extend %flex-shrink-0;`。

#### 3. hover-opacity 模式重复 4 处 → `@mixin hover-lift($rest-opacity, $hover-opacity: 1)`

4 处模式均为 `opacity: X; &:hover { opacity: Y }`，提取 mixin：

```
@mixin hover-lift($rest: 0.7, $hover: 1) {
  opacity: $rest;
  &:hover { opacity: $hover; }
}
```

调用处变为 `@include hover-lift(0.7);`、`@include hover-lift(0.5);`、`@include hover-lift(0.8);`。编译后 CSS 与原代码完全一致。

#### 4. `border-bottom: X var(--b3-border-color)` 重复 3 处 → 本地 CSS 变量

3 处 border-bottom 颜色值相同（仅 `dashed`/`solid` 样式不同），提取颜色为 CSS 自定义属性减少重复：

```
--drawer-divider: var(--b3-border-color);
```

#### 5. `cubic-bezier(0.4, 0, 0.2, 1)` 重复 2 处 → 本地 SCSS 变量

```
$_ease-out: cubic-bezier(0.4, 0, 0.2, 1);
```

`_` 前缀表示文件私有变量（SCSS 约定），不污染全局命名空间。

#### 6. 硬编码功能色值 6 处 → 文件级 CSS 自定义属性

这些色值与 `index.vue` 中 `FEATURES` 数组的 `color` 字段对应，是业务逻辑关联的功能标识色。在 `:root` 或 `.feature-drawer` 下定义：

```
--status-color-html: #e67e22;
--status-color-image-compressor: #ef4444;
--status-color-format: #07c160;
--status-color-website: #8b5cf6;
--status-color-backup: #10b981;
--status-color-tool: #6366f1;
```

#### 7. `color: var(--b3-theme-on-surface)` 重复 9 处

分布在多个独立选择器中且各有不同的 opacity 修饰，强行提取会导致选择器碎片化。**保留当前写法**，因为每个选择器有独立语义且 opacity 值各不相同。

#### 8. `background: transparent` 重复 4 处

4 处均为按钮/输入框初始背景重置，语义一致。但提取为 mixin 会在编译后产生 4 个独立规则，与当前 CSS 输出相同，无收益。**保留不处理**。

### 性能优化方案

#### P1: data-level 选择器嵌套降层（L31-44）

**当前结构**（产生 4 层嵌套）：

```
.monitor-item {
  &[data-level="high"] { color: ...; background: ...; }        // 块1
  &[data-level="medium"] { color: ...; background: ...; }      // 块2
  &[data-level="high"], &[data-level="medium"] {               // 块3 — 与块1/2选择器重复
    .monitor-icon { opacity: 1; }
  }
}
```

**优化后**（合并到块1/块2中，消除块3）：

```
.monitor-item {
  &[data-level="high"] {
    color: var(--b3-theme-error);
    background: var(--b3-theme-error-lighter);
    .monitor-icon { opacity: 1; }
  }
  &[data-level="medium"] {
    color: var(--b3-theme-warning);
    background: var(--b3-theme-warning-lighter);
    .monitor-icon { opacity: 1; }
  }
}
```

编译后 CSS 选择器数量不变，但 SCSS 源码消除冗余块，嵌套层数减少。

#### P2: transition 多余属性移除（L224, L312）

- **L224** `.feature-drawer-view-btn/.feature-drawer-close`：`transition: border-color 0.12s, color 0.12s, opacity 0.12s` → hover 时仅改变 `border-color` 和 `color`，opacity 从不变化 → 移除 `opacity 0.12s`
- **L312** `.feature-drawer-tab`：`transition: background 0.12s, color 0.12s, border-color 0.12s` → `.active` 是瞬间切换（无 transition），border-color 仅在 active 时瞬间变化 → 移除 `border-color 0.12s`

### 规范合规方案

#### C1-C3: 硬编码值本地变量化

全局 token 体系最小单位为 4px（`$spacing-1`），无法覆盖 3px/10px。在文件顶部定义本地变量：

```
// 本地微间距变量（全局 token 体系最小 4px，无法覆盖）
$_gap-xs: 3px;
$_pad-tab-y: 3px;
$_pad-tab-x: 10px;
$_grid-title-size: 0.625rem; // 10px — 网格模式下标题字号
```

### 作用域修复

#### `.rarely-list` 作用域（L468-474）

当前为顶层选择器，但 HTML 中位于 `<div class="feature-drawer-rarely">` 内部。嵌套进去：

```
.feature-drawer-rarely {
  .rarely-list {
    padding-top: 0;
    .feature-drawer-item-title { opacity: 0.7; }
  }
}
```

编译后选择器从 `.rarely-list` 变为 `.feature-drawer-rarely .rarely-list`，特异性稍增但不影响视觉表现（该区域无同名冲突）。

### 优化前后对比示例

#### R1: flex-center 占位选择器

| 优化前 | 优化后 |
| --- | --- |
| 12 处各自声明 `display: flex; align-items: center;` | 12 处 `@extend %flex-center;` |
| 12 次重复书写，修改需到处改 | 一处定义，修改只需改占位选择器 |
| 编译后 CSS 输出 24 条规则（每处 2 属性） | 编译后 CSS 输出完全相同 24 条规则 |


#### R3: hover-opacity mixin

| 优化前 | 优化后 |
| --- | --- |
| 4 处各自写 `opacity: 0.7; &:hover { opacity: 1; }` | 4 处 `@include hover-lift(0.7);` |
| 语义隐蔽 | 语义明确：hover 时提升至 1 |


#### P1: data-level 嵌套降层

| 优化前 | 优化后 |
| --- | --- |
| 3 个独立 SCSS 块（颜色块、颜色块、图标块） | 2 个 SCSS 块（颜色+图标合并） |
| 图标块重复了 data-level 选择器 | 消除重复选择器声明 |
| CSS 输出不变 | CSS 输出不变 |


#### 作用域修复

| 优化前 | 优化后 |
| --- | --- |
| `.rarely-list { ... }` 顶层选择器 | `.feature-drawer-rarely { .rarely-list { ... } }` |
| 全局作用域，可能被外部误覆盖 | 限定在父容器下，作用域清晰 |


### 修改文件清单

仅修改 **1 个文件**：`src/features/statusBar/styles/index.scss`

- 在 `@use '@/variables.scss' as *;` 之后新增本地变量和占位选择器/mixin 定义区（约 40 行）
- 逐区域应用：状态栏面板区（L4-L165）→ 功能抽屉区（L167-L502）
- 总量变化：新增约 50 行（变量/mixin/placeholder），净减少约 30 行（消除重复声明），总行数约 520 行