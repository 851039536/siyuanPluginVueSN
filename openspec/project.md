# 项目上下文

## Purpose
这是一个基于 Vue 3 + Vite + TypeScript 构建的思源笔记插件开发模板项目。旨在为开发者提供一个现代化、易用的插件开发脚手架，包含常用的功能模块和最佳实践，帮助快速开发高质量的思源笔记插件。

## 技术栈
- **前端框架**: Vue 3.3.8 (Composition API)
- **构建工具**: Vite 6.2.1
- **语言**: TypeScript 5.0.4
- **样式**: Sass 1.62.1
- **代码规范**: ESLint 9.22.0 (@antfu/eslint-config)
- **图标**: @iconify/vue 5.0.0
- **思源笔记**: SiYuan API 1.1.0
- **其他依赖**:
  - qrcode: 二维码生成
  - marked: Markdown 解析
  - html2canvas: 截图功能
  - video.js: 视频播放
  - browser-image-compression: 图片压缩
  - highlight.js: 代码高亮

## 项目约定

### 代码风格
- 使用 ESLint + @antfu/eslint-config 进行代码规范检查
- 遵循 Vue 3 Composition API 编码风格
- TypeScript 严格模式，类型优先
- 文件命名使用 PascalCase (组件) 或 camelCase (其他)
- 使用中文注释和文档

### 架构模式
- **模块化架构**: 每个功能独立在 `src/features/` 目录下
- **特性驱动开发**: 每个功能包含自己的组件、样式和逻辑
- **统一配置管理**: 通过 `src/config/settings.ts` 管理插件配置
- **国际化支持**: 使用 Vue I18n，支持中英文切换
- **插件化设计**: 通过 `src/features/index.ts` 统一管理功能模块

### 测试策略
- 暂未配置自动化测试框架
- 依赖思源笔记插件市场的人工审核
- 开发阶段通过手动测试验证功能
- 建议后续添加 Vitest 进行单元测试

### Git 工作流
- **主分支**: master
- **提交信息**: 使用约定式提交 (feat/fix/docs/style/refactor/test/chore)
- **版本管理**: 使用语义化版本 (semver)
- **发布流程**: 通过 npm run release 自动化发布

## 领域上下文

### 思源笔记插件开发
- 插件运行在思源笔记的沙箱环境中
- 需要通过 SiYuan API 与笔记系统交互
- 插件生命周期: onLoad -> onOpen -> onClose -> onUnload
- 配置持久化使用 plugin.loadData() 和 plugin.saveData()

### 常见功能模式
- **设置面板**: 统一的设置管理界面
- **超级面板**: 快捷操作中心
- **主题适配**: 跟随思源笔记主题变化
- **多语言**: 中文/英文双语支持
- **移动端适配**: 响应式设计

## 重要约束
- 必须兼容思源笔记的插件 API 规范
- 不能使用 Node.js 特定的 API（浏览器环境）
- 需要考虑不同平台的兼容性（Windows/macOS/Linux）
- 插件大小建议控制在 10MB 以内
- 必须遵循思源笔记的 UI 设计规范

## 外部依赖
- **思源笔记**: SiYuan 客户端 (>= 1.1.0)
- **Node.js**: 开发环境要求 (>= 16)
- **包管理器**: npm 或 pnpm
- **浏览器**: 基于 Electron，兼容主流浏览器 API
