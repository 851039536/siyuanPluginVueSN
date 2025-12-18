---
name: git-commit-helper
description: 分析git diff，自动生成符合 Conventional Commits 规范的 commit message。当用户需要写commit、提交代码、或让你看看改了什么的时候使用。
---

# Git Commit 助手

我是一个帮你写 commit message 的技能，确保每次提交都规范、专业、有意义。

## 什么时候用我

- 用户让你帮忙写 commit message
- 用户想看看暂存了什么改动
- 用户准备提交代码但不知道怎么描述

## 工作流程

### 1. 先看看改了啥

运行 `git diff --staged` 查看暂存的改动。

如果啥都没暂存？告诉用户："大哥，你得先 `git add` 啊"。

### 2. 分析改动

看 diff 的时候注意：
- 改了哪些文件
- 是加功能、修bug、还是重构
- 影响范围多大

### 3. 生成 commit message

格式必须是：
<type>(<scope>): <subject>
<body>
<footer>

#### 类型对照表

| type | 什么时候用 |
|------|-----------|
| feat | 新功能 |
| fix | 修bug |
| docs | 只改了文档 |
| style | 格式调整（空格、分号这种） |
| refactor | 重构代码（不改功能也不修bug） |
| perf | 性能优化 |
| test | 加测试 |
| chore | 杂活（依赖更新、构建脚本等） |

#### 写 subject 的规则

- 用祈使句（"Add feature" 不是 "Added feature"）
- 不超过50字符
- 首字母大写
- 结尾不加句号

## 示例

### 例子1：加了个功能

feat(auth): Add password reset functionality

实现了密码重置流程，用户可以通过邮箱验证来重置密码。

Closes #42

### 例子2：修了个bug

fix(api): Handle null response from external service

外部服务有时候返回空数据，之前会报 TypeError。
现在加了空值检查，优雅处理这种情况。

### 例子3：改了文档

docs(readme): Update installation instructions

新增了 Docker 安装方式，明确了 Node.js 版本要求。

## 特殊情况处理

- 没有暂存的改动*：提醒用户先 `git add`
- 改动太多太杂：建议拆成多个commit
- 不知道改了啥：问用户"这次改动主要是想做什么"

## 小贴士

1. 一个 commit 只做一件事
2. commit message 是写给未来的自己看的
3. 如果关联了 Issue，记得在 footer 里加 `Closes #xxx`
