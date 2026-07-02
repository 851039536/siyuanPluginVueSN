---
name: fix-git-localpaths-remote-url-loss
overview: 修复 GitPush 多本地路径映射逻辑中远程仓库链接丢失的 Bug。核心问题在于 `applyRemotesToProject` 无条件重置所有远程字段，以及 `refreshRemotes` 在跨电脑场景下会擦除已持久化的 URL。同时修复 `handleEditSaveFromDialog` 中空字符串 URL 被转为 undefined 时可能覆盖已有数据的边界情况。
todos:
  - id: fix-apply-remotes
    content: 修改 GitPushManager.ts 的 applyRemotesToProject 方法，移除无条件重置逻辑，仅设置检测到的字段保留已有值
    status: completed
  - id: fix-save-undefined-url
    content: 修改 index.vue 的 handleEditSaveFromDialog 方法，构建 patch 后过滤掉值为 undefined 的 URL 字段避免覆盖
    status: completed
  - id: verify-lint
    content: 运行 pnpm lint 和 npx tsc --noEmit 验证代码质量和类型正确性
    status: completed
    dependencies:
      - fix-apply-remotes
      - fix-save-undefined-url
---

## 用户需求

修复 gitPush 模块中"多本地路径映射"的 Bug：当用户在 EditProjectDialog 中更换或新增本地路径（localPaths）时，系统错误地导致远程仓库链接（URL）丢失。

## 核心问题

无论用户添加或切换多少个本地路径，这些路径都必须始终正确关联并指向**同一个唯一的远程仓库**，远程仓库链接必须在所有操作中保持持久性与一致性。

## Bug 根因分析

经代码审查，发现两个层面的问题：

1. **`GitPushManager.applyRemotesToProject()` 无条件重置**：该函数在检测远程仓库前，先将所有 `*Remote` 和 `*Url` 字段设为 `undefined`，然后只填充检测到的。当从 `refreshRemotes()` 调用时，若当前设备上 git remote 未配置（跨电脑场景），已有的 URL 全部被擦除。

2. **`handleEditSaveFromDialog` 空值转 undefined 污染 patch**：编辑保存时将空字符串 URL 转为 `undefined`，通过 `Object.assign` 合并到 project 对象时，会覆盖已有的远程仓库 URL。

## 技术方案

### 修改策略

采用"最小侵入、保留已有数据"原则，修改 2 个文件：

1. **`GitPushManager.ts`**：修改 `applyRemotesToProject()`，不再无条件重置所有 remote/URL 字段，仅设置实际检测到的字段，保留未检测到的已有值。
2. **`src/features/gitPush/index.vue`**：修改 `handleEditSaveFromDialog()`，在构建 patch 时排除值为 `undefined` 的 URL 字段，避免 `Object.assign` 覆盖已有数据。

### 关键设计决策

- **`applyRemotesToProject` 保留已有数据**：构建 patch 时不再预填 `undefined`，仅当 `detectRemotes` 返回匹配结果时才设置对应字段。这样在跨电脑场景下，当前设备检测不到 git remote 时，已有 URL 不会被擦除。
- **`handleEditSaveFromDialog` 过滤空值字段**：构建 patch 对象后，过滤掉值为 `undefined` 的 URL 字段。`updateProjectMeta` 内部使用 `Object.assign(project, patch)`，patch 中不包含的字段不会被覆盖，已有 URL 得以保留。
- **保持 `addProject` 行为不变**：新建项目时 `applyRemotesToProject` 仍然会正确填充检测到的 remote 信息（此时 project 对象本身就没有 URL 字段，不存在覆盖问题）。

### 影响范围

- 仅修改 gitPush 模块内部逻辑，不影响其他功能模块
- 不改变 `updateProjectMeta` 的 API 签名，调用方无需修改
- 向后兼容：已有项目数据不受影响，仅修复未来操作中的 URL 丢失问题

### 修改文件清单

```
src/features/gitPush/
├── GitPushManager.ts          # [MODIFY] applyRemotesToProject：保留已有 remote/URL 字段
└── index.vue                  # [MODIFY] handleEditSaveFromDialog：过滤 patch 中的 undefined URL
```