---
name: bottominputarea-review-refactor
overview: 对 BottomInputArea.vue（1001行）进行合规审查与重构，将其降至 500 行硬阈值以内：SCSS 分离、SkillPreviewModal 组件提取、Props 接口前置、添加文件头注释。
todos:
  - id: notice
    content: 本次重构包含6个步骤：提取SkillPreviewModal.vue + SkillSection.vue 两个子组件、全量SCSS分离为3个独立文件、修复Props定义顺序、添加文件头注释、SCSS Token化。请确认后开始执行。
    status: completed
---

## 用户需求

审查并重构 `src/features/aiContentGenerator/components/BottomInputArea.vue`（1001行），按 AGENTS.md 规范进行彻底的代码质量审查与架构重构。

## 核心问题清单

| 严重级 | 问题 | 说明 |
| --- | --- | --- |
| P0 | 1001行远超500行硬阈值 | CODEBUDDY.md 规定 >=1000行必须重构 |
| P0 | 缺少文件头注释 | AGENTS.md 强制要求每个 .vue 文件顶部有功能说明注释 |
| P1 | 329行内联SCSS未分离 | 违反 "样式必须从.vue文件中提取出来" 规则 |
| P1 | Props接口定义在调用之后 | defineProps&lt;Props&gt;() 在502行，interface Props 在559行 |
| P2 | SkillPreviewModal 自包含但内联 | Teleport弹窗模板42行+script 7行+SCSS 112行 |
| P2 | 技能选择器自包含但内联 | 触发按钮+下拉面板+搜索+clickOutside共235行 |
| P2 | 大量硬编码CSS值 | font-size/font-weight/border-radius/gap/padding 未使用Token |


## 目标

提取后 BottomInputArea.vue 降至 500 行以内，子组件独立、SCSS分离、Token化。

## 技术方案

### 提取策略

将 BottomInputArea.vue 拆分为 3 层：

```
BottomInputArea.vue（~474行）  ← 主组件：组装层
├── SkillSection.vue（~200行） ← 技能选择器组件
├── SkillPreviewModal.vue（~165行） ← 技能预览弹窗
├── styles/BottomInputArea.scss（~126行）
├── styles/SkillSection.scss（~84行）
└── styles/SkillPreviewModal.scss（~112行）
```

### 行数变化

| 文件 | 操作 | 行数 |
| --- | --- | --- |
| BottomInputArea.vue | 重写 | 1001 → ~474 |
| SkillSection.vue | 新建 | ~200 |
| SkillPreviewModal.vue | 新建 | ~165 |
| styles/BottomInputArea.scss | 新建 | ~126 |
| styles/SkillSection.scss | 新建 | ~84 |
| styles/SkillPreviewModal.scss | 新建 | ~112 |


### 数据流

```
BottomInputArea.vue
  ├── emit('update:currentSkillIndex', n)  ← SkillSection
  │     └── 父组件 currentSkillIndex 响应式更新
  ├── emit('update:skillSearchQuery', q)   ← SkillSection  
  │     └── 父组件 skillSearchQuery 响应式更新
  └── SkillSection emit('show-preview')    → BottomInputArea 打开 SkillPreviewModal
  └── SkillPreviewModal emit('close')      → BottomInputArea 关闭
```

### 关键设计决策

1. **SkillPreviewModal 使用 Teleport to="body"**：保持原有行为，弹窗挂载到 body
2. **clickOutside 逻辑保留在 SkillSection**：使用 document.addEventListener 监听点击
3. **SCSS Token 化**：使用 `$font-size-2xs`/`$font-size-xs`/`$font-size-sm`/`$font-size-base`、`$font-weight-medium`/`$font-weight-semibold`、`$spacing-1`~`$spacing-4`、`$radius-sm`/`$radius-md` 等全局Token
4. **box-shadow 检查**：`.skill-preview-modal`(line 883) 的 box-shadow 保留（弹窗场景允许），其余全部用 border 替代

### 实现细节

- 所有新文件添加文件头注释
- Props 接口移到 defineProps 之前
- `defineEmits` 使用 TypeScript 泛型语法（保持现有模式）
- 导入 `getSourceDotColors`/`getSourceHintText`/`renderMarkdown` 从 utils（复用已有工具函数）
- 弹窗关闭按钮使用 Iconify `iconClose`（已注册图标），inline SVG 用户 `use xlink:href`