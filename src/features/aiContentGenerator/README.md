# AI 内容生成

使用 AI（支持自定义 API）生成 Markdown 格式内容。注册为右侧边栏 Dock 面板，支持自定义对话配置和上下文管理，生成的 AI 内容可直接插入笔记中。

## 目录结构

```
aiContentGenerator/
├── index.ts                  # registerAIContentGenerator(plugin) — 功能注册入口（含 skills 命令注册）
├── index.vue                 # Dock 面板编排层（注入 i18n，衔接生成/审核/编辑操作）
├── utils.ts                  # 纯工具函数（Markdown 渲染与转换、技能提示词构建等）
├── modules/
│   └── AIContentGenerator.ts # Dock 注册 + AI 生成/交叉审核调用（走 @/utils/aiApi）
├── skills/                   # Skills 管理子模块（原 skillsViewer 功能，2026-02 并入）
│   ├── SkillsManager.ts      # SkillsManager 类 + SkillInfo：扫描/解析/CRUD（fs 能力封装）
│   ├── SkillsManager.spec.ts # parseSkillMd / toSkillItem 单测
│   ├── index.ts              # registerSkillsManager（addCommand）+ scanSkills（模块内共享）
│   ├── state.ts              # 弹窗可见性 ref + show/hide
│   ├── composables/useSkillsManager.ts # 弹窗全部状态与 CRUD 逻辑（filePath 稳定标识）
│   ├── components/
│   │   ├── SkillsManagerDialog.vue # 主弹窗（App.vue 挂载，Teleport 到 body）
│   │   ├── SkillCard.vue     # 单 Skill 卡片（展示/编辑/展开）
│   │   ├── DeleteConfirmModal.vue  # 删除确认弹窗
│   │   └── CopySkillModal.vue      # 复制到其他工具弹窗
│   └── styles/               # 弹窗/卡片/弹窗基座样式
├── composables/              # 视图逻辑：生成 / 审核 / 编辑操作 / 文档目标 / 技能加载
├── types/
│   ├── index.ts              # 类型 + 共享常量（ACTION_META / DEFAULT_SYSTEM_PROMPTS 等）
│   └── storage.ts            # TypedStorage 槽位
├── components/               # 展示层子组件
│   ├── MainContentArea.vue   # 主内容区：加载/错误/空态、预览·对比·审查三视图
│   ├── ResultActionsBar.vue  # 生成结果操作栏（停止/应用/插入子文档/撤回/复制/直接审查/清空对话/清除）
│   ├── BottomInputArea.vue   # 底部输入区：文档与块选择、技能、快捷动作、模型与开关、自定义输入
│   ├── SkillSection.vue      # 技能选择（共享 Select + filterable）+「管理技能」入口
│   ├── SkillPreviewModal.vue # 技能细则预览弹窗
│   ├── DiffPreview.vue       # 原文/新文差异视图（vue-diff）
│   ├── ReviewPanel.vue       # 交叉审核面板：分项评分 / 严重度过滤 / 问题清单 / 自动修复
│   ├── ReviewRadarChart.vue  # 分项评分雷达图（自建 SVG，见下方说明）
│   ├── CollapsibleSection.vue# 通用可折叠区块（模块内复用）
│   ├── ReasoningSection.vue  # 思考过程折叠区块
│   ├── SearchResultsSection.vue # 联网搜索来源折叠区块
│   └── ContentAreaEmpty.vue  # 空状态三步引导
└── styles/                   # SCSS（样式强制从 .vue 提取）
    ├── index.scss            # 仅 mixin 与 @keyframes：跨组件共享的 mixin（不发射任何规则）
    ├── _shell.scss           # 面板壳层规则，仅 index.vue 引入一次
    └── <Component>.scss      # 各组件专属样式
```

### Skills 管理子模块（原 skillsViewer）

原独立功能「Skills 查看器」已整体并入本模块（评审记录见
`docs/ai-content-generator-skills-merge-review.md`）：

- **入口**：斜杠命令「Skills 查看器」由 `registerAIContentGenerator` 一并注册；
  面板技能选择区的「管理技能」按钮（`SkillSection.vue`）也可打开管理弹窗。
  弹窗关闭后 `index.vue` 自动刷新技能列表并尽量保持原选择。
- **路径作用域**（单一数据源 `@/config/aiTools`，按 `AIToolConfig` 三类相对路径派生）：
  - `skillPaths`：全局，基于用户主目录；
  - `projectPaths`：项目级，基于弹窗内「项目路径」输入；
  - `workspacePaths`：**思源工作区**（`workspaceDir` 下），含 `data/storage/ai/agent/skills`，
    与项目路径输入无关、始终扫描；工作区根经 `@/utils/workspaceDir` 的 `readWorkspaceDir()` 解析
    （`window.siyuan.config.system.workspaceDir`，getConf 回退）。
  - 复制 Skill 的目标作用域沿用「来源作用域优先、无登记路径顺延」，工作区技能视为 global 桶。
- **扫描**：`skills/index.ts` 的 `scanSkills()` 为模块内 API（`useSkillsLoader` 直连），
  不再走跨 Feature 依赖注入；`SkillInfo` 是扫描原始结构，`SkillItem`（`@/types/ai`）
  是展示/去重结构，经 `types/index.ts` 的 `toSkillItem` 转换。
- **稳定标识**：列表 key 与编辑/删除/复制目标均使用 `skill.filePath`，禁止回退到数组索引。
- **Markdown 渲染**：SkillCard 展开内容与 SkillPreviewModal 同用 `utils.ts` 的
  `renderMarkdown`（XSS 安全版，转义 skill.md 中的原始 HTML），禁止再引裸 `parseMarkdown`；
  展开内容排版统一 `@include markdown-preview`，不再自建 Markdown 样式副本。
- **UI 约定**：查看器弹窗与两个确认弹窗、技能预览弹窗外壳全部复用共享 `Dialog`（宽度经
  `--si-dialog-width` 变量保持原尺寸）；按钮/输入/加载态消费共享 `Button`/`Input`/`Loader`，
  纯图标按钮必给 `aria-label`；可点选的卡片/选项按 `role="button"` + `tabindex` + Enter/空格可达。
- **文件大小**：用共享 `@/utils/format` 的 `formatFileSize`，模块内不再自建。
- **i18n**：弹窗文案仍在 `src/i18n/{zh_CN,en_US}/skillsViewer.json` 分片
  （嵌套命名空间 `plugin.i18n.skillsViewer`，扁平合并会与通用键碰撞，故保留）；
  面板入口按钮文案 `manageSkills` 在 `aiContentGenerator.json` 分片。

### 样式引入约定（避免重复发射）

- `styles/index.scss` **只允许定义 mixin / `@keyframes`**，不得写任何选择器规则。
  以选择器形式写在这里的规则会被每个 `@use` 它的组件各发射一份（带各自 scope hash），
  历史上 `.ai-content-panel` 等曾因此重复 10 份。
- 面板壳层规则（`.ai-content-panel` / `.content-display-section`）放 `styles/_shell.scss`，
  仅由 `index.vue` 引入一次。
- 跨组件共用的组件形态（`.markdown-preview` / `.dot-flashing` / 空态·错误态骨架）
  以 mixin 暴露（`markdown-preview` / `dot-flashing` / `state-skeleton`），
  由消费组件在自己的 `<style scoped>` 中 `@include`，只发射自己那一份。
- SCSS 变量统一用别名形式 `@use "@/variables.scss" as *;`（勿用相对路径 `../../../variables`）。

## UI 层约定

### 统一使用共享组件库（`src/components/`）

本模块的按钮、下拉、开关、输入框、标签、图标、加载态**全部**消费共享组件，不在模块内自建同类控件：

| 场景 | 共享组件 | 备注 |
| --- | --- | --- |
| 普通按钮 / 纯图标按钮 | `Button` | 纯图标场景必须给 `aria-label` |
| 分段切换（预览·对比·审查 / 合并·分栏 / 严重度筛选） | `Button` + `text` 外观 | 选中态用 `variant` 在 `primary`/`ghost` 间切换；分组容器为纯布局，保留在模块 SCSS |
| 下拉（模型 / 思考强度 / 技能） | `Select` | 技能选择用 `filterable` + `#selected` / `#option` 插槽渲染来源色点 |
| 开关（联网 / 思考 / 审核） | `Switch` | `xsmall` 档 + 默认插槽放图标与文字 |
| 单行输入（自定义模型名） | `Input` | |
| 多行输入（编辑指令） | `Input`（`type="textarea"`） | |
| 标签（"块"） | `Tag` | |
| 图标 | `IconWrapper` + `src/config/icons.ts` 的 `IconKey` | 禁止内联 `<svg><use>` 与任意 Iconify 名 |
| 加载态 | `Loader` / `Button` 的 `loading` | |

**合规例外**：`CollapsibleSection.vue` 的折叠头保留原生 `<button>`——它是「chevron + 图标 + 标题 + 状态点 + `headerRight` 插槽」的复合布局容器，非标准按钮控件，且全项目仅此一处使用（Rule of Three 未满足，不提升为共享组件）；已补 `aria-expanded` / `aria-controls`。

**已知待办**：`ReviewRadarChart.vue` 为自建 SVG 雷达图。共享 `Chart.vue`（chart.js）当前仅支持 line/bar/pie/doughnut/area，**不支持 radar**，故暂未迁移。若后续为 `Chart.vue` 扩展 `radar` 类型，应改为消费共享组件并删除本文件。

### 图标

- 图标键统一取自 `src/config/icons.ts` 的 `IconKey`（`FeatureIconKey | CommonIconKey`）
- `types/index.ts` 的 `ACTION_META[].icon` 类型为 `IconKey`，快捷动作图标由 TS 保证合法
- 曾通过 `plugin.addIcons()` 注入的自定义 `#iconColumns` sprite 已移除，改用注册表中的 `columns`

### 文案（i18n）

- 所有 UI 文案走 `src/i18n/{zh_CN,en_US}/aiContentGenerator.json`（**扁平无前缀**键名，如 `actionPolish`、`viewModePreview`）
- 只改分片文件；顶层 `zh_CN.json` / `en_US.json` 由 `pnpm i18n:merge` 生成，禁止手改
- 模板中每处 i18n 使用位置上方须有中文 HTML 注释；禁止 `{{ i18n.xxx || '中文兜底' }}`
- `ACTION_META[].labelKey` 存 i18n 键名而非文案，保证快捷动作文案单一数据源
- **不纳入 i18n 的中文**：`console.*` 日志、传给 AI 的 prompt（`ACTION_META[].prompt` / `reviewLabel`、`DEFAULT_SYSTEM_PROMPTS`、审核 prompt）、业务枚举键名（`RATING_CLASS_MAP` / `sevKeyMap`）

## 验证

```bash
pnpm lint            # ESLint 代码规范
pnpm i18n:verify     # 中英文键对齐
pnpm validate:icons  # 图标注册有效性
npx tsc --noEmit     # TypeScript 类型检查
```

人工回归要点见 `docs/ai-content-generator-component-audit.md` 的「验收清单」。
