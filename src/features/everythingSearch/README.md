# Everything 本地搜索

集成 Windows 的 Everything 搜索引擎，在思源笔记中实现超快速的本地文件搜索。通过 HTTP API 与 Everything 服务通信，支持区分大小写、全词匹配、路径匹配、正则搜索等多种模式，支持按名称/路径/大小/修改时间排序。快捷键：`Ctrl+Alt+E`。

## 双形态承载

- **overlay 弹窗（默认）**：Teleport 到 body 的居中弹窗，快捷键 `Ctrl+Alt+E` 或超级面板「打开」触发。
- **独立窗口**：面板头部「在独立窗口打开」按钮，经 `addTab + openTab + openWindow` 官方 API 将页面弹出为独立浮动窗口（参考 minimalBrowser / toolCollection 双形态模式）。关闭浮动窗口页签自动移回主窗口；浮动窗口内自动隐藏「在独立窗口打开」按钮。

## 目录结构

```
src/features/everythingSearch/
├── index.ts        # 注册函数 + 全局可见性 + Manager 挂载
├── index.vue       # 主面板（overlay 弹窗 / tab 独立页签双形态）
├── api.ts          # Everything HTTP 服务封装 + 文件操作
├── types/
│   ├── index.ts    # 类型定义 + EverythingSearchManager（addTab + openWindow）
│   └── storage.ts  # 配置持久化
├── composables/    # useSearchConfig（配置持久化）/ useResultActions（结果操作）
├── components/     # DialogHeader/SearchBar/SearchOptions/... 子组件
└── styles/         # 组件专属 SCSS + _mixins
```
