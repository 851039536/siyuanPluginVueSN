# 变更：为快捷键面板添加工具特定的复制功能

## Why
用户需要一个更智能的复制功能，能够针对不同工具（npm、nvm、cmd、Visual Studio Code、Visual Studio）的快捷键复制相应的命令或内容，而不仅仅是复制快捷键组合。当前实现只能复制快捷键组合（如 "Ctrl+K"），无法满足用户对特定工具快捷键的复制需求。

## What Changes
- **MODIFIED**: 扩展 ShortcutInfo 接口，添加 copyContent 字段以支持复制特定内容
- **MODIFIED**: 增强 copyShortcutInfo 函数，根据工具类型复制相应的命令或内容
- **ADDED**: 新增工具分类支持：npm、nvm、cmd、vscode、visual-studio
- **ADDED**: 为不同工具定义复制格式和内容模板
- **MODIFIED**: 更新 ShortcutPanel.vue 界面以显示工具标识和复制状态

## Impact
- **受影响的规范**: shortcut-copy 功能规范
- **受影响的代码**:
  - `src/features/shortcut/types.ts` - 扩展类型定义
  - `src/features/shortcut/ShortcutPanel.vue:521-531` - 增强复制逻辑
  - `src/features/shortcut/index.ts` - 添加工具快捷键数据
