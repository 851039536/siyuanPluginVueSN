# 速记（quickNote）

快速记录多行笔记的弹窗工具：支持完成/待完成状态管理与弹窗显示位置设置（居中/上/下/左/右贴边）。

## 功能

- **多行速记**：textarea 输入多行文本，Ctrl+Enter 快速添加
- **状态管理**：条目可勾选完成/待完成，Tab 切换两种视图（含计数）
- **增删改**：条目支持行内编辑（Ctrl+Enter 确认 / Esc 取消）与删除（带确认）
- **位置设置**：弹窗可设五档显示位置，持久化并即时生效
- **statusBar 集成**：功能抽屉中出现「速记」项，pin 后状态栏出现快捷按钮，点击切换弹窗显隐

## 目录职责

```
quickNote/
├── index.ts                    # QuickNoteManager（persistent Modal 生命周期 + 位置应用）+ registerQuickNote
├── index.vue                   # 弹窗主面板（头部/新增区/Tab/列表）
├── components/
│   └── NoteItem.vue            # 单条目组件（纯展示，勾选/编辑/删除走 emit）
├── composables/
│   └── useQuickNotes.ts        # 条目响应式列表 + CRUD + 动作级持久化
├── types/
│   ├── index.ts                # 领域类型 + POSITION_ALIGN_MAP 位置映射
│   └── storage.ts              # QuickNoteStorage（TypedStorage 两个槽位）
└── styles/
    ├── index.scss              # 主面板样式（Codex 风格）
    └── NoteItem.scss           # 条目样式
```

## 位置机制

`createModalVueApp` 的遮罩层是全屏 fixed flex 容器（默认居中）。Manager 的 `applyPosition()`
通过 `maskId`（`quick-note-mask`）获取遮罩元素，按 `POSITION_ALIGN_MAP` 改写
`align-items` / `justify-content` 实现贴边，贴边档位附加边缘间距。
该实现与 `vueAppHelper` 的遮罩 DOM 结构耦合，helper 重构时需同步调整。

## 联动链路

```
statusBar FEATURES 条目 → emitCustomEvent("toggleQuickNote")
  → App.vue onMounted 监听 → plugin.__quickNote.toggle()
```

## 存储

| 键 | 内容 |
|------|------|
| `quick-note-items` | 速记条目数组（`QuickNoteItem[]`） |
| `quick-note-settings` | 功能设置（`{ position }`，对象浅合并兜底未来字段） |
