# 文档缺陷修复计划（DOC-FIX）

- 文档日期：2026-11-01
- 代码基线：提交 `eab5085e`（2026-10-31）
- 对象：`AGENTS_STYLE.md`（26KB）、`src/components/kit/variables.scss`、`docs/` 归档台账、
  `src/features/gitPush/*`、`src/features/superPanel/*`（注释引用）
- 依据：2026-11-01 的 docs 目录治理与静态校验（见 [README.md](./README.md)「已知文档缺陷」）
- 性质：**静态分析，未跑 build / lint**（遵循 `AGENTS.md` 对 AI 的禁令）；本文所有数字均可用文末脚本复算
- 状态：**待执行**。项目当前无未完成的功能计划，本文件是 `docs/` 根下唯一的活跃计划

## 零、摘要

| ID | 缺陷 | 严重度 | 工作量 | 状态 |
|---|---|---|---|---|
| **DOC-1** | `AGENTS_STYLE.md` 的设计 Token 名 **100% 失效**：其中 43 个完整旧变量名在 `variables.scss`（67 个变量、短名制）中全部不存在 | **P0**，照文档写代码必然编译失败 | 1 次脚本替换 + 12 章节复核 + 静态校验 | 仅止血（已加警告块），**未迁移** |
| DOC-2 | `variables.scss` 文件头注释写 `docs/token-shorthand.md`，实际在 `docs/参考/` | P2，路径点不开 | 1 行 | 待修 |
| DOC-3 | 10 份审查报告被删除未归档（台账在 README 第三节） | P3，仅影响追溯 | 按需 | 台账已建，**不计划恢复** |
| DOC-4 | `AGENTS_BUILD.md` 要求"登记到 `docs/` 审查报告"但无命名/归档约定 | P2 | 已随新规则落地 | ✅ 已处理，待用户确认 |

**DOC-1 规模（口径：`variables.scss` 中找不到定义的 `$名字`，可用文末脚本复算）**

| 指标 | 数值 |
|---|---|
| 文档中 `$变量` 引用总次数 | 145 |
| 其中能在 `variables.scss` 找到定义 | 2（文中已有个别新名） |
| **找不到定义（需处理）** | **60 个唯一名**，按性质拆解如下 |

| 性质 | 唯一名 | 出现次数 | 处理方式 |
|---|---|---|---|
| 完整旧变量名 | **43** | 123 | 按附录 A 唯一映射机替 |
| 反例（`$spacing-xs/sm/md/lg`，文档明确说"不存在"） | 4 | 7 | 机替为 `$s-xs/sm/md/lg`——**新体系同样不存在，反例语义不变** |
| 前缀占位符（`$color-*` 这类说明文字） | 12 | 13 | 旧前缀 6 个换新，已属新前缀的 6 个不动 |
| 通用占位符 `$xxx` | 1 | 1 | 不动（示意用） |

---

## 一、DOC-1：`AGENTS_STYLE.md` Token 名迁移

### 1.1 问题与证据

`src/components/kit/variables.scss` 文件头自述（原文）：

> 命名规范（短名制，2026-09 起全库统一；**旧长名已全部移除，不保留别名**）：
> `$c-*` 颜色 `$ff-*` 字体族 `$t-*` 字号 `$fw-*` 字重 `$lh-*` 行高 `$r-*` 圆角 `$s-*` 间距 `$bp-*` 断点

而 `AGENTS_STYLE.md` 通篇仍是旧长名（`$spacing-*` 42 次、`$font-size-*` 27 次、`$color-*` 14 次、
`$radius-*` 12 次、`$vp-radius` 7 次…），**零处使用新短名**。

**影响**：AI 与开发者按本文写 SCSS → `Undefined variable` 编译失败；而 `AGENTS.md` 的规则分片索引
明确把 `AGENTS_STYLE.md` 指为"编写或审查 SCSS 样式时"的必读文件，等于每次都会踩。

**为什么必须修而不是删**：它是**强制规则文件**，不是历史记录；UI 规范（Codex 风格、禁止事项、
组件模式库 `.vp-*`、字号层级）仍有效，只有变量名部分过期。

### 1.2 关键结论：反例替换后依然成立

初判"不能脚本盲替"的理由是文中存在「错误 → 正确」对照表。逐条核对后**该理由不成立**：

| 位置 | 现文 | 替换后 | 是否仍正确 |
|---|---|---|---|
| 第 86 行 | "上述变量名是 `$spacing-1`~`$spacing-4`，**不是** `$spacing-xs`~`$spacing-lg`。`$spacing-xs/sm/md/lg` 是 superPanel 本地别名，不存在于全局" | "…是 `$s-1`~`$s-4`，**不是** `$s-xs`~`$s-lg`。`$s-xs/sm/md/lg` 是本地别名，不存在于全局" | ✅ 成立——`$s-xs` 在新体系同样不存在，反例语义不变 |
| 第 199 行 | 表格 `\| $spacing-xs / $spacing-sm / $spacing-md / $spacing-lg \| $spacing-1 / $spacing-2 / $spacing-3 / $spacing-4 \|` | `\| $s-xs / $s-sm / $s-md / $s-lg \| $s-1 / $s-2 / $s-3 / $s-4 \|` | ✅ 成立——左列仍是"不存在的错误写法" |

**因此 60 个未定义名全部可处理**——43 个走唯一映射，12 个按前缀规则换，4 个反例换后仍成立，1 个示意符不动；
只需事后复核第 86、199 这两行的措辞是否通顺。

### 1.3 修复步骤

```powershell
# 0) 备份（文件不在 git 忽略范围，但仍先留一份便于逐字 diff）
Copy-Item AGENTS_STYLE.md AGENTS_STYLE.md.bak

# 1) 机替 43 个有唯一新名的变量（映射见附录 A，按「长名优先」排序替换，避免 $radius-px 被 $radius- 先吃掉）
#    注意顺序：先替换更长的名字（$spacing-2px 在 $spacing-2 之前）
# 2) 机替前缀占位符：$color-* → $c-* · $font-size-* → $t-* · $font-weight-* → $fw-* ·
#    $line-height-* → $lh-* · $spacing-* → $s-* · $radius-* → $r-*（仅用于"$xxx-*"这类说明文字）
# 3) 机替反例：$spacing-xs/sm/md/lg → $s-xs/sm/md/lg（仅第 86、199 行）
# 4) 复核 12 个章节（§1.4），确认每处替换后语义通顺
# 5) 跑 §1.5 静态校验，必须 0 未定义
```

**替换顺序必须注意的坑**：`$radius-px`→`$r-px3`、`$spacing-2px`→`$s-px2` 这类带 `px` 的特例，
若先做前缀级替换（`$radius-`→`$r-`）会得到 `$r-px`（不存在）。**先替换完整变量名，再处理前缀占位符**。

### 1.4 按章节复核清单（12 节，按旧名数量降序）

| 章节 | 旧名次数 | 复核要点 |
|---|---|---|
| 全局设计 Token（真源…） | 49 | 变量定义清单 + 每行行尾注释（`// 4px 标签/徽章`）；这一节是主要工作量 |
| 禁止事项 | 26 | 全是"硬编码 → Token"对照表，左右列都要换；第 199 行反例见 §1.2 |
| `.vp-*` 组件模式库 | 16 | 代码块内的 `$spacing-*`/`$radius-*`，替换后要保证仍是可编译的 SCSS 片段 |
| 审查检查点（新增/修改 SCSS） | 8 | 文字描述里嵌的变量名 |
| 核心规范速查表 | 6 | 表格单元格内的变量名 |
| Codex 增强 Token | 5 | `$vp-mono` → `$ff-mono`、`$vp-radius` → `$r-base` |
| 规则 | 4 | 编号列表里的变量名 |
| 组件 size 档位字号阶梯 | 4 | `$font-size-*` → `$t-*` |
| 两级字号制 | 3 | 同上 |
| 参考实现 | 3 | 示例代码里的 `padding: $spacing-3 …` |
| 全局基准字号机制 | 2 | CSS 变量桥接 `--vp-font-size-xs: #{$font-size-xs}` → `#{$t-xs}` |
| 审查检查点 | 2 | 同"规则"节 |

### 1.5 验收（纯静态，不违反 build/lint 禁令）

```bash
# ① 校验：AGENTS_STYLE 里每个 $变量 都必须在 variables.scss 中定义
python - <<'PY'
import re
defs = set(re.findall(r"^\$([\w-]+)\s*:", open("src/components/kit/variables.scss", encoding="utf-8").read(), re.M))
used = set(re.findall(r"\$([a-zA-Z][\w-]*)", open("AGENTS_STYLE.md", encoding="utf-8").read()))
missing = sorted(u for u in used if u not in defs)
print("未定义:", missing)
PY
# 期望：只剩 $s-xs/$s-sm/$s-md/$s-lg（反例）与 $xxx（占位符）

# ② 反向校验：不该再有旧名残留
grep -nE '\$(spacing|radius|font-size|font-weight|line-height|color)-|vp-(radius|mono)' AGENTS_STYLE.md
# 期望：仅第 86、199 行反例处命中 $s-xs 等（旧名应 0 命中）

# ③ 抽查：代码块里的 SCSS 片段能否编译——取 3 处代表性片段（Token 定义块、.vp-* 模式库、
#    参考实现的 .gpr-panel），把变量与 variables.scss 对照，确认名字与值语义一致
```

**通过标准**：① 输出只剩 5 个已知例外；② 旧名 0 命中；③ 3 处抽查无 `Undefined variable` 风险。

### 1.6 风险

| 风险 | 后果 | 缓解 |
|---|---|---|
| 值语义错配（`$spacing-2`=8px 换成 `$s-3`=12px） | 文档教出错误尺寸，比"编译失败"更难发现 | 严格按附录 A 的**唯一映射**替换，不手工推断；`$s-N` 与 `$spacing-N` 档位同名同值 |
| 前缀级替换先于完整名替换 | 产出 `$r-px`、`$s-2px` 等不存在的名字 | 见 §1.3 的顺序要求；替换后跑 ① 校验即可暴露 |
| 行尾注释里的尺寸说明与变量值不符 | 误导 | 替换时顺带核对：`$s-2: 0.5rem (8px)`，注释写 8px 才留 |
| 未跑 build，SCSS 语法错误漏检 | 文档不可用 | ③ 抽查专看代码块；**真正落地时由用户跑一次 `pnpm build` 兜底** |

---

## 二、DOC-2：`variables.scss` 注释路径

**现状**：`src/components/kit/variables.scss` 文件头第 12 行写 `// 完整映射表见 docs/token-shorthand.md`，
实际文件在 `docs/参考/token-shorthand.md`（2026-10-28 `caec10a5` 移动导致）。

**修法**：改为 `docs/参考/token-shorthand.md`。一行注释，无构建影响。

**为什么不顺手改**：本轮只做文档治理，未动源码；下次改样式相关代码时一并带上即可（避免为一行注释单独提交）。

---

## 三、DOC-3：10 份未归档的审查报告

**现状**：`caec10a5` 删除的 20 份中，10 份仍被引用已恢复（见 [README.md](./README.md) §二），
另 10 份（`hardcode-audit` 894 行、`shared-component-usage-audit` 666 行等）当前零引用，未恢复。

**决策：不恢复**。理由：它们描述的问题已被后续实现覆盖，恢复只会重新堆积；
台账里保留了文件名、行数与 `git show caec10a5^:docs/<name>` 取回命令，需要时可单份取。

**触发条件**：若日后排查某功能"当初为什么这么改"，先查台账；确实需要时再取单份到 `docs/completed/`。

---

## 四、DOC-4：审查报告登记约定（已处理）

原状：`AGENTS_BUILD.md` 要求"按仓库约定登记到 `docs/` 审查报告"，但仓库没有命名与归档约定，
导致报告堆在 `docs/` 根、下次清理时被一份份 `rm`。

2026-11-01 已在 `AGENTS.md`「文档规范（docs，强制）」补上：命名 `<模块>-<类型>.md`
（`review` / `audit` / `diagnosis` / `implementation`），放 `docs/` 根，处理完后 `git mv` 进 `docs/completed/`
并在 `docs/README.md` 归档表登记引用点。

**待确认**：`AGENTS_BUILD.md` 第 77 行原文是否要同步补一句指向新约定（避免读者只看单份分片）。

---

## 五、执行顺序

| 步 | 内容 | 前置 | 验收 |
|---|---|---|---|
| 1 | DOC-1 备份 + 脚本替换 43 个完整变量名 | — | `grep` 抽查 10 处 |
| 2 | DOC-1 替换 13 个前缀占位符 + 2 行反例 | 步 1 完成 | 旧名 `grep` 0 命中 |
| 3 | 按 §1.4 逐节复核（12 节） | 步 2 | 每节过一遍，记录改动处数 |
| 4 | 跑 §1.5 静态校验 | 步 3 | 只剩 5 个已知例外 |
| 5 | 删备份文件；更新 `docs/README.md` 的 DOC-1 状态为「已修」并写日期 | 步 4 | 索引与实际一致 |
| 6 | （可选）用户跑 `pnpm build` 兜底 | 步 5 | 构建通过 |

**本文件自身的归档**：DOC-1~DOC-4 全部处理完（或明确不做）后，按 `docs/README.md` 规则移入
`docs/completed/`，并在索引表登记。

---

## 六、完成定义

- [ ] `AGENTS_STYLE.md` 中每个 `$变量` 都能在 `variables.scss` 找到定义（反例 4 个除外）
- [ ] 旧长名 0 命中（`$spacing-|$radius-|$font-size-|$font-weight-|$line-height-|$color-|$vp-radius|$vp-mono`）
- [ ] 12 个章节逐节复核完毕，`.vp-*` 模式库与参考实现的 SCSS 片段语义正确
- [ ] `AGENTS_STYLE.md` 顶部的警告块删除（迁移完成后不需要了）
- [ ] `docs/README.md` 的 DOC-1 状态更新，本文档归档
- [ ] （用户执行）`pnpm build` 通过

---

## 附录 A：43 个变量的唯一映射（按长度降序替换）

> 恰好 43 条，与 §零 的口径一致。`variables.scss` 里还有文档未出现的档位（`$r-px1`、`$s-px10/14/18`、
> `$t-2xl/3xl/4xl`、`$r-0/2xl/xl` 等），完整对照见 [参考/token-shorthand.md](参考/token-shorthand.md)，
> 将来新增内容时按那张表取，不要在这里临时造名。

| 旧名 | 新名 | 旧名 | 新名 |
|---|---|---|---|
| `$vp-mono` | `$ff-mono` | `$spacing-1` | `$s-1` |
| `$vp-radius` | `$r-base` | `$spacing-2` | `$s-2` |
| `$color-fg` | `$c-fg` | `$spacing-3` | `$s-3` |
| `$color-bg` | `$c-bg` | `$spacing-4` | `$s-4` |
| `$color-muted` | `$c-muted` | `$spacing-5` | `$s-5` |
| `$color-surface` | `$c-surface` | `$spacing-6` | `$s-6` |
| `$color-border` | `$c-border` | `$spacing-8` | `$s-8` |
| `$color-primary` | `$c-primary` | `$spacing-16` | `$s-16` |
| `$color-secondary` | `$c-secondary` | `$font-size-2xs` | `$t-2xs` |
| `$color-accent` | `$c-accent` | `$font-size-xs` | `$t-xs` |
| `$color-danger` | `$c-danger` | `$font-size-sm` | `$t-sm` |
| `$color-danger-bright` | `$c-danger-bright` | `$font-size-base` | `$t-base` |
| `$color-success` | `$c-success` | `$font-size-lg` | `$t-lg` |
| `$color-warning` | `$c-warning` | `$font-weight-light` | `$fw-light` |
| `$color-info` | `$c-info` | `$font-weight-normal` | `$fw-normal` |
| `$radius-sm` | `$r-sm` | `$font-weight-medium` | `$fw-medium` |
| `$radius-base` | `$r-base` | `$font-weight-semibold` | `$fw-semibold` |
| `$radius-md` | `$r-md` | `$font-weight-bold` | `$fw-bold` |
| `$radius-lg` | `$r-lg` | `$line-height-tight` | `$lh-tight` |
| `$radius-full` | `$r-full` | `$line-height-normal` | `$lh-normal` |
| `$spacing-2px` | `$s-px2` | `$line-height-relaxed` | `$lh-relaxed` |
| `$spacing-px` | `$s-px3` | — | — |

**两个必须注意的特例**（不是简单换前缀）：

| 旧名 | 新名 | 为什么特殊 |
|---|---|---|
| `$spacing-px` | `$s-px3` | 旧名 `-px` 后缀语义混乱：值其实是 **3px**，新体系叫 `$s-px3`。换前缀会得到不存在的 `$s-px` |
| `$radius-base` / `$vp-radius` | 都是 `$r-base` | 两个旧名指向同一新名（历史别名收编） |

## 附录 B：4 个反例（保留"不存在"的语义）

| 现文 | 替换后 | 说明 |
|---|---|---|
| `$spacing-xs` | `$s-xs` | superPanel 本地别名，全局不存在；替换后仍不存在，反例有效 |
| `$spacing-sm` | `$s-sm` | 同上 |
| `$spacing-md` | `$s-md` | 同上 |
| `$spacing-lg` | `$s-lg` | 同上 |

## 附录 C：13 个前缀占位符

`$color-*` → `$c-*` · `$font-size-*` → `$t-*` · `$font-weight-*` → `$fw-*` ·
`$line-height-*` → `$lh-*` · `$spacing-*` → `$s-*` · `$radius-*` → `$r-*` · `$font-*` → `$ff-*`

（仅用于"`// 颜色（$color-*）`"这类说明文字的替换；**必须先完成附录 A 的完整变量名替换**，
否则 `$spacing-` 会把 `$spacing-2px` 提前吃成 `$s-2px`。）
