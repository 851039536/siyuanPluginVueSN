---
name: fix-release-js-tag-and-remote
overview: 修复 release.js 中两个问题：(1) tag 已存在时导致整个串联命令失败；(2) 硬编码 origin 导致远程名不匹配时推送失败。
todos:
  - id: refactor-git-flow
    content: 重构 release.js 第 186-202 行的 git 操作为分步 async 流程，新增 execAsync 和 checkTagExists 辅助函数，调用 getPushRemote 动态获取远程名，标签幂等处理
    status: completed
---

## 问题描述

release.js 发布脚本存在两个 git 相关 bug，导致 `pnpm release:major` 和 `pnpm release:patch` 失败：

1. **标签已存在导致串联命令整体失败**：第 186-187 行的 `git add && git commit && git push && git tag v${newVersion}` 是串联命令，当 `git tag` 因标签已存在而失败时，整个命令以非零退出码结束。但实际上 add/commit/push 都已成功执行，版本号文件已更新并推送到远程。

2. **硬编码 origin 导致标签推送失败**：第 195 行 `git push origin v${newVersion}` 硬编码了 `origin`，但用户实际远程仓库名是 `gitee`（从 `git status` 中 `gitee/master` 可见），导致 `fatal: 'origin' does not appear to be a git repository`。

## 修复目标

- 将串联命令改为分步执行，每个步骤独立处理错误
- 标签创建前先检查是否已存在，存在则跳过并打印提示
- 标签推送使用已有的 `getPushRemote()` 函数动态获取远程仓库名，替代硬编码 `origin`

## 技术方案

### 修改文件

仅修改 `release.js`，第 186-202 行。

### 实现策略

将原有的单次 `exec` 串联调用改为 async/await 分步执行：

1. **Step 1**: `git add && git commit` — 暂存并提交版本号文件
2. **Step 2**: `git push` — 推送提交到远程
3. **Step 3**: `git tag -l v${newVersion}` — 检查标签是否已存在
4. **Step 4a**: 标签不存在 → `git tag v${newVersion}` 创建标签
5. **Step 4b**: 标签已存在 → 打印警告提示，跳过创建
6. **Step 5**: 调用 `getPushRemote()` 获取实际远程名 → `git push ${remote} v${newVersion}` 推送标签

### 关键决策

- **为什么用 async/await 而不是保持 callback 嵌套**：分步执行后需要串行等待每一步结果，async/await 比 callback 嵌套更清晰，且项目已是 ES Module，完全支持 top-level await
- **为什么保留 `getPushRemote()` 而不是直接改用 `gitee`**：`getPushRemote()` 已实现了健壮的三级回退逻辑（upstream 解析 → remote 列表 → 默认 origin），通用性更好，未来如果更换远程仓库名也不需要再改脚本
- **标签幂等处理**：用 `git tag -l v${newVersion}` 检查是否存在，而非 `git tag -f` 强制覆盖。因为版本号标签应该是不可变的，强制覆盖会丢失历史信息

### 实现细节

将 `main()` 中第 185 行之后的内容替换为分步 async 流程：

```js
// Step 1: add + commit
const { execPromise } = await import('./gitExec.js') // 或用 util.promisify(exec)
// 实际上直接用 child_process.execSync 或用 Promise 包装 exec

// Step 1: git add + commit
await execAsync(`git add ./plugin.json ./package.json && git commit -m "chore: update version to ${newVersion}"`)

// Step 2: git push
await execAsync(`git push`)

// Step 3: 检查标签
const remote = await getPushRemote()
const tagExists = await checkTagExists(`v${newVersion}`)

// Step 4: 创建标签（幂等）
if (!tagExists) {
  await execAsync(`git tag v${newVersion}`)
  console.log(`🏷️  Tag v${newVersion} created`)
} else {
  console.log(`⚠️  Tag v${newVersion} already exists, skipping`)
}

// Step 5: 推送标签
await execAsync(`git push ${remote} v${newVersion}`)
console.log(`\n✅  Version successfully updated to: ${newVersion}\n`)
```

### 辅助函数

需要新增两个辅助函数（放在 `getPushRemote()` 之后）：

- `execAsync(cmd)` — Promise 化的 exec，reject 时输出详细错误
- `checkTagExists(tag)` — 执行 `git tag -l ${tag}` 检查标签是否存在