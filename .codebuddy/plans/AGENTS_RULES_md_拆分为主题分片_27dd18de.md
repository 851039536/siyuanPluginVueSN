---
name: AGENTS_RULES.md 拆分为主题分片
overview: 将 AGENTS_RULES.md（63KB）按 5 个主题拆分为独立分片文件（AGENTS_API / AGENTS_STYLE / AGENTS_ARCH / AGENTS_I18N / AGENTS_BUILD），删除原文件，AGENTS.md 新增「规则分片索引」章节并更新全部链接，实现按需加载、节省提示词上下文。
todos:
  - id: create-api-style
    content: 创建 AGENTS_API.md 与 AGENTS_STYLE.md，原样迁移对应章节并加文件头说明
    status: completed
  - id: create-arch-i18n-build
    content: 创建 AGENTS_ARCH.md、AGENTS_I18N.md、AGENTS_BUILD.md，迁移剩余章节与依赖表
    status: completed
  - id: update-agents-links
    content: 更新 AGENTS.md 全部链接指向新分片，重写参考文件章节为规则分片索引
    status: completed
    dependencies:
      - create-api-style
      - create-arch-i18n-build
  - id: update-ai-usage-ref
    content: 更新 docs/ai-api-usage.md 中 AGENTS_RULES.md 引用为 AGENTS_API.md
    status: completed
    dependencies:
      - create-api-style
  - id: delete-verify
    content: 删除 AGENTS_RULES.md，全量校验无残留引用且锚点内容完整
    status: completed
    dependencies:
      - update-agents-links
      - update-ai-usage-ref
---

## 产品概述

将 63KB 的 `AGENTS_RULES.md`（约 1328 行）按主题拆分为 5 个分片规则文件，删除原文件，由 `AGENTS.md` 承担「规则分片索引」导航职责。目标：规则按需加载，节省 AI 提示词上下文；各主题文件小而专注，维护成本更低。

## 核心功能

- **5 个主题分片**（用户已确认粒度与命名，全英文风格）：
- `AGENTS_API.md`：API 参考（存储/Dock/Modal/事件/跨功能联动/Markdown/状态栏/DOM/Node/加密/AI/功能开关/全局设置/快捷键）、路径别名、文件路径、Vue 实例常驻模式、底部面板模式、独立窗口承载、强制规则（AI 调用、请求加载反馈）
- `AGENTS_STYLE.md`：UI 风格 Codex（设计 Token/核心规范速查/.vp-* 组件模式库/禁止事项）、字号层级与全局基准字号、Dock 面板侧边栏间距、SCSS 分离、内置字体模式
- `AGENTS_ARCH.md`：Composable 提取、文件头注释、单文件行数上限、模块提取判定标准（含组件文件夹组织标准）
- `AGENTS_I18N.md`：i18n 不生效问题排查、禁止 i18n 硬编码兜底值
- `AGENTS_BUILD.md`：构建与验证、viteStaticCopy stripBase、依赖清单
- **删除 `AGENTS_RULES.md`**：内容全部分配到分片，避免双份维护
- **AGENTS.md 改造**：新增「规则分片索引」章节（5 行表格：文件 + 内容 + 使用场景），全部 19 处链接按映射改指新分片
- **docs/ai-api-usage.md**：更新 1 处「AGENTS_RULES.md」引用为「AGENTS_API.md」
- **规则语义零改动**：章节标题原样保留（Markdown 锚点依赖标题），仅移动位置 + 更新文件名前缀

## 约束

- 章节标题（`##`/`###`/`####`）必须原样保留，锚点才有效
- 分片文件顶部保留标题 + 简短功能说明注释
- 分片文件内对 AGENTS.md 的反指引用（2 处）保持原样
- 校验通过标准：全仓库无 `AGENTS_RULES.md` 残留、所有链接文件存在且锚点可跳转、关键内容（40 个模块别名/Token 全表/.vp-* 组件库/依赖表）未丢失

## 技术选型

本任务为纯 Markdown 文档重构，不涉及代码/构建改动。无需引入任何工具链，使用文件读写 + 文本检索完成。

## 实现方案

### 分片策略

按「调用方使用场景」聚类章节：开发时最常同时查阅的规则归入同一文件（如所有样式类规则归 AGENTS_STYLE），使 AI 按需读取一个分片即可覆盖某类任务的完整约束，最大化省 token 效果。

### 关键决策

1. **标题原样迁移**：Markdown 锚点由标题文本生成（小写 + 去标点 + 空格转连字符），章节标题一字不改，锚点即可复用，链接更新只需改文件名前缀，无需重新计算锚点。
2. **删除而非保留索引文件**：避免「详细文档双份维护」；AGENTS.md 顶部链接 + 末尾「规则分片索引」表承担导航。
3. **分片文件顶部加功能说明注释**：与项目文件头注释习惯一致，方便快速识别文件职责。

### 链接更新映射（AGENTS.md 内 19 处 + docs 1 处）

| 原链接前缀 | 新前缀 | 数量 |
| --- | --- | --- |
| `AGENTS_RULES.md#api-参考` 等 API/模式/快捷键/AI 规则 | `AGENTS_API.md` | 8 |
| `AGENTS_RULES.md#ui-风格codex` 等样式类 | `AGENTS_STYLE.md` | 5 |
| `AGENTS_RULES.md#强制规则文件头注释` 等架构类 | `AGENTS_ARCH.md` | 4 |
| `AGENTS_RULES.md#强制规则禁止-i18n-硬编码兜底值` | `AGENTS_I18N.md` | 1 |
| `AGENTS_RULES.md#构建与验证` | `AGENTS_BUILD.md` | 1 |
| docs/ai-api-usage.md「见 AGENTS_RULES.md」 | `AGENTS_API.md` | 1 |


### 校验策略

- `search_content` 全仓库搜 `AGENTS_RULES`，期望 0 命中
- 逐文件核对章节标题清单与原文件一致
- 抽查关键内容（功能模块别名清单 40 项、`$color-*` Token 全表、`.vp-*` 组件库代码、依赖表）确认迁移完整
- `read_lints` 确认无新增诊断

## 目录结构

```
project-root/
├── AGENTS.md            # [MODIFY] 更新 19 处链接；「参考文件」章节重写为「规则分片索引」表
├── AGENTS_RULES.md      # [DELETE] 内容全部分片迁移后删除
├── AGENTS_API.md        # [NEW] API 参考 + 路径别名 + 文件路径 + 3 个承载模式 + AI 调用/加载反馈规则
├── AGENTS_STYLE.md      # [NEW] UI 风格 Codex 全章 + 字号层级 + Dock 侧边栏间距 + SCSS 分离 + 内置字体
├── AGENTS_ARCH.md       # [NEW] Composable 提取 + 文件头注释 + 单文件行数 + 模块提取判定标准
├── AGENTS_I18N.md       # [NEW] i18n 不生效排查 + 禁止 i18n 硬编码兜底值
├── AGENTS_BUILD.md      # [NEW] 构建与验证 + viteStaticCopy stripBase + 依赖清单
└── docs/
    └── ai-api-usage.md  # [MODIFY] L4 引用 AGENTS_RULES.md → AGENTS_API.md
```