# 状态栏

在思源笔记底部状态栏右侧显示系统资源和文档统计信息。包括 CPU 使用率、内存使用情况、系统运行时间、笔记总数/总字数、今日活动统计，并提供密码箱、视频管理器等快捷入口。

## 功能抽屉与自定义分类

点击状态栏右侧的网格图标打开功能抽屉，集中展示功能入口，支持搜索、网格/列表视图切换。

### Tab 结构

- **全部**：未分类的非监控功能项（已分配分类的功能自动隐藏，避免重复显示）
- **监控**：状态栏监控项（文档数/总字数/今日活动/CPU/内存/运行时间）的显隐控制
- **自定义分类**：用户创建的动态分类 Tab，仅显示归属该分类的功能

### 分类管理

- 抽屉头部「管理分类」按钮进入管理面板：新建、重命名（输入框回车/失焦提交）、删除分类（成员自动回到未分类），每行显示成员计数
- 每个功能项的分类角标：点击弹出菜单选择归属分类或移出到「未分类」
- 每个功能最多归属一个自定义分类；监控项不参与分类

### 存储槽位

键名集中在 `types/storage.ts`（`StatusBarStorage`），禁止在组件中散落字面量。

| 槽位 | 键 | 内容 |
|------|------|------|
| `shortcuts` | `statusBar-shortcuts` | 状态栏固定项（pin 的功能 id，有序） |
| `monitors` | `statusBar-monitors` | 监控项显隐集合（空 = 默认全显） |
| `categories` | `statusBar-categories` | 自定义分类列表（`{ id, name }`，有序） |
| `featureCategory` | `statusBar-feature-category` | 功能 → 分类 id 的单一归属映射 |

### 固定与开关

- pin 角标：将功能固定/移出到状态栏快捷区（监控项与快捷区共用同一份 `pinnedIds` 有序列表）
- 开关角标：直接启用/禁用对应功能（经 `plugin.updateSettings` 持久化）

## 功能元数据来源（单一数据源）

`featureRegistry.ts` **不自行维护**功能清单的 title / icon / color，而是派生自项目权威来源：

| 字段 | 来源 |
|------|------|
| title | `FEATURE_CONFIG[].defaultTitle`（优先按其 `titleI18nKey` 解析 i18n） |
| icon / color | `FEATURE_ICONS[id]`（`src/components/kit/icons.ts`，真源） |

本模块只声明「状态栏独有的增量信息」：收录白名单（`DRAWER_FEATURE_IDS`）、状态栏快捷图标覆盖（`SHORTCUT_ICONS`）、动作事件名（`FEATURE_EVENTS`）、监控项定义。

> ⚠️ `FEATURE_EVENTS` 刻意不从 `FEATURE_CONFIG.actions[].key` 取：后者是「面板动作标识」而非 window 事件名
> （如 `imageCompressor` 动作是 `openCompressor` 而事件是 `openImageCompressor`），且有 9 个功能在 `FEATURE_CONFIG` 中并无 `actions[]`。

**新增可 pin 功能**：在 `DRAWER_FEATURE_IDS` 加一个 id（若事件名与常规不同则在 `FEATURE_EVENTS` 登记）。

## 共享组件复用

抽屉与状态栏 UI 复用共享组件，不再自建同类控件：

| 组件 | 用途 |
|------|------|
| `TieredMenu`（popup） | 分类分配弹出菜单（定位/层级/Esc/键盘/无障碍均由组件承担） |
| `Button` | 抽屉头部按钮、分类 Tab 分段切换、管理面板增删按钮 |
| `Input` | 搜索框（`borderless` + `prefix-icon` + `clearable`）、分类名输入（`error` 展示校验） |
| `IconWrapper` | 全部图标（受 `IconKey` 约束，替代原先的裸 `<Icon>` 与内联 `<svg>`） |

角标（pin / 分类 / 开关）为固定 16×16 紧凑图标按钮（`AGENTS_STYLE.md` 的 `.icon-btn` 例外），保留真实 `<button>` 语义 + `aria-pressed`，键盘可达。

## 文件结构

```
statusBar/
├── index.ts                        # registerStatusBar（实例自挂载 __statusBar + destroy，交 DESTROYABLE_KEYS 销毁）
├── index.vue                       # 主面板：监控项 + 快捷入口 + 抽屉容器 + 分配菜单
├── featureRegistry.ts              # 功能注册表（从 FEATURE_CONFIG / FEATURE_ICONS 派生）
├── types/
│   ├── index.ts                    # 类型与监控阈值常量
│   └── storage.ts                  # StatusBarStorage（TypedStorage 槽位 + 键名集中定义）
├── composables/
│   ├── useStatusBar.ts             # CPU/内存/统计采集 + 显示格式化（tooltip 文案走 i18n）
│   ├── useStatusBarTask.ts         # 后台任务状态栏展示（跨功能统一入口）
│   └── useFeatureCategories.ts     # 自定义分类 CRUD 与归属持久化（校验返回 i18n 键）
├── components/
│   ├── MonitorItem.vue             # 状态栏项容器（可点击项渲染为真实 button）
│   ├── FeatureDrawer.vue           # 功能抽屉（Tab/搜索/分类管理面板）
│   ├── DrawerFeatureItem.vue       # 抽屉项（pin/分类/开关角标）
│   └── CategoryAssignMenu.vue      # 分类分配弹出菜单（TieredMenu 薄封装）
└── styles/index.scss               # 全部样式
```
