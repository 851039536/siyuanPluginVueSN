# SCSS 设计 Token 短名规范

审查对象：`src/components/kit/variables.scss`（设计 Token 真源，`src/_variables.scss` 仅为 `@forward` 转发壳）
规范依据：`AGENTS_STYLE.md`（§ 全局设计 Token、§ 禁止事项）
建立日期：2026-09-11

> 本文档定义 Token 的**短名体系**与**命名规则**。短名与旧长名取值严格相等，编译产物完全一致。

---

## 一、核心命名规则（一句话）

```
「px」后缀 = 绝对值        例：$s-px10 = 10px
无「px」后缀 = 4px 进制档位  例：$s-4 = 1rem = 16px
```

### 为什么必须这样区分

旧体系存在**后缀语义自相矛盾**：

```scss
$spacing-px: 3px;    // -px 后缀，但值是 3px
$spacing-2px: 2px;   // -px 后缀，值是字面 2px
$radius-px: 3px;     // 同 -px 后缀，语义组不同，也是 3px
```

即 `-px` 后缀**同时**表示「字面 1px」和「3px」。短名体系把这一点彻底规整：

- 绝对值一律 `px<数字>`：`$s-px3`（3px）、`$s-px10`（10px）
- 档位一律纯数字：`$s-4`（第 4 档 = 1rem = 16px）

**这个区分至关重要**：`$spacing-4`（16px）与 `$spacing-2px`（2px）在新体系下分别是 `$s-4` 与 `$s-px2`，不会因为「数字相等」而误替换。

---

## 二、前缀总表

| 前缀 | 语义 | 旧长名前缀 | 备注 |
|---|---|---|---|
| `$c-` | 颜色 | `$color-` | 含 `$vp-mono` 无关的语义色 |
| `$ff-` | 字体族（font-family） | `$font-zh` / `$vp-mono` | `$vp-mono` 已收编 |
| `$t-` | 字号（font-size） | `$font-size-` | |
| `$fw-` | 字重（font-weight） | `$font-weight-` | |
| `$lh-` | 行高（line-height） | `$line-height-` | |
| `$r-` | 圆角（radius） | `$radius-` / `$vp-radius` | |
| `$s-` | 间距（spacing） | `$spacing-` | |
| `$bp-` | 断点（breakpoint） | `$mobile-breakpoint` | |

---

## 三、完整映射表

### 3.1 圆角 `$radius-*` → `$r-*`

| 旧长名 | 新短名 | 值 |
|---|---|---|
| `$radius-none` | `$r-0` | `0` |
| — | `$r-px1` | `1px`（新增档） |
| `$radius-2px` | `$r-px2` | `2px` |
| `$radius-px` | `$r-px3` | `3px` |
| `$radius-sm` | `$r-sm` | `0.25rem` (4px) |
| `$radius-base` / `$vp-radius` | `$r-base` | `0.375rem` (6px) |
| `$radius-md` | `$r-md` | `0.5rem` (8px) |
| `$radius-lg` | `$r-lg` | `0.75rem` (12px) |
| `$radius-xl` | `$r-xl` | `1rem` (16px) |
| `$radius-2xl` | `$r-2xl` | `1.5rem` (24px) |
| `$radius-full` | `$r-full` | `9999px` |

### 3.2 间距 `$spacing-*` → `$s-*`

**绝对值档（px 后缀）**

| 旧长名 | 新短名 | 值 |
|---|---|---|
| `$spacing-0` | `$s-0` | `0` |
| `$spacing-1px` | `$s-px1` | `1px` |
| `$spacing-2px` | `$s-px2` | `2px` |
| `$spacing-px` | `$s-px3` | `3px` |
| `$spacing-5px` | `$s-px5` | `5px` |
| `$spacing-6px` | `$s-px6` | `6px` |
| `$spacing-7px` | `$s-px7` | `7px` |
| `$spacing-10px` | `$s-px10` | `10px` |
| `$spacing-14px` | `$s-px14` | `14px` |
| `$spacing-18px` | `$s-px18` | `18px` |

**档位（无 px 后缀）**

| 旧长名 | 新短名 | 值 |
|---|---|---|
| `$spacing-1` | `$s-1` | `0.25rem` (4px) |
| `$spacing-2` | `$s-2` | `0.5rem` (8px) |
| `$spacing-3` | `$s-3` | `0.75rem` (12px) |
| `$spacing-4` | `$s-4` | `1rem` (16px) |
| `$spacing-5` | `$s-5` | `1.25rem` (20px) |
| `$spacing-6` | `$s-6` | `1.5rem` (24px) |
| `$spacing-8` | `$s-8` | `2rem` (32px) |
| `$spacing-10` | `$s-10` | `2.5rem` (40px) |
| `$spacing-12` | `$s-12` | `3rem` (48px) |
| `$spacing-16` | `$s-16` | `4rem` (64px) |

### 3.3 字号 / 字重 / 行高

| 旧长名 | 新短名 | 值 |
|---|---|---|
| `$font-size-2xs` | `$t-2xs` | `0.625rem` (10px) |
| `$font-size-xs` | `$t-xs` | `0.75rem` (12px) |
| `$font-size-sm` | `$t-sm` | `0.875rem` (14px) |
| `$font-size-base` | `$t-base` | `1rem` (16px) |
| `$font-size-lg` | `$t-lg` | `1.125rem` (18px) |
| `$font-size-2xl` | `$t-2xl` | `1.5rem` (24px) |
| `$font-size-3xl` | `$t-3xl` | `1.875rem` (30px) |
| `$font-size-4xl` | `$t-4xl` | `2.25rem` (36px) |
| `$font-weight-light` | `$fw-light` | `300` |
| `$font-weight-normal` | `$fw-normal` | `400` |
| `$font-weight-medium` | `$fw-medium` | `500` |
| `$font-weight-semibold` | `$fw-semibold` | `600` |
| `$font-weight-bold` | `$fw-bold` | `700` |
| `$line-height-tight` | `$lh-tight` | `1.25` |
| `$line-height-normal` | `$lh-normal` | `1.5` |
| `$line-height-relaxed` | `$lh-relaxed` | `1.75` |

### 3.4 颜色 `$color-*` → `$c-*`

| 旧长名 | 新短名 | 值 |
|---|---|---|
| `$color-fg` | `$c-fg` | `hsl(24 10% 5%)` |
| `$color-bg` | `$c-bg` | `hsl(55 9% 97%)` |
| `$color-muted` | `$c-muted` | `hsl(30 5% 65%)` |
| `$color-surface` | `$c-surface` | `hsl(45 5% 96%)` |
| `$color-border` | `$c-border` | `hsl(30 6% 88%)` |
| `$color-primary` | `$c-primary` | `hsl(24 9% 10%)` |
| `$color-secondary` | `$c-secondary` | `hsl(45 5% 96%)` |
| `$color-accent` | `$c-accent` | `hsl(35 85% 55%)` |
| `$color-danger` | `$c-danger` | `hsl(0 72% 51%)` |
| `$color-danger-bright` | `$c-danger-bright` | `hsl(0 84.2% 60.2%)` |
| `$color-success` | `$c-success` | `hsl(142 76% 36%)` |
| `$color-warning` | `$c-warning` | `hsl(35 90% 50%)` |
| `$color-info` | `$c-info` | `hsl(217 91% 60%)` |

### 3.5 字体族与断点

| 旧长名 | 新短名 | 值 |
|---|---|---|
| `$font-zh` | `$ff-zh` | 中文字体优先字体栈 |
| `$vp-mono` | `$ff-mono` | `"JetBrains Mono", "Fira Code", "Cascadia Code", "Consolas", monospace` |
| `$mobile-breakpoint` | `$bp-mobile` | `768px` |

> `$vp-radius` / `$vp-mono` 为历史「Codex 增强 Token」，本已全局化。短名体系下二者分别收编为 `$r-base` / `$ff-mono`，使 `vp-` 前缀可专注表达「全局基座类名」（`.vp-dock-root` / `.vp-modal-mask`），不再与 Token 语义重叠。

---

## 四、迁移期约定（重要）

**当前处于双写过渡期**：`variables.scss` 同时导出短名与旧长名，旧长名为等值别名。

| 规则 | 说明 |
|---|---|
| 新代码**必须**用短名 | 旧长名仅作存量兼容，勿在新代码引用 |
| 不得只改一半 | 因全库 315 处 `@use '@/variables.scss' as *`，变量名在编译期解析，改真源会立即影响所有引用方 |
| 双写保证零破坏 | 过渡期内全库可正常编译，产物字节一致 |

### 迁移批次（按风险递增）

| 批 | 组 | 全库用量 | 风险 | 状态 |
|---|---|---|---|---|
| 3.1 | `$line-height-*` → `$lh-*` | 279 | 极低 | ✅ 已完成（280 处） |
| 3.2 | `$font-weight-*` → `$fw-*` | 751 | 极低 | ✅ 已完成（732 处） |
| 3.3 | `$font-size-*` → `$t-*` | 1857 | 低 | ✅ 已完成（1831 处） |
| 3.4 | `$color-*` → `$c-*` | 757 | 低 | ✅ 已完成（746 处） |
| 3.5 | `$radius-*` / `$vp-radius` → `$r-*` | 1211 | 中 | ✅ 已完成（977 处） |
| 3.6 | `$spacing-*` → `$s-*` | **4416** | **高（最大单一组）** | ✅ 已完成（4580 处） |
| 3.7 | `$vp-mono` / `$font-zh` → `$ff-*` | 414 | 低 | ✅ 已完成（421 处） |
| 4 | **删除旧长名别名** | 63 行定义 | 收尾 | ✅ 已完成 |

**迁移完成状态（2026-09-11）**：

- 356 个 `.scss` 文件中的 **9616 处**旧长名已全部替换为短名
- `variables.scss` 中的 63 行旧长名兼容别名**已删除**，短名成为唯一来源
- 全库旧长名残留 **0 处**（`npm run audit:tokens` 验证）
- **345 个 SCSS 入口全部编译通过，0 处未定义变量**（`node scripts/check-scss-compile.mjs` 验证）

### 迁移工具

| 脚本 | 用途 |
|---|---|
| `scripts/migrate-token-shorthand.mjs` | 批量替换。`--group=<lh\|fw\|t\|c\|r\|s\|ff\|all>` 按组替换，`--dry` 只预览。**幂等**，可安全重跑 |
| `scripts/verify-token-migration.mjs` | 正确性校验。基于 `git diff HEAD` 逐行比对，证明「纯重命名、无副作用」 |
| `scripts/audit-token-shorthand.mjs` | 残留扫描（`npm run audit:tokens`），CI 守卫 |
| `scripts/check-scss-compile.mjs` | 全量编译校验（复刻 Vite 的 `@/` 别名 + sass partial 约定） |

**安全设计**（`migrate-token-shorthand.mjs`）：

1. **词边界正则**：`$spacing-1` 不会误命中 `$spacing-10` / `$spacing-1px`。这是本组最大风险——旧名中存在 12 组前缀包含关系（如 `$spacing-10px` ⊃ `$spacing-1`、`$color-danger-bright` ⊃ `$color-danger`）
2. **长名优先排序**：替换对按长度降序执行，避免短名抢先匹配
3. **真源保护**：`variables.scss` 的「旧长名兼容别名」定义行跳过，否则别名会变成自引用（`$radius-sm: $r-sm` → `$r-sm: $r-sm`）
4. **幂等可重跑**：已迁移文件再次运行命中数为 0，中断后可安全续跑
5. **锁文件兜底**：原地写入遇 `EPERM`（被其他进程持锁）时，自动改用「写临时文件 + 原子重命名」

### 每批验证

```bash
node scripts/audit-token-shorthand.mjs        # 残留扫描（应为 0）
node scripts/check-scss-compile.mjs           # 全量编译（应 345/345 通过，0 未定义变量）
git diff HEAD -- src > diff.txt
node scripts/verify-token-migration.mjs diff.txt   # 纯重命名校验
```

> **注意**：校验脚本须用 `git diff HEAD`（而非 `git diff`）——若改动已被暂存，
> 裸 `git diff` 只比较「工作区 vs 暂存区」，会返回空结果造成假通过。

最终验收：`npm run build`（由用户执行）产物 CSS 与迁移前**逐字节一致** —— 纯重命名不应改变任何输出。

> **已验证**：`verify-token-migration.mjs` 对 350 个改动文件（排除真源）逐行折叠比对，
> 结果 **0 处非纯重命名**，证明本次迁移无任何内容副作用。

---

## 五、自动化守卫

`scripts/audit-token-shorthand.mjs`（`npm run audit:tokens`）：检测 `.scss` 中仍在使用的旧长名 Token。

- 真源定义文件（`variables.scss`）的别名段为**例外**，不报警
- **模块本地变量不误报**：命名空间限定的写法（`m.$spacing-2_5`、`stats.$color-tier-epic`）与白名单前缀（superPanel 的 `$spacing-xs/sm/md/lg`、passwordVault 的 `$color-option-size`、statistics 的 `$color-tier-*` / `$color-rank-*`）自动排除
- 退出码 0 = 无残留；1 = 有残留（可用于 CI 门禁）
- `--json` 输出逐条明细

**当前基线**：残留 **0 处**（迁移与别名删除均已完成）。

---

## 六、命名速查（写代码时看这一节）

```scss
// ✅ 新代码
.panel {
  padding: $s-3 $s-4;              // 12px 16px
  border: 1px solid var(--b3-border-color);
  border-radius: $r-base;          // 6px
  font-size: $t-xs;                // 12px
  font-weight: $fw-semibold;       // 600
  color: var(--b3-theme-on-surface, $c-muted);
  font-family: $ff-mono;
  transition: all 0.12s;
}

// ❌ 旧长名（存量兼容，勿新增）
.panel {
  padding: $spacing-3 $spacing-4;
  border-radius: $vp-radius;
  font-size: $font-size-xs;
  font-weight: $font-weight-semibold;
  color: var(--b3-theme-on-surface, $color-muted);
  font-family: $vp-mono;
}
```
