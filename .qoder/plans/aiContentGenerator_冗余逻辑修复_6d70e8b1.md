# aiContentGenerator 冗余与逻辑冲突修复

## 摘要

模块整体分层合理（composables 拆分清晰），但存在 8 处已验证的逻辑冲突与一批死代码。本计划按「逻辑修复 → 冗余清理 → 性能作用域 → 契约一致性」四组推进，全部改动限定在 `src/features/aiContentGenerator/` 内。

## 一、逻辑冲突修复（P0）

### 1.1 思考强度事件断链（确认 Bug）
- `components/BottomInputArea.vue` L119 emit `update:reasoningEffort`，但 `index.vue` 的 BottomInputArea 未绑定 → UI 修改无效
- **修复**：`index.vue` 模板 BottomInputArea 上补 `@update:reasoningEffort="reasoningEffort = $event"`

### 1.2 provider 非响应式导致模型列表缓存错误
- `composables/useGeneration.ts` L72-74 `computed(() => (plugin as any).settings.aiApiProvider)` 读非响应式对象，首评后永久缓存（settings 异步加载，Dock 挂载时通常未就绪）
- **修复**：`useGeneration` 内改为 `providerRef = ref<string>("tongyi")` + 暴露 `refreshProvider()`（读取 `plugin.settings?.aiApiProvider`）；`availableModels` 依赖该 ref
- `index.vue` onMounted 调用一次 `refreshProvider()`，并监听全局 `settingsUpdated` 事件刷新（参照 `statusBar/index.vue` L528 既有模式），onUnmounted 移除监听

### 1.3 中止/失败后误触发审核
- `useGeneration.executeGeneration` finally 无条件调 `onAfterGenerate` → 用户停止或出错后仍对残缺内容审核
- **修复**：catch 分支标记 `failed = true`（含 AbortError 路径），finally 中 `if (!failed && !skipReview)` 才触发审核

### 1.4 审核请求丢失真实编辑指令
- `handleCustomEdit` 的 `onSuccess` 先清空 `editCustomInput`，随后 `performReview` 读取它 → 永远回退到"对文档xxx进行编辑"
- **修复**：`executeGeneration` 增加可选参数 `reviewUserRequest?: string` 透传给 `onAfterGenerate`；`useReview.performReview(override?: string)` 优先使用 override；`handleCustomEdit` 传入执行前的 `editCustomInput.value`，`aiEditAction` 传入对应动作描述

### 1.5 issues 与 suggestions 索引错误对齐
- `useReview.handleFixIssue` L162 `suggestions[issueIndex]` 假设两数组对齐（AI 独立返回，不成立）
- **修复**：移除 suggestion 关联，fixInstruction 仅使用 issue 自身的 description/severity

### 1.6 执行按钮可用性与校验矛盾
- `BottomInputArea.canExecute`：有技能即 true；`index.vue handleCustomEdit`：无文档时必须有输入 → 按钮可点但点击被拒
- **修复**：统一 `canExecute` 语义——有文档时（技能在 或 输入非空）可执行；无文档时必须有技能且输入非空；handler 校验保留为防御

### 1.7 「清除」状态残留
- `useEditOperations.clearContent` 不清 `reasoningContent`/`searchStatus`/`searchResults`/`generationTip`/`reviewResult` → 有思考内容时清除后容器仍渲染
- **修复**：`useGeneration` 暴露 `clearDisplayState()`（清 reasoning/search/tip 展示态）；`useReview` 暴露 `clearReviewState()`（清 reviewResult/isAutoFixing/autoFixCount）；`index.vue` 的 `@clear` 改为组合调用三者

### 1.8 自动修复上限失效
- `useReview.handleAutoFix`：超限后 `autoFixCount = 0` 重置 → 上限形同虚设；计数跨审核周期不复位；超限分支设 `isAutoFixing = false`（此前未置 true）
- **修复**：先判 `>= MAX_AUTO_FIX_ITERATIONS` 则提示并 return（不重置、不动 isAutoFixing）；通过后再自增；`performReview` 完成新一轮审核时重置 `autoFixCount = 0`

## 二、冗余清理（P1）

- **`useReview.ts`**：删除只写不读的 `fixHistory`/`FixEntry`/`recordFixEntry`（未对外暴露、无消费者）；删除死检查 `if (!onReview) return`（onReview 为必选 dep）；连带删除 handleAutoFix/handleFixIssue 中仅为 recordFixEntry 服务的 `ratingBefore`
- **`index.vue`**：删除 `props.onReview || async fallback` 冗余兜底（`modules/AIContentGenerator.ts` addDock 始终提供 onReview）；`withDefaults(defineProps<Props>(), {})` 简化为 `defineProps<Props>()`
- **`types/storage.ts` + `index.vue`**：删除 `AIGeneratorStorage.init()` 的冗余默认值写入（TypedStorage 已兜底），连同 index.vue onMounted 中的 `await storage.value.init()` 调用
- **`useEditOperations.ts`**：返回值收敛，不再对外暴露无消费者的 `editHistoryStack` 与 `clearEditState`（保留内部实现）
- **`useSkillsLoader.ts`**：`restoreSkillById` 返回值无消费者，改为 `void`
- **`index.vue aiEditAction`**：`DEFAULT_SYSTEM_PROMPTS.polish` 复用于全部 6 个快捷动作属有意为之（实际指令在 userInput），补一行注释说明，不改行为

## 三、性能与作用域（P2）

- `index.vue applyCodeHighlighting` 当前用全局 `document.querySelectorAll(".markdown-preview pre code")`，会误伤 Teleport 到 body 的 SkillPreviewModal 及其他组件，且流式期间每帧全量重扫
- **修复**：给面板根 div 加模板 ref，高亮查询限定在面板根内（`.markdown-preview pre code` 作用域查询），保留 `dataset.highlighted` 跳过已高亮块的既有判断

## 四、契约一致性（P1）

- `scanSkills` Props 声明为必选，但 `AIContentGenerator.addDock` 仅在注入时条件透传 → 契约不一致
- **修复**：`index.vue` Props 改 `scanSkills?: ...`；`useSkillsLoader` 对 undefined 防御（skills 置空直接返回）；modules 侧条件透传保持不变
- `enableReview` 未持久化（其余设置项均持久化，行为不一致）
- **修复**：`types/storage.ts AISettings` 增加 `enableReview: boolean`（默认 false）；`index.vue` saveSettings/loadSettings/watch 列表纳入 enableReview

## 依赖关系

1.1~1.8 相互独立，可并行实施；1.3/1.4 同改 `executeGeneration` 签名需合并处理。第二、四组依赖第一组的 useReview/useGeneration 接口变更后再做。第三组独立。

## 测试计划（由用户执行验证链条）

```bash
npx tsc --noEmit    # 类型检查（AI 可执行）
pnpm i18n:verify    # 本计划不改 i18n，预期无变化（AI 可执行）
pnpm lint / pnpm build  # 用户自行执行
```
手工验证要点：思考强度下拉切换生效、超级面板改 provider 后模型列表刷新、停止生成不触发审核、清除按钮后无任何残留区块、自动修复 2 次后第 3 次提示上限且新审核后可重新计数。

## 已否决的替代方案

- **全量 i18n 化**（BottomInputArea/MainContentArea/ContentAreaEmpty 的硬编码中文）：改动面大、与"冗余/逻辑冲突"主题无关，仅 ReviewPanel 已 i18n 化，保持现状
- **更换 RAF 流式缓冲架构**：现有 generatedContent/displayedContent 双轨设计合理，不动
- **TOOL_META 提取为共享常量**：会违反"功能间零直接导入"规则，本地投影是有意设计，保留
- **hljs 按需加载**：属全项目构建策略问题，非本模块审查范围
- **insertSubDocument 的"总结"后缀命名**：用户可见行为，避免擅自改动