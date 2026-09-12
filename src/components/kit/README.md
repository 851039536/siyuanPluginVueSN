# components/kit —— 组件库自包含支撑目录

> 本目录是「共享组件库可整体复制到普通 Vue 3 项目」的支撑层，**禁止 feature 直接导入**
> （与 `datePicker/`、`select/` 等私有子目录同级约定）。随 `src/components/` 一起被复制。

## 文件职责

| 文件 | 职责 | 在本仓库 |
|---|---|---|
| `icons.ts` | 图标表**真源**（`FEATURE_ICONS` / `COMMON_ICONS` / `getIconConfig()` / `IconKey` 类型），零外部依赖 | `src/config/icons.ts` 是它的 `export *` 转发壳，48 处既有引用路径不变 |
| `variables.scss` | 设计 Token **真源**（`$color-*` / `$font-*` / `$radius-*` / `$spacing-*`） | `src/_variables.scss` 是它的 `@forward` 转发壳，336 处既有引用路径不变 |
| `theme.ts` | 默认主题注入：宿主（思源或目标项目）**未定义** `--b3-theme-*` 时才注入一套明暗变量；三层保险（检测 / `@layer` / `prepend`）保证不污染宿主主题 | 思源内为 no-op |
| `iconify.ts` | mdi 图标数据离线注册（`addCollection`），由 `IconWrapper.vue` 副作用导入触发 | 与 `src/utils/iconifySetup.ts` 并存（后者额外注册 ph 图标集，供其它 feature 使用） |

## 约束

1. **新增图标 / Token 请改本目录的真源文件**，不要改两个转发壳。
2. `theme.ts` 的默认取值应与 `variables.scss` 的 `$color-*` fallback 体系保持同一设计语言
   （当前为 Codex 暖色系）；两个 `*-rgb` 变量必须是**逗号分隔**（被 `rgba(var(--x), a)` 消费）。
3. `variables.scss` 故意**不带下划线前缀**：组件 scss 以 `@use '../kit/variables.scss'`
   显式扩展名引用，避免依赖解析器的 partial 回退行为。
4. `theme.ts` 由 48 个公开组件以 `import "./kit/theme"` 副作用导入触发；新增公开组件时
   记得补这一行（无 `<script>` 的组件需补一个最小 script 块）。

## 目标项目如何定制主题

- 最简：在目标项目自己的全局样式里定义 `--b3-theme-*`（未分层样式恒优先，自动覆盖本套默认值）；
- 或调用 `applyDefaultTheme({ overrides: { "b3-theme-primary": "#7c3aed" } })`（同时作用于明暗两套）；
- 或直接改 `theme.ts` 里的 `LIGHT_VARS` / `DARK_VARS`。
