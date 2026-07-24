# 工具合集

底部面板集成多种实用小工具，通过 Tab 标签页切换。遵循跨功能通信规则，通过 App.vue 中枢调度 + emitCustomEvent 事件总线实现零依赖解耦。

## 架构

```
toolCollection/
├── index.ts              # registerToolCollection() + 公开 API
├── index.vue             # 面板容器：Overlay + Header + Tab 栏 + 内容区
├── types/index.ts        # ToolMeta 接口定义
├── styles/index.scss     # 面板样式（固定底部定位、Tab 栏、动画）
└── tools/                # 各工具模块（独立子目录，互不依赖）
    └── <toolName>/
        ├── index.vue     # 工具主组件
        ├── components/   # 工具子组件
        └── styles/       # 工具样式
```

## 通信流程

1. **触发**：状态栏（或快捷键 Ctrl+Alt+T）→ `emitCustomEvent("toggleToolCollection")`
2. **调度**：`App.vue` 监听事件 → 调用 `toggleToolCollection()`
3. **响应**：模块级 `ref(visible)` 控制面板显隐
4. **清理**：`onunload()` 中 `app.unmount()` + `container.remove()` + 重置 `ref`

## 已集成工具

| 工具 | 功能 |
|------|------|
| Base64 图片转换 | 图片 → Base64 编码互转 |
| 单词查询 | 单词释义查询 |
| 单位换算 | 单位换算器 |

## 注册新工具

1. 在 `toolCollection/index.vue` 的 `tools` computed 中添加条目
2. 在模板中添加 `v-if` 条件渲染的组件引用
3. 无需修改注册清单
