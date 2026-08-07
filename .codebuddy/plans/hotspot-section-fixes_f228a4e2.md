---
name: hotspot-section-fixes
overview: 修复 HotspotSection.vue 的 2 处冗余（splitPath 双调、LOC 硬编码）+ 上游 reportMetrics.ts 的 LOC 计算时序 bug，并新增「仅展示前 N 条」提示和文件路径点击打开能力。
todos:
  - id: fix-loc-timing
    content: 修复 reportMetrics.ts 中 LOC 计算时序：将 countFileLines 从 forEach 循环内移到 heat 排序之后，仅对最终前 12 个热点文件计算 LOC
    status: completed
  - id: fix-hotspot-template
    content: 修复 HotspotSection.vue 的冗余与增强：splitPath 改用 computed 预映射、LOC 改为 i18n.reportLinesCol、新增截断提示和可点击文件路径功能
    status: completed
    dependencies:
      - fix-loc-timing
  - id: update-i18n-and-styles
    content: 新增 i18n 键 reportHotspotTruncated（zh_CN + en_US）+ 更新 HotspotSection.scss 样式（截断提示、可点击路径 hover）
    status: completed
    dependencies:
      - fix-hotspot-template
  - id: pass-project-prop
    content: CodeReportPanel.vue 透传 :project="currentProject" 给 HotspotSection 组件
    status: completed
    dependencies:
      - fix-hotspot-template
---

## 用户需求

对 `HotspotSection.vue` 及其上游数据管线执行 grill-me 审查发现 5 个待修复问题，现执行修复计划。

## 核心修复项

1. **BUG**：`reportMetrics.ts` 中 `countFileLines` 在文件按 `modCount` 排序阶段计算 LOC，但最终热点输出的是按 `heat` 重排后的前 12 项，两个排序维度不一致，导致部分热点文件的 `loc` 字段为 null
2. **冗余**：模板中 `splitPath(h.path).dir` 和 `splitPath(h.path).base` 对同一路径重复计算两次
3. **不一致**：`LOC:` 硬编码字符串，同级组件 `DebtFileDetail` 和 `AuthorContributionSection` 均使用 `i18n.reportLinesCol`（已存在翻译）
4. **缺失**：`HOTSPOT_LIMIT = 12` 截断时无提示，当分析文件数超过 12 时用户不知道有更多文件未展示
5. **增强**：热点文件路径仅为文本展示，无法点击打开。需支持点击后在系统文件管理器中定位文件

## 技术方案

### 1. LOC 计算时序修复（reportMetrics.ts）

**根因**：`buildReportData()` 中 `rankedFiles.forEach((...args, idx)` 按 modCount 排序后的 idx 决定是否调用 `countFileLines`（仅前 `HOTSPOT_LIMIT` 个），但随后 `hotspotRows.sort(by heat)` 改变顺序，最终 `hotspotRows.slice(0, HOTSPOT_LIMIT)` 取到的文件可能不在原始 modCount 排序的前 12 个，导致 loc 为 null。

**修复**：两阶段处理。第一阶段构建所有 hotspotRows（loc 初始为 null）；第二阶段 heat 排序后，仅对前 `HOTSPOT_LIMIT` 条调用 `countFileLines` 回填 loc。

```typescript
// 第一阶段：构建 hotspotRows，loc 暂为 null
rankedFiles.forEach(([path, agg]) => {
  const base: FileStatRow = {
    path, modCount: agg.modCount, authorCount: agg.authors.size,
    lastModified: agg.lastIso, loc: null,
  }
  // ... debtRows / hotspotRows 构建逻辑不变
})

// 排序
hotspotRows.sort((a, b) => b.heat - a.heat)

// 第二阶段：仅对最终前 HOTSPOT_LIMIT 个计算 LOC（同步 fs 读取）
for (let i = 0; i < Math.min(HOTSPOT_LIMIT, hotspotRows.length); i++) {
  hotspotRows[i].loc = countFileLines(project, hotspotRows[i].path)
}
```

### 2. splitPath 双重调用消除（HotspotSection.vue）

用 `computed` 预映射 `report.hotspots`，提前计算 `dir` / `base` 属性，模板直接使用 `h.dir` / `h.base`。

```typescript
const displayHotspots = computed(() =>
  props.report.hotspots.map((h) => {
    const { dir, base } = splitPath(h.path)
    return { ...h, dir, base }
  }),
)
```

模板 `v-for` 改为遍历 `displayHotspots`。

### 3. LOC i18n（HotspotSection.vue）

`reportLinesCol` 键已存在于 `zh_CN/gitPush.json`（"代码行数"）和 `en_US/gitPush.json`（"Lines"），无需新增翻译。仅将模板中 `LOC:` 替换为 `{{ i18n.reportLinesCol }}:`。

### 4. 截断提示

判断条件：`report.analyzedFiles > report.hotspots.length`。在热点列表底部添加提示行，使用新 i18n 键 `reportHotspotTruncated`（含 `{0}` 和 `{1}` 占位符，分别替换为展示数和总数）。

需要新增翻译：

- `zh_CN/gitPush.json`：`"reportHotspotTruncated": "仅展示前 {0} 个，共分析 {1} 个文件"`
- `en_US/gitPush.json`：`"reportHotspotTruncated": "Showing top {0} of {1} analyzed files"`

样式使用 `$font-size-2xs` + 弱色文字，与指标行风格一致。

### 5. 文件路径可点击

**数据传递**：`CodeReportPanel.vue` 已有 `currentProject` computed（GitProject | null），需透传给 `HotspotSection`。

**点击逻辑**：在 `HotspotSection.vue` 中新增 `project` prop，点击文件路径时通过 `getNodeFsPathOs().path.join(resolveValidPath(project), filePath)` 拼出绝对路径，调用 `getElectronModules()?.shell.openPath()` 在文件管理器中打开。`project` 为 null 时路径不可点击（仅文本展示）。

样式：路径区域添加 `cursor: pointer` + hover 下划线或颜色变化。

### 涉及文件

| 文件 | 变更 |
| --- | --- |
| `src/features/gitPush/reportMetrics.ts` | 将 `countFileLines` 从 forEach 内移到 heat 排序后，仅对最终前 HOTSPOT_LIMIT 条计算 |
| `src/features/gitPush/components/report/HotspotSection.vue` | splitPath computed、LOC i18n、截断提示、project prop、点击路径逻辑 |
| `src/features/gitPush/components/report/CodeReportPanel.vue` | 透传 `:project="currentProject"` |
| `src/features/gitPush/styles/HotspotSection.scss` | 截断提示样式 + 可点击路径样式 |
| `src/i18n/zh_CN/gitPush.json` | 新增 `reportHotspotTruncated` |
| `src/i18n/en_US/gitPush.json` | 新增 `reportHotspotTruncated` |


### 验证要点

- `pnpm i18n:verify` 确认中英文键对齐
- `npx tsc --noEmit` 确认类型无新增错误
- 热点文件列表的 LOC 不再出现 `-`（正常文件）或合理显示 `-`（超大/二进制文件）
- 截断提示仅在 `analyzedFiles > hotspots.length` 时显示
- 点击文件路径在 Electron 环境中打开文件管理器