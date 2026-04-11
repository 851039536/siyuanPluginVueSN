# Biome 配置规则说明

> 本文档对应 `biome.json` 配置，详细说明每条规则的含义和作用。

---

## 配置结构总览

```
biome.json
├── vcs          — 版本控制集成
├── files        — 文件包含/排除
├── formatter    — 格式化配置
├── linter       — Lint 规则
│   ├── security     — 安全性
│   ├── correctness  — 正确性
│   ├── complexity   — 复杂度
│   ├── style        — 风格
│   ├── suspicious   — 可疑代码
│   └── performance  — 性能
├── javascript   — JS/TS 专属配置
├── json         — JSON 专属配置
├── css          — CSS/SCSS 专属配置
└── assist       — 辅助操作（自动修复）
```

---

## 基础配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `vcs.enabled` | `true` | 启用 VCS 集成，自动读取 .gitignore |
| `vcs.clientKind` | `"git"` | 使用 Git 作为版本控制系统 |
| `vcs.useIgnoreFile` | `true` | 使用 .gitignore 排除文件 |
| `files.includes` | `["**", "!!**/dist"]` | 包含所有文件，排除 dist 目录（`!!` 表示排除） |

---

## 格式化配置 (formatter)

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `formatter.enabled` | `true` | 启用格式化 |
| `formatter.indentStyle` | `"tab"` | 使用 tab 缩进 |
| `formatter.lineWidth` | `120` | 每行最大字符数 |
| `formatter.formatWithErrors` | `false` | 有语法错误时不格式化，避免破坏代码 |

---

## Lint 规则详解

规则级别说明：
- **error** — 必须修复，否则 lint 失败
- **warn** — 建议修复，发出警告
- **off** — 不检查

### 🔒 安全性规则 (security)

防止潜在安全漏洞，**建议全部启用**。

| 规则 | 级别 | 说明 |
|------|------|------|
| `noDangerouslySetInnerHtml` | error | 禁止使用 `v-html` / `dangerouslySetInnerHTML`，防止 XSS 攻击 |
| `noGlobalEval` | error | 禁止使用 `eval()`，防止代码注入 |

---

### ✅ 正确性规则 (correctness)

确保代码逻辑正确，避免运行时错误。

| 规则 | 级别 | 说明 |
|------|------|------|
| `noUnusedVariables` | warn | 未使用的变量发出警告，清理死代码 |
| `noUnusedImports` | warn | 未使用的 import 发出警告，减少冗余 |
| `noEmptyBlock` | warn | 空代码块发出警告，可能遗漏了逻辑 |
| `noInnerDeclarations` | error | 禁止在嵌套作用域中声明 function（变量提升问题） |
| `noInvalidBuiltinInstantiation` | error | 禁止错误使用内置构造函数（如 `new String()`、`new Number()`） |
| `noUndeclaredVariables` | error | 禁止使用未声明的变量，防止拼写错误 |

---

### 🧠 复杂度规则 (complexity)

控制代码复杂度，提高可读性。

| 规则 | 级别 | 说明 |
|------|------|------|
| `noBannedTypes` | error | 禁止使用被废弃的类型（如 `String`、`Number`、`Boolean` 作为类型注解，应使用小写） |
| `noUselessUndefined` | warn | 禁止无意义的 `undefined` 初始化（如 `let x = undefined`） |
| `noUselessTypeConstraint` | warn | 禁止无意义的泛型约束（如 `<T extends unknown>`，等同于无约束） |
| `noForEach` | off | 不限制 `forEach`（根据团队习惯选择，推荐用 `for...of`） |
| `useSimplifiedLogicExpression` | warn | 建议简化逻辑表达式（如 `!!a \|\| !b && !c` → `!(a && b)`） |

---

### 🎨 风格规则 (style)

统一代码风格，保持一致性。

| 规则 | 级别 | 说明 |
|------|------|------|
| `noInferrableTypes` | warn | 禁止可推断的冗余类型注解（如 `const x: number = 1`，类型可自动推断） |
| `noNonNullAssertion` | off | 不限制非空断言 `!`（Vue 项目中常用，关闭避免误报） |
| `useConst` | error | 不会被重新赋值的变量必须用 `const` |
| `noVar` | error | 禁止使用 `var`，必须使用 `let` / `const` |
| `useTemplate` | warn | 建议使用模板字符串代替字符串拼接（`` `Hello ${name}` `` 优于 `"Hello " + name`） |
| `useNumberNamespace` | error | 使用 `Number.isNaN()` 而非全局 `isNaN()`（全局版本会隐式转换类型） |
| `useSelfClosingElements` | warn | 没有子元素时使用自闭合标签（如 `<Comp />` 优于 `<Comp></Comp>`） |

---

### 🚨 可疑代码规则 (suspicious)

检测可能的 Bug 和危险模式。

| 规则 | 级别 | 说明 |
|------|------|------|
| `noExplicitAny` | warn | 警告使用 `any` 类型，应尽量使用具体类型 |
| `noFallthroughSwitchClause` | error | switch 每个 case 必须有 `break` / `return`，防止意外穿透 |
| `noRedeclare` | error | 禁止重复声明变量 |
| `noSelfCompare` | error | 禁止变量与自身比较（如 `x === x`，通常是笔误） |
| `noDoubleEquals` | warn | 建议使用 `===` 代替 `==`（避免隐式类型转换） |
| `noAssignInExpressions` | error | 禁止在表达式中赋值（防止把 `==` 写成 `=`） |

---

### ⚡ 性能规则 (performance)

检测性能问题。

| 规则 | 级别 | 说明 |
|------|------|------|
| `noAccumulatingSpread` | warn | 警告在循环中使用展开运算符累积（如 `arr = [...arr, item]`，会导致 O(n²) 性能问题） |

---

## JavaScript/TypeScript 专属配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `quoteStyle` | `"double"` | 使用双引号 |
| `semicolons` | `"always"` | 始终添加分号 |
| `trailingCommas` | `"all"` | 末尾逗号（多行时始终添加，方便 git diff） |
| `arrowParentheses` | `"always"` | 箭头函数参数始终加括号（兼容单参数场景） |

## JSON 专属配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `trailingCommas` | `"none"` | JSON 标准不允许末尾逗号 |

## CSS/SCSS 专属配置

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `enabled` | `true` | 启用 CSS/SCSS 格式化 |

## 辅助操作 (assist)

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `organizeImports` | `"on"` | 自动组织 import 语句排序 |

---

## 如何使用

### 格式化代码

```bash
# 格式化整个项目
npx @biomejs/biome format --write .

# 仅格式化指定文件
npx @biomejs/biome format --write src/main.ts

# 检查但不修改（CI 中使用）
npx @biomejs/biome format .
```

### Lint 检查

```bash
# 检查所有 lint 问题
npx @biomejs/biome lint .

# 检查并自动修复可修复的问题
npx @biomejs/biome lint --write .

# 仅检查安全规则
npx @biomejs/biome lint --only=security .
```

### 一键检查 + 自动修复

```bash
# 格式化 + lint + import 排序，全部自动修复
npx @biomejs/biome check --write .

# 仅检查不修改
npx @biomejs/biome check .

# 仅修复安全问题
npx @biomejs/biome check --only=security --write .
```

### 推荐 npm scripts

在 `package.json` 的 `scripts` 中添加：

```json
{
  "lint": "biome check .",
  "lint:fix": "biome check --write .",
  "format": "biome format --write ."
}
```

之后即可使用：

```bash
npm run lint        # 检查问题
npm run lint:fix    # 自动修复
npm run format      # 格式化代码
```

### 编辑器集成

- **VS Code**：安装 [Biome 扩展](https://marketplace.visualstudio.com/items?itemName=biomejs.biome)，保存时自动格式化
- **WebStorm**：2024.1+ 内置 Biome 支持，在 Settings → Languages & Frameworks → JavaScript → Code Quality Tools → Biome 中启用

---

## 规则调整指南

需要调整某条规则时，修改 `biome.json` 中对应规则的值：

```jsonc
// 关闭规则
"noExplicitAny": "off"

// 从警告改为错误
"noDoubleEquals": "error"

// 从错误改为警告
"noFallthroughSwitchClause": "warn"
```

> 完整规则列表参考：https://biomejs.dev/linter/rules/
