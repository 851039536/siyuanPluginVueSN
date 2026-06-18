---
name: imageCompressor-optimization
overview: 对 imageCompressor 功能模块进行全面审查和优化，修复 Blob URL 内存泄漏、硬编码中文、CSS 空规则、样式违规、安全风险等问题，并提取 composable 优化代码结构。
todos:
  - id: fix-critical-issues
    content: 修复三个严重问题：Blob URL 内存泄漏（scanner.ts 增加 revokeImageUrls + ImageInfo 追踪）、SQL 注入（scanner.ts/或 index.vue 中增加 escapeSqlString 转义）、原生 confirm 替换为 i18n 二次确认
    status: completed
  - id: i18n-hardcoded-strings
    content: 补充 i18n 缺失键（zh_CN + en_US 各新增 12+ 键），消除 index.vue 和 CompressDialog.vue 中所有硬编码中文文本
    status: completed
  - id: fix-css-violations
    content: 修复 CSS 问题：删除空规则、box-shadow 改为 border 表达层级、创建 CompressDialog.scss 并修改 CompressDialog.vue 引用
    status: completed
  - id: extract-composables
    content: 将 index.vue 约 730 行业务逻辑抽取为 4 个 composable（useImageScanner / useImageSelection / useImagePagination / useImageCompress），精简 index.vue 至 ~300 行
    status: completed
    dependencies:
      - fix-critical-issues
      - i18n-hardcoded-strings
  - id: fix-minor-issues
    content: 修复次要问题：删除未使用的 ImageComparison 类型、copyImageName 改用 copyToClipboard、onImageError 去除 innerHTML 改用 DOM API
    status: completed
    dependencies:
      - extract-composables
  - id: verify-and-validate
    content: 使用 [subagent:code-explorer] 验证所有文件依赖和引用路径正确，使用 [skill:universal-arch-skill] 审查整体架构合规性，运行 pnpm lint 确保零错误
    status: completed
    dependencies:
      - fix-minor-issues
      - fix-css-violations
---

## 审查模块

`src/features/imageCompressor/` —— 思源笔记图片压缩功能模块

## 审查范围

对全部 10 个源文件、注册链路（8 步）、i18n 文件和跨功能通信进行全覆盖审查。

## 发现的问题（按严重程度排列）

### 严重问题（3 处）

1. **Blob URL 内存泄漏** — `services/scanner.ts` 第 103 行 `URL.createObjectURL(blob)` 创建的 URL 仅在 `batchGetImageDetails` 中 minSizeKB 筛选跳过的图片会被 revoke（188-190 行），保留在 `images` 数组中的图片 URL 永不释放，长时间使用后累积导致内存泄漏。
2. **SQL 注入风险** — `index.vue` 第 694-699 行 `navigateToDoc` 使用模板字符串 `${imagePath}` 和 `${image.name}` 直接拼入 SQL，未做转义，可能被恶意文件名注入 SQL。
3. **原生 confirm 无 i18n** — `index.vue` 第 612 行 `confirm("确定要替换原图吗? 此操作不可撤销!")` 硬编码中文，且不使用项目统一的弹窗系统。

### 中等问题（3 处）

4. **10+ 处硬编码中文文本** — 包括 SiSelect label、分页按钮 fallback、按钮 title 属性、下拉选项 label、预览提示文字等，均未使用 i18n。
5. **空 CSS 规则** — `styles/index.scss` 第 292-293 行 `&:hover img { }` 为空块，无意义代码。
6. **3 处 box-shadow 违规** — `styles/index.scss` 第 42/119/255 行使用了 `box-shadow`，违反项目 Codex UI 规范（禁用 box-shadow，改用 border 表达层级）。

### 轻微问题（5 处）

7. **未使用的类型 `ImageComparison`** — 定义于 `types/index.ts` 第 30-39 行，整个模块无任何文件导入使用。
8. **违反统一入口规则** — `index.vue` 第 667 行 `copyImageName` 直接调用 `navigator.clipboard.writeText`，应改用 `@/utils/domUtils` 的 `copyToClipboard`。
9. **innerHTML XSS 风险** — `index.vue` 第 660 行 `onImageError` 使用 `parent.innerHTML = '...'` 设置 HTML 字符串，存在潜在 XSS 风险。
10. **缺少 composables 抽取** — `index.vue` 约 730 行，包含扫描、压缩、替换、筛选、分页、导航等密集业务逻辑，缺少 composable 拆分。
11. **CompressDialog.vue 样式引用不当** — 第 166 行 `@use '../styles/index.scss'` 直接引用父级 index.scss，应按 SCSS 规范为 CompressDialog 创建独立的 `styles/CompressDialog.scss`。

## 技术方案

### 修复策略

#### 1. Blob URL 内存泄漏修复

- **方案**：在 `ImageInfo` 类型中新增 `_blobUrl?: string` 私有字段追踪 URL；在图片替换/移除/组件卸载时统一调用 `revokeImageUrls()` 工具函数释放所有 blob URL。
- **关键点**：`batchGetImageDetails` 中筛掉的图片已正确 revoke（保持现有逻辑），保留的图片需在 `images.value = []`（重新扫描）和 `images.value = images.value.filter(...)`（替换后移除）时 revoke。

#### 2. SQL 注入修复

- **方案**：对 `imagePath` 和 `image.name` 做 SQL 字符串转义（转义单引号 `'` → `''`，反斜杠 `\` → `\\`），或使用参数化方式。
- **关键点**：思源 `api.sql()` 支持的是原始 SQL 字符串，需要手动转义。提取 `escapeSqlString()` 工具函数。

#### 3. 原生 confirm 替换

- **方案**：新增 i18n 键 `replaceConfirmTitle` / `replaceConfirmMessage`，用项目统一的 `showMessage` + 自定义确认弹窗替代原生 `confirm()`。鉴于项目无通用 confirm 组件，使用 `showMessage` 提示后在 `onReplaceImages` 内通过 Vue 状态控制二次确认流程。

#### 4. 硬编码中文 i18n 化

- **方案**：在 i18n 分片文件中新增缺失键，模板中统一使用 `i18n.xxx`。需要新增的键：
- `scanFilterLabel`、`displayFilterLabel`（SiSelect label）
- `allOption`、`perPageOption`（下拉选项）
- `copyImageName`、`navigateToDoc`、`closePreview`（按钮 title）
- `clickToPreview`（预览提示）
- `copySuccess`、`copyFailed`、`imageNameCopied`（复制提示）
- `replaceConfirmMessage`（替换确认）
- `imageNotFound`、`loadFailed`（错误提示）

#### 5. CSS 修复

- 删除空 CSS 规则 `&:hover img { }`
- 替换 `box-shadow` 为 `border` 表达层级：`.image-viewer` 用 `border: 1px solid var(--b3-border-color)` 替代 shadow；`.image-item:hover` 已使用 border-color，shadow 改为 `border-width` 变化；`.compress-dialog` 的 dialog-base mixin 中 shadow 改为 border。

#### 6. 类型清理

- 删除未使用的 `ImageComparison` 接口。

#### 7. 统一入口修复

- `copyImageName` 改用 `import { copyToClipboard } from "@/utils/domUtils"`。

#### 8. innerHTML 修复

- `onImageError` 改用 DOM API（`createElement` + `appendChild`）替换图片节点，避免 innerHTML 拼接。

#### 9. Composable 抽取

- 新建 `composables/useImageScanner.ts`：封装 `onScanImages`、`images`、`scanning`、`scanProgress` 等扫描相关状态与逻辑。
- 新建 `composables/useImageSelection.ts`：封装 `selectedImages`、`toggleSelect`、`onSelectAll`、`onDeselectAll` 选择逻辑。
- 新建 `composables/useImagePagination.ts`：封装 `currentPage`、`pageSize`、`filteredImages`、`paginatedImages`、`totalPages` 分页逻辑。
- 新建 `composables/useImageCompress.ts`：封装 `compressResults`、`compressing`、`replacing`、`onCompress`、`onCompressConfirm`、`onReplaceImages` 压缩替换逻辑。
- `index.vue` 精简为模板 + 组装 composable 调用，目标行数控制在 ~300 行以内。

#### 10. CompressDialog 样式分离

- 创建 `styles/CompressDialog.scss`，将 CompressDialog.vue 中 `<style>` 块内容迁移过去。
- CompressDialog.vue 改为 `@use "./styles/CompressDialog.scss"`。

### 文件变更汇总

| 文件 | 操作 | 说明 |
| --- | --- | --- |
| `services/scanner.ts` | 修改 | 添加 `revokeImageUrls()` 导出函数；修改 `getImageDetails` 追踪 blobUrl |
| `types/index.ts` | 修改 | `ImageInfo` 新增 `_blobUrl?`；删除 `ImageComparison` |
| `index.vue` | 大幅修改 | i18n 全覆盖、SQL 转义、copyToClipboard、innerHTML 修复、composable 化 |
| `index.ts` | 修改 | 导出中移除 `ImageComparison` |
| `styles/index.scss` | 修改 | 删除空规则、box-shadow→border |
| `components/CompressDialog.vue` | 修改 | 样式引用改为独立 SCSS |
| `i18n/zh_CN/imageCompressor.json` | 修改 | 新增 12+ 个 i18n 键 |
| `i18n/en_US/imageCompressor.json` | 修改 | 新增 12+ 个 i18n 键 |
| `composables/useImageScanner.ts` | 新建 | 扫描逻辑 composable |
| `composables/useImageSelection.ts` | 新建 | 选择逻辑 composable |
| `composables/useImagePagination.ts` | 新建 | 分页逻辑 composable |
| `composables/useImageCompress.ts` | 新建 | 压缩/替换逻辑 composable |
| `styles/CompressDialog.scss` | 新建 | CompressDialog 独立样式 |


### 架构约束

- 所有修改遵循现有项目架构：统一入口 API（`copyToClipboard`）、Codex UI 规范（禁用 box-shadow）、SCSS 分离规范、i18n 分片结构。
- composable 抽取遵循 Vue 3 Composition API 最佳实践，保持与项目其他 feature（如 `flashcardReading`）的 composable 模式一致。
- 不影响注册链路和其他功能模块，修改严格限定在 `src/features/imageCompressor/` 目录内。

## Agent Extensions

### SubAgent

- **code-explorer**
- 用途：在方案执行前深度验证所有受影响文件的依赖关系，确保 composable 抽取后引用路径正确，验证 i18n 键对齐
- 预期结果：完整的文件依赖图和交叉引用清单，确保重构不破坏现有功能

### Skill

- **universal-arch-skill**
- 用途：在代码重构完成后进行架构审查，验证 composable 抽取、样式分离、统一入口规则是否符合项目架构规范
- 预期结果：架构合规性报告，确认所有修改符合 CODEBUDDY.md 中定义的 8 步注册清单、统一入口点、SCSS 分离等强制规则