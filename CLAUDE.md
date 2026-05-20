# CLAUDE.md

思源笔记插件开发指南。

## 项目概述

基于 Vite + Vue 3 + TS 的思源笔记插件合集，采用功能模块化架构。当前共计 **25 个已实现功能模块**，另有若干功能在 FEATURE_CONFIG 中有条目但尚未实现。

## 常用命令

```bash
pnpm install      # 安装依赖
pnpm dev          # 开发模式（热重载）
pnpm build        # 生产构建

# 代码检查
pnpm lint         # ESLint 检查
pnpm lint:fix     # ESLint 自动修复

# 版本发布
pnpm release:patch   # patch bump
pnpm release:minor   # minor bump
pnpm release:major   # major bump
pnpm release:manual  # 手动输入版本

# 图标验证
pnpm validate:icons   # 检查功能图标是否有效
```

## 项目架构

```
src/
├── features/                    # 功能模块（25个已实现）
│   ├── config.ts                # 单一数据源：所有功能元数据 + FeatureId 类型（27个条目）
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
│   ├── docAnalysis/             # 文档分析
│   └── webDAV/                  # WebDAV同步
├── components/                  # 共享 shadcn-vue 组件（Avatar/Badge/Button/Card/Chart等）
├── config/                      # 配置管理
│   ├── settings.ts              # 全局设置：PluginSettings 接口 + 默认值 + load/save
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
│   ├── settingsCrypto.ts        # 敏感配置加密（AES-GCM + PBKDF2，用于 aiApiKey / WebDAV 密码）
│   └── iconHelper.ts            # 图标操作工具（replaceTopBarIcon/createIconElement）
├── i18n/                        # 国际化（zh_CN.json, en_US.json）
├── api.ts                       # Siyuan API 封装
├── index.ts                     # 插件入口（条件注册各功能模块）
└── main.ts                      # Vue 初始化

# 未实现（FEATURE_CONFIG 中已注册但无实现目录/注册函数）
#   - qrCode / 二维码生成
#   - pronunciation / 谐音翻译
#   - skills / 技能库
#   - translate / 英译中替换
```

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
- **图标注册**：新增功能需在 `src/config/icons.ts` 的 `FEATURE_ICONS` 中添加图标映射，并运行 `pnpm validate:icons` 验证
- **功能注册完整性**：新功能必须同时在以下 4 处注册：
  1. `src/features/config.ts` → `FEATURE_CONFIG`
  2. `src/features/index.ts` → 导出注册函数 + 更新 `_Registered` 类型
  3. `src/index.ts` → 条件注册调用
  4. `src/config/icons.ts` → `FEATURE_ICONS` 中添加图标映射
- **编辑器配置**：缩进使用 2 空格，文件编码 UTF-8，清理尾随空格（参见 `.editorconfig`）

### 代码风格

项目使用 [@antfu/eslint-config](https://github.com/antfu/eslint-config) 规则集，已通过 eslint.config.mjs 配置：
```bash
# 建议在 IDE 中启用 ESLint 自动修复
# ESLint 规则覆盖：Vue 3 + TypeScript + 导入排序（perfectionist插件）
```

### 共享组件

位置：`src/components/`（基于 shadcn-vue 组件系统）

可用组件：`Avatar`, `Badge`, `Button`, `Card`, `Chart`, `IconWrapper`, `Input`, `Label`, `Select`, `Slider`, `Switch`, `Tag`, `Textarea`

大多数组件附带 `.md` 文档，使用前可参考。

### 思源内置图标

```html
<svg><use xlink:href="#iconName"></use></svg>
```

常用图标：`iconAdd`, `iconClose`, `iconSettings`, `iconSearch`, `iconRefresh`, `iconSave`, `iconTrashcan`, `iconSparkles`

完整列表：F12 搜索 `<symbol id="icon...">` 或查看 [官方源码](https://github.com/siyuan-note/siyuan/tree/master/app/src/assets/icons)

## 品牌设计

基于 shadcn-vue 设计系统，SCSS 变量在 `src/_variables.scss` 中定义。

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

全局插件设置使用 `PluginSettings` 接口 + `DEFAULT_SETTINGS` + 直接 `loadData/saveData` 方式（这是整个项目中唯一允许直接调用 `plugin.loadData/saveData` 的例外）。

**敏感字段加密**：`aiApiKey` 和 `webdavConfig.password` 在保存时自动使用 Web Crypto API（AES-GCM）加密，加载时自动解密，磁盘上不会明文存储。加密工具在 `src/utils/settingsCrypto.ts`。

```typescript
import type { PluginSettings } from '@/config/settings'
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

### 图标配置系统（src/config/icons.ts）

所有功能图标集中管理，支持验证：

```typescript
import {
  COMMON_ICONS,
  FEATURE_ICONS,
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
import type {
  AiApiConfig,
  GenerateOptions,
} from '@/types/ai'
import {
  callAI,
  callAISmart,
  callAIStream,
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

参考 `src/features/aiContentGenerator/` 或 `src/features/passwordVault/`：

```
src/features/myFeature/
├── index.ts               # 注册函数 + 重新导出类型
├── index.vue              # 主面板
├── types/
│   ├── index.ts           # 类型定义（仅类型，不含注册逻辑）
│   └── storage.ts         # 数据存储（使用 TypedStorage<T>）
├── components/            # 子组件
└── styles/
    └── index.scss
```

`storage.ts` 模板：

```typescript
import type { Plugin } from 'siyuan'
import { PluginStorage } from '@/utils/pluginStorage'
import { TypedStorage } from '@/utils/typedStorage'

export class MyFeatureStorage {
  readonly settings = new TypedStorage<MySettings>(this.storage, 'myFeature-settings', defaultSettings)

  constructor(plugin: Plugin) {
    this.storage = new PluginStorage(plugin)
  }
}
```

**注册步骤（必须全部完成）**：
1. 实现 `index.ts` 导出 `registerMyFeature()`，从 `./types` 导入所需类/函数
2. `types/index.ts` 仅放类型定义和 Manager 类，不放 `register*()` 函数
3. `src/features/index.ts` 中从 `"./myFeature"` 导出（非 `"./myFeature/types"`）
   → 同时更新 `_Registered` 类型添加新功能 ID（否则编译时断言会报错）
4. `src/index.ts` 中条件注册
5. `src/i18n/zh_CN.json` 和 `src/i18n/en_US.json` 添加翻译条目
6. `src/features/config.ts` 的 `FEATURE_CONFIG` 中添加条目（自动推导 `FeatureId` 类型）
   → 若功能为纯配置型（无 register 函数），须在 `_ConfigOnly` 白名单中添加
7. `src/config/icons.ts` 的 `FEATURE_ICONS` 中添加图标映射

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
