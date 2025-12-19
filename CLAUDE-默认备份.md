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

### 代码质量

```bash
# ESLint 检查代码
pnpm lint
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

1. 更新 `package.json` 和 `plugin.json` 中的版本号
2. 创建 git 标签
3. 构建生产版本
4. 生成 `package.zip` 用于分发

## 项目架构

### 高层结构

```
src/
├── features/          # 功能模块（模块化架构）
│   ├── superPanel/           # 统一入口面板
│   ├── pageLock/             # 页面加密/锁定
│   ├── tableOfContents/      # 文档目录
│   ├── imageCompressor/      # 图片压缩
│   ├── docNavigation/        # 文档层级导航
│   ├── shortcut/             # 快捷键面板
│   ├── wordQuery/            # 单词查询
│   ├── generalSettings/      # 通用设置
│   ├── qrCode/               # 二维码生成
│   ├── unitConverter/        # 单位转换
│   ├── diskBrowser/          # 本地磁盘浏览器
│   ├── codeImageGenerator/   # 代码截图生成器
│   ├── aiContentGenerator/   # AI 内容生成
│   ├── statistics/           # 数据统计
│   ├── pronunciation/        # 谐音翻译
│   ├── encryption/           # 内容加密
│   ├── video/                # 视频管理
│   ├── everythingSearch/     # Everything 搜索集成
│   └── openVpn/              # OpenVPN 集成
├── components/        # 共享 Vue 组件
├── config/            # 配置管理
├── commands/          # 斜杠命令
├── api.ts             # Siyuan API 封装
├── index.ts           # 插件入口点
└── main.ts            # Vue 应用初始化
```

### 核心架构模式

1. 插件入口点 (`src/index.ts`)

- 主 `PluginSample` 类继承 Siyuan 的 `Plugin`
- 生命周期方法：`onload()`, `onunload()`
- 基于配置标志的功能注册
- 平台检测（移动端、浏览器、Electron 等）

2. 基于功能的模块系统

- 每个功能都自包含在 `src/features/[feature-name]/` 中
- 功能导出 `register[FeatureName]()` 函数
- 功能根据 `plugin.settings` 条件性注册
- 所有功能从 `src/features/index.ts` 导出
- 新功能必须在超级面板中有开关设置显示 。

3. 配置管理 (`src/config/settings.ts`)

- 集中式设置接口：`PluginSettings`
- 独立设置：字体、列表、标题、代码块
- 默认值与保存的配置合并
- 通过 Siyuan 的 `plugin.loadData()` / `plugin.saveData()` 持久化存储（避免使用localStorage）
- API参考：docs/思源笔记 API 使用.md
- 快捷键：实现遵循 ctrl+alt+？

4. Vue 应用结构

- 主应用在 `src/main.ts`（Vue 初始化）
- `src/App.vue`（根组件）
- 设置面板在 `src/components/SettingPanel.vue`
- 共享组件在 `src/components/`

5. 国际化

- 语言文件：`src/i18n/zh_CN.json` 和 `src/i18n/en_US.json`
- ~500+ 个所有功能的翻译键
- 通过 `plugin.i18n.featureName.key` 访问

## 关键配置文件

### 构建配置 (`vite.config.ts`)

- 当设置 `VITE_SIYUAN_WORKSPACE_PATH` 时，监听模式自动部署到思源工作区
- 静态资源复制（README、icon、preview、plugin.json、i18n 文件）
- 为插件兼容性输出 CommonJS
- 开发模式下的实时重载
- 生产构建的 ZIP 打包

### ESLint 配置 (`eslint.config.mjs`)

- 基于 `@antfu/eslint-config`
- Vue + TS 支持
- 样式规则：2 空格缩进、单引号
- 自定义 i18n 键验证插件

### TypeScript 配置 (`tsconfig.json`)

- 严格 TypeScript 配置
- Vue SFC 支持
- 路径别名：`@/` 映射到 `src/`

### 环境配置 (`.env`)

```env
VITE_SIYUAN_WORKSPACE_PATH=/path/to/siyuan/workspace
```

开发模式自动部署到思源需要此配置。

## 功能开发指南

### 添加新功能

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

5. 在 `src/index.ts` 中注册

```typescript
if (this.settings.enableMyFeature) {
  registerMyFeature(this)
}
```

6. 添加翻译： `src/i18n/zh_CN.json` 和 `src/i18n/en_US.json`

```json
{
  "myFeature": {
    "title": "我的功能",
    "description": "功能描述"
  }
}
```

## Siyuan API 集成

### API 封装 (`src/api.ts`)

常用的 Siyuan API 调用已预封装：

- `getBlockInfo(id)` - 获取块信息
- `updateBlock(id, data)` - 更新块内容
- `fetchSyncPost(endpoint, params)` - 通用 API 调用

### 插件 API 使用

```typescript
// 添加菜单项
plugin.addTopBar({
  icon: 'iconEdit',
  title: 'My Action',
  callback: () => { /* ... */ }
})

// 存储
await plugin.saveData('key', value)
const data = await plugin.loadData('key')

// 设置
plugin.openSetting()
```

### 平台检测

插件自动检测平台：

```typescript
this.isMobile      // 移动端或浏览器移动端
this.isBrowser     // 基于浏览器
this.isElectron    // Electron 应用
this.isLocal       // localhost/127.0.0.1
this.isInWindow    // window.html
```

## 构建输出

### 开发模式 (`pnpm dev`)

- 输出到：`{VITE_SIYUAN_WORKSPACE_PATH}/data/plugins/siyuan-plugin-vite-vue-sn`
- 监听模式带实时重载
- 非压缩版本用于调试

### 生产模式 (`pnpm build`)

- 输出到：`./dist/`
- 创建：`./package.zip` 用于分发
- 压缩和优化

## 依赖

核心：

- Vue 3.3.8 - UI 框架
- TypeScript 5.0.4 - 类型安全
- Vite 6.2.1 - 构建工具
- siyuan 1.1.0 - Siyuan SDK

关键库：

- @iconify/vue - 图标库
- qrcode - 二维码生成
- marked - Markdown 解析
- video.js - 视频播放器
- browser-image-compression - 图片压缩

## 资源

- [Siyuan API 文档](https://github.com/siyuan-note/siyuan/blob/master/API.md)
- [Vue 3 文档](https://vuejs.org/)
- [Vite 文档](https://vitejs.dev/)
- [Siyuan 插件示例](https://github.com/siyuan-note/plugin-sample)
- [思源笔记官网](https://b3log.org/siyuan/)
