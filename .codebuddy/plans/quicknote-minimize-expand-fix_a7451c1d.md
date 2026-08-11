---
name: quicknote-minimize-expand-fix
overview: 修复 quickNote 拖拽后最小化再展开时点击无反应的问题。根因是 applyMinimized(false) 展开分支未全量还原 mask 对齐与 container 定位的残留内联样式，导致 flex/absolute 状态混杂。
todos:
  - id: fix-expand-position
    content: 在 applyMinimized(false) 的 else 分支末尾新增 this.applyPosition() 调用，展开时重新还原容器定位
    status: completed
  - id: verify-lint
    content: 检查 index.ts 的 lint 是否通过
    status: completed
    dependencies:
      - fix-expand-position
---

## 问题描述

quickNote 弹窗拖到顶部后最小化，再点击小条无法展开，点击无反应。

## 根因

`applyMinimized(false)` 展开分支（第149-156行）仅恢复了容器尺寸和遮罩样式，没有调用 `applyPosition()` 重新应用位置。拖拽后容器变为 `position: absolute`，展开时未重置，导致面板定位异常（absolute 坐标是旧的最小化小条坐标，与展开后的 624x70vh 尺寸不匹配，面板可能溢出视口或被裁切）。

## 修复

在 `applyMinimized(false)` 的 `else` 分支末尾新增 `this.applyPosition()` 调用，展开时重新按当前定位模式还原容器位置：

- `custom` 模式：重新设置 `absolute + left/top` 为拖拽缓存的坐标
- 预设模式（top/bottom/left/right/center）：清除 absolute 残留，改回 flex 对齐

## 技术方案

### 修改范围

仅修改 1 个文件：`src/features/quickNote/index.ts`

### 修改内容

在 `applyMinimized()` 方法的 `else` 分支中，`mask.classList.remove(...)` 之后增加 `this.applyPosition()`：

```typescript
// 修改前（第149-156行）
} else {
  container.style.width = PANEL_WIDTH
  container.style.height = PANEL_HEIGHT
  mask.style.background = MASK_BACKGROUND
  mask.style.pointerEvents = "auto"
  container.style.pointerEvents = ""
  mask.classList.remove("quick-note-mask--minimized")
}

// 修改后
} else {
  container.style.width = PANEL_WIDTH
  container.style.height = PANEL_HEIGHT
  mask.style.background = MASK_BACKGROUND
  mask.style.pointerEvents = "auto"
  container.style.pointerEvents = ""
  mask.classList.remove("quick-note-mask--minimized")
  this.applyPosition()
}
```

### 原理

`applyPosition()` 已经包含完整的定位还原逻辑：

- `position === "custom"`：设置 `container.style.position = "absolute"` + `left/top = clamp(customX, customY)`（用展开后的 PANEL_WIDTH/PANEL_HEIGHT 做 clamp，坐标正确）
- 非 custom：清除 `container.style.position/left/top`，改写 `mask.alignItems/justifyContent` 恢复 flex 对齐 + 贴边间距

此修复不影响其他路径（`open()` 中先调 `applyPosition()` 再调 `applyMinimized()`，展开时 `applyPosition()` 从 `applyMinimized(false)` 内部调用属于幂等操作）。