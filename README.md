# SN 思源插件合集

基于 Vite + Vue3 + TypeScript 的思源笔记插件，提供 25+ 实用功能模块。

## 功能特性

### 核心功能

| 功能 | 描述 | 状态 |
|------|------|------|
| 超级面板 | 统一功能入口，支持自定义快捷操作 | ✅ 默认启用 |
| 页面锁定 | 加密锁定重要页面，保护隐私 | ✅ |
| 文档目录 | 自动生成文档大纲，快速导航 | ✅ |
| 图片压缩 | 高效压缩图片，节省存储空间 | ✅ |
| 文档导航 | 层级导航，快速定位内容 | ✅ |
| 快捷键管理 | 自定义快捷键，提升效率 | ✅ |
| 单词查询 | 集成词典，查词更便捷 | ✅ |
| 通用设置 | 集中管理所有插件设置 | ✅ |
| 单位转换 | 支持多种单位换算 | ✅ |
| 磁盘浏览器 | 浏览本地文件系统 | ✅ |
| 代码截图 | 生成美观的代码图片 | ✅ |
| AI 内容生成 | 集成大模型 AI 能力 | ✅ |
| 数据统计 | 可视化展示使用数据 | ✅ |
| 内容加密 | 文本内容加密存储 | ✅ |
| 视频管理 | 本地视频管理与播放 | ✅ |
| Everything 搜索 | 快速搜索本地文件 | ✅ |
| 状态栏 | 实时显示系统资源及文档统计 | ✅ |
| 浮动工具栏 | 快捷工具栏集成 | ✅ |
| 悬浮框 | 可拖拽的快捷工具箱 | ✅ |
| 文本对比 | 文本差异对比工具 | ✅ |
| Base64 图片 | 图片 Base64 转换 | ✅ |
| 单词阅读 | 间隔重复记忆单词 | ✅ |
| 密码箱 | 安全存储敏感信息 | ✅ |
| 文档分析 | 对文档内容进行分析统计 | ✅ |
| WebDAV | WebDAV 同步与备份 | ✅ |

### 辅助功能

- 谐音翻译
- 技能库

## 快速开始

### 环境要求

- Node.js >= 16
- pnpm（推荐）或 npm/yarn
- 思源笔记客户端（>= v2.10.14）

### 安装依赖

```bash
pnpm install
```

### 配置开发环境

创建 `.env` 文件：

```env
# Windows
VITE_SIYUAN_WORKSPACE_PATH=C:/Users/YourName/AppData/Roaming/SiYuan

# Linux/macOS
VITE_SIYUAN_WORKSPACE_PATH=/home/username/.config/SiYuan
```

### 开发模式

```bash
pnpm dev
```

自动构建到思源工作区 `data/plugins/siyuan-plugin-vite-vue-sn`，支持热重载。

### 生产构建

```bash
pnpm build
```

输出到 `./dist` 目录并自动打包为 `package.zip`。

## 项目结构

```
siyuan-plugin-vite-vue-sn/
├── src/
│   ├── commands/            # 斜杠命令
│   │   ├── DateTime.ts      # 日期时间命令
│   │   └── index.ts         # 命令入口
│   ├── components/          # Vue 组件（自建 shadcn-vue 风格组件库）
│   │   ├── Button.vue       # 按钮组件
│   │   ├── Input.vue        # 输入框组件
│   │   ├── Select.vue       # 选择器组件
│   │   ├── Switch.vue       # 开关组件
│   │   ├── Badge.vue        # 徽标组件
│   │   ├── Tag.vue          # 标签组件
│   │   ├── Card.vue         # 卡片组件
│   │   ├── Slider.vue       # 滑块组件
│   │   ├── Textarea.vue     # 文本域组件
│   │   ├── Label.vue        # 标签文字组件
│   │   ├── Chart.vue        # 图表组件
│   │   ├── IconWrapper.vue  # 图标包装器
│   │   └── Avatar.vue       # 头像组件
│   ├── config/              # 配置管理
│   │   ├── icons.ts         # 图标配置
│   │   ├── settings.ts      # 插件配置
│   │   └── features.ts      # 功能注册表
│   ├── features/            # 功能模块
│   │   ├── aiContentGenerator/     # AI 内容生成
│   │   ├── base64Image/            # Base64 图片转换
│   │   ├── codeImageGenerator/     # 代码截图生成器
│   │   ├── diskBrowser/            # 磁盘浏览器
│   │   ├── docAnalysis/            # 文档分析
│   │   ├── docNavigation/          # 文档导航
│   │   ├── encryption/             # 内容加密
│   │   ├── everythingSearch/       # Everything 搜索
│   │   ├── flashcardReading/       # 单词阅读
│   │   ├── floatingBox/            # 悬浮框
│   │   ├── floatingToolbar/        # 浮动工具栏
│   │   ├── generalSettings/        # 通用设置
│   │   ├── imageCompressor/        # 图片压缩
│   │   ├── pageLock/               # 页面锁定
│   │   ├── passwordVault/          # 密码箱
│   │   ├── shortcut/               # 快捷键管理
│   │   ├── statistics/             # 数据统计
│   │   ├── statusBar/              # 状态栏
│   │   ├── superPanel/             # 超级面板
│   │   ├── tableOfContents/        # 文档目录
│   │   ├── textDiff/               # 文本对比
│   │   ├── unitConverter/          # 单位转换
│   │   ├── video/                  # 视频管理
│   │   ├── webDAV/                 # WebDAV 同步
│   │   ├── wordQuery/              # 单词查询
│   │   └── index.ts                # 功能导出
│   ├── i18n/               # 国际化
│   │   ├── en_US.json      # 英文
│   │   └── zh_CN.json      # 中文
│   ├── types/              # TypeScript 类型
│   │   ├── api.d.ts        # API 类型
│   │   ├── vue.d.ts        # Vue 类型
│   │   └── ...
│   ├── utils/              # 工具函数
│   │   ├── eventBus.ts     # 事件总线
│   │   ├── pluginStorage.ts# 插件存储
│   │   └── ...
│   ├── App.vue             # 主应用组件
│   ├── api.ts              # API 封装
│   ├── index.ts            # 插件入口
│   ├── index.scss          # 全局样式
│   ├── _variables.scss     # 样式变量
│   └── main.ts             # Vue 初始化
├── scripts/
│   └── validate-icons.mjs  # 图标校验脚本
├── docs/                   # 开发文档
├── .env.example            # 环境变量示例
├── plugin.json             # 插件元数据
├── vite.config.ts          # Vite 配置
├── tsconfig.json           # TypeScript 配置
├── package.json            # 项目配置
├── eslint.config.mjs       # ESLint 配置
└── README.md               # 项目文档
```

## 核心概念

### 插件入口

```typescript
import { Plugin } from 'siyuan'

export default class PluginSample extends Plugin {
  async onload() {
    // 加载配置
    this.settings = await loadSettings(this)
    // 注册功能模块
    await this.registerFeatures()
    // 初始化斜杠命令
    initCommands(this)
  }

  onunload() {
    destroyCommands()
    destroy()
  }

  openSetting() {
    // 打开设置面板
  }
}
```

### 功能模块

每个功能模块独立封装：

```typescript
// src/features/myFeature/index.ts
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

### 配置管理

```typescript
// src/config/settings.ts
export interface PluginSettings {
  enableMyFeature: boolean
  // ... 其他配置项
}

export const DEFAULT_SETTINGS: PluginSettings = {
  enableMyFeature: true,
}
```

### 多语言支持

```typescript
// src/i18n/zh_CN.json
{
  "myFeature": {
    "title": "我的功能",
    "description": "功能描述"
  }
}
```

## 开发指南

### 添加新功能

1. 创建功能目录 `src/features/myFeature/`
2. 实现 `index.ts` 导出注册函数
3. 在 `src/features/index.ts` 中导出
4. 在 `src/config/settings.ts` 添加配置
5. 在 `src/index.ts` 中注册功能

### 使用思源 API

```typescript
import { fetchSyncPost } from 'siyuan'

// 获取块信息
export async function getBlockInfo(id: string) {
  return await fetchSyncPost('/api/block/getBlockInfo', { id })
}

// 更新块内容
export async function updateBlock(id: string, data: string) {
  return await fetchSyncPost('/api/block/updateBlock', {
    id,
    data,
    dataType: 'markdown'
  })
}
```

### 调试技巧

- 打开开发者工具：`Ctrl/Cmd + Shift + I`
- 查看日志：`console.log()`
- 热重载自动生效

## 技术栈

| 类别 | 技术 |
|------|------|
| 前端框架 | Vue 3.3.8 |
| 构建工具 | Vite 6.2.1 |
| 语言 | TypeScript 5.0.4 |
| 样式 | Sass 1.62.1 |
| UI 组件 | 自建 shadcn-vue 风格组件库（Button, Input, Select, Switch 等） |
| 图标 | @iconify/vue 5.0.0 |
| Markdown 渲染 | marked 17.0.1 |
| 视频播放器 | video.js 8.23.4 |
| 代码高亮 | highlight.js 11.9.0 |
| 二维码 | qrcode 1.5.4 |
| 差异对比 | vue-diff 1.2.4 / diff-match-patch |
| 图片压缩 | browser-image-compression 2.0.2 |
| 图片截取 | html2canvas |
| 压缩打包 | jszip |
| SDK | siyuan 1.1.0 |
| 代码规范 | ESLint 9.22.0 + @antfu/eslint-config |

## 常用命令

```bash
# 安装依赖
pnpm install

# 开发模式（热重载）
pnpm dev

# 生产构建
pnpm build

# 代码检查
pnpm lint
pnpm lint:fix        # 自动修复

# 图标校验
pnpm validate:icons

# 发布版本
pnpm release:patch   # 0.0.1 -> 0.0.2
pnpm release:minor   # 0.0.1 -> 0.1.0
pnpm release:major   # 0.0.1 -> 1.0.0
pnpm release:manual  # 手动输入版本
```

## 版本发布

发布脚本自动执行：
1. 更新版本号
2. 创建 Git tag
3. 构建生产版本
4. 打包 `package.zip`

## 开发规范

### 命名约定

- 文件名：`camelCase`（如 `myFeature.ts`）
- Vue 组件：`PascalCase`（如 `SettingPanel.vue`）
- 函数/变量：`camelCase`（如 `registerFeature`）
- 常量：`UPPER_CASE`（如 `DEFAULT_SETTINGS`）

### 代码质量

提交前运行代码检查：

```bash
pnpm lint
```

## 常见问题

**Q: 热重载不生效？**
A: 确保 `.env` 配置正确且思源笔记正在运行。

**Q: 插件加载失败？**
A: 检查 `plugin.json` 中 `minAppVersion` 是否匹配。

**Q: 构建报错？**
A: 清除依赖重新安装：`rm -rf node_modules && pnpm install`

## 参考资源

- [思源笔记官网](https://b3log.org/siyuan/)
- [思源笔记 API 文档](https://github.com/siyuan-note/siyuan/blob/master/API.md)
- [插件开发示例](https://github.com/siyuan-note/plugin-sample)
- [Vue 3 文档](https://vuejs.org/)
- [Vite 文档](https://vitejs.dev/)

## 许可证

MIT
