# AI 内容生成

使用 AI（支持自定义 API）生成 Markdown 格式内容。注册为右侧边栏 Dock 面板，支持自定义对话配置和上下文管理，生成的 AI 内容可直接插入笔记中。

## 目录结构

```
aiContentGenerator/
├── index.ts                  # registerAIContentGenerator(plugin) — 功能注册入口
├── index.vue                 # Dock 面板编排层（注入 i18n，衔接生成/审核/编辑操作）
├── utils.ts                  # 纯工具函数（Markdown 渲染与转换、技能提示词构建等）
├── modules/
│   └── AIContentGenerator.ts # Dock 注册 + AI 生成/交叉审核调用（走 @/utils/aiApi）
├── composables/              # 视图逻辑：生成 / 审核 / 编辑操作 / 文档目标 / 技能加载
├── types/
│   ├── index.ts              # 类型 + 共享常量（ACTION_META / DEFAULT_SYSTEM_PROMPTS 等）
│   └── storage.ts            # TypedStorage 槽位
├── components/               # 展示层子组件
│   ├── MainContentArea.vue   # 主内容区：加载/错误/空态、预览·对比·审查三视图
│   ├── ResultActionsBar.vue  # 生成结果操作栏（停止/应用/插入子文档/撤回/复制/直接审查/清空对话/清除）
│   ├── BottomInputArea.vue   # 底部输入区：文档与块选择、技能、快捷动作、模型与开关、自定义输入
│   ├── SkillSection.vue      # 技能选择（共享 Select + filterable）
│   ├── SkillPreviewModal.vue # 技能细则预览弹窗
│   ├── DiffPreview.vue       # 原文/新文差异视图（vue-diff）
│   ├── ReviewPanel.vue       # 交叉审核面板：分项评分 / 严重度过滤 / 问题清单 / 自动修复
│   ├── ReviewRadarChart.vue  # 分项评分雷达图（自建 SVG，见下方说明）
│   ├── CollapsibleSection.vue# 通用可折叠区块（模块内复用）
│   ├── ReasoningSection.vue  # 思考过程折叠区块
│   ├── SearchResultsSection.vue # 联网搜索来源折叠区块
│   └── ContentAreaEmpty.vue  # 空状态三步引导
└── styles/                   # SCSS（样式强制从 .vue 提取）
    ├── index.scss            # 跨组件共享基座：面板壳层、共用 mixin、.markdown-preview、.dot-flashing
    └── <Component>.scss      # 各组件专属样式
```

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
