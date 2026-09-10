# 项目记忆

> 详细规则以仓库内 `AGENTS.md` / `AGENTS_*.md` 为准，此处仅保留跨会话需要的高频结论与踩坑经验。

## 编码规范偏好

- 统一入口原则：存储 `PluginStorage`/`TypedStorage`、Node 模块 `getNodeModules`、事件 `emitCustomEvent`、SQL `@/api`、剪贴板 `copyToClipboard`、定时器 `TimerRegistry`、AI `@/utils/aiApi`
- Vue emit 事件必须 camelCase；`if` 必须有花括号
- 新功能必须在 8 处注册（index.ts + types + features/index.ts + src/index.ts + settings + i18n + config + icons）
- i18n 只改分片 `src/i18n/{zh_CN,en_US}/<feature>.json`；顶层合并 JSON 由 `pnpm i18n:merge` 生成，**禁止手改**（`pnpm dev`/`build` 会自动合并）
- 图标优先思源内置或 `@iconify/vue`；**禁止 emoji 作图标**
- **独立窗体 UI 精简**（2026-08-24）：`addTab + openWindow` 浮动窗口中，页签标题已标识功能名，面板头部不再重复显示标题，用 `isFloating`（`getFrontend() === "desktop-window"`）+ `v-if="!isFloating"` 隐藏
- **快捷键占用核查**（2026-09-10）：必须**递归搜 `src/features/**`**——hotkey 也注册在 `features/<name>/types/index.ts`（video ⌃⌥V、formatAssistant ⌃⌥G、superPanel ⌃⌥P）。`ICommand.hotkey?` 可选，不写则仅作命令面板入口、不占快捷键

## 代码风格硬规则

- 单文件行数：300 行警戒、500 行硬阈值、≥1000 必须重构
- SCSS 必须从 `.vue` 提取到独立文件；`.ts`/`.vue` 顶部必须有 10~30 字功能注释
- 模块内分层：共享常量 → `types/index.ts`，纯工具函数 → `utils.ts`，禁止复制粘贴
- 禁止硬编码 font-size/font-weight/line-height/颜色，用设计 Token；颜色统一 `$color-*`（旧 `$brand-*` 已删除）
- **共享组件库使用规则**（2026-09-10，见 `AGENTS.md`）：①先查用法禁猜 props（组件预览面板 / `previewData/*.ts` / 组件源码 `interface Props`），图标只能传已注册 `IconKey`，尺寸档位 `xsmall/small/medium/large`（默认 small）；②优先复用，12 类控件（按钮/输入框/下拉/开关/滑块/标签/徽标/头像/卡片/图表/图标/加载态）禁止 feature 自建；缺能力**先扩展共享组件**（加可选 props 保持向后兼容）；例外仅纯展示布局容器与无档位 26×26 `.icon-btn`；③改组件 API 必须同轮同步 `previewData/*.ts`（props 与 code 一致）+ `componentPreview/README.md`。`src/components/` 共 14 个组件
- **`slots` 不是响应式**（Vue 3.5.40 源码级证据）：`computed(() => !slots.default && ...)` 不会因插槽增删重算，而模板 `v-if="$slots.default"` 是渲染期实时读取 → 两者会不一致。需跟随插槽变化的派生值必须用普通函数或直接读 `$slots`
- **共享 `<Button>` 约定**：颜色轴 `variant`/`severity` × 外观轴 `outlined`/`text`。既有 5 个 variant 语义**不可改**（`danger`=描边红、`ghost`=中性纯文本）；新能力走 `--severity-*`/`--outlined`/`--text`，颜色族经 `--btn-color` 等 CSS 变量传递。纯图标按钮必须给 `aria-label`/`title`；loading 用 `visibility: hidden` 保宽；图标随 size 档位 12/14/16/18。细则见 `AGENTS_STYLE.md`
- **焦点环别复用 `focus-ring` mixin**：它只改 `border-color`，实底按钮 border 为 `transparent` → 焦点不可见。实底控件用 `outline: 2px solid var(--b3-theme-primary); outline-offset: 1px`
- **间距 Token 映射**：4/8/12/16/20/24px 为全局档；2px=`$spacing-2px`、3px=`$spacing-px`、6px=`m.$gap-xs`、10px=`m.$spacing-2_5`；**14px/18px 无 Token**，硬编码并加注释
- **组件 size 档位字号阶梯**：`xsmall/small/medium/large` = `$font-size-2xs/xs/sm/base` = 10/12/14/16px，四档禁止同号；仅限组件库档位变体，feature 业务样式不得据此降到 10px

## 重构模式（已验证可复用）

- 巨型文件拆分：Manager 类独立文件 + composable 按领域拆分 + 子组件提取
- 样式合规：硬编码值→设计 Token、box-shadow→border、SCSS 提取
- 冗余消除：公共函数提取、watch 合并、computed 预计算映射
- 响应式布局：纯 CSS flex-wrap 替代 JS 监听
- **重构 import 来源必须同轮全量切换**（否则 build 报 MISSING_EXPORT）
- **非 deep watch 对原地 splice 数组引用永不触发**
- composable 依赖定义顺序冲突时用惰性 getter `() => x.value` 注入规避 TDZ
- feature 内常量若被 composable 运行时引用，不能放 `types/index.ts`（会与面板形成循环），拆独立文件（如 `types/size.ts`）
- PowerShell 读文件必须显式 `-Encoding UTF8`（工具会拦截未指定编码的 `Get-Content`）；跨语言校验 JSON 用 `node JSON.parse`（`ConvertFrom-Json` 按 GBK 读 UTF-8 会误报）

## 功能模块状态

- **aiContentGenerator（2026-09-10 共享组件合规改造完成）**：删除自建 `SvgIcon.vue`、`registerIcons()`（自定义 `#iconColumns` sprite）；30 处内联 `<svg><use>` 全部改 `IconWrapper`+`IconKey`；原生 `<select>/<input>/checkbox>` 改 `Select/Input/Switch`；13 处自建 `<button>` 改 `Button`（仅 `CollapsibleSection` 折叠头保留并补 aria）；62 处硬编码中文 i18n 化（分片 26→90 键）；抽出 `ResultActionsBar.vue`（MainContentArea 375→281 行）。**扩展了共享 `Select`**：新增 `#selected` 作用域插槽 + `SelectOption.keywords`（均已同步 previewData/README）。合规例外：`ReviewRadarChart.vue` 自建 SVG 雷达图（共享 `Chart.vue` 不支持 radar）。审查报告：`docs/ai-content-generator-component-audit.md`
- gitPush StatsView（2026-09-07）：瀑布流 → 区块卡片化 + 自适应网格（`.gp-stats-grid`，表格区块 `--full` 全宽）；总览卡升级语义色图标块三段式（新增 `--gp-accent-lightest`）。经验：surface 卡片化后原 surface 对比元素（行 hover/条形轨道）需改 theme-background 或语义 lightest 色
- gitPush：多本地路径配置、响应式双列、commit log 数量选择；历史重写已 fast-import 化（`GitExecutor.execGitStreaming` + `FastImportRewriter` + `historyRewritePlan` 共享类型 + `HistoryRewriter.buildPlan`，临时 ref `refs/gprw/<branch>` + CAS 切回；拒绝 fast-export 增量模型因 drop 会引入冲突；drop 根提交改为显式报错）
- gitPush 提交规则检查共 14 条（2026-09-07）：原 7 条 + 4 条格式规则 + 3 条可选规则（`subjectNotCapitalized`/`wipSubject`/`bodyLineTooLong`），默认全开、设置弹窗可单独关闭。架构：`checkCommitRule(msg, config = DEFAULT_COMMIT_RULE_CONFIG)` 可选参数向后兼容；`CommitRuleConfig` 5 字段；持久化 `ruleCheckPrefs` 全 `?` 可选，读取统一走 `meta.ts` 的 `readCommitRuleConfig(prefs)`；`useCommitAnalysis` 用整对象 ref + `updateCommitRuleConfig(patch)`；`normalizeCommitMessageFormat(trimmed, config)` 仅规范化标题行（type 小写/scope 规范化/去句号），正文原样保留，结果终验失败才降级启发式
- S3 备份：直接上传模式（无 zip 打包），状态栏集成。2026-09-09 审查修复 6 阶段：双日期 key（`buildBackupUploadKey`）、ZIP 失败 pipeline 化写盘（`.part` 兜底）、互斥「进入即置位」、日志落盘 catch + busy 节流、manifest/扫描失败补日志；拆分 `index.vue` 855→228（`BackupTab` + `useBackupOrchestrator`）、`BackupManager` 510→392、`FileChecksumsCard` 421→63；`instance.ts` 断开循环依赖（工作区路径唯一事实源 = `useWorkspaceSettings.workspaceRoot`）
- S3 增量实验 Tab（2026-09-09）：增量备份/还原入口迁至第五个「增量」Tab（实验性 badge）；删除阶段并发+重试+失败回填 manifest（消除永久孤儿）、还原不安全路径过滤计数上报、非桌面端显式提示。新增 `useIncrementalPanel`
- toolCollection：底部面板 + Tab 切换，首个工具 base64Image
- statistics 分布 Tab（2026-09-08）：移除「各笔记本块类型分布」堆叠图与「各笔记本文档数」柱状图；最终为单列纵向流（汇总栏 → 排行表格 → 字数饼图）。`BLOCK_TYPE_LABELS` 与 `blockType*` i18n 键仍被 baseStats 使用，**勿删**
- compactMode：3 档密度 + 5 档字号 + 5 区域开关
- skillLearning：代码片段练习库 + 闪卡记忆
- componentPreview（2026-09-10）：addTab+openWindow 展示 14 个共享组件用法快照 + 可复制代码。`PreviewGroup.sizeable` 标记 11 个支持 size 的组件，`resolveProps` 只向**未显式指定 size** 的示例注入全局档位。经验：`Select/Input/Slider` 的 `containerAttrs` 会剥离 class/style，预览不能靠 props 传 style 控宽；Loader `height:100%` 需父容器显式高度；**不绑定默认快捷键**（⌃⌥V 已被 video 占用）；已集成到底部状态栏功能列表

## 禁止事项

- 禁止私自执行 `dotnet build`（太慢太卡）
- 禁止执行 `pnpm vite build` 和 `pnpm lint`（用户自行验证）
- 禁止跨 feature 直接导入（必须通过事件总线 + App.vue 调度）
