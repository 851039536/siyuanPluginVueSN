## ADDED Requirements

### Requirement: Everything搜索配置持久化
Everything搜索对话框的服务地址和端口配置 SHALL 使用思源API的持久化存储进行保存，确保配置数据跨会话持久化并支持跨设备同步。

#### Scenario: 配置保存
- **当** 用户修改服务地址或端口设置时
- **那么** 系统应使用`plugin.saveData()`方法保存配置到插件存储
- **并且** 配置应在插件重启后仍然可用

#### Scenario: 配置加载
- **当** Everything搜索对话框初始化时
- **那么** 系统应使用`plugin.loadData()`方法从插件存储加载配置
- **并且** 如果存在localStorage中的旧配置，应自动迁移到插件存储

#### Scenario: 向后兼容
- **当** 插件升级且用户存在旧的localStorage配置时
- **那么** 系统应自动检测并迁移localStorage中的配置到插件存储
- **并且** 迁移完成后可选择清理localStorage数据

#### Scenario: 配置默认值
- **当** 用户首次使用或没有保存的配置时
- **那么** 系统应使用合理的默认值（host: 'localhost', port: 80）
- **并且** 在用户修改配置后立即保存