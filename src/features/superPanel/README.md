# 超级面板

统一的插件功能入口面板，将所有功能以网格布局集中展示。支持功能搜索、状态标记、开关管理、AI 设置（供应商、模型、API Key、搜索引擎等）与一键打开各功能。快捷键：`Ctrl+Alt+P`。

自定义 API 端点兼容 OpenAI Chat Completions 协议：支持填写 OpenAI 兼容基地址（如 `https://api.example.com/v1`，请求时自动补全 `/chat/completions`）或完整端点 URL（以 `/chat/completions`、`/completions` 结尾原样使用）；规范化逻辑见 `@/utils/aiApi` 的 `normalizeCustomEndpoint`，仅请求时处理、不改存储值。选择自定义API供应商时，设置面板会显示「模型」输入框，模型名称须与 API 服务实际提供的名称一致（如 gpt-4o），缺失时请求前显式报错。
