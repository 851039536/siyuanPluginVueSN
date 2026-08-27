---
name: globalRelations 代码审查与修复
overview: 审查 src/features/globalRelations 模块的逻辑漏洞、冗余、内存泄露、死代码与重复类型，并针对发现的规范违规与逻辑问题制定修复计划。
todos:
  - id: fix-register-mode
    content: 修复注册与销毁模式：registerGlobalRelations 内部自挂载 __globalRelations，加入 DESTROYABLE_KEYS，删除 onunload 特例分支
    status: completed
  - id: clean-dead-code-types
    content: 清理死代码与重复类型：删除 plugin prop、rows 返回、parseAnchorText export、4 个死 i18n 键；迁移类型至 types/index.ts，BacklinkDoc 复用 IRefFile
    status: completed
  - id: fix-i18n-fallback
    content: 修复 i18n 硬编码兜底：index.vue 删除 t() 改直用 i18n 键并补中文注释，composable 移除 loadFailed 中文兜底
    status: completed
    dependencies:
      - clean-dead-code-types
  - id: perf-sql-limit
    content: 主列表 SQL 增加 LIMIT 500 性能保护，新增 truncatedHint i18n 键并在列表底部渲染截断提示
    status: completed
    dependencies:
      - fix-i18n-fallback
  - id: extract-sql-helper
    content: 新建 src/utils/sqlHelpers.ts 公共 SQL 工具，composable 的 escapeSql 改从 @/utils/sqlHelpers 导入并删除本地定义
    status: completed
    dependencies:
      - perf-sql-limit
  - id: style-var-dedup
    content: "提取 SCSS 变量 $gr-accent 替换 styles/index.scss 两处 #06b6d4 硬编码色值"
    status: completed
  - id: arch-verify
    content: 使用 [skill:universal-arch-skill] 校验修复后模块架构合规，输出验证结论供用户执行 lint/tsc/i18n:verify
    status: completed
    dependencies:
      - fix-register-mode
      - clean-dead-code-types
---

## 用户需求

审查 `src/features/globalRelations` 功能的代码逻辑漏洞、冗余、内存泄露、死代码、重复类型，并给出修复方案。

## 审查结论（基于 5 个文件全量通读 + 注册链路/参考实现/规范核对）

### 一、逻辑漏洞（2 项需修复）

1. 注册模式违反 AGENTS.md「实例挂载与销毁模式」硬规则：`registerGlobalRelations` 未内部自挂载；`src/index.ts:249` 由 registerFeatures 接收返回值挂载；`__globalRelations` 未加入 DESTROYABLE_KEYS；`onunload:178` 写特例清理分支。参考实现 gitPush 为内部自挂载模式。
2. 主列表无条数上限：全量 SQL 聚合 refs 表 + v-for 全量渲染，大型笔记库有性能风险。

### 二、冗余（1 项修复 + 1 项观察）

3. escapeSql 项目级复制粘贴：composable 内定义与 docAnalysis/utils/sqlHelpers.ts 同构，项目 6+ 文件各自复制。修复：新建 @/utils/sqlHelpers.ts 公共 helper 收敛。
4. 观察项：queryBacklinkDocs 与 docNavigation fetchBacklinks 反链去重逻辑同源，仅 2 处且结构不同，Rule of Three 未满，不提取。

### 三、内存泄露（无真实泄露）

5. Modal 由 createModalVueApp 管理并经 destroy() 清理；composable 无定时器/监听器。唯一隐患是注册模式不规范，修复后消除。

### 四、死代码（4 项）

6. index.vue 的 props.plugin 声明未使用。
7. i18n 死键 source/target/openDoc/rows 4 个未消费（description 被 config.ts 引用，保留）。
8. parseAnchorText 多余 export。
9. composable 返回 rows 未被消费。

### 五、重复类型（2 项）

10. BacklinkDoc 与 @/api 的 IRefFile 完全同构，复用 IRefFile。
11. GlobalRelationRow/DirectionFilter 定义在 composables 而非 types/index.ts，违反模块分层规范，迁移归位。

### 六、规范违规（2 项）

12. i18n 硬编码兜底：index.vue t(key, fallback) 函数（约 20 处）与 composable 的 `i18n.loadFailed || "加载失败"` 违反 AGENTS_I18N.md，改直用 i18n 键。
13. SCSS 硬编码 #06b6d4 两处重复，提取变量。

### 七、经走查确认无需修改

- INNER JOIN 过滤孤儿 refs：思源保证 refs 与 blocks 一致性，行为合理。
- toggleDetails 竞态：加载中收起再展开显示加载态并等待原请求，行为正确；refresh 后旧对象写回无害。

## 核心功能修复目标

- 注册与销毁模式对齐 AGENTS.md 硬规则与 gitPush 参考实现
- 消除死代码与重复类型，类型归位到 types/index.ts
- 修复 i18n 硬编码兜底违规并补中文注释
- 主列表 SQL 增加 LIMIT 性能保护与截断提示
- 收敛 escapeSql 到公共 @/utils/sqlHelpers.ts
- SCSS 色值去重

## 技术栈

沿用项目既有技术栈（Vue 3 + TypeScript + SCSS + Vite），不引入新依赖。

## 实现要点

1. **注册模式修复**（对齐 gitPush 参考实现）：

- `registerGlobalRelations` 末尾增加 `(plugin as any).__globalRelations = manager`，保留 `return manager`
- `src/index.ts` 注册行改为 `if (s.enableGlobalRelations) registerGlobalRelations(this)`（不接收返回值）
- `__globalRelations` 加入 `DESTROYABLE_KEYS` 清单，删除 `onunload` 中 177-178 行特例分支

2. **类型归位与复用**：`GlobalRelationRow`/`DirectionFilter` 迁至 `types/index.ts`；删除 `BacklinkDoc`，改用 `@/api` 的 `IRefFile` 类型
3. **死代码清理**：删除 index.vue 的 `plugin` prop（含 buildProps 传参与 `import type { Plugin }`）；`parseAnchorText` 去掉 `export`；composable 返回对象移除 `rows`；`GlobalRelationsI18n` 接口与两分片 JSON 同步删除 `source`/`target`/`openDoc`/`rows` 4 键（中英必须对齐）
4. **i18n 兜底修复**：index.vue 删除 `t()` 函数，模板直用 `i18n.xxx`，`i18n` prop 类型由 `Partial<GlobalRelationsI18n>` 改为 `GlobalRelationsI18n`；模板每处 i18n 使用处上方补中文 HTML 注释（AGENTS 硬规则）；composable 的 `i18n.loadFailed || "加载失败"` 改为 `i18n.loadFailed`
5. **SQL 性能保护**：`queryGlobalRelations` 的 SQL 追加 `LIMIT 500`，新增 i18n 键 `truncatedHint`，index.vue 列表底部渲染提示条；stats 与列表基于同一截断数据保持口径一致
6. **公共 SQL helper**：新建 `src/utils/sqlHelpers.ts`（escapeSql/quoteSql/quoteSqlList，从 docAnalysis 版本迁移），composable 改从 `@/utils/sqlHelpers` 导入并删除模块内定义；docAnalysis 等既有模块暂不迁移（控制爆炸半径）
7. **样式去重**：`styles/index.scss` 顶部定义 `$gr-accent: #06b6d4;`，两处硬编码引用替换

## 边界与风险控制

- 不改动任何 UI 结构与交互行为，仅清理与收敛
- 不迁移 docAnalysis/resourceManager 等既有 escapeSql 副本（避免无关大改）
- i18n 分片修改后需运行 `pnpm i18n:verify` 对齐、`pnpm i18n:merge` 重新生成（构建时自动）；顶层 zh_CN.json/en_US.json 为构建产物禁止手改
- 验证链（用户自行执行）：`pnpm lint`、`pnpm i18n:verify`、`npx tsc --noEmit`；AI 不执行构建与 lint

## 目录结构

```
src/
├── utils/
│   └── sqlHelpers.ts                    # [NEW] 公共 SQL 工具：escapeSql/quoteSql/quoteSqlList
├── index.ts                             # [MODIFY] 注册行改为不接收返回值；__globalRelations 加入 DESTROYABLE_KEYS；删除 onunload 特例分支
├── i18n/
│   ├── zh_CN/globalRelations.json       # [MODIFY] 删除 source/target/openDoc/rows 死键；新增 truncatedHint
│   └── en_US/globalRelations.json       # [MODIFY] 同步删除 4 死键；新增 truncatedHint（与 zh 对齐）
└── features/globalRelations/
    ├── index.ts                         # [MODIFY] registerGlobalRelations 内部自挂载 (plugin as any).__globalRelations
    ├── types/index.ts                   # [MODIFY] 迁入 GlobalRelationRow/DirectionFilter；删除 BacklinkDoc 改引用 IRefFile；接口删 4 死键 + 增 truncatedHint
    ├── index.vue                        # [MODIFY] 删除 plugin prop 与 t() 函数改直用 i18n 键；补中文注释；新增截断提示条
    ├── composables/useGlobalRelations.ts# [MODIFY] 类型改为从 types 导入；escapeSql 改用 @/utils/sqlHelpers；返回移除 rows；loadFailed 兜底删除；SQL 加 LIMIT
    └── styles/index.scss                # [MODIFY] 提取 $gr-accent 变量替换两处 #06b6d4
```

## 关键类型结构（修复后）

```ts
// types/index.ts（迁移归位 + 复用 IRefFile）
import type { IRefFile } from "@/api"

export interface GlobalRelationRow {
  sourceId: string; sourceName: string; sourceHPath: string
  targetId: string; targetName: string; targetHPath: string
  refCount: number; bidirectional: boolean
  contents?: string[]
  backlinkDocs?: IRefFile[]   // 原 BacklinkDoc 删除，复用 @/api 类型
  detailsLoading?: boolean; detailsExpanded?: boolean; detailsFailed?: boolean
}
export type DirectionFilter = "all" | "bidirectional" | "unidirectional"
```

## Agent Extensions

### Skill

- **universal-arch-skill**
- 用途：在完成注册模式与类型分层修复后，对 globalRelations 模块执行架构合规校验（实例挂载模式、模块内代码分层、统一入口），确保修复符合 AGENTS.md 硬规则
- 预期产出：架构校验通过，无残留违规（注册 8 步链完整、类型归位 types/index.ts、无跨功能直接导入）