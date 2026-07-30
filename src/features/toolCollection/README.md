# 工具合集

底部面板集成多种实用小工具，通过 Tab 标签页切换。遵循跨功能通信规则，通过 App.vue 中枢调度 + emitCustomEvent 事件总线实现零依赖解耦。

## 架构

```
toolCollection/
├── index.ts              # registerToolCollection() + 公开 API
├── index.vue             # 面板容器：Overlay + Header + Tab 栏 + 动态组件内容区
├── types/index.ts        # ToolMeta 接口定义（含可选 component 字段）
├── composables/          # 可复用逻辑
│   ├── usePanelResize.ts     # 面板尺寸管理（持久化 + 调整）
│   ├── useDragResize.ts      # 拖拽调整高度
│   ├── useToolNavigation.ts  # Tab 循环切换 + 键盘交互
│   └── useTabReorder.ts      # Tab 拖拽排序 + 顺序持久化
├── styles/index.scss     # 面板样式（固定底部定位、Tab 栏、动画、拖拽手柄）
└── tools/                # 各工具模块（独立子目录，互不依赖）
    ├── registry.ts       # 集中式工具注册表（新增工具唯一修改点）
    └── <toolName>/
        ├── index.vue     # 工具主组件
        ├── utils/        # 纯函数
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
| 单词查询 | 单词释义、翻译、代码注释生成、正则生成 |
| JSON 格式化 | 格式化 / 压缩 / 校验 JSON 文本 |
| 正则测试器 | 实时正则匹配 + flags 切换 + 捕获组展示 |
| 颜色选择器 | HEX/RGB/HSL 互转 + 调色板 + 复制 |
| Base64 图片转换 | 图片 → Base64 编码互转 |
| 单位换算 | 8 类物理单位 + 进制 + ASCII 转换 |

## 注册新工具

1. 创建 `tools/<toolName>/index.vue` + `styles/index.scss`（Props 统一为 `{ plugin, i18n }`）
2. 创建 `src/i18n/{zh_CN,en_US}/<toolName>.json`
3. 在 `tools/registry.ts` 添加一条配置（~8 行）
4. 运行 `pnpm i18n:verify` 验证

无需修改 `index.vue`、无需修改注册清单。

## 键盘快捷键

| 按键 | 功能 |
|------|------|
| `←` / `→` | 循环切换 Tab |
| `Ctrl+1~9` | 直接跳转第 N 个 Tab |
| `Home` / `End` | 跳转首 / 末 Tab |
| `Escape` | 关闭面板 |

## 交互增强

- **拖拽调高**：面板顶部边缘 4px 手柄，向上拖增大高度，松手自动持久化
- **Tab 拖拽排序**：拖动 Tab 按钮可重新排序，顺序持久化到 `toolCollection-tabOrder`
- **尺寸持久化**：宽/高通过 `TypedStorage<number>` 存储，启动时自动恢复
