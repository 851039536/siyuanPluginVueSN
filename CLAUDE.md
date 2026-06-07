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
| 状态栏任务 | 绕过状态栏直接弹通知 | `useStatusBarTask` from `@/features/statusBar/composables/useStatusBarTask` |
| 全局 siyuan | `(window as any).siyuan` | props 传入 Plugin 实例 |

额外的硬规则：

- **功能注册完整性**：新功能必须在 5 处注册（见下方「添加新功能」清单）
- **Composable 复用**：Dock 面板与弹窗共享逻辑时抽取 `composables/use*.ts`，禁止两个组件各自实例化 Storage。参考 `flashcardReading/composables/`
- **Vue 事件命名**：emit 事件必须 camelCase，禁止 kebab-case 或 `input:title` 格式
- **图标注册**：`FEATURE_ICONS` 中添加映射 + 运行 `pnpm validate:icons`
- **README 文档**：每个 `src/features/*/` 目录下必须有 `README.md`
- **全局样式**：`@use "@/index.scss" as *;`
- **优先思源内置图标** 或 @iconify/vue

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

## 依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| Vue | ^3.3.8 | 前端框架 |
| TypeScript | ^5.0.4 | 类型系统 |
| Vite | ^6.2.1 | 构建工具 |
| siyuan | 1.1.0 | Siyuan API 类型 |
| sass | ^1.62.1 | SCSS 编译（dev） |
| eslint | ^9.22.0 | 代码检查（dev / @antfu/eslint-config） |
