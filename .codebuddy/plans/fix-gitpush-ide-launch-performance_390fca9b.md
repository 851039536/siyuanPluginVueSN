---
name: fix-gitpush-ide-launch-performance
overview: 修复 gitPush 模块通过插件打开 IDE 导致 IDE 卡顿的问题。将 cp.exec（shell 模式）替换为 cp.spawn（detached 模式），并将同步 readdirSync 改为异步 readdir。
todos:
  - id: fix-launch-ide
    content: 将 launchIde 函数从 cp.exec 改为 cp.spawn(detached+stdio ignore)，使 IDE 脱离思源进程树
    status: completed
  - id: fix-is-cmd-available
    content: 将 isCmdAvailable 函数从 cp.exec 改为 cp.spawn，通过 error/close 事件判断命令可用性
    status: completed
  - id: fix-find-sln-file
    content: 将 findSlnFile 的 readdirSync 改为 fs.promises.readdir 异步版本
    status: completed
  - id: fix-handle-open-custom-ide
    content: 在 handleOpenCustomIde 中对 findSlnFile 调用添加 await
    status: completed
    dependencies:
      - fix-find-sln-file
---

## 问题描述

在 gitPush 功能的"打开项目"菜单中，通过插件启动 IDE（如 VSCode）后 IDE 运行明显卡顿，而手动打开同一项目则一切正常。

## 根因分析

1. **主因**：`launchIde()` 使用 `child_process.exec(command, options)` 启动 IDE。在 Windows 上 `exec` 默认 `shell: true`，实际进程链路为：`思源 Electron 进程 → cmd.exe → IDE 进程`。IDE 作为思源的孙子进程，继承了 Electron 进程的文件句柄、环境变量等资源，导致性能下降。
2. **次因**：`findSlnFile()` 使用 `fs.readdirSync()` 同步阻塞 Node.js 主线程，目录文件多时造成 UI 短暂冻结。

## 修复目标

将 IDE 启动方式从 `cp.exec` 改为 `cp.spawn` + `detached: true` + `stdio: 'ignore'`，使 IDE 作为独立进程运行，脱离思源的进程树，行为与手动打开一致。同时将 `findSlnFile` 的同步 I/O 改为异步。

## 修改范围

仅修改 1 个文件：`src/features/gitPush/composables/useIdeManagement.ts`

## 技术方案

### 修改策略

对 `useIdeManagement.ts` 中 4 处代码进行修改：

#### 1. `launchIde()` — 核心修复

将 `cp.exec()` 替换为 `cp.spawn()`，参数：

- `detached: true` — 子进程脱离父进程组，父进程退出后子进程继续运行
- `stdio: 'ignore'` — 不建立 stdio 管道，避免进程间 I/O 耦合
- `windowsHide: false` — IDE 需要显示窗口（原来 `windowsHide: true` 是为了隐藏 cmd 窗口，spawn 无中间 shell 不需要）

```typescript
function launchIde(cp: any, cmd: string, args: string[]): Promise<void> {
    const child = cp.spawn(cmd, args, {
      detached: true,
      stdio: 'ignore',
      windowsHide: false,
    })
    child.unref()
    return Promise.resolve()
}
```

#### 2. `isCmdAvailable()` — 配合修复

`isCmdAvailable` 用于检测 IDE 是否已安装，也使用了 `cp.exec`。改为 `cp.spawn` + `shell: true` 保留 shell 执行 `--version` 的能力，并将结果判断逻辑从 `err.code !== "ENOENT"` 改为通过 spawn 的 `error` 事件判断：

```typescript
function isCmdAvailable(cp: any, cmd: string): Promise<boolean> {
    return new Promise((resolve) => {
      try {
        const child = cp.spawn(cmd, ['--version'], {
          stdio: 'ignore',
          windowsHide: true,
        })
        child.on('error', (err: any) => {
          resolve(err?.code !== 'ENOENT')
        })
        child.on('close', (code: number | null) => {
          resolve(code === 0 || code === null)
        })
        child.unref()
      } catch {
        resolve(false)
      }
    })
}
```

#### 3. `findSlnFile()` — 改为异步

将 `fs.readdirSync` 替换为 `fs.promises.readdir` + `withFileTypes: true`：

```typescript
async function findSlnFile(dir: string): Promise<string | null> {
    const nodeModules = getNodeModules()
    if (!nodeModules) return null
    try {
      const entries = await nodeModules.fs.promises.readdir(dir, { withFileTypes: true })
      for (const e of entries) {
        if (e.isFile() && e.name.endsWith('.sln')) {
          return nodeModules.path.join(dir, e.name)
        }
      }
    } catch { /* ignore */ }
    return null
}
```

#### 4. `handleOpenCustomIde()` — 调用点改为 await

`findSlnFile` 调用处需要添加 `await`（原本同步调用，现在返回 Promise）：

```typescript
async function handleOpenCustomIde(projectPath: string, ideName: string, idePath: string) {
    let target = projectPath
    if (/rider|visual\s*studio/i.test(ideName)) {
      const sln = await findSlnFile(projectPath)  // 改为 await
      if (sln) target = sln
    }
    // ... 其余不变
}
```

### 影响评估

- **兼容性**：`child_process.spawn` 是 Node.js 核心 API，Electron 完整支持，无兼容风险
- **行为变化**：IDE 启动后不再与思源进程树关联，关闭思源不会影响已打开的 IDE
- **性能提升**：IDE 成为独立顶级进程，不继承 Electron 资源，性能与手动打开一致
- **无副作用**：不涉及其他功能模块、i18n、样式等