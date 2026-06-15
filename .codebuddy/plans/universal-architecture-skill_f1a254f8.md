---
name: universal-architecture-skill
overview: 创建综合型 CodeBuddy Agent Skill（`.skill` 文件），将当前 Vue/TS 项目的核心架构规范（功能模块化、统一入口、设计 Token、8 步注册体系、编译时断言等）抽象为语言无关的通用规范，适配 Vue、C#、TS、JS 项目，支持项目结构校验、新模块脚手架生成、代码审查三种能力。
todos:
  - id: init-skill
    content: 使用 [skill:skill-creator] 初始化 Skill 目录结构，运行 init_skill.py 创建 universal-arch-skill 骨架
    status: completed
  - id: explore-patterns
    content: 使用 [subagent:code-explorer] 深度探索 src/features/ 下 5-8 个代表性功能模块（passwordVault、dataBackup、docAnalysis、gitPush、flashcardReading），提取目录结构、注册模式、Storage 类、Composable 等可复用范本
    status: completed
  - id: write-arch-principles
    content: 编写 references/arch-principles.md，定义 6 大通用架构原则（功能模块化、注册完整性、类型安全单一数据源、统一入口、设计 Token、样式分离）的语言无关规范
    status: completed
    dependencies:
      - explore-patterns
  - id: write-lang-adapters
    content: 编写三个语言适配参考文件：references/vue-ts-adapter.md（直接映射当前架构）、references/csharp-adapter.md（namespace/partial class 映射）、references/js-ts-adapter.md（纯逻辑层映射）
    status: completed
    dependencies:
      - write-arch-principles
  - id: create-templates
    content: 创建 assets/ 下三套功能模块模板：feature-template-vue/（目录+7个文件模板）、feature-template-csharp/（4个文件模板）、feature-template-js/（3个文件模板）
    status: completed
    dependencies:
      - write-lang-adapters
  - id: write-validator-script
    content: 编写 scripts/validate-project-structure.py，实现项目结构校验脚本（支持 --lang 参数、JSON 规则配置、结构化报告输出）
    status: completed
    dependencies:
      - write-arch-principles
  - id: write-scaffold-script
    content: 编写 scripts/scaffold-feature.py，实现功能模块脚手架生成脚本（模板变量替换、8 步注册提示、语言适配）
    status: completed
    dependencies:
      - create-templates
  - id: write-skill-md
    content: 编写 SKILL.md（含 YAML frontmatter），定义触发条件、核心工作流、资源索引，控制在 350 行以内
    status: completed
    dependencies:
      - write-lang-adapters
      - write-validator-script
      - write-scaffold-script
  - id: package-skill
    content: 使用 [skill:skill-creator] 运行 package_skill.py 验证并打包 Skill 为 universal-arch-skill.skill 文件
    status: completed
    dependencies:
      - write-skill-md
---

## 用户需求

生成一个通用、综合型 CodeBuddy Agent Skill（.skill 文件），将当前 `siyuan-plugin-vite-vue-sn` 项目（Vite + Vue 3 + TypeScript，40+ 功能模块，Codex UI 风格）的核心架构规范抽象为语言无关的通用开发规范。

## 核心功能

### 三合一能力

1. **项目结构校验器**：自动检测项目目录结构、命名约定、注册完整性等是否符合规范
2. **功能模块脚手架生成器**：一键生成符合架构规范的新功能模块（目录结构 + 模板代码 + 注册项）
3. **代码审查助手**：在 LLM 辅助编码时自动应用架构规范进行 review，识别违规模式

### 语言兼容

- **Vue + TypeScript**：直接映射当前项目架构（features/<name>/ 目录、8 步注册清单）
- **C#**：类比为 namespace/class 体系，partial class 注册模式，设计 Token 用常量/资源文件
- **纯 JS/TS**：逻辑层模块化，类型定义 + 函数式注册，无 UI 框架绑定

### 规范覆盖

提取当前项目的 6 大核心架构原则：

- 功能模块化注册体系（8 步清单）
- 类型安全单一数据源 + 编译时断言
- 统一入口原则（禁止直调底层 API）
- 设计 Token 体系（禁止硬编码）
- 样式代码分离（SCSS 提取到独立文件）
- 国际化双语默认支持

## 技术方案

### Skill 结构设计

基于 skill-creator 规范，Skill 采用三层渐进式加载：

```
universal-arch-skill/
├── SKILL.md                           # 主指令（<500行）
│   ├── YAML frontmatter (name + description)
│   └── Markdown 指令（核心工作流 + 资源索引）
├── scripts/
│   ├── validate-project-structure.py  # 项目结构校验脚本
│   └── scaffold-feature.py           # 功能模块脚手架生成脚本
├── references/
│   ├── arch-principles.md            # 6大架构原则详解（通用版）
│   ├── vue-ts-adapter.md             # Vue/TS 项目适配详细指南
│   ├── csharp-adapter.md             # C# 项目适配详细指南
│   └── js-ts-adapter.md              # 纯 JS/TS 项目适配详细指南
└── assets/
    ├── feature-template-vue/          # Vue 功能模块模板（目录+文件）
    │   ├── index.ts.tmpl
    │   ├── index.vue.tmpl
    │   ├── types/index.ts.tmpl
    │   ├── types/storage.ts.tmpl
    │   ├── components/_.gitkeep
    │   ├── styles/index.scss.tmpl
    │   ├── composables/_.gitkeep
    │   └── README.md.tmpl
    ├── feature-template-csharp/       # C# 功能模块模板
    │   ├── FeatureName.cs.tmpl
    │   ├── IFeatureNameService.cs.tmpl
    │   ├── Models/FeatureNameModel.cs.tmpl
    │   └── Registration/FeatureNameRegistration.cs.tmpl
    └── feature-template-js/           # 纯 JS/TS 功能模块模板
        ├── index.ts.tmpl
        ├── types.ts.tmpl
        └── README.md.tmpl
```

### 实现策略

1. **SKILL.md 设计**：定义三级触发条件（校验/脚手架/审查），核心工作流用伪代码描述，详细规则链向 references/
2. **校验脚本**：Python 实现，支持 JSON/YAML 配置文件定义校验规则，输出结构化报告
3. **脚手架脚本**：Python 实现，基于模板变量替换生成功能模块，支持 `--lang vue|cs|js` 参数
4. **代码审查规则**：以参考文档形式提供 architecture-decision-records 风格的审查清单

### 关键设计决策

- **语言无关抽象层**：在 `arch-principles.md` 中定义通用原则，各语言适配器提供具体模式映射表
- **模板分离策略**：脚本不硬编码模板内容，而是从 `assets/` 目录读取 `.tmpl` 文件，方便用户自定义
- **渐进式上下文加载**：SKILL.md 仅 250-350 行，只触发时加载对应 reference 文件

## Agent Extensions

### Skill 扩展

- **skill-creator**
- 用途：指导 Skill 的创建过程，包括初始化（init_skill.py）、SKILL.md 编写规范、打包验证（package_skill.py）
- 预期结果：生成符合 CodeBuddy 标准的 .skill 文件，通过所有验证检查

### SubAgent 扩展

- **code-explorer**
- 用途：深度探索 `src/features/` 下多个功能模块的目录结构和实现模式，提取可复用的架构范本
- 预期结果：输出结构化的功能模块模式清单，覆盖 Vue 组件注册、Storage 类、Composable 模式等