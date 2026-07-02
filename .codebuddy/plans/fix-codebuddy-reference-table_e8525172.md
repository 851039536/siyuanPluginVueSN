---
name: fix-codebuddy-reference-table
overview: 在 CODEBUDDY.md 底部的「参考文件」章节索引表中补充「强制规则：文件头注释」条目，确保与 CLAUDE_RULES.md 新增的章节对齐。
todos:
  - id: add-reference-entry
    content: 在 CODEBUDDY.md 第 284 行后补充「强制规则：文件头注释」索引表条目
    status: completed
---

## 用户需求

补全 CODEBUDDY.md 底部「参考文件」章节索引表，补充上一轮新增的「强制规则：文件头注释」章节导航条目。

## 当前问题

CLAUDE_RULES.md 已包含完整规则内容，CLAUDE.md 和 CODEBUDDY.md 主体也已有引用，但 CODEBUDDY.md 第 278-285 行的快速导航索引表中遗漏了该条目。

## 目标

在索引表「强制规则：SCSS 分离」行和「构建与验证」行之间插入一行：
`| 强制规则：文件头注释 | .ts/.vue/.scss 文件头注释格式规范 |`

## 改动文件

仅修改 1 个文件，1 行新增。

| 文件 | 行号 | 操作 |
| --- | --- | --- |
| `CODEBUDDY.md` | 第 284 行后 | 新增 1 行索引表条目 |


## 改动内容

在现有 Markdown 表格：

```
| 强制规则：SCSS 分离 | 目录结构模式、正误示例对比 |
| 构建与验证 | 常见 Vite 警告原因与处理方法 |
```

之间插入新行：

```
| 强制规则：文件头注释 | .ts/.vue/.scss 文件头注释格式规范 |
```