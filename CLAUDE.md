# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

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

## 项目概述

这是一个基于 Vue 3 + Vite + TypeScript 构建的思源笔记插件开发模板项目。项目采用模块化功能架构，每个功能都是独立的模块，可以单独启用或禁用。

## 开发命令

### 开发环境
```bash
npm run dev          # 启动开发服务器，支持热重载
```

### 构建命令
```bash
npm run build        # 构建生产版本到 ./dist 目录
```

### 发布相关
```bash
npm run release              # 自动发布（根据更改类型选择版本）
npm run release:manual       # 手动发布
npm run release:patch        # 补丁版本发布 (0.0.1 -> 0.0.2)
npm run release:minor        # 次版本发布 (0.0.1 -> 0.1.0)
npm run release:major        # 主版本发布 (0.0.1 -> 1.0.0)
```

### 代码质量
```bash
npm run lint         # 运行 ESLint 检查
```

## 核心架构

### 插件入口点
- **src/index.ts**: 插件主类，继承自 SiYuan 的 Plugin 类
- **src/main.ts**: Vue 应用初始化
- **plugin.json**: 插件元数据配置

### 功能模块系统
所有功能模块位于 `src/features/` 目录下，每个模块都是独立的：
- 每个功能有自己的文件夹，包含 Vue 组件、TypeScript 文件等
- 通过 `src/features/index.ts` 统一导出所有功能
- 功能在插件主类中根据配置动态注册
- 新功能必须在 SuperPanelView.vue 超级面板添加功能开关

### 主要功能模块
- **pageLock**: 页面加密锁定
- **tableOfContents**: 文档目录导航
- **imageCompressor**: 图片压缩工具
- **superPanel**: 超级面板（核心功能聚合）
- **aiContentGenerator**: AI 内容生成
- **generalSettings**: 通用设置（字体、列表、代码块样式等）
- **video**: 视频管理器
- 其他功能模块...

### 配置管理
- **src/config/settings.ts**: 定义所有插件配置接口
- 使用 SiYuan 的 `plugin.loadData()` 和 `plugin.saveData()` 进行持久化
- 每个功能模块都有对应的启用开关

### API 封装
- **src/api.ts**: SiYuan API 的封装
- **src/types/**: TypeScript 类型定义

### 国际化
- **src/i18n/**: 多语言支持（中文/英文）
- 使用 Vue I18n 进行国际化管理

### 样式管理
- 使用 Sass 预处理器
- 组件样式通过 import 引入：
```scss
<style scoped lang="scss">
@import "./index.scss";
</style>
```

## 重要开发约定

### 新功能开发流程
1. 在 `src/features/` 下创建新功能文件夹
2. 在 `src/features/index.ts` 导出功能
3. 在 `src/config/settings.ts` 添加配置项
4. 在 `superPanel/index.ts` 添加功能开关映射
5. 在 SuperPanelView.vue 超级面板添加功能开关UI

### 大模型 API 配置
- 所有 AI 相关功能使用统一的 API 配置入口
- 配置项：`aiApiProvider`（供应商）、`aiApiKey`（密钥）、`aiCustomEndpoint`（自定义端点）

### 组件开发规范
- 使用 Vue 3 Composition API
- TypeScript 类型必须明确
- 样式使用 Sass 并通过 import 引入
- 图标使用 @iconify/vue

### 环境配置
创建 `.env` 文件配置 SiYuan 工作区路径：
```env
VITE_SIYUAN_WORKSPACE_PATH=<你的SiYuan工作区路径>
```

### 热重载
开发模式下，插件会自动构建到 SiYuan 工作区的 `data/plugins/siyuan-plugin-vite-vue-sn` 目录

## 技术栈
- Vue 3.3.8
- Vite 6.2.1
- TypeScript 5.0.4
- Sass 1.62.1
- ESLint 9.22.0
- SiYuan SDK 1.1.0