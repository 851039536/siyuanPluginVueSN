---
name: QRCodeDialog UI Codex 重构
overview: 将 qrcode.scss 硬编码间距替换为 Codex Token，移除未使用类，修正对话框圆角
design:
  styleKeywords:
    - Codex
    - Design Token
  fontSystem:
    fontFamily: PingFang-SC
    heading:
      size: 32px
      weight: 600
    subheading:
      size: 18px
      weight: 500
    body:
      size: 16px
      weight: 400
todos:
  - id: rewrite-qrcode-scss
    content: 重写 qrcode.scss：硬编码→Token、移除 .qrcode-label、修正圆角
    status: completed
---

## 需求概述

对 floatingToolbar 模块的 QRCodeDialog.vue 进行 UI 样式 Codex 合规审查与重构。当前 qrcode.scss 存在硬编码间距、未使用类、对话框圆角过小等问题，需完全对齐全局 Codex 设计 Token。

## 核心问题

1. **硬编码间距**：`12px 14px`、`6px`、`10px`、`8px`、`4px` 等未使用 `$spacing-*` Token
2. **未使用类**：`.qrcode-label` 在 template 中未引用
3. **对话框圆角过小**：`$radius-md`(6px)，Codex 弹窗应为 `$radius-lg`(12px)
4. **mixin 默认值被覆盖**：dialog-header/body/footer mixin 已提供 Codex 兼容值，qrcode.scss 用硬编码覆盖
5. **响应式断点内同样硬编码**

## Tech Stack

- SCSS + Codex 设计系统（全局 Token：`$spacing-*`、`$radius-*`、`$font-size-*`）
- floatingToolbar 公共混合宏（`dialog-header`、`dialog-body`、`dialog-footer`、`flex-column` 等）

## Implementation Approach

将所有硬编码像素值替换为全局 `$spacing-*` Token，移除未使用类，修正对话框圆角，让 mixin 默认值生效。

## Directory Structure

```
src/features/floatingToolbar/
└── styles/
    └── qrcode.scss    # [MODIFY] Codex 合规重构
```

## Design Style

遵循 Codex 设计系统规范，使用全局 Token，禁止硬编码间距/圆角/字体。