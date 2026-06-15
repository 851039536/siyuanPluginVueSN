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

所有 UI 组件默认使用 **Codex 风格**——代码文档式设计语言，强调结构化、可读性、技术感。

核心规范：
- **等宽字体**：版本号、路径、日期、标签等代码类文本使用 `font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace`
- **大写标签**：元信息 key 使用 `font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.45`
- **边框卡片**：使用 `border: 1px solid var(--b3-border-color)` 而非阴影，hover 时边框变主题色
- **按钮风格**：主按钮 `vp-btn--primary`（实底），次按钮 `vp-btn--ghost`（描边），图标按钮带边框
- **分割线**：section 间使用 `border-bottom: 1px solid` 或 `1px dashed` 分隔
- **focus 发光**：输入框 focus 时 `box-shadow: 0 0 0 2px var(--b3-theme-primary-lightest)`

参考实现：`src/features/superPanel/components/VersionPanel.vue` + `styles/index.scss` 中的 `.vp-*` 系列类名。

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
