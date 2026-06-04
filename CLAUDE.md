# CLAUDE.md

思源笔记插件开发指南。

## 项目概述

基于 Vite + Vue 3 + TS 的思源笔记插件合集，采用功能模块化架构。

## 项目架构

```
src/
├── features/                    # 功能模块（38个已实现）
│   ├── config.ts                # 单一数据源：所有功能元数据 + FeatureId 类型（38个条目）
│   ├── index.ts                 # 功能注册函数统一导出
│   ├── superPanel/              # 统一入口面板
│   ├── pageLock/                # 页面锁定
│   ├── tableOfContents/         # 目录生成
│   ├── imageCompressor/         # 图片压缩
│   ├── docNavigation/           # 文档层级导航
│   ├── shortcut/                # 快捷键面板
│   ├── wordQuery/               # 单词查询
│   ├── generalSettings/         # 通用设置（含字体/标题/代码块/列表/高亮/标签钉等）
│   ├── unitConverter/           # 单位转换
│   ├── diskBrowser/             # 本地磁盘浏览器
│   ├── codeImageGenerator/      # 代码图片生成器
│   ├── aiContentGenerator/      # AI内容生成
│   ├── statistics/              # 数据统计
│   ├── encryption/              # 内容加密
│   ├── video/                   # 视频管理器
│   ├── everythingSearch/        # Everything本地搜索
│   ├── statusBar/               # 状态栏
│   ├── floatingToolbar/         # 浮动工具栏
│   ├── floatingBox/             # 悬浮框
│   ├── textDiff/                # 文本对比
│   ├── base64Image/             # Base64图片转换
│   ├── flashcardReading/        # 单词阅读
│   ├── passwordVault/           # 密码箱
│   └── docAnalysis/             # 文档分析
├── components/                  # 共享 shadcn-vue 组件（Avatar/Badge/Button/Card/Chart等）
├── config/                      # 配置管理
│   ├── settings.ts              # 全局设置：PluginSettings 接口 + 默认值 + load/save
│   │                              #   + 功能开关持久化（featureIdToSettingKey / saveFeatureFlagsSync / loadFeatureFlagsSync）
│   └── icons.ts                 # 图标配置：FEATURE_ICONS + COMMON_ICONS + getIconConfig
├── commands/                    # 斜杠命令
├── types/                       # 全局类型定义
│   ├── ai.ts                    # AI API 类型（AiProvider/AiApiConfig/AiCallOptions 等）
│   ├── api.d.ts                 # API 请求/响应类型
│   └── index.d.ts               # 通用类型定义
├── utils/                       # 工具模块
│   ├── aiApi.ts                 # 统一 AI API 调用（callAI/callAIStream/callAISmart）
│   ├── eventBus.ts              # 统一事件总线（emitCustomEvent）
│   ├── pluginStorage.ts         # 存储抽象层（PluginStorage）
│   ├── typedStorage.ts          # 类型安全存储槽（TypedStorage<T>）
│   ├── settingsCrypto.ts        # 敏感配置加密（AES-GCM + PBKDF2，用于 aiApiKey 等敏感字段）
│   ├── iconHelper.ts            # 图标操作工具（replaceTopBarIcon/createIconElement）
│   └── vueAppHelper.ts          # Vue 应用挂载辅助（createVueDockApp/createModalVueApp）
├── i18n/                        # 国际化（zh_CN.json, en_US.json）
├── api.ts                       # Siyuan API 封装
├── index.ts                     # 插件入口（同步读取开关 → 条件注册各功能模块）
└── main.ts                      # Vue 初始化


### 编译时验证链（二重校验）

验证链在 `config.ts`（`FEATURE_CONFIG` → `FeatureId`）与 `features/index.ts` 之间建立二重编译时校验：

```
config.ts                       features/index.ts
  FEATURE_CONFIG                  _Registered / _ConfigOnly
      │                                │
      ▼                                ▼
  FeatureId (联合类型)        _AssertTrue 双向断言
```

**① `features/index.ts` 双向断言**（第 84-96 行）

通过 `_AssertTrue<T extends true>` 泛型接口实现，零运行时开销：

```typescript
interface _AssertTrue<T extends true> {}

// 正向：_Registered 中每个 ID 都必须是有效 FeatureId
type _AssertRegisteredInConfig = _AssertTrue<
  _Registered extends FeatureId ? true : false
>

// 反向：每个需要 register 的 FeatureId 都在 _Registered 中
type _AssertAllCovered = _AssertTrue<
  Exclude<FeatureId, _ConfigOnly> extends _Registered ? true : false
>
```

`_ConfigOnly` 白名单列出了不需要 register 函数的纯配置功能（`qrCode`, `pronunciation`, `skills`, `translate`）。`_Registered` 需手动与 `features/index.ts` 的 export 行保持同步。

**效果**：
| 场景 | 触发 | 结果 |
|------|------|------|
| `config.ts` 新增功能但 `index.ts` 漏导 | `_AssertAllCovered` 失败 | ❌ 编译报错 |
| `config.ts` 删除功能但 `index.ts` 残留导出 | `_AssertRegisteredInConfig` 失败 | ❌ 编译报错 |

### 配置验证链

`src/config/icons.ts`（`FEATURE_ICONS`）→ 图标名称字符串 → `pnpm validate:icons` 脚本检查有效性

## 开发规范

### 必须遵守

- 每个功能目录（`src/features/*/`）下必须有 `README.md`，简要描述该功能的作用
- 新功能必须在 `src/features/superPanel/index.vue` 提供开关
- 优先使用思源内置图标（见下方列表）或 @iconify/vue
- 全局样式导入：`@use "@/index.scss" as *;`
- **存储统一**：所有功能模块必须通过 `PluginStorage`（或 `TypedStorage`）进行数据持久化，禁止直接调用 `plugin.loadData/saveData`
- **AI 统一**：所有 AI API 调用必须通过 `src/utils/aiApi.ts`，禁止在功能模块中直接调用 fetch/axios
- **事件统一**：所有自定义事件派发必须通过 `src/utils/eventBus.ts` 的 `emitCustomEvent` 函数，禁止直接使用 `window.dispatchEvent(new CustomEvent(...))` 或 `document.dispatchEvent(...)`
- **Dock/Modal 统一**：新建 Dock 侧边栏面板必须使用 `src/utils/vueAppHelper.ts` 的 `createVueDockApp()`，新建遮罩弹窗必须使用 `createModalVueApp()`，禁止在功能模块中直接编写 `createApp + mount + appendChild` 或 `mask + container + createApp` 样板代码
- **Composable 复用**：当功能的 Dock 面板和浮动弹窗共享业务逻辑（数据加载、CRUD、导航、播放）时，必须将共享逻辑抽取到 `composables/use*.ts`，禁止在两个组件中各自实例化 `Storage` 并重复实现相同逻辑。参考 `src/features/flashcardReading/composables/`
- **禁止访问全局 siyuan**：禁止通过 `(window as any).siyuan` 访问思源配置或数据。应通过 props 传入 `Plugin` 实例，使用 `plugin.getDataDir()` 等官方 API
- **Vue 事件命名**：自定义 emit 事件名必须使用 camelCase（如 `inputTitle`、`validateTitle`），禁止使用 `kebab-case` 或带冒号的事件名（如 `input:title`），与 ESLint `vue/custom-event-name-casing` 规则一致
- **SQL 统一**：所有 SQL 查询必须通过 `src/api.ts` 的 `sql()` 函数，禁止在功能模块中直接使用 `fetch("/api/query/sql", ...)`
- **图标注册**：新增功能需在 `src/config/icons.ts` 的 `FEATURE_ICONS` 中添加图标映射，并运行 `pnpm validate:icons` 验证
- **类型安全**：Props 接口禁止使用 `any`，应使用具体类型（`Plugin`、`Record<string, string>`、`Partial<T>` 等）
- **无死代码**：禁止保留未使用的函数、变量、接口、导出；composables 返回值只暴露外部实际使用的成员
- **微信宽度规范**：发布到微信的内容必须通过 `normalizeWidths()` 净化固定像素宽度（`width: Npx` → `max-width: 100%; width: auto`），参见 `src/features/htmlViewer/utils/normalizeWidths.ts`
- **功能注册完整性**：新功能必须完成 4 处注册 + 2 处 i18n（详见下方「添加新功能 → 注册步骤」）
- **编辑器配置**：缩进使用 2 空格，文件编码 UTF-8，清理尾随空格（参见 `.editorconfig`）

### 代码风格

项目使用 [@antfu/eslint-config](https://github.com/antfu/eslint-config) 规则集，已通过 eslint.config.mjs 配置：
```bash
# 建议在 IDE 中启用 ESLint 自动修复
# ESLint 规则覆盖：Vue 3 + TypeScript + 导入排序（perfectionist插件）
```

### 共享组件

位置：`src/components/`（基于 shadcn-vue 组件系统）

可用组件：`Avatar`, `Badge`, `Button`, `Card`, `Chart`, `FormField`, `IconWrapper`, `Input`, `Label`, `Loader`, `Select`, `Slider`, `Switch`, `Tag`

大多数组件附带 `.md` 文档，使用前可参考。

### 思源内置图标

```html
<svg><use xlink:href="#iconName"></use></svg>
```

常用图标：`iconAdd`, `iconClose`, `iconSettings`, `iconSearch`, `iconRefresh`, `iconSave`, `iconTrashcan`, `iconSparkles`

完整列表：F12 搜索 `<symbol id="icon...">` 或查看 [官方源码](https://github.com/siyuan-note/siyuan/tree/master/app/src/assets/icons)

## 品牌设计

品牌设计，SCSS 变量在 `src/_variables.scss` 中定义。

```scss
@use '@/index.scss' as *;

.my-component {
  color: $brand-primary;
  font-family: $font-body;
  border-radius: $radius-lg;
}
```

### 常用变量速查

| 类别 | 变量名 | 说明 |
|------|--------|------|
| 颜色 | `$brand-primary` | 主色 |
| 颜色 | `$brand-destructive` | 危险/删除色 |
| 字体 | `$font-heading` | 标题字体 |
| 字体 | `$font-body` | 正文字体 |
| 圆角 | `$radius-sm` ~ `$radius-full` | 小到大圆角 |
| 间距 | `$spacing-1` ~ `$spacing-16` | 4px 倍率间距 |
| 字号 | `$font-size-xs` ~ `$font-size-4xl` | 字阶 |

完整定义见 `src/_variables.scss`。

### UI 风格：Codex

所有 UI 组件默认使用 **Codex 风格**——代码文档式设计语言，强调结构化、可读性、技术感。

核心规范：
- **等宽字体**：版本号、路径、日期、标签等代码类文本使用 `font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace`
- **大写标签**：元信息 key 使用 `font-size: 10px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; opacity: 0.45`
- **边框卡片**：使用 `border: 1px solid var(--b3-border-color)` 而非阴影，hover 时边框变主题色
- **按钮风格**：主按钮 `vp-btn--primary`（实底），次按钮 `vp-btn--ghost`（描边），图标按钮带边框
- **分割线**：section 间使用 `border-bottom: 1px solid` 或 `1px dashed` 分隔
- **focus 发光**：输入框 focus 时 `box-shadow: 0 0 0 2px var(--b3-theme-primary-lightest)`
- **操作按钮**：默认隐藏（`opacity: 0`），父容器 hover 时显示（`opacity: 1`）

参考实现：`src/features/superPanel/components/VersionPanel.vue` + `styles/index.scss` 中的 `.vp-*` 系列类名。

## API 参考

### PluginStorage（统一存储层）

`src/utils/pluginStorage.ts` — 所有持久化操作的基础抽象层。

```typescript
import { PluginStorage } from '@/utils/pluginStorage'

const storage = new PluginStorage(plugin)
await storage.save('key', data)
const data = await storage.load<Type>('key')
const data = await storage.loadWithDefault('key', defaultValue)
```

### TypedStorage\<T\>（推荐模式）

`src/utils/typedStorage.ts` — 类型安全存储槽，推荐用于所有功能模块。

```typescript
import { PluginStorage } from '@/utils/pluginStorage'
import { TypedStorage } from '@/utils/typedStorage'

export class MyFeatureStorage {
  readonly settings = new TypedStorage<Settings>(this.storage, 'myFeature-settings', defaultSettings)
  readonly options = new TypedStorage<Options>(this.storage, 'myFeature-options')

  constructor(private storage: PluginStorage) {}

  async init() {
    const [settings, options] = await Promise.all([
      this.settings.loadOrDefault(),
      this.options.loadOrDefault(),
    ])
    return {
      settings,
      options,
    }
  }
}
```

**API**：
| 方法 | 返回 | 说明 |
|------|------|------|
| `save(value: T)` | `Promise<boolean>` | 保存数据 |
| `load()` | `Promise<T \| null>` | 加载数据，无数据返回 null |
| `loadOrDefault()` | `Promise<T>` | 加载数据，无数据返回默认值（须提供） |
| `remove()` | `Promise<boolean>` | 删除数据 |

### 全局设置（src/config/settings.ts）

全局插件设置使用 `PluginSettings` 接口 + `DEFAULT_SETTINGS` + 直接 `loadData/saveData` 方式（这是整个项目中唯一允许直接调用 `plugin.loadData/saveData` 的例外）。敏感字段（`aiApiKeys`、`searchBochaApiKey`）自动加解密，详见「配置加密」章节。

```typescript
import {
  clearCachedKey,
  loadSettings,

  saveSettings,
} from '@/config/settings'

const settings = await loadSettings(plugin)
await saveSettings(plugin, newSettings)

// 插件卸载时清除加密密钥缓存（内存安全）
clearCachedKey()
```

### 功能开关系统

功能开关允许用户在超级面板中一键启用/禁用各功能模块。开关状态通过 `PluginSettings.enable*` 字段持久化，并在 `src/index.ts` 的 `registerFeatures()` 中控制功能的实际注册。

#### 开关持久化机制

思源 `loadData()` 是异步的，但 `addDock()` 等 API 必须在 `onload` 同步阶段完成。为此采用 **Node.js fs 同步文件 I/O** 做双通道持久化：

```
保存: fs.writeFileSync(文件) → 写入插件 data 目录 feature-flags.json
loadAndApplySettings 异步加载完成后也调用 saveFeatureFlagsSync() 同步回写

读取: fs.readFileSync(文件) → 跨重启可靠
      ↓ 文件不存在/读取失败 → 降级到 localStorage → 降级到 DEFAULT_SETTINGS
```

#### 核心 API

| 函数 | 说明 |
|------|------|
| `featureIdToSettingKey(featureId)` | 功能 ID → 配置键名映射（`qrCode` → `enableQRCode`，`aiContentGenerator` → `enableAIContentGenerator`） |
| `setFeatureFlagsDir(dir)` | 初始化文件持久化目录，onload 中调用 `setFeatureFlagsDir((this as any).dataDir)` |
| `saveFeatureFlagsSync(settings)` | 提取 `enable*` 字段同步写入磁盘 |
| `loadFeatureFlagsSync()` | 同步读取开关配置，返回 `Partial<PluginSettings>` |

```typescript
import {
  loadFeatureFlagsSync,
  setFeatureFlagsDir,
} from '@/config/settings'

// onload 同步阶段读取
setFeatureFlagsDir((this as any).dataDir)
const savedFlags = loadFeatureFlagsSync()
this.settings = {
  ...DEFAULT_SETTINGS,
  ...savedFlags,
}

// 新增功能开关字段时，需在 FEATURE_ID_TO_KEY_MAP 中处理缩写词映射
// 参见 src/config/settings.ts 中的 FEATURE_ID_TO_KEY_MAP
```

#### 条件注册（src/index.ts）

```typescript
private registerFeatures() {
  const s = this.settings
  registerSuperPanel(this)  // 超级面板不可关闭
  if (s.enablePageLock) registerPageLock(this)
  if (s.enableTableOfContents) registerTableOfContents(this)
  // ... 每个功能对应一个 enable* 开关
}
```

#### 开关 UI（超级面板）

每个功能卡片右侧有一个 `Switch` 开关（超级面板自身不显示开关）。切换时通过 `handleToggleFeature()` 更新 `PluginSettings` 并持久化：

```
用户点击 Switch
  → FeatureCard emit("toggle")
    → index.vue emit("toggleFeature")
      → SuperPanelManager.handleToggleFeature()
        → plugin.updateSettings({ [enableXxx]: newValue })
          → saveSettings() 异步持久化 + saveFeatureFlagsSync() 同步缓存
```

### 图标配置系统（src/config/icons.ts）

所有功能图标集中管理，支持验证：

```typescript
import {
  COMMON_ICONS,
  getIconConfig,
} from '@/config/icons'

// 获取功能图标配置
const iconConfig = getIconConfig('statistics') // => { icon: 'iconBarChart', iconClass: 'sn-icon' }

// 公共图标常量
COMMON_ICONS.SETTINGS // iconSettings
COMMON_ICONS.CLOSE // iconClose
```

### AI API 统一模块

`src/utils/aiApi.ts` — 所有 AI 调用的唯一入口。

```typescript
import {
  callAI,
  getApiConfigFromPlugin,
} from '@/utils/aiApi'

const config = getApiConfigFromPlugin(plugin)
const result = await callAI(prompt, config, options)
```

**类型定义**位于 `src/types/ai.ts`：`AiProvider`, `AiApiConfig`, `AiCallOptions`, `GenerateOptions`, `SavedPrompt`

**禁止**：在功能模块中直接调用 fetch/axios 访问 AI API。

### 统一事件触发（emitCustomEvent）

`src/utils/eventBus.ts` — 所有自定义事件派发的唯一入口。

```typescript
import { emitCustomEvent } from '@/utils/eventBus'

emitCustomEvent("toggleSuperPanel")
emitCustomEvent("dock-click", { dockId: "statistics-dock" })
emitCustomEvent("codeblock-collapse-cleanup", undefined, { target: document })
emitCustomEvent("openDialog", { content }, { useMicrotask: true })
```

**参数说明**：
| 参数 | 类型 | 说明 |
|------|------|------|
| `eventName` | `string` | 事件名称 |
| `detail` | `T \| undefined` | 可选的事件负载 |
| `options.bubbles` | `boolean` | 默认 true |
| `options.cancelable` | `boolean` | 默认 true |
| `options.target` | `EventTarget` | 默认 window |
| `options.useMicrotask` | `boolean` | 默认 false，为 true 则使用微任务延迟派发 |

**禁止**：在功能模块中直接编写 `new CustomEvent(...)` / `window.dispatchEvent(...)`。

### 配置加密（settingsCrypto）

`src/utils/settingsCrypto.ts` — 使用 Web Crypto API（AES-GCM + PBKDF2）对 `PluginSettings` 中的敏感字段进行透明加解密。

```typescript
import {
  clearCachedKey,
  decryptSetting,
  encryptSetting,
} from '@/utils/settingsCrypto'

// 加密：enc:base64IV.base64Ciphertext 格式
const encrypted = await encryptSetting('my-api-key')

// 解密：自动识别 enc: 前缀，旧数据直接返回
const plaintext = await decryptSetting(encrypted)

// 清除内存中的派生密钥
clearCachedKey()
```

**算法**：PBKDF2（SHA-256, 100000 轮）派生 256 位 AES-GCM 密钥，每次加密使用随机 12 字节 IV。密钥缓存在内存中，插件卸载时清除。

**安全边界**：防止磁盘明文泄漏（如他人访问工作区文件）。不防御源码反编译攻击。如需更高保护等级，可扩展集成 OS 凭据管理器（keytar）。

### Vue 应用挂载辅助（vueAppHelper）

`src/utils/vueAppHelper.ts` — 封装重复的 Vue 应用创建模式，所有 Dock 面板和 Modal 弹窗的入口。

#### createVueDockApp — Dock 侧边栏面板

```typescript
import { createVueDockApp } from "@/utils/vueAppHelper"

// 标准 Dock 面板注册（替代手工 createApp + mount + appendChild）
createVueDockApp(plugin, MyPanel, {
  icon: "iconSettings",
  title: plugin.i18n.myFeature?.title || "我的功能",
  type: "my-feature-dock",
  width: 380,
  i18n: plugin.i18n.myFeature || {},
  // extraProps: { onCustom: handler }  // 可选的额外 props
})
```

**参数**：
| 参数 | 类型 | 说明 |
|------|------|------|
| `plugin` | `Plugin` | 思源插件实例 |
| `component` | `Component` | Vue SFC 组件 |
| `options.icon` | `string` | Dock 图标名 |
| `options.title` | `string` | Dock 标题 |
| `options.type` | `string` | Dock 类型标识 |
| `options.width` | `number` | 面板宽度（默认 380） |
| `options.i18n` | `Record<string, any>` | 传递给组件的 i18n 对象 |
| `options.extraProps` | `Record<string, any>` | 额外的组件 props（含回调） |

#### createModalVueApp — 遮罩弹窗

```typescript
import { createModalVueApp } from "@/utils/vueAppHelper"

// 在 Manager 构造函数中创建弹窗实例
this.modal = createModalVueApp(MyDialog, {
  maskId: "my-feature-mask",
  width: "90vw",
  height: "85vh",
  getCloseHandler: () => this.close.bind(this),
  buildProps: () => ({
    onClose: this.close.bind(this),
    i18n: this.plugin.i18n,
    plugin: this.plugin,
  }),
})

// 使用 modal.open() / modal.close() 控制显隐
this.modal.open()
this.modal.close()

// 判断是否已打开
if (this.modal.app && this.modal.container) { ... }
```

**返回值 `ModalAppInstance`**：
| 属性 | 类型 | 说明 |
|------|------|------|
| `app` | `VueApp \| null` | Vue 应用实例（关闭时为 null） |
| `container` | `HTMLElement \| null` | DOM 容器元素（关闭时为 null） |
| `open()` | `() => void` | 打开弹窗（已打开时先关闭再重建） |
| `close()` | `() => void` | 关闭弹窗并清理 DOM |

## 国际化（i18n）

所有用户可见文本必须通过 i18n 管理：

```typescript
// 插件中通过 plugin.i18n 访问
plugin.i18n.myFeature.title

// 翻译文件位置
src / i18n / zh_CN.json
src / i18n / en_US.json
```

## 添加新功能

### 完整 Vue 功能（推荐）

参考 `src/features/flashcardReading/` 或 `src/features/passwordVault/`：

```
src/features/myFeature/
├── index.ts               # 注册函数 + 重新导出类型
├── index.vue              # 主面板
├── types/
│   ├── index.ts           # 类型定义（仅类型，不含注册逻辑）
│   └── storage.ts         # 数据存储
├── composables/           # 共享逻辑（面板与弹窗复用）
│   └── useFeature.ts      # 组合式函数（存储、业务逻辑）
├── components/            # 子组件
└── styles/
    └── index.scss
```

**Composable 模式示例**：

```typescript
// composables/useFeature.ts
export function useFeature(plugin: Plugin) {
  const storage = new FeatureStorage(plugin)
  const data = shallowRef<Item[]>([])

  const loadData = async () => {
    data.value = await storage.getAll()
  }

  onMounted(() => loadData())

  return {
    storage,
    data,
    loadData,
  }
}

// index.vue / Dialog.vue 中复用
const {
  storage,
  data,
  loadData,
} = useFeature(props.plugin)
```

**注册步骤（必须全部完成）**：
1. 实现 `index.ts` 导出 `registerMyFeature()`，从 `./types` 导入所需类/函数
2. `types/index.ts` 仅放类型定义和 Manager 类，不放 `register*()` 函数
3. `src/features/index.ts` 中从 `"./myFeature"` 导出（非 `"./myFeature/types"`）
   → 同时更新 `_Registered` 类型添加新功能 ID（否则编译时断言会报错）
4. `src/index.ts` 中条件注册：导入 register 函数，并在 `registerFeatures()` 中添加 `if (s.enableXxx) registerMyFeature(this)`
5. `src/config/settings.ts` 的 `PluginSettings` 接口中添加 `enableXxx: boolean`，`DEFAULT_SETTINGS` 中添加默认值
   → 若功能 ID 含缩写词（如 `qrCode` → `enableQRCode`），须在 `FEATURE_ID_TO_KEY_MAP` 中添加映射
6. `src/i18n/zh_CN.json` 和 `src/i18n/en_US.json` 添加翻译条目
7. `src/features/config.ts` 的 `FEATURE_CONFIG` 中添加条目（自动推导 `FeatureId` 类型）
   → 若功能为纯配置型（无 register 函数），须在 `_ConfigOnly` 白名单中添加
8. `src/config/icons.ts` 的 `FEATURE_ICONS` 中添加图标映射，并运行 `pnpm validate:icons` 验证

### 简单功能（无面板，无存储）

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

## 文件路径规则

### putFile / getFile / removeFile 路径

`src/api.ts` 中的 `putFile(path, isDir, file)` 和 `getFile(path)` 路径**相对于工作区根目录**（不是 `data/` 目录）。

| 调用 | path 示例 | 实际磁盘位置 |
|------|----------|-------------|
| `putFile("assets/x.png", false, blob)` | `assets/x.png` | `{workspace}/assets/x.png` |
| `putFile("data/storage/sc/x.py", false, blob)` | `data/storage/sc/x.py` | `{workspace}/data/storage/sc/x.py` |
| `getFile("data/storage/sc/x.py")` | `data/storage/sc/x.py` | `{workspace}/data/storage/sc/x.py` |

若要存到工作区 `data/` 子目录，path 必须带 `data/` 前缀。

### 插件数据目录

插件自身数据目录可通过 `(this as any).dataDir` 在 `onload` 中获取，格式为 `{workspace}/data/storage/petal/{pluginName}`。从该路径可反推工作区根目录。

### 获取工作区路径

通过思源 API 获取工作区根目录：

```typescript
const resp = await fetch("/api/system/getConf", { method: "POST" })
const data = await resp.json()
const workspaceDir = data?.data?.conf?.system?.workspaceDir || ""
// 示例返回: "E:\\siyuan2"
```

参考实现：`src/features/video/utils/utils.ts` 的 `getWorkspacePath()`。

### Vite 外部模块

使用 `require("node:fs")` / `require("node:path")` / `require("node:os")` / `require("node:child_process")` 的模块，需在 `vite.config.ts` 的 `external` 数组中声明，否则打包后 `require` 调用失效。

## 依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| Vue | ^3.3.8 | 前端框架 |
| TypeScript | ^5.0.4 | 类型系统 |
| Vite | ^6.2.1 | 构建工具 |
| siyuan | 1.1.0 | Siyuan API 类型 |
| @iconify/vue | ^5.0.0 | 图标库 |
| @iconify/json | ^2.2.417 | 图标数据（dev） |
| sass | ^1.62.1 | SCSS 编译（dev） |
| eslint | ^9.22.0 | 代码检查（dev） |

## 资源

- [Siyuan API](https://github.com/siyuan-note/siyuan/blob/master/API.md)
- [Vue 3](https://vuejs.org/) | [Vite](https://vitejs.dev/) | [shadcn-vue](https://www.shadcn-vue.com/docs/theming)
- [@antfu/eslint-config](https://github.com/antfu/eslint-config)
- [.editorconfig](https://editorconfig.org/)
