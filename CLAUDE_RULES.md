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
      persistent: true, // 关键：关闭时仅 display:none，不销毁 Vue
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
import {
  onMounted,
  onUnmounted,
} from "vue"

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

```typescript
import {
  callAI,
  callAIStream,
  getApiConfigFromPlugin,
} from '@/utils/aiApi'

const config = getApiConfigFromPlugin(plugin) // 从 PluginSettings 提取 AI 配置
const result = await callAI(prompt, config, { model: 'gpt-4o' })
// 类型: AiProvider, AiApiConfig, AiCallOptions 定义在 src/types/ai.ts
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

#### 布局组件模式（参考代码映射）

以下模式来自参考代码的 Apple 风格布局，已映射到现有 Codex Token：保留边框优先、琥珀/主色强调、无阴影、统一 0.12s 过渡。

##### 应用框架（Sidebar + Header + Content）

```scss
// 局部布局常量（按模块需求声明，不加入全局 Token）
$sidebar-width: 220px;
$header-height: 56px;
$content-max-width: 960px;

.app-layout { display: flex; min-height: 100vh; }

.sidebar {
  width: $sidebar-width; flex-shrink: 0;
  background: var(--b3-theme-surface); border-right: 1px solid var(--b3-border-color);
  padding: $spacing-3 $spacing-2;
  display: flex; flex-direction: column; gap: $spacing-1;
}

.sidebar__item {
  display: flex; align-items: center; gap: $spacing-3;
  padding: $spacing-2 $spacing-3;
  border-radius: $radius-md;
  color: var(--b3-theme-on-surface); font-size: $font-size-sm; font-weight: $font-weight-medium;
  cursor: pointer; transition: background-color 0.12s, color 0.12s;

  &:hover { background: var(--b3-theme-surface-lighter); color: var(--b3-theme-on-background); }
  &--active { background: var(--b3-theme-surface-lighter); color: var(--b3-theme-on-background); }
  .icon { width: 18px; height: 18px; opacity: 0.8; }
}

.main { flex: 1; display: flex; flex-direction: column; min-width: 0; }

.header {
  height: $header-height; flex-shrink: 0;
  display: flex; align-items: center; justify-content: space-between; gap: $spacing-3;
  padding: 0 $spacing-5;
  border-bottom: 1px solid var(--b3-border-color);
  background: var(--b3-theme-background);
}

.header__search {
  display: flex; align-items: center; gap: $spacing-2;
  padding: $spacing-2 $spacing-3;
  background: var(--b3-theme-surface); border: 1px solid var(--b3-border-color);
  border-radius: $radius-full; min-width: 200px;
  input { border: none; background: transparent; outline: none; font-size: $font-size-sm; color: var(--b3-theme-on-background); width: 100%; }
  input::placeholder { color: var(--b3-theme-on-surface-light); }
}

.header__btn-add {
  display: flex; align-items: center; gap: $spacing-1;
  padding: $spacing-2 $spacing-3;
  background: var(--b3-theme-primary); color: var(--b3-theme-on-primary);
  border: 1px solid var(--b3-theme-primary); border-radius: $radius-full;
  font-size: $font-size-sm; font-weight: $font-weight-medium;
  cursor: pointer; transition: opacity 0.12s;
  &:hover { opacity: 0.9; }
}

.content { flex: 1; padding: $spacing-8 $spacing-12; max-width: $content-max-width; }
```

##### Hero Card（首焦区）

```scss
.hero-card {
  display: flex; align-items: center; justify-content: space-between;
  padding: $spacing-8;
  background: var(--b3-theme-surface); border: 1px solid var(--b3-border-color);
  border-radius: $radius-xl; margin-bottom: $spacing-8;
}
.hero-card__content { max-width: 50%; }
.hero-card__title { font-size: $font-size-lg; font-weight: $font-weight-semibold; margin: 0 0 $spacing-2; }
.hero-card__desc { font-size: $font-size-sm; color: var(--b3-theme-on-surface); margin: 0; }
.hero-card__illustration {
  width: 260px; height: 140px; border-radius: $radius-md;
  background: var(--b3-theme-surface-lighter);
  border: 1px dashed var(--b3-border-color);
  display: flex; align-items: center; justify-content: center;
  color: var(--b3-theme-on-surface-light); font-size: $font-size-sm;
}
```

##### Section Header（带标题与徽章）

```scss
.section-header {
  display: flex; align-items: center; gap: $spacing-3; margin-bottom: $spacing-4;
}
.section-header__title { font-size: $font-size-base; font-weight: $font-weight-semibold; margin: 0; }
.section-header__badge {
  display: inline-flex; align-items: center; gap: $spacing-1;
  font-size: $font-size-sm; color: var(--b3-theme-on-surface);
}
.section-header__badge-count { color: var(--b3-theme-on-surface-light); }
```

##### Tabs 分段控制器

```scss
.tabs {
  display: flex; gap: $spacing-1; margin-bottom: $spacing-4; padding: $spacing-1;
  background: var(--b3-theme-surface); border: 1px solid var(--b3-border-color);
  border-radius: $radius-md; width: fit-content;
}
.tab {
  padding: $spacing-2 $spacing-3; border-radius: $radius-sm;
  font-size: $font-size-sm; font-weight: $font-weight-medium;
  color: var(--b3-theme-on-surface); cursor: pointer; transition: all 0.12s;
  border: none; background: transparent;
  &:hover { color: var(--b3-theme-on-background); }
  &--active { background: var(--b3-theme-background); color: var(--b3-theme-on-background); border: 1px solid var(--b3-border-color); }
}
```

##### Connector Card（连接项/列表项）

```scss
.card-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: $spacing-4; }

.connector-card {
  display: flex; align-items: center; gap: $spacing-3;
  padding: $spacing-4;
  background: var(--b3-theme-surface); border: 1px solid var(--b3-border-color); border-radius: $radius-lg;
  transition: border-color 0.12s;
  &:hover { border-color: var(--b3-theme-primary); }
}
.connector-card__icon {
  width: 44px; height: 44px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border-radius: $radius-md; background: var(--b3-theme-background); border: 1px solid var(--b3-border-color);
  color: var(--b3-theme-on-background); font-size: $font-size-lg;
  svg { width: 20px; height: 20px; }
  img { width: 24px; height: 24px; object-fit: contain; }
}
.connector-card__body { flex: 1; min-width: 0; }
.connector-card__title { font-size: $font-size-base; font-weight: $font-weight-semibold; margin: 0 0 $spacing-1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.connector-card__desc { font-size: $font-size-sm; color: var(--b3-theme-on-surface); margin: 0; line-height: $line-height-tight; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.connector-card__action {
  width: 32px; height: 32px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border: 1px solid var(--b3-border-color); border-radius: $radius-full;
  background: transparent; color: var(--b3-theme-on-surface); cursor: pointer; transition: all 0.12s;
  &:hover { border-color: var(--b3-theme-primary); color: var(--b3-theme-primary); }
  &--installed { color: var(--b3-theme-success); border-color: var(--b3-theme-success); background: var(--b3-theme-surface-lighter); }
}
```

##### User Profile（底部账号区）

```scss
.user-profile {
  margin-top: auto;
  display: flex; align-items: center; gap: $spacing-3;
  padding: $spacing-3; border-radius: $radius-md; cursor: pointer;
  transition: background-color 0.12s;
  &:hover { background: var(--b3-theme-surface-lighter); }
}
.user-profile__avatar {
  width: 32px; height: 32px; border-radius: $radius-full;
  background: var(--b3-theme-primary); color: var(--b3-theme-on-primary);
  display: flex; align-items: center; justify-content: center;
  font-size: $font-size-xs; font-weight: $font-weight-semibold;
}
.user-profile__info { flex: 1; min-width: 0; }
.user-profile__name { font-size: $font-size-sm; font-weight: $font-weight-medium; margin: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.user-profile__plan { font-size: $font-size-xs; color: var(--b3-theme-on-surface-light); margin: 0; }
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

## 构建与验证

> **重要**：AI 不得执行 `pnpm vite build` 和 `pnpm lint`。这些验证由用户自行完成。AI 仅负责编写代码，用户自行验证构建和 lint。

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
