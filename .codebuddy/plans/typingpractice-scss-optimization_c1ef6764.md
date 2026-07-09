---
name: typingpractice-scss-optimization
overview: 审查并优化 TypingPractice.scss 的冗余选择器、重复样式属性、性能问题（transition:all、深嵌套），严格不改变视觉表现。
todos:
  - id: optimize-typing-practice-scss
    content: "优化 TypingPractice.scss：缩小 3 处 transition: all 为精确属性、替换硬编码 0.12s 为 $fc-transition、移除冗余 font-size 继承声明、提取重复 gap: 6px 为 $fc-gap-tight 局部变量"
    status: completed
  - id: review-index-scss
    content: 审查 index.scss 中 .card-navigation、.typing-practice > .flashcard-item、@keyframes streak-pulse 样式块，确认无需修改
    status: completed
  - id: codex-review
    content: 使用 [skill:codex-ui-style-guide] 对优化后的 TypingPractice.scss 和 index.scss 进行 Codex 规范合规性审查
    status: completed
    dependencies:
      - optimize-typing-practice-scss
      - review-index-scss
---

## 用户需求

审查 `src/features/flashcardReading/components/TypingPractice.vue` 关联的 SCSS 代码（`styles/TypingPractice.scss` 及 `styles/index.scss` 中相关部分），识别并合并冗余选择器与重复样式属性。分析渲染性能，优化如 `transition: all`、复杂选择器嵌套等影响性能的代码。**严格保证不改变现有视觉表现与业务逻辑**，仅进行安全重构。最终输出需遵循 CLAUDE.md 中的 Codex 规范。

## 核心功能

- 缩小 3 处 `transition: all` 为精确属性列表，减少浏览器合成层的不必要重绘计算
- 统一 `0.12s` 硬编码为 Token `$fc-transition`
- 移除可继承的冗余 `font-size` 声明
- 提取 3 处重复的 `gap: 6px` 为局部变量 `$fc-gap-tight`
- 联动审查 `index.scss` 中 `.card-navigation` 和 `.typing-practice > .flashcard-item` 样式块

## 技术方案

### 实现策略

**安全重构原则**：所有优化分两类——A类（零视觉影响，纯性能/代码质量提升）和 B类（可能影响视觉，标记但保留不动）。本轮仅实施 A 类变更。

#### A类变更（安全，直接执行）

**1. 缩小 transition 属性范围（性能优化）**

| 位置 | 当前 | 优化后 | 影响 |
| --- | --- | --- | --- |
| `.typing-session-config__btn`（L51） | `transition: all $fc-transition` | `transition: border-color $fc-transition, color $fc-transition` | 仅 hover 时 border-color/color 变化 |
| `.typing-case-toggle`（L86） | `transition: all $fc-transition` | `transition: border-color $fc-transition, opacity $fc-transition, background-color $fc-transition, color $fc-transition` | hover 变 opacity+border；active 变 background+color+border |
| `.typing-char`（L188） | `transition: all 0.12s` | `transition: background-color $fc-transition, border-color $fc-transition, color $fc-transition` | correct/incorrect 仅改这三属性 |


**原理**：`transition: all` 使浏览器必须监听元素所有 CSS 属性的变化，包括 layout/paint/composite 各层。精确指定过渡属性可减少合成器线程的计算量，避免不必要的重绘触发。

**2. 统一 Token 使用（L188）**

- `transition: all 0.12s` → `transition: background-color $fc-transition, border-color $fc-transition, color $fc-transition`
- 与同文件其他选择器保持一致

**3. 移除冗余继承声明（L103）**

- `.typing-case-toggle__label` 中的 `font-size: $font-size-xs` 与其父级 `.typing-case-toggle`（L84）完全相同
- `font-size` 是可继承属性，子元素无需重复声明
- 删除此行，视觉输出不变

**4. 提取重复硬编码值**

- `gap: 6px` 在 L27（`__options`）、L77（`.typing-case-toggle`）、L275（`.typing-session-stats`）三处重复
- 在 TypingPractice.scss 顶部声明 `$fc-gap-tight: 6px; // 6px 紧密间距（无匹配全局Token）`
- 三处引用替换

#### B类变更（标记但不修改）

以下硬编码值无匹配的全局 Token，修改会导致视觉变化，本轮不做处理：

- `padding: $spacing-1 10px`（L78）— 10px 无匹配 Token（$spacing-2=8px, $spacing-3=12px）
- `padding: 10px 14px`（L211）— 同上
- `padding: 6px 14px`（L242）— 同上
- `gap: 10px`（L306）— 同上
- `line-height: 1`（L50）— 按钮图标垂直居中必要值
- `margin-top: -8px`（index.scss L60）— 精确定位微调

### 联动审查 index.scss

#### `.card-navigation`（L63-79）

- `padding: $spacing-2 14px` 中 14px 无匹配 Token，保留不动
- `gap: $spacing-3`（$spacing-3=12px）— 与 TypingPractice.scss 的 `gap: 6px` 是不同的视觉意图（导航栏间距 vs 控件内间距），各自合理，无需统一
- 整体结构清晰，无性能问题

#### `.typing-practice > .flashcard-item`（L294-313）

- 使用 `:deep()` 穿透 scoped 样式，属 Vue scoped 下的标准做法
- 选择器嵌套层级（3层）合理，无过度嵌套
- 无 transition/animation 声明，不涉及重绘性能问题

#### `@keyframes streak-pulse`（L342-346）

- 仅使用 `transform: scale()`，复合图层动画，不触发 layout/paint，性能最优
- 无需修改

### 架构设计

```
┌─ TypingPractice.vue ─────────────────────────────────┐
│  (无 <style> 块)                                       │
│  样式全部由父组件 FlashcardDialog.vue 的 scoped 导入    │
└───────────────────────────────────────────────────────┘
                          │
                          ▼
┌─ FlashcardDialog.vue <style scoped> ─────────────────┐
│  @use '../styles/FlashcardDialog.scss';               │
│  @use '../styles/SingleCardView.scss';                │
│  @use '../styles/index.scss';  ← 加载 TypingPractice  │
└───────────────────────────────────────────────────────┘
                          │
                          ▼
┌─ index.scss ─────────────────────────────────────────┐
│  @use 'TypingPractice';  ← 加载 TypingPractice.scss   │
│  .card-navigation { ... }  ← 公共导航栏样式            │
│  .typing-practice > .flashcard-item { ... }           │
│  @keyframes streak-pulse { ... }                      │
└───────────────────────────────────────────────────────┘
```

### 目录结构

```
src/features/flashcardReading/styles/
├── TypingPractice.scss    # [MODIFY] 主优化文件：transition 缩小、Token 统一、
│                          #          冗余字体声明移除、提取 $fc-gap-tight 变量
├── index.scss             # [MODIFY] 审查确认无需修改（或同步 fc-gap-tight 定义）
└── _variables.scss        # [NO CHANGE] $fc-transition 已定义，无需改动
```

### 实现注意事项

- **性能**：transition 缩小后，浏览器合成器仅需追踪 2-4 个属性而非全部，在低端设备上可感知到输入响应的改善（尤其在 `instantReset` 模式下高频字符校验场景）
- **日志**：不涉及
- **兼容性**：所有改动的 CSS 属性均为 CSS3 标准，思源 Electron 环境完全支持
- **回退风险**：零。所有修改均为纯 CSS 层等价替换，不改变任何计算值

## Agent Extensions

### Skill

- **codex-ui-style-guide**
- 用途：对优化后的 SCSS 代码进行 Codex 规范合规性审查，确保样式遵循项目 UI 风格（Token 使用、BEM 命名、禁止事项等）
- 预期产出：确认优化后代码通过 Codex 规范审查，无违规项