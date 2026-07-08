---
name: wordquery-unified-result-layout
overview: 重构 WordQueryPanel 查询结果区域：去掉每个字段单独卡片块的布局，改为统一内容区内表格式行排列。
todos:
  - id: add-extract-word
    content: 在 useWordQuery.ts 中新增 extractWord computed 并导出
    status: completed
  - id: refactor-template
    content: 重构 WordQueryPanel.vue 模板：v-html 替换为数据驱动的表格式行渲染
    status: completed
    dependencies:
      - add-extract-word
  - id: refactor-scss
    content: 重构 WordQueryPanel.vue SCSS：移除卡片块样式，新增表格式行布局样式
    status: completed
    dependencies:
      - refactor-template
  - id: add-i18n-labels
    content: 在 zh_CN 和 en_US 的 wordQuery.json 中新增 5 个行标签键
    status: completed
---

## 用户需求

将 WordQueryPanel.vue 单词查询结果区域从当前的"卡片块"布局重构为"表格式行"布局，与已完成的 CodeTranslationPanel 风格保持一致。

## 核心改动

- 去掉每个字段（单词/音标/释义/谐音/例句）独立的卡片壳（border + background + border-left 彩色左边框）
- 改为统一边框容器 + 行分隔线的表格式布局
- 用数据驱动渲染（`extractContentParts`）替代当前的 `v-html="formattedResult"`
- 新增行标签 i18n 键

## 技术方案

### 改动文件清单

| 文件 | 改动类型 | 说明 |
| --- | --- | --- |
| `src/features/toolCollection/tools/wordQuery/composables/useWordQuery.ts` | MODIFY | 新增 `extractWord` computed；导出新增属性 |
| `src/features/toolCollection/tools/wordQuery/components/WordQueryPanel.vue` | MODIFY | 模板改为数据驱动行渲染；SCSS 替换为表格式行样式 |
| `src/i18n/zh_CN/wordQuery.json` | MODIFY | 新增 5 个行标签键 |
| `src/i18n/en_US/wordQuery.json` | MODIFY | 新增 5 个行标签键 |


### 实现策略

**1. useWordQuery.ts — 新增 `extractWord` computed**

从原始 `queryResult` 中通过正则 `/^####\s*(?:单词|词语)：(.+)$/m` 提取 AI 返回的单词/词语值（处理 AI 修正拼写的情况），fallback 到 `searchWord`。计算属性加入 return 导出。

**2. WordQueryPanel.vue 模板 — 数据驱动行渲染**

将第 129-132 行的 `v-html` 块替换为与 CodeTranslationPanel 结构一致的 `.result-rows` 容器，每行一个 `.result-row`：

| 行 | 标签 | 数据来源 | 条件 |
| --- | --- | --- | --- |
| 单词 | `i18n.wordLabel` | `extractWord` | 始终显示 |
| 音标 | `i18n.phoneticLabel` | `extractContentParts.phonetic` | `v-if` 有值 |
| 释义 | `i18n.meaningLabel` | `extractContentParts.meaning` | `v-if` 有值 |
| 谐音 | `i18n.homophonicLabel` | `extractContentParts.pronunciation` | `v-if` 有值 |
| 例句 | `i18n.exampleLabel` | `extractContentParts.example` | `v-if` 有值 |


模板中解构新增 `extractWord`。

**3. WordQueryPanel.vue SCSS — 表格式行布局**

- 移除 `.result-content` 的卡片样式（background/border/padding/max-height），改为无样式的 flex 容器
- 移除所有 `.result-section` 嵌套样式（word-section/phonetic-section/english-section/meaning-section/pronunciation-section/tip-section/example-section）
- 新增复用 CodeTranslationPanel 同款样式：`.result-rows`（统一边框容器+overflow:hidden）、`.result-row`（flex+border-bottom 分隔，last-child 无底线）、`.row-label`（min-width:52px 固定左列+灰色小字）、`.row-value`（flex:1 右列+mono 字体+xs 字号）

**4. i18n — 新增 5 个行标签键**

zh_CN: `wordLabel="单词"`、`phoneticLabel="音标"`、`meaningLabel="释义"`、`homophonicLabel="谐音"`、`exampleLabel="例句"`
en_US: `wordLabel="Word"`、`phoneticLabel="Phonetic"`、`meaningLabel="Meaning"`、`homophonicLabel="Homophonic"`、`exampleLabel="Example"`