---
name: fix-s3backup-progress-i18n-crash
overview: 修复 s3Backup 备份/还原任务运行时 BackupProgressSection 渲染崩溃：组件模板引用 i18n.backupProgress 但未声明 i18n prop，父组件也未传入，导致 undefined 访问报错。两侧对齐补齐 i18n 即可。
todos:
  - id: fix-progress-props
    content: "在 BackupProgressSection.vue 的 defineProps 增加 i18n: Record"
    status: completed
---

## 功能概述

修复 s3Backup 流式备份/还原运行时进度组件渲染崩溃。触发备份后任务运行期间挂载 BackupProgressSection，其模板读取未定义的 i18n 对象抛出 `Cannot read properties of undefined (reading 'backupProgress')`。

## 核心修复点

1. BackupProgressSection 模板已使用 `i18n.backupProgress` 渲染标题，但 props 未声明 i18n 且无任何提供方
2. 父组件 index.vue 调用处漏传 `:i18n="i18n"`（同文件其余子组件均传）

## 验收标准

备份/还原运行期间进度卡片正常显示"备份进度"标题与进度条，无渲染报错；空闲状态行为不变。

## 技术方案

### 实现策略

按项目 s3Backup 组件目录既有约定（S3ConfigForm.vue 等子组件一律通过 `defineProps<{ i18n: Record<string, string> }>` 接收父传 i18n、无默认值），做两处最小改动恢复 props 传递链，不引入新模式：

1. `src/features/s3Backup/components/BackupProgressSection.vue`

- `defineProps<{ progress: BackupProgress; phaseLabel: string }>()` 增加 `i18n: Record<string, string>` 字段

2. `src/features/s3Backup/index.vue`（63-67 行 BackupProgressSection 调用处）

- 补充 `:i18n="i18n"` 属性传递

### 关键决策与边界

- 复用组件内已有中文 i18n 注释，键 `backupProgress` 已存在于 zh_CN/en_US 分片（合并 JSON 亦有），零翻译改动
- 不触碰该组件的 styles/BackupProgressSection.scss 与备份业务逻辑，爆炸半径仅限 props 声明与模板绑定
- 该组件仅 index.vue 一处使用，无其它引用点需同步

## 目录结构

```
src/features/s3Backup/
├── components/
│   └── BackupProgressSection.vue   # [MODIFY] defineProps 增加 i18n 声明
└── index.vue                       # [MODIFY] BackupProgressSection 调用处补传 :i18n="i18n"
```

## 验证

由用户执行：触发一次备份或还原使 isAnyTaskRunning 为 true，确认进度卡片渲染正常；开发者侧以 read_lints 确认零新增诊断。