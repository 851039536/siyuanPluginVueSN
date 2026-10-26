# 超级面板

统一的插件功能入口面板，将所有功能以双列卡片布局集中展示（窄屏回退单列）。支持功能搜索、开关管理、AI 设置（供应商、模型、API Key、联网搜索等）与一键打开各功能。快捷键：`Ctrl+Alt+P`。

自定义 API 端点兼容 OpenAI Chat Completions 协议：支持填写 OpenAI 兼容基地址（如 `https://api.example.com/v1`，请求时自动补全 `/chat/completions`）或完整端点 URL（以 `/chat/completions`、`/completions` 结尾原样使用）；规范化逻辑见 `@/utils/aiApi` 的 `normalizeCustomEndpoint`，仅请求时处理、不改存储值。选择自定义API供应商时，设置面板会显示「模型」输入框，模型名称须与 API 服务实际提供的名称一致（如 gpt-4o），缺失时请求前显式报错。

AI 配置支持「配置档案」（所有供应商通用）：可把整套 AI 设置（供应商/模型/自定义模型/API Key/自定义端点/思考模式）保存为命名档案（`PluginSettings.aiProfiles`，档案内敏感字段与 `aiApiKeys` 同走 AES-GCM 加密落盘）。在 AI 设置弹窗的「配置档案」Tab 中选择档案后点「应用所选档案」整组回填并立即生效（直接覆盖、无二次确认）；「保存当前配置」可将当前表单存为新档案，同名保存视为覆盖更新；「删除所选档案」移除该档案。激活配置仍由 `aiApiProvider/aiModel/aiCustomModel/aiApiKeys/aiCustomEndpoint/aiEnableThinking` 单组字段承载，运行期 AI 调用链路零改动。联网搜索固定使用 DeepSeek Search API（RAG 模式），密钥复用 `aiApiKeys.deepseek`，无独立配置项。
