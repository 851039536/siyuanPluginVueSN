---
name: themeColor-refactor
overview: 审查 themeColor 模块，消除数据冗余（hex → RGB 自动推导、移除重复 id 字段），收紧类型，改进注册逻辑，更新 README 文档，并给出扩展建议。
todos:
  - id: refactor-index-ts
    content: 重构 index.ts：移除 id/primaryRgb 冗余字段，新增 hexToRgb 工具函数，合并 removeTheme 为 clearTheme，更新 registerThemeColor 内部逻辑
    status: completed
  - id: update-superpanel
    content: 更新 superPanel/index.vue 中 THEMES 消费方式：Object.values 改为 Object.entries，从 key 提取 id 替代 t.id
    status: completed
    dependencies:
      - refactor-index-ts
  - id: update-readme
    content: 更新 README.md：修正扩展新主题示例代码（移除 id/primaryRgb），补充 sakura/codex 主题到已支持列表，追加扩展建议章节
    status: completed
    dependencies:
      - refactor-index-ts
---

## 用户要求

审查 `src/features/themeColor/` 目录代码，识别并合并冗余，评估性能优化可能性，在不影响现有功能逻辑前提下重构，确保符合 CLAUDE.md 编码规范，并给出扩展建议。

## 审查结论

目录含 `index.ts`（71行）和 `README.md`（34行），无 CSS/SCSS 文件。

### 已识别三个冗余点

1. **`id` 字段冗余（高优先级）**：`THEMES` 的 Record 键名（如 `orange`）与值内 `id: "orange"` 完全重复，新增主题时必须同步维护两处
2. **`primaryRgb` 冗余（高优先级）**：每条主题手动维护 `primaryRgb`（如 `"217, 119, 87"`），该值可由 `primary` hex（`"#d97757"`）通过 `hexToRgb()` 在运行时推导
3. **`removeTheme()` 函数碎片化（低优先级）**：仅 2 行 `removeProperty` 调用，与 `applyTheme()` 功能对称但分离，可合并为单一 `applyTheme(scheme | null)` 接口

### 受影响的消费方（不可破坏）

- `src/index.ts`：调用 `registerThemeColor()` 获取 `{ destroy }` 对象，依赖 `destroy()` 清理
- `src/features/superPanel/index.vue`：`Object.values(THEMES).map(t => ({ value: t.id, ... }))` 生成下拉选项
- `src/features/superPanel/types/index.ts`：`handleSelectFeature("themeColor", value)` 更新设置项

### 扩展建议范围

在不写额外代码的前提下，文档化以下可扩展方向：用户自定义主题、主题过渡动画、更多 CSS 变量覆盖、superPanel 中主题色预览增强。

## 技术方案

### 重构策略

#### 1. 消除 `primaryRgb` 冗余

新增 `hexToRgb(hex: string): string` 工具函数，在 `applyTheme()` 内部将 hex 自动转换为 RGB 字符串，删除 `ThemeColorScheme.primaryRgb` 字段及 THEMES 中 4 条的手动维护值。

**复杂度**：`hexToRgb()` 对 7 字符 hex 执行固定 3 次 `parseInt`，O(1) 时间。运行时开销可忽略（单次主题切换仅执行一次）。

```typescript
/** 将 #RRGGBB 转为 "R, G, B" 格式 */
function hexToRgb(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `${r}, ${g}, ${b}`
}
```

#### 2. 消除 `id` 字段冗余

- 从 `ThemeColorScheme` 接口移除 `id`
- THEMES 的值对象仅保留 `name` 和 `primary`
- 消费方改用 `Object.entries(THEMES)` 获取 id（从 key 提取）

#### 3. 合并 `removeTheme()` 为 `clearTheme()`

将两个独立的 DOM 操作函数统一为带参模式：`applyTheme(scheme)` 设置 CSS 变量，`clearTheme()` 清除。对外仍暴露 `{ destroy }` 接口，内部调用 `clearTheme()`。

### 向下兼容

- `registerThemeColor()` 签名 `(plugin, schemeId?) => { destroy }` 不变
- `DEFAULT_THEME_SCHEME` 常量不变
- `THEMES` 仍为 `Record<string, ThemeColorScheme>` 导出（但 `ThemeColorScheme` 接口瘦身）
- superPanel 的 `themeSchemeOptions` computed 输出结构不变（`{ value, label, color }[]`）

### 架构不变

模块保持当前简单架构：常量注册表 + DOM 操作函数 + 单一导出入口，无新增依赖，无存储层，无事件总线介入。

### 性能评估

- DOM 操作仍为 2 次 `setProperty` / `removeProperty`，已是最优
- `hexToRgb()` 在 `applyTheme()` 中调用一次，无循环无递归
- `Object.entries(THEMES)` 与 `Object.values(THEMES)` 同为 Object 静态方法，性能无差异
- 无新增重渲染路径，无内存泄漏风险