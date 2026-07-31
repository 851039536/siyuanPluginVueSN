# 速记（quickNote）

快速记录多行笔记的弹窗工具：支持完成/待完成状态管理与弹窗显示位置设置（居中/上/下/左/右贴边）。

## 功能

- **多行速记**：textarea 输入多行文本，Ctrl+Enter 快速添加
- **状态管理**：条目可勾选完成/待完成，Tab 切换两种视图（含计数）
- **增删改**：条目支持行内编辑（Ctrl+Enter 确认 / Esc 取消）与删除（带确认）
- **位置设置**：头部图标菜单可选五档预设位置；按住头部/最小化小条可自由拖拽到任意位置，均持久化并重启恢复
- **最小化**：头部最小化按钮或点击面板外区域（遮罩）按当前位置方向收起——左/右贴边收成竖条，上/下/居中收成横条；小条半透明显示、悬停恢复不透明；收起期间遮罩透明且点击穿透，不阻断背后界面操作，点击小条展开；关闭仅由头部关闭按钮/状态栏切换触发
- **statusBar 集成**：功能抽屉中出现「速记」项，pin 后状态栏出现快捷按钮，点击切换弹窗显隐
- **启动自动打开**：超级面板速记卡片下的子开关（enableQuickNoteAutoOpen，默认关）；打开后插件启动即自动弹出速记面板（位置缓存加载完成后才 open，恢复到上次位置）

## 目录职责

```
quickNote/
├── index.ts                    # QuickNoteManager（persistent Modal 生命周期 + 位置/拖拽/最小化应用）+ registerQuickNote
├── index.vue                   # 弹窗主面板（紧凑头部/预设菜单/新增区/Tab/列表 + 最小化条）
├── components/
│   └── NoteItem.vue            # 单条目组件（纯展示，勾选/编辑/删除走 emit）
├── composables/
│   └── useQuickNotes.ts        # 条目响应式列表 + CRUD + 动作级持久化
├── types/
│   ├── index.ts                # 领域类型 + POSITION_ALIGN_MAP / POSITION_MINIMIZE_META 映射
│   └── storage.ts              # QuickNoteStorage（TypedStorage 两个槽位）
└── styles/
    ├── index.scss              # 主面板样式（Codex 风格）
    └── NoteItem.scss           # 条目样式
```

## 位置与拖拽机制

`createModalVueApp` 的遮罩层是全屏 fixed flex 容器（默认居中）。定位分两种模式：

- **五档预设**：Manager 的 `applyPosition()` 按 `POSITION_ALIGN_MAP` 改写遮罩
  `align-items` / `justify-content` 实现贴边/居中，贴边档位附加边缘间距
- **custom 自定义**：拖拽产生，容器绝对定位到 `customX/customY`（视口坐标，应用时 clamp 到视口内）

拖拽由 `startDrag()` 驱动：展开态头部与最小化小条的 pointerdown 进入，位移超过
`DRAG_THRESHOLD`（4px）才视为拖动（区分小条点击展开），松手后持久化坐标；
`consumeDragClick()` 供小条 click 护栏吞掉拖拽后的误触点击。
预设菜单选择后清除绝对定位内联样式，回归 flex 对齐。
该实现与 `vueAppHelper` 的遮罩 DOM 结构耦合，helper 重构时需同步调整。

## 最小化机制

最小化方向由当前定位派生（`POSITION_MINIMIZE_META`）：左/右 → 竖条（标题纵向排版），
上/下/居中/custom → 横条。Manager 的 `setMinimized()` 将容器尺寸改为 `auto`（小条尺寸由 CSS 决定），
并将遮罩设为透明 + `pointer-events: none` 实现点击穿透，仅小条本身可交互；
展开时还原尺寸与遮罩。最小化状态为会话级（不持久化），persistent 下关闭重开保持一致。

## 联动链路

```
statusBar FEATURES 条目 → emitCustomEvent("toggleQuickNote")
  → App.vue onMounted 监听 → plugin.__quickNote.toggle()
```

## 存储

| 键 | 内容 |
|------|------|
| `quick-note-items` | 速记条目数组（`QuickNoteItem[]`） |
| `quick-note-settings` | 功能设置（`{ position, customX, customY }`，对象浅合并兜底未来字段） |
