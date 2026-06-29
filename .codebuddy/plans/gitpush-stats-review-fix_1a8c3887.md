---
name: gitpush-stats-review-fix
overview: 修复 gitPush 统计视图的 6 类代码问题：移除重复类型定义、清理废弃 props/computed、删除死代码字段、使用 PLATFORM_META 驱动覆盖率列表、修复 `as any` 类型绕过、清理未消费的 computed 属性。
todos:
  - id: unify-platform-status-type
    content: 将 PlatformStatusItem 接口移至 types/index.ts 统一导出，StatsPanel.vue 和 useGitStats.ts 改为 import 复用
    status: completed
  - id: fix-coverage-template
    content: StatsPanel.vue 覆盖率列表改用 PLATFORM_META 循环生成，修复硬编码平台名问题
    status: completed
    dependencies:
      - unify-platform-status-type
  - id: fix-type-safe-access
    content: StatsPanel.vue 中添加 getPlatformStatus 辅助函数，替换 (item as any)[pm.key] 类型绕过
    status: completed
    dependencies:
      - unify-platform-status-type
  - id: remove-deprecated-no-platform
    content: 链式移除 noPlatformProjects：StatsPanel.vue props、index.vue 传递/解构、useGitStats.ts computed、useGitPush.ts 转发
    status: completed
  - id: remove-dead-code
    content: 清理死代码：isPending 字段、remoteCoverage.noRemote、pushStatusStats.total、recentCommits/tagStats/statusStats/archivedProjects
    status: completed
  - id: verify-build
    content: 运行 pnpm lint 和 npx tsc --noEmit 验证无新增错误
    status: completed
    dependencies:
      - unify-platform-status-type
      - fix-coverage-template
      - fix-type-safe-access
      - remove-deprecated-no-platform
      - remove-dead-code
---

## 概述

清理 gitPush 统计视图模块中的代码逻辑漏洞和冗余，涉及 5 个文件的修改。

## 清理项清单

### 冗余清理（6项）

- **PlatformStatusItem 接口重复定义**：StatsPanel.vue 和 useGitStats.ts 中各自定义了一份完全相同的接口，应移至 types/index.ts 统一导出
- **noPlatformProjects 已废弃但仍在流转**：标记 @deprecated 的 prop/computed 仍在 StatsPanel.vue props、index.vue 传递、useGitStats.ts computed、useGitPush.ts 转发中存活
- **isPending 死代码**：PendingProjectItem 接口中的 isPending 字段永远设为 true，模板中无任何读取
- **remoteCoverage.noRemote 未消费**：useGitStats.ts 中计算了此字段，但 StatsPanel 模板从未渲染
- **pushStatusStats.total 冗余**：与 projectCount 值完全相同且未被任何模板读取
- **recentCommits / tagStats / statusStats / archivedProjects 未消费**：useGitStats 中定义并返回，但 useGitPush.ts 未转发或 index.vue 未消费

### 逻辑漏洞修复（2项）

- **覆盖率列表硬编码平台名**：StatsPanel.vue 中 GitHub/Gitee/Gitea/CNB 四个覆盖率项全部手工编写模板，新增平台时会被遗漏
- **(item as any)[pm.key] 绕过类型安全**：模板中使用 any 强制转换动态访问 PlatformStatusItem 属性

## 技术方案

### 修改范围

仅涉及 gitPush 模块内部 5 个文件，不改变外部 API 契约。

### 实现细节

#### 1. 类型统一：PlatformStatusItem 移至 types/index.ts

- 在 `types/index.ts` 的 PLATFORM_META 下方新增导出
- StatsPanel.vue 和 useGitStats.ts 改为从 `../types` 导入，删除本地重复定义
- 新增 `getPlatformStatus(item: PlatformStatusItem, key: PlatformKey): boolean` 辅助函数，利用 `PlatformKey` 联合类型实现类型安全的属性访问

#### 2. 覆盖率列表改用 PLATFORM_META 循环

- StatsPanel.vue 中 4 个硬编码的 `.gp-coverage-item` 块改为 `v-for="pm in PLATFORM_META"`
- 通过 `remoteCoverage` 的动态 key 访问各平台计数：`remoteCoverage[pm.key as keyof RemoteCoverage]`
- 保留"多远程项目"行（对应 `remoteCoverage.multiple`）作为独立项

#### 3. noPlatformProjects 彻底移除

- StatsPanel.vue：从 props 定义中删除
- index.vue：从模板绑定和解构中删除
- useGitStats.ts：删除 `noPlatformProjects` computed
- useGitPush.ts：从 return 对象中删除转发

#### 4. 死代码清理

- `PendingProjectItem.isPending`：从接口定义和两处赋值（line 435, 453）中删除
- `recentCommits` / `tagStats` / `statusStats`：从 useGitStats.ts computed 和 return 中删除
- `archivedProjects`：从 useGitStats.ts computed/return 和 useGitPush.ts 转发中删除
- `remoteCoverage.noRemote`：从 useGitStats.ts computed 计算中删除
- `pushStatusStats.total`：从 useGitStats.ts computed 对象和 StatsPanel.vue PushStatusStats 接口中删除

### 验证

```
pnpm lint           # ESLint 检查
npx tsc --noEmit    # TypeScript 类型检查
```