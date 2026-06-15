# SN 思源插件合集

> 基于 Vite + Vue 3 + TypeScript 的思源笔记插件合集，提供 **40+ 个实用功能模块**。

[![license](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
![Vue 3](https://img.shields.io/badge/Vue-3.3-%234FC08D)
![Vite](https://img.shields.io/badge/Vite-6.2-%23646CFF)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-%233178C6)

---

## ✨ 功能总览

| 功能 | 类型 | 说明 |
|------|------|------|
| **超级面板** | Dock 面板 | 版本信息、插件状态总览 |
| **目录索引** | 命令 (Ctrl+Alt+I/O/R) | 插入子文档索引、引用列表和大纲 |
| **图片压缩** | Dock 面板 + 命令 (Ctrl+Alt+C) | 批量压缩文档中的图片 |
| **文档导航** | 事件监听 | 在编辑器显示父子文档导航链接 |
| **页面锁定** | 事件监听 | 用密码锁定文档页面防止误编辑 |
| **单词查询** | Dock 面板 | 快速查询单词释义 |
| **通用设置** | 功能类 | 字体、标题、代码块、列表等全局配置 |
| **数据备份** | Modal 弹窗 (persistent) | 工作区备份、自动备份和云同步 |
| **二维码生成** | 浮动工具栏动作 | 生成文本或链接的二维码 |
| **单位转换** | Dock 面板 | 快速转换各种单位 |
| **快捷键面板** | Dock 面板 | 查看和管理快捷键 |
| **本地磁盘** | Dock 面板 | 浏览本地磁盘和文件夹 |
| **AI 内容生成** | Modal 弹窗 | 使用 AI 生成 Markdown 内容 |
| **数据统计** | Dock 面板 | 笔记数据统计和分析（图表） |
| **谐音翻译** | 浮动工具栏动作 | 英文单词谐音记忆辅助 |
| **内容加密** | 右键菜单 | AES-256-GCM 加密/解密选中文本 |
| **视频管理器** | Modal 弹窗 + 命令 (Ctrl+Alt+V) | 管理和播放文档中的视频 |
| **Everything 搜索** | Modal 弹窗 + 命令 (Ctrl+Alt+E) | 本地文件快速搜索 |
| **状态栏** | 状态栏面板 | CPU/内存/文档统计 + 后台任务 |
| **浮动工具栏** | 选中文字弹出 | 二维码/谐音/翻译/热力图标记 |
| **悬浮框** | 页面右侧 | 可展开的多功能悬浮框 |
| **文本对比** | Modal 弹窗 | 字符/词语/行/补丁模式对比 |
| **Base64 图片转换** | Dock 面板 | 图片与 Base64 编码互转 |
| **密码箱** | Modal 弹窗 + 命令 (Ctrl+Alt+W) | 加密存储和管理密码条目 |
| **提示词库** | 配置项 | 管理 AI 提示词模板 |
| **单词阅读** | 功能类 | 闪卡式阅读工具，支持分类和翻转 |
| **热力图标记** | 浮动工具栏 | 自动标记词汇热力渐变 |
| **英译中替换** | 浮动工具栏 | 快速翻译英文并替换 |
| **文档分析** | Dock 面板 + 命令 (Ctrl+Alt+D) | 分析文档内容大小 |
| **排版助手** | Modal 弹窗 + 命令 (Ctrl+Alt+G) | Markdown 转微信公众号富文本 |
| **HTML 展示** | 右键菜单 | 预览选中文本/块的 HTML |
| **RSS 订阅** | Dock 面板 | 订阅和管理 RSS/Atom 源 |
| **资源管理** | Dock 面板 | 管理资源文件（查看/重命名/插入/清理） |
| **Skills 查看器** | Modal 弹窗 | 查看和管理 AI 编程工具的 Skills 配置 |
| **主题色** | CSS 变量覆盖 | 暖橙/GitHub蓝/樱花/Codex 主题色 |
| **书签标记** | Modal 弹窗 | 根据书签内容在文件树显示颜色标记 |
| **API 调试器** | Dock 面板 | 调试和测试思源笔记 API 接口 |
| **网站导航** | 功能类 | 管理常用网站链接 |
| **脚本启动器** | 功能类 | 启动和管理自定义脚本 |
| **图片生成** | Modal 弹窗 | 文章封面/代码图片生成 |
| **数据快照** | Dock 面板 | 创建/比较/查看/上传数据快照 |
| **Git 推送** | 功能类 | 同时推送到 GitHub 和 Gitee |

---

## 🛠 技术栈

| 技术 | 版本 | 用途 |
|------|------|------|
| [Vue 3](https://vuejs.org/) | ^3.3.8 | 前端 UI 框架 |
| [TypeScript](https://www.typescriptlang.org/) | ^5.0 | 类型安全 |
| [Vite](https://vitejs.dev/) | ^6.2 | 构建工具 |
| [Sass/SCSS](https://sass-lang.com/) | ^1.62 | 样式预处理 |
| [Iconify](https://iconify.design/) | 离线 | Material Design + Phosphor 图标集 |
| [Chart.js](https://www.chartjs.org/) + [vue-chartjs](https://vue-chartjs.org/) | 4.5 / 5.3 | 图表渲染 |
| [highlight.js](https://highlightjs.org/) | ^11.9 | 代码高亮 |
| [marked](https://marked.js.org/) | ^17.0 | Markdown 渲染 |
| [html2canvas](https://html2canvas.hertzen.com/) | ^1.4 | 截图生成 |
| [video.js](https://videojs.com/) | ^8.23 | 视频播放 |
| [diff-match-patch](https://github.com/google/diff-match-patch) | ^1.0 | 文本差异对比 |
| [JSZip](https://stuk.github.io/jszip/) | ^3.10 | ZIP 打包/解压 |
| [ESLint](https://eslint.org/) (antfu config) | ^9.22 | 代码检查 |

---

## 📦 安装

### 手动安装

1. 从 [Releases](https://gitee.com/kaiouyang-sn/siyuan-plugin-vite-vue-sn/releases) 下载最新 `package.zip`
2. 在思源笔记中打开 `设置 → 集市 → 插件`
3. 点击「导入插件」并选择下载的 zip 文件
4. 启用插件

### 开发安装

```bash
# 克隆仓库
git clone https://gitee.com/kaiouyang-sn/siyuan-plugin-vite-vue-sn.git

# 进入目录
cd siyuan-plugin-vite-vue-sn

# 安装依赖
pnpm install
```

---

## 🚀 开发

### 环境配置

在项目根目录创建 `.env.local`：

```env
VITE_SIYUAN_WORKSPACE_PATH=C:/path/to/siyuan-workspace
```

开发模式会自动构建并输出到思源工作区插件目录，配合 `rollup-plugin-livereload` 实现热重载。

### 常用命令

```bash
# 开发模式（热重载）
pnpm dev

# 生产构建
pnpm build          # 输出到 ./dist/，打包为 package.zip

# 代码检查
pnpm lint           # ESLint 检查
pnpm lint:fix       # ESLint 自动修复

# 版本发布
pnpm release:patch  # patch 版本递增
pnpm release:minor  # minor 版本递增
pnpm release:major  # major 版本递增
pnpm release:manual # 手动输入版本号

# 图标验证
pnpm validate:icons # 检查功能图标是否在 MDI 图标集中
```

---

## 📁 项目结构

```
src/
├── index.ts                     # 插件主入口（PluginSample 类）
├── main.ts                      # Vue 应用初始化
├── App.vue                      # 根组件（全局对话框容器）
├── api.ts                       # 思源笔记 API 封装（60+ 函数）
├── index.scss                   # 全局样式入口
├── _variables.scss              # SCSS 变量
├── commands/                    # 斜杠命令
├── components/                  # 共享 UI 组件（14 个原子组件）
├── config/                      # 配置（settings.ts, icons.ts）
├── features/                    # 40+ 功能模块
│   ├── config.ts                # FEATURE_CONFIG 单一数据源
│   ├── index.ts                 # 统一导出 + 编译时断言
│   └── statusBar/               # 状态栏功能
│   └── <feature>/               # 各功能模块
├── i18n/                        # 国际化（zh_CN, en_US）
├── types/                       # 类型定义
└── utils/                       # 工具函数
    ├── aiApi.ts                 # 统一 AI 调用入口
    ├── cryptoPrimitives.ts      # AES-GCM + PBKDF2 加密基元
    ├── domUtils.ts              # DOM 操作工具
    ├── eventBus.ts              # 自定义事件工具
    ├── iconHelper.ts            # 图标辅助
    ├── iconifySetup.ts          # Iconify 离线预加载
    ├── nodeModules.ts           # Node.js 模块加载
    ├── pluginStorage.ts         # 统一存储抽象层
    ├── settingsBackup.ts        # 设置备份/恢复
    ├── settingsCrypto.ts        # 配置加密
    └── typedStorage.ts          # 类型安全存储槽
```

---

## 🧩 添加新功能

添加新功能需在以下 8 处注册：

1. `src/features/<feature>/index.ts` — 实现 `register` 函数
2. `src/features/<feature>/types/` — 类型定义
3. `src/features/index.ts` — 统一导出
4. `src/index.ts` — `registerFeatures()` 条件注册
5. `src/config/settings.ts` — `PluginSettings` 接口 + 默认值
6. `src/i18n/` — 中英文翻译
7. `src/features/config.ts` — `FEATURE_CONFIG` 条目
8. `src/config/icons.ts` — `FEATURE_ICONS` 图标映射

---

## 🔒 安全特性

- **配置加密**: 内嵌密钥 + PBKDF2 + AES-GCM 加密敏感字段（API Key 等）
- **内容加密**: 用户口令 + PBKDF2 + AES-256-GCM 加密文档文本
- **密码箱**: 独立密钥策略加密存储密码条目
- **功能开关**: 同步文件持久化（`feature-flags.json`），降级到 `localStorage`

---

## 🌍 国际化

支持中英文双语界面：
- `src/i18n/zh_CN.json` — 简体中文
- `src/i18n/en_US.json` — English

---

## 📄 许可证

[MIT](LICENSE)

---

## 🔗 相关链接

- [思源笔记](https://github.com/siyuan-note/siyuan)
- [思源笔记插件开发文档](https://github.com/siyuan-note/plugin-samples)
- [Gitee 仓库](https://gitee.com/kaiouyang-sn/siyuan-plugin-vite-vue-sn)