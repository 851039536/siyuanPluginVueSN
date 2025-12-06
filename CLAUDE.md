<!-- OPENSPEC:START -->
# OpenSpec Instructions

These instructions are for AI assistants working in this project.

Always open `@/openspec/AGENTS.md` when the request:
- Mentions planning or proposals (words like proposal, spec, change, plan)
- Introduces new capabilities, breaking changes, architecture shifts, or big performance/security work
- Sounds ambiguous and you need the authoritative spec before coding

Use `@/openspec/AGENTS.md` to learn:
- How to create and apply change proposals
- Spec format and conventions
- Project structure and guidelines

Keep this managed block so 'openspec update' can refresh the instructions.

<!-- OPENSPEC:END -->

一个基于Vue 3 + Vite + TypeScript构建的思源笔记插件开发模板项目。我需要更新README文件以包含实际的构建命令。



## 任何项目都务必遵守的规则

### Communication

- 永远使用简体中文进行思考和对话

### Documentation

- 编写 .md 文档时，也要用中文
- 正式文档写到项目的 docs/ 目录下
- 用于讨论和评审的计划、方案等文档，写到项目的 discuss/ 目录下



## 项目特性

- Vue 3.3.8 作为前端框架
- Vite 6.2.1 作为构建工具
- TypeScript 5.0.4 提供类型支持
- ESLint 9.22.0 进行代码规范检查
- 多语言支持 (中文/英文)
- 模块化功能架构

## 实际可用的构建命令

基于`package.json`中的scripts配置，以下命令是实际可用的：



### 开发模式

```bash
npm run dev          # 启动开发服务器，支持热重载
npm run build        # 构建生产版本
```

### 发布相关

```bash
npm run release              # 自动发布
npm run release:manual       # 手动发布
npm run release:patch        # 补丁版本发布
npm run release:minor        # 次版本发布
npm run release:major        # 主版本发布
```

### 代码质量

```bash
npm run lint         # 运行ESLint检查
```

## 项目结构

```
siyuan-plugin-vite-vue-sn/
├── src/
│   ├── components/           # Vue组件
│   │   ├── SiyuanTheme/     # 思源主题风格组件
│   │   │   └── SyTextarea.vue
│   │   └── SettingPanel.vue  # 设置面板组件
│   ├── config/              # 配置管理
│   │   └── settings.ts      # 插件配置定义与存储
│   ├── features/            # 功能模块
│   │   ├── pageLock/       # 页面锁定功能
│   │   ├── tableOfContents/ # 目录功能
│   │   ├── wordCount/      # 字数统计
│   │   ├── superPanel/     # 超级面板
│   │   └── [其他功能模块]
│   ├── i18n/               # 国际化
│   │   ├── en_US.json      # 英文语言包
│   │   └── zh_CN.json      # 中文语言包
│   ├── types/              # TypeScript类型定义
│   ├── utils/              # 工具函数
│   ├── App.vue             # 主应用组件
│   ├── api.ts              # API封装
│   ├── index.ts            # 插件入口
│   └── main.ts             # Vue应用初始化
├── plugin.json             # 插件元数据
├── vite.config.ts          # Vite构建配置
├── tsconfig.json           # TypeScript配置
├── package.json            # 项目配置和依赖
└── README.md               # 项目文档
```

## 核心技术栈

- **前端框架**: Vue 3.3.8
- **构建工具**: Vite 6.2.1
- **语言**: TypeScript 5.0.4
- **样式**: Sass 1.62.1
- **代码规范**: ESLint 9.22.0
- **图标**: @iconify/vue 5.0.0
- **思源笔记**: 版本 1.1.0

## 开发指南



### 环境要求

- Node.js >= 16
- pnpm (推荐) 或 npm
- 思源笔记客户端

### 安装依赖

```bash
pnpm install
# 或
npm install
```

### 配置开发环境

创建 `.env` 文件并配置思源工作区路径：



```env
VITE_SIYUAN_WORKSPACE_PATH=C:/Users/YourName/AppData/Roaming/SiYuan
```

或者在 Linux/Mac 上：



```env
VITE_SIYUAN_WORKSPACE_PATH=/home/username/.config/SiYuan
```

### 开发模式

```bash
pnpm dev
# 或
npm run dev
```

监听构建模式会自动将插件构建到思源工作区的 `data/plugins/siyuan-plugin-vite-vue-sn` 目录，支持热重载。



### 生产构建

```bash
pnpm build
# 或
npm run build
```

构建产物输出到 `./dist` 目录，并自动打包为 `package.zip`。