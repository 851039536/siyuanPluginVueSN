# CLAUDE_RULES.md

思源笔记插件 — 详细 API 参考、代码示例、UI 规范。

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
  position: "RightTop", width: 380,
  icon: "iconSettings", title: "标题", type: "my-feature-dock",
  i18n: plugin.i18n.myFeature || {},
  extraProps: { onCustom: handler },  // 可选额外 props
})
```

### Modal 弹窗

```typescript
import { createModalVueApp } from '@/utils/vueAppHelper'

this.modal = createModalVueApp(MyDialog, {
  maskId: "my-feature-mask", width: "90vw", height: "85vh",
  persistent: false,  // true: 关闭时隐藏 DOM 保留 Vue 实例；false: 关闭即销毁
  getCloseHandler: () => this.close.bind(this),
  buildProps: () => ({ onClose: this.close.bind(this), i18n, plugin }),
})
this.modal.open()   // 打开（persistent 模式复用已有实例）
this.modal.close()  // 关闭（persistent 仅 display:none）
this.modal.destroy() // 彻底销毁（persistent 模式卸载时必调）
// this.modal.visible → boolean
```

**persistent 模式注意事项**：Vue 组件在首次 `open()` 时才创建挂载（`onMounted` 触发）。如果组件需要在后台响应自定义事件，必须在 `init()` 中先 open 再 close 以触发 mount 注册监听器——就像定时备份：程序启动后虽然面板没打开，但 `autoBackupTrigger` 监听器已在后台待命，到点自动执行。

```typescript
async init() {
  // ... 初始化逻辑
  this.modal.open()   // 触发 Vue mount，注册事件监听
  this.modal.close()  // 隐藏 DOM，保留 Vue 实例和事件监听
}
```

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

### 实现步骤

**1. 创建 persistent Modal**

```typescript
// index.ts
import { createModalVueApp } from "@/utils/vueAppHelper"

class MyFeature {
  private modal: ModalAppInstance

  constructor(plugin: Plugin) {
    this.modal = createModalVueApp(MyPanel, {
      maskId: "my-feature-mask",
      persistent: true,          // 关键：关闭时仅 display:none，不销毁 Vue
      getCloseHandler: () => this.close,
      buildProps: () => ({
        onClose: this.close,
        i18n: plugin.i18n,
        plugin,
      }),
    })
  }
}
```

**2. init() 中预挂载，触发 onMounted 注册监听**

```typescript
async init() {
  this.modal.open()    // 创建 Vue 实例 → onMounted 触发 → addEventListener 注册
  this.modal.close()   // display:none 隐藏 DOM，Vue 实例/监听器保留
  this.startTimer()    // 启动 setInterval 定时器
}

// setInterval 轮询，条件满足时派发事件
private startTimer() {
  this.timer = window.setInterval(() => {
    if (/* 满足触发条件 */) {
      emitCustomEvent("myFeatureTick")
    }
  }, 60000)
}
```

**3. Vue 组件中注册事件监听**

```typescript
// index.vue
import { onMounted, onUnmounted } from "vue"

function handleTick() {
  // 执行后台任务
}

onMounted(() => {
  window.addEventListener("myFeatureTick", handleTick)
})

onUnmounted(() => {
  window.removeEventListener("myFeatureTick", handleTick)
})
```

**4. 插件卸载时彻底清理**

```typescript
// index.ts
public destroy() {
  if (this.timer) {
    clearInterval(this.timer)
    this.timer = null
  }
  this.modal.destroy()   // unmount Vue + 移除 DOM → onUnmounted 触发
}
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

### 状态栏后台任务

任何需要后台执行并显示进度的功能，使用 `useStatusBarTask` 在状态栏展示进度，完成后自动消失。

```typescript
import { useStatusBarTask } from '@/features/statusBar/composables/useStatusBarTask'

// 创建任务句柄（taskId 全局唯一，icon 为 Iconify 图标名）
const task = useStatusBarTask('my-feature', 'ph:archive')

// 更新进度 → 状态栏显示 "导出中 45%"，带脉冲动画
task.progress({ label: '导出中', percent: 45, phase: '压缩' })

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
import { copyToClipboard, fallbackCopyToClipboard } from '@/utils/domUtils'
// 优先 Clipboard API，失败降级到 execCommand
const ok = await copyToClipboard('text')

import { triggerDownload, triggerBlobDownload } from '@/utils/domUtils'
triggerDownload(url, 'file.zip')        // url 或 Blob URL
triggerBlobDownload(blob, 'file.json')  // Blob → 自动 createObjectURL + revoke

import { injectStyle, removeStyle } from '@/utils/domUtils'
injectStyle('my-id', '.cls { color: red; }')  // 幂等：已存在则替换
removeStyle('my-id')
```

### Node 模块加载

```typescript
import { getNodeModules, getNodeProcessModules, getNodeFsPathOs } from '@/utils/nodeModules'

const node = getNodeModules()          // → { fs, path } | null
const proc = getNodeProcessModules()   // → { child_process, os } | null
const all  = getNodeFsPathOs()         // → { fs, path, os } | null
// 仅在 Electron 环境可用，纯浏览器返回 null
```

### 加密

```typescript
// 配置加密（settingsCrypto）：应用内嵌密钥，自动加解密 PluginSettings 敏感字段
import { encryptSetting, decryptSetting, clearCachedKey } from '@/utils/settingsCrypto'
const encrypted = await encryptSetting('plaintext')  // → "enc:iv.ciphertext"
const plain     = await decryptSetting(encrypted)    // 无 enc: 前缀的旧数据直接返回
clearCachedKey()  // 插件卸载时调用

// 加密基元（cryptoPrimitives）：各模块用自身密钥策略，共享底层操作
import { deriveAESKey, aesGcmEncrypt, aesGcmDecrypt, deriveBits } from '@/utils/cryptoPrimitives'
const key = await deriveAESKey(passwordBytes, salt, 100000, 256)
const { iv, ciphertext } = await aesGcmEncrypt(dataBytes, key)
const plaintext = await aesGcmDecrypt(ciphertext, key, iv)
```

### AI 调用

```typescript
import { callAI, callAIStream, getApiConfigFromPlugin } from '@/utils/aiApi'

const config = getApiConfigFromPlugin(plugin)  // 从 PluginSettings 提取 AI 配置
const result = await callAI(prompt, config, { model: 'gpt-4o' })
// 类型: AiProvider, AiApiConfig, AiCallOptions 定义在 src/types/ai.ts
```

### 功能开关

```typescript
// src/index.ts onload 同步阶段（addDock 等 API 必须同步完成）
import { loadFeatureFlagsSync, setFeatureFlagsDir } from '@/config/settings'
setFeatureFlagsDir((this as any).dataDir)
this.settings = { ...DEFAULT_SETTINGS, ...loadFeatureFlagsSync() }

// 开关 key 映射：featureId → enableXxx（qrCode → enableQRCode，aiContentGenerator → enableAIContentGenerator）
// 新功能需在 FEATURE_ID_TO_KEY_MAP 处理缩写词映射
```

### 全局设置

```typescript
import { loadSettings, saveSettings, clearCachedKey } from '@/config/settings'
const settings = await loadSettings(plugin)
await saveSettings(plugin, { ...settings, enableXxx: true })
clearCachedKey()  // 卸载时
// 注意：settings.ts 是唯一允许直接调用 plugin.loadData/saveData 的例外
```

## 文件路径

### getFile / putFile / removeFile

路径**相对于工作区根目录**（不是 `data/`）。存到 `data/` 子目录必须带 `data/` 前缀：

```typescript
import { getFile, putFile } from '@/api'

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

## UI 风格：Codex

**强制规则**：所有新增 feature 的 UI 必须遵循 Codex 风格，使用全局设计 Token，禁止硬编码。

### 全局设计 Token（`src/_variables.scss`）

所有 feature 的 `styles/*.scss` 文件首先 `@use '@/variables.scss' as *;`，以下 Token 全局可用：

```scss
// 圆角 — 禁止硬编码 border-radius
$vp-radius: 6px;     // 卡片/控件/字段标准圆角（优先使用）
$radius-sm: 0.25rem; // 4px  标签/徽章
$radius-md: 0.5rem;  // 8px  section/面板
$radius-lg: 0.75rem; // 12px 弹窗/对话框
$radius-full: 9999px;// 胶囊/药丸形状

// 间距 — 禁止硬编码 padding/gap/margin
$spacing-xs: 4px;    // 紧密间距
$spacing-sm: 8px;    // 元素内间距
$spacing-md: 12px;   // 中等间距（段落/块间）
$spacing-lg: 16px;   // 标准 section 内边距

// 等宽字体栈（路径/版本号/日期/标签/密码字段）
$vp-mono: "JetBrains Mono", "Fira Code", "Cascadia Code", "Consolas", monospace;
```

### 核心规范速查表

| 规则 | 模式 | 关键 CSS |
|------|------|---------|
| **卡片** | 边框优先，禁用阴影 | `border: 1px solid var(--b3-border-color); border-radius: $vp-radius; background: var(--b3-theme-surface);` |
| **卡片 hover** | 边框变色 | `&:hover { border-color: var(--b3-theme-primary); }` |
| **大写标签** | 元信息 key / form label | `font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.45;` |
| **等宽字段** | 路径/版本号/日期/密码 | `font-family: $vp-mono; font-size: 12px;` |
| **focus 发光** | 输入框/控件聚焦 | `box-shadow: 0 0 0 2px var(--b3-theme-primary-lightest);` |
| **分割线** | section 间 | `border-bottom: 1px solid var(--b3-border-color);` 或 `1px dashed` |
| **空状态** | 居中斜体灰字 | `text-align: center; padding: 32px $spacing-lg; font-style: italic; opacity: 0.35;` |
| **按钮** | 主按钮实底 / 次按钮描边 | `&--primary { background: var(--b3-theme-primary); color: #fff; }` / `&--ghost { border: 1px solid; background: transparent; }` |
| **动画** | 统一 0.12s 过渡 | `transition: all 0.12s;` 或 `transition: border-color 0.12s;` |

### `.vp-*` 组件模式库

参考 `src/features/superPanel/styles/index.scss` 中 Codex 标准实现：

#### 弹窗结构

```scss
// 遮罩
.xxx-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 99999; }
// 对话框（边框 + 圆角，禁用 box-shadow）
.xxx-dialog { width: 700px; max-width: 90vw; max-height: 85vh; background: var(--b3-theme-background); border: 1px solid var(--b3-border-color); border-radius: $radius-lg; display: flex; flex-direction: column; overflow: hidden; }
// 头部
.dialog-header { display: flex; align-items: center; justify-content: space-between; padding: $spacing-lg; border-bottom: 1px solid var(--b3-border-color); background: var(--b3-theme-surface); }
// 内容
.dialog-body { flex: 1; overflow-y: auto; padding: $spacing-lg; }
// 底部
.dialog-footer { padding: $spacing-md $spacing-lg; border-top: 1px solid var(--b3-border-color); background: var(--b3-theme-surface); }
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

#### 标签/徽章

```scss
.tag {
  padding: 1px 6px; border-radius: $radius-sm;
  font-size: 10px; font-weight: 700; letter-spacing: 0.04em; text-transform: uppercase;
}
```

### 禁止事项

| ❌ 禁止 | ✅ 必须 |
|----------|--------|
| `box-shadow` 作为卡片/弹窗主要样式 | `border: 1px solid var(--b3-border-color)` + hover `border-color` 变色 |
| `border-radius: 6px` / `12px` 等硬编码 | `$vp-radius` / `$radius-lg` 等全局 Token |
| `padding: 8px` / `16px` 等硬编码 | `$spacing-sm` / `$spacing-lg` 等全局 Token |
| `font-family: monospace` / `"Consolas"` | `font-family: $vp-mono` |
| form label 的自定义字号/字重 | `@include uppercase-label` 或 Codex 10px 大写模式 |
| emoji 表情作为图标 | `<IconWrapper name="iconName">` |
| 每个 feature 各自定义 `$vp-radius` / `$spacing-sm` | 从 `@/variables.scss` 全局统一导入 |

## 强制规则：SCSS 必须分离到 styles/ 目录

**所有 Vue 文件的 SCSS 样式必须提取到独立的 `.scss` 文件**，放置在对应 feature 的 `styles/` 目录下，使用 `@use` 导入。

### 模式要求

```
src/features/myFeature/
├── components/
│   └── MyComponent.vue       # <style lang="scss" scoped> @use "../styles/MyComponent.scss"; </style>
├── styles/
│   ├── _variables.scss       # 共享变量/mixins（下划线前缀表示 partial）
│   ├── MyComponent.scss      # 组件专属样式
│   └── index.scss            # 主入口共享样式（可选）
└── index.vue                 # <style lang="scss"> @use "./styles/variables"; @use "./styles/index.scss"; </style>
```

### 规则

1. **禁止在 `.vue` 文件中编写 SCSS 样式代码**。仅允许 `@use` 导入语句。
2. 每个组件对应一个 `styles/<ComponentName>.scss` 文件。
3. 共享的变量/mixins 放在 `styles/_variables.scss` 或 `styles/_mixins.scss`（以下划线前缀命名）。
4. Feature 主入口 `index.vue` 的样式放在 `styles/index.scss`。
5. 导入路径使用相对路径（`../styles/` 或 `./styles/`）。
6. `@use` 导入的 SCSS 文件会自动参与 Vue 的 scoped 样式编译。

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

## 构建与验证

```bash
pnpm vite build       # 构建，关注有无警告/错误
# pnpm vue-tsc --noEmit   # 仅类型检查（更快）
```

常见 Vite 警告：

| 警告 | 原因 | 处理 |
|------|------|------|
| `is dynamically imported by ... but also statically imported` | 某模块同时被静态和动态导入 | 改为统一静态 `import` |

## 依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| Vue | ^3.3.8 | 前端框架 |
| TypeScript | ^5.0.4 | 类型系统 |
| Vite | ^6.2.1 | 构建工具 |
| siyuan | 1.1.0 | Siyuan API 类型 |
| sass | ^1.62.1 | SCSS 编译（dev） |
| eslint | ^9.22.0 | 代码检查（dev / @antfu/eslint-config） |
