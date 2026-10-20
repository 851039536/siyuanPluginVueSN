# Skills 查看器并入 aiContentGenerator 合并评审与冗余审查

> 日期：2026-02-20
> 范围：`src/features/skillsViewer/` → `src/features/aiContentGenerator/skills/`（彻底并入）
> 决策确认：交付「审查报告 + 实施合并」；删除 skillsViewer 独立功能身份（设置开关 / FEATURE_CONFIG /
> 状态栏 / 超级面板入口），管理弹窗从 aiContentGenerator 技能区「管理」按钮打开，斜杠命令归属 aiContentGenerator。

## 一、合并动机与结论

skillsViewer（技能文件管理）与 aiContentGenerator（技能消费方）长期以「跨 Feature 依赖注入」桥接，
导致一套技能数据结构维护三份、扫描 API 绕行注入、技能内容 Markdown 渲染出现安全分歧。
合并后：

- 扫描/管理/消费收敛为同一模块内部协作，DI 桥与投影类型整层删除；
- 技能内容渲染统一到 XSS 安全路径（修复了 SkillCard 的裸 `parseMarkdown` 注入面）；
- skillsViewer 的独立功能身份（开关/入口/图标/别名/文档）全部移除。

## 二、迁移映射（git mv 保留历史）

| 原路径 | 新路径 | 备注 |
| --- | --- | --- |
| `skillsViewer/types/SkillsViewerManager.ts` | `skills/SkillsManager.ts` | 类改名 `SkillsManager`；新增 `resolveSkillDir` / `resolveDir` / `firstGlobalSkillDir` |
| `skillsViewer/composables/useSkillsViewer.ts` | `skills/composables/useSkillsManager.ts` | 改名；去掉 `getNodeModules` 依赖与自建工具色/名 Map |
| `skillsViewer/index.vue` | `skills/components/SkillsManagerDialog.vue` | 避免与模块 `index.vue` 撞名 |
| `skillsViewer/components/*`（3 个） | `skills/components/` | SkillCard 同步修 R3/R4 |
| `skillsViewer/styles/*`（5 个） | `skills/styles/` | 原样迁移 |
| `skillsViewer/state.ts` | `skills/state.ts` | 改名 `skillsManagerVisible` / `showSkillsManager` / `hideSkillsManager` |
| `skillsViewer/index.ts` | `skills/index.ts` | `registerSkillsManager(plugin)` + `scanSkills()`（模块内共享） |
| `skillsViewer/utils.ts` | **删除** | R3（本地 `formatFileSize` 为冗余实现） |
| `skillsViewer/types/index.ts` | **删除** | R5（re-export 垫片） |
| `skillsViewer/README.md` | **删除** | 内容并入 `aiContentGenerator/README.md` |

## 三、冗余审查清单与整改

| 编号 | 证据 | 问题 | 整改 |
| --- | --- | --- | --- |
| R1 | `src/index.ts:225`、`modules/AIContentGenerator.ts:74-108`、`useSkillsLoader.ts:17-20` | 跨 Feature 依赖注入桥：`scanSkills` 经 `registerAIContentGenerator(plugin, { scanSkills })` 注入，仅为规避跨 Feature 导入 | ✅ `registerAIContentGenerator(plugin)` 单参；`ScanSkillsFn`/注入链删除；`useSkillsLoader` 直连 `skills/scanSkills` |
| R2 | `aiContentGenerator/types/index.ts:12-21`、`SkillsViewerManager.ts:10`、`src/types/ai.ts:96` | 三套技能结构 `SkillInfo`/`SkillScanEntry`/`SkillItem`，注释要求消费方同步 fileSize 防漂移 | ✅ `SkillScanEntry` 删除；`toSkillItem(entry: SkillInfo)` 直取原始结构；仅保留 `SkillInfo`（扫描）+ `SkillItem`（展示/去重）两层 |
| R3 | `skillsViewer/utils.ts:6` vs `src/utils/format.ts:10` | `formatFileSize` 重复实现（本地 1 位小数 vs 共享 2 位） | ✅ 删除本地版，SkillCard 用共享 `@/utils/format`；**显示格式由「1.0 KB」变为「1.00 KB」**（有意接受） |
| R4 | `SkillCard.vue:162-170`（原）vs `aiContentGenerator/utils.ts:38` | 技能内容 Markdown 双渲染路径，SkillCard 走裸 `parseMarkdown` **无 XSS 转义**（skill.md 为外部文件） | ✅ SkillCard 改用模块 `renderMarkdown(content, false)`，与 SkillPreviewModal 同源；**行为变化：skill.md 中原始 HTML 现显示为转义文本（安全预期）** |
| R5 | `skillsViewer/types/index.ts` | re-export 垫片（含 `@/config/aiTools` 的转发），`SkillInfo` 定义在 Manager 类文件 | ✅ 垫片删除；消费方直连 `@/config/aiTools`；`SkillInfo` 随 `SkillsManager.ts` 迁移 |
| R6 | `useSkillsViewer.ts:65-70`、`CopySkillModal.vue:95-97`、`aiContentGenerator/utils.ts:78` | `toolColorMap`/`toolNameMap` 三处各自构建 | ✅ `@/config/aiTools` 新增 `getAITool(id)` 统一查询；三处收敛 |
| R7 | `vite.config.ts:100`、`tsconfig.json:47` | `@skillsViewer` 别名目标目录消失（悬空） | ✅ 删除 `@skillsViewer`（vite+tsconfig+AGENTS_API.md 清单同步）。**`@aiContentGenerator` 保留**：项目约定每个功能模块均登记别名（AGENTS_API.md「强制规则」），该模块目录仍存在，删除反而违反约定 |
| R8 | `superPanel.json:81-82`（中英）、`features/config.ts:213-216` | 「Skills 查看器 / 查看和管理…」文案双份维护（superPanel 分片 + FEATURE_CONFIG 默认文案） | ✅ 随功能身份移除一并删除；`pnpm i18n:merge` 重生成合并产物 |
| R9 | `skills/styles/_modal.scss`、3 个自建 Teleport overlay + `SkillPreviewModal.vue` | 4 处自建弹窗壳 vs 共享 `Dialog.vue`/`ConfirmPopup`（`docs/shared-component-usage-audit.md` 已登记） | ⏸ **本轮不做**：无目视回归条件，迁移有 UI 回归风险。遗留待办（见 §六） |
| R10 | `useSkillsViewer.ts:7` vs `SkillsViewerManager.ts:29-41` | `getNodeModules()` 与 Manager 内部 `window.require` 两套 fs/path 获取 | ✅ Manager 暴露 `resolveSkillDir`/`resolveDir`/`firstGlobalSkillDir`；composable 去掉 `getNodeModules` |

### 非冗余、有意保留（异形态不合并）

- `SkillCard` 展开内容 vs `SkillPreviewModal`：行内展开与模态预览是不同形态，仅统一渲染来源（R4）。
- `useSkillsLoader` 的 projectPath 自动推导（`plugin.dataPath` 去 `/data`）vs 弹窗内的项目路径手输框：
  生成侧自动、管理侧手动，语义不同。
- `skillsViewer.json` i18n 分片与命名空间 `plugin.i18n.skillsViewer` **保留**：
  扁平合并会与 `aiContentGenerator.json` 的通用键（`title`/`desc`/`cancel` 等）碰撞；
  键名不属于功能身份，改名列入可选待办。

## 四、功能身份与入口移除（用户可见变化）

| 位置 | 移除内容 |
| --- | --- |
| `src/config/settings.ts` | `enableSkillsViewer` 字段与默认值（持久化 `feature-flags.json` 中旧键为惰性残留，load 时被忽略） |
| `src/features/config.ts` | `FEATURE_CONFIG` 的 skillsViewer 条目（`FeatureId` 联合类型自动收缩，设置页/超级面板开关随之消失） |
| `src/features/statusBar/featureRegistry.ts` | `DRAWER_FEATURE_IDS` / `SHORTCUT_ICONS` / `FEATURE_EVENTS` 三处登记 |
| `src/components/kit/icons.ts` | `FEATURE_ICONS.skillsViewer` |
| `src/App.vue` | `enableSkillsViewer` 门控、`openSkillsViewer` window 监听（状态栏事件无派发方） |
| `src/features/index.ts` | barrel 导出与 `_Registered` 白名单项 |
| `src/index.ts` | `registerSkillsViewer` 注册与 `scanSkills` 注入 |
| i18n | `superPanel.json`（中英）`skillsViewer`/`skillsViewerDesc` 两键 |

新增入口：`SkillSection.vue`「管理技能」纯图标按钮（`Button` + `aria-label`，i18n 键 `manageSkills`）；
面板在弹窗关闭后自动 `loadSkills()` 并按 id 恢复原选择（`index.vue` 新增 watch）。

**边界**：`enableAIContentGenerator=false` 时无 dock、无命令、无管理入口（彻底并入的既定取舍）。

## 五、验证结果

| 检查 | 结果 |
| --- | --- |
| `npx tsc --noEmit` | ✅ 0 错误（顺带修复 1 个**存量**错误：`imageCreation/useCodeImageGenerator.ts` 从 `*.vue` shim 导入 `SelectOption` 改为 `@/components/select/types`，与本合并无关但阻塞门禁） |
| `pnpm test` | ✅ 40 文件 686 用例全过（含新增 `skills/SkillsManager.spec.ts` 6 用例：parseSkillMd 5 + toSkillItem 1） |
| `pnpm i18n:verify` | ✅ 4627 叶子键中英对齐；合并产物已重生成 |
| `pnpm validate:icons` | ✅ 图标注册有效 |
| `pnpm lint` | ⚠️ 仓库存量红：HEAD 基线 9508 errors（大量可 `--fix` 的风格债）。本变更不新增错误（新建/重写文件 0 errors，迁移文件带原债），净 delta ≤ 0 |
| 全仓引用检查 | ✅ `features/skillsViewer` 无活引用；`@skillsViewer` 别名无残留 |

## 六、遗留待办

1. **R9 弹窗基座迁移**：4 个自建 overlay（SkillsManagerDialog / DeleteConfirmModal / CopySkillModal /
   SkillPreviewModal）迁共享 `Dialog.vue`/`ConfirmPopup`。需目视回归条件，迁移时注意
   `_modal.scss` 基座的间距/标题虚线等视觉细节与共享组件的差异。
2. **i18n 命名空间改名（可选）**：`skillsViewer.json` 分片与 `plugin.i18n.skillsViewer` 命名空间保留原名，
   如需彻底去 skillsViewer 痕迹，需同步改分片内容顶层键 + `useSkillsManager` 的取值路径。
3. **仓库 lint 存量债**：9508 errors 与本变更无关，建议单独一轮 `eslint --fix` + 人工复核。
4. `skills/styles/*` 文件头部注释仍含「SkillsViewer」字样（纯注释，不影响行为）。

## 七、公共 API / 配置面变更速查

- `registerAIContentGenerator(plugin, options?)` → `registerAIContentGenerator(plugin)`（`ScanSkillsFn` 删除）
- `@/features` barrel：删 `registerSkillsViewer`/`scanSkills`/`SkillInfo`/`skillsViewerVisible`/`hideSkillsViewer`；
  增 `skillsManagerVisible`/`hideSkillsManager`
- `PluginSettings`：删 `enableSkillsViewer`
- `FeatureId` / `FEATURE_ICONS`：少 `skillsViewer` 一项（编译期断言链校验一致）
- `@/config/aiTools`：增 `getAITool(id)`
