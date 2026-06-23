---
name: skills-modal-review-fixes
overview: 修复 SkillsModal.vue 审查中发现的 13 个问题（Critical→Minor），并对照 Codex 风格（vp-* 类命名体系）重构 UI 样式。
todos:
  - id: fix-storage-ref
    content: 将 storage 从 computed 改为 ref，在 onMounted 中初始化一次 FloatingBoxStorage 实例
    status: completed
  - id: fix-plugin-type
    content: 将 props.plugin 类型从 any 修正为 Plugin（import type { Plugin } from "siyuan"）
    status: completed
  - id: replace-alert-confirm
    content: 将 7 处 alert()/confirm() 替换为 showMessage(msg, duration, type) from siyuan
    status: completed
  - id: precompute-categories
    content: 在 computed 中预缓存每个 skill 的 category 对象，消除模板中每卡片 3 次 getCategoryById 调用
    status: completed
  - id: vfor-content-slots
    content: 用 v-for 遍历 contentSlots 数组消除 content/content2/content3 三块重复模板
    status: completed
  - id: fix-search-and-keyboard
    content: 扩展搜索范围至 content2/content3，添加 Modal Escape 键关闭，为 role=button 的 div 添加 Enter/Space 键盘处理
    status: completed
  - id: add-loading-state
    content: 添加 loading 状态（ref
    status: completed
---

## 用户需求

重构 `SkillsModal.vue`，修复审查发现的 11 项问题，并将 UI 对齐 Codex (vp-*) 样式体系。

## 产品概述

技能库弹窗（SkillsModal）是思源笔记插件悬浮框功能的核心子组件，用户通过它浏览、搜索、新增、编辑、删除技能条目，并支持分类管理。本次重构聚焦于代码质量、性能和安全性的全面修复。

## 核心修复

### 类型安全

- 将 `props.plugin` 类型从 `any` 修正为 `Plugin`（遵守 CLAUDE.md 规则）

### 性能优化

- `storage` 从 computed 改为 ref，避免每次访问创建新实例
- `getCategoryById` 调用从模板中每卡片 3 次改为在 computed 中预缓存

### 用户体验

- 7 处原生 `alert()/confirm()` 替换为 `showMessage()` from siyuan
- 搜索扩展至 content2/content3 字段
- 添加 Escape 键关闭 Modal
- content 复制区添加键盘 Enter/Space 触发
- 添加 loading 状态视觉反馈

### 代码质量

- content/content2/content3 三块重复模板用 v-for 消除
- 移除多余 `@keydown.enter.prevent`
- 清理空 CSS 规则 `.trigger-icon {}`

### Codex 样式对齐

- SCSS 类名从 `skills-modal-*` / `skill-*` 迁移到 `vp-modal` / `vp-card` 体系
- 等宽字体用于代码内容、大写标签模式、边框卡片、标准焦点发光、按钮体系对齐

## 技术栈

- Vue 3 (Composition API + `<script setup lang="ts">`)
- TypeScript
- SCSS (scoped, `@use "@/variables" as *`)
- `showMessage` from `siyuan` package（项目标准通知 API）
- `Plugin` type from `siyuan`
- `FloatingBoxStorage` from `../types/storage`

## 实现方案

### 总体策略

一次提交覆盖所有问题：模板层（v-for 消除重复 +键盘处理 + Escape 事件）、脚本层（类型修正 + storage 重构 + alert→showMessage + 预缓存 computed）、样式层（skills- *→ vp-* 迁移 + 空规则清理 + Codex 焦点发光）。

### 关键决策

1. **storage 改为 ref 而非 computed**：`FloatingBoxStorage` 实例只需创建一次，用 `ref<FloatingBoxStorage | null>(null)` 在 `onMounted` 中赋值，避免每次 `storage.value` 都 new 新实例。
2. **category 预缓存**：在 `filteredSkills` 中扩展返回增强对象 `{ skill, category }`，模板中直接使用预计算好的 categoryName/color，消除 3 次查找。
3. **content 列表化**：定义 computed `contentSlots = ['content', 'content2', 'content3']`，模板用 `v-for="slotName in contentSlots"` 遍历，仅在 skill[slotName] 存在时渲染。
4. **showMessage 替换 alert/confirm**：`showMessage(msg, 2000, 'error'|'info')` 替代所有 alert；删除确认用 `showMessage` + 直接在回调中执行删除（保留确认用 confirm 但降为需二次确认的才用；实际审查发现 deleteSkill/deleteCategory 用 confirm 的场景改为直接删除 + showMessage 提示）。
5. **vp-* 样式对齐**：SCSS 重命名为 `vp-` 前缀体系，focus 用 `box-shadow: 0 0 0 2px var(--b3-theme-primary-lightest)`，代码内容用 `$vp-mono` 字体。

### 性能分析

- storage 重构：O(1) 初始化 → O(1) 访问（原为每次 O(1)+new）
- category 预缓存：每卡片从 3 次 `Array.find` 降至 1 次预计算
- 模板 v-for 消除重复：构建产物体积略微减小
- 搜索扩展至 5 字段（原 3 字段）：filter 增加 O(2n) 字符串匹配，可忽略

## 实施细节

### 存储初始化

```typescript
// 旧（每次访问都 new）
const storage = computed(() => new FloatingBoxStorage(props.plugin))
// 新（onMounted 初始化一次）
const storage = ref<FloatingBoxStorage | null>(null)
onMounted(async () => {
  storage.value = new FloatingBoxStorage(props.plugin)
  // ... load data
})
```

### showMessage 替换映射

| 原代码 | 新代码 |
| --- | --- |
| `alert("标题和内容是必填项")` | `showMessage("标题和内容是必填项", 2000, "error")` |
| `alert("保存失败，请重试")` | `showMessage("保存失败，请重试", 2000, "error")` |
| `alert("分类名称不能为空")` | `showMessage("分类名称不能为空", 2000, "error")` |
| `alert("无法删除：该分类下还有技能")` | `showMessage("无法删除：该分类下还有技能", 3000, "error")` |
| `confirm("确定要删除这个分类吗？")` | `showMessage("分类已删除", 2000, "info")` 直接删除 |
| `confirm("确定要删除这个技能吗？")` | `showMessage("技能已删除", 2000, "info")` 直接删除 |
| `alert("复制失败，请手动复制")` | `showMessage("复制失败，请手动复制", 2000, "error")` |


### Codex 样式焦点发光

```
// 旧
&:focus { box-shadow: 0 0 0 3px rgba(217, 119, 87, 0.1); }
// 新（对齐 vp-input 规范）
&:focus { box-shadow: 0 0 0 2px var(--b3-theme-primary-lightest); }
```

### 模块划分

单文件重构，不拆分新模块。变更集中在：

- **模板层**（~220行→~180行）：v-for 消除重复 + Escape 绑定 + 键盘事件
- **脚本层**（~280行→~270行）：类型修正 + storage ref + showMessage + 预缓存 computed + loading 状态
- **样式层**（SCSS ~460行→~440行）：skills- *→ vp-* 迁移 + 空规则删除 + focus 对齐
