---
name: gitPush-stats-platform-status
overview: 优化 GitPush 统计视图：增强"未设置平台的项目"显示每个项目 GitHub/Gitee/Gitea 三个平台的设置状态（✅/❌），同时修复 CLAUDE.md 违规（emoji 标签、硬编码尺寸），确保 UI 符合 Codex 风格
todos:
  - id: add-i18n-keys
    content: 在 zh_CN/gitPush.json 和 en_US/gitPush.json 中新增统计视图所需的平台状态标签键值（configured/notConfigured/platformStatus/platforms等）
    status: completed
  - id: add-platform-status-computed
    content: 在 useGitPush.ts 中新增 platformStatusProjects computed，替换原有 noPlatformProjects，返回带各平台布尔状态和 missingCount 的数组
    status: completed
  - id: update-stats-panel-props
    content: 更新 StatsPanel.vue 的 props 定义（新增 PlatformStatusItem 接口）、模板（平台状态表格重设计为三列平台状态+图标）、Emoji 替换为 Iconify 图标；index.vue 同步更新 prop 传递
    status: completed
    dependencies:
      - add-platform-status-computed
  - id: fix-stats-scss
    content: 修复 StatsPanel.scss 中的硬编码尺寸为设计 Token（$spacing-*/$radius-*），新增平台状态表格相关样式，确保 Codex 风格对齐
    status: completed
  - id: verify-build
    content: 运行 pnpm vite build 和 npm run i18n:verify 确认构建通过且 i18n 键对齐
    status: completed
    dependencies:
      - add-i18n-keys
      - update-stats-panel-props
      - fix-stats-scss
---

## 用户需求

对 Git Push 功能的统计视图（StatsPanel）进行 UI 和功能优化，严格遵循 CLAUDE.md 规范。

## 核心功能

1. **平台状态明细展示**：将当前"未设置平台的项目"从仅显示「零平台」项目，升级为展示所有缺少平台的项目，并清晰标注每个项目的 GitHub/Gitee/Gitea 配置状态（已配置 ✓ / 未配置 ✗），按缺失数量降序排列
2. **Emoji 清理**：移除 StatsPanel 中标签文案里的 emoji（🚀/📥/✅/📭），改用 Iconify 图标 + 纯文本
3. **Codex 风格对齐**：检查并修复 StatsPanel.scss 中的硬编码尺寸，优先使用全局设计 Token

## Tech Stack

- Vue 3 + TypeScript + `<script setup>`
- SCSS（@use 模块化导入，引用全局 `_variables.scss` 设计 Token）
- `@iconify/vue` Icon 组件
- 现有 composable 模式（`useGitPush.ts`）

## Implementation Approach

### 策略

采用最小侵入式修改，在现有 StatsPanel 架构上扩展而非重建。核心变更集中在三处：composable 新增 computed、StatsPanel 组件模板改造、i18n 补充键值。

### 关键设计决策

1. **从 `noPlatformProjects` 升级为 `platformStatusProjects`**

- 旧逻辑：`projects.filter(p => !p.githubUrl && !p.giteeUrl && !p.giteaUrl)` — 仅返回零平台项目
- 新逻辑：返回所有「至少缺失一个平台」的项目，每个项目携带 `{ github, gitee, gitea }` 三个布尔状态和 `missingCount`
- 按 `missingCount` 降序排列，用户可快速定位最需要配置的项目

2. **Emoji 替换方案**

- `🚀 待推送` → `<Icon icon="mdi:cloud-upload-outline" />` + 文本
- `📥 有更新` → `<Icon icon="mdi:cloud-download-outline" />` + 文本
- `✅ 已同步` → `<Icon icon="mdi:check-circle-outline" />` + 文本
- `📭 无远程` → `<Icon icon="mdi:lan-disconnect" />` + 文本

3. **性能考量**

- `platformStatusProjects` 是 computed，仅在 projects 变化时重新计算，O(n) 复杂度，无性能瓶颈
- 平台状态列的图标渲染为静态 v-if/v-else 模板，零运行时开销

### 架构一致性

- 沿用 `useGitPush` composable 集中管理 computed 的现有模式
- 新 computed 通过 index.vue 的 `setup` 解构后传递给 StatsPanel props
- 不引入新的类型文件，直接在 `types/index.ts`（StatsPanel 内嵌接口）区扩展

## Implementation Notes

- **Blast radius**：仅修改 gitPush feature 内部的 5 个文件，不影响其他 feature
- **向后兼容**：index.vue 传递 prop 时仅修改 prop 名称和值来源，不影响 StatsPanel 其他 props
- **i18n 同步**：中英文分片文件各新增 4-6 个键值对，运行 `npm run i18n:verify` 校验对齐
