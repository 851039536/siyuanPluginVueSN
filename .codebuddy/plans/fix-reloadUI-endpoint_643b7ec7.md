---
name: fix-reloadUI-endpoint
overview: "修复 reloadUI 函数：将端点从不可用的 /api/ui/reloadUI 恢复为 /api/system/reloadUI，并补充缺失的请求体 body: JSON.stringify({})"
todos:
  - id: fix-reloadui
    content: "修改 src/api.ts 中 reloadUI() 函数：端点回退为 /api/system/reloadUI，补充 body: JSON.stringify({})，并更新注释说明 v3.7.0 后迁移方向"
    status: completed
---

## 修复内容

修复 `reloadUI()` 函数刷新无效果的问题。经排查确认两个根因：

1. **端点错误**：当前使用 `/api/ui/reloadUI`（基于 v3.7.0 弃用公告提前迁移），但该端点在当前思源版本中不可用。思源官方 Kernel API 文档（leolee9086.github.io）明确指出正确端点为 `POST /api/system/reloadUI`。
2. **缺少请求体**：思源 API 要求传入空 JSON 对象 `{}`。同文件中的 `reloadFiletree()` 和 `reloadTag()` 均正确传入 `body: JSON.stringify({})`，仅 `reloadUI()` 缺失。

## 修改范围

仅修改 `src/api.ts` 第 876-892 行的 `reloadUI()` 函数。

## 技术方案

### 修改内容

在 `src/api.ts` 中修改 `reloadUI()` 函数：

1. **端点回退**：`/api/ui/reloadUI` → `/api/system/reloadUI`
2. **补充请求体**：添加 `body: JSON.stringify({})`
3. **更新注释**：将注释改为说明当前使用 `/api/system/reloadUI`，并备注 v3.7.0 发布后需迁移至 `/api/ui/reloadUI`

### 参照模式

同文件中 `reloadFiletree()`（第 897-910 行）和 `reloadTag()`（第 915-928 行）的实现模式，它们均使用 `fetch()` + `body: JSON.stringify({})` 的调用方式。

### 修改前后对比

```typescript
// 修改前
export async function reloadUI(): Promise<void> {
  try {
    await fetch(`${SIYUAN_API_BASE_URL}/api/ui/reloadUI`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
    })
  } catch (error) {
    console.error("重新加载 UI 失败:", error)
    throw error
  }
}

// 修改后
export async function reloadUI(): Promise<void> {
  try {
    await fetch(`${SIYUAN_API_BASE_URL}/api/system/reloadUI`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    })
  } catch (error) {
    console.error("重新加载 UI 失败:", error)
    throw error
  }
}
```