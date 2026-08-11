# AGENTS_RULES.md

思源笔记插件 — 详细 API 参考、代码示例、UI 规范。

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

> **强制规则**：新增功能模块时，必须同步在 `vite.config.ts`（`resolve.alias`）与 `tsconfig.json`（`paths`）注册 `@<featureName>` 别名，并更新本清单与 `CODEBUDDY.md` 的「构建流程」章节。遗漏任一文件会导致别名不一致。

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

### 跨功能联动示例

规则见 AGENTS.md 「跨功能联动规则」章节，完整正确示例：

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

## UI 风格：Codex

**强制规则**：所有新增 feature 的 UI 必须遵循 Codex 风格，使用设计 Token，禁止硬编码。

### 全局设计 Token（`src/_variables.scss`）

所有 feature 的 `styles/*.scss` 文件首先 `@use '@/variables.scss' as *;`，以下 Token 全局可用：

```scss
// 圆角 — 禁止硬编码 border-radius
$radius-sm: 0.25rem;    // 4px  标签/徽章
$radius-base: 0.375rem; // 6px  卡片/控件/字段标准圆角（≈ Codex $vp-radius）
$radius-md: 0.5rem;     // 8px  section/面板
$radius-lg: 0.75rem;    // 12px 弹窗/对话框
$radius-full: 9999px;   // 胶囊/药丸形状

// 间距 — 禁止硬编码 padding/gap/margin（注意：使用数字后缀，非 xs/sm/md/lg）
$spacing-2px: 2px; // 超微间距（极窄分隔线间距、图标紧贴）
$spacing-px: 3px; // 微间距（密集 grid gap、极窄 tab padding，小于 $spacing-1 时使用）
$spacing-1: 4px;   // 紧密间距（icon 间距、微型间隙）
$spacing-2: 8px;   // 元素内间距（按钮 padding、小 gap）
$spacing-3: 12px;  // 中等间距（卡片 padding、列表 gap）
$spacing-4: 16px;  // 标准 section 内边距（面板/弹窗 padding）
$spacing-5: 20px;  // 大间距
$spacing-6: 24px;  // 特大间距（header 水平 padding 上限）
// ... $spacing-8 ~ $spacing-16 通常用于布局级间距，UI 组件少用

// 外内原则 — 严格区分 padding（内）与 margin/gap（外）
//   内间距 padding：元素自身内部的留白（按钮内边距、卡片内边距、弹窗 header/body/footer padding）
//   外间距 margin/gap：同级元素之间、框与框之间的分隔间距（section 之间 margin-bottom、grid 列表 gap、header 与内容之间 margin-bottom）
//   禁止混用：不要在元素之间用 padding 撑开间距，也不要在容器内部用 margin 替代 padding

// 字体 — 禁止硬编码 font-size
$font-size-2xs: 0.625rem;  // 10px  仅用于大写标签
$font-size-xs: 0.75rem;   // 12px  小号文字（meta、hint、label）
$font-size-sm: 0.875rem;  // 14px  次要文字
$font-size-base: 1rem;    // 16px  正文、标题（标准字号）
$font-size-lg: 1.125rem;  // 18px  大标题（少用）

// 字重 — 禁止硬编码 font-weight
$font-weight-light: 300;
$font-weight-normal: 400;
$font-weight-medium: 500;
$font-weight-semibold: 600;
$font-weight-bold: 700;

// 行高 — 禁止硬编码 line-height
$line-height-tight: 1.25;
$line-height-normal: 1.5;
$line-height-relaxed: 1.75;
```

> ⚠️ **重要**：上述变量名是 `$spacing-1`~`$spacing-4`（数字后缀），**不是** `$spacing-xs`~`$spacing-lg`。`$spacing-xs/sm/md/lg` 是 superPanel 模块的本地别名，**不存在于全局 `_variables.scss` 中**。错误使用会导致 `Undefined variable` 编译错误。

### Codex 增强 Token（`src/_variables.scss` 已全局定义）

以下 Token 自 2026-06-18 起已收归全局 `_variables.scss`，各模块 **直接可用**，无需本地声明：

```scss
$vp-radius: $radius-base; // 6px — Codex 标准圆角
$vp-mono: "JetBrains Mono", "Fira Code", "Cascadia Code", "Consolas", monospace; // 等宽字体栈
```

> 历史：`$vp-radius`/`$vp-mono` 曾由 `superPanel/styles/variables.scss` 独占，其他模块需本地声明。现已全局化。

### 核心规范速查表

| 规则 | 模式 | 关键 CSS |
|------|------|---------|
| **卡片** | 边框优先，禁用阴影 | `border: 1px solid var(--b3-border-color); border-radius: $vp-radius; background: var(--b3-theme-surface);` |
| **卡片 hover** | 边框变色 | `&:hover { border-color: var(--b3-theme-primary); }` |
| **大写标签** | 元信息 key / form label | `font-size: $font-size-2xs; font-weight: $font-weight-bold; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.45;` |
| **等宽字段** | 路径/版本号/日期/密码 | `font-family: $vp-mono; font-size: $font-size-xs;` |
| **focus 发光** | 输入框/控件聚焦 | `box-shadow: 0 0 0 2px var(--b3-theme-primary-lightest);` |
| **分割线** | section 间 | `border-bottom: 1px solid var(--b3-border-color);` 或 `1px dashed` |
| **空状态** | 居中斜体灰字 | `text-align: center; padding: 32px $spacing-4; font-style: italic; opacity: 0.35;` |
| **按钮** | 主按钮实底 / 次按钮描边 | `&--primary { background: var(--b3-theme-primary); color: #fff; }` / `&--ghost { border: 1px solid; background: transparent; }` |
| **图标按钮** | 固定尺寸，无 padding | `width: 26px; height: 26px; padding: 0; @include flex-center;` icon: `16px`（关闭按钮等） |
| **动画** | 统一 0.12s 过渡 | `transition: all 0.12s;` 或 `transition: border-color 0.12s;` |

### `.vp-*` 组件模式库

参考 `src/features/superPanel/styles/index.scss` 中 Codex 标准实现：

#### 弹窗结构

```scss
// 遮罩
.xxx-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 99999; }
// 对话框（边框 + 圆角，禁用 box-shadow）
.xxx-dialog { width: 700px; max-width: 90vw; max-height: 85vh; background: var(--b3-theme-background); border: 1px solid var(--b3-border-color); border-radius: $radius-lg; display: flex; flex-direction: column; overflow: hidden; }
// 头部（12px/16px padding，标题 ~15px）
.dialog-header { display: flex; align-items: center; justify-content: space-between; padding: $spacing-3 $spacing-4; border-bottom: 1px solid var(--b3-border-color); background: var(--b3-theme-surface); }
// 内容
.dialog-body { flex: 1; overflow-y: auto; padding: $spacing-4; }
// 底部
.dialog-footer { padding: $spacing-3 $spacing-4; border-top: 1px solid var(--b3-border-color); background: var(--b3-theme-surface); }
```

#### 输入框（`.vp-input`）

```scss
.vp-input {
  padding: 7px 10px;
  border: 1px solid var(--b3-border-color); border-radius: $vp-radius;
  background: var(--b3-theme-background); color: var(--b3-theme-on-background);
  font-size: 13px; outline: none; transition: border-color 0.12s, box-shadow 0.12s;

  &:focus { border-color: var(--b3-theme-primary); box-shadow: 0 0 0 2px var(--b3-theme-primary-lightest); }
  &--mono { font-family: $vp-mono; }
}
```

#### Input / Select 组件 size 强制规范

> **强制规则**：所有 `<Input>` 和 `<Select>` 共享组件在弹窗/表单场景中**必须显式指定 `size="small"`**。默认 `size="medium"` 的输入框高度（36px）与 Codex 紧凑风格不匹配，会显得过大。
>
> ```html
> <!-- ✅ 正确 -->
> <Input v-model="name" size="small" placeholder="名称" />
> <Select v-model="category" size="small" :options="opts" />
>
> <!-- ❌  错误 — 默认 medium，过大 -->
> <Input v-model="name" placeholder="名称" />
> ```
>
> **唯一例外**：全宽搜索栏等刻意需要更大视觉权重的场景可以使用 `medium`。

#### 标签/徽章

```scss
.tag {
  padding: 1px 6px; border-radius: $radius-sm;
  font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
}
// 图片计数类 badge（如 "12 张"）用更宽松尺寸：
.image-count {
  padding: 2px 8px; border-radius: $radius-lg;
  font-size: $font-size-xs; font-weight: 500;
}
```

##### Badge 变体（状态胶囊）

```scss
.badge { display: inline-flex; align-items: center; padding: $spacing-1 $spacing-2; border-radius: $radius-full; font-size: $font-size-xs; font-weight: $font-weight-medium; }
.badge--primary { background: var(--b3-theme-primary); color: var(--b3-theme-on-primary); }
.badge--secondary { background: var(--b3-theme-surface); color: var(--b3-theme-on-surface); border: 1px solid var(--b3-border-color); }
.badge--success { background: rgba(22, 163, 74, 0.12); color: var(--b3-theme-success); }
.badge--warning { background: rgba(217, 119, 6, 0.12); color: #d97706; }
.badge--danger { background: rgba(220, 38, 38, 0.12); color: var(--b3-theme-error); }
```

### 禁止事项

| ❌ 禁止 | ✅ 必须 |
|----------|--------|
| `box-shadow` 作为卡片/弹窗主要样式 | `border: 1px solid var(--b3-border-color)` + hover `border-color` 变色 |
| `border-radius: 6px` / `12px` 等硬编码 | `$vp-radius` / `$radius-base` / `$radius-lg` 等全局 Token |
| `padding: 8px` / `16px` 等硬编码 | `$spacing-2` / `$spacing-4` 等全局 Token（数字后缀！） |
| `font-size: 14px` / `16px` 等硬编码 | `$font-size-sm` / `$font-size-base` 等全局 Token |
| `font-weight: 500` / `600` / `700` 等硬编码 | `$font-weight-medium` / `$font-weight-semibold` / `$font-weight-bold` |
| `line-height: 1.25` / `1.5` 等硬编码 | `$line-height-tight` / `$line-height-normal` / `$line-height-relaxed` |
| `font-family: monospace` / `"Consolas"` | `font-family: $vp-mono`（全局可用） |
| `$spacing-xs` / `$spacing-sm` / `$spacing-md` / `$spacing-lg` | `$spacing-1` / `$spacing-2` / `$spacing-3` / `$spacing-4`（数字后缀是全局标准） |
| emoji 表情作为图标 | `<IconWrapper name="iconName">` |
| 图标按钮用 `padding` 控制尺寸 | 固定 `width: 26px; height: 26px; padding: 0;`，icon `16px` |
| 标题 font-size > 16px | 统一 `$font-size-base`（16px），极少数场景可用 15px（如 superPanel-title） |
| 各模块重复声明 `$vp-radius` / `$vp-mono` | 直接从 `@/variables.scss` 继承（已全局定义） |
| 根容器缺基准字号 / JS 硬编码 `font-size: 12px` | 根容器显式声明 `font-size: $font-size-xs`；自建挂载容器补 `vp-dock-root` / `vp-modal-mask` 类 |

## 强制规则：字号层级与全局基准字号

所有 feature 的 UI 一律采用**两级字号制**，并依赖全局基准字号规则兜底（2026-08 起）。

### 两级字号制

| 字号 | Token | 用途 |
|------|-------|------|
| 10px | `$font-size-2xs` | 辅助文字：标签、提示、描述、状态、命令输出、路径、徽章 |
| 12px | `$font-size-xs` | 标题与正文内容（面板/弹窗统一基准字号） |
| 14px+ | `$font-size-sm` 及以上 | 仅限阅读区正文（如 Markdown 预览）与数据突出展示（如统计数值），必须加注释说明用途 |

### 全局基准字号机制

全局样式入口 `src/index.scss` 已定义（经 `src/index.ts:81` 全局加载）：

```scss
:root {
  --vp-font-size-xs: #{$font-size-xs}; // CSS 变量桥接：供 TS 内联样式引用
}

.vp-dock-root,
.vp-modal-mask {
  font-size: $font-size-xs; // 12px 基准
}
```

- **`vp-dock-root`**：`createVueDockApp` 创建的 Dock 容器、`main.ts` 全局宿主、`floatingBox`、`toolCollection` 等自建挂载容器已自动获得该类
- **`vp-modal-mask`**：`createModalVueApp` 创建的 Modal 遮罩自动获得该类，遮罩内联样式用 `var(--vp-font-size-xs, 12px)` 兜底
- **兜底语义**：全局规则仅对「未显式声明字号」的元素生效（CSS 继承）；已显式声明的元素（即使是硬编码错误值）不会被全局覆盖——因此根容器必须主动声明正确字号

### 审查检查点（新增/修改 SCSS 时逐条核对）

1. **根容器显式声明 `font-size: $font-size-xs`**（gitPush 模式：`.git-push-panel { font-size: $font-size-xs; }`）——即使已挂 `vp-dock-root`，显式声明保证语义清晰、不依赖全局类
2. **禁止硬编码字号**：`font-size: 13px / 14px / 10px` 等一律替换为 Token（`$font-size-xs` / `$font-size-2xs` / `$font-size-sm`）
3. **禁止硬编码字重/行高/字体族**：`font-weight: 600` → `$font-weight-semibold`；`line-height: 1.5` → `$line-height-normal`；`font-family: monospace` → `$vp-mono`
4. **自建挂载点必须补类**：任何 `document.createElement("div")` + `createApp().mount()` 的容器，必须加 `vp-dock-root` 类（遮罩加 `vp-modal-mask`），禁止 JS 内联硬编码 `font-size: 12px`
5. **优先复用挂载工具**：新增弹窗/面板优先使用 `createVueDockApp` / `createModalVueApp`（自动获得全局类），禁止自建容器裸挂

### 参考实现

- `src/features/gitPush/styles/`（两级字号制源头实现）
- `src/index.scss`（全局基准规则 + `--vp-font-size-xs` 变量）
- `src/utils/vueAppHelper.ts`（`vp-dock-root` / `vp-modal-mask` 类的自动挂载点）

## 强制规则：Dock 面板侧边栏间距（2026-08-07）

**Dock 面板/弹窗内的滚动内容不得紧贴侧边栏或滚动条**，必须在容器根节点预留右侧间距，否则内容视觉上"贴合"侧边栏，观感拥挤。

### 规则

1. **面板根容器（`overflow-y: auto` 的滚动容器）必须设置 `padding-right`**，至少 `$spacing-2`（8px），为滚动条与侧边栏留出呼吸空间
2. **禁止用 `padding: xxx 0` 省略左右**：左右为 0 时内容会直接贴到侧边栏
3. **使用间距 Token，禁止硬编码 px**：`$spacing-2`(8px) / `$spacing-3`(12px)，按面板宽度与观感选择
4. **一处容器覆盖多 Tab 子页面**：若多个 Tab/子页面共用同一根容器（如 `CodeReportPanel` → `.gpr-panel`），在共用容器上统一加右侧间距即可一次覆盖所有页面

### 审查检查点

1. 新增/修改 Dock 面板、弹窗、报告类滚动容器时，检查根容器是否声明 `padding-right`
2. `padding` 简写省略右值时（如 `$spacing-1 0` 等价于右 0），视为可疑点，需显式补右值
3. 滚动条重叠时右侧间距可适当加大（`$spacing-3`），确保内容不被滚动条遮挡

### 参考实现

- `src/features/gitPush/styles/CodeReportPanel.scss`（`.gpr-panel` 基座：`padding: $spacing-1 $spacing-2 $spacing-1 0`）

## 强制规则：SCSS 必须分离到 styles/ 目录

**所有 Vue 文件的 SCSS 样式必须提取到独立的 `.scss` 文件**，放置在对应 feature 的 `styles/` 目录下，使用 `@use` 导入。

### 模式要求

```
src/features/myFeature/
├── components/
│   └── MyComponent.vue       # <style lang="scss" scoped>
│                             #   @use "../styles/MyComponent.scss";   ← 组件专属
│                             #   @use "../styles/index.scss";         ← 共享模态基座
│                             # </style>
├── styles/
│   ├── _mixins.scss          # 共享变量/mixins（_ 前缀 = partial，仅此用途）
│   ├── MyComponent.scss      # 组件专属样式（PascalCase，无 _ 前缀）
│   ├── index.scss            # 主入口 index.vue 的样式 + 共享基座样式
│   └── ...                   # 其他组件对应 OtherComponent.scss
└── index.vue                 # <style lang="scss" scoped>
                              #   @use "./styles/index.scss";
                              # </style>
```

### 规则

1. **禁止在 `.vue` 文件中编写 SCSS 样式代码**。仅允许 `@use` 导入语句。
2. 每个组件对应一个 `styles/<ComponentName>.scss` 文件（PascalCase，无 `_` 前缀）。
3. **`_` 下划线前缀仅限纯 mixins/变量**（如 `_mixins.scss`、`_variables.scss`）。包含实际 CSS 选择器的样式文件**禁止**使用 `_` 前缀。
4. Feature 主入口 `index.vue` 的样式放在 `styles/index.scss`。此文件同时作为**共享基座**（如 `.vp-overlay`、`.vp-modal-header` 等），子组件通过第二行 `@use "../styles/index.scss"` 导入。
5. **子组件导入模式：双行导入**——第一行导入自身专属 SCSS，第二行导入共享的 `index.scss`：
   ```scss
   @use '../styles/MyComponent.scss';   // 组件专属样式
   @use '../styles/index.scss';         // 共享模态基座 + 公共样式
   ```
6. 导入路径使用相对路径（`../styles/` 或 `./styles/`）。
7. `@use` 导入的 SCSS 文件会自动参与 Vue 的 scoped 样式编译。
8. **响应式就近原则**：`@media` 查询放在对应基类所在文件末尾。组件专属选择器的响应式规则放入组件 SCSS，模态基座等公共类的响应式保留在 `index.scss`。

### 示例

**❌ 错误（内联 SCSS）**:
```vue
<style lang="scss" scoped>
.my-component {
  color: red;
  .nested { font-size: 12px; }
}
</style>
```

**✅ 正确（分离到外部文件）**:
```vue
<style lang="scss" scoped>
@use "../styles/MyComponent.scss";
</style>
```

```scss
// styles/MyComponent.scss
.my-component {
  color: red;
  .nested { font-size: 12px; }
}
```

## 强制规则：Composable 提取

**当 feature 的 `index.vue` 中某块逻辑超过 3 个相关函数/ref，或被 2 个以上组件共享时，必须提取为独立 composable**，不得保留在组件内部，也不得下放到子组件中。

### 判断标准

| 场景 | 做法 |
|------|------|
| `index.vue` 中与某个子领域相关的 ref + 函数 ≥ 3 个 | 提取为 `composables/useXxx.ts` |
| 同一逻辑被 2 个以上 `.vue` 组件复用 | 提取为 composable，各组件共享调用 |
| 逻辑仅 1~2 个函数且仅 1 个 `.vue` 使用 | 可保留在组件内（或放到 `utils.ts` 如果是纯函数） |
| 子组件需要引入父层状态管理（如 `useGitOps`）来自己处理逻辑 | ❌ **禁止**。子组件应保持纯展示，逻辑放在 composable 中由父层编排 |

### 禁止将逻辑下放给子组件

子组件（`components/` 下的 `.vue` 文件）应保持**纯展示组件**角色：接收 props、emit 事件。**禁止**在子组件内部导入 `useXxx` composable 来自行编排业务逻辑。

**反面案例**（下放给子组件）：
```
BranchCommitList.vue 导入 useGitOps → 自己调用 loadCommitLog()
  ↓ 后果：
  · 组件从展示变为容器，职责越界
  · 同一操作在父层和子层各有一份状态管理，产生冲突
  · 破坏架构一致性（其他 git 操作全在父层编排，仅此一个例外）
```

**正确做法**（提取 composable，父层编排）：
```
useCommitLog.ts ← 封装状态 + 函数
  ↑ index.vue 调用，将返回的 ref/函数通过 props 传给子组件
  ↓ BranchCommitList.vue 仅 emit 事件 → 父层 composable 方法处理
```

### Composable 模式要求

所有 composable 必须遵循**工厂函数 + 依赖注入**模式。禁止在 composable 内部直接导入其他 composable，所有外部依赖通过参数对象显式传入：

```typescript
// composables/useXxx.ts
export function useXxx(deps: {
  // 响应式状态（来自其他 composable 的返回值）
  someRef: Ref<SomeType>
  // 异步操作（来自其他 composable 的方法）
  doSomething: (id: string) => Promise<void>
  // 存储槽位（来自 TypedStorage）
  storageSlot: TypedStorage<Type>
}) {
  const { someRef, doSomething, storageSlot } = deps

  // 本 composable 私有的响应式状态
  const localState = ref<Type>(initialValue)

  // 本 composable 的方法
  function handleXxx() { /* ... */ }

  return { localState, handleXxx }
}
```

**关键约束**：

| 规则 | 说明 |
|------|------|
| 依赖注入 | 所有外部依赖必须通过 `deps` 对象传入，禁止在 composable 内部 `import` 其他 composable |
| 返回值解构 | 调用方从返回对象中按需解构：`const { localState, handleXxx } = useXxx({ ... })` |
| 纯函数优先 | 不依赖 Vue 响应式的工具函数放到 `utils.ts`（如 `relativeTime()`），仅在需要 `ref`/`computed`/`watch` 时才创建 composable |
| 单文件单导出 | 一个 `useXxx.ts` 文件只导出一个 `useXxx` 函数 + 可能导出的公共常量 |
| 文件位置 | 放在 feature 的 `composables/` 目录下 |
| 命名规范 | 文件名 `useXxx.ts`，导出函数 `useXxx()` |

### 参考实现

`src/features/gitPush/composables/` 目录是标准模式集：

| Composable | 行数 | 依赖数 | 类型 |
|------------|------|--------|------|
| `useCommitLog.ts` | 62 | 5 个（commitLogs/loadCommitLog/loadBranches/loadStashList/loadTags） | 从 index.vue 提取子领域状态 + 方法 |
| `useProjectFilters.ts` | 139 | 10 个（含 TypedStorage + 多个 Ref） | 筛选/排序管道，options 对象注入 |
| `useTimeUtils.ts` | 50 | 0（纯工具函数，但方便统一 import） | 无响应式依赖的工具集合 |

## 强制规则：文件头注释

所有 `.ts` / `.vue` 文件顶部**必须**包含注释，简要说明文件功能。禁止遗漏或写"TODO"占位。`.scss` 文件不在此规则适用范围内。

**格式**：

```ts
// src/features/xxx/utils/xxx.ts — 文件功能说明
```

或单行（较短）：
```ts
// 文件功能说明
```

**各语言格式规范**：

| 文件类型 | 格式 | 示例 |
|---------|------|------|
| `.ts` / `.tsx` | `// 文件功能说明` | `// 思源 API 请求封装` |
| `.vue` | `<!-- 文件功能说明 -->` | `<!-- 文件上传对话框 -->` |
| `.json` (i18n 分片) | 顶部 JSON 注释 | 非源码文件不要求 |
| `.mjs` (脚本) | `// 文件功能说明` | `// i18n 分片合并脚本` |
| `.md` | 不要求 | — |

**注意点**：
- 注释应**简明扼要**（10~30 字），描述文件的**职责**而非实现细节
- 不要求文件路径前缀，仅写功能说明即可
- `.vue` 文件中注释放在 `<template>` 之前（文件最顶部）
- 新增文件时必须加上，修改已有的文件时建议补上缺失的注释
- i18n JSON 分片文件、配置文件（`vite.config.ts`、`eslint.config.mjs` 等）不强制要求

## 强制规则：单文件行数上限

单文件代码行数是衡量可维护性的关键指标。超过阈值必须拆分重构。

### 分级标准

| 级别 | 行数范围 | 评价 |
|------|---------|------|
| 理想 | ≤ 200 行 | 职责单一，易读易维护 |
| 可接受 | 200 ~ 300 行 | 轻微超限，可留可不拆 |
| 需要关注 | 300 ~ 500 行 | 建议重构，考虑拆分 |
| 严重超标 | 500 ~ 1000 行 | 强烈建议拆分 |
| 必须重构 | ≥ 1000 行 | 不可维护，必须拆分 |

### 不同场景建议

**前端组件（Vue/React）**：

- 理想范围：200 ~ 300 行（多数社区推荐的硬上限）
- 可接受：300 ~ 500 行
- 超过 500 行 → 应拆分逻辑与模板

**单一方法/函数**：

- 最佳实践：≤ 30 行（Rule of 30）
- 超过 50 行 → 应考虑提取子函数

### 关键考量：不只看行数

行数只是表象，真正需要优化的判断标准包括：

| 指标 | 阈值 |
|------|------|
| 行数 | > 300 行应警觉，> 500 行必须拆 |
| 圈复杂度 | 单个函数 > 10 ~ 15 |
| 嵌套深度 | 超过 4 层 |
| 职责数量 | 一个文件做 > 1 件事 |
| PR 变更行数 | > 400 行 reviewers 开始丧失注意力 |

**结论**：300 行是警戒线，500 行是必须优化的硬阈值，1000 行以上属于不可维护代码。但更重要的是职责是否单一，而非机械按行数拆分。

---

## 强制规则：模块提取判定标准

> **核心原则**：重复远比错误抽象便宜。在同一个问题出现 3 次之前，不要抽象。
> — Sandi Metz, *The Wrong Abstraction* (2016)

提取独立文件（模块化）不是"越拆越好"。错误的抽象比重复更难维护——它会固化错误的假设，让后续修改束手束脚。以下规则用于判断**什么条件下必须提取**以及**什么条件下不应提取**。

### 一、Vue 组件提取判定（`components/` 目录）

#### 必须提取（高置信度）

| 条件 | 说明 | 引用 |
|------|------|------|
| 被 **2 个以上**父组件复用 | DRY 原则的最小触发阈值。仅 1 处使用的组件不应提取（除非满足以下其他条件） | Rule of Three |
| 文件超过 **500 行**硬阈值 | 见上方「单文件行数上限」规则 | 项目硬规则 |
| 含有独立复杂的内部状态管理（**≥3 个** `ref`/`reactive` + 对应的操作函数） | 构成一个可独立理解、独立测试的 UI 概念单元 | 单一职责原则 |
| 通过 Vue 官方"紧密耦合组件"测试 | 子组件在父组件语境下有明确独立的子领域含义，且不是单纯的外观包装（如 `TodoListItem` 之于 `TodoList`） | Vue 官方风格指南 § 紧密耦合组件 |

#### 不应提取（过度模块化）

| 条件 | 说明 |
|------|------|
| 仅被 **1 个**父组件使用**且**是薄壳包装 | 仅含 `<slot>` + 极简状态（≤2 个 `ref`）+ 简单 CSS 外壳。提取后父组件反而更难阅读（需跨文件跳跃理解完整 UI 流） |
| 组件 **≤80 行**且无独立业务逻辑 | 拆分带来的文件碎片化成本超过可读性收益 |
| 仅是对原生 HTML 元素的简单封装 | 如 `<div class="card">` 包一层 `<slot>`，没有独立的数据/行为逻辑 |
| 提取后父组件反而**更难阅读** | 代码阅读者需要在 2 个文件间来回跳跃才能理解一个完整的 UI 区域 |

> **反面案例**：`CollapsibleSection.vue` — 仅被 1 个父组件使用、~50 行、仅含 1 个 `expanded` ref + `toggleExpanded` 函数 + `<slot>` 模板。无独立业务逻辑，是典型的薄壳包装，已合并回父组件。

#### Vue 官方补充指引

- **单例组件**（每页只用一次，如 `TheSidebar.vue`）：虽然只出现一次，但代表一个完整的独立 UI 区域（含自己的布局/样式/状态），应独立成文件。使用 `The` 前缀命名。
- **基础组件**（纯展示，如 `BaseButton.vue`）：即使暂时只用一次，因其通用可复用性质，应独立成文件。使用 `Base`/`App` 前缀命名。

### 二、TS 工具函数/常量提取判定（`utils.ts` / `types/index.ts`）

| 条件 | 判定 |
|------|------|
| 被 **2 个以上**文件使用 | **必须提取**（已有规则，CODEBUDDY.md § 功能模块内代码分层） |
| 被 1 个文件使用，但逻辑复杂（**>30 行**） | **可提取**，提取可改善父文件可读性 |
| 被 1 个文件使用，且逻辑简单（**≤10 行**简单映射/常量） | **不应提取**，提取反而增加引用跳转成本 |

### 三、Composable 提取判定（`composables/` 目录）

详见「强制规则：Composable 提取」章节，核心标准：≥3 个相关 `ref`/函数必须提取，2+ 组件共享必须提取，1~2 个函数仅 1 处使用保留在组件内。

### 四、组件文件夹组织标准（`components/` 子目录）

当 feature 的 UI 含 **≥3 个（含 3 个）Tab/子功能**时，`components/` **必须按 Tab/子功能创建子文件夹**分类；平铺大量组件会使目录难以导航（文件数 ≥15 时问题尤为突出）。必须遵循以下分级标准：

#### 必须创建子文件夹（强制）

| 条件 | 说明 | 示例 |
|------|------|------|
| Tab/子功能 **≥3 个** | 每个 Tab/子功能一个文件夹，该 Tab 专属的全部组件（含其图表、列表、弹窗等子组件）归入同一文件夹 | `overview/`、`trend/`、`heatmap/` |
| 存在跨 Tab 复用/面板级常驻组件 | 被 ≥2 个 Tab 引用的组件，或面板级常驻组件（如顶部操作栏），统一放 `common/` 通用文件夹 | `common/StatisticsHeader.vue` |

#### 不应创建子文件夹

| 条件 | 说明 |
|------|------|
| Tab/子功能 **< 3 个** | 扁平结构即可，1-2 个视图分组与平铺无本质区别，反而增加 1 层导航成本 |
| 按组件类型与按 Tab 双重混合分类 | 禁止在 Tab 文件夹之外再保留 `charts/` 这类类型文件夹——同一 Tab 的组件会分散在两处；图表等类型组件应并入其所属 Tab 文件夹 |

#### 子文件夹命名规范

- 使用 **Tab 语义的小写短名**：`overview/` ✅、`distribution/`（对应 notebookDistribution Tab）✅
- 通用文件夹固定命名 `common/`
- 保持小写（遵循项目目录命名惯例）
- 子文件夹数量以 **Tab 数 + common/** 为准，不设额外上限

#### 正面案例

```
# ✅ statistics/components/（7 个 Tab → 7 个 Tab 文件夹 + common/）
components/
├── common/            # 1 个文件：StatisticsHeader（面板级常驻头部）
├── overview/          # 7 个文件（含 BarChart 图表）
├── heatmap/           # 2 个文件
├── activity/          # 2 个文件
├── trend/             # 4 个文件
├── distribution/      # 4 个文件（含 3 个图表）
├── report/            # 5 个文件（含 2 个图表）
└── milestones/        # 6 个文件
```

#### 反面案例

```
# ❌ 类型文件夹与 Tab 文件夹混用 — report Tab 的组件分散在两处
components/
├── charts/            # ReportTrendChart 在这里
│   └── ReportTrendChart.vue
└── report/            # ReportView 却在这里 ← 同一 Tab 两处找
    └── ReportView.vue

# ❌ 跨 Tab 共享组件散落在某个 Tab 文件夹内
components/
├── overview/
│   └── StatisticsHeader.vue   # ← 面板级常驻组件，应放 common/
└── trend/
```

### 快速自检清单

提取前问自己：

1. **这个文件被 2 个以上的地方用到吗？** — 没有 → 大概率不该提取
2. **能用一句话说清这个文件的职责吗？** — 不能 → 职责不清晰，暂不提取
3. **提取后父文件是否反而更难读？** — 是 → 不要提取
4. **这是同一个问题的第 3 次出现吗？** — 不是 → 等到第 3 次再抽象（Rule of Three）

---

## 构建与验证

> **重要**：AI 不得执行 `pnpm vite build` 和 `pnpm lint`。这些验证由用户自行完成。AI 仅负责编写代码，用户自行验证构建和 lint。

常见 Vite 警告：

| 警告 | 原因 | 处理 |
|------|------|------|
| `is dynamically imported by ... but also statically imported` | 某模块同时被静态和动态导入 | 改为统一静态 `import` |

## i18n 不生效问题排查

### 症状

修改 `src/i18n/zh_CN/{feature}.json` 分片文件后，思源中显示仍为旧值或空白（`undefined`），但源码中 key 已存在。

### 根因

`viteStaticCopy` + watch 模式的组合问题：分片文件修改后 watch 触发合并 → 但合并产物（`src/i18n/zh_CN.json`）可能未被 `viteStaticCopy` 可靠地复制到思源工作区目录。导致思源加载的仍是旧版合并 JSON。

### 排查三步法

用同一验证命令模板依次检查三处，key 数应一致且包含目标 key：

```bash
node -e "const j=require('<路径>'); const gp=j.gitPush||j; console.log(Object.keys(gp).length, 'refreshWorkingTree' in gp)"
```

| 步骤 | 路径 | 说明 |
|------|------|------|
| 1. 源分片 | `./src/i18n/zh_CN/gitPush.json` | 确认源文件正确（应返回完整 key 数，如 257） |
| 2. 合并文件 | `./src/i18n/zh_CN.json` | 确认合并产物与源分片一致 |
| 3. 构建产物 | `E:/siyuan2/data/plugins/siyuan-plugin-vite-vue-sn/i18n/zh_CN.json` | 思源工作区路径见 `.env` 的 `VITE_SIYUAN_WORKSPACE_PATH`；key 数不对或缺 key → 构建产物是旧的 |

### 手动修复

```bash
pnpm i18n:merge
copy /Y src\i18n\zh_CN.json "{workspace}\data\plugins\{pluginName}\i18n\zh_CN.json"
copy /Y src\i18n\en_US.json "{workspace}\data\plugins\{pluginName}\i18n\en_US.json"
```
然后**重启思源**（不是 reload 插件），让思源重新读取 i18n 文件。

### 运行时诊断

在 `GitPushManager.init()` 中添加临时日志：
```ts
console.log("[i18n debug]", {
  hasGitPush: !!pluginI18n.gitPush,
  totalKeys: Object.keys(i18n).length,
  refreshWorkingTree: i18n.refreshWorkingTree,
  workingTreeClean: i18n.workingTreeClean,
})
```
在思源 F12 控制台查看输出，确认运行时实际加载的 key 数量和具体值。

### watch 配置

`vite.config.ts` 的 `watch-external` 插件必须同时监听顶层和子目录 i18n 文件：
```ts
const files = await fg([
  "src/i18n/*.json",       // 顶层合并文件
  "src/i18n/**/*.json",    // 子目录分片文件 ← 不可缺少
  "./README*.md",
  "./plugin.json",
])
```

### 注意事项

- 合并后的 `zh_CN.json` 使用嵌套结构：`{ gitPush: { workingTreeClean: "..." } }`
- 代码中通过 `pluginI18n.gitPush || pluginI18n` 兼容嵌套/扁平两种结构
- 模板中已移除所有 `|| '硬编码中文'` 兜底值，i18n 是唯一数据源
- 本项目思源工作区路径：`E:/siyuan2/data/plugins/siyuan-plugin-vite-vue-sn/`

## 强制规则：i18n 只改分片文件

**只改分片文件**（`src/i18n/{zh_CN,en_US}/<feature>.json`）；顶层合并 JSON（`src/i18n/zh_CN.json` / `en_US.json`）由 `pnpm i18n:merge` 脚本自动生成，**禁止手动修改**。

**原因**：
- 顶层两个 JSON 是构建产物，由 `scripts/merge-i18n.mjs` 在构建时自动合并生成，手动修改会被下一次构建覆盖
- 分片文件才是源文件，按 feature 模块组织（`src/i18n/{zh_CN,en_US}/featureName.json`），便于并行协作与 diff

**操作规范**：
- 不确定 key 属于哪个分片？→ 在 `src/i18n/zh_CN/` 目录下 grep 搜索
- 全新增模块？→ 新建 `src/i18n/zh_CN/<feature>.json` + `src/i18n/en_US/<feature>.json`
- 新增键必须中英分片同步添加，修改后运行 `pnpm i18n:verify` 确保键对齐
- 顶层合并文件需要更新时 → 运行 `pnpm i18n:merge` 重新生成（构建时也会自动执行）

## 强制规则：禁止 i18n 硬编码兜底值

模板中 `{{ i18n.xxx || '中文兜底' }}` 模式**禁止使用**。i18n 是 UI 文案的唯一数据源，兜底值会掩盖 i18n 未加载/缺失的 bug。

**❌ 错误**：
```html
<span>{{ i18n.workingTreeClean || '工作区干净' }}</span>
<button :title="i18n.refreshWorkingTree || '刷新工作空间'" />
:placeholder="i18n.commitMessagePlaceholder || '输入提交信息...'"
```

**✅ 正确**：
```html
<span>{{ i18n.workingTreeClean }}</span>
<button :title="i18n.refreshWorkingTree" />
:placeholder="i18n.commitMessagePlaceholder"
```

**原因**：
- 兜底值让 i18n 加载失败变成"静默成功"，开发者永远不知道 key 不存在
- 所有文案应定义在 i18n JSON 的分片中，不在模板中重复
- 如果 i18n 有値 → 显示 i18n 值；如果无值 → 显示空白（暴露问题，及时排查）

> 此规则 2026-07-24 正式生效，从 gitPush 模块 (`WorkingTreePanel.vue`) 移除 17 处兜底值开始推广到全项目。

## 强制规则：AI 调用

所有 AI 调用必须遵循以下规则，完整 API 用法见 [docs/ai-api-usage.md](./docs/ai-api-usage.md)。

1. **统一入口**：AI 调用必须走 `@/utils/aiApi` 导出的 `callAI` / `callAISmart` / `callAIStream` / `callAIChat`。禁止在功能模块中直接 `fetch` 第三方 LLM API。
2. **禁止硬编码**：禁止硬编码 API Key、模型名、端点 URL。必须通过 `getApiConfigFromPlugin(plugin)` 读取超级面板设置（含迁移降级：openai/zhipu → tongyi）。
3. **推荐 `callAISmart`**：新功能默认使用 `callAISmart`（传 `onChunk` 自动走流式，不传走非流式）；仅固定单一模式时才用 `callAI` / `callAIStream`。
4. **DeepSeek 思考模式**：`reasoning_effort` 必须放在 `thinking` 对象内（`thinking: { type: "enabled", reasoning_effort }`）；思考模式下不传 `temperature`；显式关闭必须传 `thinking: { type: "disabled" }`。单次调用 `options.enableThinking` 优先于全局 `config.enableThinking`。
5. **联网搜索**：RAG 先搜后答需开启 `webSearch: true` 且超级面板已配置 `searchConfig`；搜索失败不中断生成（降级为无搜索回答）。
6. **plugin 实例来源**：`plugin` 实例必须通过 props / 注册参数传入，禁止 `(window as any).siyuan`。

> 参考实现：`src/features/aiContentGenerator/`（`useGeneration.ts` 构建 GenerateOptions → `AIContentGenerator.generateContent()` 调 `callAISmart` 透传 `enableThinking` / `reasoningEffort` / `onReasoningChunk`）

## 依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| Vue | ^3.3.8 | 前端框架 |
| TypeScript | ^5.0.4 | 类型系统 |
| Vite | ^6.2.1 | 构建工具 |
| siyuan | 1.1.0 | Siyuan API 类型 |
| sass | ^1.62.1 | SCSS 编译（dev） |
| eslint | ^9.22.0 | 代码检查（dev / @antfu/eslint-config） |
