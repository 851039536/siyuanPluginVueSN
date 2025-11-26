# 目录索引插件 
> 参考项目: [TinkMingKing/siyuan-plugins-index](https://github.com/TinkMingKing/siyuan-plugins-index)

## 功能概述

目录索引插件提供了快速生成和插入各种索引、目录、大纲的功能,帮助用户更好地组织和导航文档内容。

## 功能特性

### 1. 顶部图标操作
- **左键点击**: 快速插入索引(当前文档的子文档列表)
- **右键点击**: 显示完整菜单,选择不同的插入选项

### 2. 快捷键命令

| 快捷键 | 功能 | 说明 |
|--------|------|------|
| `Ctrl + Alt + I` | **插入索引** | 插入当前文档的子文档列表(简洁版) |
| `Ctrl + Alt + O` | **插入子文档及大纲** | 插入子文档列表,每个子文档展开其标题大纲 |
| `Ctrl + Alt + P` | **插入当前文档大纲** | 插入当前文档的所有标题(h1-h6) |
| `Ctrl + Alt + N` | **插入笔记本目录树** | 插入整个笔记本的完整文档树 |

## 详细功能说明

### 功能 1: 插入索引 (Ctrl + Alt + I)

**用途**: 快速列出当前文档的所有子文档  
**插入位置**: 当前光标位置(或文档末尾)

**示例输出**:
```markdown
- [子文档1](siyuan://blocks/20231201123456-abc1234)
- [子文档2](siyuan://blocks/20231201123457-abc1235)
- [子文档3](siyuan://blocks/20231201123458-abc1236)
```

### 功能 2: 插入子文档及大纲 (Ctrl + Alt + O)

**用途**: 列出子文档并展开每个子文档的标题大纲  
**插入位置**: 当前光标位置(或文档末尾)

**示例输出**:
```markdown
## [子文档1](siyuan://blocks/20231201123456-abc1234)

- [一级标题](siyuan://blocks/20231201123457-abc1235)
  - [二级标题](siyuan://blocks/20231201123458-abc1236)
    - [三级标题](siyuan://blocks/20231201123459-abc1237)

## [子文档2](siyuan://blocks/20231201123460-abc1238)

- [标题A](siyuan://blocks/20231201123461-abc1239)
  - [标题B](siyuan://blocks/20231201123462-abc1240)

```

## 使用方法

### 方法一: 使用快捷键(推荐)
1. 将光标定位到想要插入目录的位置
2. 按下对应的快捷键
3. 目录自动插入到光标位置

### 方法二: 使用顶部图标
1. **左键点击**: 直接插入索引(子文档列表)
2. **右键点击**: 打开菜单,选择需要的功能

## 智能插入位置

插入逻辑按以下优先级检测:
1. ✅ 当前选中的块后面
2. ✅ 光标所在的块后面
3. ✅ 文档末尾(兜底方案)

## 技术实现

### 核心API
- `api.sql()`: 使用SQL查询获取文档和块信息
- `api.getBlockByID()`: 获取块的详细信息
- `api.lsNotebooks()`: 获取笔记本列表
- `api.insertBlock()`: 在指定位置插入内容
- `api.appendBlock()`: 在文档末尾插入内容

### 关键SQL查询

**查询子文档**:
```sql
SELECT * FROM blocks 
WHERE parent_id = '{docId}' 
AND type = 'd' 
ORDER BY sort ASC
```

**查询标题大纲**:
```sql
SELECT * FROM blocks 
WHERE root_id = '{docId}' 
AND type = 'h' 
ORDER BY sort ASC
```

**查询笔记本所有文档**:
```sql
SELECT * FROM blocks 
WHERE box = '{notebookId}' 
AND type = 'd' 
ORDER BY hpath ASC
```

## 注意事项

1. ✅ 内容插入到光标位置,更灵活
2. ✅ 所有链接使用 `siyuan://blocks/` 协议,可直接跳转
3. ⚠️ 需要在激活的文档中使用
4. ⚠️ 如果文档没有子文档或标题,会给出提示

## 多语言支持

插件支持中英文双语:
- 中文 (zh_CN)
- 英文 (en_US)

语言会根据思源笔记的界面语言自动切换。

## 与参考项目的对比

本实现参考了 [TinkMingKing/siyuan-plugins-index](https://github.com/TinkMingKing/siyuan-plugins-index) 项目,实现了相同的核心功能:

- ✅ 4个快捷键命令 (Ctrl+Alt+I/O/P/N)
- ✅ 顶部图标左键快速插入
- ✅ 右键菜单显示所有选项
- ✅ 智能光标位置插入
- ✅ 完整的文档树形结构支持

## 开发技术栈

- Vue 3 + Vite
- TypeScript
- 思源笔记 SDK
- SQL 查询引擎
