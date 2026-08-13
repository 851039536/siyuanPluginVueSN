---
name: docAnalysis-AttrsPanel-审查问题修复
overview: 修复 docAnalysis/AttrsPanel.vue 审查发现的问题：弹窗联动死路、跨文档状态残留、类型强转、静默失败、冗余代码、死导入、重复类型等，涉及 AttrsPanel.vue / index.vue / api.ts / types/index.ts 四个文件。
todos:
  - id: adjust-api-types
    content: 放宽 api.ts setBlockAttrs 签名为 string|null，types/index.ts 新增 DocI18n 类型
    status: completed
  - id: add-i18n-keys
    content: docAnalysis i18n 分片新增 publishCopied 与 publishMarkFailed 键（中英对齐）
    status: completed
  - id: refactor-attrs-panel
    content: 重构 AttrsPanel：合并 togglePublished、YAML 状态重置、删强转、防连点、成功失败反馈
    status: completed
    dependencies:
      - adjust-api-types
      - add-i18n-keys
  - id: fix-publish-linkage
    content: 修复 index.vue handlePublishDoc 联动，切发布 Tab 时关闭属性弹窗
    status: completed
  - id: apply-shared-i18n-type
    content: PublishPanel 与 DocListItem 的 i18n prop 改用共享 DocI18n 类型
    status: completed
    dependencies:
      - adjust-api-types
---

## 用户需求

审查并修复 `src/features/docAnalysis/components/AttrsPanel.vue` 的代码质量问题。审查已完成，发现五大类问题，现需制定并执行修复计划：

### 核心修复内容

- **逻辑漏洞**：「排版发布」切 Tab 不关弹窗形成死路；`expandedYaml` 跨文档残留；`null as unknown as string` 类型强转；复制成功无反馈；`copyAllAttrs` 拼接多行 YAML 破坏格式；`goToDoocs` 无防连点；标记发布失败静默无提示
- **冗余**：`markAsPublished`/`unmarkAsPublished` 约 80% 重复；`props.attrs?.title || ""` 重复 3 次；`CORE_ATTRS` 与 `ATTR_LABELS` 键集合重复维护；`toggleYaml` 先改后克隆绕圈
- **内存泄露**：组件自身无实质泄漏，但 `expandedYaml` 应随 docId 重置
- **死代码**：`showMessage` 死导入（修复反馈提示后转为实际使用）
- **重复类型**：`PlatformInfo` 与 `PlatformMeta` 字段重复；`i18n: Record<string, string>` 在 4 个组件重复声明

### 修复边界

- 仅修复上述已定位问题，不引入新功能，不改变现有交互语义
- 保持 i18n 分片文件（`src/i18n/{zh_CN,en_US}/docAnalysis.json`）为唯一文案数据源

## 技术栈

- 沿用现有 Vue 3 + TypeScript + SCSS 技术栈，不引入新依赖

## 实现方案

### 修改文件总览

| 文件 | 改动 | 说明 |
| --- | --- | --- |
| `src/api.ts` | [MODIFY] `setBlockAttrs` 签名放宽 | `attrs: { [key: string]: string }` → `Record<string, string \ | null>`，消除 `null as unknown as string` 强转。放宽为协变安全变更，现有调用方传 string 不受影响 |
| `src/features/docAnalysis/types/index.ts` | [MODIFY] 新增 `DocI18n` 共享类型 | `export type DocI18n = Record<string, string>`，供 4 个组件 Props 统一引用 |
| `src/features/docAnalysis/components/AttrsPanel.vue` | [MODIFY] 主重构 | 见下方「AttrsPanel 重构要点」 |
| `src/features/docAnalysis/index.vue` | [MODIFY] 修复联动缺陷 | `handlePublishDoc()` 内追加 `attrsPanelVisible.value = false`，切换发布 Tab 时关闭属性弹窗 |
| `src/features/docAnalysis/components/PublishPanel.vue` | [MODIFY] i18n prop 类型替换 | `i18n: Record<string, string>` → `DocI18n` |
| `src/features/docAnalysis/components/DocListItem.vue` | [MODIFY] i18n prop 类型替换 | 同上 |
| `src/i18n/zh_CN/docAnalysis.json` + `src/i18n/en_US/docAnalysis.json` | [MODIFY] 新增 2 个键 | `publishCopied`（复制成功提示）、`publishMarkFailed`（标记失败提示），中英文对齐 |


### AttrsPanel 重构要点

1. **合并发布切换**：`markAsPublished`/`unmarkAsPublished` 合并为内部函数 `togglePublished(platform: PlatformInfo, publish: boolean)`，统一「找 config → confirm → 找 matchKey → setBlockAttrs → emit refresh → finally 复位」流程，仅 confirm 文案与写入值（`yamlValue` 或 `null`）分支
2. **YAML 状态重置**：新增 `watch(() => props.docId, () => { expandedYaml.value = new Set() })`，解决跨文档折叠状态残留
3. **`toggleYaml` 简化**：改为「克隆 → 改 → 赋值」：`const next = new Set(expandedYaml.value); next.has(key) ? next.delete(key) : next.add(key); expandedYaml.value = next`
4. **`CORE_ATTRS` 派生**：`const CORE_ATTRS = new Set(Object.keys(ATTR_LABELS))`，但需将 `ATTR_LABELS` 声明提前至 `CORE_ATTRS` 之前（或提取为模块级常量）
5. **`docTitle` 提取**：`const docTitle = computed(() => props.attrs?.title || "")`，替换 `handlePublishGo`/`copyMdContent`/`goToDoocs` 三处重复表达式
6. **`PlatformInfo` 派生**：`type PlatformInfo = Pick<PlatformMeta, "id" | "name" | "url"> & { published: boolean }`，复用 `../types/index` 的 `PlatformMeta`
7. **复制成功反馈**：`copyMdContent` 成功后 `showMessage(props.i18n.publishCopied, 2000, "info")`（`handlePublishGo`/`goToDoocs` 已有 `publishCopiedRedirect` 跳转提示，无需重复）；`showMessage` 由死导入转为实际使用
8. **标记失败提示**：`togglePublished` 的 catch 分支追加 `showMessage(props.i18n.publishMarkFailed, 3000, "error")`
9. **`goToDoocs` 防连点**：新增 `doocsLoading` ref，按钮 `:disabled` + `mdi:loading` 旋转图标，`finally` 复位
10. **`copyAllAttrs` 多行值**：拼接时对含换行的值改为 `${k}:\n  ` + 每行两个空格缩进，保持 YAML 可读性
11. **死代码清理**：修复后确认无其他未使用导入/变量/分支

### 性能与可靠性

- `expandedYaml` 重置为 O(1) Set 新建，无性能影响
- 合并 `togglePublished` 消除重复逻辑，不改变任何 SQL/API 调用次数
- 全部改动为本地状态与类型层面，不触及查询/分析数据链路，无回归风险

### 验证链条

- 用户自行执行：`pnpm lint`、`pnpm i18n:verify`（中英键对齐）、`pnpm validate:icons`（本次无新图标）、`npx tsc --noEmit`
- 禁止 AI 执行 `pnpm vite build` / `pnpm lint`