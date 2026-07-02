# CLAUDE.md

思源笔记插件开发指南 — 基于 Vite + Vue 3 + TS，功能模块化架构。

## 统一入口原则

所有跨功能的通用操作必须通过统一定义的入口。以下模式一经发现即为违规：

| 场景 | ❌ 禁止 | ✅ 必须 |
|------|---------|---------|
| 存储 | `plugin.loadData/saveData` | `PluginStorage` / `TypedStorage` from `@/utils/pluginStorage` |
| AI | `fetch/axios` 直调 AI API | `callAI / callAIStream` from `@/utils/aiApi` |
| 事件 | `new CustomEvent + dispatchEvent` | `emitCustomEvent` from `@/utils/eventBus` |
| Dock | `createApp + mount + appendChild` | `createVueDockApp` from `@/utils/vueAppHelper` |
| Modal | `mask + container + createApp` | `createModalVueApp` from `@/utils/vueAppHelper` |
| 剪贴板 | `textarea + execCommand("copy")` | `copyToClipboard / fallbackCopyToClipboard` from `@/utils/domUtils` |
| 下载 | `a.click()` | `triggerDownload / triggerBlobDownload` from `@/utils/domUtils` |
| 动态样式 | `createElement("style") + appendChild` | `injectStyle(id, css) / removeStyle(id)` from `@/utils/domUtils` |
| 加密 | 各自实现 AES-GCM + PBKDF2 | `cryptoPrimitives.ts` 基元（各模块保留自身密钥策略） |
| Node 模块 | 各自 `try { require("node:xxx") } catch` | `getNodeModules / getNodeProcessModules / getNodeFsPathOs` from `@/utils/nodeModules` |
| SQL | `fetch("/api/query/sql")` | `sql()` from `@/api` |
| 系统 API | `fetch("/api/...")` 直调 | 对应 `@/api` 封装函数（找不到则新增） |
| API 导入 | `await import("@/api")` 动态导入 | `import { ... } from "@/api"` 静态导入（api.ts 已被多文件静态引用，动态导入产生 Vite 分块警告） |
| 状态栏任务 | 绕过状态栏直接弹通知 | `useStatusBarTask` from `@/features/statusBar/composables/useStatusBarTask` |
| 全局 siyuan | `(window as any).siyuan` | props 传入 Plugin 实例 |

## 跨功能联动规则（强制）

**功能模块之间禁止直接相互导入**。跨功能联动必须通过事件总线 + App.vue 中心调度实现零依赖解耦。

### 正确模式（唯一允许）

```
Feature A（发起方）                 Feature B（响应方）
  │                                   ▲
  │ emitCustomEvent("eventName",      │
  │   { detail })                     │ 导出 public API
  │                                   │ (ref / function)
  ▼                                   │
App.vue onMounted 监听 ───────────────┘
  window.addEventListener("eventName",
    handler → 调用 Feature B 的 public API
  )
```

### 错误模式 ❌

| 禁止行为 | 原因 |
|----------|------|
| Feature A 直接 `import { xxx } from "@/features/FeatureB"` | 产生硬依赖，破坏模块独立性 |
| Feature A 直接修改 Feature B 的 ref | 跨越模块边界，状态归属混乱 |
| Feature A 通过全局变量 `(window as any).xxx` 访问 Feature B | 类型不安全，无契约约束 |

### 正确示例 ✅

```typescript
// ===== Feature A（如 floatingToolbar/actions/passwordVault.ts）=====
// 只用 createDialogAction 工厂 + emitCustomEvent 派发
// ===== App.vue（中心调度）=====
// 唯一允许同时导入两个 feature 的文件
import { openPasswordVaultWithText } from "@/features"

export function createPasswordVaultAction(plugin: Plugin): ToolbarAction {
  return createDialogAction({
    id: "passwordVault",
    icon: `<svg>...</svg>`,
    label: plugin.i18n.passwordVault.quickSave,
    eventName: "openPasswordVaultAdd", // 事件名
    getContent: (selection) => ({ content: selection }),
  })
}

// ===== Feature B（如 passwordVault/index.ts）=====
// 导出 public API，不导入任何其他 feature
export const pendingEntryName = ref("")
export function openPasswordVaultWithText(text: string) {
  pendingEntryName.value = text
  passwordVaultVisible.value = true
}

onMounted(() => {
  window.addEventListener("openPasswordVaultAdd", ((event: any) => {
    if (event.detail?.content) {
      openPasswordVaultWithText(event.detail.content)
    }
  }) as EventListener)
})
```

### 规则清单

1. **Feature 间零直接导入**：任何 feature 目录下的文件不得 `import` 其他 feature（`@/features/*` 的子目录）
2. **单向数据流**：发起方只负责 `emitCustomEvent`，绝不触碰响应方的状态
3. **App.vue 是唯一调度中心**：所有跨功能的事件监听统一在 App.vue 的 `onMounted` 中注册
4. **Public API 契约**：响应方 feature 的 `index.ts` 导出的函数/ref 即为它的 public API，其他 feature 不直接调用
5. **事件名规范**：使用 camelCase 动词短语（如 `openPasswordVaultAdd`），在 eventBus 中保持唯一
6. **数据透传**：事件 detail 中携带的数据由 App.vue 透传给响应方，双方不共享类型定义

## 子组件数据流规则（强制）

**对话框/编辑弹窗类子组件必须自包含，禁止父传全量 props + 子 emit 回父的中间人模式。**

### 正确模式

```
父组件                             子组件（对话框）
  │                                   │
  │ props: id, manager/service        │ 接收最小标识符 + 服务实例
  │                                   │
  │                                   ▼
  │                                 onMounted → 自行从 service 加载数据
  │                                   │
  │                                   ▼
  │                                 save() → 直接调用 service 持久化
  │                                   │
  │  ◄── emit("saved" | "close") ──  emit 极简通知（无数据载荷）
```

### 禁止事项

| 禁止 | 原因 |
|------|------|
| 父组件为子组件维护 `editXxx` 系列中间状态 ref | 冗余的数据拷贝，所有权混乱 |
| 父传递完整 project + urlValues + remoteList 等 5+ 个 props | props 膨胀，子组件沦为渲染傀儡 |
| 子组件 emit 全量表单数据 `emit("save", {name,status,...})` | 数据往返传递，逻辑分散在两处 |
| 父通过 `ref.setLocalPath()` 回填子组件内部状态 | 跨组件操作内部状态，破坏封装 |
| 子 `defineExpose({ setLocalPath })` 供父调用 | 暴露内部实现，紧耦合 |
| 子组件有 manager 实例却 emit 事件让父调用 CRUD | 绕远路，应直接调 manager |

> **核心**：子组件持有 manager/service 实例后，CRUD 全在内部完成。父只管开关弹窗 + 刷新列表，不关心编辑了什么字段。

## 硬规则

- **功能注册完整性**：新功能必须在 8 处注册（见下方「添加新功能」清单）
- **Composable 复用**：Dock 面板与弹窗共享逻辑时抽取 `composables/use*.ts`，禁止两个组件各自实例化 Storage。参考 `flashcardReading/composables/`
- **Vue 事件命名**：emit 事件必须 camelCase，禁止 kebab-case 或 `input:title` 格式
- **图标注册**：`FEATURE_ICONS` 中添加映射 + 运行 `pnpm validate:icons`
- **README 文档**：每个 `src/features/*/` 目录下必须有 `README.md`
- **全局样式**：`@use "@/index.scss" as *;`
- **优先思源内置图标** 或 @iconify/vue
- **图标规则**：禁止使用 emoji 表情作为图标。使用 `src/config/icons.ts` 中 `FEATURE_ICONS` / `COMMON_ICONS` 已注册的 Iconify 图标（`mdi:xxx`、`carbon:xxx` 等）。需要新图标时在 `icons.ts` 注册映射后引用，浏览图标 https://icon-sets.iconify.design/
- **文件头注释**：每个 `.ts` / `.vue` 文件顶部必须包含简要功能说明注释（`.scss` 不适用），格式见 [CLAUDE_RULES.md § 强制规则：文件头注释](./CLAUDE_RULES.md#强制规则文件头注释)

## 关键文件速查

```
src/
├── api.ts                  # 所有思源 API 封装（sql/getFile/putFile/getConf 等 60+ 函数）
├── index.ts                # 插件入口（同步读开关 → 条件注册各功能）
├── config/
│   ├── settings.ts         # PluginSettings 接口 + 功能开关持久化
│   └── icons.ts            # FEATURE_ICONS + COMMON_ICONS
├── utils/
│   ├── aiApi.ts            # callAI / callAIStream — 所有 AI 调用唯一入口
│   ├── eventBus.ts         # emitCustomEvent — 所有自定义事件唯一入口
│   ├── pluginStorage.ts    # PluginStorage — 统一存储抽象层
│   ├── typedStorage.ts     # TypedStorage<T> — 类型安全存储槽
│   ├── vueAppHelper.ts     # createVueDockApp / createModalVueApp
│   ├── domUtils.ts         # copyToClipboard / triggerDownload / injectStyle
│   ├── nodeModules.ts      # getNodeModules / getNodeProcessModules / getNodeFsPathOs
│   ├── settingsCrypto.ts   # encryptSetting / decryptSetting — 配置加密
│   ├── cryptoPrimitives.ts # deriveAESKey / aesGcmEncrypt / aesGcmDecrypt — 加密基元
│   ├── iconHelper.ts       # replaceTopBarIcon / createIconElement
│   └── settingsBackup.ts   # backupPluginData / restoreFromUpload
├── components/             # 共享 shadcn-vue 组件（Button/Input/Select/Switch/Tag 等）
├── features/
│   ├── statusBar/
│   │   └── composables/
│   │       └── useStatusBarTask.ts  # 状态栏后台任务（task.progress/complete/fail）
│   ├── config.ts           # FEATURE_CONFIG — 单一数据源，推导 FeatureId 类型
│   ├── index.ts            # 功能注册函数统一导出 + 编译时双向断言
│   └── <feature>/          # 各功能模块（index.ts + index.vue + types/ + composables/）
├── types/
│   ├── ai.ts               # AI API 类型
│   └── api.d.ts            # API 请求/响应类型
└── i18n/
    ├── zh_CN/                 # 中文分片（源文件，按 feature 模块拆分）
    ├── en_US/                 # 英文分片（源文件，结构与中文对应）
    ├── zh_CN.json             # 构建产物（自动合并，思源框架读取）
    └── en_US.json             # 构建产物（自动合并）
```

## UI 风格：Codex

**强制规则**：所有新增 feature 的 UI 必须遵循 Codex 风格。禁止硬编码尺寸——使用全局设计 Token（`src/_variables.scss` 提供 `$vp-radius` / `$spacing-*` / `$vp-mono` / `$radius-*`），禁止 `box-shadow`（改用边框）。

> 完整 Token 表、组件模式库、禁止事项见 [CLAUDE_RULES.md § UI 风格：Codex](./CLAUDE_RULES.md#ui-风格codex)

## API 速查

### 存储

`PluginStorage`（key-value 存取）→ `TypedStorage<T>`（类型安全存储槽，自带默认值）。`settings.ts` 是唯一允许直接调用 `plugin.loadData/saveData` 的例外。

> 代码示例见 [CLAUDE_RULES.md](./CLAUDE_RULES.md#存储)

### Dock 面板

`createVueDockApp(plugin, Component, { position, width, icon, title, type, i18n, extraProps })`

> 代码示例见 [CLAUDE_RULES.md](./CLAUDE_RULES.md#dock-面板)

### Modal 弹窗

`createModalVueApp(Component, { maskId, width, height, persistent, getCloseHandler, buildProps })` → `modal.open() / close() / destroy()`。persistent 模式：关闭时隐藏 DOM 保留 Vue 实例，适合需后台响应事件的组件——在 `init()` 中先 open 再 close 触发 mount 注册监听器。

> 代码示例见 [CLAUDE_RULES.md](./CLAUDE_RULES.md#modal-弹窗)

### 事件

`emitCustomEvent(name, detail?, { useMicrotask? })` — 默认 `bubbles=true, cancelable=true, target=window`。

> 代码示例见 [CLAUDE_RULES.md](./CLAUDE_RULES.md#事件)

### 状态栏后台任务

`useStatusBarTask(taskId, icon)` → `task.progress({ label, percent?, phase? }) / complete(label, detail?) / fail(label) / clear()`。状态栏模板自动遍历活跃任务渲染。

> 代码示例见 [CLAUDE_RULES.md](./CLAUDE_RULES.md#状态栏后台任务)

### DOM 操作

`copyToClipboard / triggerDownload / triggerBlobDownload / injectStyle / removeStyle` from `@/utils/domUtils`。

> 代码示例见 [CLAUDE_RULES.md](./CLAUDE_RULES.md#dom-操作)

### Node 模块加载

`getNodeModules()` → `{ fs, path }`、`getNodeProcessModules()` → `{ child_process, os }`、`getNodeFsPathOs()` → `{ fs, path, os }`。仅在 Electron 环境可用。

> 代码示例见 [CLAUDE_RULES.md](./CLAUDE_RULES.md#node-模块加载)

### 加密

配置加密 `encryptSetting/decryptSetting`（应用内嵌密钥），加密基元 `deriveAESKey/aesGcmEncrypt/aesGcmDecrypt`（各模块用自身密钥策略）。

> 代码示例见 [CLAUDE_RULES.md](./CLAUDE_RULES.md#加密)

### AI 调用

`getApiConfigFromPlugin(plugin)` 提取配置 → `callAI(prompt, config, opts?) / callAIStream(...)`。类型定义在 `src/types/ai.ts`。

> 代码示例见 [CLAUDE_RULES.md](./CLAUDE_RULES.md#ai-调用)

### 功能开关

`loadFeatureFlagsSync()` 同步读取开关（`addDock` 等 API 必须同步完成），开关 key 映射 `featureId → enableXxx`（缩写词需在 `FEATURE_ID_TO_KEY_MAP` 处理）。

> 代码示例见 [CLAUDE_RULES.md](./CLAUDE_RULES.md#功能开关)

### 全局设置

`loadSettings(plugin) / saveSettings(plugin, settings)` — 注意 `settings.ts` 是唯一允许直接调用 `plugin.loadData/saveData` 的例外。

> 代码示例见 [CLAUDE_RULES.md](./CLAUDE_RULES.md#全局设置)

## 文件路径

`getFile/putFile/removeFile` 路径**相对于工作区根目录**（存到 `data/` 子目录必须带 `data/` 前缀）。`getWorkspaceDir()` 获取工作区路径。`(this as any).dataDir` 格式为 `{workspace}/data/storage/petal/{pluginName}`。使用 `require("node:...")` 的模块需在 `vite.config.ts` 的 `external` 中声明。

> 代码示例见 [CLAUDE_RULES.md](./CLAUDE_RULES.md#文件路径)

## 添加新功能

### 目录结构

```
src/features/myFeature/
├── index.ts               # registerMyFeature() 导出
├── index.vue              # 主面板
├── types/
│   ├── index.ts           # 类型 + Manager 类（不放 register 函数）
│   └── storage.ts         # class MyFeatureStorage { ... TypedStorage }
├── composables/
│   └── useFeature.ts      # 面板与弹窗共享逻辑
├── components/            # 子组件
└── styles/index.scss
```

### 注册清单（8 步，缺一不可）

1. **实现** `index.ts` 导出 `registerMyFeature()`
2. **类型** `types/index.ts` 仅放类型和 Manager，不放 register 函数
3. **导出** `src/features/index.ts` 添加 `from "./myFeature"`，同步更新 `_Registered` 类型（否则编译报错）
4. **注册** `src/index.ts` → `registerFeatures()` 添加 `if (s.enableXxx) registerMyFeature(this)`
5. **开关** `src/config/settings.ts` → `PluginSettings` 加 `enableXxx: boolean` + `DEFAULT_SETTINGS` 加默认值；若 ID 含缩写词需在 `FEATURE_ID_TO_KEY_MAP` 添加映射
6. **i18n** `src/i18n/zh_CN/<feature>.json` + `en_US/<feature>.json` 添加翻译条目（构建时自动合并为 `zh_CN.json`/`en_US.json`，运行 `npm run i18n:verify` 校验键对齐）
7. **配置** `src/features/config.ts` → `FEATURE_CONFIG` 添加条目；纯配置型功能（无 register）需加到 `_ConfigOnly` 白名单
8. **图标** `src/config/icons.ts` → `FEATURE_ICONS` 添加映射，运行 `pnpm validate:icons`

### 简单功能（无面板、无存储）

```typescript
// src/features/myFeature/index.ts
export function registerMyFeature(plugin: Plugin) {
  plugin.addTopBar({
    icon: 'iconSettings',
    title: plugin.i18n.myFeature.title,
    callback: () => { /* 逻辑 */ },
  })
}
```


### 底部面板模式（Tab 切换）

部分工具类功能不需要独立 Dock 面板，适合整合到统一的"底部面板 + Tab 切换"容器中。参考实现：`src/features/toolCollection/`。

**架构要点**：

```
toolCollection/
├── index.ts              # registerToolCollection() + 公开 API（toggle/close/visible）
├── index.vue             # 面板容器：Overlay + Header + Tab 栏 + 内容区 + Transition 动画
├── types/index.ts        # ToolMeta 接口（id/label/icon）
├── styles/index.scss     # 面板样式（固定底部定位、Tab 栏、slide-up 动画）
└── tools/                # 各工具模块（独立子目录，互不依赖）
    └── <toolName>/
        ├── index.vue     # 工具主组件（接收 plugin / i18n props）
        ├── components/   # 工具子组件
        └── styles/       # 工具样式（SCSS 分离）
```

**通信流程**：

1. **触发**：状态栏（或快捷键）→ `emitCustomEvent("toggleToolCollection")`
2. **调度**：`App.vue` 监听 `window.addEventListener("toggleToolCollection", ...)` → 调用 `toggleToolCollection()`
3. **响应**：`toolCollection/index.ts` 导出模块级 `ref(visible)` + `toggleToolCollection()` / `closeToolCollection()`
4. **清理**：`onunload()` 中 `app.unmount()` + `container.remove()` + 重置 `ref`

**注册新工具到面板**：在 `toolCollection/index.vue` 的 `tools` computed 中添加条目 + 在 `<div class="tool-collection-content">` 中添加 `v-if` 组件引用。无需修改注册清单。

### 快捷键注册

通过 `plugin.addCommand()` 注册全局快捷键，在 `registerFeature()` 中调用：

```ts
plugin.addCommand({
  langKey: "toggleToolCollection", // i18n 键（命令名称，显示在快捷键设置界面）
  langText: "工具合集", // 回退文本（i18n 缺失时使用）
  hotkey: "⌃⌥T", // macOS 风格：⌃=Ctrl ⌥=Alt ⌘=Cmd ⇧=Shift；Windows 自动转换
  callback: () => {
    toggleToolCollection() // 回调函数
  },
})
```

**hotkey 格式**：
| 符号 | 按键 | 示例 |
|------|------|------|
| `⌃` | Ctrl | `⌃T` = Ctrl+T |
| `⌥` | Alt | `⌃⌥E` = Ctrl+Alt+E |
| `⌘` | Cmd | `⌘K` = Cmd+K |
| `⇧` | Shift | `⇧⌃P` = Ctrl+Shift+P |

快捷键的 `langKey` 需要对应 i18n 分片文件中的翻译键。思源框架会自动将 macOS 符号转换为 Windows 键名显示。

### 新增功能完整流程（8 步演练）

以 `toolCollection` 为例，展示从零到一完整步骤：

| 步骤 | 位置 | 操作 | toolCollection 实例 |
|------|------|------|---------------------|
| 1. **实现** | `src/features/<name>/index.ts` | 导出 `registerXxx(plugin)` + 公开 API（ref/函数） | `registerToolCollection()` + `toggleToolCollection`/`closeToolCollection`/`toolCollectionVisible` |
| 2. **类型** | `src/features/<name>/types/index.ts` | 接口/类型定义（不放 register 逻辑） | `ToolMeta { id, label, icon }` |
| 3. **导出** | `src/features/index.ts` | 添加 `export { ... } from "./<name>"` + 更新 `_Registered` 联合类型 | 新增 `registerToolCollection`, `toggleToolCollection` 等；`_Registered` 加 `"toolCollection"` |
| 4. **注册** | `src/index.ts` | `registerFeatures()` 中 `if (s.enableXxx) registerXxx(this)` + `onunload()` 清理 | `if (s.enableToolCollection) registerToolCollection(this)` + 清理 app/container |
| 5. **设置** | `src/config/settings.ts` | `PluginSettings` 接口 + `DEFAULT_SETTINGS` 默认值 | `enableToolCollection: boolean` 默认 `true` |
| 6. **i18n** | `src/i18n/{zh_CN,en_US}/<name>.json` | 翻译键值对，运行 `pnpm i18n:verify` | `toolCollection.json`（面板标题、描述、tab 标签、快捷键标签） |
| 7. **配置** | `src/features/config.ts` | `FEATURE_CONFIG` 数组条目；若纯配置型加 `_ConfigOnly` | 新增 `{ id: "toolCollection", defaultTitle: "工具合集", ... }` |
| 8. **图标** | `src/config/icons.ts` | `FEATURE_ICONS` 条目，运行 `pnpm validate:icons` | `toolCollection: { icon: "mdi:toolbox-outline", color: "#6366f1" }` |

**迁移现有功能为 Config-Only**：若功能不再独立注册（如 `base64Image` 迁移到 `toolCollection` 内），需：
- 将 `register` 函数改为 no-op（保留导出以维持编译通过）
- 在 `_ConfigOnly` 白名单中添加该功能 ID
- 从 `_Registered` 联合类型中移除，保留其在 `FeatureId` 中的存在

**验证链条**：完成全部 8 步后，必须通过以下 4 项检查：
```bash
pnpm lint           # ESLint 代码规范
pnpm i18n:verify    # 中英文键对齐
pnpm validate:icons # 图标注册有效性
npx tsc --noEmit    # TypeScript 编译类型检查
```

## i18n 国际化

**分片架构**：源文件按 feature 模块拆分（`src/i18n/{zh_CN,en_US}/featureName.json`），构建时 `scripts/merge-i18n.mjs` 自动合并为思源框架所需的单一 `zh_CN.json` / `en_US.json`。

> ⛔ **硬规则：禁止直接写入 `zh_CN.json` 和 `en_US.json`**
>
> 这两个文件是构建产物，由 `merge-i18n.mjs` 自动生成。**新增或修改 i18n 文本时，必须定位到对应功能的分片文件**（`src/i18n/{zh_CN,en_US}/<feature>.json`），而非直接改大文件。
>
> - 不确定 key 属于哪个分片？→ 在 `zh_CN/` 目录下 grep 搜索
> - 全新增模块？→ 新建 `zh_CN/<feature>.json` + `en_US/<feature>.json`
> - 修改完成后 → 运行 `npm run i18n:merge` 重新生成大文件（构建时自动执行）

### 文件规则

| 分片 | 内容 |
|------|------|
| `common.json` | 全局通用键（save/cancel/confirm/delete/copy/edit/close/refresh 等） |
| `pageLock.json` | 页面锁定模块的所有键（含嵌套 `pageLock.*` 和顶层 `enablePageLock*`） |
| `<feature>.json` | 每个功能模块一个文件（命名与 `src/features/` 目录名对应） |

### 命名约定

```
✅ 推荐 — 统一按 feature 模块组织
  src/i18n/zh_CN/wordQuery.json     → plugin.i18n.wordQuery.title
  src/i18n/zh_CN/imageCompressor.json → plugin.i18n.imageCompressor.quality

⚠️ 遗留 — base64Image 使用下划线前缀，暂不重构
  src/i18n/zh_CN/base64Image.json   → plugin.i18n.base64Image_encode
```

### 日常操作

```bash
npm run i18n:merge    # 手动合并（构建时自动执行，通常无需手动调用）
npm run i18n:verify   # 校验 zh_CN 与 en_US 键完全对齐 + 检测重复键
npm run i18n:split    # 从单体 JSON 重新拆分（极少需要，仅在分片损坏时使用）
```

### 新增 i18n 文本

1. 找到对应 feature 的分片文件（如 `src/i18n/zh_CN/wordQuery.json`）
2. 添加键值对
3. 同样在 `src/i18n/en_US/<feature>.json` 添加英文翻译
4. 提交前运行 `npm run i18n:verify` 确保键对齐

### 构建流程

```
vite buildStart
  → execSync("node scripts/merge-i18n.mjs")
    → 读取 src/i18n/zh_CN/*.json → 合并 → 写入 src/i18n/zh_CN.json
    → 读取 src/i18n/en_US/*.json → 合并 → 写入 src/i18n/en_US.json
  → viteStaticCopy 复制产出的 .json 到 dist/i18n/
  → 思源框架读取 dist/i18n/{zh_CN,en_US}.json
```

## 构建与验证

```bash
pnpm vite build       # 构建，关注有无警告/错误
# pnpm vue-tsc --noEmit   # 仅类型检查（更快）
```

常见 Vite 警告：`is dynamically imported by ... but also statically imported` → 改为统一静态 `import`。
