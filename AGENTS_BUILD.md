# AGENTS_BUILD.md

构建与验证流程、单元测试约定、viteStaticCopy 资源复制规则与依赖清单。

## 构建与验证

> **重要**：AI 不得执行 `pnpm vite build` 和 `pnpm lint`。这些验证由用户自行完成。AI 仅负责编写代码，用户自行验证构建和 lint。

> ✅ **例外：`pnpm test` AI 可执行**。Vitest 在纯 Node 进程内跑行为断言，不触发构建、不写产物、不读思源运行时，与 `lint` / `vite build` 的禁令无关。

> ⛔ **禁止新建临时校验脚本**：不要创建 `.tmp-*.mjs` / `.tmp-*.js` / `scripts/tmp-*.mjs` 这类一次性脚本（典型反例：为校验 SCSS 能否编译而临时写一个 `findFileUrl` importer 脚本），也不要用「用完即删」的方式绕过。原因：会产生未跟踪文件且常残留、验证口径与用户实际执行的命令不一致、脚本本身无复用价值。
>
> - 验证只走既有入口：`read_lints`（IDE 诊断，覆盖 ESLint 类问题）+ `pnpm typecheck` / `pnpm i18n:verify` / `pnpm validate:icons` / `pnpm test`；`pnpm lint` / `pnpm vite build` / SCSS 编译由用户执行。
> - 样式改动的自查手段：`read_lints` + 只使用 `src/components/kit/variables.scss` 中已存在的 Token 名（写完对照该文件核对），不另起脚本编译。
> - 确实需要**可复用**的检查能力时：**行为断言 → 写入 `src/**/*.spec.ts`**；静态扫描类 → 在 `scripts/` 下以正式名称落地并在本文档登记（参考 `verify-i18n.mjs` / `audit-token-shorthand.mjs`），而不是写成临时文件。

## 单元测试

用 **Vitest** 覆盖**纯函数层**（解析 / 换算 / 聚合 / 签名 / 转义）。目标不是覆盖率，而是给「类型正确但算错」的逻辑加回归护栏。

```bash
pnpm test        # vitest run（单次，AI 可执行）
pnpm test:watch  # vitest（监听模式）
```

### 纳测三条标准（须同时满足）

| # | 标准 | 说明 |
|---|------|------|
| 1 | **纯** | 无副作用、无全局状态，不触达 DOM / `siyuan` / `fetch` / `PluginStorage` / `TimerRegistry` |
| 2 | **有分支** | ≥3 条逻辑路径（`if` / `switch` / 正则 / 循环边界）；简单 getter 不测 |
| 3 | **可算错** | 存在「类型正确但结果错误」的可能 —— 解析、换算、聚合、排序、签名、时间计算 |

> 不满足第 1 条的文件（全项目 1000+ 源文件中约 271 个直接 `import from "siyuan"`）**不纳入测试**。

### 明确不做

| 项 | 理由 |
|----|------|
| Vue 组件渲染测试（`@vue/test-utils` / `jsdom`） | 组件正确性主要是视觉与交互，仓库已有**组件预览面板**作目视回归入口；引入 DOM 环境需 mock Iconify / chart.js / video.js / siyuan，成本远高于收益 |
| 覆盖率阈值 / CI 门禁 | 用「纳测三条标准」的质量约束替代数量指标，避免「为覆盖率而写」的空测试 |
| E2E | 宿主是思源 Electron，`(window as any).require` 与 `b3-theme-*` 仅存在于宿主机 |
| 触达统一入口（存储 / 定时器 / AI / 网络）的 composable | 需大量 mock，且其本质是编排而非算法 |

### 文件放置与命名

- 测试文件与被测源文件**同目录**，命名 `<源文件名>.spec.ts`（如 `src/utils/format.spec.ts`）
- `tsconfig.json` 的 `include` 已含 `src/**/*.ts`，`vue-tsc` 自动覆盖，**无需改 tsconfig**
- `*.spec.ts` 不参与生产构建（构建入口为 `src/index.ts`，spec 从入口不可达 ⇒ Rolldown 不会打包）
- 文件头注释规则同 `AGENTS_ARCH.md`（`// 文件功能说明`）

### 配置要点（`vitest.config.ts`）

⚠️ **`vitest.config.ts` 刻意与 `vite.config.ts` 解耦，只复刻其 `resolve.alias`**：

- `vite.config.ts` 的 `buildStart` 里有 `execSync("node scripts/merge-i18n.mjs")` 副作用，并加载 `viteStaticCopy` / `livereload` / `zipPack`；被 Vitest 加载会触发无谓的 i18n 合并与插件初始化
- `environment: "node"`，不加载 `@vitejs/plugin-vue`（无组件渲染测试）

⚠️ **别名三处同步**：新增 feature 别名时需同时更新 `vite.config.ts` / `tsconfig.json` / `vitest.config.ts`。当前被测目标仅用 `@/` 与相对导入，故 `vitest.config.ts` 只配置了 `@`；新增测试若需 `@featureName`，请同步补进其 `alias`。

⚠️ **`tsconfig.json` 的 `lib` 为 `ES2020`**：写测试时**不要用 `Array.prototype.at()`**（ES2022），会触发 `TS2550`。用索引替代（如 `arr[arr.length - 1]`）。

### 当前覆盖（基线）

| 测试文件 | 被测模块 | 覆盖重点 |
|---------|---------|---------|
| `src/utils/s3/s3Protocol.spec.ts` | `s3Protocol.ts` | AWS SigV4 签名（**用独立参考实现交叉验证**，非复用被测代码）、amz 时间戳、ListObjects / delimiter 目录式 / 错误体 XML 解析、Multipart 请求体 |
| `src/features/gitPush/utils/gitOutput.spec.ts` | `gitOutput.ts` | porcelain v1 两位状态码的 X 位优先 / Y 位回退（`AM`→added、`RM`→renamed）、7 种 unmerged 组合不重复计数、shortstat 为可选行导致的记录切分 |
| `src/features/gitPush/utils/diffText.spec.ts` | `diffText.ts` | hunk 行号驱动的行分类与自增、多文件 diff 的文件头行仍归 meta、末尾空行剥离、词级高亮的配对与占比阈值、预算采样 |
| `src/utils/format.spec.ts` | `format.ts` | 1024 进制档位边界、`Intl.RelativeTimeFormat` 各档位阈值与 auto 措辞 |
| `src/utils/stringUtils.spec.ts` | `stringUtils.ts` | `escapeHtml` / `escapeHtmlFull` / `escapeXml` 三套转义的**互不可替性**、XML 实体往返 |

### 维护约定

- 改动某个已覆盖的纯函数时，**同批更新其 `.spec.ts`**（测试与实现同目录，便于对照）
- 新增纯函数且满足纳测三条标准时，随改动**增量补测试**，不要求一次性铺开
- 发现既有实现的边界缺陷时，**在测试中锁定当前真实行为并注明「登记不改」**，另行按仓库约定登记到 `docs/` 审查报告 —— 不在测试提交中夹带行为修改
  （实例：`formatFileSize` 对负数产出 `"NaN undefined"`、`decodeXmlEntities` 对 `&amp;lt;` 过度解码，均已在 spec 中登记为已知行为）
- **有效性自检**：新增测试后，故意在实现里注入一个错误（如把状态判定改回 `xy.includes("M")`），确认测试变红再回退。不会变红的测试没有护栏价值


常见 Vite 警告：

| 警告 | 原因 | 处理 |
|------|------|------|
| `is dynamically imported by ... but also statically imported` | 某模块同时被静态和动态导入 | 改为统一静态 `import` |

## 强制规则：viteStaticCopy 静态资源复制必须 stripBase

用 `viteStaticCopy` 复制**位于 src 子目录内的静态资源**（字体、图片等）到插件目录时，`dest` 会附加源路径的**完整目录结构**，导致产物路径变为 `dest/src/features/.../原文件名` 的嵌套结构，而运行时按 `${assetsPath}/fonts/xxx` 引用时 404。

**必须添加 `rename: { stripBase: true }`** 让输出扁平化：

```ts
{
  src: "./src/features/generalSettings/assets/fonts/LXGWWenKai-Regular.ttf",
  dest: "./assets/fonts/",
  rename: { stripBase: true },  // ← 必须：否则产物是 assets/fonts/src/features/.../xxx.ttf
},
```

**验证方式**（构建后检查产物路径）：

```bash
Get-ChildItem "{workspace}\data\plugins\{pluginName}\assets" -Recurse -Filter "*.ttf"
# 期望：...\assets\fonts\LXGWWenKai-Regular.ttf（扁平）
# 若出现 ...\assets\fonts\src\features\...\ 嵌套 → 缺 stripBase
```

**关键认知**：
- `vite build --watch` 模式下**修改 `vite.config.ts` 不会自动重启**，必须重启 `pnpm dev` 才能加载新配置；否则构建产物仍是旧配置路径（表现为"改了配置但产物没变"）
- 内置字体等大体积静态资源会增加插件包体积，需在功能设计时评估

## 依赖

| 依赖 | 版本 | 用途 |
|------|------|------|
| Vue | ^3.3.8 | 前端框架 |
| TypeScript | ^5.0.4 | 类型系统 |
| Vite | ^6.2.1 | 构建工具 |
| siyuan | 1.1.0 | Siyuan API 类型 |
| sass | ^1.62.1 | SCSS 编译（dev） |
| eslint | ^9.22.0 | 代码检查（dev / @antfu/eslint-config） |
| vitest | ^5.0.1 | 纯函数单元测试（dev；`environment: node`，无 DOM 依赖） |
