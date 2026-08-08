---
name: docNavigation-参考下拉框
overview: 在 docNavigation 导航条中，于现有「下级文档」下拉框之后新增「参考」下拉框：内容同为下级文档，仅当当前文档标题（文档名）包含「参考」且存在子文档时显示。
todos:
  - id: generalize-dropdown
    content: 通用化 ChildDocDropdown：新增 triggerText/panelTitle/triggerIcon 可选 props，模板改用 props 渲染
    status: completed
  - id: title-detection
    content: useDocNavigation 并行 getBlockByID 获取文档标题，新增 docTitle ref 与 hasReference computed；storage.ts 缓存类新增 titleCache
    status: completed
  - id: render-reference
    content: DocNavContainer 解构 hasReference 并在下级文档后追加「参考」下拉框实例，现有实例传参适配新 props
    status: completed
    dependencies:
      - generalize-dropdown
      - title-detection
  - id: i18n-icons-readme
    content: 新增 i18n 分片键 docNavReference/docNavReferencePanelTitle，icons.ts 注册 docNavReference 图标，更新 README
    status: completed
    dependencies:
      - render-reference
  - id: verify
    content: read_lints 检查 docNavigation 目录，确认无新增错误，提示用户运行 i18n:verify/validate:icons/tsc/lint
    status: completed
    dependencies:
      - i18n-icons-readme
---

## 产品概述

在 docNavigation 导航条中，于现有「下级文档 (N)」下拉框之后新增「参考」下拉框。两者内容完全相同（复用同一份下级文档树与数量），差异仅在显示条件：**当前文档标题（文档名）包含"参考"二字且存在子文档时**，「参考」下拉框才显示。

## 核心功能

- 「参考」下拉框展示与「下级文档」完全一致：触发按钮（图标 + "参考 (N)" + 展开三角）、面板标题、树形懒加载子文档、点击外部关闭
- 触发条件：当前文档标题包含"参考"（包含匹配，如"参考资料""参考链接"也触发）+ 有子文档（childCount > 0），两者同时满足才显示
- 两个下拉框并排排列，互不干扰（各自独立开关与外部点击关闭）

## 技术选型

沿用现有技术栈：Vue 3 + TypeScript + SCSS（设计 Token）+ 思源 API。零新增依赖。

## 实施方案

### 核心策略：复用 ChildDocDropdown，props 通用化（DRY）

现有 `ChildDocDropdown.vue` 的 UI 结构与「参考」需求完全一致（触发按钮 + 面板 + TreeNode 树 + 外部点击关闭），**禁止复制粘贴新组件**。通过新增 3 个可选 props 通用化，在 `DocNavContainer.vue` 渲染两个实例：

- `triggerText: string`（触发按钮文字，现有传 `i18n.docNavShowChildren`，参考传 `i18n.docNavReference`）
- `panelTitle: string`（面板标题，现有传 `i18n.docNavPanelTitle`，参考传 `i18n.docNavReferencePanelTitle`）
- `triggerIcon?: string`（触发按钮图标名，默认 `docNavChildren`，参考传 `docNavReference`）

### 文档标题检测

- `useDocNavigation.ts` 的 `loadHierarchy()` 中，在现有 `Promise.all` 基础上**并行**增加一次 `api.getBlockByID(docId)`：文档根块的 `content` 即文档标题（可能含内联 HTML 标记，用现有 `cache.stripHtml()` 清洗后再判断）
- 标题存入新 ref `docTitle`；新增 `hasReference` computed = `childCount > 0 && docTitle.includes("参考")`
- 标题获取**独立容错**：失败时 `docTitle` 置空，仅「参考」框不显示，不阻断面包屑/同级/下级文档等主功能渲染（不可并入主 Promise.all，避免一处失败拖垮整条导航）
- 缓存：在 `DocNavigationCache` 新增 `titleCache`（`getCachedTitle`/`setCachedTitle`，沿用现有 `get`/`set` 私有方法与 TTL/容量策略），`clearAll()` 同步清理。同一文档在 switch-protyle 事件下会多次触发 `loadHierarchy`，缓存可避免重复 SQL 查询

### 显示与渲染

- `DocNavContainer.vue` 在现有 `ChildDocDropdown` 之后追加参考实例：`<ChildDocDropdown v-if="hasReference" :trigger-text="i18n.docNavReference" :panel-title="i18n.docNavReferencePanelTitle" :trigger-icon="docNavReference" ...>`，其余 props（childDocs/notebook/currentDocId/childCount/i18n/openDoc/stripHtml）与现有实例相同
- 间距：`.doc-navigation` 已有 `gap: 8px`，两个并排下拉框自动获得间距，无需新增样式

### 性能

- 标题查询与 hierarchy/breadcrumb/siblings 并行（`Promise.all`），零额外串行延迟；标题结果缓存于 titleCache，重复事件不重复查询
- 匹配为 O(标题长度) 的字符串 includes，可忽略

## 目录结构

```
src/features/docNavigation/
├── components/
│   ├── ChildDocDropdown.vue   # [MODIFY] 新增 triggerText/panelTitle/triggerIcon props 通用化
│   ├── DocNavContainer.vue    # [MODIFY] 解构新增 hasReference/docTitle；追加「参考」下拉框实例
│   └── TreeNode.vue           # [MODIFY] 无改动（纯复用）
├── composables/
│   └── useDocNavigation.ts    # [MODIFY] loadHierarchy 并行取标题；新增 docTitle ref + hasReference computed；UseDocNavigationReturn 扩展
├── types/
│   ├── index.ts               # [MODIFY] DocNavigationCache 相关类型无改动；可选新增 TitleCacheItem 类型
│   └── storage.ts             # [MODIFY] DocNavigationCache 新增 titleCache + getCachedTitle/setCachedTitle/clearAll 同步清理
├── styles/
│   └── ChildDocDropdown.scss  # [MODIFY] 无改动（gap 已由 .doc-navigation 提供）
src/config/icons.ts            # [MODIFY] 注册 docNavReference 图标（如 mdi:book-open-variant，与 docNavChildren 同色系 #8b5cf6）
src/i18n/zh_CN/docNavigation.json  # [MODIFY] 新增 docNavReference="参考"、docNavReferencePanelTitle="参考"
src/i18n/en_US/docNavigation.json  # [MODIFY] 新增 docNavReference="Reference"、docNavReferencePanelTitle="References"
src/features/docNavigation/README.md # [MODIFY] 补充「参考」下拉框特性说明
```

## 实施要点

- 标题判断必须 `stripHtml` 后再 `includes("参考")`（根块 content 可能含 `<strong>` 等内联标记）
- `getBlockByID` 异常/空返回需判空，失败降级为空标题
- i18n 只改分片文件，合并 JSON 由 `pnpm i18n:merge` 自动生成，禁止手动改
- 新增图标须在 `src/config/icons.ts` 注册（现有 `FEATURE_ICONS` 中的 `docNavChildren: mdi:folder-multiple` 同段位置添加），否则 `pnpm validate:icons` 报错
- 参考下拉按钮文字沿用现有 Codex 风格（设计 Token + 思源 CSS 变量），不新增样式文件