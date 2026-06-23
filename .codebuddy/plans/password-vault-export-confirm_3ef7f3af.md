---
name: password-vault-export-confirm
overview: 为密码箱导出功能添加二次确认弹窗，防止用户无意识导出所有明文密码。
todos:
  - id: add-export-confirm-modal
    content: 在 index.vue 中新增导出确认弹窗：添加 showExportConfirm 状态、openExportConfirm/confirmExport 函数、Teleport 模态框模板和安全警告文案
    status: completed
---

## 产品概述

为密码箱导出功能增加二次确认弹窗，在用户点击"导出"按钮后弹出安全警告，明确告知导出内容为明文 JSON、包含所有密码字段，用户确认后才执行实际导出下载。

## 核心功能

- 点击导出按钮后弹出确认弹窗，而非直接下载
- 弹窗中显示安全警告文案："导出数据为明文 JSON 格式，包含所有密码、账号等敏感信息。请确保将文件保存在安全位置，使用完毕后及时删除。"
- 提供"取消"和"确认导出"两个操作按钮
- 确认后执行原有的 `triggerBlobDownload` 下载逻辑并关闭弹窗
- 取消则关闭弹窗不执行任何操作

## 技术方案

### 实现策略

在现有 `index.vue` 中新增一个确认弹窗状态和对应的 Teleport 模态框，遵循已有弹窗模式（Change Password Modal / Add Entry Modal），复用现有 CSS 类和组件。

### 修改文件

仅修改一个文件：`src/features/passwordVault/index.vue`

### 变更点

**1. 新增状态变量（script 区域，约第 635 行后）**

```typescript
const showExportConfirm = ref(false)
```

**2. 新增弹窗打开函数**

```typescript
function openExportConfirm() {
  if (!entries.value.length) {
    showMessage("没有数据可导出", 2000, "info")
    return
  }
  showExportConfirm.value = true
}
```

**3. 新增确认导出函数**

```typescript
function confirmExport() {
  showExportConfirm.value = false
  exportAllData()
}
```

**4. 修改导出按钮点击事件（模板第 109 行）**
`@click="exportAllData"` → `@click="openExportConfirm"`

**5. 新增确认弹窗模板（在 Change Password Modal 之后，约第 551 行 `</Teleport>` 之后）**
复用 `password-vault-overlay modal-overlay` + `password-vault-dialog small` 结构：

- dialog-header：标题"导出确认"
- dialog-body：安全警告文案（红色/橙色醒目提示）+ 条目数量统计
- form-actions：取消按钮（`@click="showExportConfirm = false"`）+ 确认导出按钮（`@click="confirmExport"`，variant="primary"）

### 架构设计

状态变更流：

```
用户点导出 → openExportConfirm() → showExportConfirm = true → 弹窗显示
用户点确认 → confirmExport() → showExportConfirm = false + exportAllData() → 下载文件
用户点取消 → showExportConfirm = false → 弹窗关闭
```

无新依赖、无样式文件修改，完全复用现有组件（Button）和 CSS 类（`modal-overlay`、`password-vault-dialog small`、`dialog-header`、`dialog-body`、`form-actions`）。
