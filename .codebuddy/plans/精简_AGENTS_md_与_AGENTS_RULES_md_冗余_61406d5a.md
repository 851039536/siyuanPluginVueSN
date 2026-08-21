---
name: 精简 AGENTS.md 与 AGENTS_RULES.md 冗余
overview: 在不改变任何规则语义的前提下，精简 AGENTS.md 与 AGENTS_RULES.md 两份规范文档的冗余重复内容：删除跨章节/跨文件的完全重复段落，将 AGENTS.md「硬规则」列表中与 AGENTS_RULES.md 详细章节几乎逐字重复的超长条目下沉为「一句话 + 链接」，并清理对已删除 CODEBUDDY.md 的 3 处过时引用。
todos:
  - id: dedupe-rules-md
    content: 在 AGENTS_RULES.md 内去重：合并 i18n 分片规则两处、收敛 AI build/lint 说明、清理两处 CODEBUDDY.md 引用
    status: completed
  - id: dedupe-agents-md
    content: 在 AGENTS.md 内精简：硬规则七条长条目下沉为链接、删除失效的规则文件同步条、去重 emoji 图标与构建验证
    status: completed
  - id: verify-consistency
    content: 交叉校验两份文件语义等价、锚点链接有效、无 CODEBUDDY.md 残留引用
    status: completed
    dependencies:
      - dedupe-rules-md
      - dedupe-agents-md
---

## 用户需求

审查 `AGENTS.md` 与 `AGENTS_RULES.md` 两份项目规则文档的冗余重复，在**不改变任何规则实际约束语义**的前提下减少冗余，使文档更简洁、维护成本更低。

## 精简范围（用户已确认）

1. **精简力度 = 激进**：除删除「完全重复」的段落/句子外，将 `AGENTS.md`「硬规则」列表中与 `AGENTS_RULES.md` 详细章节几乎逐字重复的超长条目，精简为「一句话规则 + 链接」。
2. **清理过时引用 = 是**：删除/改写对已不存在的 `CODEBUDDY.md` 的引用，并删除「AGENTS.md 与 CODEBUDDY.md 必须一致」这条已失效规则。

## 核心内容

- 删除完全重复内容：i18n「只改分片文件」两处合并、「AI 不得执行 build/lint」三处收敛、「禁止 emoji 图标」重复、「构建与验证」跨文件重复。
- `AGENTS.md` 硬规则列表中 7 条超长条目下沉为「一句话 + 链接」，细节保留在 `AGENTS_RULES.md` 详细章节。
- 清理 `CODEBUDDY.md` 过时引用（3 处）及失效的「规则文件同步」规则。

## 约束（必须遵守）

- 保持「AGENTS.md 摘要 / AGENTS_RULES.md 详细」的分层设计不动，不合并合理分层。
- 所有规则语义零改动，仅删重复表述与过时引用。
- 精简后所有链接锚点必须指向 `AGENTS_RULES.md` 中真实存在的章节。

## 技术说明

本任务为纯 Markdown 文档编辑，不涉及代码实现，无需技术栈、架构设计或组件设计。

### 编辑原则

- 只修改 `AGENTS.md` 与 `AGENTS_RULES.md` 两个文件，不改动任何 `.ts` / `.vue` / `.scss` 源码。
- 删除重复内容时，保留「信息最完整、位置最合理」的那一处作为唯一权威来源，其余改为链接或直接删除。
- 保留两份文件既有的中文标题锚点格式（`#xxx`），精简时复用现有链接，确保跳转有效。
- 所有改动保持规则语义等价，可通过逐条比对确认约束未丢失。

### 关键决策

- **i18n 分片规则**：保留 `AGENTS_RULES.md` 中「强制规则：i18n 只改分片文件」章节（L1269-1281）为权威来源，删除或收敛其上方「⛔ 硬规则：禁止直接写入 zh_CN.json」重复块，避免同文件内两处维护。
- **AI build/lint 禁止项**：保留 `AGENTS_RULES.md`「构建与验证」章节的完整说明作为权威来源，`AGENTS.md` 中「验证链条」与「构建与验证」两处收敛为简短提示 + 链接。
- **硬规则长条目下沉**：`AGENTS.md` 中 7 条超长硬规则条目仅保留核心约束一句话 + 指向 `AGENTS_RULES.md` 的既有链接，删除逐字重复的细节描述。