---
name: statistics-code-review
overview: 审查 statistics 模块的 TypeScript/Vue/SCSS 代码，修复逻辑漏洞、合并冗余代码、确保符合 CLAUDE.md 编码规范，不影响现有功能。
todos:
  - id: fix-styles-tokens
    content: 重构 styles/index.scss：删除本地 $font-mono 变量，改用全局 $vp-mono；添加 @/variables 全局引用；将硬编码 borderRadius/fontSize 替换为设计 Token
    status: completed
  - id: fix-component-scss
    content: 使用 [skill:codex-ui-style-guide] 批量修复 20 个组件 SCSS：将 stats.$font-mono 引用替换为 $vp-mono，修复硬编码 font-family、border-radius、font-size，确保符合 Codex 规范
    status: completed
    dependencies:
      - fix-styles-tokens
  - id: extract-index-scss
    content: 提取 index.vue 内联 SCSS（约 226 行）到 styles/index.scss；修复 index.vue 的 watch 双重刷新问题
    status: completed
    dependencies:
      - fix-styles-tokens
  - id: fix-redundancy
    content: 消除代码冗余：删除 baseStats.ts 内联 pad 函数改用 padZero，删除 utils/index.ts 未使用的 formatShortNumber
    status: completed
  - id: fix-logic-bugs
    content: 修复逻辑漏洞：重构 useHistoryData.ts 的初始化时序（将顶层调用移入 loadHistoricalData 内部保证），修复 baseStats.ts 中 SQL 字符串拼接的注入风险
    status: completed
  - id: add-file-headers
    content: 补充缺失的文件头注释：为 queries/、utils/、composables/、types/ 中约 10 个缺少注释的 .ts/.vue 文件添加简要功能说明
    status: completed
  - id: verify-compliance
    content: 运行 pnpm lint + npx tsc --noEmit 验证所有修改通过编译和 lint 检查，确保无回归
    status: completed
    dependencies:
      - fix-styles-tokens
      - fix-component-scss
      - extract-index-scss
      - fix-redundancy
      - fix-logic-bugs
      - add-file-headers
---

## 审查目标

对 `src/features/statistics/` 目录下 49 个源文件（.ts / .vue / .scss）进行全面代码审查，识别并修复三类问题：

### 1. SCSS 硬编码违规

- 17 处 `font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace"` 硬编码，应统一使用全局 Token `$vp-mono`
- 100+ 处 `border-radius: Xpx` 硬编码，应使用 `$radius-sm` / `$vp-radius` 等设计 Token
- 大量 `font-size: Xpx`、`padding: Xpx`、`gap: Xpx` 硬编码
- `styles/index.scss` 定义了本地 `$font-mono` 变量，与全局 `$vp-mono` 重复，共 14 个组件引用了 `stats.$font-mono`

### 2. 代码冗余

- `baseStats.ts` 第 121 行内联定义了 `pad` 函数，与 `utils/index.ts` 的 `padZero` 完全重复
- `utils/index.ts` 导出了 `formatShortNumber` 但实际未被任何文件使用
- `styles/index.scss` 的 `$font-mono` 可完全被全局 `$vp-mono` 替代

### 3. 逻辑漏洞

- `useHistoryData.ts` 在模块顶层调用 `ensurePreviousActiveDayLoaded()` 和 `ensurePreviousSnapshotLoaded()`，时序不确定
- `index.vue` 的 `watch([viewMode, dayRange, monthYearRange, selectedYear], ...)` 在组件挂载时会触发，导致与 `onMounted` 中的 `refreshData()` 形成双重刷新

### 4. 规范合规

- `index.vue` 包含大量内联 SCSS（约 226 行），违反 SCSS 必须分离到 `styles/` 目录的强制规则
- 多个 .ts/.vue 文件缺少文件头注释
- 部分 SCSS 文件未使用 `@/variables` 全局变量

## 技术方案

### 修复策略

本次审查为纯代码质量修复，不新增功能、不修改业务逻辑。所有修复遵循"最小变更、最大收益"原则：

1. **SCSS 硬编码修复**：用全局设计 Token 替换硬编码值，优先使用语义最接近的 Token
2. **冗余消除**：删除重复代码/变量，统一引用路径
3. **逻辑修复**：最小化改动确保时序正确，不改变外部行为
4. **规范合规**：补充缺失内容，调整格式使其符合项目标准

### 涉及文件分类

| 类别 | 文件数 | 改动类型 |
| --- | --- | --- |
| styles/ | 1 | 重构 `$font-mono` → `$vp-mono`，添加全局变量引用 |
| components/ (Vue <style>) | 20 | SCSS 变量引用替换（`stats.$font-mono` → `$vp-mono`），硬编码 Token 替换 |
| index.vue | 1 | 提取内联 SCSS 到 `styles/index.scss`；修复 watch 双重刷新 |
| queries/ | 2 | 删除 `pad` 内联函数，改为引用 `padZero`；修复 SQL 注入风险 |
| composables/ | 1 | 修复 `useHistoryData` 初始化时序问题 |
| types/ | 1 | 删除 `$font-mono` 变量定义 |
| utils/ | 1 | 标记或删除未使用的 `formatShortNumber` |
| 其他 .ts/.vue | ~10 | 补充文件头注释 |


### 性能影响

- SCSS Token 替换：零运行时影响，仅编译时变量解析
- 逻辑修复：消除一次多余的 `refreshData()` 调用和潜在的竞态条件
- 冗余消除：减少约 10 行重复代码，无运行时开销

## 使用的技能扩展

### Skill

- **codex-ui-style-guide**
- 用途：校验 SCSS 修改是否符合 Codex UI 规范，确保 Token 选择正确（如 `$radius-sm` vs `$vp-radius` 的场景区分）
- 预期结果：所有硬编码替换为正确的设计 Token，无 stylelint 级别违规