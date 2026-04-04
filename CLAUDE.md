# CLAUDE.md

本文件为 Claude Code (claude.ai/code) 在此代码库中工作时提供指导。

## 项目概述

基于 Vite + Vue 3 + TS 构建的思源笔记插件模板。采用基于功能的模块化架构。

## 常用开发命令

### 开发工作流

```bash
# 安装依赖
pnpm install

# 启动开发模式（监听模式 + 热重载）
# 当配置了 VITE_SIYUAN_WORKSPACE_PATH 时，自动构建到思源工作区
pnpm dev

# 生产构建（输出到 ./dist 并创建 package.zip）
pnpm build
```


### 版本发布管理

```bash
# 自动版本递增和打包
pnpm release:patch   # 0.0.1 -> 0.0.2
pnpm release:minor   # 0.0.1 -> 0.1.0
pnpm release:major   # 0.0.1 -> 1.0.0
pnpm release:manual  # 手动输入版本
```

脚本自动执行：

1. 更新 package.json 和 plugin.json 版本号
2. 创建 git 标签
3. 构建生产版本
4. 生成 `package.zip` 用于分发

## 项目架构

### 高层结构

```
src/
├── features/          # 功能模块（模块化架构）
│   ├── superPanel/           # 统一入口面板，模块功能开关集成。
│   ├── tableOfContents/      # 文档目录
│   ├── docNavigation/        # 文档层级导航
│   ├── wordQuery/            # 单词查询
│   ├── generalSettings/      # 通用设置
│   ├── aiContentGenerator/   # AI 内容生成
├── components/        # 共享 Vue 组件
├── config/            # 配置管理
├── commands/          # 斜杠命令
├── api.ts             # Siyuan API 封装
├── index.ts           # 插件入口点
└── main.ts            # Vue 应用初始化
```

### 开发参考

1. `src/index.ts`：插件入口主 `PluginSample` 类继承 Siyuan 的 `Plugin`
- 生命周期：`onload()`, `onunload()`

功能模块

- 每个功能都自包含在 `src/features/[feature-name]/` 中
- 功能导出 `register[FeatureName]()` 函数
- 功能根据 `plugin.settings` 条件性注册
- 所有功能从 `src/features/index.ts` 导出

配置管理 (`src/config/settings.ts`)

- 集中式设置接口：`PluginSettings`
- 独立设置：字体、列表、标题、代码块

Vue 应用结构

- 主应用在 `src/main.ts`（Vue 初始化）
- `src/App.vue`（根组件）
- 设置面板在 `src/components/SettingPanel.vue`
- 共享组件在 `src/components/`

共享组件库

项目提供可复用的共享组件，遵循品牌设计规范：

#### Button 组件

通用按钮组件，支持多种变体和状态。
- 需适配黑白主题，使用思源主题变量

基础用法

```vue
<script setup lang="ts">
import Button from '@/components/Button.vue'
</script>

<template>
  <!-- 主要操作 -->
  <Button variant="primary" @click="handleSubmit">提交</Button>

  <!-- 带图标 -->
  <Button icon="iconSettings" @click="handleSettings">设置</Button>

  <!-- 次要操作 -->
  <Button variant="secondary" @click="handleCancel">取消</Button>

  <!-- 危险操作 -->
  <Button variant="danger" @click="handleDelete">删除</Button>

  <!-- 加载状态 -->
  <Button :loading="isSubmitting">提交中...</Button>

  <!-- 仅图标 -->
  <Button icon="iconClose" size="small" @click="handleClose" />
</template>
```

Props

- `variant`: `'primary' | 'secondary' | 'success' | 'danger' | 'ghost'` (默认: `'primary'`)
- `size`: `'small' | 'medium' | 'large'` (默认: `'medium'`)
- `icon`: `IconKey` - 图标名称
- `iconSize`: `number` (默认: `16`)
- `disabled`: `boolean` (默认: `false`)
- `loading`: `boolean` (默认: `false`)
- `iconPosition`: `'left' | 'right'` (默认: `'left'`)
- `block`: `boolean` (默认: `false`)

详细文档：[src/components/Button.md](src/components/Button.md)

#### IconWrapper 组件

图标包装器，支持 Iconify 图标库。

```vue
<script setup lang="ts">
import IconWrapper from '@/components/IconWrapper.vue'
</script>

<template>
  <IconWrapper name="iconSettings" :size="20" />
</template>
```

## 必须严格执行的规范

- 功能可见性：新功能必须在超级面板：SuperPanelView.vue 中提供开关设置
- 不要直接使用 SVG 文件，可使用 @iconify/vue
- 新功能必须使用技能： frontend-components 进行组件化。
- 如果是全局样式index.scss：导入方式 @use "@/index.scss" as *;

### 共享组件开发规范

创建新共享组件时，请遵循以下原则：

1. 组件位置：所有共享组件放在 `src/components/` 目录
2. 组件文档：为复杂组件创建对应的 `.md` 文档（如 [Button.md](src/components/Button.md)）
3. 使用品牌变量：组件样式必须使用 `src/_variables.scss` 中定义的品牌变量
4. Props 定义：使用 TypeScript 接口定义 Props，并提供详细注释
5. 组件复用：优先使用现有共享组件（Button,IconWrapper,Select,Input），而非重复实现

示例：创建新组件

```vue
<!-- src/components/MyComponent.vue -->
<template>
  <div class="my-component">
    <slot />
  </div>
</template>

<script setup lang="ts">
interface Props {
  / 属性描述 */
  value: string
}

defineProps<Props>()
</script>

<style scoped lang="scss">
@use '@/index.scss' as *;

.my-component {
  color: $brand-dark;
  font-family: $font-body;
}
</style>
```
### 品牌设计规范

本项目采用 **shadcn-vue** 设计系统，基于 HSL 颜色空间，支持亮色/暗色主题切换。

#### 快速使用

```scss
@use '@/index.scss' as *;

// 组件样式
.my-component {
  color: $brand-dark;
  font-family: $font-body;
  border-radius: $radius-lg;
  box-shadow: $shadow-base;
  padding: $spacing-4;
}
```

#### 常用变量

| 类型 | 变量 | 用途 |
|------|------|------|
| 颜色 | `$brand-primary` | 主色（黑色） |
| 颜色 | `$brand-destructive` | 危险色（红） |
| 颜色 | `$brand-success` | 成功色（绿） |
| 颜色 | `$brand-dark / $brand-light` | 深色/浅色文本 |
| 字体 | `$font-heading / $font-body` | 标题/正文字体 |
| 圆角 | `$radius-sm ~ $radius-full` | 4px ~ 完全圆角 |
| 阴影 | `$shadow-sm ~ $shadow-2xl` | 阴影层级 |
| 间距 | `$spacing-1 ~ $spacing-16` | 4px ~ 64px |

#### 完整变量定义

所有变量定义见 [src/_variables.scss](src/_variables.scss)

#### 设计系统参考

- [shadcn-vue 官方文档](https://www.shadcn-vue.com/docs/theming)

## API参考

- 工作区路径：通过 `/api/system/getConf` 获取工作区路径
- 思源 API 使用：参考 `docs/思源笔记 API 使用.md` 文档
- 数据持久化：使用 `src/utils/pluginStorage.ts` 中的 `PluginStorage` 类，避免直接使用 `plugin.loadData()` 和 `plugin.saveData()`，插件生成的数据将保存在 data/storage/petal/<name>/ 目录下。

### PluginStorage 使用示例

```typescript
import { Plugin } from 'siyuan'
import { PluginStorage } from '@/utils/pluginStorage'

// 创建存储实例
const storage = new PluginStorage(plugin)

// 保存数据
await storage.save('my-key', { name: 'value' })

// 加载数据
const data = await storage.load<MyType>('my-key')

// 加载数据（带默认值）
const data = await storage.loadWithDefault('my-key', [])

// 删除数据
await storage.remove('my-key')

// 检查数据是否存在
const exists = await storage.exists('my-key')
```

## 开发指南

### 添加新功能

#### 通用设置模块开发注意事项

在 `generalSettings` 模块中添加新功能时，**必须在 `GeneralSettings` 类的 `init()` 方法中初始化功能**，而不是在 Vue 组件的 `onMounted` 中初始化。

**错误示例**：
```typescript
// ❌ 在 Vue 组件中初始化（不会在插件启动时生效）
onMounted(() => {
  const manager = new MyManager()
  manager.start()
})
```

**正确示例**：
```typescript
// ✅ 在 GeneralSettings.init() 中初始化（插件启动时生效）
public async init() {
  await this.applyMyFeatureStyle()  // 在插件启动时初始化
}

public async applyMyFeatureStyle() {
  const settings = await this.storage.loadMyFeatureSettings()
  if (settings && settings.enabled) {
    this.myManager = new MyManager()
    this.myManager.start()
  }
}
```

参考实现：`DocCountManager`、`HighlightManager`

#### 方式一：简单功能（非 Vue）

适用于简单的工具栏按钮、菜单项等功能。

1. 创建功能目录： `src/features/myFeature/`
2. 实现功能： `src/features/myFeature/index.ts`

```typescript
import { Plugin } from 'siyuan'

export function registerMyFeature(plugin: Plugin) {
  plugin.addTopBar({
    icon: 'iconSettings',
    title: plugin.i18n.myFeature.title,
    callback: () => {
      // 功能逻辑
    }
  })
}
```

3. 在 `src/features/index.ts` 中导出

```typescript
export { registerMyFeature } from './myFeature'
```

4. 添加设置： `src/config/settings.ts`

```typescript
export interface PluginSettings {
  // ... 其他设置
  enableMyFeature: boolean
}

export const DEFAULT_SETTINGS = {
  // ... 其他默认值
  enableMyFeature: true,
}
```

5. `src/index.ts` 中注册

```typescript
if (this.settings.enableMyFeature) {
  registerMyFeature(this)
}
```

6. 添加翻译

在 `src/i18n/zh_CN.json` 中添加功能翻译（格式：`功能名: { key: value }`）。



#### 方式二：Vue 3 SFC 功能（推荐）

适用于需要 UI 界面的复杂功能，参考 [aiContentGenerator](src/features/aiContentGenerator/) 实现。

**目录结构**

```
src/features/myFeature/
├── index.vue              # 主面板组件
├── types/
│   ├── index.ts           # 类型定义和注册函数
│   └── storage.ts         # 数据存储管理（可选）
├── components/            # 子组件（按需）
│   ├── PanelHeader.vue
│   └── MainContent.vue
└── styles/
    └── index.scss         # 功能专属样式
```

**1. 主面板组件 (`index.vue`)**

```vue
<template>
  <div class="my-feature-panel">
    <PanelHeader @toggle-settings="toggleSettings" />
    <!-- 内容区域 -->
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import Button from '@/components/Button.vue'
import PanelHeader from './components/PanelHeader.vue'
import { MyFeatureStorage } from './types/storage'

const props = defineProps<{
  i18n: any
  plugin: any
}>()

const showSettings = ref(false)
const storage = new MyFeatureStorage(props.plugin)

onMounted(async () => {
  await storage.init()
})

function toggleSettings() {
  showSettings.value = !showSettings.value
}
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
```

**2. 注册函数和类型 (`types/index.ts`)**

```typescript
import { Plugin } from 'siyuan'
import { createApp, h } from 'vue'
// @ts-ignore
import MyFeaturePanel from '../index.vue'

export interface MyFeatureOptions {
  // 定义功能选项
}

export class MyFeatureManager {
  private plugin: Plugin

  constructor(plugin: Plugin) {
    this.plugin = plugin
  }

  public init() {
    this.addDock()
  }

  private addDock() {
    const self = this
    this.plugin.addDock({
      config: {
        position: 'RightTop',
        size: { width: 400, height: 0 },
        icon: 'iconSettings',
        title: '我的功能',
        show: false,
      },
      data: {},
      type: 'my-feature-dock',
      init: (dock: any) => {
        const container = document.createElement('div')
        container.style.height = '100%'
        container.style.overflow = 'hidden'

        const app = createApp({
          setup() {
            return () => h(MyFeaturePanel, {
              i18n: self.plugin.i18n,
              plugin: self.plugin,
            })
          }
        })

        app.mount(container)
        dock.element?.appendChild(container)

        dock.__app = app
        dock.__container = container
      },
    })
  }

  public destroy() {
    // 清理逻辑
  }
}

export function registerMyFeature(plugin: Plugin) {
  const manager = new MyFeatureManager(plugin)
  manager.init()
  ;(plugin as any).__myFeature = manager
  return manager
}
```

**3. 存储管理 (`types/storage.ts`)**

```typescript
import { Plugin } from 'siyuan'
import { PluginStorage } from '@/utils/pluginStorage'

export interface MyFeatureSettings {
  // 定义设置接口
  enabled: boolean
}

export class MyFeatureStorage {
  private storage: PluginStorage
  private readonly SETTINGS_KEY = 'my-feature-settings'

  constructor(plugin: Plugin) {
    this.storage = new PluginStorage(plugin)
  }

  async saveSettings(settings: MyFeatureSettings): Promise<boolean> {
    return this.storage.save(this.SETTINGS_KEY, settings)
  }

  async loadSettings(): Promise<MyFeatureSettings | null> {
    return this.storage.load<MyFeatureSettings>(this.SETTINGS_KEY)
  }

  async init(): Promise<void> {
    const settings = await this.loadSettings()
    if (!settings) {
      await this.saveSettings({ enabled: true })
    }
  }
}
```

**4. 样式文件 (`styles/index.scss`)**

```scss
// 使用思源主题变量
.my-feature-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
}

.panel-header {
  padding: 8px 12px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
}
```

**5. 导出注册函数**

在 `src/features/index.ts` 中添加：

```typescript
export { registerMyFeature } from './myFeature/types'
```

**6. 注册功能**

在 `src/index.ts` 的 `onload()` 中：

```typescript
if (this.settings.enableMyFeature) {
  registerMyFeature(this)
}
```

**7. 添加翻译**

`src/i18n/zh_CN.json`:

```json
{
  "myFeature": {
    "title": "我的功能",
    "description": "功能描述",
    "settings": {
      "enabled": "启用功能"
    }
  }
}
```

**8. 在超级面板添加开关**

在 `src/features/superPanel/SuperPanelView.vue` 中添加功能开关。

## Siyuan API 集成

### API 封装 (`src/api.ts`)

常用的 Siyuan API 调用，详见 [Siyuan API 文档](https://github.com/siyuan-note/siyuan/blob/master/API.md)。

### 注册右边侧栏 (Dock)

使用 API：`plugin.addDock`

**Dock 位置选项：**
- `LeftTop`, `LeftBottom`, `RightTop`, `RightBottom`

**完整示例：** 参考 [sy-bookmark-plus](https://github.com/frostime/sy-bookmark-plus)

**Vue 3 Dock 注册：** 见"方式二：Vue 3 SFC 功能"中的 `addDock()` 实现示例。



## 依赖

- Vue 3.3.8
- TypeScript 5.0.4
- Vite 6.2.1
- siyuan 1.1.0
- @iconify/vue

## 资源

- [Siyuan API 文档](https://github.com/siyuan-note/siyuan/blob/master/API.md)
- [Vue 3 文档](https://vuejs.org/)
- [Vite 文档](https://vitejs.dev/)
- [Siyuan 插件示例](https://github.com/siyuan-note/plugin-sample)
