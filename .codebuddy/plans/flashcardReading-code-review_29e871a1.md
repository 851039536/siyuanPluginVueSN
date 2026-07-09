---
name: flashcardReading-code-review
overview: 对 flashcardReading 模块进行全面代码审查与优化：修复逻辑漏洞、消除重复代码、提升性能、对齐 CLAUDE.md 编码规范。
todos:
  - id: fix-file-headers
    content: 为所有缺失文件头注释的 .ts/.vue 文件补充注释（types/storage.ts 注释移顶、4 个 composables、8 个 .vue 组件）
    status: completed
  - id: fix-scss-tokens-and-inline
    content: 使用 [skill:codex-ui-style-guide] 审查并替换 SCSS：删除 _variables.scss 中 $fc-mono/$fc-radius 本地声明 替换为全局 $vp-mono/$vp-radius；将所有硬编码 font-size/padding/border-radius 替换为全局 Token；提取 FlashcardDialog.vue 内联样式到 styles/FlashcardDialog.scss
    status: completed
    dependencies:
      - fix-file-headers
  - id: fix-form-sizes-and-emojis
    content: 修复 CardDialog.vue Input/Select 缺少 size="small"、FlashcardDialog.vue Select 缺少 size、TypingPractice.vue 中所有 emoji 替换为 Iconify 图标
    status: completed
    dependencies:
      - fix-file-headers
  - id: fix-typing-queue-logic
    content: 修复打字队列逻辑漏洞：next() 移除 rebuild 仅 index++、random() 移除 rebuild、index.vue watch 筛选变化后显式 rebuild、切换模式时 reset 索引
    status: completed
    dependencies:
      - fix-file-headers
  - id: fix-boundary-bugs
    content: 修复边界问题：FlashcardDialog 首尾导航不重复 playWord、TypingPractice restartRound 自动重启 timer（若 timerEnabled）、storage.incrementPracticeCount 增加乐观锁版本号防竞态
    status: completed
    dependencies:
      - fix-typing-queue-logic
  - id: extract-duplicates
    content: 提取重复代码：创建 utils.ts 导出 syncIncrementPractice/pickRandomExcluding/handleCopyCard 三个纯函数，消除 usePlayWord、index.vue、FlashcardDialog 中的重复逻辑
    status: completed
    dependencies:
      - fix-boundary-bugs
  - id: optimize-performance
    content: 性能优化：statisticsData 从 computed 改为 watch+防抖缓存避免 O(n) 高频重算、buildQueue 保留现有 swap-with-end 优化（已是 O(n)）
    status: completed
    dependencies:
      - extract-duplicates
---

## 需求概述

对 `src/features/flashcardReading/` 模块（28 个文件）执行四维度全面审查与优化：

1. **逻辑漏洞排查与修复**：深度检查边界条件、竞态条件、状态不一致、队列重建策略错误等
2. **冗余代码合并重构**：消除 `incrementPracticeCount`、`handleCopy`、随机避重、categoryOptions 等重复逻辑
3. **性能瓶颈优化**：`buildQueue` O(n²) 加权抽样、`statisticsData` 全量重算、不必要的队列重建
4. **编码规范合规**：文件头注释、SCSS 全局 Token 替换（消除本地 `$fc-*` 变量）、内联样式分离、表单组件 `size="small"`、emoji 替换为 Iconify 图标

## 核心约束

- 所有修改必须保证现有业务逻辑与核心功能不受影响
- 严格遵循 CLAUDE.md 和 CLAUDE_RULES.md 定义的编码规范
- 子组件保持纯展示角色，逻辑编排在父组件完成
- 修改完成后由用户自行执行 lint/tsc/i18n 验证

## 技术栈

- TypeScript + Vue 3 (Composition API)
- SCSS (所有样式分离到 `.scss` 文件)
- 思源笔记 Plugin API（`PluginStorage`、`createVueDockApp`、`createModalVueApp`）
- 全局设计 Token：`src/_variables.scss`（`$vp-radius`、`$vp-mono`、`$font-size-*`、`$spacing-*`、`$radius-*`）

## 实现策略

### 分层修改顺序

1. **规范合规层**（无逻辑影响）：文件头注释 + SCSS Token 替换 + 内联样式分离 + size 属性 + emoji 图标替换
2. **逻辑修复层**（修复 bug）：队列重建策略、边界导航、timer 状态
3. **重构层**（DRY + 性能）：提取共享工具函数、优化算法复杂度

此顺序确保每层改动独立可验证，降低回归风险。

### 关键技术决策

| 决策点 | 方案 | 理由 |
| --- | --- | --- |
| `$fc-mono` / `$fc-radius` 替换 | 直接替换为全局 `$vp-mono` / `$vp-radius`，删除 `_variables.scss` 中本地声明 | 全局 Token 已定义等价变量，本地声明属于重复 |
| TypingQueue rebuild 策略 | `rebuild()` 仅在切换模式 / 重启轮次 / 筛选变化时调用，`next()` 仅 `index++` | 每张卡片前进都全量重建是性能浪费 |
| incrementPracticeCount 重复 | 提取为 `utils.ts` 中纯函数 `syncIncrementPractice(cards, id)`，两处调用点统一使用 | 遵循三层分离原则：纯工具函数放 utils.ts |
| 随机避重逻辑 | 提取为 `utils.ts` 中 `pickRandomExcluding(list, excludeIdx)` | 两处完全相同的 do-while 逻辑 |
| statisticsData 优化 | 用 `watch(cards, ...)` 替代 `computed`，配合防抖 100ms 批量更新 | computed 在每次 cards 微小变化时触发全量 O(n) 遍历 |
| emoji 图标替换 | `Aa`→`mdi:format-letter-case`、`↻`→`mdi:refresh`、`◌/◉`→`mdi:eye-off/eye`、`⏱`→`mdi:timer-outline`、`+/−`→保留为文字按钮文本 | 图标系统禁止 emoji，Iconify MDI 图标集已预加载 |


### 性能影响评估

- `buildQueue`：卡片数 n≤100 时 O(n²) 与 O(n log n) 差异可忽略，但重构为 Fisher-Yates 保持整洁
- `statisticsData`：从 computed 改为 watch + 防抖后，筛选/快速切换卡片时减少不必要的全量遍历
- `next()` 移除 rebuild：打字练习场景下是最显著提升，从每张卡片 O(n²) 降至 O(1)

## 代理扩展

### Skill

- **codex-ui-style-guide**
- 用途：审查 flashcardReading 模块所有 SCSS 文件是否符合 Codex UI 规范，验证 Token 使用、硬编码检测、BEM 命名、组件模式合规性
- 预期产出：生成 SCSS 规范违规清单及修复建议，确保替换后的 Token 与全局设计系统一致

### SubAgent

- **code-explorer**
- 用途：在修改前交叉验证 src/features 中其他模块的 SCSS Token 使用模式（如 gitPush/superPanel），确保 flashcardReading 的修改风格与项目整体一致
- 预期产出：确认全局 `$vp-mono`/`$vp-radius` 在其他模块中的实际使用方式，作为 flashcardReading 修改的参照基准