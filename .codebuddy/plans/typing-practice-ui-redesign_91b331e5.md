---
name: typing-practice-ui-redesign
overview: 重新排版 TypingPractice 组件：删除顶部 Card，词义内容下移为参考区，选项行与数量调节器合并为紧凑一行，保持打字核心区、导航、统计不变。
todos:
  - id: rewrite-template
    content: 重写 TypingPractice.vue 模板：删除 Card 块、合并选项行与数量调节器为 typing-controls、在 typing-area 后新增 typing-reference 参考区
    status: completed
  - id: update-script
    content: 移除 TypingPractice.vue script 中 Card 组件导入
    status: completed
    dependencies:
      - rewrite-template
  - id: rewrite-scss
    content: 重写 TypingPractice.scss：合并 typing-options + typing-session-config 为 typing-controls，新增 typing-reference 参考区样式，移除 typing-detail 旧样式
    status: completed
    dependencies:
      - rewrite-template
  - id: verify-lint
    content: 验证全目录 lint 0 error
    status: completed
    dependencies:
      - rewrite-scss
---

## 用户需求

重新排版 TypingPractice 打字练习组件的 UI 布局，使其更清晰舒适。

## 核心改动

1. **删除顶部 Card 组件**：不再显示卡片形式的标题/内容/分类/练习次数/播放按钮
2. **词义内容下移为参考区**：将 `currentCard.content`（单词释义）放到打字区下方，轻量文本展示，不加卡片包裹
3. **控制栏合并为一行**：选项按钮（大小写/即时重置/盲打/计时）与数量调节器放在同一行，紧凑显示
4. **保持不变的区域**：打字核心区（目标字符块 + 输入框 + 结果反馈）、导航条（上下翻页/随机/跳过）、统计栏、轮次完成摘要
5. **保留播放按钮**：emit('play') 功能保留，放在参考区标题旁边

## 技术栈

- Vue 3 Composition API + TypeScript
- SCSS（Codex 风格，使用全局 Design Token）
- 复用项目现有 Button/IconWrapper 组件

## 实现方案

### 模板层改动（TypingPractice.vue）

#### 删除 Card 组件块

```html
<!-- 删除 L4-40 整个 <Card> 块 -->
```

#### 合并控制栏

将 `.typing-options` 和 `.typing-session-config` 合并为 `.typing-controls`：

```html
<div class="typing-controls">
  <div class="typing-controls__options">
    <!-- 4 个选项按钮：大小写、即时重置、盲打、计时 -->
  </div>
  <div class="typing-controls__config">
    <!-- 数量调节器 -->
  </div>
</div>
```

#### 新增参考区

在 `.typing-area` 之后插入：

```html
<div v-if="currentCard" class="typing-reference">
  <div class="typing-reference__header">
    <span class="typing-reference__meta">
      <span class="tag tag-small tag-info">{{ currentCard.category }}</span>
      <span class="tag tag-small tag-contrast">练习 {{ currentCard.practiceCount || 0 }} 次</span>
    </span>
    <Button
      variant="ghost"
      size="xsmall"
      icon="play"
      :iconSize="12"
      :title="t.play"
      @click="$emit('play', currentCard)"
    />
  </div>
  <p class="typing-reference__content">{{ currentCard.content }}</p>
</div>
```

#### 移除 Card 导入

```typescript
// 删除：import Card from "@/components/Card.vue"
```

### 样式层改动（TypingPractice.scss）

#### 新增 `.typing-controls` 合并样式

```
.typing-controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: $spacing-2;
  flex-shrink: 0;

  &__options {
    display: flex;
    gap: $spacing-1;
    flex-wrap: wrap;
  }

  &__config {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  }
}
```

#### 新增 `.typing-reference` 参考区样式

```
.typing-reference {
  padding: $spacing-3 $spacing-3;
  border-top: 1px solid var(--b3-border-color);
  flex-shrink: 0;

  &__header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: $spacing-2;
  }

  &__meta {
    display: flex;
    align-items: center;
    gap: $spacing-1;
  }

  &__content {
    font-size: $font-size-sm;
    line-height: $line-height-normal;
    color: var(--b3-theme-on-background);
    opacity: 0.85;
    word-break: break-word;
    white-space: pre-wrap;
    margin: 0;
    max-height: 120px;
    overflow-y: auto;
  }
}
```

#### 移除/复用现有样式

- `.typing-options` 和 `.typing-session-config` 的独立样式块可移除（合并到 `.typing-controls` 中）
- `.typing-case-toggle` 样式保持不变（选项按钮）
- `.typing-detail` 样式被 `.typing-reference__content` 替代
- 其余区域样式完全不变

### 注意事项

- CSS 选择器 `.typing-options` / `.typing-session-config` 删除后，对应的子元素选择器层级改为 `.typing-controls` > `.typing-controls__options` / `.typing-controls__config` 下
- `.typing-case-toggle` 不变，只是父容器从 `.typing-options` 变为 `.typing-controls__options`
- 数量调节器相关 BEM 类名不变（`typing-session-config__*`），只是父容器从 `.typing-session-config` 改为 `.typing-controls__config`
- `index.scss` 中 `.flashcard-item` 等样式不动（列表视图仍在使用）