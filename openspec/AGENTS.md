# OpenSpec AI 助手指南

本指南适用于使用 OpenSpec 工作流程在 SN思源插件合集 项目上工作的 AI 助手。

## 何时使用 OpenSpec

在以下情况下始终使用 OpenSpec 工作流程：
- 规划新功能或重大变更
- 实施破坏性变更
- 架构修改
- 影响多个系统的性能优化
- 安全增强
- 需要澄清的模糊需求

## OpenSpec 工作流程概述

### 1. 规划阶段（提案）
使用 `/openspec:proposal` 创建新变更：

1. **研究阶段**
   - 阅读 `openspec/project.md` 了解项目背景
   - 运行 `openspec list` 和 `openspec list --specs` 了解现有变更
   - 使用搜索工具探索相关代码
   - 识别任何空白或不明确的需求

2. **创建变更提案**
   - 选择一个唯一的动词引导的 `change-id`（例如：`add-ai-summaries`、`enhance-image-compression`）
   - 在 `openspec/changes/<id>/` 下搭建文件：
     - `proposal.md` - 主要提案文档
     - `tasks.md` - 实现任务列表
     - `design.md` - 架构决策（需要时）
   - 在 `changes/<id>/specs/<capability>/spec.md` 创建规范变更

3. **规范格式**
   使用以下标题编写需求：
   ```markdown
   ## 新增需求
   #### 需求：[清晰的需求描述]
   ##### 场景：[具体的用户场景]

   ## 修改需求
   ## 删除需求
   ```

4. **验证**
   - 运行 `openspec validate <id> --strict`
   - 在继续之前修复所有验证错误
   - 确保场景是可测试的和具体的

### 2. 审查阶段
- 与用户共享提案以供审查
- 处理任何反馈或问题
- 修改提案直到获得批准
- 此阶段不进行代码实现！

### 3. 实现阶段（应用）
批准后，使用 `/openspec:apply` 实施：
1. 检出 `openspec/<id>` 分支
2. 按顺序实施 `tasks.md` 中的任务
3. 更新相关规范
4. 根据场景测试每个实现
5. 使用描述性消息提交更改

### 4. 归档阶段
成功实施后：
1. 使用 `/openspec:archive` 归档变更
2. 更新项目文档
3. 清理临时文件

## 项目特定指南

### 功能开发
- 所有新功能必须在 `src/features/` 中模块化
- 始终在 `SuperPanelView.vue` 中添加开关
- 在 `superPanel/index.ts` 中映射功能
- 遵循已建立的功能模式

### AI 功能
- 使用集中的 AI 配置
- 支持多个供应商（OpenAI、Claude、本地模型）
- 实施适当的错误处理和重试逻辑
- 使用思源的存储安全保存 API 密钥

### UI/UX 一致性
- 使用 Vue 3 Composition API
- 遵循现有组件模式
- 保持响应式设计
- 包含适当的国际化

### 代码质量
- TypeScript 严格模式
- ESLint 合规性
- 没有适当类型就不实现
- 编写清晰、有文档的代码

## 常用 OpenSpec 命令

```bash
# 列出所有变更
openspec list

# 列出规范
openspec list --specs

# 创建提案（交互式）
/openspec:proposal

# 验证提案
openspec validate <change-id> --strict

# 显示变更详情
openspec show <change-id>
openspec show <spec> --type spec

# 应用已批准的变更
/openspec:apply <change-id>

# 归档完成的变更
/openspec:archive <change-id>

# 更新项目文档
openspec update
```

## 最佳实践

### 创建提案之前
1. 彻底了解现有代码库
2. 检查是否已存在类似功能
3. 考虑边界情况和错误场景
4. 从一开始就规划国际化

### 编写好的需求
- 使用主动语态和清晰的语言
- 包含具体的用户场景
- 定义成功标准
- 考虑正常路径和边界情况

### 任务分解
- 保持任务小且可验证
- 按逻辑顺序排列依赖项
- 包含验证/测试任务
- 突出可并行的工作

### 架构决策
- 在 `design.md` 中记录权衡
- 参考现有模式
- 考虑性能影响
- 规划未来的可扩展性

## 资源

- 项目背景：`openspec/project.md`
- 现有规范：`openspec/specs/`
- 变更历史：`openspec/changes/`
- 思源 API：[思源文档](https://siyuan.io/docs)