---
name: skills-to-prompts-refactor
overview: 将 `src/features/skills/` 重命名为 `prompts`，同步更新全部引用（配置/设置/i18n/存储/组件），同时审查并优化代码质量、合并冗余、修复性能问题，确保符合 CLAUDE.md 规范。
todos:
  - id: rename-folder-and-internal
    content: 重命名文件夹 skills→prompts 并更新内部所有引用（类名/函数名/导入路径/存储key迁移逻辑）
    status: completed
  - id: update-external-refs
    content: 更新外部引用链：src/index.ts、App.vue、features/index.ts、config.ts、settings.ts、icons.ts、floatingBox 等 10+ 文件
    status: completed
    dependencies:
      - rename-folder-and-internal
  - id: i18n-refactor
    content: 重命名 i18n 文件并修改顶层 JSON key 为 prompts（zh_CN + en_US）
    status: completed
    dependencies:
      - rename-folder-and-internal
  - id: code-quality-refactor
    content: 代码质量重构：消除冗余（未使用导入/方法/重复迁移逻辑）+ 性能优化（computed/数组操作/watch）
    status: completed
    dependencies:
      - rename-folder-and-internal
  - id: scss-fix
    content: SCSS 修正：统一 mixins 别名 + 替换硬编码圆角值为全局 Token
    status: completed
    dependencies:
      - rename-folder-and-internal
  - id: verify
    content: 执行四项验证：eslint、i18n verify、icon validate、tsc 编译检查
    status: completed
    dependencies:
      - update-external-refs
      - i18n-refactor
      - code-quality-refactor
      - scss-fix
---

## 用户需求

审查 `src/features/skills/` 提示词库功能模块，将文件夹重命名为 `prompts`（对齐项目 camelCase 规范），同时进行全面的代码质量审查与重构。

## 核心任务

1. **文件夹重命名**：`src/features/skills/` 重命名为 `src/features/prompts/`，同步更新所有跨文件引用（约 16 个外部文件）
2. **消除代码冗余**：删除未使用的 `SkillsStorage.init()` 方法，移除 `CategoryManageModal.vue` 中未使用的 `IconWrapper` 导入，统一 `PromptFormModal.vue` 中 vue 导入风格，合并 `usePrompts.load()` 与 `migratePrompts()` 中重复的迁移检测逻辑
3. **性能优化**：优化 `filteredPrompts` 和 `allCategories` computed 避免不必要的新对象/数组创建，修复 `watch` 的 `immediate: true` 无效果问题，优化 `moveContentBlock` 的数组重建方式
4. **SCSS 修正**：将 5 个 partial 文件中误导性的 `as floatingBox` 别名统一为 `as m`，替换 `$card-border-radius: 8px` 为全局 Token `$radius-md`
5. **存储向后兼容**：存储 key 从 `"siyuan-skills"` 改为 `"siyuan-prompts"`，首次读取时回退检查旧 key 并自动迁移；设置字段 `enableSkills` 改为 `enablePrompts`，兼容读取旧值

## 约束

- 不影响现有功能逻辑
- 不破坏 `skillsViewer` 独立功能
- 构建产物（合并后的 i18n JSON）只通过构建流程自动生成，不手动编辑
- 所有修改需通过 eslint、i18n verify、icon validate、tsc 四项验证

## 技术栈

- TypeScript + Vue 3 Composition API
- SCSS（`src/_variables.scss` 全局设计 Token）
- 思源笔记插件框架（`siyuan` 包）
- 项目统一 API：`PluginStorage` / `TypedStorage` / `createModalVueApp` / `emitCustomEvent` / `copyToClipboard`

## 实现方案

### 1. 重命名策略

采用"文件系统重命名 + 全量引用替换"两步走：

**步骤 A — 文件夹重命名与内部更新**：

- 使用 git 或文件系统操作将 `src/features/skills/` 重命名为 `src/features/prompts/`
- 更新内部文件之间的相对导入路径（`"./types"` 等保持不变，仅文件夹名变更）
- 类 `SkillsStorage` → `PromptsStorage`，函数 `registerSkills` → `registerPrompts`、`showSkillsModal` → `showPromptsModal`
- i18n 文件 `skills.json` → `prompts.json`，顶层 JSON key 从 `"skills"` 改为 `"prompts"`

**步骤 B — 外部引用更新**：修改所有外部文件中对 skills 的引用，涵盖 8 步注册链的全部环节。

### 2. 设置向后兼容方案

```ts
// src/config/settings.ts — PluginSettings 接口
enablePrompts: boolean  // 新字段名

// DEFAULT_SETTINGS
enablePrompts: true,

// 加载时兼容旧值（在 loadAndApplySettings 的逻辑中）
if (settings.enableSkills !== undefined && settings.enablePrompts === undefined) {
  settings.enablePrompts = settings.enableSkills;
}
```

### 3. 存储迁移方案

```ts
// PromptsStorage 构造函数
// 尝试从 "siyuan-prompts" 加载，失败则回退到 "siyuan-skills" 并自动迁移
async load(): Promise<Prompt[]> {
  let data = await this.promptsTyped.loadOrDefault(); // 新 key
  if (!data || data.length === 0) {
    // 回退读取旧 key
    const oldData = await legacyStorage("siyuan-skills");
    if (oldData) {
      await this.promptsTyped.save(oldData); // 迁移到新 key
      return oldData;
    }
  }
  return data;
}
```

### 4. 性能优化细节

- **`filteredPrompts` computed**：不再对每个 prompt 执行 `{ ...prompt }` 全量展开，改用独立的 `promptCategoryMeta` Map 缓存分类元数据，仅在分类变化时重建
- **`allCategories` computed**：利用 Vue computed 的缓存特性，将 `"all"` 条目定义为模块级常量引用，避免每次重新创建数组
- **`watch` immediate 去除**：`PromptFormModal.vue` 中 watch 仅需响应 `props.show` 变化触发 `initForm()`，移除 `immediate: true`，初始化逻辑改到组件内部首次渲染时执行
- **`moveContentBlock` 优化**：使用 `splice` 双向操作代替全量数组替换，避免触发深层响应式重建

### 5. SCSS 修正

- 5 个文件中的 `@use "./mixins" as floatingBox` 统一改为 `@use "./mixins" as m`
- `_mixins.scss` 中的 `$card-border-radius: 8px` 改为直接引用 `$radius-md`
- 对应的 `marginBottom` / `margin-bottom` 风格统一

## 目录结构

```
src/features/prompts/          # [NEW] 原 skills/ 重命名
├── index.ts                   # [MODIFY] registerPrompts + showPromptsModal
├── index.vue                  # [MODIFY] 内部引用更新
├── components/
│   ├── CategoryManageModal.vue # [MODIFY] 移除未使用 IconWrapper 导入
│   ├── DeleteConfirmModal.vue  # [MODIFY] 无实质变更（引用路径自动更新）
│   ├── PromptFormModal.vue     # [MODIFY] 统一 vue 导入 + 优化 watch + moveContentBlock
│   └── PromptsGrid.vue         # [MODIFY] 无实质变更
├── composables/
│   ├── useCategoryManager.ts   # [MODIFY] 引用 SkillsStorage → PromptsStorage
│   └── usePrompts.ts           # [MODIFY] 合并迁移逻辑 + 引用更新
├── styles/
│   ├── index.scss              # [MODIFY] 无实质变更
│   ├── _mixins.scss            # [MODIFY] $card-border-radius → $radius-md
│   ├── _modal.scss             # [MODIFY] as floatingBox → as m
│   ├── _grid.scss              # [MODIFY] as floatingBox → as m
│   ├── _form.scss              # [MODIFY] as floatingBox → as m
│   ├── _category.scss          # [MODIFY] as floatingBox → as m
│   └── _responsive.scss        # [MODIFY] 无实质变更
└── types/
    ├── index.ts                # [MODIFY] 无实质变更（纯类型定义）
    └── storage.ts              # [MODIFY] SkillsStorage→PromptsStorage + 存储key迁移

src/config/
├── settings.ts                 # [MODIFY] enableSkills → enablePrompts + 旧值兼容
└── icons.ts                    # [MODIFY] skills → prompts

src/features/
├── index.ts                    # [MODIFY] 导出 + _Registered 联合类型
├── config.ts                   # [MODIFY] FEATURE_CONFIG id + i18n key
└── floatingBox/
    ├── index.vue               # [MODIFY] enableSkills → enablePrompts
    └── tools/prompts.ts        # [MODIFY] i18n 命名空间 skills → prompts

src/
├── index.ts                    # [MODIFY] 导入/注册/清理
└── App.vue                     # [MODIFY] 导入 + 事件监听

src/i18n/
├── zh_CN/prompts.json          # [NEW] 原 skills.json 重命名 + key 改为 prompts
└── en_US/prompts.json          # [NEW] 原 skills.json 重命名 + key 改为 prompts
```

## 关键代码结构

### PromptsStorage 类（重构后）

```ts
export class PromptsStorage {
  readonly prompts: TypedStorage<Prompt[]>
  readonly categories: TypedStorage<PromptCategory[]>
  private static readonly STORAGE_KEY_PROMPTS = "siyuan-prompts"
  private static readonly STORAGE_KEY_CATEGORIES = "siyuan-categories"
  private static readonly LEGACY_KEY_PROMPTS = "siyuan-skills"

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.prompts = new TypedStorage<Prompt[]>(storage, PromptsStorage.STORAGE_KEY_PROMPTS, [])
    this.categories = new TypedStorage<PromptCategory[]>(storage, PromptsStorage.STORAGE_KEY_CATEGORIES, [])
  }

  // 加载提示词：先读新 key，为空时回退旧 key 并迁移
  async loadWithMigration(): Promise<Prompt[]>

  // 移除了未使用的 init() 方法
}
```