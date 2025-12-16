# 📑 目录索引插件 (Table of Contents)

[![版本](https://img.shields.io/badge/版本-1.0.1-blue.svg)](../../package.json)
[![兼容性](https://img.shields.io/badge/思源笔记-≥1.1.0-green.svg)](https://github.com/siyuan-note/siyuan)
[![许可证](https://img.shields.io/badge/许可证-MIT-yellow.svg)](../../LICENSE)

> 参考项目：[TinkMingKing/siyuan-plugins-index](https://github.com/TinkMingKing/siyuan-plugins-index)

## 🎯 功能概述

目录索引插件提供了快速生成和插入各种索引、目录、大纲的功能，帮助用户更好地组织和导航文档内容。通过智能的光标位置检测和自动插入机制，让文档结构化管理变得简单高效。

## 📋 目录

- [功能概述](#-功能概述)
- [功能特性](#-功能特性)
- [详细功能说明](#-详细功能说明)
- [快速开始](#-快速开始)
- [智能插入机制](#-智能插入机制)
- [技术实现](#-技术实现)
- [注意事项](#-注意事项)
- [多语言支持](#-多语言支持)
- [开发技术栈](#-开发技术栈)

## ✨ 功能特性

### 🚀 核心功能
- ✅ **智能插入位置**：自动检测光标位置，支持选中块后插入
- ✅ **增量更新机制**：自动识别已有索引，避免重复插入
- ✅ **多层级文档支持**：支持无限层级的文档结构
- ✅ **实时内容同步**：内容变化时自动更新索引
- ✅ **多语言支持**：中英文界面自动切换

### ⌨️ 快捷键操作

| 快捷键 | 功能 | 描述 |
|--------|------|------|
| `Ctrl + Alt + I` | **插入索引** | 生成子文档列表（编号列表格式） |
| `Ctrl + Alt + O` | **插入子文档及大纲** | 生成子文档及其标题层级结构 |
| `Ctrl + Alt + R` | **插入子文档引用** | 生成子文档引用块列表 |
## 📖 详细功能说明

### 1️⃣ 插入索引 (Ctrl + Alt + I)

**功能描述**：快速生成当前文档的直接子文档列表，采用编号格式

**输出格式示例**：
```markdown
## 📑 子文档索引

01. [文档标题1](siyuan://blocks/20231201123456-abc1234)
02. [文档标题2](siyuan://blocks/20231201123457-abc1235)
03. [文档标题3](siyuan://blocks/20231201123458-abc1236)
```

**特点**：
- 🎯 专注显示直接子文档（一级层级）
- 🔢 自动编号（01, 02, 03...）
- 🔗 使用 `siyuan://blocks/` 协议支持直接跳转
- 📝 自动去除HTML标签，提取纯文本

---

### 2️⃣ 插入子文档引用 (Ctrl + Alt + R)

**功能描述**：生成子文档引用块列表，使用思源笔记的引用语法

**输出格式示例**：
```markdown
## 🔗 子文档引用

01. ((20231201123456-abc1234 "文档标题1"))
02. ((20231201123457-abc1235 "文档标题2"))
03. ((20231201123458-abc1236 "文档标题3"))
```

**特点**：
- 🔗 使用 `((blockID "锚文本"))` 引用块语法
- 📋 轻量级显示，适合密集展示
- 🎨 支持图标美化（📄 前缀）

---

### 3️⃣ 插入子文档及大纲 (Ctrl + Alt + O)

**功能描述**：生成完整的子文档结构，包含每个子文档的标题层级

**输出格式示例**：
```markdown
## 📋 子文档大纲

### 📄 ((20231201123456-abc1234 "文档标题1"))

- ((20231201123457-abc1235 "一级标题1"))
  - ((20231201123458-abc1236 "二级标题1"))
    - ((20231201123459-abc1237 "三级标题1"))

### 📄 ((20231201123460-abc1238 "文档标题2"))

- ((20231201123461-abc1239 "标题A"))
  - ((20231201123462-abc1240 "标题B"))
```

**特点**：
- 🏗️ 完整展示文档层级结构
- 📊 支持多级标题（H1-H6）
- 🔗 使用引用块保持链接完整性
- 🎨 图标美化增强可读性

## 🚀 快速开始

### 安装插件
1. 将插件放置在思源笔记的 `data/plugins/` 目录下
2. 重启思源笔记或在"设置" → "导出"中重新加载插件

### 基本使用
1. 在任意文档中定位光标
2. 使用快捷键快速生成索引：
   - `Ctrl + Alt + I` - 插入文档索引
   - `Ctrl + Alt + R` - 插入文档引用
   - `Ctrl + Alt + O` - 插入文档大纲
3. 插件会自动在光标位置插入相应内容

> 💡 **提示**：插件支持增量更新，多次使用会智能更新而非重复插入

## 🚀 使用方法

### 方式一：快捷键操作（推荐）

1. **定位光标**：将光标放置在文档中任意位置
2. **执行命令**：按下对应的快捷键组合
3. **自动插入**：内容自动插入到光标位置

> 💡 **提示**：如果选中了文本块，优先在选中块后插入

### 方式二：顶部图标（暂未实现）

> 📝 **注意**：当前版本暂未实现顶部图标功能，仅支持快捷键操作

---

## 🎯 智能插入机制

### 插入位置优先级

插件采用多层级智能检测，确保内容插入到最合适的位置：

| 优先级 | 检测方式 | 说明 |
|--------|----------|------|
| 🥇 **1** | 当前选中的块 | 优先在用户选中的块后面插入 |
| 🥈 **2** | 光标所在的块 | 精确检测光标所在的块 |
| 🥉 **3** | 激活窗口文档 | 使用当前激活的编辑器窗口 |

### 增量更新机制

插件具备智能更新能力：

1. **自动检测**：扫描文档中是否存在相同类型的索引
2. **内容比较**：规范化内容后进行精确对比
3. **增量更新**：仅在内容变化时更新，避免冗余操作
4. **属性标记**：使用自定义属性 `custom-toc-type` 和 `custom-toc-generated` 标识生成的索引

> ⚠️ **重要**：同一文档中每种类型的索引仅保留一份，多次插入会更新而非创建新索引

## 🔧 技术实现

### 核心API调用

插件使用以下思源笔记API：

| API方法 | 用途 | 说明 |
|---------|------|------|
| `api.sql()` | SQL查询 | 查询文档和块信息 |
| `api.getBlockByID()` | 获取块信息 | 通过ID获取块的详细信息 |
| `api.insertBlock()` | 插入块 | 在指定位置插入新内容 |
| `api.updateBlock()` | 更新块 | 更新现有块的内容 |
| `api.setBlockAttrs()` | 设置属性 | 为块添加自定义属性 |
| `api.getBlockKramdown()` | 获取Markdown | 获取块的Markdown源码 |

### 关键SQL查询策略

#### 1️⃣ 查询直接子文档

```sql
SELECT
    id,
    content,
    hpath
FROM blocks
WHERE box = '{notebookId}'
    AND type = 'd'
    AND hpath LIKE '{currentDocPath}/%'
    AND hpath NOT LIKE '{currentDocPath}/%/%'
ORDER BY hpath ASC;
```

**特点**：
- 🎯 使用 `hpath`（人类可读路径）进行精确查询
- 📊 支持无限层级文档结构
- ⚡ 高效的路径匹配算法

#### 2️⃣ 查询文档标题

```sql
SELECT
    id,
    content,
    type,
    sort
FROM blocks
WHERE root_id = '{docId}'
    AND type = 'h'
ORDER BY sort ASC;
```

**特点**：
- 🏗️ 按 `sort` 字段保持原始顺序
- 📝 支持所有标题级别（H1-H6）
- 🔄 自动处理标题层级关系

#### 3️⃣ 查找已存在索引

```sql
SELECT DISTINCT
    b.id,
    b.type
FROM blocks b
JOIN attributes a1
    ON b.id = a1.block_id
    AND a1.name = 'custom-toc-type'
    AND a1.value = '{indexType}'
JOIN attributes a2
    ON b.id = a2.block_id
    AND a2.name = 'custom-toc-generated'
    AND a2.value = 'true'
WHERE b.root_id = '{docId}'
ORDER BY b.sort ASC
LIMIT 1;
```

**特点**：
- 🚀 高性能JOIN查询，避免循环API调用
- 🎨 使用自定义属性实现快速检索
- ✅ 确保每种类型索引的唯一性

### 核心技术特性

#### 🔒 SQL注入防护

```typescript
/**
 * 转义SQL字符串，防止注入攻击
 * @param str - 待转义的字符串
 * @returns 转义后的字符串
 */
function escapeSqlString(str: string): string {
    if (!str) return '';
    // 转义单引号，防止SQL注入
    return str.replace(/'/g, "''");
}
```

#### 🎯 智能光标检测

支持三种光标位置检测方式：
1. **选中块检测**：`.protyle-wysiwyg--select`
2. **聚焦块检测**：`.protyle-wysiwyg--focus`
3. **精确位置检测**：`window.getSelection()` API

#### 📊 内容规范化比较

```typescript
/**
 * 规范化Markdown内容，用于精确比较
 * @param existingMarkdown - 现有内容
 * @param content - 新内容
 * @returns 比较结果
 */
function normalizeContent(existingMarkdown: string, content: string): boolean {
    // 统一换行符，去除首尾空白
    const normalizedExisting = existingMarkdown.replace(/\r\n/g, '\n').trim();
    const normalizedNew = content.replace(/\r\n/g, '\n').trim();

    // 返回是否相等
    return normalizedExisting === normalizedNew;
}
```

确保内容比较的准确性，避免不必要的更新操作。

## ⚠️ 注意事项

### ✅ 支持的功能
- ✅ **智能插入**：内容插入到光标位置，更加灵活便捷
- ✅ **直接跳转**：所有链接使用 `siyuan://blocks/` 协议，支持直接跳转
- ✅ **增量更新**：自动检测并更新已有索引，避免重复插入

### ⚠️ 使用限制
- ⚠️ **文档激活**：需要在激活的文档编辑器中使用
- ⚠️ **内容要求**：如果文档没有子文档或标题，插件会显示友好提示

## 🌍 多语言支持

| 语言 | 代码 | 状态 |
|------|------|------|
| 🇨🇳 中文 | `zh_CN` | ✅ 完全支持 |
| 🇺🇸 英文 | `en_US` | ✅ 完全支持 |

### 语言切换
插件会根据思源笔记的界面语言设置**自动切换**显示语言，无需手动配置。

### 翻译覆盖范围
- ✅ 所有界面文本
- ✅ 错误提示信息
- ✅ 快捷键说明

## 🔄 与参考项目的对比

本实现参考了 [TinkMingKing/siyuan-plugins-index](https://github.com/TinkMingKing/siyuan-plugins-index) 项目，实现了相同的核心功能：

| 功能特性 | 参考项目 | 本实现 | 说明 |
|---------|---------|--------|------|
| 快捷键命令 | ✅ 4个 | ✅ 3个 | 专注核心功能，精简快捷键 |
| 顶部图标 | ✅ 支持 | ❌ 暂未实现 | 当前版本仅支持快捷键 |
| 右键菜单 | ✅ 支持 | ❌ 暂未实现 | 未来版本计划添加 |
| 智能插入 | ✅ 支持 | ✅ 支持 | 光标位置自动检测 |
| 文档树形结构 | ✅ 支持 | ✅ 支持 | 完整的层级结构支持 |

### 改进点
- 🚀 **更精准的SQL查询**：使用 JOIN 查询提高性能
- 🔒 **增强安全防护**：增加SQL注入防护机制
- 🎯 **智能增量更新**：避免重复插入，提高用户体验

## 🛠️ 开发技术栈

| 技术领域 | 技术选择 | 版本 | 用途 |
|---------|---------|------|------|
| **前端框架** | Vue.js | 3.3.8 | 用户界面构建 |
| **构建工具** | Vite | 6.2.1 | 快速开发和构建 |
| **类型支持** | TypeScript | 5.0.4 | 类型安全和开发体验 |
| **思源SDK** | Siyuan SDK | 1.1.0 | 插件API集成 |
| **数据库** | SQLite | - | 思源笔记数据存储 |
| **代码质量** | ESLint | - | 代码规范检查 |

### 核心技术
- **SQL查询优化**：高效的数据库查询策略
- **智能内容检测**：多层级光标位置识别
- **增量更新机制**：避免重复插入的智能算法

## 📝 许可证

本项目基于 [MIT 许可证](../../LICENSE) 开源。

## 🤝 贡献

欢迎提交 Issue 和 Pull Request 来帮助改进这个插件！

### 贡献方式
1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 开发指南
- 遵循项目的 ESLint 代码规范
- 确保新增功能有对应的文档说明
- 提交前请测试所有功能正常工作

## 🙏 致谢

感谢以下项目和资源：
- [TinkMingKing/siyuan-plugins-index](https://github.com/TinkMingKing/siyuan-plugins-index) - 原始实现参考
- [思源笔记](https://b3log.org/siyuan/) - 强大的笔记应用
- [Vue.js](https://vuejs.org/) - 优雅的前端框架
