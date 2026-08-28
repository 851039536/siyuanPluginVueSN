# AGENTS_API.md

思源笔记插件 — API 参考、代码示例与承载模式（Dock/Modal/持久化/底部面板/独立窗口）。

## 路径别名

项目配置了统一的路径别名，`vite.config.ts` 的 `resolve.alias` 与 `tsconfig.json` 的 `compilerOptions.paths` **必须一一对应**，否则运行正常但编辑器类型解析错位。

| 别名 | 解析目标 | 示例 |
|------|---------|------|
| `@/` | `src/` | `@/utils/aiApi`、`@/config/settings` |
| `@/libs/` | `src/libs/` | `@/libs/siyuan` |
| `@<featureName>` | `src/features/<featureName>` | `@gitPush/...` → `src/features/gitPush/...` |

**功能模块别名清单**（共 40 个，按 `src/features/` 目录一一生成）：

`@aiContentGenerator`、`@apiDebugger`、`@bookmarkMarker`、`@compactMode`、`@dataSnapshot`、`@diskBrowser`、`@docAnalysis`、`@docNavigation`、`@encryption`、`@everythingSearch`、`@flashcardReading`、`@floatingBox`、`@floatingToolbar`、`@formatAssistant`、`@generalSettings`、`@gitPush`、`@htmlViewer`、`@imageCompressor`、`@imageCreation`、`@pageLock`、`@passwordVault`、`@prompts`、`@quickNote`、`@resourceManager`、`@rssReader`、`@s3Backup`、`@s3FileManager`、`@scriptLauncher`、`@shortcut`、`@skillLearning`、`@skillsViewer`、`@statistics`、`@statusBar`、`@superPanel`、`@tableOfContents`、`@textDiff`、`@themeColor`、`@toolCollection`、`@video`、`@websiteNavigation`

```typescript
// 使用示例：以 gitPush 模块为例
import { GitPushManager } from '@gitPush/types'
import { resolveValidPath } from '@gitPush/utils'
```

> **强制规则**：新增功能模块时，必须同步在 `vite.config.ts`（`resolve.alias`）与 `tsconfig.json`（`paths`）注册 `@<featureName>` 别名，并更新本清单。遗漏任一文件会导致别名不一致。

---

## API 参考

### 存储

```typescript
import { PluginStorage } from '@/utils/pluginStorage'
import { TypedStorage } from '@/utils/typedStorage'

// 底层：key-value 存取
const storage = new PluginStorage(plugin)
await storage.save('key', data)
const data = await storage.load<Type>('key')

// 推荐：类型安全存储槽，自带默认值
class MyFeatureStorage {
  readonly items = new TypedStorage<Item[]>(this.s, 'feature-items', [])
  // API: save(value) → boolean | load() → T|null | loadOrDefault() → T | remove() → boolean
  constructor(private s: PluginStorage) {}
}
```

### Dock 面板

```typescript
import { createVueDockApp } from '@/utils/vueAppHelper'

createVueDockApp(plugin, MyPanel, {
  position: "RightTop",
  width: 380,
  icon: "iconSettings",
  title: "标题",
  type: "my-feature-dock",
  i18n: plugin.i18n.myFeature || {},
  extraProps: { onCustom: handler }, // 可选额外 props
})
```

### Modal 弹窗

```typescript
import { createModalVueApp } from '@/utils/vueAppHelper'

this.modal = createModalVueApp(MyDialog, {
  maskId: "my-feature-mask",
  width: "90vw",
  height: "85vh",
  persistent: false, // true: 关闭时隐藏 DOM 保留 Vue 实例；false: 关闭即销毁
  getCloseHandler: () => this.close.bind(this),
  buildProps: () => ({
    onClose: this.close.bind(this),
    i18n,
    plugin,
  }),
})
this.modal.open() // 打开（persistent 模式复用已有实例）
this.modal.close() // 关闭（persistent 仅 display:none）
this.modal.destroy() // 彻底销毁（persistent 模式卸载时必调）
// this.modal.visible → boolean
```

**persistent 模式**：详见下方「Vue 实例常驻模式」章节，包含完整的 4 步实现步骤与关键点速查表。

## Vue 实例常驻模式（Persistent Modal + CustomEvent + 定时器）

**适用场景**：功能需要在后台持续运行（如定时备份、轮询检查、自动刷新），但 UI 面板平时不显示。

### 架构三层

```
┌─ 定时器层（index.ts）───────────────────────────────────┐
│  setInterval(check, 60000)                               │
│    └─ emitCustomEvent("autoBackupTrigger")               │
├─ 事件桥接层（CustomEvent）───────────────────────────────┤
│  window.dispatchEvent(...)    ←→   window.addEventListener│
├─ UI 层（index.vue, persistent modal）────────────────────┤
│  onMounted → addEventListener("autoBackupTrigger", ...)  │
│  关闭弹窗 → display:none（Vue 实例不销毁，监听器存活）    │
│  onUnmounted → removeEventListener（仅插件卸载时触发）    │
└──────────────────────────────────────────────────────────┘
```

### 实现步骤（完整示例）

```typescript
// ===== index.ts =====
import { createModalVueApp } from "@/utils/vueAppHelper"

class MyFeature {
  private modal: ModalAppInstance
  private timer: number | null = null

  constructor(plugin: Plugin) {
    // 1. 创建 persistent Modal
    this.modal = createModalVueApp(MyPanel, {
      maskId: "my-feature-mask",
      persistent: true, // 关键：关闭时仅 display:none，不销毁 Vue
      getCloseHandler: () => this.close,
      buildProps: () => ({ onClose: this.close, i18n: plugin.i18n, plugin }),
    })
  }

  // 2. init() 中预挂载，触发 onMounted 注册监听
  async init() {
    this.modal.open()  // 创建 Vue 实例 → onMounted 触发 → addEventListener 注册
    this.modal.close() // display:none 隐藏 DOM，Vue 实例/监听器保留
    this.startTimer()
  }

  // setInterval 轮询，条件满足时派发事件
  private startTimer() {
    this.timer = window.setInterval(() => {
      if (/* 满足触发条件 */) emitCustomEvent("myFeatureTick")
    }, 60000)
  }

  // 4. 插件卸载时彻底清理
  public destroy() {
    if (this.timer) { clearInterval(this.timer); this.timer = null }
    this.modal.destroy() // unmount Vue + 移除 DOM → onUnmounted 触发
  }
}

// ===== index.vue（3. Vue 组件中注册事件监听）=====
function handleTick() { /* 执行后台任务 */ }
onMounted(() => window.addEventListener("myFeatureTick", handleTick))
onUnmounted(() => window.removeEventListener("myFeatureTick", handleTick))
```

### 关键点

| 关键点 | 说明 |
|--------|------|
| `persistent: true` | Modal 关闭时仅 `display:none`，Vue 实例和响应式状态保留 |
| `modal.open() → modal.close()` | 在 init 中预挂载，确保组件 `onMounted` 触发一次 |
| `destroy()` 调用时机 | 仅在插件 `onunload` 时调用，不在 close 时调用 |
| `onUnmounted` 触发时机 | 仅 `destroy()` 调用时触发，用户手动关闭弹窗不会触发 |
| `emitCustomEvent` | 定时器层和 Vue UI 层之间解耦通信的唯一桥梁 |
| `plugin.__xxx` 引用 | 将实例挂到 plugin 对象上，方便 Vue 组件通过 props.plugin 反向调用定时器方法（如 `restartTimer`） |
| `setInterval` 防抖 | 使用 `timeSinceTimerStart >= 60000` 防止刚启动就立即触发 |
| 频率控制 | 通过 `lastExecutedHour` / `lastExecutedDateStr` 等标志位防止同周期重复执行 |

### 参考实现

`src/features/dataBackup/index.ts` + `index.vue` — 完整的持久后台备份实现，包含三种频率策略（minute/hourly/daily）和设置热重启。

### 事件

```typescript
import { emitCustomEvent } from '@/utils/eventBus'

emitCustomEvent("toggleSuperPanel")
emitCustomEvent("dock-click", { dockId: "xxx" })
emitCustomEvent("openDialog", { content }, { useMicrotask: true })
// 默认值: bubbles=true, cancelable=true, target=window, useMicrotask=false
```

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

### 错误模式与规则清单

| 规则 | 禁止反例（含原因） |
|------|---------------------|
| **Feature 间零直接导入**：任何 feature 目录下的文件不得 `import` 其他 feature（`@/features/*` 的子目录） | `import { xxx } from "@/features/FeatureB"` — 产生硬依赖，破坏模块独立性 |
| **单向数据流**：发起方只负责 `emitCustomEvent`，绝不触碰响应方的状态 | 直接修改 Feature B 的 ref — 跨越模块边界，状态归属混乱 |
| **App.vue 是唯一调度中心**：所有跨功能的事件监听统一在 App.vue 的 `onMounted` 中注册 | 通过全局变量 `(window as any).xxx` 访问 Feature B — 类型不安全，无契约约束 |
| **Public API 契约**：响应方 feature 的 `index.ts` 导出的函数/ref 即为它的 public API | 其他 feature 直接调用（只允许 App.vue 调用） |
| **事件名规范**：使用 camelCase 动词短语（如 `openPasswordVaultAdd`），在 eventBus 中保持唯一 | — |
| **数据透传**：事件 detail 中携带的数据由 App.vue 透传给响应方，双方不共享类型定义 | — |

> 完整代码示例（floatingToolbar → passwordVault 联动）见下方「跨功能联动示例」章节。

### 跨功能联动示例

完整正确示例：

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

### Markdown 渲染

```typescript
import { parseMarkdown, convertHljsToInlineStyles } from '@/utils/mdRenderer'

// 基础渲染（GFM + breaks）
const html = parseMarkdown(md)

// 带代码高亮
const html = parseMarkdown(md, { codeHighlight: true })

// 带内联样式（微信等不支持 class 的平台）
const html = parseMarkdown(md, { codeHighlight: true, inlineStyles: true })

// 通过代码获得标记后的 HTML，再转为内联样式
const highlighted = hljs.highlight(code, { language: lang }).value
const styled = convertHljsToInlineStyles(highlighted)
```

### 状态栏后台任务

任何需要后台执行并显示进度的功能，使用 `useStatusBarTask` 在状态栏展示进度，完成后自动消失。

```typescript
import { useStatusBarTask } from '@/features/statusBar/composables/useStatusBarTask'

// 创建任务句柄（taskId 全局唯一，icon 为 Iconify 图标名）
const task = useStatusBarTask('my-feature', 'ph:archive')

// 更新进度 → 状态栏显示 "导出中 45%"，带脉冲动画
task.progress({
  label: '导出中',
  percent: 45,
  phase: '压缩',
})

// 完成 → 显示 "导出完成"，hover 看详情，5 秒后自动消失
task.complete('导出完成', '已导出 100 条数据')

// 失败 → 显示 "导出失败"，3 秒后自动消失
task.fail('导出失败')

// 立即清除
task.clear()
```

**`task.progress(opts)`** 参数：
| 字段 | 类型 | 说明 |
|------|------|------|
| `label` | `string` | 主显示文本（如"备份中"） |
| `percent` | `number?` | 0-100 进度百分比，有值时显示百分比 + 脉冲动画 |
| `phase` | `string?` | 当前阶段名，显示在 tooltip 中 |

状态栏模板自动遍历活跃任务渲染，无需手动添加 `<MonitorItem>`。

### DOM 操作

```typescript
import {
  copyToClipboard,
  fallbackCopyToClipboard,
  injectStyle,
  removeStyle,

} from '@/utils/domUtils'

import {
  triggerBlobDownload,
  triggerDownload,
} from '@/utils/domUtils' // Blob → 自动 createObjectURL + revoke

// 优先 Clipboard API，失败降级到 execCommand
const ok = await copyToClipboard('text')
triggerDownload(url, 'file.zip') // url 或 Blob URL
triggerBlobDownload(blob, 'file.json')
injectStyle('my-id', '.cls { color: red; }') // 幂等：已存在则替换
removeStyle('my-id')
```

### Node 模块加载

```typescript
import {
  getNodeFsPathOs,
  getNodeModules,
  getNodeProcessModules,
} from '@/utils/nodeModules'

const node = getNodeModules() // → { fs, path } | null
const proc = getNodeProcessModules() // → { child_process, os } | null
const all = getNodeFsPathOs() // → { fs, path, os } | null
// 仅在 Electron 环境可用，纯浏览器返回 null
```

### 加密

```typescript
// 加密基元（cryptoPrimitives）：各模块用自身密钥策略，共享底层操作
import {
  aesGcmDecrypt,
  aesGcmEncrypt,
  deriveAESKey,
  deriveBits,
} from '@/utils/cryptoPrimitives'

// 配置加密（settingsCrypto）：应用内嵌密钥，自动加解密 PluginSettings 敏感字段
import {
  clearCachedKey,
  decryptSetting,
  encryptSetting,
} from '@/utils/settingsCrypto'
  // 插件卸载时调用
const encrypted = await encryptSetting('plaintext') // → "enc:iv.ciphertext"
const plain = await decryptSetting(encrypted) // 无 enc: 前缀的旧数据直接返回
clearCachedKey()
const key = await deriveAESKey(passwordBytes, salt, 100000, 256)
const {
  iv,
  ciphertext,
} = await aesGcmEncrypt(dataBytes, key)
const plaintext = await aesGcmDecrypt(ciphertext, key, iv)
```

### 定时器

统一入口：`TimerRegistry`（`@/utils/timerRegistry`）。所有定时任务（周期/一次性）必须通过它注册，禁止裸 `setInterval` / `setTimeout`。

```typescript
import { TimerRegistry, type TimerHandle } from '@/utils/timerRegistry'

class MyFeature {
  private readonly timers = new TimerRegistry()
  private updateTimer: TimerHandle | null = null

  private startTimer(): void {
    this.updateTimer = this.timers.setInterval(() => {
      // 周期任务回调
    }, 60000)
  }

  private stopTimer(): void {
    this.timers.clear(this.updateTimer)
    this.updateTimer = null
  }

  public destroy(): void {
    this.timers.clearAll() // 兜底清理全部句柄
  }
}
```

要点：
- `TimerRegistry` 为实例级工具（非全局单例），随功能实例生命周期创建与销毁，避免多实例句柄串扰
- 句柄类型统一为 `TimerHandle`（`ReturnType<typeof setInterval>`），消除 `number` / `ReturnType<...>` 混用
- `clear` 幂等且接受 `null`，`clearAll` 供 destroy/stop 兜底清理
- 业务回调与有界轮询语义保持原样，仅注册/清理入口统一

### Dock 预加载

统一入口：`@/utils/dockPreload`。需要启动预载的 Dock 功能（Dock `init` 懒加载，面板挂载晚于插件启动）通过注册表集中管理启动预载、手动/定时刷新与状态栏提示。

```typescript
import {
  getDockPreloadState,
  registerDockPreload,
  refreshDockPreload,
} from '@/utils/dockPreload'
import { refreshStatisticsData } from './composables/useStatistics'

// 1. registerFeature 内注册（同步；labels 从 plugin.i18n.<feature> 提取）
const i18n = (plugin.i18n as Record<string, any>).statistics || plugin.i18n
registerDockPreload({
  id: 'statistics',
  icon: 'mdi:chart-bar',
  labels: {
    refreshing: i18n.statusRefreshing,
    done: i18n.statusRefreshDone,
    failed: i18n.statusRefreshFailed,
  },
  refresh: refreshStatisticsData, // 模块级共享刷新函数
})

// 2. 手动/定时刷新统一入口（带状态栏三态提示 + loading 防重）
await refreshDockPreload('statistics')

// 3. 面板 onMounted 分流：ready→直接用；loading→等待数据到达；idle/error→兜底刷新
const preloadState = getDockPreloadState('statistics')
```

要点：
- 注册表为模块级 `Map`，`registerDockPreload` 幂等（重复注册仅覆盖配置，不重置已达成状态）
- 启动预载由插件启动链路 `runAllDockPreloads()` **串行统一执行**，避免多功能并发全量 SQL 查询形成风暴
- 状态栏文案由注册时 `labels` 提供，解决启动预载时面板未挂载、无法从 props 取 i18n 的问题
- 数据状态由功能自身维护模块级单例（如 statistics 的 `useStatistics`），预载状态由注册表管理
- 插件卸载时 `clearDockPreloads()` 统一清理注册表

### AI 调用

完整用法见 [docs/ai-api-usage.md](./docs/ai-api-usage.md)（唯一 AI 调用参考文档）。

```typescript
// 推荐入口 callAISmart：传 onChunk 自动走流式，否则走非流式
import {
  callAISmart,
  callAI,
  getApiConfigFromPlugin,
} from '@/utils/aiApi'

// 1. 标准模式（非流式）
const config = getApiConfigFromPlugin(plugin) // 自动读取超级面板 provider/apiKey/model
const result = await callAI(prompt, config, {
  systemPrompt: '你是一个专业的助手。',
  temperature: 0.7,
  maxTokens: 1000,
})

// 2. 流式 + DeepSeek 思考模式
const streamResult = await callAISmart(prompt, config, {
  onChunk: (chunk) => { /* 流式正文 */ },
  onReasoningChunk: (chunk) => { /* 思考过程 */ },
  enableThinking: true,       // 单次调用覆盖全局开关
  reasoningEffort: 'high',    // "low" | "high" | "max"
  model: 'deepseek-v4-pro',   // 可选，覆盖全局模型
})
// 类型: AiProvider, AiApiConfig, AiCallOptions, DeepSeekReasoningEffort 定义在 src/types/ai.ts
```

### 功能开关

```typescript
// src/index.ts onload 同步阶段（addDock 等 API 必须同步完成）
import {
  loadFeatureFlagsSync,
  setFeatureFlagsDir,
} from '@/config/settings'

setFeatureFlagsDir((this as any).dataDir)
this.settings = {
  ...DEFAULT_SETTINGS,
  ...loadFeatureFlagsSync(),
}

// 开关 key 映射：featureId → enableXxx（qrCode → enableQRCode，aiContentGenerator → enableAIContentGenerator）
// 新功能需在 FEATURE_ID_TO_KEY_MAP 处理缩写词映射
```

### 全局设置

```typescript
import {
  clearCachedKey,
  loadSettings,
  saveSettings,
} from '@/config/settings'

const settings = await loadSettings(plugin)
await saveSettings(plugin, {
  ...settings,
  enableXxx: true,
})
clearCachedKey() // 卸载时
// 注意：settings.ts 是唯一允许直接调用 plugin.loadData/saveData 的例外
```

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

## 文件路径

### getFile / putFile / removeFile

路径**相对于工作区根目录**（不是 `data/`）。存到 `data/` 子目录必须带 `data/` 前缀：

```typescript
import {
  getFile,
  putFile,
} from '@/api'

await putFile("data/storage/sc/script.py", false, file)
const blob = await getFile("data/storage/sc/script.py")
```

### 获取工作区路径

```typescript
import { getWorkspaceDir } from '@/api'

const dir = await getWorkspaceDir() // "E:\\siyuan2"
```

### 插件数据目录

`(this as any).dataDir` 在 `onload` 中获取，格式为 `{workspace}/data/storage/petal/{pluginName}`。

### Vite 外部模块

使用 `require("node:fs/path/os/child_process")` 的模块需在 `vite.config.ts` 的 `external` 中声明。

## 底部面板模式（Tab 切换）

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

## 独立窗口承载（addTab + openTab + openWindow）

需要「独立窗口 / 浮动窗口」承载 UI 的功能，使用思源官方 API 的 `addTab + openTab + openWindow` 组合实现**双形态承载**：主窗口页签（tab）⇄ 独立浮动窗口。参考实现：`src/features/minimalBrowser/`（BrowserManager）、`src/features/toolCollection/`（ToolCollectionManager，底部面板 + 独立窗口双形态）。

**核心流程**：`plugin.addTab()` 注册自定义页签模型 → `openTab({ custom })` 创建/聚焦主窗口页签 → `openWindow({ tab })` 把同一页签移入浮动窗口。**关闭浮动窗口时思源自动把页签移回主窗口，无需反向操作。**

### API 签名（`siyuan` 包）

```typescript
// 注册自定义页签模型（init 的 this 指向 Custom 实例，this.element 为页签容器）
plugin.addTab({
  type: string,          // 自定义页签类型，如 "minimal-browser-tab"
  init: () => void,      // 挂载 Vue 面板到 this.element
  destroy?: () => void,
})

// 创建/聚焦主窗口页签（页签已打开时思源自动聚焦）
await openTab({
  app: plugin.app,
  custom: { id, icon, title, data? },  // id = `${plugin.name}${TAB_TYPE}`
  position?: "right" | "bottom",
}): Promise<Tab>

// 把页签移入独立浮动窗口
openWindow({ tab, width?, height?, position?: { x, y } })
```

### 实现步骤（Manager 类模式）

1. **Manager 类放 `types/index.ts`**（不在 index.ts），模块级 `let tabRegistered = false` 防重复注册（多窗口场景每个渲染进程只注册一次）：
   - `registerTabModel()`：构造时同步调用 `plugin.addTab`；`init` 回调里 `this.element` 挂载面板（容器补 `vp-dock-root` 类 + 全高 + `overflow: hidden`）
   - `openFloating()`：`await openTab(...)` 成功后 `openWindow({ width, height, tab })`，失败时页签留在主窗口，catch 后 `console.error`
   - `destroy()`：unmount Vue app + 移除容器 DOM
2. **`index.vue` 支持双模式**：新增 `mode` prop（`"overlay" | "tab"`），面板按 mode 条件渲染——tab 模式隐藏 overlay 专属元素（拖拽手柄、尺寸调整、关闭按钮），CSS 用 `.tab-mode` 类覆盖 fixed 定位为静态全高布局
3. **`index.ts` 注册**：register 函数内实例化 Manager + `plugin.addIcons()` 注册页签图标 symbol，挂载 `(plugin as any).__xxx = { openFloating, destroy }` 并加入 `DESTROYABLE_KEYS`
4. **双实例隔离**：底部面板/常驻弹窗打开时点击「在独立窗口打开」应先关闭自身 UI，避免两处同时渲染同一功能
5. **浮动窗口识别**：`getFrontend() === "desktop-window"` 表示当前在独立浮动窗口中，此形态隐藏「在独立窗口打开」按钮
6. **独立窗体 UI 精简（强制）**：浮动窗口页签/窗口标题已标识功能名，面板头部不再显示重复标题字样（如 toolCollection 的 `header-title`"工具合集"）。判定统一用 `isFloating` computed（`getFrontend() === "desktop-window"`）加 `v-if="!isFloating"` 隐藏，仅移除显示字样，功能逻辑零改动

### 关键点速查表

| 关键点 | 说明 |
|--------|------|
| tab 注册时机 | `registerTabModel()` 在 Manager 构造时同步调用（addTab 需同步注册） |
| init 挂载 | init 回调 `this.element` 为页签容器，重复 init 先 unmount 旧实例 |
| 防重复注册 | 模块级 `tabRegistered` 标志，多窗口每渲染进程只注册一次 |
| 页签 id 规范 | `custom.id = ${plugin.name}${TAB_TYPE}` |
| 页签图标 | `plugin.addIcons()` 注册自定义 symbol 后，`custom.icon` 引用该 id |
| openWindow 失败 | 页签自动留在主窗口，catch 后 `console.error` 即可 |
| getFrontend | `"desktop"` = 主窗口 / `"desktop-window"` = 浮动窗口 |
| 独立窗体 UI | `isFloating` 时隐藏面板头部标题等重复字样（页签标题已标识功能名），仅移除显示、不动功能逻辑 |
| Vue 面板挂载 | `createApp` + `h(Panel, { plugin, mode: "tab" })`，容器补 `vp-dock-root` 类 |

> 参考实现：`src/features/minimalBrowser/types/index.ts`（BrowserManager）+ `src/features/toolCollection/types/index.ts`（ToolCollectionManager，overlay/tab 双形态）

## 强制规则：AI 调用

所有 AI 调用必须遵循以下规则，完整 API 用法见 [docs/ai-api-usage.md](./docs/ai-api-usage.md)。

1. **统一入口**：AI 调用必须走 `@/utils/aiApi` 导出的 `callAI` / `callAISmart` / `callAIStream` / `callAIChat`。禁止在功能模块中直接 `fetch` 第三方 LLM API。
2. **禁止硬编码**：禁止硬编码 API Key、模型名、端点 URL。必须通过 `getApiConfigFromPlugin(plugin)` 读取超级面板设置（含迁移降级：openai/zhipu → tongyi）。
3. **推荐 `callAISmart`**：新功能默认使用 `callAISmart`（传 `onChunk` 自动走流式，不传走非流式）；仅固定单一模式时才用 `callAI` / `callAIStream`。
4. **DeepSeek 思考模式**：`reasoning_effort` 必须放在 `thinking` 对象内（`thinking: { type: "enabled", reasoning_effort }`）；思考模式下不传 `temperature`；显式关闭必须传 `thinking: { type: "disabled" }`。单次调用 `options.enableThinking` 优先于全局 `config.enableThinking`。
5. **联网搜索**：RAG 先搜后答需开启 `webSearch: true` 且超级面板已配置 `searchConfig`；搜索失败不中断生成（降级为无搜索回答）。
6. **plugin 实例来源**：`plugin` 实例必须通过 props / 注册参数传入，禁止 `(window as any).siyuan`。

> 参考实现：`src/features/aiContentGenerator/`（`useGeneration.ts` 构建 GenerateOptions → `AIContentGenerator.generateContent()` 调 `callAISmart` 透传 `enableThinking` / `reasoningEffort` / `onReasoningChunk`）

## 强制规则：请求中的加载反馈（2026-08-12）

发起请求（AI 调用、网络请求、耗时操作）时，触发按钮必须给出标准加载反馈：

1. **图标切换**：请求期间按钮图标切换为环形加载图标 `mdi:loading`（或 `svg-spinners:180-ring` 等环形旋转图标），并施加 CSS 旋转动画。
2. **视觉自然**：仅图标旋转（`animation: spin 1s linear infinite`），按钮布局/尺寸不跳动；若按钮已有文字，保留文字仅替换图标；若为纯图标按钮，图标直径不变。
3. **禁用态**：请求期间按钮同时进入 `disabled` 状态，防止重复提交；`loading` ref 用 `isFetching` / `isSubmitting` / `isGenerating` 等语义命名。
4. **结束还原**：请求结束（成功/失败/超时）后 `loading` 置 false，图标恢复原状，禁用解除。
5. **CSS 动画统一**：旋转动画放按钮所在 SCSS 文件（如 `.vp-btn-loading` / `.spin`），禁止内联 style 硬编码动画；`mdi:loading` 图标需在 `src/config/icons.ts` 已注册的图标集中（运行 `pnpm validate:icons`）。

> 参考实现：`src/features/aiContentGenerator/components/GeneratePanel.vue`（`isGenerating` ref + `mdi:loading` 旋转 + disabled）
