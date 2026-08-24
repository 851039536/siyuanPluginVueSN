---
name: ideaGenerator 灵感生成器
overview: 新增「灵感生成器」功能模块：以独立浮动窗口承载，用户选择预设分类（桌面工具/脚本/思源插件/Web应用等）+ 可选关键词，调用 AI 批量生成程序开发/小功能开发灵感卡片，支持展开查看、一键复制、AI 细化为完整技术方案。
design:
  architecture:
    framework: vue
  styleKeywords:
    - Codex
    - 深色沉浸式
    - 紫色 AI 主题
    - 边框卡片
    - 等宽字体
  fontSystem:
    fontFamily: PingFang SC
    heading:
      size: 18px
      weight: 600
    subheading:
      size: 14px
      weight: 500
    body:
      size: 13px
      weight: 400
  colorSystem:
    primary:
      - "#9333ea"
      - "#a855f7"
      - "#7c3aed"
    background:
      - "#1b1b1f"
      - "#202127"
    text:
      - "#e8e8ea"
      - "#a0a0a8"
    functional:
      - "#10b981"
      - "#ef4444"
      - "#f59e0b"
      - "#3b82f6"
todos:
  - id: create-core
    content: 使用 [skill:universal-arch-skill] 创建 ideaGenerator 模块核心骨架：types/（IdeaGeneratorManager 窗口承载 + 预设分类常量 + 类型）、utils.ts（AI 响应解析）与 index.ts 注册入口
    status: completed
  - id: ai-logic
    content: 实现 useIdeaGenerator composable：批量灵感生成（callAI）+ 方案流式细化（callAIStream）+ 复制/展开/取消逻辑
    status: completed
    dependencies:
      - create-core
  - id: ui-panel
    content: 实现主面板 index.vue 与子组件（CategorySelector/IdeaCard/IdeaDetail）及 Codex SCSS 样式
    status: completed
    dependencies:
      - create-core
      - ai-logic
  - id: register
    content: 使用 [skill:universal-arch-skill] 完成 8 步注册清单：features/index.ts、src/index.ts、settings.ts、config.ts、icons.ts、superPanel ACTION_EVENT_MAP
    status: completed
    dependencies:
      - create-core
  - id: i18n-readme
    content: 编写 ideaGenerator 中英文 i18n 分片与 README.md 模块文档
    status: completed
    dependencies:
      - ui-panel
---

## 产品概述

灵感生成器是思源笔记插件内的一个独立浮动窗口工具，面向程序开发者。用户选择预设的开发方向分类（可附带关键词），AI 一次生成一批（约 5 条）功能/小工具创意灵感，每条包含标题与简短描述；用户可展开查看完整描述、一键复制灵感文本，或对感兴趣的灵感让 AI 细化为完整技术方案（含技术栈与实现要点）。

## 核心功能

- 预设分类 + 可选关键词定向生成：提供固定分类标签（如桌面工具、命令行脚本、思源笔记插件、Web 应用、效率工具、自动化等），选中分类并可选填写关键词后生成。
- 批量灵感卡片展示：AI 一次生成多条灵感，以卡片形式展示标题与简述，支持展开查看完整描述。
- 一键复制灵感：点击复制按钮将某条灵感文本复制到剪贴板。
- AI 细化为完整方案：选中灵感后由 AI 展开为需求说明/技术方案文档，流式输出技术栈与实现要点。
- 独立浮动窗口承载：可独立浮动窗口/主窗口页签切换（参考极简浏览器的双形态承载）。

## 技术栈

- 前端框架：Vue 3 + TypeScript（复用项目现有技术栈）
- 样式：SCSS + Codex 设计 Token（`$color-*`/`$font-size-*`/`$spacing-*`/`$radius-*`，禁用 box-shadow）
- 窗口承载：思源官方 API `addTab` + `openTab` + `openWindow`
- AI 调用：`@/utils/aiApi` 的 `callAI` / `callAIStream` / `getApiConfigFromPlugin`（项目统一入口）
- 剪贴板：`@/utils/domUtils` 的 `copyToClipboard`
- 事件联动：`@/utils/eventBus` 的 `emitCustomEvent` + `window.addEventListener`（跨功能解耦）

## 实现方式

### 高层策略

完全复用 `minimalBrowser`（极简浏览器）的独立窗口双形态承载模式，新建 `ideaGenerator` 功能模块。核心由 `IdeaGeneratorManager` 类管理 `addTab` 自定义页签模型与 `openWindow` 浮动窗口生命周期；Vue 主面板通过 composable 驱动 AI 生成与细化逻辑。跨功能入口（超级面板/快捷键）通过 `window.addEventListener("openIdeaGenerator")` 统一调度，与 minimalBrowser 的 `openMinimalBrowser` 机制完全一致。

### 关键决策

1. **窗口承载复用 minimalBrowser 模式**：`addTab` 注册自定义 Tab 模型 → `openTab({ custom })` 创建/聚焦主窗口页签 → `openWindow({ tab })` 移入浮动窗口，关闭浮动窗口自动移回主窗口。这是项目已验证的双形态方案，零新架构引入。
2. **AI 生成采用「一次非流式 + 细化流式」组合**：批量生成灵感用 `callAI` 单次返回结构化多条（避免多次往返延迟）；选中细化方案用 `callAIStream` 流式输出（提升长文本方案的用户体验）。两者均传入 `AbortController.signal` 支持中途取消。
3. **AI 输出格式引导 + 解析兜底**：通过 systemPrompt 引导 AI 输出固定 Markdown 列表格式（每行「标题：描述」），前端 `utils.ts` 用纯函数解析为 `IdeaItem[]`；解析失败时降级为按行拆分或单条展示，保证界面不因格式漂移而崩溃。
4. **无持久化偏好**：分类选择与关键词为会话内状态，灵感不落盘，故不新建 `types/storage.ts`，保持模块精简（KISS）。

### 性能与可靠性

- 批量生成单次 `callAI` 返回 5 条，避免 N 次串行请求；细化方案用流式避免长时间等待空白。
- `callAI` 的 `options.signal`（AbortController）在切换灵感、重新生成、窗口销毁时取消进行中的请求，防止竞态与资源泄漏。
- 组件卸载时调用 `destroy()` 清理 `window` 事件监听与 Vue app，避免内存泄漏（沿用 `DESTROYABLE_KEYS` 统一销毁）。

## 架构设计

模块内采用项目标准三层结构：`types/index.ts`（类型 + 共享常量 + Manager 类）、`utils.ts`（纯解析函数）、`.vue`/`composables`（视图与状态）。

数据流：用户选择分类 → composable 构建 prompt → `callAI` 批量生成 → `utils.ts` 解析为 `IdeaItem[]` → 卡片列表渲染；用户点「细化」→ `callAIStream` 流式输出技术方案到详情区；用户点「复制」→ `copyToClipboard`。

## 目录结构

### 新建文件

```
src/features/ideaGenerator/
├── index.ts                        # 注册入口 registerIdeaGenerator(plugin)：自挂载 __ideaGenerator、注册命令(⌃⌥I)、注册 Tab 图标
├── index.vue                       # 主面板：分类栏 + 关键词输入 + 生成按钮 + 灵感卡片列表 + 详情/细化区
├── README.md                       # 模块文档（功能说明 + 目录结构 + 扩展建议）
├── types/
│   └── index.ts                    # I18n 接口、IdeaCategory/IdeaItem 类型、IDEA_CATEGORIES 预设分类常量、IdeaGeneratorManager 类
├── composables/
│   └── useIdeaGenerator.ts         # 生成/细化/复制/展开等状态与副作用（调 callAI/callAIStream/copyToClipboard）
├── components/
│   ├── CategorySelector.vue        # 预设分类标签选择器（支持单选分类）
│   ├── IdeaCard.vue                # 单条灵感卡片（标题+简述+展开/复制/细化操作）
│   └── IdeaDetail.vue              # 详情区（展开描述 + 流式技术方案展示）
├── utils.ts                        # parseIdeasResponse 等纯函数：Markdown/JSON 响应解析为 IdeaItem[]
└── styles/
    ├── index.scss                  # 主入口 + 共享基座类
    ├── IdeaGenerator.scss          # 主面板样式
    ├── CategorySelector.scss       # 分类选择器样式
    ├── IdeaCard.scss               # 灵感卡片样式
    └── IdeaDetail.scss             # 详情区样式
```

### 修改文件

```
src/features/index.ts               # 添加 export { registerIdeaGenerator }；_Registered 联合类型加 "ideaGenerator"
src/index.ts                        # import；registerFeatures() 加 if (s.enableIdeaGenerator)；DESTROYABLE_KEYS 加 "__ideaGenerator"
src/config/settings.ts              # PluginSettings 加 enableIdeaGenerator: boolean；DEFAULT_SETTINGS 加 true
src/features/config.ts              # FEATURE_CONFIG 加条目（id/defaultTitle/defaultDesc/titleI18nKey/descI18nKey/actions）
src/config/icons.ts                 # FEATURE_ICONS 加 ideaGenerator 图标映射（建议 mdi:lightbulb-on-outline 或 mdi:creation）
src/features/superPanel/types/index.ts  # ACTION_EVENT_MAP 加 openIdeaGenerator: { event: "openIdeaGenerator" }
src/i18n/zh_CN/ideaGenerator.json   # 新建：中文翻译分片（含 ideaGenerator.*、openIdeaGenerator、enableIdeaGenerator、enableIdeaGeneratorDesc）
src/i18n/en_US/ideaGenerator.json   # 新建：英文翻译分片
```

## 关键代码结构

```typescript
// types/index.ts — 预设分类与灵感数据结构（共享常量 + 类型）
export interface IdeaCategory {
  id: string
  label: string
  icon: string // Iconify 图标名
}

export interface IdeaItem {
  id: string
  title: string
  description: string
}

export const IDEA_CATEGORIES: IdeaCategory[] = [
  { id: "desktop-tool", label: "桌面工具", icon: "mdi:monitor" },
  { id: "cli-script", label: "命令行脚本", icon: "mdi:console" },
  { id: "siyuan-plugin", label: "思源笔记插件", icon: "mdi:puzzle" },
  { id: "web-app", label: "Web 应用", icon: "mdi:web" },
  { id: "productivity", label: "效率工具", icon: "mdi:lightning-bolt" },
  { id: "automation", label: "自动化", icon: "mdi:robot" },
]
```

```typescript
// types/index.ts — Manager 类关键签名（仿 BrowserManager）
export class IdeaGeneratorManager {
  constructor(plugin: Plugin) // 注册 addTab 模型 + 监听 "openIdeaGenerator" 事件
  public async open(): Promise<void>       // 主窗口页签
  public async openFloating(): Promise<void> // 独立浮动窗口
  public destroy(): void                    // 移除监听 + unmountPanel
}
```

```typescript
// utils.ts — AI 响应解析纯函数
export function parseIdeasResponse(raw: string): IdeaItem[]
```

## 设计风格

采用项目统一的 Codex 设计语言：等宽字体、大写标签、细边框卡片、focus 发光、禁用 box-shadow。以紫色为主色调呼应「AI 创意」定位，整体偏深色沉浸式工作台风格。主面板采用上下分区布局：顶部为分类选择 + 关键词输入 + 生成按钮的操作区；中部为响应式卡片网格展示灵感；下方/侧边为可展开的详情与流式技术方案区。

## 页面布局

- 顶部操作区：大写标签分类胶囊按钮组（单选高亮），右侧关键词输入框与「生成灵感」主按钮（含加载态）。
- 灵感卡片区：5 条卡片网格排布，每条含标题、两行描述截断、三个操作（展开查看 / 复制 / AI 细化），卡片 hover 边框高亮 + 轻微上浮。
- 详情区：选中灵感后展开，展示完整描述；点「AI 细化」后流式渲染技术方案（技术栈、实现要点、分节小标题），复制按钮可复制完整方案文本。
- 底部状态条：显示生成中/完成/错误状态与可取消提示。

## Agent Extensions

### Skill

- **universal-arch-skill**
- 用途：辅助生成 `ideaGenerator` 功能模块脚手架，并校验 8 步注册清单的完整性（功能注册、导出、配置、图标、i18n 联动）。
- 预期结果：产出符合项目架构规范的功能模块目录骨架，并确认注册链条两端无断裂（TypeScript 编译时断言可通过对齐）。