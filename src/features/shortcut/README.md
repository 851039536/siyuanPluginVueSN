# 快捷键面板

在右侧边栏以 **2 列卡片** 展示与管理快捷键：内置 NPM / NVM / Visual Studio 共 42 条预置快捷键，并支持用户自定义增删改与数据导入导出。

> 预置分类可在 `data/` 下按需增删（当前仅保留上述三类）；面板的分类下拉由数据驱动，无数据的分类不会出现。

## UI 结构

```
┌ 工具栏（两行，吸顶） ────────────────────────────────┐
│ 搜索框            分类下拉(带数量)            + 新增 │
│ 12 / 42                        导入 导出 重置        │
├ 列表（独立滚动，2 列卡片网格） ─────────────────────┤
│ ▸ 分组名 (数量)                      ← 吸顶 + 可折叠 │
│ ┌───────────────┐ ┌───────────────┐                 │
│ │ [Ctrl+K]    ⧉ │ │ [Ctrl+Alt]  ⧉ │  ← 按键 + 操作  │
│ │ 名称           │ │ 名称 描述…     │  ← 名称 + 描述  │
│ └───────────────┘ └───────────────┘                 │
└─────────────────────────────────────────────────────┘
```

- **卡片（2 列网格，同行等高）**：上行是按键徽章（等宽字体、主色描边，点击即复制）与行内操作；下行是名称（加粗，含平台标签）与描述（次级色、单行省略）。
- **描述自适应折行**：下行用 `flex-wrap` + 描述 `flex-basis: 120px` ⇒ 名称短时描述与其同行，名称长时描述自动落到第二行，无需人为取舍。
- **操作按钮悬停浮出**：复制（自定义项另有编辑 / 删除）默认隐藏但**恒定预留空间**（`visibility: hidden` 不参与布局）⇒ 悬停与键盘聚焦只做淡入，卡片不会抖动。
- **悬停 / 聚焦反馈**：卡片底色浮起为 surface 并转为主色描边；卡片本体是中性边框 + 圆角（不用阴影）。
- **编辑与删除仅对自定义项渲染**，预置项只读；组头已写明同一工具名时卡片内不再重复分类标签。
- **新增 / 编辑对话框**：字段为 名称 / 描述 / 按键组合 / 分组，名称与按键必填（校验失败就地提示）。**分组为下拉选择**：选项来自当前数据中的现有分组 + 默认的「自定义」分组（可筛选输入），选「新建分组…」可切换为输入框新建（自动聚焦），并可用按钮切回列表。
- 空态使用共享 `IconWrapper`，不使用原生 svg。

> `ShortcutRow` 是纯展示的列表项卡片，未复用共享 `Card`：`Card` 自带内边距与边框、且由自身 scoped 样式决定，紧凑卡片逐项覆写会与其打特异性官司（同为 (0,2,0) 靠注入顺序），属规范允许的「纯展示的局部布局容器」例外。

## 数据模型与持久化

**预置不落盘**（代码即唯一真源，插件升级后新增预置立即可见），仅自定义快捷键一份用户数据写盘。

| 存储键 | 内容 | 说明 |
|--------|------|------|
| `plugin-shortcuts-custom` | `ShortcutInfo[]` | 唯一可写数据（自定义快捷键段） |
| `plugin-shortcuts-all` | `ShortcutInfo[]` | **旧版遗留键**，仅作一次性迁移源，迁移成功后删除 |

### 迁移算法（幂等）

1. 新键 `plugin-shortcuts-custom` **已存在**（含空数组）⇒ 迁移已完成，直接返回其内容 —— 因此用户删光自定义项后不会被旧数据复活；
2. 旧键不存在 ⇒ 首次安装，返回空数组且不写盘；
3. 旧数据过滤：仅保留 id 不属于预置集合的条目，并强制清洗为 `category: "custom"`；
4. **写入成功才删除旧键**；写入失败保留旧键，下次启动重试，不丢数据。

### 预置判定与双层设防

`isPreset(id)` 依据由 `PRESET_SHORTCUTS` 派生的 id 集合（取代旧版 `category === "custom"` 硬编码）：

- 视图层：预置行不渲染编辑 / 删除按钮；
- 数据层：`addOrUpdateCustom` / `removeCustom` / `replaceCustom` 对预置 id 一律拒绝。

## 导入 / 导出 / 重置

- **导出**：仅导出自定义项，载荷含 `type` / `version` / `exportedAt` / `shortcuts`，文件名为 `shortcuts-YYYY-MM-DD.json`。
- **导入**：解析后按「与预置 id 冲突 ⇒ 忽略；同 id ⇒ 覆盖；新 id ⇒ 追加」合并并提示新增 / 覆盖 / 忽略数量；非法 JSON 或结构不合法时给出错误提示且不改动现有数据。
- **重置**：二次确认后清空全部自定义快捷键（预置不受影响）。

## 目录结构

```
shortcut/
├── index.ts                     # 注册入口：迁移旧键 → 注入预置与自定义 → 绑定保存回调
├── index.vue                    # 编排层：组合两个 composable、分发事件、挂载对话框
├── manager.ts                   # 双段模型（预置只读 + 自定义可写），单例 getShortcutManager()
├── utils.ts                     # 纯函数：搜索 / 清洗 / 过滤 / 分组与分组名列表 / 分类计数 / 表单构建
├── dataTransfer.ts              # 导入导出纯逻辑：载荷构建与解析、合并统计
├── data/                        # 预置数据（按分类拆分，presets.ts 聚合）
├── types/
│   ├── index.ts                 # 类型 + 共享常量（分类、工具类、导出载荷标识）
│   └── storage.ts               # 自定义存储 + 幂等旧键迁移
├── composables/
│   ├── useShortcutData.ts       # 响应式镜像、增删改、复制、导入导出、重置
│   └── useShortcutFilter.ts     # 搜索 / 分类筛选管道
├── components/                  # PanelHeader / ShortcutList / ShortcutRow / ShortcutDialog
└── styles/                      # 与组件一一对应的 SCSS
```

分层约定：纯函数进 `utils.ts` / `dataTransfer.ts`，可写数据与单例进 `manager.ts`，响应式状态与副作用进 `composables/`，视图组件只做渲染与事件上抛。

> ⚠️ `ShortcutManager` 存在模块级单例中，其内部数组**不是响应式的**：视图层必须使用 `useShortcutData` 暴露的 `ref` 镜像，任何增删改后调用 `refresh()`，不要写 `computed(() => manager.getAllShortcuts())`（无响应式依赖会导致永久缓存）。

## 扩展点

- **新增预置快捷键**：在 `data/<分类>.ts` 追加条目（`id` 必须全局唯一且不可与既有重名），无需改动存储 —— 升级后自动出现在用户面板中。
- **新增分类**：在 `types/index.ts` 的 `ShortcutCategory` 加标识 + `CATEGORY_LABEL_I18N_KEYS` 加映射，并在 `src/i18n/{zh_CN,en_US}/shortcuts.json` 补文案（`pnpm i18n:verify` 校验对齐）。
- **工具类分类**（需要显示分类标签）：加入 `TOOL_CATEGORIES`。

## 公共 API（`@/features/shortcut`）

```ts
addCustomShortcut(shortcut)      // 新增 / 覆盖自定义快捷键（预置 id 会被拒绝）
addCustomShortcuts(shortcuts)    // 批量合并自定义快捷键
getShortcutManager()             // 数据管理器单例
```

同时导出纯函数 `searchShortcuts` / `filterShortcuts` / `groupShortcuts` / `listGroups` / `sanitizeShortcutArray` / `splitKeySequences`，以及 `buildExportPayload` / `serializeExport` / `buildExportFileName` / `parseImportPayload` / `mergeImport`。

## 验证

```bash
pnpm typecheck      # vue-tsc：类型与 .vue props 校验
pnpm i18n:merge     # 合并分片 i18n（构建时自动执行）
pnpm i18n:verify    # 中英文键对齐 + 重复键检测
pnpm validate:icons # 图标注册有效性
pnpm lint           # ESLint（由项目维护者执行）
```
