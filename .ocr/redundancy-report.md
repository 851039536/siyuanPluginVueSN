# aiContentGenerator 冗余重复审查报告

审查范围：`src/features/aiContentGenerator/`（36 个文件）
工具：open-code-review v1.12.13（deepseek-v4.1-flash），commit 737fee2f + 当前源码复核

## 结论摘要

| 严重度 | 数量 | 说明 |
| --- | --- | --- |
| Critical | 0 | — |
| High | 0 | — |
| Medium | 2 | 样式全局规则 10 次重复注入；6 条快捷动作 prompt 后缀重复 |
| Low | 2 | SCSS 导入风格不统一；冗余 `@use` |

## Medium

### M1. 共享样式 10 次重复注入（实证）

`styles/index.scss` 被 10 个组件的 `<style scoped>` 各自 `@use`，其中模块级全局规则
（`.ai-content-panel` / `.content-display-section` / `.error-state,.empty-state`）
在每个组件内被重新发射并打上各自的 scope hash。

构建产物 `dist/index.css` 实证：

- `.ai-content-panel` 出现 **10 次**，10 个独立 scope：`data-v-72712038` … `data-v-28781bfd`
- 单个规则块 207 字符 × 10 = **2070 字符**纯重复
- `.error-state` 同样 10 次

建议：`index.scss` 拆分——全局壳层规则只在面板根（`index.vue`）引入一次；
各组件只 `@use` 各自 partial + `variables`。mixin 部分（`collapsible-chevron` 等）可继续共享。

### M2. 快捷动作 prompt 后缀 7 处重复

`types/index.ts` 的 6 条 `ACTION_META[].prompt` 均以
`保持Markdown格式，直接输出…完整文档内容：` 结尾；`index.vue:291` 的自定义编辑
userInput 也有同款后缀。

建议：抽 `const MD_OUTPUT_SUFFIX = "保持Markdown格式，直接输出..."` 常量或 builder 拼接。

## Low

### L1. SCSS 变量导入风格不统一

- `components/styles/*.scss`（BottomInputArea / SkillSection / SkillPreviewModal）用 `@use "@/variables.scss" as *;`
- `styles/*.scss`（DiffPreview / MainContentArea 等）用 `@use "../../../variables" as *;`

两者都解析到 `src/_variables.scss`，行为一致但风格混用。建议统一为别名写法。

### L2. 冗余 `@use "./index.scss"`

`styles/ContentAreaEmpty.scss:3` 仅消费变量、无任何 mixin/member 引用，
却引入了 `index.scss`；其唯一消费者 `ContentAreaEmpty.vue` 已直接引入 `index.scss`。
建议删除该行（对照 `styles/DiffPreview.scss` 只引变量，是正确写法）。

注：`styles/CollapsibleSection.scss` / `MainContentArea.scss` / `ReasoningSection.scss` /
`ReviewPanel.scss` / `SearchResultsSection.scss` 同样引了 `index.scss`，需逐个确认是否真的
用到其中的 mixin，否则一并清理。

## 已确认修复（审查时为有效项，当前源码已消除）

- `.quick-action-btn` 与 `.rag-toggle` 的近重复契约（display/flex/gap/border/hover）
  已被 commit `b3062337` 的设计 Token 迁移吸收，当前模块内无这两个类名。
- `types/index.ts` 的硬编码评级字符串已收敛为 `RATING_NEEDS_FIX` / `RATING_VALUES`。
- `index.scss` 已从 434 行瘦身为 137 行，组件专属样式已提取到各 partial。

## 未纳入

OCR 在 commit 范围内另报的 3 条 `i18n/wordQuery.json`、`zh_CN.json` 事项位于本模块之外，
且其中 i18n 项的 `existing_code` 与当前文件不符（行号已随其他提交漂移），未采纳。
