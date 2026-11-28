# 思源主题 CSS 变量基准

审查插件样式时用于判定 `var(--b3-*)` 引用是否有效、明暗两套是否都成立。

- **基准版本**：SiYuan `3.8.12`（本机安装版采集，非分支快照）
- **采集日期**：2026-11-28
- **机器可读快照**：[`scripts/data/siyuan-theme-vars.json`](../../scripts/data/siyuan-theme-vars.json)
- **消费方**：`scripts/audit-scss.mjs` 规则 `R3-theme-var-unknown`

> 思源主题变量不是稳定 API，跨版本会增删改名。**升级思源后必须重新采集**，否则审计结论会与运行时不符。

---

## 一、基准来源：为什么以本地安装目录为主

三条在线路径在 2026-11-28 复测结果：

| 路径 | 状态 | 说明 |
| --- | --- | --- |
| `raw.githubusercontent.com/siyuan-note/siyuan/master/app/appearance/themes/{daylight,midnight}/theme.css` | ✅ 可用 | 上游 `:root` 变量 185 个，与本地 3.8.12 完全一致 |
| `api.github.com/repos/.../contents/...` | ❌ 403 | 未认证请求按出口 IP 限流（60 次/小时，与仓库无关） |
| `cdn.jsdelivr.net/gh/siyuan-note/siyuan@master/...` | ❌ 不可用 | 主仓库体积超过 CDN 的 50MB 单包上限，整库拒绝 |

> **历史误判修正**：早期用 `app/src/assets/scss/_variables.scss` 请求得到 404，据此判定「raw 直连不可靠」。实际是**该文件不存在** —— 仓库里没有集中式变量文件，`app/src/assets/scss/base.scss` 只是 52 行 `@use` 聚合入口，`--b3-*` 全部定义在 `app/appearance/themes/*/theme.css`。换成正确路径后 raw 立即可用。

即使 raw 可用，**静态文件仍不等于运行时全集**：`--b3-*` 的最终生效集合来自「主题 CSS + 内核注入 + 用户自定义主题」三者叠加。因此判定基准仍取本地安装目录，raw 只用于「上游是否已新增/改名」的对照。按可靠性排序取三层：

| 层 | 来源 | 得到什么 | 执行者 |
| --- | --- | --- | --- |
| L1 静态（权威） | 思源安装目录 `resources/appearance/themes/{daylight,midnight}/theme.css` + `resources/stage/build/app/base.*.css` | 官方明暗两套变量名与取值 | 脚本自动采集 |
| L2 运行时（校准） | 思源内控制台导出 `document.documentElement` 的 `--b3-` 属性 | 当前环境真实生效全集（含用户主题覆盖） | 用户手工执行一次 |
| L3 上游（补充） | `github.com/siyuan-note/siyuan` 仓库 diff | 变量新增/改名的时间线 | 按需 |

L1 已足够支撑「引用是否有效」的判定；L2 用于排查「装了第三方主题后样式异常但官方主题正常」这类问题。

---

## 二、快照结构

```jsonc
{
  "version": "3.8.12",
  "collectedAt": "2026-11-28",
  "source": { "theme": "...", "base": "...", "note": "..." },
  "counts": { "light": 185, "dark": 185, "base": 72, "valid": 253 },
  "light": { "--b3-theme-primary": "#3575f0", ... },   // daylight 的 :root 全集
  "dark":  { "--b3-theme-primary": "#3575f0", ... },   // midnight 的 :root 全集
  "langOverrides": { "light": { ":root:lang(zh-CN)": {...} }, "dark": {...} },
  "base": { "--b3-ui-dock-width": "200px", ... },      // 主样式表补充定义
  "valid": ["--b3-border-color", ...]                  // 三者并集，审计判定用
}
```

- `valid` 是**唯一判定依据**：`var(--b3-x)` 中的 `x` 不在 `valid` 内即为失效引用。
- `langOverrides` 单独存放：语言相关的字体族覆盖不参与有效性判定。
- 动态拼接（`var(--b3-theme-${mode})`）不在静态判定范围，审计脚本对不含完整变量名的片段跳过。

---

## 三、明暗两套的差异

185 个变量中，**69 个在明暗主题下取值不同**，集中在以下几组：

| 变量 | daylight | midnight |
| --- | --- | --- |
| `--b3-theme-background` | `#fff` | `#1e1e1e` |
| `--b3-theme-surface` | `#f6f6f6` | `#2c2c2c` |
| `--b3-theme-on-background` | `#222` | `#dadada` |
| `--b3-theme-on-surface` | `#5f6368` | `#9aa0a6` |
| `--b3-theme-primary-lightest` | `rgba(53,117,240,.12)` | `rgba(53,117,240,.24)` |
| `--b3-border-color` | `var(--b3-theme-surface-lighter)` | 同名，但底层值随主题变 |

**含义**：任何写死浅色 rgba / 十六进制值的样式，在暗色主题下都会失配。插件的做法是**语义色走 `var(--b3-*)`，几何值与品牌色板走 SCSS Token**（见 `AGENTS_STYLE.md`），审计规则 `R3-hardcoded-color` 专门拦截这类回归。

---

## 四、fallback 策略

`var(--b3-x)` 是否带 fallback，决定失效时的表现：

```scss
// 推荐：主题未提供时仍有可读颜色（审计规则 R3-theme-var-no-fallback 为 P2）
color: var(--b3-theme-on-surface, #{$c-fg});

// 危险：变量缺失时声明整条失效，颜色回落到继承值（P0）
color: var(--b3-theme-on-surface-muted);
```

判定口径：

- 变量在 `valid` 内 → 不告警（fallback 可有可无）
- 变量不在 `valid` 内且**无** fallback → `P0`（样式实际失效，且大概率是抄了别的设计体系）
- 变量不在 `valid` 内但**有** fallback → `P1`（当前不炸，但 fallback 与主题脱节，暗色主题下观感可能不对）

---

## 五、重新采集

### L1 自动采集（推荐）

```bash
# Windows 默认安装路径
node scripts/audit-scss.mjs --refresh-theme-vars "C:/Users/<user>/AppData/Local/Programs/SiYuan"

# 只指定 resources 目录也可以
node scripts/audit-scss.mjs --refresh-theme-vars "C:/Users/<user>/AppData/Local/Programs/SiYuan/resources"
```

命令会重写 `scripts/data/siyuan-theme-vars.json`，并在 stdout 打印 `version / light / dark / base / valid` 计数，便于和上表核对。脚本按 `theme.css` 的 `:root` 块解析，同时扫描 `stage/build/app/base.*.css` 取补充变量。

### L2 运行时校准（手工，一次性）

在思源主窗口按 `Ctrl+Shift+I` 打开开发者工具，控制台执行：

```js
const cs = getComputedStyle(document.documentElement)
const vars = {}
for (const p of cs) if (p.startsWith('--b3-')) vars[p] = cs.getPropertyValue(p).trim()
console.log(JSON.stringify(vars, null, 2))
```

把输出与 `scripts/data/siyuan-theme-vars.json` 的 `light` / `dark` 做差集：

- 仅在运行时存在 → 该变量由内核注入或用户主题提供，属合法扩展，可加入 `scripts/audit-scss.config.json` 白名单并写明来源
- 仅在快照存在 → 当前主题未使用，不影响判定

> 注意：`getComputedStyle(document.documentElement)` 只能拿到 `:root` 上的变量；定义在 `.b3-menu` 等局部选择器上的变量不会出现，这类变量不应作为插件样式的依赖。

### L3 上游对照（可选，2026-11-28 复测可用）

```bash
curl -s https://raw.githubusercontent.com/siyuan-note/siyuan/master/app/appearance/themes/daylight/theme.css
curl -s https://raw.githubusercontent.com/siyuan-note/siyuan/master/app/appearance/themes/midnight/theme.css
```

用途仅限「当前安装版本是否落后于上游」：若变量数量或关键取值与快照不符，先升级思源再 `--refresh-theme-vars` 重采，**不要把上游文件直接当成本地基准**（用户可能停在旧版本，或装了第三方主题）。

复测结论（`master` vs 本地 `3.8.12`）：明/暗各 185 个变量、关键取值一致，无版本漂移。

---

## 六、当前插件的偏差

首轮采集后对 61 个引用做差集，**32 个变量在 3.8.12 中不存在**，且插件内也没有自定义定义（既不是思源变量，也不是自建变量）。典型如 `--b3-theme-info`、`--b3-theme-warning`、`--b3-theme-primary-container`、`--b3-theme-on-surface-variant` —— 命名风格接近 Material 3，属于跨设计体系误用。

逐条定位、分级与修复建议见 [`docs/scss-review.md`](../scss-review.md) § P0/P1。
