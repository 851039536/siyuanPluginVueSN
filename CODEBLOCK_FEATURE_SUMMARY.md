# 代码块美化功能实现总结

## 功能概述
在通用设置中新增了代码块美化设置，支持三种风格：默认、GitHub 和 Mac 风格。

## UI 亮点
- 🎴 **卡片式风格选择器** - 直观美观的选择界面
- 🎨 **语法高亮预览** - 实时展示代码着色效果
- 🔢 **行号显示** - 清晰的代码行标识
- ✨ **流畅动画** - 悬停、点击、切换都有精美动画
- 🎭 **交互反馈** - Mac 按钮支持悬停动画
- 🌈 **视觉装饰** - 渐变边框、阴影效果

## 修改的文件

### 1. 新增文件
- `src/features/generalSettings/components/CodeBlockSettings.vue` - 代码块设置组件
- `docs/CODE_BLOCK_STYLE_GUIDE.md` - 功能使用指南

### 2. 修改的文件
- `src/features/generalSettings/GeneralSettingsPanel.vue` - 添加代码块设置模块
- `src/features/generalSettings/index.ts` - 添加代码块样式应用逻辑
- `src/i18n/en_US.json` - 添加英文翻译
- `src/i18n/zh_CN.json` - 添加中文翻译
- `src/index.scss` - 添加代码块美化样式

## 功能特性

### 支持的风格
1. **默认风格** - 保持思源原有样式
2. **GitHub 风格** - 模仿 GitHub 代码展示
   - 自适应背景色
   - 清晰边框分隔
   - 顶部语言标签
   - 深色主题完美适配
3. **Mac 风格** - 模仿 macOS 终端窗口
   - 红黄绿三色按钮
   - 渐变标题栏
   - 居中语言名称
   - 深色主题自动调整

### 主题适配
- ✅ 使用 CSS 变量（`--b3-theme-*`）
- ✅ 自动适配浅色/深色主题
- ✅ 对比度优化，确保可读性
- ✅ 阴影效果根据主题调整

### 技术实现
- 通过在 `<body>` 添加 CSS 类切换风格
- 设置保存在 localStorage
- 插件加载时自动应用保存的样式
- 实时预览效果

## 使用方法
1. 打开右侧边栏的"通用设置"
2. 点击"代码块美化"选项卡（💻图标）
3. 从下拉菜单选择风格
4. 预览效果
5. 点击"保存"按钮

## 国际化支持
- 中文：代码块美化、默认风格、GitHub 风格、Mac 风格
- 英文：Code Block Style、Default Style、GitHub Style、Mac Style

## 持久化
- 存储键：`general-codeblock-settings`
- 存储位置：localStorage
- 自动加载：插件初始化时

## 样式应用
- 样式类名：`codeblock-style-{style}`
- 作用范围：所有代码块（编辑模式和阅读模式）
- 选择器：`.protyle-wysiwyg [data-node-id][data-type="NodeCodeBlock"]`

## 测试建议
1. 切换不同风格，查看代码块变化
2. 保存设置后刷新页面，验证持久化
3. 在不同主题下测试显示效果
4. 测试重置功能
