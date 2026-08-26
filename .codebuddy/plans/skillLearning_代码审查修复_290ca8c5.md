---
name: skillLearning 代码审查修复
overview: 根据审查报告修复 skillLearning 功能的 14 项问题，覆盖逻辑漏洞（复习跳卡、now 非响应式）、内存泄露（keydown 监听器）、i18n 硬编码兜底与索引签名、硬编码色值、删除无 UI 反馈、createCard 冗余与 ID 冲突、死代码清理、重复类型与冗余消除。
todos:
  - id: fix-review-flashcard-logic
    content: 修复 ReviewView 评分跳卡、useReviewQueue 时间非响应式与 keydown 监听器泄露，并提取 isDue 统一待复习判定
    status: completed
  - id: refactor-i18n-types
    content: 重构 types/index.ts 与 useI18n.ts 的 SkillI18n 类型，移除索引签名并补齐全部键，删除 DIFFICULTY_CHINESE 冗余
    status: completed
  - id: adapt-components-i18n
    content: 适配全部组件的 i18n prop 类型为 Required，移除模板硬编码兜底，清理 StatsView 色值/any 与 index.vue 冗余
    status: completed
    dependencies:
      - refactor-i18n-types
  - id: fix-storage-and-cleanup
    content: 修复 storage.ts 的 createCard 双重读取与 ID 冲突，删除 useSkillStorage 死代码，补齐 langLabel other 与 CardOption 导出
    status: completed
---

## 用户需求

对 `src/features/skillLearning` 功能按审查报告实施全部修复，共 14 项，覆盖三类问题：

**行为正确性与内存安全（P0）**

- 修复复习评分后因动态队列收缩导致「跳过下一张卡片」的逻辑漏洞
- 修复 `useReviewQueue` 中 `now` 非响应式导致到期卡片不刷新的问题
- 修复 `FlashcardView` / `ReviewView` 的 window keydown 监听器在 KeepAlive 整体卸载时残留的内存泄露

**类型安全与规范合规（P1）**

- 移除 `SkillI18n` 索引签名，显式声明全部翻译键，消除 `Required<SkillI18n>` 失效与 `any` 断言
- 移除模板中大量 `{{ t.xxx || '中文兜底' }}` 硬编码兜底（违反项目硬规则）
- 统一 `StatsView` 中重复硬编码的色值，删除难度标签 `DIFFICULTY_CHINESE` 冗余
- 用思源 `showMessage` 替换 `console.log` 实现删除成功与预设数据加载的用户反馈
- 修复 `createCard` 双重读取全量数据与同毫秒 ID 冲突

**死代码与冗余清理（P2）**

- 删除 `useSkillStorage.incrementPracticeCount` / `updateReviewData` 及连锁的 `SkillStorage.updateReviewData` 死代码
- 提取 `isDue` 纯函数统一「待复习」判定，消除 `useCardStats` 与 `useReviewQueue` 重复且不一致的逻辑
- 删除 `index.vue` 冗余的 `t` 包装、补齐 `langLabel` 的 other 映射、清理 `formatInterval` 不可达分支、导出 `CardOption`

## 技术栈

- Vue 3（`<script setup>` + Composition API）+ TypeScript
- 思源插件框架（`Plugin` 实例、`showMessage` 提示）
- 无新增依赖，完全复用现有项目模式

## 实现方案

### P0 行为正确性修复

1. **复习评分跳卡**：`ReviewView.rate()` 中评分当前卡片后，父组件异步更新 `reviewData` 会使当前卡片从 `dueCards` 移除、`queue` 缩短，此时 `queueIndex++` 会错位跳过下一张。改为评分后 `queueIndex.value = 0`，让被移除卡片后的下一张自动顶上。
2. **now 非响应式**：`useReviewQueue` 将 `Date.now()` 从 setup 阶段移入 `computed` 内部，使到期判定随计算重新求值。
3. **keydown 泄露**：在 `FlashcardView` / `ReviewView` 提取 `cleanup` 函数，`onDeactivated` 与 `onUnmounted` 共用同一清理逻辑，确保 KeepAlive 整体卸载时移除 window 监听器。

### i18n 类型系统重构

4. 在 `types/index.ts` 中删除 `SkillI18n` 的 `[key: string]: string | undefined` 索引签名，将 `useI18n.ts` 中 `DEFAULT_I18N` 用到的全部键（含 `aiGenerate`、`correct`、`incorrect`、`retry`、`viewCode`、`hideCode`、`nextQuestion`、`viewResult`、`quizScore`、`showDetails`、`hideDetails` 等缺失键）显式声明为可选字段。
5. 所有子组件 `i18n` prop 类型由 `SkillI18n` 改为 `Required<SkillI18n>`；模板去掉全部 `|| '中文兜底'`；`DifficultyBadge` 与 `StatsView` 中动态键访问 `i18n[difficulty]` 改为 `Record<Difficulty, keyof SkillI18n>` 显式映射；删除 `DIFFICULTY_CHINESE`（其内容已被 `DEFAULT_I18N` 的 beginner/intermediate/advanced 完全覆盖）。

### 存储与工具层修复

6. `createCard` 只调用一次 `getAllCards` 并内联标题唯一性检查（消除与 `isTitleUnique` 的重复读取）；ID 由 `skill-${now}` 改为 `skill-${now}-${随机后缀}` 规避同毫秒冲突。
7. `types/storage.ts` 的 `updateReviewData`、`useSkillStorage.ts` 的 `incrementPracticeCount` 与 `updateReviewData` 三处死代码删除（保留被 `incrementPracticeWithAccuracy` 内部使用的 `SkillStorage.incrementPracticeCount`）。
8. `utils.ts` 新增 `isDue(card, now)` 纯函数，`useCardStats.dueCount` 与 `useReviewQueue.dueCards` 共用；同时导出 `CardOption`。
9. `useLangLabel.ts` 的 `LANG_MAP` 补 `other: "Other"`。
10. `index.vue` 删除冗余 `t` 包装（模板直接使用 `fullI18n`），并用 `import { showMessage } from "siyuan"` 替换两处 `console.log`。

## 实现注意事项

- 不改动 `src/i18n/{zh_CN,en_US}/skillLearning.json` 翻译文本，仅改类型与模板兜底逻辑，避免影响 i18n 键对齐。
- 颜色值统一复用 `DIFFICULTY_COLORS` 常量与思源 CSS 变量（如 `var(--b3-theme-primary)`），消除 `StatsView` 模板与 `accuracyColor` 中的硬编码 hex 色值。
- 删除死代码前已通过搜索确认无其他调用点；`SkillStorage.incrementPracticeCount` 因被 `incrementPracticeWithAccuracy` 内部调用而保留。
- 所有修改遵守项目硬规则：if 花括号、SCSS 分离、文件头注释、禁止 any、禁止 i18n 硬编码兜底。
- 验证链由用户执行：`pnpm lint`、`npx tsc --noEmit`、`pnpm i18n:verify`。

## 目录结构

本次为局部修复，仅修改以下文件：

```
src/features/skillLearning/
├── index.vue                                    # [MODIFY] 删除冗余 t 包装，console.log 改 showMessage，模板改用 fullI18n
├── types/
│   ├── index.ts                                 # [MODIFY] 移除 SkillI18n 索引签名并补齐键，删除 DIFFICULTY_CHINESE，新增难度键映射类型
│   └── storage.ts                               # [MODIFY] createCard 内联唯一性检查+随机 ID，删除 updateReviewData 死代码
├── utils.ts                                     # [MODIFY] 新增 isDue 纯函数，导出 CardOption
├── composables/
│   ├── useReviewQueue.ts                        # [MODIFY] now 移入 computed，dueCards 改用 isDue
│   ├── useCardStats.ts                          # [MODIFY] dueCount 改用 isDue
│   ├── useSkillStorage.ts                       # [MODIFY] 删除 incrementPracticeCount 与 updateReviewData 死代码
│   ├── useLangLabel.ts                          # [MODIFY] LANG_MAP 补 other 映射
│   └── useI18n.ts                               # [MODIFY] DEFAULT_I18N 与 SkillI18n 接口对齐（键完整性）
└── components/
    ├── ReviewView.vue                           # [MODIFY] 评分跳卡修复、keydown 清理、去兜底、formatInterval 清理、prop 类型改 Required
    ├── FlashcardView.vue                        # [MODIFY] keydown 清理、去兜底、prop 类型改 Required
    ├── SkillListView.vue                        # [MODIFY] 去兜底、prop 类型改 Required
    ├── SkillDialog.vue                          # [MODIFY] 去兜底、prop 类型改 Required
    ├── StatsView.vue                            # [MODIFY] 去兜底+难度显式映射、复用色值常量、去 any、prop 类型改 Required
    ├── DifficultyBadge.vue                      # [MODIFY] 难度键显式映射、去 DIFFICULTY_CHINESE、prop 类型改 Required
    └── CategoryFilter.vue                       # [MODIFY] prop 类型改 Required
```