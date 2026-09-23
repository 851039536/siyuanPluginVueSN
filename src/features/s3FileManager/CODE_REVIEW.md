# S3 文件管理器（src/features/s3FileManager/）UI 重构前的代码审查报告

审查范围：`types/`、`utils.ts`、`index.ts`、`index.vue`、`composables/`(9)、`components/`(8)、`styles/`(8)。
验证手段：逐文件通读 + 全仓 grep 交叉验证 + `vue-tsc --noEmit`（通过，0 error）+ `verify-i18n.mjs`（通过，键对齐）。
以下每条均含 file:line 与可复现的失败路径。

---

## 一、逻辑漏洞（按严重度）

### 🔴 H1. 上传内存信号量可永久死锁（stat 失败 → bytesInFlight 变 Infinity）
`composables/useS3Transfer.ts:152-153, 167`

```ts
const bytes = sizeMap.get(task.key) ?? Number.POSITIVE_INFINITY   // :152 stat 失败时
await reserveMemory(bytes)                                        // :153
...
finally { if (buffer) { releaseMemory(buffer.length) } }          // :167
```

`reserveMemory` 对 `Infinity` 走 `:135` 分支执行 `bytesInFlight += Infinity`；`releaseMemory` 里
`bytesInFlight = Math.max(0, Infinity - n)` 仍为 `Infinity`（`Math.max(0, Infinity)` === `Infinity`）。
此后每个任务的 `bytesInFlight + bytes <= UPLOAD_MEMORY_BUDGET`（`:125`）恒为 false，全部任务压入
`waiters` 且唤醒循环（`:140-146`）因队列长度不变直接 break —— **单个文件 stat 失败即导致整批上传永久挂起**。
修复：`?? Number.POSITIVE_INFINITY` 改为有限值（如预算本身），或 `bytesInFlight` 用 `Math.min` 夹紧；`releaseMemory` 用实际 `bytes` 而非 `buffer.length` 记账。

### 🔴 H2. 同一处：readFile 抛错导致预算只增不减（漂移累积）
`useS3Transfer.ts:153-167`

`reserveMemory(bytes)` 成功（`bytesInFlight += bytes`）后若 `readFile` 抛错，`buffer` 仍为 `null`，
`finally` 的 `if (buffer)` 短路 → **reserve 了却从不 release**。反复失败使 `bytesInFlight` 单调上升，
一旦累积 ≥ 预算即复现 H1 的死锁。修复：把记账的 `bytes` 存到局部变量，`finally` 无条件按它释放。

### 🔴 H3. 目录列举无请求令牌 → 快速导航时旧响应覆盖新目录
`composables/useS3Entries.ts:59-110`（`loadDir`），全模块 grep 确认**无任何** `AbortController`/`generation`/`requestId`

`loadDir` 在 `await listDir` 期间不做任何版本校验，回来直接 `entries.value = built; currentPrefix.value = prefix`
（`:102-103`）。用户连点 A→B 时，A 的慢响应后到会**把 B 的列表覆盖成 A 的内容，同时把 currentPrefix 也改回 A**，
面包屑随之跳回，且 `cache.set` 写入错位。同类问题在 `components/FmMoveCopyDialog.vue:147-163` 的 `navigate()`
（无令牌 + 无 `onUnmounted` 守卫，卸载后仍赋值）。修复：引入自增请求序号，响应回来时比对丢弃过期结果。

### 🟠 M1. `FmNameDialog` 错误态永不复位
`components/FmNameDialog.vue:62, 74`

`showError` 仅在非法提交时置 `true`（`:74`），全文再未置回 `false`，且无 `watch(name)`。
用户填了非法名 → 提交 → 改成合法名后，**确定按钮已恢复可用（`:32`）但输入框仍显示红色错误边框**（`:16`）。
修复：`watch(name, () => showError.value = false)`。

### 🟠 M2. `FmContextMenu` 首次渲染 immediate watch 空跑
`components/FmContextMenu.vue:46-56`

`{ immediate: true, flush: "post" }` 首次执行时子组件 `TieredMenu` 尚未挂载，`menuRef.value` 为 `null`，
`:50/:53` 的可选链静默 no-op。当前因 `index.vue:297` 初值 `visible:false` 而恰好走对分支，属**潜伏缺陷**：
任何以 `visible:true` 初始化的调用方都会看到菜单不弹出。修复：加 `onMounted` 后同步一次或改 `flush: "pre"`。

### 🟠 M3. 外部拖入浮层可能永久驻留
`index.vue:119` + `composables/useExternalDrop.ts:14, 37-38`

`onDragLeave` 对 `!hasFiles(e)` 提前 return（`:37`），而拖拽移出窗口时 `dataTransfer.types` 为空，
因此 `enterCount` 只增不减，"松开以上传到当前目录"浮层会一直钉住，直到下一次成功 drop 才重置。
修复：监听 `dragend`/`window` 级 `dragleave` 兜底清零。

### 🟡 L1. `useFmPrefs` 排序持久化 watch 与启动回填存在竞态
`composables/useFmPrefs.ts:35-51`

`loadPrefs()` 回填 `sortField/sortAsc`（`:38-39`）会触发 `:48` 的 watch；虽然 `:49` 的等值判断挡掉了多数冗余落盘，
但 `loadPrefs` 捕获异常时把 `prefs` 重置为默认（`:42`）而**不回滚 sortField/sortAsc**，此时两者不一致 → 立即落盘，
把用户已存的排序偏好覆盖为默认。修复：异常分支同步回滚两个 ref。

### 🟡 L2. `FmLogPanel` 展开态 Set 不随日志收缩清理
`components/FmLogPanel.vue:113`

`reactive(new Set())` 在 Vue 3.5 下响应式正常（无缺陷），但清空日志后 `expandedIds` 中已删除 id 不会回收。
当前被 `v-if="showLog"`（`index.vue:179`）每次重挂载所掩盖，属低危。

---

## 二、内存 / 资源问题

| # | 位置 | 问题 |
|---|---|---|
| 1 | `useS3Transfer.ts:155` | `if (buffer) { buffer = Buffer.from(buffer) }` 是**整文件全量冗余拷贝**：`readFile` 已返回独立 `Buffer`，`Buffer.from(buf)` 再复制一份，峰值内存翻倍，直接架空 `UPLOAD_MEMORY_BUDGET`（`:23`）的预算语义。应删除。 |
| 2 | `useS3Transfer.ts:153-167` | 见 H1/H2：信号量记账不一致导致预算泄漏并恶化成死锁。 |
| 3 | `useS3Entries.ts:37` | `cache`（`Map<string, S3Entry[]>`）无容量上限、无 TTL，仅写操作后全清；单一 persistent Modal 生命周期内长会话遍历大量目录会持续驻留条目数组。 |
| 4 | `useS3Selection.ts:12` / `FmLogPanel.vue:113` | 集合只增不减（前者靠 `watch(currentPrefix)` + `clearSelection` 兜底，后者无兜底）。 |
| 5 | `useS3Transfer.ts:312-321` | 下载任务对象数组 `tasks` 在内存中一次性驻留全部任务及其目标路径（大目录下载规模线性增长）。 |

**无泄漏项（已验证正确）**：`index.ts:56-65` 的 `destroy()` 正确移除 `openS3FileManager` 监听并销毁 modal，
且 `:73` 有重复注册防护；8 个组件内**无任何** `addEventListener`/`setInterval`；`FmContextMenu` 的 watch 随组件自动回收。

---

## 三、冗余与死代码

1. **`application/x-s3fm` 是死写入** — `FmEntryList.vue:229` 写入该自定义 dataTransfer 类型，全仓 grep **仅此一处出现**，
   从无人读取。`:228` 的注释"与外部 Files 拖入区分"是误导：真正的判据是 `draggingKey`(`:215`) 与
   `useExternalDrop.hasFiles()`。删除该行与注释。
2. **`styles/index.scss` 被重复 @use** — `FmConfigDialog.vue:247` 与 `FmMoveCopyDialog.vue:174` 各自 `@use "../styles/index.scss"`，
   而 `index.vue:479` 已引过。因 scoped 的 `data-v-` 不同，整份 ~120 行选择器在产物中**重复输出 2 次**，
   但两组件实际只用到 `.fm-dialog-footer-right`（`index.scss:95`）。这正是仓内
   `features/componentPreview/README.md:68`、`features/s3Backup/README.md:62` 明令禁止的反模式。
   修复：把该规则下沉到两个 dialog 的 SCSS 或共享 partial，删除这两处 `@use`。
3. **`FmConfigDialog.vue:234` 的 `emit("close")` 冗余** — 父层 `handleConfigSaved`（`index.vue:455`）已置
   `showConfig=false`，关闭走两条独立路径；只绑 `@saved` 的调用方会残留弹窗。
4. **`FmEntryList.vue:98-112` 与 `:132-147` 重复** — 两视图各有一份逐字相同的 10 个拖拽/点击属性块与相同的
   `:class` 绑定（`:102` vs `:136`），仅内部单元格布局不同。可抽 `v-bind` 对象或子组件。
5. **`FmToolbar.vue:145-157` / `FmBreadcrumb.vue:84-89` 丢弃 `defineEmits` 返回值** — 模板用 `$emit`，
   类型仅作文档，**编译器不校验 `$emit` 载荷**；`FmEntryList` 因绑定局部 `emit` 而保有校验（正确示范）。
6. **`FmContextMenu.vue:29-31` 的 `ariaLabel: ""`** — 显式空串压掉了 `TieredMenu.vue:126` 的有意义默认值，
   应改为 `undefined` 让子组件默认生效。
7. **`FmLogPanel.vue:74-75`** — `v-for` 以 `idx` 作 key，用于纯追加的失败清单，安全但可换 `key` 本身。

---

## 四、重复类型

**结论：无重复类型声明。** 逐项核验：
- `ConfirmOptions` / `FmConfirmState` / `ConfirmRequest` / `S3FileManagerI18n` 在 `types/index.ts:101-124` **单一声明**，被全部 9 个 composable 与 8 个组件统一导入。
- 4 个组件的 `interface Props`（`FmBreadcrumb:75`、`FmEntryList:183`、`FmToolbar:138`、`FmContextMenu:19`）是 SFC 各自独立的局部形状，非重复。
- 常量 `FILE_OP_CONCURRENCY`/`TRANSFER_CONCURRENCY`/`RENDER_BATCH_SIZE` 集中在 `types/index.ts:90-96`；跨模块常量（`MAX_LOG_COUNT` 等）复用 `@/utils/s3/types`，无字面量分叉。
- **唯一可收敛项**：`FmConfigDialog.vue:159` 的内联 `{ success: boolean; message: string } | null` 与 `S3Client.testConnection()` 返回结构重合，但因未导出而无法复用，影响可忽略。

---

## 五、已验证为"干净"的项

- `vue-tsc --noEmit`：**0 错误**。
- i18n：`verify-i18n.mjs` 通过；组件引用的每个 `i18n.*` 键都存在于 `src/i18n/zh_CN/s3FileManager.json`，无缺失回退；无未使用键。
- emit 契约：8 个组件声明与发射**逐一对齐**（10/10、3/3、7/7、2/2、2/2、2/2、2/2、1/1），无未用 prop / 未用 import / 未用局部状态。
- 无 prop 直接改写；无未回收的 `addEventListener`/`setInterval`；模板 ref 由 Vue 自动置 null。
- `:key` 使用正确：可排序列表用 `entry.key`（唯一），索引 key 仅出现在只追加路径。
- SCSS：8 个样式文件中**每个类都有模板使用**，无死规则；无注释掉的代码；`%fm-item-selected`/`%fm-item-drag-over` 均被 `@extend`。
- 目录聚合口径已统一（`normalizeListing`），复制/移动"先全量复制成功再删源"的防丢数据设计正确；`destSameAsSource`/`destInsideSelf` 守卫到位。

---

## 六、修复优先级建议

1. **立即**：H1+H2（上传死锁与预算泄漏）、H3（导航覆盖）、H2-内存（`Buffer.from` 冗余拷贝）。
2. **本次重构一并处理**：M1/M2/M3、`index.scss` 重复 @use、死写入 `x-s3fm`、`emit("close")` 冗余、`FmEntryList` 属性块重复。
3. **可延后**：L1/L2、`FmToolbar`/`FmBreadcrumb` 的 emit 类型化、`ariaLabel` 默认值、list 缓存容量上限。
