---
name: fix-gitpush-storage-persistence
overview: 修复 GitPush 数据无法持久化的问题——`init()` 中 `loadOrDefault()` 缺少 `await`，导致每次重启都覆盖为空数组。同时优化 `init()` 冗余逻辑。
todos:
  - id: fix-storage-init
    content: 修复 storage.ts init() 方法：添加 await 并简化冗余逻辑
    status: completed
  - id: verify-build
    content: 构建验证，确保零 lint 错误
    status: completed
    dependencies:
      - fix-storage-init
---

## 问题

用户添加 Git 推送项目后，刷新或重启思源笔记程序，之前添加的所有项目消失。

## 根因

`src/features/gitPush/types/storage.ts` 第 49 行：

```typescript
const projects = this.projects.loadOrDefault() // ❌ 缺少 await
```

`loadOrDefault()` 是 async 方法，不加 `await` 返回 `Promise` 对象。`Array.isArray(Promise)` 永远为 `false`，导致每次都执行 `save(DEFAULT_PROJECTS)`（空数组），覆盖掉已持久化的项目数据。

## 修复目标

1. 为 `loadOrDefault()` 添加缺失的 `await`
2. 简化冗余的 `init()` 逻辑：当前先 `load()` 判断有无数据，再 `loadOrDefault()` 判断是否数组，而 `TypedStorage.loadOrDefault()` 已内置这两种判断（数据缺失返回默认值、非数组打印警告并回退），可直接简化为一次调用

## 修改文件

仅修改 1 个文件：`src/features/gitPush/types/storage.ts`

## 修改内容

将当前的 `init()` 方法：

```typescript
async init(): Promise<void> {
    const data = await this.projects.load()
    if (!data) {
      await this.projects.save(DEFAULT_PROJECTS)
    } else {
      // 确保数据仍是数组
      const projects = this.projects.loadOrDefault()
      if (!Array.isArray(projects)) {
        await this.projects.save(DEFAULT_PROJECTS)
      }
    }
  }
```

简化为：

```typescript
async init(): Promise<void> {
    // loadOrDefault() 内置了数据缺失回退默认值 + 非数组校验
    await this.projects.loadOrDefault()
  }
```

## 理由

- `TypedStorage.loadOrDefault()` 对数组类型已有完整校验：
- 数据不存在 → 返回空数组 `[]`（默认值）
- 数据存在但不是数组 → 打印 `console.warn` 并回退到默认值
- 无需额外 `save(DEFAULT_PROJECTS)` —— 如果用户之前已保存数据，写回空数组正是 bug 来源
- 删除了对思源后端不必要的 `saveData()` 写入，减少 I/O
