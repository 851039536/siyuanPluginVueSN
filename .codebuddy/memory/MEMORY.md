# 项目记忆

## 编码规范偏好
- 严格遵守统一入口原则：存储用 PluginStorage/TypedStorage、Node 模块用 getNodeModules、事件用 emitCustomEvent、SQL 用 @/api
- UI 风格使用 Codex 设计语言（等宽字体、大写标签、边框卡片、focus 发光）
- Vue emit 事件必须 camelCase，禁止 kebab-case
- 新功能必须在 8 处注册（index.ts + types + features/index.ts + src/index.ts + settings + i18n + config + icons）
- 优先思源内置图标或 @iconify/vue
- if 语句必须有花括号 `{}`，即使只有一行

## 代码风格硬规则
- 单文件行数：300 行警戒，500 行硬阈值，≥1000 行必须重构
- SCSS 分离：样式必须从 .vue 提取到独立 SCSS 文件
- 文件头注释：每个 .ts/.vue 顶部必须有功能说明（10~30字）
- 模块内代码分层：共享常量→types/index.ts，纯工具函数→utils.ts，禁止复制粘贴
- 禁止 emoji 图标，使用 Iconify 图标
- 禁止硬编码 font-size/font-weight/line-height，使用设计 Token

## 重构模式（已验证可复用）
- **巨型文件拆分**：Manager 类独立文件 + composable 按领域拆分 + 子组件提取
- **样式合规**：硬编码值→设计 Token、box-shadow→border、SCSS 提取到独立文件
- **冗余消除**：公共函数提取、watch 合并、computed 预计算映射
- **响应式布局**：纯 CSS flex-wrap 替代 JS 监听

## 功能模块状态
- gitPush：已完成多本地路径配置、响应式双列、commit log 数量选择
- S3 备份：已改为直接上传模式（无 zip 打包），状态栏集成
- toolCollection：底部面板 + Tab 切换，首个工具 base64Image
- compactMode：独立模块，3 档密度 + 5 档字号 + 5 区域开关
- skillLearning：代码片段练习库 + 闪卡记忆

## 禁止事项
- 禁止私自执行 `dotnet build`（太慢太卡）
- 禁止执行 `pnpm vite build` 和 `pnpm lint`（用户自行验证）
- 禁止跨 feature 直接导入（必须通过事件总线 + App.vue 调度）
