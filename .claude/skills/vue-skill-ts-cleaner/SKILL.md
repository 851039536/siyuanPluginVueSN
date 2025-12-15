---
name: vue-skill-ts-cleaner
description: 检查并优化 Vue 3 <script setup lang="ts"> 组件中的 TypeScript 代码，移除冗余与未使用代码，确保逻辑清晰且功能不受影响。
---

本 Skill 专注于 Vue 3 的 `<script setup lang="ts">` 组件代码，提供以下能力：

- ✅ **结构检查**：验证组件是否遵循最佳实践（如响应式变量声明、props 类型定义等）
- 🧹 **冗余清理**：识别并标记未使用的变量、导入、函数或计算属性
- 🔍 **安全优化**：在不改变功能的前提下提出可安全移除或简化的代码建议
- ✅ **人工确认**：所有修改建议需用户确认后执行，避免误删关键逻辑

> 💡 所有分析基于静态代码扫描，不运行代码，确保安全性。

## 工作流程

- [x] [检查代码结构与逻辑](./workflows/check_code_structure.yaml)
- [x] [检测未使用代码](./workflows/detect_unused_code.yaml)
- [x] [确认优化方案](./workflows/confirm_optimization_plan.yaml)
