---
name: fix-gitpush-button-icon-sizes
overview: 将 EditProjectDialog.vue 中 3 处按钮/图标大小从 14/13 统一为 12px，与 PanelHeader.vue 标准一致。
todos:
  - id: fix-icon-sizes
    content: 修改 EditProjectDialog.vue 第 267/275/291 行图标 height 统一为 12
    status: completed
---

## 需求概述

将 EditProjectDialog.vue 中 3 处按钮/帮助弹窗图标尺寸统一为 `height="12"`，与 PanelHeader.vue 按钮图标标准保持一致。

## 修改明细

| 行号 | 当前值 | 目标值 | 说明 |
| --- | --- | --- | --- |
| 267 | `height="14"` | `height="12"` | 帮助按钮图标 `mdi:help-circle-outline` |
| 275 | `height="14"` | `height="12"` | 帮助弹窗标题图标 `mdi:information-outline` |
| 291 | `height="13"` | `height="12"` | 帮助弹窗列表项图标（动态 icon） |


其他组件（index.vue、StatsPanel.vue）中的 48px/36px 是空状态占位插画，不在修改范围。