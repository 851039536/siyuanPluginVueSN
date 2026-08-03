# 文本对比（textDiff）

提供文本差异对比工具，以全屏弹窗形式展示左右两栏对比，支持差异高亮、主题/模式/字号切换与文件导入。

## 功能特性

- **双模式对比**：分栏（split）与统一（unified）两种展示模式，实时计算差异
- **主题切换**：浅色 / 深色两套主题，独立于思源主题记忆
- **字号调节**：12px ~ 24px 六档字号，作用于输入区与差异查看器，设置持久化
- **文件导入**：支持文件选择器与拖拽导入（自动识别文件类型，仅响应拖入文件）
- **字符计数**：实时显示两侧文本字符数，便于对比规模感知
- **快捷操作**：一键清空、两侧文本交换

## 打开方式

- 悬浮框工具（`mdi:file-compare` 图标，桌面端）
- 超级面板功能入口
- 通过 `openTextDiff` 自定义事件触发（`getTextDiffManager()` 供跨功能调度）

## 目录结构

```
textDiff/
├── index.ts              # registerFeature(plugin)：Manager 自挂载 __textDiff（DESTROYABLE_KEYS 统一销毁）
├── index.vue             # 主面板：工具栏 + 双输入面板 + diff 查看器 + 空状态
├── README.md
├── utils.ts              # 纯工具函数：textDiffI18n（共享 i18n 读取，两文件共用）
├── components/
│   └── InputPanel.vue    # 单侧文本输入面板（自包含文件选择/拖拽/FileReader，v-model 多绑定）
├── types/
│   ├── index.ts          # TextDiffManager：createModalVueApp 弹窗 + toggle/open/close/destroy
│   └── storage.ts        # TextDiffSettings + DEFAULT_TEXTDIFF_SETTINGS + TextDiffStorage
└── styles/
    ├── _mixins.scss      # 共享 mixin（codex-meta-label / codex-border-card / codex-btn-base / flex-row）
    ├── index.scss        # 主面板样式（工具栏/输入区网格/结果区/空状态/响应式）
    └── InputPanel.scss   # 输入面板子组件样式（标题栏/文本域/拖拽遮罩）
```

## 数据流

```
TextDiffManager（types/index.ts，持有持久 Modal）
  └─ index.vue（originalText / modifiedText 状态）
       ├─ InputPanel（v-model 文本 + v-model:fileName）
       └─ vue-diff <Diff>（prev / current 实时计算差异）
```

## 扩展建议（路线图）

| 优先级 | 扩展项 | 说明 |
|-------|-------|------|
| P0 | 差异统计栏 | 增/删/改行数与字数徽章，直观反馈变更量 |
| P0 | 忽略选项 | 忽略大小写 / 首尾空白 / 全部空白 |
| P1 | 导入思源块 | 通过 `sql()` 导入当前选中块或指定文档内容 |
| P1 | 语法高亮 | 当前 `language` 固定 plaintext，可自动检测代码语言（vue-diff 内置 hljs） |
| P2 | 导出/复制差异 | 复制 patch 格式 diff、导出 .diff 文件（`triggerDownload`） |
| P2 | 对比历史 | TypedStorage 持久化最近会话，支持一键恢复 |
| P2 | 大文本性能 | 自动开启 `virtual-scroll` 与 `folding` 行折叠 |
| P2 | 全局快捷键 | `plugin.addCommand()` 注册快速打开 |
