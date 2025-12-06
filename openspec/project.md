# 项目：SN思源插件合集 (siyuan-plugin-vite-vue-sn)

## 项目概述

这是一个基于 Vue 3 + Vite + TypeScript 构建的模块化思源笔记插件，提供了文档导航、图片压缩、AI 内容生成、页面加密等一系列生产力功能。插件采用模块化架构，每个功能都可以独立启用或禁用。

## 技术栈

### 核心技术
- **前端框架**: Vue 3.3.8 (Composition API)
- **构建工具**: Vite 6.2.1
- **开发语言**: TypeScript 5.0.4
- **样式预处理**: Sass 1.62.1
- **代码质量**: ESLint 9.22.0
- **平台 SDK**: SiYuan SDK 1.1.0

### 主要依赖
- @iconify/vue 5.0.0 - 图标管理
- browser-image-compression 2.0.2 - 图片压缩
- highlight.js 11.9.0 - 代码高亮
- html2canvas 1.4.1 - 截图生成
- marked 17.0.1 - Markdown 解析
- qrcode 1.5.4 - 二维码生成
- video.js 8.23.4 - 视频播放器

## 架构

### 插件结构
```
src/
├── features/           # 模块化功能系统
├── components/         # 可复用的 Vue 组件
├── config/            # 配置管理
├── i18n/              # 国际化 (zh_CN, en_US)
├── types/             # TypeScript 类型定义
├── utils/             # 工具函数
└── api.ts             # SiYuan API 封装
```

### 功能模块
1. **superPanel** - 所有功能的中心控制面板，带开关控制
2. **aiContentGenerator** - AI 驱动的内容生成
3. **pageLock** - 文档加密和密码保护
4. **imageCompressor** - 图片压缩和优化
5. **tableOfContents** - 文档导航和大纲
6. **video** - 视频播放器和管理
7. **wordQuery** - 词典和翻译
8. **statistics** - 文档统计和分析
9. **encryption** - 文本加密/解密工具
10. **docNavigation** - 文档历史和导航
11. **generalSettings** - 字体、列表和代码块样式
12. **unitConverter** - 单位转换工具
13. **qrCode** - 二维码生成
14. **codeImageGenerator** - 代码转图片
15. **pronunciation** - 文本转语音
16. **diskBrowser** - 文件系统浏览器
17. **shortcut** - 自定义快捷键

### 配置系统
- 集中配置管理在 `src/config/settings.ts`
- 使用思源的 `plugin.loadData()` 和 `plugin.saveData()` 持久化存储
- 功能特定的启用/禁用开关
- AI API 配置（供应商、密钥、自定义端点）

## 开发工作流

### 环境设置
1. 创建 `.env` 文件并配置 `VITE_SIYUAN_WORKSPACE_PATH`
2. 使用 `npm install` 安装依赖
3. 运行 `npm run dev` 启动热重载开发模式

### 添加新功能
1. 在 `src/features/` 下创建功能文件夹
2. 在 `src/features/index.ts` 中导出
3. 在 `src/config/settings.ts` 中添加配置
4. 在 `SuperPanelView.vue` 中添加开关
5. 在 `superPanel/index.ts` 中映射

### 构建与发布
- 开发模式：`npm run dev`（监听模式，自动同步到思源）
- 生产构建：`npm run build`（输出到 `./dist`）
- 发布：`npm run release`（自动版本管理）

## 开发约定

### 代码规范
- TypeScript 严格模式
- 使用 @antfu/eslint-config 的 ESLint
- Vue 3 Composition API
- 文件/变量使用 camelCase，组件使用 PascalCase
- 模块化功能架构

### UI/UX
- 现代 UI 框架一致性
- 响应式设计
- 中英文双语支持
- 使用 @iconify/vue 的图标驱动界面

### API 集成
- 所有思源 API 调用通过 `src/api.ts`
- 所有 AI 功能使用集中配置
- 错误处理和用户反馈

## 测试与质量

- ESLint 代码质量检查：`npm run lint`
- 思源环境中的手动测试
- 通过超级面板进行功能开关测试

## 安全考虑

- 所有用户输入的验证
- 加密密钥的安全处理
- API 密钥的安全存储
- 不使用 eval() 或不安全的动态代码执行

## 性能

- 功能的懒加载
- 使用 Vite 进行高效的代码分割
- 存储前的图片压缩
- 使用响应式系统优化 Vue 渲染