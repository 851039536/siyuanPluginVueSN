---
name: DropCommitDialog 备份可选化 + 状态持久化
overview: 在删除历史提交弹窗（DropCommitDialog）中新增"删除前自动备份"开关：开启时维持现有"先 bundle 备份再删除"流程，关闭时跳过备份直接删除；开关状态通过 TypedStorage 槽位持久化，下次打开弹窗恢复上次选择（默认开启，保持现有安全行为）。
todos:
  - id: add-drop-prefs-storage
    content: 在 types/meta.ts 新增 DropCommitPrefs 接口，types/storage.ts 新增默认值与 dropCommitPrefs 槽位
    status: completed
  - id: implement-dialog-toggle
    content: 改造 DropCommitDialog：autoBackup 状态恢复、开关 UI、performDrop 条件备份与切换持久化
    status: completed
    dependencies:
      - add-drop-prefs-storage
  - id: add-i18n-and-styles
    content: 补充 zh_CN/en_US 三个 i18n 键，DropCommitDialog.scss 新增开关行样式
    status: completed
    dependencies:
      - implement-dialog-toggle
  - id: update-readme
    content: 更新 gitPush README 提交历史条目，说明备份可选与持久化行为
    status: completed
    dependencies:
      - add-i18n-and-styles
---

## 产品概述

gitPush 模块的「删除历史提交」弹窗（LogPanel 点击删除图标打开，与提交规则检查视图共用）当前在执行删除前**强制**创建 bundle 全量备份。需求变更为：备份行为改为**可选**，弹窗内提供「删除前自动备份」开关；开关状态持久化，跨会话恢复上次选择。

## 核心功能

- 弹窗备份操作条区域新增「删除前自动备份」开关（复用现有 `.gp-set-switch` 开关样式，默认开启，保持现有安全行为）
- 开关切换即时持久化（`TypedStorage` 槽位），下次打开弹窗自动恢复上次选择
- 关闭自动备份时：执行删除跳过 `createProjectBackup` 步骤；弹窗内显示醒目提示「本次删除不会生成备份文件，仅能通过 git reflog 恢复」；底部 reflog 恢复提示文案随开关切换
- 开启时行为与现状完全一致（备份 → 删除 → 停留展示备份路径）
- 备份目录展示条保留（打开文件夹 / 清理历史备份功能不受开关影响）

## 技术方案

### 实现策略

完全复用 CommitFixDialog 的 `commitFixPrefs`（preserveDate）持久化模式：

1. **类型层**（`src/features/gitPush/types/meta.ts`）：在 `CommitFixPrefs`（373-376 行）旁新增 `DropCommitPrefs { autoBackup: boolean }` 接口。
2. **存储层**（`src/features/gitPush/types/storage.ts`）：仿照 `commitFixPrefs`（442/466 行）新增 `DEFAULT_DROP_COMMIT_PREFS = { autoBackup: true }` 常量 + `dropCommitPrefs: TypedStorage<DropCommitPrefs>` 槽位（key：`git-push-dropcommit-prefs`）。
3. **弹窗组件**（`src/features/gitPush/components/common/DropCommitDialog.vue`）：

- 新增 `autoBackup` ref，`init()` 中 `await manager.storage.dropCommitPrefs.loadOrDefault()` 恢复（与 headHash 等四项并行加载合并进现有 `Promise.all`）
- 新增 `onAutoBackupChange(val)` 处理函数：更新 ref + `manager.storage.dropCommitPrefs.save({ autoBackup: val })`
- `performDrop()` 改造：`if (autoBackup.value)` 才进入备份分支（置 `backingUp`、`createProjectBackup`），否则直接进入 `dropping`；`busy`/错误处理结构不变
- 模板：备份操作条上方新增开关行（label + `.gp-set-switch` checkbox + 关闭态警告提示，均带中文 i18n 注释）；底部 `dropCommitRecoverHint`（“操作前已自动创建备份…”）在开关关闭时替换为无备份提示

4. **i18n**（`src/i18n/zh_CN/gitPush.json` 762-775 行 dropCommit 键区 + `en_US/gitPush.json` 对应位置）新增 3 键：

- `dropCommitAutoBackup`：删除前自动备份 / Auto backup before drop
- `dropCommitAutoBackupTip`：关闭后删除不再生成备份，仅能通过 git reflog 恢复 / ...
- `dropCommitNoBackupHint`：已关闭自动备份，本次删除不会生成备份文件 / ...

5. **样式**（`src/features/gitPush/styles/DropCommitDialog.scss`）：新增 `.gp-drop-backup-toggle` 开关行样式，全部使用设计 Token（`$color-*`、`$font-size-*`、`$spacing-*`），禁 box-shadow/硬编码值。

### 关键决策

- **默认开启**：保持现有安全行为，向后兼容（旧用户无感知）
- **开关即时保存**（仿 CommitFixDialog radio 模式）：无需确认按钮，交互轻量
- **共用弹窗自动覆盖**：DropCommitDialog 被 LogPanel 与 CommitRuleCheck 两处引用，改一处即双入口生效
- **组件自包含**：子组件经 `CARD_SERVICES_KEY` 注入的 `manager.storage` 直接读写，符合子组件数据流规则

### 实现注意

- `init()` 的 `Promise.all` 追加 `manager.storage.dropCommitPrefs.loadOrDefault()`，无额外串行 IO
- i18n 只改分片文件，禁止触碰合并后的 `zh_CN.json`/`en_US.json`
- `read_lints` 若报 `DropCommitDialog.vue` 相关行号，需核对实际代码再判断（防陈旧诊断误判）
- 验证由用户执行：`pnpm i18n:verify` + `npx tsc --noEmit`（AI 不执行 build/lint）

## 涉及文件

```
src/features/gitPush/
├── types/meta.ts                                    # [MODIFY] 新增 DropCommitPrefs 接口（CommitFixPrefs 旁）
├── types/storage.ts                                 # [MODIFY] DEFAULT_DROP_COMMIT_PREFS 常量 + dropCommitPrefs 槽位
├── components/common/DropCommitDialog.vue           # [MODIFY] autoBackup 状态 + 开关 UI + performDrop 条件备份 + 持久化
├── styles/DropCommitDialog.scss                     # [MODIFY] .gp-drop-backup-toggle 开关行样式（设计 Token）
└── README.md                                        # [MODIFY] 提交历史条目补充"备份可选 + 持久化"描述
src/i18n/zh_CN/gitPush.json                          # [MODIFY] 新增 dropCommitAutoBackup 等 3 键
src/i18n/en_US/gitPush.json                          # [MODIFY] 对应英文 3 键
```