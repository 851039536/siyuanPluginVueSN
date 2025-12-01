# 思源笔记 Markdown 兼容性处理

## 问题描述

AI 生成的 Markdown 内容在复制到思源笔记或直接插入文档时，某些格式可能显示不正确，特别是：

1. **粗体文本** (`**文本**`) - 可能显示为原始 Markdown 语法而不是粗体
2. **标题** - 标题前后可能需要空行
3. **代码块** - 代码块前后可能需要空行
4. **列表** - 列表项的间距可能不正确

## 根本原因

思源笔记使用自己的块级编辑器，对 Markdown 的解析和渲染有特定要求：

- 思源会将 Markdown 转换为内部的块结构
- 某些 Markdown 语法需要特定的上下文（如空行）才能正确解析
- 思源对行内格式（如粗体、斜体）的处理可能与标准 Markdown 解析器不同

## 解决方案

### 1. Markdown 格式转换函数

添加了 `convertToSiyuanMarkdown()` 函数，用于将标准 Markdown 转换为思源兼容格式：

```javascript
const convertToSiyuanMarkdown = (content: string): string => {
  let converted = content;
  
  // 1. 确保标题前后有空行
  converted = converted.replace(/([^\n])\n(#{1,6}\s)/g, '$1\n\n$2');
  converted = converted.replace(/(#{1,6}\s[^\n]+)\n([^\n#])/g, '$1\n\n$2');
  
  // 2. 确保代码块前后有空行
  converted = converted.replace(/([^\n])\n```/g, '$1\n\n```');
  converted = converted.replace(/```\n([^\n])/g, '```\n\n$1');
  
  return converted;
};
```

### 2. 应用场景

该转换函数在以下场景中自动应用：

1. **复制内容** - `copyContent()` 函数
2. **插入到文档** - `insertContentToDocument()` 函数
3. **应用编辑** - `applyEdit()` 函数

### 3. 转换规则

#### 规则 1：标题前后空行
```markdown
# 错误示例
这是一段文字
## 标题
内容开始

# 正确示例
这是一段文字

## 标题

内容开始
```

#### 规则 2：代码块前后空行
```markdown
# 错误示例
这是一段文字
```javascript
code here
```
继续文字

# 正确示例
这是一段文字

```javascript
code here
```

继续文字
```

#### 规则 3：粗体格式
思源笔记支持 `**粗体**` 语法，但需要注意：
- 粗体标记前后最好有空格或标点
- 避免在中文字符中间直接使用粗体标记

## 测试建议

### 测试用例 1：标题和段落
```markdown
# 主标题

这是第一段内容。

## 二级标题

这是第二段内容。
```

### 测试用例 2：粗体文本
```markdown
这是一段包含 **粗体文本** 的内容。

**重要提示**：请注意这个问题。
```

### 测试用例 3：代码块
```markdown
以下是代码示例：

```javascript
function hello() {
  console.log("Hello World");
}
```

代码说明在这里。
```

### 测试用例 4：列表
```markdown
## 功能列表

- 第一项功能
- 第二项功能
  - 子项 1
  - 子项 2
- 第三项功能

## 有序列表

1. 第一步
2. 第二步
3. 第三步
```

## 已知限制

1. **复杂嵌套结构** - 对于复杂的嵌套列表或表格，可能需要手动调整
2. **特殊字符** - 某些特殊字符可能需要转义
3. **自定义块** - 思源的自定义块语法（如 `{{< ... >}}`）不在转换范围内

## 进一步优化建议

如果仍然遇到格式问题，可以考虑：

1. **使用 DOM 模式** - 将 `updateBlock` 的 `dataType` 从 `'markdown'` 改为 `'dom'`
2. **预处理 AI 输出** - 在系统提示词中明确要求 AI 输出符合思源格式的 Markdown
3. **后处理增强** - 添加更多的格式转换规则

## 相关代码位置

- 转换函数：`AIContentGeneratorPanel.vue` - `convertToSiyuanMarkdown()`
- 复制功能：`AIContentGeneratorPanel.vue` - `copyContent()`
- 插入功能：`AIContentGeneratorPanel.vue` - `insertContentToDocument()`
- 应用编辑：`AIContentGeneratorPanel.vue` - `applyEdit()`

## 参考资源

- [思源笔记 API 文档](https://github.com/siyuan-note/siyuan/blob/master/API.md)
- [思源笔记 Markdown 语法说明](https://github.com/siyuan-note/siyuan/blob/master/guide/markdown.md)
