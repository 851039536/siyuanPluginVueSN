# CLAUDE.md

思源笔记插件开发指南。

## 项目概述

基于 Vite + Vue 3 + TS 的思源笔记插件，采用功能模块化架构。

## 常用命令

```bash
pnpm install      # 安装依赖
pnpm dev          # 开发模式（热重载）
pnpm build        # 生产构建

# 版本发布
pnpm release:patch   # 0.0.1 -> 0.0.2
pnpm release:minor   # 0.0.1 -> 0.1.0
pnpm release:major   # 0.0.1 -> 1.0.0
```

## 项目架构

```
src/
├── features/          # 功能模块
│   ├── superPanel/    # 统一入口面板
│   ├── tableOfContents/
│   ├── docNavigation/
│   ├── wordQuery/
│   ├── generalSettings/
│   └── aiContentGenerator/
├── components/        # 共享组件
├── config/            # 配置管理
├── commands/          # 斜杠命令
├── api.ts             # Siyuan API 封装
├── index.ts           # 插件入口
└── main.ts            # Vue 初始化
```

## 开发规范

### 必须遵守

- 新功能必须在 `SuperPanelView.vue` 提供开关
- 优先使用思源内置图标（见下方列表）或 @iconify/vue
- 全局样式导入：`@use "@/index.scss" as *;`

### 共享组件

位置：`src/components/`

| 组件 | 说明 |
|------|------|
| `Button` | 按钮，支持 variant/size/loading |
| `IconWrapper` | Iconify 图标包装器 |
| `Select` | 下拉选择 |
| `Input` | 输入框 |

### 思源内置图标

```html
<svg><use xlink:href="#iconName"></use></svg>
```

常用图标：`iconAdd`, `iconClose`, `iconSettings`, `iconSearch`, `iconRefresh`, `iconSave`, `iconTrashcan`, `iconSparkles`

完整列表：F12 搜索 `<symbol id="icon...">` 或查看 [官方源码](https://github.com/siyuan-note/siyuan/tree/master/app/src/assets/icons)

## 品牌设计

基于 shadcn-vue 设计系统。

```scss
@use '@/index.scss' as *;

.my-component {
  color: $brand-primary;
  font-family: $font-body;
  border-radius: $radius-lg;
}
```

常用变量：`$brand-primary`, `$brand-destructive`, `$font-heading`, `$radius-sm~$radius-full`, `$spacing-1~$spacing-16`

完整定义见 [src/_variables.scss](src/_variables.scss)

## API 参考

### PluginStorage（推荐）

```typescript
import { PluginStorage } from '@/utils/pluginStorage'

const storage = new PluginStorage(plugin)
await storage.save('key', data)
const data = await storage.load<Type>('key')
const data = await storage.loadWithDefault('key', defaultValue)
```

### AI API 统一模块

所有 AI 调用必须通过 `src/utils/aiApi.ts`：

```typescript
import { callAI, callAIStream, callAISmart, getApiConfigFromPlugin } from '@/utils/aiApi'
import type { AiApiConfig, GenerateOptions } from '@/types/ai'

const config = getApiConfigFromPlugin(plugin)
const result = await callAI(prompt, config, options)
```

**禁止**：在功能模块中直接调用 fetch/axios 访问 AI API。

## 添加新功能

### Vue 功能（推荐）

参考 `src/features/aiContentGenerator/`：

```
src/features/myFeature/
├── index.vue              # 主面板
├── types/
│   ├── index.ts           # 注册函数
│   └── storage.ts         # 数据存储
├── components/            # 子组件
└── styles/
    └── index.scss
```

注册步骤：
1. 实现 `types/index.ts` 导出 `registerMyFeature()`
2. `src/features/index.ts` 中导出
3. `src/index.ts` 中条件注册
4. `src/i18n/zh_CN.json` 添加翻译
5. `SuperPanelView.vue` 添加开关

### 简单功能

```typescript
// src/features/myFeature/index.ts
export function registerMyFeature(plugin: Plugin) {
  plugin.addTopBar({
    icon: 'iconSettings',
    title: plugin.i18n.myFeature.title,
    callback: () => { /* 逻辑 */ }
  })
}
```

## 依赖

- Vue 3.3.8, TypeScript 5.0.4, Vite 6.2.1
- siyuan 1.1.0, @iconify/vue

## 资源

- [Siyuan API](https://github.com/siyuan-note/siyuan/blob/master/API.md)
- [Vue 3](https://vuejs.org/) | [Vite](https://vitejs.dev/) | [shadcn-vue](https://www.shadcn-vue.com/docs/theming)
