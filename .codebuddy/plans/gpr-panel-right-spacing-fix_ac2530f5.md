---
name: gpr-panel-right-spacing-fix
overview: 给 gitPush 代码统计报告的三个功能页面统一增加右侧间距，解决内容紧贴侧边栏的问题。在 `.gpr-panel` 根容器添加 `padding-right`，一处修改覆盖 TeamOverviewSection、TechDebtSection、HotspotSection 三个页面。
todos:
  - id: fix-right-padding
    content: 修改 CodeReportPanel.scss：`.gpr-panel` 的 `padding` 增加右侧 12px（`$spacing-3`）
    status: completed
---

## 问题

gitPush 代码统计报告的三个功能页面（团队总览 TeamOverviewSection、技术债务 TechDebtSection、代码热点 HotspotSection）右侧间距不足，内容与思源侧边栏紧密贴合。

## 修复

给三个页面的共同父容器 `.gpr-panel`（位于 `CodeReportPanel.scss`）增加右侧 padding，统一为内容区提供 12px 呼吸空间，同时为 `overflow-y: auto` 滚动条留出距离。

## 改动范围

- **文件**：`src/features/gitPush/styles/CodeReportPanel.scss` 第 9 行
- **改动**：`padding: $spacing-1 0` → `padding: $spacing-1 $spacing-3 $spacing-1 0`（上4px/右12px/下4px/左0）
- **零影响**：左侧保持 0 不变，三个页面的表格/卡片内部间距不受影响，仅页面级右留白增加

## 验证

改后 lint 零错误。用户自行验证：`npx tsc --noEmit` / `pnpm lint`。