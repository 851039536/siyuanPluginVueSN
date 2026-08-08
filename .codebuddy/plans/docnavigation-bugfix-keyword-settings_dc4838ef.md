---
name: docnavigation-bugfix-keyword-settings
overview: 修复 docNavigation 三个问题：元数据时间不显示（ial 结构）、反向链接下拉面板点不开（IRefFile 缺 id + 事件冒泡）、新增关键词过滤设置入口（内联弹窗编辑 filterKeywords）。
todos:
  - id: fix-docdetail-ial
    content: 修复 DocDetail 接口补 ial 嵌套对象，fetchDocMeta 从 ial 读取时间字段
    status: completed
  - id: fix-backlink-click
    content: BacklinkDropdown 触发按钮加 @click.stop.prevent 阻止事件冒泡
    status: completed
  - id: create-filter-editor
    content: 新建 FilterKeywordsEditor.vue + FilterKeywordsEditor.scss：设置按钮 + 内联编辑面板（输入框/保存/取消）+ 点击外部关闭
    status: completed
  - id: integrate-and-i18n
    content: DocNavContainer 集成 FilterKeywordsEditor，新增 docNavKeywordEdit 图标 + 5 个 i18n 键
    status: completed
    dependencies:
      - create-filter-editor
---

## 用户反馈问题

### 1. DocMetaBar「创建 更新」时间字段空白

导航栏右侧元数据信息条中，"创建"和"更新"时间均显示为空，仅块数"22块"正常显示。根因是 SiYuan `/api/filetree/getDoc` 返回的时间字段嵌套在 `data.ial.created` / `data.ial.updated` 内，而非顶层。当前代码从顶层读取取值始终为 undefined。

### 2. 反向链接下拉面板点击无反应

触发按钮显示"反向链接 (2)"表示数据已加载，但点击按钮后面板不出现。根因是 BacklinkDropdown 触发按钮的点击事件缺少 `.stop` 修饰符，事件冒泡到 document 层后被同页面其他下拉组件（SiblingDropdown、ChildDocDropdown）各自注册的 document click handler 误判为"点击外部"，抢先关闭面板。

### 3. 过滤关键词缺少编辑入口

`filterKeywords` 默认 `["参考"]` 已持久化到 `DocNavSettingsStorage`，但没有任何 UI 可让用户添加、修改或删除关键词。需要新增一个内联编辑入口，支持逗号分隔输入、保存到持久化存储，并实时生效。

## 技术方案

### 修复 1：DocDetail 接口补 `ial` 嵌套对象

**文件**：`src/api.ts`（DocDetail 接口）+ `src/features/docNavigation/types/storage.ts`（fetchDocMeta）

- `DocDetail` 新增可选字段 `ial?: { created?: string; updated?: string }`，保留顶层 `created`/`updated` 字段以兼容（可能其他模块使用了这些字段）
- `fetchDocMeta` 中读取时间改为 `docResult.ial?.created ?? docResult.created ?? ""`（优先 ial，回退顶层）

### 修复 2：BacklinkDropdown 加 `@click.stop`

**文件**：`src/features/docNavigation/components/BacklinkDropdown.vue`

- 触发按钮第 13 行：`@click="togglePanel"` 改为 `@click.stop.prevent="togglePanel"`
- `.stop` 阻止冒泡到 document，`.prevent` 防止 button 默认行为（已有 `type="button"` 但双重保险）

### 新增 3：过滤关键词内联编辑器

**文件**：新建 `components/FilterKeywordsEditor.vue` + `styles/FilterKeywordsEditor.scss`

- 在过滤下拉右侧显示一个小型设置图标按钮
- 点击后弹出内联编辑面板（绝对定位在按钮下方），包含逗号分隔文本输入框、保存/取消按钮
- 保存时通过 `DocNavSettingsStorage` 写入持久化存储，同时调用 `setFilterKeywords()` 立即生效
- 面板支持点击外部关闭（复用 document click handler 模式）

**DocNavContainer.vue 改动**：

- 过滤下拉旁边渲染 `FilterKeywordsEditor`，传入 `plugin`（用于创建 settingsStorage）和 `setFilterKeywords`
- 需新增 props 接收 `filterKeywords` 当前值以展示

### i18n 新增 5 键

| 键 | 中文 | English |
| --- | --- | --- |
| `docNavFilterKeywordsEdit` | 编辑关键词 | Edit Keywords |
| `docNavFilterKeywordsPlaceholder` | 输入关键词，逗号分隔 | Keywords, comma separated |
| `docNavFilterKeywordsSave` | 保存 | Save |
| `docNavFilterKeywordsCancel` | 取消 | Cancel |
| `docNavFilterKeywordsHint` | 逗号分隔多个关键词 | Separate keywords with commas |


### 图标新增

`docNavKeywordEdit`：`mdi:pencil`，颜色 `#8b5cf6`

## 关键代码结构

### DocDetail 接口修正

```typescript
export interface DocDetail {
  id: string
  name: string
  icon: string
  memo: string
  path: string
  size: number
  fcount: number
  subFileCount: number
  created: string
  updated: string
  hCreated: string
  hUpdated: string
  content: string
  markdown: string
  /** getDoc 返回的嵌套块属性（created/updated 在此对象内） */
  ial?: { created?: string; updated?: string }
}
```

### FilterKeywordsEditor 核心交互

```
DocNavContainer
├── ChildDocDropdown（过滤下拉）
└── FilterKeywordsEditor（设置按钮 + 内联面板）
      ├── 触发按钮（pencil 图标）
      └── 内联编辑面板
            ├── 标题"编辑关键词"
            ├── 输入框（当前关键词预填，逗号分隔）
            ├── 提示"逗号分隔多个关键词"
            ├── 保存按钮 → saveToStorage() + setFilterKeywords()
            └── 取消按钮 → 关闭面板
```

## 实施步骤

### 步骤 1：修复 DocDetail `ial` 嵌套

- `api.ts`：DocDetail 新增 `ial?: { created?: string; updated?: string }`
- `storage.ts`：fetchDocMeta 时间读取改为 `docResult.ial?.created ?? docResult.created ?? ""`

### 步骤 2：修复 BacklinkDropdown 点击冒泡

- `BacklinkDropdown.vue`：`@click="togglePanel"` → `@click.stop.prevent="togglePanel"`

### 步骤 3：新增 FilterKeywordsEditor 组件

- 新建 `components/FilterKeywordsEditor.vue` + `styles/FilterKeywordsEditor.scss`
- 内联编辑面板：输入框 + 保存/取消按钮 + 点击外部关闭
- `icons.ts` 新增 `docNavKeywordEdit`

### 步骤 4：集成到 DocNavContainer + i18n

- `DocNavContainer.vue` 集成 FilterKeywordsEditor
- i18n 分片新增 5 个键