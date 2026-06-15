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
export function createPasswordVaultAction(plugin: Plugin): ToolbarAction {
  return createDialogAction({
    id: "passwordVault",
    icon: `<svg>...</svg>`,
    label: plugin.i18n.passwordVault.quickSave,
    eventName: "openPasswordVaultAdd",  // 事件名
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

// ===== App.vue（中心调度）=====
// 唯一允许同时导入两个 feature 的文件
import { openPasswordVaultWithText } from "@/features"

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

## 硬规则

- **功能注册完整性**：新功能必须在 8 处注册（见下方「添加新功能」清单）
- **Composable 复用**：Dock 面板与弹窗共享逻辑时抽取 `composables/use*.ts`，禁止两个组件各自实例化 Storage。参考 `flashcardReading/composables/`
- **Vue 事件命名**：emit 事件必须 camelCase，禁止 kebab-case 或 `input:title` 格式
- **图标注册**：`FEATURE_ICONS` 中添加映射 + 运行 `pnpm validate:icons`
- **README 文档**：每个 `src/features/*/` 目录下必须有 `README.md`
- **全局样式**：`@use "@/index.scss" as *;`
- **优先思源内置图标** 或 @iconify/vue
- **图标规则**：禁止使用 emoji 表情作为图标。使用 `src/config/icons.ts` 中 `FEATURE_ICONS` / `COMMON_ICONS` 已注册的 Iconify 图标（`mdi:xxx`、`carbon:xxx` 等）。需要新图标时在 `icons.ts` 注册映射后引用，浏览图标 https://icon-sets.iconify.design/

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
└── i18n/                   # zh_CN.json / en_US.json
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
6. **i18n** `src/i18n/zh_CN.json` + `en_US.json` 添加翻译条目
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

## 构建与验证

```bash
pnpm vite build       # 构建，关注有无警告/错误
# pnpm vue-tsc --noEmit   # 仅类型检查（更快）
```

常见 Vite 警告：`is dynamically imported by ... but also statically imported` → 改为统一静态 `import`。
