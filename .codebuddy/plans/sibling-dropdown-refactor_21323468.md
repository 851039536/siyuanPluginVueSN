---
name: sibling-dropdown-refactor
overview: 将"上一篇"/"下一篇"平铺式导航栏重构为下拉框模式（与"下级文档"样式一致），触发按钮名称改为"同级"，下拉面板展示全部同级文档列表。
todos:
  - id: create-sibling-dropdown
    content: 新建 SiblingDropdown.vue 组件与 styles/SiblingDropdown.scss 样式（复用 ChildDocDropdown 外壳 + 扁平同级列表）
    status: completed
  - id: update-container-and-styles
    content: 修改 DocNavContainer.vue 替换 prev/next HTML 块为 SiblingDropdown；清理 styles/index.scss 中 5 个旧 sibling 样式块
    status: completed
    dependencies:
      - create-sibling-dropdown
  - id: add-i18n-and-icon
    content: 新增 i18n 键 docNavSiblings/docNavSiblingPanelTitle（中英分片）+ icons.ts 注册 docNavSiblings 图标
    status: completed
---

## 用户需求

将 docNavigation 功能中当前的"上一篇"/"下一篇"平铺式导航栏改造为下拉框样式，与现有的"下级文档"（ChildDocDropdown）保持一致，名称改为"同级"。

## 核心功能

- 触发按钮显示"同级 (N)"（N 为同级文档总数），点击展开下拉面板
- 下拉面板列出所有同级文档（扁平列表，非递归树），当前文档高亮标记
- 点击任意同级文档跳转
- 点击面板外部区域自动关闭（复用 ChildDocDropdown 的 document click 机制）
- 替换原有的"上一篇链接 | 序号计数器 | 下一篇链接"平铺布局

## 技术方案

### 实现策略

新建 `SiblingDropdown.vue` 组件，复用 `ChildDocDropdown.vue` 的"触发按钮 + 下拉面板 + Transition + 点击外部关闭"外壳模式，但面板内容替换为同级文档的扁平链接列表（无需 TreeNode 递归树）。

### 核心改动

#### 1. 新建 SiblingDropdown.vue

完全复用 ChildDocDropdown 的模板外壳结构（`.doc-nav-dropdown` 容器、`.doc-nav-dropdown-trigger` 触发按钮、`Transition` 动画），面板内容从 `v-for TreeNode` 改为扁平化同级文档列表：

```html
<div v-for="doc in siblings" :key="doc.id" class="doc-nav-sibling-item"
  :class="{ 'doc-nav-sibling-item--current': doc.id === currentDocId }"
  @click="openDoc(doc.id)">
  {{ stripHtml(doc.content) }}
</div>
```

Props 精简为：`siblings: Block[]`、`siblingCount: number`、`currentDocId`、`i18n`、`openDoc`、`stripHtml`。图标固定使用 `docNavSiblings`。

#### 2. 新建 styles/SiblingDropdown.scss

复用 ChildDocDropdown.scss 的面板/触发按钮/动画样式，新增 `.doc-nav-sibling-item` 同级文档链接样式：`height: 28px`、`padding`、`border-radius`、hover 高亮、当前文档 `.doc-nav-sibling-item--current` 使用 `font-weight-semibold` + 左侧 2px 色条（与 TreeNode 保持一致）。

#### 3. 修改 DocNavContainer.vue

- 将第 39-99 行的整个 `.doc-nav-siblings` HTML 块替换为：

```html
<SiblingDropdown
  v-if="hasSiblings"
  :siblings="siblingDocs.siblings"
  :sibling-count="siblingDocs.siblings.length"
  :current-doc-id="currentDocId"
  :i18n="i18n"
  :open-doc="openDoc"
  :strip-html="stripHtml"
/>
```

- 新增 import `SiblingDropdown`

#### 4. 清理 styles/index.scss

删除第 58-100 行的 5 个旧样式块：`.doc-nav-siblings`、`.doc-nav-sibling`、`.doc-nav-sibling-text`、`.doc-nav-sibling-disabled`、`.doc-nav-sibling-count`（约 43 行）。这些样式在改造后不再需要。

#### 5. i18n 新增 2 键

- `docNavSiblings`：中文"同级" / 英文"Siblings"
- `docNavSiblingPanelTitle`：中文"同级文档" / 英文"Sibling Documents"

仅修改分片文件（`zh_CN/docNavigation.json` 和 `en_US/docNavigation.json`），顶层合并 JSON 由 `pnpm i18n:merge` 自动生成。

#### 6. icons.ts 注册新图标

在 `FEATURE_ICONS.docNavChildren` 下方新增：

```typescript
docNavSiblings: {
  icon: "mdi:format-list-bulleted-square",
  color: "#8b5cf6",
},
```

### 目录结构

```
src/features/docNavigation/
├── components/
│   ├── DocNavContainer.vue          # [MODIFY] 替换 prev/next HTML 为 SiblingDropdown
│   └── SiblingDropdown.vue          # [NEW] 同级下拉组件
├── styles/
│   ├── index.scss                    # [MODIFY] 删除 5 个旧 sibling 样式块
│   └── SiblingDropdown.scss          # [NEW] 同级下拉组件样式
src/config/icons.ts                   # [MODIFY] 新增 docNavSiblings 图标
src/i18n/
├── zh_CN/docNavigation.json          # [MODIFY] 新增 2 键
└── en_US/docNavigation.json          # [MODIFY] 新增 2 键
```

### 性能与兼容

- 无新增数据请求：`siblingDocs` 已有完整数据，下拉展开无需网络请求
- 组件独立创建/销毁：`onUnmounted` 中移除 document click 监听
- `hasSiblings` 仍使用 `siblings.length > 1`，单个同级文档时不显示
- 原有 `siblingDocs.prev`/`siblingDocs.next` 字段保留不动（纯数据，UI 不再使用但数据层不变）