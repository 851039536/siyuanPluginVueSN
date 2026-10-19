# 资源管理模块 —— 冗余重复专项审查报告

审查对象：`src/features/resourceManager/`（重构前 **26 个文件 / 4338 行**）
对照范围：`src/components/`（共享组件库）、`src/utils/`（共享工具层）、`src/i18n/`
审查依据：`AGENTS.md § 功能模块内代码分层` / `§ 硬规则`、`AGENTS_ARCH.md § Composable 提取` / `§ Composable 模式要求` / `§ 单文件行数上限`、`AGENTS_STYLE.md § SCSS 必须分离到 styles/ 目录` / `§ 背景与过渡对齐 gitPush 范式`
审查日期：2026-10-19
整改状态：**✅ 已全部实施**

---

## 一、结论摘要

| 级别 | 项数 | 说明 |
|---|---|---|
| P1 结构超标 | 1 | `useResourceManager.ts` **607 行**，超 500 行硬阈值（"必须优化"） |
| P1 真实缺陷 | 1 | `loadAssets` 代际校验与 in-flight Promise 复用冲突，重复刷新丢弃有效数据 |
| P2 死代码 | 3 | 死 i18n 键 `confirmMove`、死函数 `buildNameFallbackPairs`、死 CSS 2 条 |
| P2 重复 | 2 | 弹窗外壳三重复制（≈90 行）、`form-input` 声明二次复制（≈15 行） |
| P3 冗余机制 | 3 | 加载双胞胎、占位符插值两种写法、跨层反向改写子 composable 状态 |
| P3 无效计算 | 2 | `CompressResult.compressionRatio`/`timeTaken`、统计 MB 字段无人消费 |
| P3 规则偏离 | 1 | 4 个 composable 位置参数，违反 deps 对象注入规范 |
| P4 微项 | 4 | 纯转发包装、不可达 `disabled`、多余导出、永不传入的形参 |

**总体判断**：本模块的 composable 分层、请求代际令牌、引用自愈（文件名兜底）等设计是可靠的，上一轮审查（`.codebuddy/plans/resourceManager_代码审查与修复`）的 6 项修复均在位、无回归。本次问题的性质是**长期演进留下的结构性沉积**，而非设计错误：

1. **单文件越界**：`useResourceManager` 同时承担「页签/加载/筛选」「删除」「分类」「移动（含全库引用更新）」「压缩编排」「重建索引」六件事，607 行中移动链路独占 167 行且内聚度高（仅依赖三个路径 ref + 分类落盘），属典型的可提取子领域。
2. **复制粘贴型重复**：三个弹窗（移动/分类设置/预览）各写一份遮罩、关闭按钮、fade 过渡；`MoveAssetDialog.scss` 又把 `index.scss` 的 `form-input` mixin 逐字重抄一遍——而共享层本来就有 mixin 可用。
3. **过度兜底导致的无用数据**：压缩结果携带 `compressionRatio`/`timeTaken`，统计对象额外算两个 MB 字段，但 UI 从未读取。这类字段会被误认为契约的一部分，后续维护者不敢删。

---

## 二、P1：结构超标与真实缺陷

### F1. `useResourceManager.ts` 607 行，超硬阈值

AGENTS_ARCH.md 的分级标准：300~500 行「需要关注」，**500~1000 行「严重超标，强烈建议拆分」**，且「500 行是必须优化的硬阈值」。

该文件职责清单：

| 区块 | 行数（重构前） | 独立性 |
|---|---|---|
| 页签/加载/筛选/生命周期 | 1–117, 196–267 | 核心 |
| 删除（未使用资源） | 269–305 | 依赖 allAssetPaths |
| 分类删除/恢复 | 307–337 | 薄封装（实际逻辑在 useCategoryManager） |
| **移动（表单 + 磁盘 + 全库引用更新）** | **339–505** | **内聚子领域** |
| 重建索引 | 507–530 | 独立 |
| 压缩编排 | 144–194 | 薄封装（实际逻辑在 useImageCompress） |

**整改**：抽出 `composables/useAssetMover.ts`（242 行），把移动表单状态、磁盘重命名、引用更新、成功后路径同步整体迁出，以 deps 对象注入 `{ i18n, showMsg, isMounted, allAssetPaths, missingAssets, unusedAssets, addCustomCategory }`。`useResourceManager` 607 → **449 行**（回到 300~500 的「可接受」区间）。

### F2. `loadAssets` 代际校验与请求复用冲突（真实缺陷）

```ts
// 重构前
let assetLoadPromise: Promise<void> | null = null
async function loadAssets(token: number) {
  if (assetLoadPromise) return assetLoadPromise   // ← 返回的是**旧**调用创建的 Promise
  assetLoadPromise = (async () => {
    ...
    if (!isMounted.value || token !== requestToken) return   // ← 闭包里捕获的是旧 token
    allAssetPaths.value = [...]
  })()
}
```

`refresh()` 每次自增 `requestToken` 后调用 `loadAssets(token)`。当第一次扫描仍在飞行中时再次刷新（或快速切页签触发 refresh），第二次调用命中 `assetLoadPromise` 短路，**返回的是第一次调用创建的 Promise**——其闭包捕获的是**第一次的 token**。扫描结束时 `token !== requestToken` 成立，结果被丢弃；而 `loading` 由第二次 refresh 的 `finally` 正常置 false。

**用户可见后果**：列表空白且无加载态，须再点一次刷新才恢复。属「守卫本意是防脏写，实际把有效数据也拦掉了」。

**整改**：`loadAssets()` 去掉 `token` 形参与该判定。资源集合与代际无关（同一份磁盘 + 同一张 assets 表），卸载防护由 `isMounted` 承担；`missingAssets`/`unusedAssets` 的加载器保留 token（它们依赖页签语义，需防跨页签覆盖）。

> 区分依据：F2 是**逻辑冗余**（守卫在错误的层级上重复了 token 语义），不是功能增强，故计入本次冗余审查范围。

---

## 三、P2：死代码

### F3. i18n 键 `confirmMove` 零引用

`MoveAssetDialog` 的底部操作栏早期有「确认移动」按钮，后改为「即时移动」语义（选分类 / 输入路径回车即执行，仅保留取消），按钮被删，但键与类型字段残留：

| 位置 | 内容 |
|---|---|
| `src/i18n/zh_CN/resourceManager.json:34` | `"confirmMove": "确认移动"` |
| `src/i18n/en_US/resourceManager.json:34` | `"confirmMove": "Confirm Move"` |
| `types/index.ts:36` | `confirmMove: string` |

全仓 `grep confirmMove` 仅命中这三处 → **死键**。整改：三处删除 + `pnpm i18n:merge` 重生成合并产物。

> ⚠️ **`description` 不是死键**：它由 `src/features/config.ts:210` 的 `descI18nKey: "resourceManager.description"` 消费（超级面板功能列表），必须保留。上一轮审查曾把它从 `ResourceManagerI18n` 接口移除（面板自身不读），但 i18n 分片中的键仍在服务 FEATURE_CONFIG——两者不冲突。

### F4. `buildNameFallbackPairs` 与 `buildVariantPairs` 实现逐字相同

```ts
// utils.ts:167-198（重构前）—— 两个函数除形参名外逐行一致
export function buildVariantPairs(from, to) {
  const seen = new Set<string>(); const pairs = []
  for (const transform of PATH_ENCODING_TRANSFORMS) {
    const f = transform(from); if (seen.has(f)) continue; seen.add(f)
    pairs.push({ from: f, to: transform(to) })
  }
  return pairs
}
export function buildNameFallbackPairs(baseName, newPath) { /* 同上，仅形参改名 */ }
```

原注释声称「**不可复用 buildVariantPairs**——其 from/to 共享同一变换，而此处 from 为文件名、to 为完整路径，语义不同源，直接复用会产出错误形态的替换目标」。**该注释与代码事实不符**：两个函数都把同一个 `transform` 分别施加到 `from` 与 `to` 上——「from 是文件名、to 是完整路径」是**调用方**的入参差异，与函数实现无关。也就是说 `buildNameFallbackPairs(baseName, newBase)` ≡ `buildVariantPairs(baseName, newBase)`。

整改：删除 `buildNameFallbackPairs`，`useAssetMover.updateAssetReferences` 改调 `buildVariantPairs(baseName, newBase)`，并删除错误注释。

> 这是本次审查中「注释误导导致重复」的典型个案：注释不仅没阻止重复，反而为重复提供了理由。

### F5. 两条死 CSS 规则

| 规则 | 位置 | 判定依据 |
|---|---|---|
| `.rm-filter-bar .rm-btn.active` | `styles/index.scss:225-229` | 分类 chips 已迁入 `CategoryFilterBar` 子组件，`.rm-filter-bar` 现仅含「加载数量」标签 + `input`，无任何 `.rm-btn` 子孙；活副本在 `CategoryFilterBar.scss:12`（挂在 `.rm-category-bar` 下） |
| `.rm-asset-item__action-group { &--primary }` | `styles/index.scss:211-213` | 全模块 grep `action-group--primary` 零命中；`DocAssetsSection.vue:72` 仅用基类 `rm-asset-item__action-group` |

---

## 四、P2：重复实现

### F6. 弹窗外壳三重复制

三个 `Teleport` 弹窗各自手写同一套外壳：

| 组成 | MoveAssetDialog | CategorySettingsDialog | index.vue 预览层 |
|---|---|---|---|
| 全屏遮罩（fixed/inset/z-10000/flex 居中/rgba .5） | `.rm-move-mask` | `.rm-settings-mask` | `.rm-preview-mask` |
| 16px 图标关闭钮（含 hover） | `.rm-move-dialog__icon` | `.rm-settings-icon` | `.rm-preview-panel__close` |
| fade 过渡 | `.rm-move-fade-*` | `.rm-settings-fade-*` | `.rm-preview-fade-*` |

三份遮罩声明逐字相同（`.rm-settings-mask` 仅少一行 `padding`）；三处关闭钮逐字相同；三处过渡中 `rm-settings-fade` 有 `scale(0.98)`，另两处**缺失**——而 `AGENTS_STYLE.md` 明确要求「过渡统一 0.12s ease：fade + 内层 scale 0.98」。

**整改**：新增 `styles/_mixins.scss`（**纯 mixin，无顶层选择器**，符合 `_` 前缀规则）：

| mixin | 来源 |
|---|---|
| `text-ellipsis` / `custom-scrollbar` / `form-input` | 从 `index.scss` 顶部逐字迁出 |
| `dialog-mask` | 从 `.rm-move-mask` 逐字提取 |
| `dialog-close-btn` | 从 `.rm-move-dialog__icon` 逐字提取（三处原本逐字相同，故无差异声明） |
| `dialog-fade($panel)` | fade + `#{$panel} { scale(0.98) }`，供三处过渡共用 |

三处 SCSS 改为 `@include`，**类名与 Transition name 零改动**（`.vue` 一行未改）。`CompressDialog.vue` 复用 `.rm-move-*` 与 `rm-move-fade`，同样零改动。

> 子组件不再 `@use "../styles/index.scss"`（与 diskBrowser F11 同型问题）：`index.scss` 含真实选择器且只服务 `index.vue`，子组件引入会把整套面板样式重复发射。本次新增的 `_mixins.scss` 是纯 mixin 载体，正是为规避这一点。

### F7. `form-input` 声明二次复制

`MoveAssetDialog.scss` 的 `&__input` 有 15 行与 `index.scss` 的 `form-input` mixin **逐字相同**（padding/border/radius/font-size/background/color/outline/transition/focus/placeholder）。同一个 mixin 在同一个 feature 内被手抄一遍——典型的「共享能力已存在却未复用」。

整改：`&__input` 改 `@include form-input;` 后再写 `width: 100%; min-width: 0;`（顺序保证覆盖生效），`&--inline` 保留。

---

## 五、P3：冗余机制与无效计算

### F8. 加载双胞胎

`loadMissingAssets` / `loadUnusedAssets` 结构完全一致（try → await API → `isMounted && token === requestToken` 校验 → 写 ref → catch 提示），仅 API、目标 ref、日志标签不同。

整改：合并为 `loadAssetList(token, fetcher, target, logLabel)`，两处各留一行调用；删除处理器中的重载同样复用。

### F9. 占位符插值两种写法散落 4 处

| 位置 | 写法 |
|---|---|
| `useImageCompress` | 本地 `fill(template, values)`（split/join，注释说明替代 replaceAll） |
| `useResourceManager:317` | `t(i18n.deleteCategoryConfirm).replace("{cat}", label)` |
| `useResourceManager:491-493` | `t(i18n.updatedRefs).replace("{count}", ...)` + `t()` 兜底 |
| `useAssetLocator:75` | `(i18n.locateRefs ?? "").replace("{count}", ...)` |

同一语义（`{key}` 占位符 + 缺失文案兜底）四种实现，且 `.replace` 只能替换首个占位符（若文案含同名占位符两次即为缺陷）。

整改：`utils.ts` 新增纯函数 `fillTemplate(template?, values = {})`（split/join，兼容 undefined），上述 4 处 + `useAssetMover` 新代码统一调用；`useResourceManager` 的 `t()` helper 随之删除（`fillTemplate(undefined)` 即返回空串，语义等价）。

### F10. 压缩选中态由父层跨层反向改写

```ts
// useResourceManager.ts:174-179（重构前）
function onCompressReplaced(paths: string[]) {
  const replaced = new Set(paths)
  selectedCompressPaths.value = new Set(
    [...selectedCompressPaths.value].filter((p) => !replaced.has(p)),
  )
}
```

选中集合的所有权在 `useImageCompress`（它还持有 `mutateSelection` 这一「整替引用」的唯一正确写法），但父层拿到 `replaceOriginals` 的回调后**直接重建了子 composable 的 ref**。父层因此必须了解子层「Set 必须整体替换」的实现细节——一旦子层换存储结构即静默失效。

整改：`replaceOriginals()` 去掉 `onReplaced` 参数，写回成功后内部 `mutateSelection` 剔除已替换路径；父层 `onCompressReplaced` 与 `handleReplaceOriginals` 中的传参一并删除。

### F11. 无效计算：压缩结果与统计的无用字段

| 字段 | 写入 | 读取 |
|---|---|---|
| `CompressResult.compressionRatio` | `compressor.ts:63,72` | **0 处**（统计走 `getCompressStats` 重算 `averageRatio`，不读单项） |
| `CompressResult.timeTaken` | `compressor.ts:73` | **0 处** |
| `stats.totalOriginalSizeMB` | `compressor.ts:184` | **0 处**（UI 只用 `totalSavedMB`） |
| `stats.totalCompressedSizeMB` | `compressor.ts:185` | **0 处** |

`compressionRatio` 的注释还写着「统一保留两位，避免统计面板出现 33.33333333333333%」——但统计面板的 `averageRatio` 由 `getCompressStats` 自己计算并 `toFixed(2)`，与该字段无关。属「为不存在的消费方做的正确性处理」。

整改：删除这 4 个字段的写入与类型声明（保留 `originalSize`/`compressedSize`/`totalOriginalSize`/`totalCompressedSize`/`totalSaved` 作为派生依据）；`EMPTY_STATS` 注释中的字段数 11 → 8。

### F12. composable 位置参数偏离 deps 注入规范

`AGENTS_ARCH.md § Composable 模式要求`：「所有外部依赖必须通过 `deps` 对象传入」。diskBrowser 审查 F15 已就同型问题整改过，本模块 4 个 composable 仍为位置参数：

```ts
useCategoryManager(plugin, i18n, getAssetPaths)   // 3 个位置参数，第三个是函数，易错位
useAssetLocator(i18n, showMsg)
useAssetActions(i18n, showMsg)
useImageCompress(imagePaths, i18n, showMsg)
```

整改：全部改 deps 对象（新增的 `useAssetMover` 直接按规范写），调用点同步。

---

## 六、P4：微项

| 位置 | 冗余 | 整改 |
|---|---|---|
| `AssetGridList.vue:179-182` | `function onToggleSelect(path) { props.onToggleSelect(path) }` 纯转发包装（template 可直接落到 prop） | 删除包装 |
| `index.vue:245` | 「删除所有未使用资源」按钮的 `:disabled="unusedAssets.length === 0"` 永假——外层 `v-if="unusedAssets.length > 0 && !loading"` 已排除 | 删除 `:disabled` |
| `utils.ts` | `escapeSqlLike` / `assetFileExists` 仅本文件内消费却 `export` | 去掉 `export`，收敛导出面 |
| `useResourceManager.showMsg(msg, timeout = 3000)` | `timeout` 形参全模块**从未被传入**；且 `3000` 属 `docs/hardcode-audit.md §5.9` 登记的魔法数字 | 删除形参，提取 `MESSAGE_TIMEOUT_MS = 3000` |

---

## 七、有意保留（审查结论：不算冗余）

| 项 | 判定 |
|---|---|
| `handleDeleteCategory` 先 `isCategoryEmpty` 预检、`deleteCategory` 内部再检一次 | **TOCTOU 防御**：预检用于在确认框前拦截，内部复检防「确认期间目录被写入」；两次读目录的代价可接受 |
| `useDocAssets` 的 `disposed` 标志 + `requestToken` 双保险 | `onUnmounted` 时同时置 `disposed` 并自增 token，二者语义不同（前者防卸载后写状态，后者防乱序） |
| `batchCompressImages` / `batchReplaceImages` 的串行循环 | 两处分别为「压缩」「写回」，循环体不同、进度回调签名不同；Rule of Two，暂不抽象 |
| `AssetGridList` 的 `fileExtName` 本地实现 | 仅 4 行、单消费者，且与 `getImageMimeType` 的扩展名解析语义不同（前者返回大写展示串，后者查 MIME 表） |
| `buildPathVariants` 与 `buildVariantPairs` 并存 | 前者返回「同一路径的多种编码形态」（用于查询），后者返回「新旧配对」（用于替换），消费点语义确实不同 |
| `escapeSqlString` / `escapeSqlLike` 分列 | 前者用于 `=` 等值（仅需处理引号与反斜杠），后者用于 `LIKE`（额外转义 `%`/`_` 并依赖 `ESCAPE '\'`），转义面不同不可合并 |
| 子组件双行导入 `index.scss` | 本次整改后三个弹窗组件仍按 `AGENTS_STYLE.md` 规则 5 双行导入（自身 SCSS + index.scss）；`index.scss` 已瘦身至 420 行且新增 `_mixins.scss` 承载纯 mixin，符合规范 |

---

## 八、整改清单

| 文件 | 动作 |
|---|---|
| `composables/useAssetMover.ts` | **新增**（242 行）：移动表单状态 + 磁盘重命名 + 全库引用更新 + 成功后路径同步 |
| `composables/useResourceManager.ts` | 607 → **449 行**：迁出移动段、合并加载器、`fillTemplate` 替换 `t()`、`loadAssets` 代际修复、压缩选中释放内聚、`MESSAGE_TIMEOUT_MS` |
| `composables/useImageCompress.ts` | deps 签名、删除本地 `fill`、`replaceOriginals` 内部释放选中态 |
| `composables/useCategoryManager.ts` / `useAssetLocator.ts` / `useAssetActions.ts` | deps 对象签名；locator 改用 `fillTemplate` |
| `utils.ts` | 新增 `fillTemplate`；删 `buildNameFallbackPairs`；`escapeSqlLike`/`assetFileExists` 去导出 |
| `services/compressor.ts` | 删 `compressionRatio`/`timeTaken` 计算，删 2 个统计 MB 字段 |
| `types/index.ts` | 删 `confirmMove` / `compressionRatio` / `timeTaken` |
| `components/AssetGridList.vue` | 删纯转发包装 |
| `index.vue` | 删不可达 `:disabled` |
| `styles/_mixins.scss` | **新增**（108 行）：5 个纯 mixin |
| `styles/index.scss` | 497 → **420 行**：改引 `_mixins.scss`、删 3 个 mixin 定义、删 2 条死规则、预览层复用弹窗基座 |
| `styles/MoveAssetDialog.scss` | 190 → **148 行**：遮罩/关闭钮/输入/过渡改 mixin |
| `styles/CategorySettingsDialog.scss` | 164 → **131 行**：同上 |
| `src/i18n/{zh_CN,en_US}/resourceManager.json` | 删 `confirmMove` |
| `src/i18n/{zh_CN,en_US}.json` | `pnpm i18n:merge` 重生成 |
| `src/features/resourceManager/README.md` | 同步文件结构与职责描述 |
| `docs/hardcode-audit.md` | 标注 resourceManager 超时魔法数字已改具名常量 |

---

## 九、验证结果

**自动化（AI 已执行）**

| 命令 | 结果 |
|---|---|
| `pnpm typecheck`（`vue-tsc --noEmit`） | ✅ exit 0 |
| `pnpm test` | ✅ 668/669 通过；唯一失败为 `gitPush` 的**时序/超时断言**（临时 git 仓库创建慢），与本次改动无关，单独复跑该文件全部通过，且指定子集 224/224 通过 |
| `pnpm i18n:merge` | ✅ zh/en 各 1075 顶层键 / 1100 总计（幂等：二次运行 `No changes`） |
| `pnpm i18n:verify` | ✅ exit 0：4626 叶子键中英对齐、无重复键、FEATURE_CONFIG 全部可解析（含 `resourceManager.description`） |
| `pnpm audit:encoding` | ✅ 1697 文件、0 编码问题（确认中文注释未写坏） |

**需用户执行**（按 `AGENTS.md`，AI 不运行）

```bash
pnpm lint      # ESLint
pnpm build     # vite build（含 merge-i18n + SCSS 编译）
```

**人工验收点**

| 项 | 预期 |
|---|---|
| 四个弹窗开合 | 外观与位置不变；**移动/压缩/预览**新增 0.98 缩放进入动效（原缺失，按范式补齐）；分类设置弹窗动效不变 |
| 分类设置弹窗遮罩 | 新增 `padding: $s-4`（居中布局下位置不变，仅在视口极窄时保留边距） |
| 连续点两次「刷新」 | **列表能正确加载**（F2 缺陷修复的证据；修复前第二次点击会丢弃结果，列表空白） |
| 移动资源 | 引用更新条数提示、自动复制新路径、失败时弹窗保留 —— 文案与行为逐字不变 |
| 压缩写回原图 | 写回后该批图片勾选态自动释放 |
| 分类设置 | 删除空分类 / 恢复内置分类行为不变 |

---

## 十、代码量对比

**模块总量：4338 → 4386 行（净 +48）**，结构分布显著改善：

| 文件 | 改前 | 改后 | 变化 |
|---|---|---|---|
| `composables/useResourceManager.ts` | 607 | **449** | **−158** ✅ 回到 500 行内 |
| `composables/useAssetMover.ts` | — | **242** | **+242**（新增，职责单一） |
| `styles/index.scss` | 497 | **420** | **−77** ✅ |
| `styles/_mixins.scss` | — | **108** | +108（新增，纯 mixin 载体） |
| `styles/MoveAssetDialog.scss` | 190 | 148 | −42 |
| `styles/CategorySettingsDialog.scss` | 164 | 131 | −33 |
| `utils.ts` | 255 | 249 | −6 |
| `services/compressor.ts` | 188 | 180 | −8 |
| `types/index.ts` | 145 | 142 | −3 |
| `useImageCompress.ts` | 219 | 227 | +8（deps 签名与注释） |
| `useAssetLocator.ts` / `useAssetActions.ts` / `useCategoryManager.ts` | 80/54/180 | 89/63/185 | +23（deps 签名） |
| `AssetGridList.vue` / `index.vue` | 194/498 | 189/497 | −6（P4 清理） |
| i18n 分片 ×2 + 合并产物 ×2 | — | — | 各 −1 行（死键） |

**净行数 +48 是预期结果**：本次主体是「拆分 + 收敛 + 去重」，不是功能删减——删掉的约 165 行重复/死代码，被新增的 108 行 mixin 载体、242 行独立 composable 与 deps 签名展开（每个字段一行注释、多行解构）所抵消。**关键指标是重复定义处数**：遮罩/关闭钮/过渡从 3 份收敛到 1 份，`form-input` 从 2 份收敛到 1 份，`loadMissing/loadUnused` 从 2 份到 1 份，占位符插值从 4 种写法到 1 种，`buildNameFallbackPairs` 与 `buildVariantPairs` 的两份同构实现到 1 份。

**ESLint 增量（Lead 自查，非 `pnpm lint`）**：整改前该目录基线 163 问题；整改后 **152 问题（−11）**，按规则逐项均不增加（`object-curly-newline` 76→70、`object-property-newline` 29→28、`ts/explicit-function-return-type` 44→42、`style/max-statements-per-line` 3→2、`jsdoc/check-param-names` 1→0）。剩余问题为仓库既有风格基线（同规则在全仓其他模块大量存在，`diskBrowser` 参照实现亦报同类），按 `AGENTS.md` 由用户执行 `pnpm lint --fix` 收敛。
