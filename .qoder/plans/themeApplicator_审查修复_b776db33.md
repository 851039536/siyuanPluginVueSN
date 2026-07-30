# themeApplicator / themes 审查修复计划

## 背景

代码审查确认 `src/features/docAnalysis/utils/` 下两文件存在：1 个确定性逻辑 bug（`pre code` 样式因键遍历顺序永不生效）、无语言代码块误用行内样式、深底浅字配色冲突、`codeTheme` 死字段、`escapeHtmlAttr` 重复实现、共享常量可变污染风险。无内存泄露。

## themeApplicator.ts 修改

### 1. 重写 `applyElementStyles` 的匹配策略（修 bug #1/#2）

按固定三阶段处理，替代现有"按键顺序统一正则"的循环：

1. **先处理 `pre code`**（若主题定义了该键）：
   - `result.replace(/<code class="language-/g, `<code style="${s}" class="language-`)` — 有语言的围栏代码
   - `result.replace(/<pre><code>/g, `<pre><code style="${s}">`)` — 无语言的围栏代码（bug #2）
2. **再处理行内 `code`**：精确匹配 `/<code>/g` → `<code style="${s}">`。此时块级 code 已带 `style=` 属性，不会被误伤
3. **最后循环其余标签**（跳过 `code` 与 `pre code` 两个键）：正则改为 `new RegExp(`<${tag}(?=[>\\s])(?![^>]*\\bstyle=)`, "g")` — 负向前瞻跳过已含 `style=` 的标签，同时解决重复 style 属性覆盖作者样式的问题（缺陷 #4），并使 `applyTheme` 幂等

### 2. 删除本地 `escapeHtmlAttr`（冗余 #7）

改为 `import { escapeHtml } from "@/utils/stringUtils"`，`buildExportableHtml` 中 `<title>` 处调用替换。

### 3. `buildStyleString` 转义双引号（缺陷 #5）

值中 `"` 替换为 `&quot;`，防止未来主题可配置时截断 style 属性；函数头注释补充说明。

## themes.ts 修改

### 4. 删除 `codeTheme: "github"` 死字段（冗余 #6）

### 5. 代码块配色统一为亮色系（缺陷 #3）

与共享 mdRenderer 的 GitHub-light 内联高亮色匹配：
- `pre`：`background` 改 `#f6f8fa`，其余不变
- `pre code`：`color` 改 `#24292e`，其余不变（保留 transparent/padding 0/13px）

### 6. 冻结导出常量

`DEFAULT_THEME` 导出前对 theme 对象、`container`、`elements` 及各元素样式表执行 `Object.freeze`（新增私有 `freezeTheme` 辅助函数，≤10 行），防止 `PublishPanel.vue` 中 `ref(DEFAULT_THEME)` 深层响应式误改污染模块单例。`currentTheme` 仅整体替换 `.value`，冻结不影响现有用法。

## types/index.ts 修改

### 7. 移除死类型

- `PublishTheme` 接口删除 `codeTheme` 字段及其注释
- 删除 `CodeTheme` 联合类型定义（全局仅 themes.ts 与 types 引用，无消费方）

## 测试计划

由用户自行执行（AI 不运行 build/lint）：

```bash
npx tsc --noEmit    # 确认 codeTheme 移除后无类型残留引用
pnpm lint           # 代码规范
```

手动验证：docAnalysis 发布面板中渲染含以下内容的 Markdown——有语言围栏代码块（应为浅底深字 + 高亮色）、无语言围栏代码块（应与有语言块一致，无粉字灰底）、行内 code（粉字 `#d14` 灰底）、含 `style` 属性的原始 HTML（作者样式保留）。

## 假设

- marked 输出的行内代码恒为无属性 `<code>`（已从 `src/utils/mdRenderer.ts` 渲染器实现确认）
- `PublishPanel.vue` 对 `currentTheme` 只做整体赋值不做深层字段修改，无需改动该文件
