---
name: QRCodeDialog 审查修复
overview: 修复 QRCodeDialog.vue 审查发现的 5 个问题：文件头注释缺失、非响应式变量、死状态、i18n 硬编码、嵌套回调、无防抖
todos:
  - id: add-header-fix-state
    content: 添加文件头注释，修复 lastGeneratedContent 为 ref，移除死状态
    status: completed
  - id: fix-i18n
    content: 补全 Slider 和纠错级别的 i18n
    status: completed
    dependencies:
      - add-header-fix-state
  - id: refactor-copy-debounce-race
    content: 重构 copyQRCode 扁平化，添加防抖和竞态保护
    status: completed
    dependencies:
      - add-header-fix-state
---

## 需求概述

修复 floatingToolbar 模块 QRCodeDialog.vue 组件的审查问题，提升代码质量、i18n 完整性和用户体验。

## 核心问题清单

1. **硬规则违反**：缺少文件头注释
2. **Bug**：`lastGeneratedContent` 使用模块级 `let`，Modal 复用（persistent modal 模式）时残留旧值，导致 watch(props.content) 误判跳过生成
3. **死状态**：`isGenerating` 和 `errorMessage` 在 template 中从未使用
4. **i18n 遗漏**：Slider label="大小" 硬编码中文；纠错级别选项 label 硬编码 "L (7%)" 等，未使用 i18n 文件中已有的 qrcodeErrorL/M/Q/H key
5. **代码质量**：`copyQRCode` 多层嵌套回调（4层），混用 async/await 与 .then()
6. **性能**：`@input` 无防抖，每次按键都触发 QRCode.toCanvas()
7. **竞态**：快速修改纠错级别+大小时，前一个异步生成可能在后一个完成之后返回，显示旧结果

## 技术方案

### 修复 1：文件头注释

在 template 前添加 `<!-- 二维码生成对话框：输入内容生成二维码，支持复制和下载 -->`

### 修复 2：lastGeneratedContent 改为 ref

将 `let lastGeneratedContent = ""` 改为 `const lastGeneratedContent = ref("")`，watch 中用 `.value` 访问。确保组件每次挂载时响应式系统正确追踪。

### 修复 3：移除死状态

移除 `isGenerating` 和 `errorMessage` 相关代码。错误通过 `showMessage` 提示即可，无需额外状态。

### 修复 4：i18n 补全

- Slider label 使用 `i18n.qrcodeSize || '大小'`
- errorCorrectionOptions computed 中使用 i18n key：`qrcodeErrorL/M/Q/H`

### 修复 5：copyQRCode 扁平化

用 `Promise` 包装 `canvas.toBlob()`，统一 async/await，消除嵌套回调。

### 修复 6：防抖

从 `../core/utils` 导入已有的 `debounce` 工具函数，对 `regenerateQRCode` 做 300ms 防抖。

### 修复 7：竞态保护

使用序号标记法：每次调用 generate 前递增序号，返回后检查是否为最新序号，否则丢弃结果。

## 实现说明

- `debounce` 工具已在 `src/features/floatingToolbar/core/utils.ts` 中定义，直接导入复用
- i18n key 已在 `src/i18n/zh_CN/qrcode.json` 和 `en_US/qrcode.json` 中定义，无需新增
- 遵循项目现有模式：PronunciationDialog.vue 的文件头注释风格
- 不改变 UI 布局和功能逻辑，仅修复审查发现的问题

## 目录结构

```
src/features/floatingToolbar/
├── components/
│   └── QRCodeDialog.vue    # [MODIFY] 修复所有审查问题
└── styles/
    └── qrcode.scss         # 无需修改
```