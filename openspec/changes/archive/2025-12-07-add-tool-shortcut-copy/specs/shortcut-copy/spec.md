## ADDED Requirements
### Requirement: 工具特定复制内容
系统 MUST 支持为不同工具的快捷键定义特定的复制内容，以便用户复制命令或相关文本而不仅仅是快捷键组合。

#### Scenario: 复制 npm 快捷键
- **当** 用户点击 npm 类别快捷键的复制按钮
- **那么** 系统 MUST 复制与该 npm 快捷键相关的命令（如 "npm install"、"npm start" 等）

#### Scenario: 复制 nvm 快捷键
- **当** 用户点击 nvm 类别快捷键的复制按钮
- **那么** 系统 MUST 复制与该 nvm 快捷键相关的命令（如 "nvm use"、"nvm install" 等）

#### Scenario: 复制 cmd 快捷键
- **当** 用户点击 cmd 类别快捷键的复制按钮
- **那么** 系统 MUST 复制与该 Windows 命令提示符快捷键相关的命令

#### Scenario: 复制 Visual Studio Code 快捷键
- **当** 用户点击 vscode 类别快捷键的复制按钮
- **那么** 系统 MUST 复制与该 VS Code 快捷键相关的命令或操作

#### Scenario: 复制 Visual Studio 快捷键
- **当** 用户点击 visual-studio 类别快捷键的复制按钮
- **那么** 系统 MUST 复制与该 Visual Studio 快捷键相关的命令或操作

## MODIFIED Requirements
### Requirement: ShortcutInfo 接口扩展
ShortcutInfo 接口 MUST 包含 copyContent 字段，用于存储要复制的特定内容。

#### Scenario: 扩展接口定义
- **当** 需要为工具快捷键定义复制内容时
- **那么** MUST 在 ShortcutInfo 接口中添加可选的 copyContent 字段

### Requirement: 复制功能增强
copyShortcutInfo 函数 MUST 根据快捷键的类别和 copyContent 字段智能复制内容。

#### Scenario: 智能复制行为
- **当** 用户点击快捷键的复制按钮时
- **那么** 函数 MUST 首先检查 copyContent 字段
  - 如果存在 copyContent，则复制该内容
  - 如果不存在，则复制 keys 字段（向后兼容）

#### Scenario: 向后兼容性
- **当** 快捷键没有 copyContent 字段时
- **那么** 系统 MUST 默认复制 keys 字段，保持现有功能不变
