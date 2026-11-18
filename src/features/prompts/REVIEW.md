# prompts（提示词库）代码审查报告

审查对象：`src/features/prompts/`（19 个功能文件 + 2 个新增 spec + `utils.ts`）
依据：`AGENTS.md` / `AGENTS_API.md` / `AGENTS_BUILD.md` 强制规则
审查方式：只读审查 + 源码逐行核验（所有问题的"根因"均已对照实际代码确认）
审查结论：

- 注册链条 8 步齐全；跨功能零直接 import；存储/剪贴板/Modal/事件/定时器统一入口**全部合规**。
- **无真实内存泄露**：无定时器、无直接 DOM 监听、无无界缓存、无第三方实例；`watch`/`computed` 在 `<script setup>` 内随组件卸载自动停止。
- 发现 **12 个编号问题**（P1×2 / P2×6 / P3×4）+ 3 项资源/生命周期观察项，**均已在本次修复中落地**。
- 修复引入 2 个行为测试文件（14 个用例）+ 1 个迁移标记槽 + i18n 死键清理；全部 AI 允许的验证命令通过。

---

## 一、功能与数据流概览

| 环节 | 位置 | 说明 |
|---|---|---|
| 悬浮框入口 | `floatingBox/tools/prompts.ts` | 点击派发 `CUSTOM_EVENTS.OPEN_PROMPTS`（事件名单一来源 `@/utils/eventBus`） |
| 中心调度 | `App.vue:250` | `addWindowListener` 监听，带 `enablePrompts` 门控，调 `showPromptsModal(plugin)` |
| 公开 API | `prompts/index.ts` | `showPromptsModal`（async）：先 `await migrateOnce()`，再惰性创建 Modal、自挂载 `__promptsModal` |
| 主面板 | `prompts/index.vue` | 持有 UI 状态、数据层（usePrompts + useCategoryManager）、过滤/统计计算 |
| 子组件 | `PromptsGrid` / `CategorySidebar` / `PromptFormModal` / `CategoryManageModal` / `DeleteConfirmModal` | 网格、分类导航、表单、分类管理、删除确认 |
| 存储槽 | `siyuan-prompts` / `siyuan-categories` / `siyuan-skills`(legacy) / `siyuan-prompts-migration-v1`(marker) | `PluginStorage` + `TypedStorage`，均已在 `jsonSlots.ts` 登记 |
| 销毁链 | `src/index.ts` `DESTROYABLE_KEYS` → `onunload` 循环 | `__promptsModal.destroy()` 幂等销毁 |

---

## 二、问题主表（修复状态：全部 ✅ 已修复）

| ID | 现象 | 根因（文件:行） | 影响 | 修复方案 | 优先级 | 验证 |
|---|---|---|---|---|---|---|
| **P1-1** | 保存失败被静默吞掉，所有回滚 `catch` 与 `saveFailed` 提示是永不执行的死代码 | `utils/pluginStorage.ts:27-35`（save 失败 return false 不抛）；`usePrompts.ts:52/70/85`、`useCategoryManager.ts:74/89`（await 后依赖 throw） | 写盘失败时内存已改、UI 显示成功、刷新丢数据，用户无失败反馈 | 局部 `persistOrThrow`（storage.ts）+ composable 检查写入结果，回滚从死代码变为生效；**不改公共 save 语义** | P1 | `storage.spec.ts` / typecheck |
| **P1-2** | 删除成功无条件提示，即使未持久化 | `index.vue` confirmDelete：`await remove()` 后无条件 `showMessage(promptDeleted)` | 未写盘时仍提示"已删除"，用户失去重试机会 | `confirmDelete` 用 try/catch：仅成功提示 promptDeleted，失败提示 saveFailed 且保留弹窗 | P1 | typecheck |
| **P2-3** | 读-改-写未串行，违反存储规范 | `usePrompts.ts` / `useCategoryManager.ts` 直接改 ref 后整份 save，无队列 | 快速连续操作互相覆盖；违反 AGENTS.md 强制规则 | `PromptsStorage.runExclusive` 串行队列，composable 全部写操作包入 | P2 | `storage.spec.ts`（并发顺序 + 失败隔离） |
| **P2-4** | 一次性迁移每次打开面板都侦测 | `index.vue` onMounted → `loadPromptsWithMigration`（旧 key 回退 + 格式扫描每次跑） | 违反"禁止每次启动侦测"；save 失败被忽略导致迁移"看似完成" | 拆为纯 `loadPrompts()` + marker 守卫 `migrateOnce()`，用 `loadSafe()` 区分"键不存在/读取失败"，读取失败不落标记；由 `showPromptsModal` 显式 await | P2 | `storage.spec.ts`（3 个迁移分支） |
| **P2-5** | `as any` / `!` 非空断言滥用，i18n 缺失得 undefined | `useCategoryManager.ts:31-32`、`index.vue`、`PromptFormModal.vue`、`App.vue:251` | 分类名/提示文案变 undefined；`as any` 掩盖类型错误 | 定义 `PromptsI18n` 接口 + `DEFAULT_PROMPTS_I18N` 完整默认值 + `resolvePromptsI18n()`；全功能统一 t.xxx 访问；移除多余 `as any` | P2 | `utils.spec.ts` / typecheck |
| **P2-6** | 内置 `default` 分类可被删，产生孤儿状态 | `useCategoryManager.ts` 把 default 混进可删列表；`CategoryManageModal.vue` 删除只查占用 | 删空后新增表单回退到不存在的 id，数据/元数据失配 | manager 层分离内置分类（`categories` 仅用户态）+ `load` 过滤脏数据 + `remove` 拒绝内置；UI 层双重拦截；表单回退用 `PROMPTS_DEFAULT_CATEGORY_ID` | P2 | typecheck |
| **P2-7** | `handleSave` 过滤内容块两次 | `PromptFormModal.vue:283,293` | 校验与实际保存内容可能漂移 | 复用 `validContents.map()` 一次过滤 | P2 | typecheck |
| **P2-8** | ID 生成不统一且同毫秒冲突 | `PromptFormModal.vue:290`、`CategoryManageModal.vue:126` 用 `Date.now()`，内容块用另一套 | 同毫秒创建 id 冲突，`:key`/update/remove 命中错误条目 | 统一 `genId(prefix)`（crypto.randomUUID 优先 + 兜底），三处共用 | P2 | `utils.spec.ts`（200 个不重复） |
| **P3-9** | 空注册函数 `registerPrompts` 仍在调用链 | `prompts/index.ts:44-46`、`src/index.ts:290`、`features/index.ts` | 误导维护者；与 config-only 规范不一致 | 改 config-only：删除 register 定义/导出/调用，加入 `_ConfigOnly`，移出 `_Registered`；门控移到 App.vue 监听 | P3 | typecheck（编译断言链） |
| **P3-10** | i18n 死键 `edit` | `i18n/{zh_CN,en_US}/prompts.json:14` | 无效翻译条目，增加维护负担 | 删除两侧 `edit` 键，`pnpm i18n:merge` 重生成合并产物 | P3 | `i18n:verify` |
| **P3-11** | 重复类型 / 类型归属违规 | `PromptsGrid.vue` 定义 `PromptDisplay`、`usePrompts.ts`/`useCategoryManager.ts` 定义 manager 类型、同名 `DEFAULT_CATEGORY_COLOR` 跨功能异值 | 类型定义与构造分离易漂移；跨功能误 import 配色错乱 | `PromptDisplay`/`PromptsManager`/`CategoryManager` 上移 `types/index.ts`；website 侧常量改名 `WEBSITE_DEFAULT_CATEGORY_COLOR` | P3 | typecheck |
| **P3-12** | 魔法数字/字符串硬编码 | showMessage 时长、分类 id、`${color}20`、事件名、Modal 尺寸散落多处 | 修改需全局搜索，事件名两处硬编码易静默失效 | 抽 `MSG_DURATION` / `PROMPTS_*_CATEGORY_ID` / `withAlpha()` / `CUSTOM_EVENTS` / `PROMPTS_MODAL_SIZE` | P3 | typecheck / `utils.spec.ts` |

---

## 三、决策记录

### 决策 1：P1-1 修复路径（影响面分析）

`PluginStorage.save()` 失败只 `return false` 不抛，是全库公共契约，调用方分四类：显式 `if(!saved)`、`void save()`、裸 `await`、`.then(ok)`。三条候选：

- **A. 改 `PluginStorage.save()` 使其 rethrow** —— 波及全库 100+ 调用点，`gitPush` 迁移与 spec 失效。❌ 排除。
- **B. 新增公共 `saveOrThrow()`** —— 向后兼容，但需改 2 个公共核心文件 + 补测试，非最小。⚠️ 可行但非首选。
- **C. prompts 侧局部检查 boolean + `persistOrThrow`** ✅ —— 仅 prompts 目录，零跨功能回归；与 `AGENTS.md:249`、`websiteStorage.ts:155-204` 既有范式完全一致。**采用 C**。

### 决策 2：迁移时机

规范要求"一次性迁移由显式操作或 marker 守卫、禁止每次启动侦测、不得塞进初始化路径"。采用：迁移从 `load()` 剥离为 `migrateOnce()`，由 `showPromptsModal` 在打开弹窗前显式 `await`；marker + `loadSafe()` 保证"已迁移直接短路、读取失败不落标记下次重试"（照 `gitPush/types/storage.ts:690-737` 范式）。await 保证子组件加载的是迁移后数据，避免竞态。

### 决策 3：空注册函数归属

`registerPrompts` 本就是 no-op，改为 config-only（加入 `_ConfigOnly`、移出 `_Registered`），门控移到事件监听层。此项为**独立原子改动**，以 `pnpm typecheck` 为合并门禁（编译断言链 `features/index.ts:139-147`）。

---

## 四、资源与内存审查结论（无真实泄露）

| 检查项 | 结论 | 证据 |
|---|---|---|
| `setInterval`/`setTimeout` 未清理 | ✅ 无 | prompts 目录无定时器调用（`TimerRegistry` 亦未使用） |
| `addEventListener` 未移除 | ✅ 无 | 模板 `@keydown.escape` 随组件卸载自动解绑；无直接 DOM 监听 |
| `watch`/`computed` 未停止 | ✅ 无 | 均在 `<script setup>` 创建，随组件卸载自动停止 |
| 第三方实例 / 闭包持有大对象 / 无界缓存 | ✅ 无 | `modal` 单例关闭后置 null，`destroy()` 幂等 |
| 注释失实（已修） | `index.ts` 声称"persistent Modal 常驻"，实际未传 `persistent:true`，关闭即销毁 | 已改为"实例对象常驻、Vue app 随关闭销毁" |
| onMounted await 竞态（已修） | 异步加载完成写回已销毁组件 | 加 `onUnmounted` 置 `unmounted` 标志，await 后判断 |
| 数据无界增长（已修） | `growth:true` 但无上限 | `MAX_PROMPTS=500` / `MAX_CATEGORIES=100` 裁剪 + jsonSlots 备注 |

关于"内存泄露"：本次审查**确认不存在**，未为此引入任何清理逻辑（避免对不存在的问题过度设计）。

---

## 五、验证矩阵

| 阶段 | AI 可跑（已执行✅） | 用户必跑（AI 禁跑） |
|---|---|---|
| 类型检查 | `pnpm typecheck`（vue-tsc）✅ | — |
| 单元测试 | `pnpm test`（88 文件 / 1268 用例全绿）✅；新增 `storage.spec.ts` 8 例 + `utils.spec.ts` 6 例 | — |
| i18n | `pnpm i18n:merge` ✅、`pnpm i18n:verify`（5078 叶键对齐）✅ | — |
| 存储审计 | `pnpm audit:storage`（注册表与源码一致）✅ | — |
| 图标 | `pnpm validate:icons`（259 图标有效）✅ | — |
| 代码规范 | — | `pnpm lint` |
| 生产构建 | — | `pnpm vite build` / `pnpm build` |

> 类型检查严格使用 `pnpm typecheck`（vue-tsc），未用 `npx tsc`；未新建任何临时校验脚本，行为断言均落在 `src/**/*.spec.ts`。

---

## 六、改动文件清单

**功能内（prompts）**：`utils.ts`(新) / `utils.spec.ts`(新) / `types/index.ts` / `types/storage.ts` / `types/storage.spec.ts`(新) / `index.ts` / `index.vue` / `composables/usePrompts.ts` / `composables/useCategoryManager.ts` / `components/PromptFormModal.vue` / `components/CategoryManageModal.vue` / `components/PromptsGrid.vue` / `components/CategorySidebar.vue`

**跨功能/公共（最小必要）**：`utils/eventBus.ts`（事件名常量）、`utils/sharedStorage/websiteStorage.ts` + 2 个 websiteNavigation 组件（常量改名）、`config/storage/jsonSlots.ts`（marker 槽）、`features/index.ts` + `src/index.ts`（config-only）、`App.vue`（门控 + 事件常量 + 去 as any）、`floatingBox/tools/prompts.ts`（事件常量）、`i18n/{zh_CN,en_US}/prompts.json` + 合并产物（死键清理）

---

## 七、回滚指引

按原子性分组，各自可独立 revert：

1. **存储一致性组**（P1-1/P1-2/P2-3/P2-4）：`storage.ts` + 两个 composable + `index.vue` 的 confirmDelete/onMounted + `index.ts` 的 async 迁移 + `storage.spec.ts` + jsonSlots marker 槽。
2. **数据边界组**（P2-5~8）：类型上移、`resolvePromptsI18n`、内置分类分离、genId、validContents 复用 + `utils.spec.ts`。
3. **config-only 组**（P3-9）：`features/index.ts` + `src/index.ts` + `App.vue` 门控 —— 高风险，回退时须一并还原编译断言链。
4. **清理组**（P3-10~12）：i18n 死键、website 常量改名、注释修正 —— 各自独立。
