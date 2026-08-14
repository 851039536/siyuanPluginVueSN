---
name: FilterSettings 冗余重复清理
overview: 清理 docAnalysis/FilterSettings.vue 及其 SCSS 中的冗余与重复：合并重复 import、删除平凡包装函数与未使用样式导入、合并重复选择器、移除冗余声明，并修正 hasAnyFilter 中恒真的 wordCountMax 判断。
todos:
  - id: clean-script
    content: 清理 FilterSettings.vue 脚本与模板冗余：合并 import、内联 reset、修正 hasAnyFilter、删除尾部空行
    status: completed
  - id: clean-scss
    content: 清理 FilterSettings.scss 冗余：删除未使用 mixins 导入、合并重复选择器、移除冗余 min-width
    status: completed
---

## 用户需求

审查并清理 `src/features/docAnalysis/components/FilterSettings.vue` 中的冗余与重复代码，保持组件对外接口（props/emits）与功能行为不变。

## 核心改动

- 合并重复的 `import type` 声明
- 删除仅转发 `reset` 事件的平凡包装函数 `handleClearAll`
- 修正 `hasAnyFilter` 中恒为真的 `wordCountMax` 无效判断（唯一行为修正项）
- 清理样式文件中未使用的 mixins 导入、重复选择器与冗余 `min-width: 0` 声明
- 清理模板尾部多余空行

## 技术方案

纯代码清理，不引入新依赖、不新增样式值，严格沿用现有设计 Token 与项目规范。

### 脚本层清理（FilterSettings.vue）

- 合并 95–96 行两条 `import type` 为一条：`import type { FilterOptions, NotebookInfo } from "../types/index"`
- 删除 `handleClearAll` 函数，模板 `@click="handleClearAll"` 改为 `@click="$emit('reset')"`
- 修正 `hasAnyFilter`：`wordCountMin` 改为 `> 0` 判断，`wordCountMax` 改为 `!== DEFAULT_FILTER_OPTIONS.wordCountMax` 判断（默认值 30000 不再误判为已过滤），并新增 `DEFAULT_FILTER_OPTIONS` 导入

### 样式层清理（FilterSettings.scss）

- 删除第 2 行未使用的 `@use "./mixins" as *;`
- 合并 `.filter-input` 与 `.filter-select` 的重复基础样式为 `.filter-input, .filter-select { ... }`，`.filter-select` 单独保留 `cursor: pointer`
- 合并同构的 `.title-input` 与 `.content-input` 为 `.title-input, .content-input { flex: 1; }`
- 移除 `.title-input`/`.content-input`/`.notebook-select` 中与 `.filter-input` 重复的 `min-width: 0`

### 注意事项

- `hasAnyFilter` 修正会影响清空按钮的显示时机（默认状态下不再常显），属预期行为修正
- 遵守项目硬规则：不执行 `pnpm build`/`pnpm lint`，由用户自行验证