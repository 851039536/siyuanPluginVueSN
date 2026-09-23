# globalRelations 代码审查报告

审查对象：\`src/features/globalRelations/\`（5 文件）
依据：\`AGENTS.md\` / \`AGENTS_STYLE.md\` / \`AGENTS_ARCH.md\` 强制规则
结论：**注册链条 8 步齐全**，但存在 **1 个硬规则违规（缺 README）**、**1 处设计 Token 大面积误判**、**3 类组件重复造轮子**、**1 处逻辑重复**、**1 处 SQL 语义缺陷**。

---

## 一、硬规则违规（必须修）

### 1.1 缺少 README.md —— 全项目唯一缺失

\`AGENTS.md\` 硬规则：「**README 文档**：每个 \`src/features/*/\` 目录下必须有 \`README.md\`」

实测：43 个 feature 中 **42 个有 README，\`globalRelations\` 是唯一没有的**。

### 1.2 SCSS 设计 Token 误判（12 个自定义变量中 7 个 claims 错误）

文件头注释声称「无对应 Token」，但对照真源 \`src/components/kit/variables.scss\`，**7 个声明是错的**：

| 自定义变量 | 注释声称 | 实际 Token | 判定 |
|---|---|---|---|
| \`$gr-space-1: 1px\` | 无对应 Token | \`$s-px1\` | ❌ 误判 |
| \`$gr-space-5: 5px\` | 无对应 Token | \`$s-px5\` | ❌ 误判 |
| \`$gr-space-6: 6px\` | 无对应 Token | \`$s-px6\` | ❌ 误判 |
| \`$gr-space-7: 7px\` | 无对应 Token | \`$s-px7\` | ❌ 误判 |
| \`$gr-space-10: 10px\` | 无对应 Token | \`$s-px10\` | ❌ 误判 |
| \`$gr-space-14: 14px\` | 无对应 Token | \`$s-px14\` | ❌ 误判 |
| \`$gr-radius-3: 3px\` | 无对应 Token | \`$r-px3\` | ❌ 误判 |
| \`$gr-space-26: 26px\` | 无对应 Token | 确无 | ✅ 属实 |
| \`$gr-font-11: 11px\` | 介于 2xs 与 xs | 确无（且违反两级字号制） | ⚠️ 见 1.3 |
| \`$gr-radius-5: 5px\` | 无对应 Token | 确无（4/6px） | ✅ 属实 |
| \`$gr-lh-12: 1.2\` | \`$lh-tight\` 为 1.25 | 确无 | ✅ 属实 |
| \`$gr-lh-16: 1.6\` | \`$lh-normal\` 为 1.5 | 确无 | ✅ 属实 |

**影响**：违背「禁止硬编码尺寸——使用全局设计 Token」。这 7 处是**平行定义了一份 Token**，Token 升级时不会跟随，属于隐性债务。

**修法**：删除 \`$gr-space-1/5/6/7/10/14\` 与 \`$gr-radius-3\`，全文件替换为 \`$s-px1/$s-px5/$s-px6/$s-px7/$s-px10/$s-px14/$r-px3\`。

### 1.3 硬编码色值 + 字号越级

- \`$gr-accent: #06b6d4\` —— 硬编码色值。规则：「禁止硬编码色值（使用 \`$color-*\` 语义色）」。注释以「无语义青色档位」为由豁免，但**图标真源 \`kit/icons.ts\` 中 \`globalRelations\` 已把同一色值 \`#06b6d4\` 写死**，两处各写一份、靠注释「须保持一致」互相绑定 —— 这正是应被 \`$c-info\` 或新增语义色收敛的重复。
- \`$gr-font-11: 11px\` —— 违反「两级字号制」（只允许 \`$t-xs\` 12px / \`$t-2xs\` 10px）。11px 是第三级，应回落 \`$t-2xs\` 或 \`$t-xs\`。
- \`$gr-lh-12 / $gr-lh-16\` 同理属自造第三、第四档行高。

---

## 二、组件冗余（违反「共享组件优先复用」）

\`AGENTS.md\`：「按钮/输入框/…/徽标/…/加载态必须用 \`src/components/\` 共享组件，禁止在 feature 内自建同类」。

### 2.1 自建按钮 \`.gr-btn\`（含 3 个变体）→ 应用 \`Button.vue\`

\`index.vue\` 中 4 处 \`<button class="gr-btn">\`：刷新、关闭、3 个方向筛选。SCSS 中 \`.gr-btn / --icon / --small / &.active\` 共 **38 行**完全重写了共享 \`Button\` 已有的能力（\`variant\` / \`size\` / \`icon\` / \`loading\` / \`dense\` / \`title\` / \`ariaLabel\`）。

对照参考实现 \`statistics/components/common/StatisticsHeader.vue\` —— 刷新按钮正确写法是：
\`\`\`vue
<Button :icon="refreshIcon" variant="ghost" size="xsmall" :loading="loading" :title="i18n.refresh" />
\`\`\`

方向筛选（一组互斥选项）应为 \`Button\` 分组 + \`:aria-pressed\`（规则原文如此）。

### 2.2 自建徽标 \`.gr-badge\` → 应用 \`Tag.vue\`

\`gr-badge--bidirectional\`（双向）与 \`gr-badge--count\`（引用 N）手写了「同色系浅底 + 文字 + 描边」——这正是 \`Tag.vue\` 的默认外观。SCSS **21 行**可删。\`Tag\` 支持 \`variant="info"\` 等语义轴。

### 2.3 自建加载态 → 应用 \`Loader.vue\`

\`index.vue\` 用 \`<IconWrapper name="loading">\` 充当加载指示（主区 + 详情区各一处）。项目已有专用 \`Loader.vue\`（\`role="status"\` + 自带无障碍标签），统计等面板均用它。

### 2.4 自建工具栏 → 建议 \`Toolbar.vue\`

\`.gr-toolbar\`（搜索 + 方向筛选，8 行 SCSS）与共享 \`Toolbar.vue\` 的三段式（\`start\`/\`center\`/\`end\`）职责重合，可用 \`start\` 放搜索、\`end\` 放筛选。

### 2.5 搜索框手写 \`<input>\` → 应用 \`Input.vue\`

\`<input class="gr-search__input">\` 手写了 focus 边框、圆角、内边距（\`.gr-search\` 共 **30 行** SCSS）。\`Input.vue\` 提供 \`prefixIcon\`（正好对应手写的绝对定位搜索图标 \`$gr-space-26\` 占位技巧）、\`clearable\`、\`size\`。

### 2.6 空状态为局部布局，**允许保留**

\`.gr-empty\` 属「纯展示的局部布局容器」例外，无需强制抽共享组件（但可考虑与其它 feature 收敛）。

> **冗余量化**：\`.gr-btn\`(38) + \`.gr-badge\`(21) + \`.gr-search\`(30) + \`.gr-toolbar\`(8) ≈ **97 行 SCSS（占 402 行的 24%）** 重写了共享组件已有能力。

---

## 三、代码冗余

### 3.1 \`openDoc\` 重复实现（7 处拷贝）

\`useGlobalRelations.ts:266-269\` 与 \`docAnalysis/useDocAnalysis.ts:285\`、\`docNavigation/useDocNavigation.ts:174-178\`、\`statistics/utils/index.ts:54\`、\`imageCompressor/index.vue:557\` **逻辑逐字相同**：
\`\`\`ts
window.open(\`siyuan://blocks/\${docId}\`)
\`\`\`
本轮已第 ≥3 次出现，满足 Rule of Three 与「同一常量/工具函数被 2 个以上文件使用时必须提取」。应提取到公共工具（如 \`@/utils/domUtils\` 或 \`@/api\`）。

### 3.2 反链合并去重逻辑重复

\`queryBacklinkDocs()\`（\`useGlobalRelations.ts:144-164\`）与 \`fetchBacklinks()\`（\`docNavigation/types/storage.ts:464-500\`）**逐行同构**：
\`\`\`ts
const seen = new Set<string>()
const files = [...(res?.backlinks ?? []), ...(res?.backmentions ?? [])]
for (const file of files) { if (seen.has(file.id)) continue; seen.add(file.id) /* … */ }
\`\`\`
应把它下沉为 \`@/api\` 的公共函数（如 \`getBacklinkDocs(id)\`），两处共用。\`docNavigation\` 版本还多做了 \`stripSySuffix\` / 上限截断，说明这是同一问题的成熟实现。

### 3.3 \`detailsFailed\` 语义与文案不符

\`useGlobalRelations.ts:252-254\`：当 \`contents.length === 0 && backlinkDocs.length === 0\` 时置 \`detailsFailed = true\`，UI 显示「详情加载失败或无数据」（\`loadDetailFailed\`）。但**空结果不是失败**——它把「无锚文本 + 无反链」的正常空态误报为错误态。模板中 \`noAnchorText\` / \`noBacklinkDocs\` 两个空态键因此几乎永不显示，成为死代码。

**修法**：删掉 \`detailsFailed\` 的这条赋值路径（仅保留 catch 分支），让空态落到已有的 \`noAnchorText\` / \`noBacklinkDocs\`。

### 3.4 模板 i18n 注释缺失

硬规则要求「模板中每处使用 i18n 键渲染文案的位置必须加中文注释」+「主要结构区块加中文区块注释」。现状是**部分覆盖**：刷新/关闭/标题有注释，但 \`directionAll\` 等注释写成了「方向筛选："全部"」而 \`i18n.directionAll\` 实际值也是「全部」——尚可；不过 \`gr-stats\` 的 4 张卡片、\`gr-row__meta\` 徽标等已注释。**基本合规**，无硬伤。

### 3.5 \`index.vue\` 334 行 —— 未越 500 硬阈值但已过 300 警戒线

\`AGENTS_ARCH.md\`：300 行警戒线。334 行已越线。若按第二节接入共享组件，模板可显著收缩（\`.gr-btn\` 4 处、\`.gr-badge\` 2 处、加载态 2 处、搜索 1 处被替换）。**建议**：把「统计卡片」「关系行（含详情展开）」「工具栏」拆为 \`components/\` 子组件。

---

## 四、逻辑/查询问题

### 4.1 \`ORDER BY\` + \`LIMIT\` 截断会产生「连接不完整」的误导

\`queryGlobalRelations\` 取 \`ORDER BY refCount DESC LIMIT 501\` 后截断到 500 并提示「仅显示引用数最高的前 500 条关系」。当关系数超限时，**双向关系的「另一半」可能被截掉**：若 A→B 上榜而 B→A 因 refCount 低被丢弃，\`bidirectional\` 的 \`EXISTS\` 子查询仍会把 A→B 标为双向，但用户看不到 B→A 那一行 —— 统计「双向/单向」计数与实际展示不一致。属**已知取舍但未在 UI 说明**，建议在 \`truncatedHint\` 中补充说明，或改为按文档对去重展示。

### 4.2 \`truncated\` 在空结果时不会被重置的边界

\`refresh()\` 中 \`truncated.value = result.truncated\` 总会赋值，无此问题。✅

### 4.3 SQL 注入面已正确防护

\`queryRelationContents\` 对 \`sourceId\`/\`targetId\` 使用了 \`escapeSql\`，且 \`limit\` 做了 \`Math.max(1, Math.min(limit, 200))\` 钳制后内插。✅ **正确**。主查询无用户输入内插。✅

### 4.4 \`parseAnchorText\` 健壮，但可测

\`parseAnchorText\`（30 行，处理 string/JSON/数组/对象 4 种形态）是纯函数、分支多，属「解析类纯函数」——按规则应有 \`*.spec.ts\` 行为断言。当前**无测试**。建议补 \`parseAnchorText.spec.ts\`。

---

## 五、合规项（做得好的部分）

- ✅ **8 步注册清单全齐**：\`features/index.ts\`（export + \`_Registered\` 联合类型 L126）、\`config.ts\` L337-348、\`src/index.ts\` L127 \`DESTROYABLE_KEYS\`、\`config/settings.ts\`（\`enableGlobalRelations\` 接口 + 默认值）、\`i18n/{zh_CN,en_US}/globalRelations.json\`、\`kit/icons.ts\` L326。
- ✅ **实例挂载与销毁模式**：\`registerGlobalRelations\` 内部自挂载 \`(plugin as any).__globalRelations = manager\`，字段已进 \`DESTROYABLE_KEYS\`，\`Manager\` 提供 \`destroy()\`。**完全符合规范**。
- ✅ **Modal 走统一入口** \`createModalVueApp\`。✅ 无直接 \`fetch\`。✅ SQL 走 \`@/api\` 的 \`sql()\`。
- ✅ **SCSS 已分离**到 \`styles/index.scss\`，\`<style scoped>\` 仅 \`@use\`。
- ✅ **文件头注释**：\`.ts\`/\`.vue\` 均有。
- ✅ **i18n 中英键对齐**（各 27 键），**无硬编码兜底值**（未出现 \`i18n.x || '中文'\`）。
- ✅ **禁 emoji 图标**：全部走 \`IconWrapper\` + 已注册 \`IconKey\`。
- ✅ **分层**：类型在 \`types/index.ts\`，视图逻辑在 \`composables/\`。\`Manager\` 类放 \`types/\` 符合布局规范。
- ✅ **无 \`box-shadow\`**、**无 \`backdrop-filter\`**。
- ✅ **\`types/\` 仅放类型 + Manager，无 register 函数**。

---

## 六、修复优先级

| 优先级 | 事项 | 位置 |
|---|---|---|
| **P0** | 补 \`README.md\`（全项目唯一缺失，硬规则） | \`globalRelations/README.md\` |
| **P0** | 7 个误判 Token 换回 \`$s-px*\` / \`$r-px3\` | \`styles/index.scss\` L10-20 |
| **P1** | 删除 \`detailsFailed\` 空结果误判分支 | \`useGlobalRelations.ts\` L252-254 |
| **P1** | 自建按钮/徽标/加载态改用 \`Button\`/\`Tag\`/\`Loader\` | \`index.vue\` + SCSS |
| **P1** | \`openDoc\` 提取公共工具（7 处重复） | \`useGlobalRelations.ts\` L266 |
| **P2** | \`$gr-accent\` 硬编码色值收敛为语义色 | \`styles/index.scss\` L6 |
| **P2** | \`$gr-font-11\` 回落到两级字号制 | \`styles/index.scss\` L17 |
| **P2** | 反链去重逻辑下沉 \`@/api\`（与 docNavigation 共用） | \`useGlobalRelations.ts\` L144 |
| **P2** | 拆分子组件，\`index.vue\` 回到 300 行内 | \`index.vue\` |
| **P3** | 补 \`parseAnchorText.spec.ts\` 行为断言 | 新增 |
| **P3** | 截断提示补充「双向计数可能与展示不一致」说明 | i18n + \`useGlobalRelations.ts\` |

---

## 附：建议的共享组件接入示意

\`\`\`vue
<Button :icon="'refresh'" variant="ghost" size="xsmall" :loading="loading" @click="refresh" />
<Button variant="ghost" size="xsmall" icon="close" :title="i18n.close" @click="onClose" />
<Tag :content="row.refCount" variant="secondary" size="xsmall" />
<Tag v-if="row.bidirectional" variant="info" size="xsmall">{{ i18n.bidirectionalBadge }}</Tag>
<Loader v-if="loading" />
<Input v-model="searchQuery" size="small" prefix-icon="search" :placeholder="i18n.searchPlaceholder" />
\`\`\`
