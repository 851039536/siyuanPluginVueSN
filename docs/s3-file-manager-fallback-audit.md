# S3 文件管理模块 —— 兜底溯源 / 冗余优化 / 内存审查（2026-10-19）

审查对象：`src/features/s3FileManager/`（32 文件，约 3900 行）
方法：逐文件通读 + 全仓 grep 交叉验证 + `git log -S` / `git show` 溯源 + 对照共享层 `src/utils/s3/` 与姊妹模块 `s3Backup`
基线：HEAD `fee8b685e`。
**整改状态：✅ 已全部实施（同日，见文末 §7；`pnpm typecheck` 0 error / `i18n:verify` 4620 键对齐 / `validate:icons` 249 通过 / `pnpm test` 除 2 个 gitPush 计时敏感 spec 环境性抖动外 634 通过且单独重跑全绿）**

---

## 0. 先纠正前提（否则会按旧文档删空）

用户记忆中的 4 条"典型兜底"在当前源码里**已经不存在**，它们是 `docs/s3-file-manager-redundancy-review.md`（2026-09-18）描述的旧版本：

| 记忆中的兜底 | 当前事实 | 证据 |
|---|---|---|
| `FmLogPanel` 的 `hasConfirmHost` + 原生 `confirm()` 回退 | 全仓 grep `hasConfirmHost` **仅命中 docs**，源码 0 处；现为必填 prop | `FmLogPanel.vue:105,129` |
| `FmConfigDialog` 的 `emit("close")` + `emit("saved")` 双关闭路径 | 只发 `saved` | `FmConfigDialog.vue:233-234` |
| `FmContextMenu` 的 `ariaLabel: ""` 压掉子组件默认名 | 改为留 `undefined` | `FmContextMenu.vue:26-31` |
| `styles/index.scss` 被 3 个 .vue 重复 `@use` → 产物重复 | 每个 SFC 只 `@use` 自己那份；`_variables.scss` 无 CSS 产出 | 8 个 `.vue` 各 1 处 `@use` |

**⇒ 真正待处理的兜底在下面，且分三档命运完全不同。**

---

## 1. 兜底的意义：考古结论（`git log -S` 溯源）

| 类别 | 代表 | 引入 | 当初防什么 | 现在还能触发吗 | 结论 |
|---|---|---|---|---|---|
| **A. 有实测 bug 背书** | `s3ObjectOps.ts:47-52` CommonPrefix 归一化 + 过滤回显 prefix；`utils.ts:86` 空段防护 | `e38262dd2` / `a4cec2aeb`（2026-07-30，功能上线**当天**） | OpenList/Alist 类代理①回显 prefix 自身 → 目录无限自嵌套；②CommonPrefix 缺尾斜杠 → 上传 key 拼接错乱 | 会（换非标后端） | **必须保留**。这不是"兜底"，是**不可信后端的协议归一化** |
| **B. 设计期保险（零 bug 证据）** | `useS3Entries.ts:83-91` delimiter 失败即降级全量列举 | `f8d35308b`（初版） | 假设"代理不支持 delimiter" | **能，但触发原因不是它想防的那个**：`listDir` 任何非 2xx 都 throw（`s3ObjectOps.ts:38-41`），403/超时/5xx 一律被误判为"能力缺陷"，且 `delimiterUnsupported=true` 被**永久钉住**（只有保存配置才 reset，`index.vue:459`）。之后每层都走 `client.list` 递归全量列举 | **改成显式失败**（只对 405/501 之类明确不支持才降级） |
| **B'. 纯优化、无兜底价值** | `useS3Entries.ts:99-102` 静默探测"delimiter 被忽略" | `828a5591d` | 省一次无效请求 | 无 bug 记录 | **可删**（正确性已由 `normalizeListing` 保证） |
| **C. 已被共享层超越的临时补丁** | `useS3Transfer.ts:121-151` 256MB 内存预算信号量 | `952095cae`（2026-08-17） | `readFile` 整包驻留内存 OOM | 会，**但毫无必要**：`uploadFileSmart` **2026-09-08** 才出现（`6b860ea80`），现已提供 >100MB 自动 16MB 分片，`s3Backup` 三条路径全用，**只有本模块没接**（`README.md:40` 自登记） | **整套删除**，改接共享层。且正是这个信号量自己制造了 H1/H2 死锁，才需要再加 3 层 clamp 去补 |
| **D. 不可达的防御 catch** | `useFmPrefs.ts:40-46`、`useS3FmClient.ts:51-53`、`FmConfigDialog.vue:182/193/215/235`、`useFileOpLogs.ts:20/43` | 多轮 | "加载/保存失败不阻断面板" | **不可达**：`PluginStorage.load` 内部 catch 后 `return null`（`pluginStorage.ts:42-53`）；`loadOrDefault` 全无 throw 路径（`typedStorage.ts:47-96`）；`decryptSetting` 内部 catch 返回原值（`settingsCrypto.ts:96-106`） | **可删**（建议保留 1 处 `console.warn` 可视化失败） |

> 最强对照证据：姊妹模块 `s3Backup` 面对同一 OOM 问题时选的是**换实现（磁盘路径分片）**而非加信号量 —— 这是"内存预算该删"的决定性依据。且它同样保留了与 `normalizeListing` 同源同因的防御过滤（`useS3Backup.ts:133-142`），说明 A 类防御不是过度设计。

---

## 2. 可安全删除清单（分三批）

### 批次 1：零行为风险，≈82 行

| # | 位置 | 内容 | 行数 |
|---|---|---|---|
| 1 | `useS3Entries.ts:151-156` | `invalidateCache(prefix?)` 的 `delete` 分支（全仓仅无参调用） | -4 |
| 2 | `useS3Entries.ts:125-128` | `navigateTo` 纯转发 → 调用点直接用 `loadDir` | -3 |
| 3 | `useS3FmClient.ts:51-53` | `loadConfig` 外层不可达 catch | -3 |
| 4 | `useS3FmClient.ts:58` | `prefix \|\| ""` 死兜底（同时是**真缺陷**，见 §4-2） | 0 |
| 5 | `useFmPrefs.ts:40-46` | 不可达 catch + 默认回滚（L1 竞态的补丁本身也是兜底） | -10 |
| 6 | `useFileOpLogs.ts:20-22,43-45` | 不可达 catch（改 `console.warn`） | -9 |
| 7 | `useFmConfirm.ts:39,47` | `resolve?.()` 可选调用（改 `resolve!()`） | 0 |
| 8 | `useExternalDrop.ts:32,54,62` + `:66-69` + `index.vue:77` | 3 处死判空 + **无效的 `dragend` 兜底**（外部 OS 拖拽不派发到页面；页面内能收到的只有内部拖拽，而内部拖拽从不设 `isDragOver`） | -7 |
| 9 | `useS3Transfer.ts:80-84` | `runUpload` 内重复 `getNodeModules` 判空（两调用者已检查） | -4 |
| 10 | `useS3Transfer.ts:62-65` | `withRetries` 薄包装 | -4 |
| 11 | `useS3Transfer.ts:356-358` | 下载前预建目录（`s3Client.download` 内部已 `mkdir recursive`，`s3Client.ts:148`） | -3 |
| 12 | `useS3Transfer.ts:54` | `Math.max(total, 1)`（total 恒 ≥1） | -1 |
| 13 | `useS3FileOps.ts:30,111` | `isTransferring?` 改必选去 `?.`（`index.vue:277` 恒传） | -2 |
| 14 | `useS3FileOps.ts:72-107` | `runCopies`/`runDeletes` 除单次调用外逐字重复 → 合并 `runBatch` | -18 |
| 15 | `useS3FileOps.ts:146-153` | `createNewFolder` 内层 try/catch（日志模板上移） | -4 |
| 16 | `utils.ts:75,89-91,126-132` | `conflicts` 死计算（三个消费点早已改成空判断并删除，**零消费者**） | -8 |
| 17 | `useS3Selection.ts:20-21` | `selectedCount` 二次 computed | -2 |
| 18 | `index.vue:401,406,441` | 三处 `length === 0` 前置守卫（工具栏只在 `selectedCount>0` 渲染，右键路径 `ensureSelected` 保证 ≥1） | -3 |
| 19 | `index.vue:422` | `openRename` 的 `length === 1` 包裹 | -2 |
| 20 | `index.vue:431` | `!target \|\|`（`renameTarget` 非 null 才渲染弹窗；**同名判断保留**） | 0 |
| 21 | `index.vue:417` | `else if (mode === "move")` → `else`（类型已收窄） | 0 |
| 22 | `index.vue:350-352,367-370` | 两个纯转发 handler | -5 |
| 23 | `FmContextMenu.vue:60-62` | `onMounted` 补同步（唯一调用方初值恒 `visible:false`，且 `hidePopup` 首行短路） | -3 |
| 24 | `FmContextMenu.vue:67` | 重复 `emit("close")`（`onVisibleChange` 已覆盖，需实测一次） | -1 |
| 25 | `FmConfigDialog.vue:109-110,119-120` | `:disabled` 与 `:loading` 重复（`Button.vue:7` 已 `disabled \|\| loading`） | -2 |
| 26 | `FmConfigDialog.vue:193-194,215-217` | 不可达 catch | -4 |
| 27 | `FmLogPanel.vue:124` | `\|\| time`（`log.time` 由 `toISOString()` 生成恒合法） | 0 |
| 28 | `FmMoveCopyDialog.vue:145-147` | `folderName` 转发 | -3 |
| 29 | `FmMoveCopyDialog.vue:164` | `console.error`（`:165` 已有 UI 错误态） | -1 |
| 30 | `FmConfigDialog.scss:38-43` / `FmMoveCopyDialog.scss:71-76` | `.fm-dialog-footer-right` 逐字重复（scoped 会输出 2 份） | -6 |

### 批次 2：需行为确认，≈130 行（收益最大）

| # | 动作 | 收益 | 说明 |
|---|---|---|---|
| 1 | **上传改接 `uploadFileSmart`** | ≈-90 行 | 一次性删除：内存预算信号量（`useS3Transfer.ts:121-151`）、预 stat 串行扫描（`:95-102`）、大文件警告（`:103-108`）、`UPLOAD_MEMORY_BUDGET`（`:23`）、`buffer` 别名。内存峰值从"整文件"降到 16MB，`onProgress` 签名完全兼容 |
| 2 | **delimiter 降级收窄或整链删除** | ≈-57 行 | 收窄：catch 里只对"明确不支持"（405/501/`NotImplemented`，照抄 `isMultipartUnsupported` 模式）降级，其余走 `loadError`。整链删：`useS3Entries.ts:38-39,83-107,159-162` + `utils.ts:63-92,114-133` + `index.vue:459`，需同步改 `FmMoveCopyDialog.vue:159-160`。**前提：用户只用 MinIO/AWS/标准 S3** |
| 3 | 目录缓存加 LRU 或删缓存层 | ≈-15 行 | 无上限无 TTL，persistent Modal 整插件生命周期不卸载，长会话持续驻留（见 §3-2）。删缓存顺手消灭 C1 转圈缺陷 |

### 批次 3：**必须保留**（删了会丢数据/崩 UI）

`useS3Entries.ts:45,110-122`（请求令牌，修的是真竞态）、`:131-136`（浏览根钳制）、`:139-143`（`-1` 语义）；
`useS3FileOps.ts:57-59 / :63-66`（**复制自身再删源 = 直接删文件**；复制进自身子目录 = 无限嵌套）、`:46-48`（占位对象补入，否则空文件夹删不掉）、`:111`（重入守卫）；
`useS3Transfer.ts:78,224,256,335`（重入/空输入）、`:227,259`（入口固化 `destPrefix`，否则选文件期间切目录会传错位置）、`:322`（跳过占位对象）、`:324-326`（路径穿越防护 —— **实现需加强**，见 §4-7）；
`useFileOpLogs.ts:34-36`（日志上限）、`useFmConfirm.ts:21`（顶掉旧确认防悬挂 Promise）、`useFmPrefs.ts:51-53`（等值跳过防启动冗余落盘）、`useExternalDrop.ts:14,42-45`（enterCount 防抖）、`index.vue:431` 同名判断（同名复制+删源会误删文件）、5 个 Dialog 的 `v-if`（这是资源回收机制）、`index.ts:62-64` `instance === this`。

---

## 3. 冗余性能优化

| # | 位置 | 问题 | 建议 |
|---|---|---|---|
| 1 | `FmEntryList.vue:215-230` | `itemInteractionProps()` 每渲染 × 每条目新建 **9 个闭包 + 1 对象**；上限 200 条 → 单次选中变化产生 1800 个闭包 + 200 次 handler 重绑 | 模板内直写 `@click="emit(...)"`，删两个工厂函数（-27 行 + 消热路径分配） |
| 2 | `useS3Selection.ts:16-21` | `selectedEntries` 每次选择变化全量 `filter(orderedEntries)`（O(n)），大目录上万条目 | 由 `selectedKeys` + key→entry Map 反查（O(k)） |
| 3 | `useExternalDrop.ts:18` | 每次 drag 事件 `Array.from(e.dataTransfer.types)`（dragover 每秒数十次） | 用 `types.contains("Files")` |
| 4 | `utils.ts:127-132` | delimiter 正常时仍对 `listing.files` 全量聚合（恒空）再 `new Set([...folders, ...agg])` | 仅当 `folders.length === 0` 才聚合 |
| 5 | `useS3Transfer.ts:94-102` | 上传前**串行** `stat` N 次，`readFile` 内部还会再 stat | 随批次 2-1 整段删除 |
| 6 | `concurrency.ts:47-61` + `useS3Transfer.ts:62` | `runWithRetries` **无退避、无错误分类**：403/404/签名错误也重试 3 次，拉长失败反馈 | 加"可重试判定"（网络类/5xx 才重试） |
| 7 | `FmBreadcrumb.vue:15-47` vs `FmMoveCopyDialog.vue:11-42` | 两处面包屑模板 ~35 行近乎逐字重复（计算已统一到 `relativeSegments`，只差模板） | 抽 `FmPathBreadcrumb.vue` |
| 8 | `FmMoveCopyDialog.scss:49-57` | `:deep(.si-button__text)` 覆写共享 Button 内部类名 | 脆弱耦合，库改名即静默失效 |
| 9 | `FmToolbar.vue:145` / `FmBreadcrumb.vue:84` / `FmLogPanel.vue:108` | `defineEmits` 返回值丢弃，模板用 `$emit` → **编译期不校验载荷** | 绑定局部 `emit`（`FmEntryList` 是正确示范） |
| 10 | `FmConfigDialog.vue:242` vs `:205,214,216,232,236` | `const i18n = props.i18n` 与 5 处 `props.i18n.*` 并存 | 统一一种写法 |

> 已核实**无**冗余的项：排序 `[...entries].sort()` 必要（要正确展示前 200 条必须全排序，拷贝避免污染 `shallowRef`）；`FmEntryList.vue:143` 的 `!loading` 必要（loading 期间 `hasMore` 仍可能为 true）；`progressInfo` 的 `Math.max(op.total,1)` 必要（`runCopies` 会写入 `total:0`）；8 个 scss **0 处死样式**；全模块**无重复 computed**。

---

## 4. 内存 / 资源 / 竞态

### 4-1 🔴 真实缺陷：缓存命中不清 `loading` → 列表永久转圈
`useS3Entries.ts:69-75`
```ts
const seq = ++requestSeq
if (!force && cache.has(prefix)) {
  entries.value = cache.get(prefix)!
  currentPrefix.value = prefix
  renderLimit.value = RENDER_BATCH_SIZE
  loadError.value = ""
  return                      // ← 没有 loading.value = false
}
loading.value = true
```
**复现**：首屏加载根目录（入缓存）→ 双击进慢目录 A（`loading=true`）→ 点面包屑回根（缓存命中，`seq` 自增后立即 return，`loading` 仍 true）→ A 的响应回来，`:111`/`:121` 发现 `seq !== requestSeq` 全部丢弃 → **再无人把 loading 置回 false**。`FmEntryList.vue:5-10` 的 `v-if="loading"` 优先级最高 ⇒ 永久加载圈，只有点刷新（`force=true`）才恢复。**一行修复。**

### 4-2 🔴 真实缺陷：浏览根归一化顺序错 → 首屏永空目录
`useS3FmClient.ts:58`
```ts
const p = (s3Config.value.prefix || "").replace(/^\/+/, "").trim()
```
先 `replace` 后 `trim`。用户在配置里粘贴 `" /a/ "`（首尾带空格）→ `replace` 不命中 → `trim` 后得 `"/a/"` → 返回带前导斜杠的浏览根，与 S3 key 永不匹配 → **首屏永远是空目录**。修复：先 `trim()` 再 `replace(/^\/+/, "")`；`|| ""` 同时可删。

### 4-3 🟠 目录缓存无上限 / 无 TTL
`useS3Entries.ts:37` `const cache = new Map<string, S3Entry[]>()`，只在写操作与切配置时 `clear()`。persistent Modal 整插件生命周期不卸载 ⇒ 长会话遍历大量目录，每层完整条目数组常驻。建议 LRU(20) 或删缓存层。

### 4-4 🟠 缺 `onUnmounted` 令牌守卫
`useS3Entries.ts:45` 的 `requestSeq` 只在 `loadDir` 内自增；对比 `FmMoveCopyDialog.vue:179` 已正确实现 `onUnmounted(() => { requestSeq++ })`。面板 destroy 时在途 `listDir` 回来仍写 `cache`/`entries`/`currentPrefix`。

### 4-5 🟠 落盘无序（日志 / 偏好）
`useFileOpLogs.ts:37` `void saveLogs()` 与 `useFmPrefs.ts:53` `void savePrefs()` 都是 fire-and-forget：连续操作并发多次 `saveData`，完成顺序不保证；且 `useFileOpLogs.ts:42` 传的是 `logs.value` 数组**引用**（非快照），异步序列化期间被 `unshift` 可能写出混合状态。建议串行化 + 写前 `slice()`。

### 4-6 🟠 销毁后仍刷新
`useS3Transfer.ts:196-200` / `:399-402` 的 `finally` 调 `deps.afterMutation()`；传输中插件卸载/重复注册（`index.ts:73` 会 destroy 旧实例）仍会 `invalidateCache + refresh()` 发网络请求。建议加 `disposed` 标志短路，且**仅"有成功项"才刷新**。

### 4-7 🟡 路径穿越防护偏弱
`useS3Transfer.ts:326` `if (!dest.startsWith(destDir)) continue` —— `path.join` 会归一化 `..`，但 `destDir="C:\a\foo"` 时 `dest="C:\a\foobar\x"` 也能通过。应改 `dest === destDir || dest.startsWith(destDir + path.sep)`。

### 4-8 🟡 启动即发网络请求
`index.ts:44-45` 的 `modal.open(); modal.close()` 预热挂载 ⇒ `index.vue:470-476` 的 `onMounted` 会在**用户从未打开面板时**执行：配置解密（PBKDF2）、日志反序列化、**一次真实 S3 ListObjects 请求**。建议 `loadDir` 延后到首次 `open`。

### 4-9 🟡 其他
- `index.ts:40-46` `init()` **非幂等**：重复调用会叠加监听并丢失旧 handler 引用（当前无重复调用路径，建议补 1 行守卫）。
- `index.ts:56-65` `destroy()` 后 `plugin.__s3FileManager` 未清（低危悬挂引用）。
- `FmLogPanel.vue:113` `reactive(new Set())` 只增不回收（上限 200，低危）。
- `useFileOpLogs.ts:29` `id: Date.now().toString()` 同毫秒两条日志 id 碰撞 → `FmLogPanel.vue:38` 的 `:key` 重复。

> 已核实**干净**：8 个组件内 0 个 `addEventListener`/`setInterval`/`Observer`；`index.ts` 监听成对；5 个 Dialog 均 `v-if` 卸载；`TieredMenu`/`useOverlay` 内部监听由 `onBeforeUnmount` 解绑；`destroy()` 接线到 `DESTROYABLE_KEYS`。

---

## 5. 顺带发现的"掩盖错误"（比兜底更值得优先修）

| # | 位置 | 问题 |
|---|---|---|
| 1 | `FmConfigDialog.vue:231` | `PluginStorage.save()` 失败时**返回 false 不抛**（`pluginStorage.ts:27-34`），返回值被忽略 → 落盘失败仍提示"配置已保存"并应用配置。改：`if (!await save(...)) throw` |
| 2 | `FmConfigDialog.vue:226-230` | `encryptSetting` 失败时**catch 后返回明文**（`settingsCrypto.ts:57-78`）→ 凭证明文写盘且 UI 提示成功 |
| 3 | `FmConfigDialog.vue:182-184` | 配置加载失败只 `console.error` → 表单静默停在 `DEFAULT_S3_CONFIG`，用户无法区分"没配过"与"读取失败" |
| 4 | `useS3Transfer.ts:352-355` | 下载空文件夹（或全是占位对象）报"下载失败"红条 → 误报 |
| 5 | `useS3Transfer.ts:276-295` | 拖入文件 `stat` 失败**静默丢弃**；全部失败时无声返回，用户拖了东西毫无反应 |
| 6 | `useS3Transfer.ts:182-188` | 上传日志缺 `detail: buildFailDetail(failed)`，部分失败清单无法展开（与下载 `:373-380` 不一致） |
| 7 | `useS3FileOps.ts:180` | 用 i18n 文案做控制流（`getErrorMessage(err) !== i18n.renameFailed`）→ 改文案/切语言静默改行为 |
| 8 | `useS3Transfer.ts:231-235` | `getPathsFromFiles` 返回空时也提示"请使用桌面版"，归因错误（真实原因可能是 Electron 32+ `webUtils` 不可用） |
| 9 | `i18n/s3FileManager.json` `logsCleared` | 全模块**零引用** → 清空日志后无成功反馈（死键） |

---

## 6. 建议执行顺序

1. **先修 3 个一行级真缺陷**：§4-1 转圈、§4-2 归一化顺序、§4-5 日志 id 碰撞。
2. **批次 1 低风险删除**（≈82 行，零行为变更）。
3. **批次 2-1 接 `uploadFileSmart`**（≈90 行，内存模型从整文件降到 16MB，顺带消灭上传侧全部内存相关兜底）。
4. **批次 2-2 delimiter 收窄**（不要直接删，除非确定只用标准 S3）。
5. **§5 的"掩盖错误"逐条改显式失败**（这是"不需要兜底"最正确的落地方式）。

验证：改动后跑 `pnpm typecheck` / `pnpm i18n:verify` / `pnpm validate:icons`（既有入口）；`pnpm lint` / `vite build` 由用户执行（`AGENTS.md:96,100`）。

---

## 7. 整改实施记录（2026-10-19，同日完成）

用户决策：全量执行三批；delimiter 链路**保留**（自建 OpenList 场景），但收窄误判面。

### 7.1 三个真实缺陷（§4-1/4-2/4-9）

| 项 | 修复 |
|---|---|
| 列表永久转圈 | `useS3Entries.ts` 缓存命中分支补 `loading.value = false` |
| 首屏永空目录 | `getRootPrefix()` 改为先 `trim()` 再去前导 `/`，并删 `|| ""` |
| 日志 id 碰撞 | `useFileOpLogs` 改 `${Date.now()}-${++seq}` |

### 7.2 delimiter 降级收窄（保留 OpenList 兼容）

- 共享层 `s3ObjectOps.ts` 新增 `DelimiterUnsupportedError`：仅 HTTP 405/501 或 XML Code 为 `NotImplemented/MethodNotAllowed/UnsupportedOperation/InvalidArgument/NotSupported` 时抛出（与 `isMultipartUnsupported` 同一套判据）。
- `useS3Entries` 的 catch 只对 `DelimiterUnsupportedError` 降级；403/超时/断网直接冒泡到 `loadError` —— 修掉"一次网络抖动把会话永久钉在全量列举"的真缺陷。
- **静默忽略探测从"切路径"改为"删逻辑"**：原探测到 delimiter 被忽略后会切到 `client.list` 全量递归；实测该场景下 `listDir` 本身就能成功返回（`normalizeListing` 负责折叠），切换反而不必要地放弃了共享层的翻页聚合与占位过滤。现统一走 `listDir` + `normalizeListing`，OpenList 行为不变、少一条分支。
- `aggregateEntries` 的 `conflicts` 死计算（零消费者）删除；`normalizeListing` 在空列表时短路，跳过无谓 O(n) 扫描。

### 7.3 上传改接共享层 `uploadFileSmart`（净 -90 行）

- 删除：`UPLOAD_MEMORY_BUDGET`、`reserveMemory`/`releaseMemory` 信号量、`bytesInFlight`/`waiters`、预 stat 串行扫描、大文件警告（`i18n.largeFileWarn` 键一并删除）、`Buffer` 别名。
- 内存模型：整文件驻留 → >100MB 自动 16MB 分片（存储端不支持分片时由共享层降级整包并告警，OpenList 已覆盖）。
- `uploadFileSmart` 新增返回 `Promise<number>`（文件字节数），供日志统计——对既有调用方（s3Backup 四处，全部忽略返回值）向后兼容。

### 7.4 其余批次 1 删除（零行为风险）

- `useS3FmClient`：不可达 `loadConfig` catch 删除；死 import 清理。
- `useFmPrefs`：不可达 catch + 默认回滚删除（L1 竞态补丁自身也是兜底）；落盘改串行链。
- `useFileOpLogs`：不可达 catch 删除；`save()` 返回 false 时 `console.warn` 可见化；落盘改串行链 + 快照。
- `useFmConfirm`：`resolve?.()` → `resolve!()`。
- `useExternalDrop`：3 处死判空与 `Math.max(0,…)` 删除；无效 `onDragEnd`（外部 OS 拖拽不派发到页面）连同 index.vue 绑定删除；`enterCount--` 直接递减。
- `useS3FileOps`：`isTransferring` 改必选；`runCopies`/`runDeletes` 合并为 `runBatch`；`renameEntry` 的 i18n 文案控制流改为 `LoggedError` 错误标记（copy/move/delete 同步）。
- `useS3Selection`：`selectedEntries` 由全量 `filter`（O(n)）改为 key→entry Map 反查（O(k)），Map 用 computed 随列表重建。
- `useS3Entries`：`navigateTo` 纯转发删除（调用点直用 `loadDir`）；`invalidateCache` 可选参数分支删除；缓存加 `MAX_CACHE_DIRS=30` 上限（插入序淘汰，等价简易 LRU）；补 `onUnmounted` 令牌守卫。
- `useS3Transfer`：`runUpload` 内重复 node 判空、`withRetries` 保留但调用侧并入、下载前预建目录（与 `S3Client.download` 内建 mkdir 重复）删除；`Math.max(total,1)` 死守卫删除；上传日志补 `detail: buildFailDetail(failed)`；拖入 stat 失败不再静默丢弃（计入清单、全失败时可见报错）；空文件夹下载由红色"下载失败"改为空目录提示；路径穿越守卫加强（`destDir + path.sep` 前缀比较）；新增 `isDisposed` 依赖，卸载后不再刷新。
- `index.vue`：3 处 `length === 0` 前置守卫、`openRename` 包裹、`!target ||`、`else if` 收窄、2 个纯转发 handler、`@dragend` 绑定、`onClose?.()` 可选链全部删除；`onClose` 改必填；清空日志补 `logsCleared` 成功提示（原死键转正）；新增 `disposed` 标志。
- `index.ts`：`init()` 幂等守卫；`destroy()` 清理 `plugin.__s3FileManager`。
- `FmContextMenu`：`onMounted` 补同步删除（唯一调用方恒 `visible:false`，`hidePopup` 首行短路，纯 no-op）。
- `FmConfigDialog`：2 处与 `:loading` 重复的 `:disabled` 删除；`handleTest`/`handleImport` 不可达 catch 删除；`handleSave` 显式检查 `save()` 返回 false（落盘失败不再假报"已保存"）；配置加载失败补用户可见提示（新增 `i18n.configLoadFailed`）；`i18n`/`props.i18n` 混写统一。
- `FmLogPanel`：`relativeTime` 的 `|| time` 死兜底删除；`expandedIds` 随日志变化回收。
- `FmMoveCopyDialog`：`folderName` 转发、`console.error`、未使用的 `const emit =` 删除。
- 样式：`.fm-dialog-footer-right` 双文件重复抽为 `styles/_dialog-footer.scss` 单一来源。

### 7.5 保留不动（必要防御，见 §批次 3 清单）

`requestSeq` 两处、浏览根钳制、占位对象补入、`destSameAsSource`/`destInsideSelf`、路径穿越守卫、日志上限、确认框顶掉语义、`enterCount` 防抖、重命名同名拦截、5 个 Dialog 的 `v-if` 卸载机制。

### 7.6 未实施（记录在案）

- `index.ts` 预热挂载导致"插件启动即发一次 ListObjects 请求"：需要给面板加首次打开回调（涉及 `createModalVueApp` 契约），收益/风险比低，暂缓。
- `FmConfigDialog` 加密失败回退明文写盘（`encryptSetting` 共享层行为）：正确修法是让共享层提供可判别错误，影响面超出本模块，建议单独立项。
- `FmToolbar`/`FmBreadcrumb` 的 `defineEmits` 返回值丢弃（模板 `$emit` 不受编译期校验）：纯类型增强，未动。

### 7.7 验证

| 检查 | 结果 |
|---|---|
| `pnpm typecheck`（vue-tsc） | ✅ 0 error |
| `pnpm i18n:verify` | ✅ 4620 叶子键中英对齐（-1 largeFileWarn +1 configLoadFailed） |
| `pnpm validate:icons` | ✅ 249 图标有效 |
| `pnpm test` | ✅ 634 通过；2 个 gitPush 计时敏感 spec 全量并发时环境性抖动，单独重跑全绿（与本次改动无关，gitPush 零文件变更） |
| `pnpm lint` / `vite build` | 由用户执行 |
| s3Backup 外溢检查 | ✅ 共享层改动（`DelimiterUnsupportedError`、`uploadFileSmart` 返回值）无外溢，s3Backup 零引用受影响符号 |

净变化：24 文件，+368 / -344 行（其中删除的死兜底/冗余约 260 行，新增为显式错误处理与 LRU/串行化等必要设施）。
