---
name: fix-git-remote-detection-and-unify-path-management
overview: 修复编辑弹窗中 git remote 检测使用硬编码主路径导致获取不到远程链接的 bug，同时移除"主路径"概念，将所有路径统一为可编辑列表。
todos:
  - id: fix-manager-pick-type
    content: GitPushManager.ts：updateProjectMeta 的 Pick 类型增加 "path"
    status: completed
  - id: fix-open-dialog-resolve-path
    content: index.vue：openEditDialog 中 detectRemotes 改为 resolveValidPath(project)，editLocalPaths 改为统一路径列表 [project.path, ...localPaths]
    status: completed
  - id: refactor-path-editing-ui
    content: EditProjectDialog.vue：移除只读主路径区域，改为统一可编辑路径列表（每行含输入框+目录选择+删除按钮，至少保留1个），props 改为 allPaths，emit 改为 allPaths
    status: completed
    dependencies:
      - fix-open-dialog-resolve-path
  - id: update-save-handler
    content: index.vue：handleEditSaveFromDialog 适配 allPaths 数据，拆分为 patch.path（第一个）和 patch.localPaths（其余）
    status: completed
    dependencies:
      - fix-manager-pick-type
      - refactor-path-editing-ui
  - id: update-pick-dir-handler
    content: index.vue：handlePickDirForLocalPath 适配统一路径列表（emit 改用 allPaths）
    status: completed
    dependencies:
      - refactor-path-editing-ui
  - id: cleanup-styles-and-i18n
    content: 清理 SCSS 样式（移除 gp-edit-path-primary/gp-primary-badge）+ 更新中英文 i18n 提示文案
    status: completed
    dependencies:
      - refactor-path-editing-ui
---

## 用户需求

1. **修复 bug**：某个项目之前改过本地路径配置（跨电脑多路径），编辑弹窗中"Git 远程仓库"列表始终为空，无法获取 `git remote -v` 结果。其他项目正常。

2. **移除"主路径"概念**：所有路径平等对待，任何路径都可以删除修改。如果第一个路径在当前设备不存在，自动使用下一个有效路径。

## 核心功能

- 编辑弹窗打开时，使用 `resolveValidPath(project)` 而非硬编码 `project.path` 来检测远程仓库
- 路径编辑区域统一为一个列表，所有路径均可编辑、删除（至少保留 1 个）、目录选择
- 保存时第一个路径作为 `project.path`，其余作为 `localPaths`
- 可独立修改任意路径（包括第一个），不再有只读的"主路径"

## 技术方案

### 根因

`index.vue` 第 1682 行 `openEditDialog` 中硬编码使用 `project.path` 调用 `detectRemotes`，未使用 `resolveValidPath(project)` 进行多路径解析。当主路径在当前设备不存在（属于另一台电脑）时，`execGit` 失败，`editRemoteList` 始终为空数组。

对比：`handleEditAddRemote`/`handleEditRemoveRemote`/`handleEditRemoteSave`（第 1772/1783/1796 行）和 `useGitOps.ts` 中所有 git 操作均已正确使用 `resolveValidPath(project)`。

### 改动文件

共 **6 个文件**，分 3 组修改：

1. **`GitPushManager.ts`**：`updateProjectMeta` 的 Pick 类型增加 `path`
2. **`index.vue`**：修复 `openEditDialog` 路径解析 + 重构路径编辑数据流
3. **`EditProjectDialog.vue`**：路径 UI 从"主路径只读 + 备选路径列表"改为"统一可编辑列表"
4. **`styles/index.scss`**：移除 `gp-edit-path-primary` 和 `gp-primary-badge` 样式
5. **`zh_CN/gitPush.json`**：更新提示文案
6. **`en_US/gitPush.json`**：同步更新英文文案

### 数据流

```
openEditDialog
  → editAllPaths = [project.path, ...project.localPaths]   // 统一列表
  → detectRemotes(resolveValidPath(project))                // 修复：多路径解析
  ↓
EditProjectDialog props.allPaths
  → 用户编辑/删除/添加路径（所有路径平等）
  ↓
emit save({ allPaths: string[] })
  ↓
handleEditSaveFromDialog
  → patch.path = allPaths[0]                                // 第一个 → 主路径
  → patch.localPaths = allPaths.slice(1)                    // 其余 → 备选路径
  → updateProjectMeta(id, patch)                            // Pick 已增加 path
```