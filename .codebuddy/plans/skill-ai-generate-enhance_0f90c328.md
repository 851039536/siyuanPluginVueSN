---
name: skill-ai-generate-enhance
overview: 增强技能学习卡片的 AI 生成功能：润色题目、自动生成代码片段、干扰项长度与答案相近。
todos:
  - id: enhance-ai-prompt
    content: 增强 SkillDialog.vue 的 aiGenerate() 函数：扩展 Prompt 增加 title/codeSnippet 字段 + 干扰项长度约束 + maxTokens 提升至 1000
    status: completed
  - id: update-response-parsing
    content: 增强响应解析：处理 AI 返回的 title 和 codeSnippet 字段，回填到表单
    status: completed
    dependencies:
      - enhance-ai-prompt
  - id: update-tooltip
    content: 更新 AI 按钮 tooltip 文案为"AI 生成全部内容"
    status: completed
---

## 用户需求

增强添加/编辑卡片弹窗的 AI 生成功能，输入题目后点击 ✨ 按钮，AI 一次性完成以下工作：

1. **润色题目**：将用户输入的粗糙题目转化为清晰专业的技术问答题
2. **生成答案**：给出简洁准确的 1-3 句答案
3. **生成代码片段**：提供一个与题目相关的代表性代码示例
4. **生成干扰项**：3 个看似合理但错误的选项，长度与正确答案接近，避免因长度差异被轻易排除

## 核心功能

- 仅修改 `SkillDialog.vue` 中的 `aiGenerate()` 函数，增强 Prompt 和响应解析
- 无需新增 i18n 键、类型定义或样式

## 技术方案

### 修改范围

仅修改 1 个文件：`src/features/skillLearning/components/SkillDialog.vue`

### 变更点

#### 1. 增强 AI Prompt（第 117-126 行）

原 Prompt 仅要求生成 answer + distractors + category + tags。需扩展为：

```
为以下技术题目生成学习卡片内容：
题目：${title}

请输出严格 JSON（不要任何前缀或解释）：
{
  "title": "润色后的题目（更清晰专业，保留原意）",
  "answer": "简洁准确的答案（1-3句话）",
  "codeSnippet": "与题目相关的代表性代码示例（5-15行，语言根据题目推断）",
  "distractors": ["错误但看似合理的选项1", "错误选项2", "错误选项3"],
  "category": "所属分类",
  "tags": ["标签1", "标签2"]
}

关键要求：
- distractors 每条字符串长度必须与 answer 接近（±30%），避免因长度差异被轻易排除
- codeSnippet 用真实可运行的代码，标注语言类型
```

#### 2. 更新 systemPrompt

```
你是编程技能导师，专门为技术学习卡片生成高质量内容。题目润色要专业清晰，答案要简洁准确，代码要真实可运行，干扰项要看似合理且长度与答案匹配。只输出JSON，禁止任何解释。
```

#### 3. 提高 maxTokens

从 `600` → `1000`（新增 title + codeSnippet 字段需要更多输出）

#### 4. 增强响应解析（第 135-145 行后追加）

```typescript
if (parsed.title) form.title = parsed.title
if (parsed.codeSnippet) form.codeSnippet = parsed.codeSnippet
```

#### 5. 更新按钮 tooltip

第 13 行：`'AI 生成答案'` → `'AI 生成全部内容'`

### 架构影响

- 零架构影响：修改完全局限在 `aiGenerate()` 函数内部
- 向后兼容：旧卡片编辑时仍可正常使用，AI 只是辅助填充工具
- 无新增依赖