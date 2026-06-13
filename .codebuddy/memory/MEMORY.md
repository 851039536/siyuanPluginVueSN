# 项目记忆

## 编码规范偏好
- 严格遵守 CLAUDE.md 中的统一入口原则：存储用 PluginStorage/TypedStorage、Node 模块用 getNodeModules、事件用 emitCustomEvent 等
- UI 风格使用 Codex 设计语言（等宽字体、大写标签、边框卡片、focus 发光）
- Vue emit 事件必须 camelCase，禁止 kebab-case
- 新功能必须在 8 处注册（index.ts + types + features/index.ts + src/index.ts + settings + i18n + config + icons）
- 优先思源内置图标或 @iconify/vue

## 最近重构记录
- 2026-06-13：dataBackup 模块全面审查重构（见当天日报）
- 2026-06-11：flashcardReading 模块审查重构（见当天日报）
