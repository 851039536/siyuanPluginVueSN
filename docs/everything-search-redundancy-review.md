# Everything 本地搜索模块 —— 冗余专项审查与「缓存清理」扩展报告

审查对象：`src/features/everythingSearch/`（整改前 **16 个源文件 / 2402 行**）
对照范围：`src/components/`（共享组件库）、`src/utils/`（共享工具层）、其它 feature 的既有正解实现
审查依据：`AGENTS.md`、`AGENTS_ARCH.md`、`AGENTS_STYLE.md`、`AGENTS_API.md`、`AGENTS_I18N.md`
审查日期：2026-10-20
整改状态：**✅ 已全部实施**

---

## 一、结论摘要

| 类别 | 项数 | 最高严重度 | 说明 |
|---|---|---|---|
| 安全缺陷（会被安全软件上报） | 1 项 | **P0** | PowerShell 脚本删除（F1） |
| 真实功能缺陷 | 3 项 | **P0** | `openPath` 不判返回值（F2）、搜索表达式两处拼接（F3）、`formatDate` 猜时间格式（F4） |
| 规则红线：自建同类控件 | 6 处 | P1 | 原生 button/input/textarea 共 **14 处**（F5） |
| 规则红线：样式 | 2 项 | P1 | `backdrop-filter`（F6）、硬编码值（F7） |
| 死代码 / 重复代码 | 2 项 | P1 | 60 行扩展名映射与 diskBrowser 重合（F8）、`isSystemPath` 覆盖不足（F9） |
| 无障碍 | 1 项 | P2 | 结果行键盘不可达（F10） |
| 架构 | 2 项 | P2 | 纯逻辑与 IO 混在 `api.ts`（F11）、`index.vue` 已达 389 行（F12） |

**总体判断**：本模块的分层骨架（`types/` + `composables/` + `components/` + `styles/`）是**合规的**，`useSearchConfig` 的「冲刷-再加载」竞态处理、`searchSeq` 竞态守卫、`TimerRegistry` 统一托管都是**正面范例**。问题集中在三处：

1. **一处安全雷区**：`trashViaPowerShell` 用 `execFileSync("powershell", ...)` 调 `Microsoft.VisualBasic.FileIO.FileSystem::DeleteFile/DeleteDirectory`。这是杀软（尤其 360 企业版）判定的经典可疑组合：**脚本宿主 + 原生文件删除 + 无签名的动态命令行**。它会**替换掉 Electron 真正的回收站 API**，属于「安全降级」——本功能是文件删除入口，必须走系统 API。
2. **共享组件库被系统性绕过**：14 处原生控件对应 6 个共享组件（`Button` / `Tag` / `Input` / `Textarea` / `Message` 等）。而同一仓库的 `dataSnapshot`、`gitPush`、`docAnalysis` 在同类场景**全部**用了共享组件 —— 属「同一问题已有正解却未复用」。
3. **纯逻辑与 IO 混杂**：查询表达式拼接被拆到 `index.vue`（`size:`）和 `api.ts`（`path:`）两处，时间格式化靠「按数值大小猜格式」，均无法单测。

> **强对照证据**：`@/utils/format.ts` 早已提供 `formatFileSize`（本模块已正确复用），`@/utils/electronDialog.ts` 早已提供 `openPathInShell`（本模块未用，见 F2），`diskBrowser/utils/fileKind.ts` 早已提供 `entryIconKey`（本模块复制了 60 行，见 F8）。

---

## 二、P0：安全与真实功能缺陷

### F1. PowerShell 脚本删除 —— 会被企业安全软件上报

`composables/useResultActions.ts:103-122`（整改前）：

```ts
const verb = type === "folder" ? "DeleteDirectory" : "DeleteFile"
const escaped = fullPath.replace(/'/g, "''")
nodeModules.child_process.execFileSync(
  "powershell",
  ["-NoProfile", "-Command",
   `Add-Type -AssemblyName Microsoft.VisualBasic;[Microsoft.VisualBasic.FileIO.FileSystem]::${verb}('${escaped}','OnlyErrorDialogs','SendToRecycleBin')`],
  { timeout: 5000 },
)
```

**为什么会被 360 企业版上报/拦截**：

| 特征 | 命中点 |
|---|---|
| 子进程加载 PowerShell | `execFileSync("powershell", ...)` —— 桌面应用调 shell 属高危行为 |
| 内联 `-Command` 脚本 | 杀软规则「应用内联脚本执行」 |
| 反射加载 .NET 类型 | `Add-Type -AssemblyName Microsoft.VisualBasic` —— 内存内程序集加载，EDR 必检 |
| 原生删除 API | `FileSystem.DeleteDirectory/DeleteFile` 是脚本删除的标准特征 |
| 路径由外部数据拼接 | 路径来自 Everything 搜索结果 —— 看起来像「接收远程指令删文件」 |

**更严重的是它是「安全降级」**：用系统 API（`shell.trashItem`）失败时才走脚本；而**回收站 API 恰恰在受管环境里最可能被策略禁用**，于是脚本路径反而成为常态，安全软件的上报也就是常态。

**整改**：
- 删除**只走** Electron 主进程 `shell.trashItem`（remote 优先 → local 兜底，保持现有瀑布），彻底**删除 PowerShell 兜底分支**。
- 无可用通道时明确报「删除失败」，而不是偷偷换成脚本删除。
- 与资源管理器删文件走**同一条系统 API 路径**，不产生子进程、不落脚本特征、不加载额外程序集 —— 行为特征与系统原生删除一致，不触发「脚本删除」类规则。
- 同步移除对 `getNodeProcessModules`（`child_process`）的依赖。

> **取舍说明**：极端环境（回收站 API 被组策略禁用）下会退化为「提示失败」而非「删除成功」。对文件删除这种不可逆操作，**宁可失败也不引入可疑执行路径** —— 这也是本报告把 F1 排在 P0 首位的原因。

### F2. `shell.openPath` 不判返回值，失败也提示「已打开」

`useResultActions.ts`（整改前）直接 `await shell.openPath(path)` 后无条件吞掉结果。`shell.openPath` 的契约是**成功返回空串、失败返回错误描述字符串** —— 不判返回值意味着「路径已不存在 / 无关联程序 / 权限不足」全部显示成功。

**整改**：改用共享层 `@/utils/electronDialog.ts` 的 `openPathInShell(targetPath)`（内含 `fs.promises.access` 预检 + 取反返回值），失败提示 `openFailed`。**这正是 `docs/disk-browser-redundancy-review.md § F3 已经在同一仓库修过一遍的同一个 bug**。

### F3. Everything 搜索表达式被拆到两处拼接

- `index.vue:206-222` 拼 `size:>Nkb` / `size:<Nkb`，并额外处理 `empty:` 模式
- `api.ts:84-100` 拼 `path:"..."` / `!path:"..."`

后果：表达式顺序、空格、`empty:` 与 `size:` 的互斥关系全靠调用方记忆维持；**无法单测**；新增过滤条件必须同时改两个文件。

**整改**：收敛为 `utils.ts` 的纯函数 `buildSearchQuery(input): string`，顺序固定为「关键词 → 大小过滤 → 仅搜索路径 → 排除路径」，`empty:` 模式在函数内部短路大小过滤。由 `utils.spec.ts` 的 7 条断言固定行为。

### F4. `formatDate` 按数值量级「猜」时间格式

`api.ts:158-189`（整改前）用 `timestamp > 1e15` / `> 1e12` 两级阈值猜测 FILETIME / 毫秒 / 秒。问题：
- 秒级时间戳分支 `timestamp * 1000` 的条件是 `else`，即 `0 < t <= 1e9` —— 正常毫秒时间戳在 2001 年之前会落到这里被再乘 1000（虽不现实，但逻辑本身没有下界保护）
- 无 `NaN` / 负数防护
- 直接内联在 IO 函数里，不可测

**整改**：抽出 `parseEverythingDate()`（纯函数），显式处理 FILETIME / 毫秒 / 秒 / 字符串四态，非法值返回 `null`；展示格式化移到 `formatDateValue()`。响应映射同时抽成 `parseSearchResponse()` —— 覆盖「字段缺失 / 尺寸非法 / 时间格式差异」三种真实场景。

---

## 三、P1：共享组件库被系统性绕过（14 处原生控件）

`AGENTS.md § 共享组件库使用规则 2` 明令：按钮 / 输入框 / 多行文本域 / 标签 / 内联消息提示**必须**使用共享组件，例外仅限「纯展示的局部布局容器」与 `.icon-btn` 26×26 固定尺寸图标按钮。

| # | 文件 | 原生控件 | 应替换为 |
|---|---|---|---|
| 1 | `DialogHeader.vue` | 2 × `<button>`（浮动窗口 / 关闭） | `Button variant="ghost" text rounded size="xsmall"` |
| 2 | `ServiceWarning.vue` | 1 × `<button>`（重试） | `Button variant="danger" outlined size="xsmall"` + `Message` 承载提示 |
| 3 | `FrequentKeywords.vue` | 5 × `<button>` + 1 × `<input>` | `Tag :closable`（chip）/ `Button` / `Input size="xsmall"` |
| 4 | `AdvancedHelpPanel.vue` | 14 × `<button>`（语法标签） | `Button variant="ghost" outlined size="xsmall"` |
| 5 | `SearchOptions.vue` | 2 × `<input type="number">` | `Input type="number" size="xsmall"` |
| 6 | `SearchOptions.vue` | 2 × `<textarea>` | `Textarea size="xsmall" :rows="2"` |
| 7 | `ResultItem.vue` | 4 × `<button>`（打开/定位/复制/删除） | `Button variant="ghost" size="xsmall" dense rounded` |

补充说明：

- `FrequentKeywords` 的 chip **语义上就是 `Tag`**（自身即内容 + 可关闭 + 可点击）——`AGENTS.md` 对 `Tag` 与 `Badge` 的职责边界写得很清楚（「`Tag` 是行内的独立标签/徽标（自身即内容，无包裹语义）」），原实现自建了一份 chip + 内嵌 `×` 按钮，正是 `Tag.closable` 的重复实现。
- `ResultItem` 的 4 个操作按钮是**纯图标按钮**，按 `AGENTS_STYLE § 按钮交互与无障碍` 必须提供可访问名称；原实现有 `title` + `aria-label`（这点是对的），但尺寸/交互态是自建的，与库内 `Button dense` 的紧凑档（20px）不一致。

### F6. `.vp-overlay` 使用 `backdrop-filter: blur(4px)`

`styles/index.scss`（整改前）用毛玻璃遮罩。`AGENTS_STYLE § 强制规则：背景与过渡对齐 gitPush 范式` 明令：**遮罩统一 `rgba(0, 0, 0, 0.5)`，禁止 `backdrop-filter`**（Electron 下有滚动性能开销且偏离全局观感）。同时 `z-index: 99999` 不符「全屏遮罩统一 10000」。

**整改**：删 `backdrop-filter`、遮罩改 `rgba(0,0,0,0.5)`、`z-index: 10000`、补 0.12s fade + scale 0.98 过渡。

### F7. 样式硬编码

`styles/*.scss` 存在 `padding: 30px`、`font-size: 32px`（空态图标尺寸）、`border-radius: 50%`、`letter-spacing` 等非 Token 声明。`AGENTS_STYLE § 禁止事项` 要求全部走 `$s-*` / `$t-*` / `$r-*` / `$fw-*` / `$ff-*`。

**整改**：逐条换 Token（`$r-full` 替代 `50%`，空态图标改由 `IconWrapper :size` 承担而非 SCSS `font-size`）。

### F8. 60 行扩展名 → 图标映射与 diskBrowser 完全重合

`ResultItem.vue`（整改前）用普通 `<script>` 块维护 `EXT_ICON_KEY_MAP`（约 60 行）+ `getFileExtension`。`diskBrowser/utils/fileKind.ts` 的 `entryIconKey(isFile, fileName)` **职责完全相同**，且分类更完整（9 类 vs 本模块的 8 类）。

按 `AGENTS.md § 跨功能联动规则`「功能模块之间禁止直接相互导入」，**不能**直接 import diskBrowser。

**本次整改**：抽出 `everythingSearch/icons.ts` 的 `entryIconKey()`，只保留本模块用得到的映射（≤40 行），并在文件头注明「与 diskBrowser 同职责、因跨功能禁止直接导入而各自维护」。

> 📌 **遗留建议（需跨模块决策，本次未做）**：把扩展名 → `IconKey` 映射**下沉到 `src/utils/fileKind.ts`**，`diskBrowser` 与 `everythingSearch` 各自转调。这属于「共享层新增能力」，涉及另一个 feature 的写范围，应由维护者按 `AGENTS.md § 统一入口原则`统一决策 —— 报告登记，不在本次改动内夹带。

### F9. `isSystemPath` 覆盖面不足（删除守卫）

`api.ts`（整改前）的 `SYSTEM_ROOT_DIRS` 只比对**盘符根下一级目录名**，且只用于「空文件夹搜索」的结果过滤：

```ts
const ROOT_DIR_REGEX = /^[a-z]:\\([^\\]+)(?:\\|$)/i
return SYSTEM_ROOT_DIRS.includes(match[1].toLowerCase())
```

三处不足：
1. 只覆盖盘符根一级（`C:\Windows\...` 命中，但 `C:\Users\me\AppData\Local\Microsoft\Windows\...` 不命中）
2. 不覆盖盘符根关键文件（`pagefile.sys` / `hiberfil.sys` / `bootmgr` / `swapfile.sys`）
3. 只用于「搜索结果过滤」，**删除入口本身没有守卫**

**整改**：升级为 `utils.ts` 的 `isProtectedPath()`，覆盖三级（根级系统目录 / 根级关键文件 / 任意层级的系统区域片段），并**在删除入口调用**（`useResultActions.handleItemDelete` 与缓存清理的 `cleanCacheEntries` 双重守卫）。新增 `isPathInside()` 供「白名单包含性」校验。

**删除守卫的三道闸**（缓存清理侧）：
1. 路径必须落在某个**已解析的白名单根**之内（`isPathInside`）
2. 路径不得等于根自身（只能删根**内**的条目）
3. 路径不得命中 `isProtectedPath()`（系统区域二次复核）

即使白名单被误配，第 3 道闸也会拦住系统目录。

### F10. 结果行键盘不可达

`ResultItem.vue` 的行用 `@dblclick="handleOpen"` 打开，鼠标可达但键盘/触屏不可达。**整改**：补 `role="button"` + `tabindex="0"` + Enter/Space 键盘打开，并保留「双击」语义（单击已有 `.stop` 保护，不会误触）。

### F11 / F12. 架构：纯逻辑混在 IO 层、主面板接近 300 行

- `api.ts` 整改前同时承担：HTTP 请求、表达式拼接、响应映射、时间格式化、路径拼接、系统路径判定 —— 六种职责。**整改**：只留 fetch，其余入 `utils.ts`（可单测）。
- `index.vue` 整改前 389 行，且新增「缓存清理」Tab 后必然膨胀。**整改**：把纯逻辑移入 `utils.ts` / composable，`index.vue` 只保留编排；新增的两个 Tab 面板各自独立组件。

---

## 四、扩展：Windows 缓存目录扫描

### 4.1 设计目标

用户要求：**扫描 Windows 缓存目录，且显示的内容「删了不影响系统」，同时不触发 360 企业版报毒/上报**。

两个诉求指向同一个设计原则：**只读扫描 + 白名单删除 + 系统 API 删除**。

### 4.2 安全模型（三层）

```
第一层：扫描范围固定（白名单根）
  CACHE_ROOTS 是唯一定义源，只有 7 个固定位置，不接受用户任意输入路径
        ↓
第二层：扫描时排除（不展开、不收集）
  isProtectedPath() 复核；跳过符号链接 / junction（防循环与跨盘误删）
        ↓
第三层：删除时三重守卫（见 § F9）
  isPathInside(白名单) && path !== root && !isProtectedPath()
```

### 4.3 缓存根清单

| 根 | 位置 | 风险 | 默认勾选 | 删除后的影响 |
|---|---|---|---|---|
| `userTemp` | `%TEMP%` | safe | ✅ | 程序按需重建临时文件 |
| `windowsTemp` | `C:\Windows\Temp` | caution | ✅ | 同上；个别被系统进程占用的文件会删除失败（已容错跳过） |
| `crashDumps` | `%LOCALAPPDATA%\CrashDumps` | safe | ✅ | 仅丢失历史崩溃转储（排障用） |
| `browserCache` | Edge / Chrome 等的 `User Data\...\Cache` | safe | ❌ | 浏览器重建缓存；首访变慢。**默认不勾**（用户可能正开着浏览器） |
| `packageCache` | `C:\ProgramData\Package Cache` | caution | ❌ | 修复/卸载已装程序时需重新下载安装包 |
| `npmCache` | `%LOCALAPPDATA%\npm-cache` | safe | ✅ | `npm install` 重新下载依赖 |
| `devCache` | `~\.cache`、`%LOCALAPPDATA%\vite` 等 | safe | ✅ | 构建工具重新生成 |

**明确不扫、不删**（即使被误配进白名单也会被 `isProtectedPath` 拦下）：
`C:\Windows`（全部）、`C:\Windows\System32`、`C:\Windows\WinSxS`（组件存储，删了系统更新与修复会坏）、`C:\Program Files`、`C:\Program Files (x86)`、`C:\ProgramData`（除上面单列的 Package Cache）、`$Recycle.Bin`、`System Volume Information`（卷影/还原点）、`Recovery`、`Boot`、`PerfLogs`、`$WINDOWS.~BT` / `$WINDOWS.~WS`（升级回滚数据）、`MSOCache`、`AppData\Local\Packages`（UWP 应用数据，不是缓存）、`AppData\Local\Microsoft\Windows` / `AppData\Roaming\Microsoft\Windows`（系统用户配置）、盘符根关键文件（`pagefile.sys` / `hiberfil.sys` / `swapfile.sys` / `bootmgr` / `bootnxt` / `bootsect.bak`）。

### 4.4 为什么这样不会被 360 企业版上报

| 常见触发点 | 本实现 |
|---|---|
| 调用 PowerShell / cmd / WMI | ❌ 完全不用（F1 已移除唯一的 PowerShell 路径） |
| 子进程执行 | ❌ 全流程零子进程 |
| 反射加载程序集 | ❌ 无 `Add-Type` |
| 直接 `DeleteFile` 系统 API | ⚠️ 仅「永久删除」模式用 `fs.rmSync`（Node 标准 API），且默认模式是回收站 |
| 遍历磁盘全盘 | ❌ 只遍历 7 个固定目录，不递归全盘 |
| 修改注册表 / 服务 / 计划任务 | ❌ 完全不触碰 |
| 网络外发 | ❌ 不联网（Everything HTTP 请求是本机 localhost） |
| 删除可执行文件 | ⚠️ 可能删到 `.exe` 安装包（`packageCache`），故该根默认不勾且标 caution |

**核心差异**：本功能是「**清理缓存**」而非「**任意删除**」。前者是安全软件**认可**的常规运维行为（各家管家都有），后者才会触发上报。实现上通过「固定白名单 + 系统回收站优先 + 零子进程」把行为特征压到最低。

> ⚠️ **诚实声明**：任何带删除能力的软件都无法**保证**不被某版本安全软件误报（启发式规则会演进）。本实现能做的是**消除全部已知高危行为特征**，并在默认配置下**只走回收站**（可还原）。报告中不宣称「绝对不报毒」。

### 4.5 默认配置的保守取向

| 配置 | 默认值 | 理由 |
|---|---|---|
| 清理方式 | **移入回收站** | 可还原；永久删除需用户显式切换并二次确认 |
| 近期文件门槛 | **5 分钟** | 正在被写入的临时文件跳过，降低「删了程序正在用的文件」概率 |
| 条目上限 | 3000 | 防止海量小文件拖垮面板 |
| 浏览器缓存 / 安装包缓存 | **默认不勾** | 副作用可见（首访变慢 / 重下安装包），交由用户判断 |
| 扫描触发 | **手动**（不自动扫） | 避免启动即遍历磁盘引发安全软件关注 |

---

## 五、整改清单总览

### 新增文件

| 文件 | 职责 |
|---|---|
| `utils.ts` | 纯函数层：`buildSearchQuery` / `normalizeWinPath` / `isProtectedPath` / `isPathInside` / `getFullPath` / `parseEverythingDate` / `summarizeSize` / `sizeSeverity` |
| `utils.spec.ts` | 上述纯函数的行为断言（27 条） |
| `icons.ts` | 扩展名 → `IconKey`（收编 `ResultItem.vue` 的 60 行内联映射） |
| `types/cacheScan.ts` | 缓存清理全部类型（根定义 / 扫描结果 / 清理结果 / 进度） |
| `cacheScan/roots.ts` | `CACHE_ROOTS` 白名单唯一真源 + `resolveCacheRoots()` |
| `cacheScan/fsUtils.ts` | 递归体积统计 / 取消与让出事件循环（扫描与清理共用底层） |
| `cacheScan/scanner.ts` | `scanCacheRoots()`（只读扫描） |
| `cacheScan/cleaner.ts` | `cleanCacheEntries()` / `isAllowedCachePath()`（三重守卫下的删除） |
| `composables/useCacheClean.ts` | 缓存清理面板的编排状态（扫描 / 选择 / 清理 / 取消） |
| `composables/useFileSearch.ts` | 文件搜索编排（防抖 / 竞态序号 / 空文件夹模式 / 服务探活） |
| `components/PanelTabs.vue` | 双 Tab 切换栏（共享 Tabs 五件套的薄封装） |
| `components/SearchPathFilter.vue` | 路径范围过滤（从 SearchOptions 拆出，控制单文件行数） |
| `components/cacheClean/` | 缓存清理面板 UI（容器 + 根列表 + 条目列表） |
| `styles/CacheClean*.scss` | 对应样式 |

### 改动文件

| 文件 | 改动 |
|---|---|
| `api.ts` | 只留 fetch；表达式拼接 / 响应映射 / 时间解析 / 路径判定全部外移 |
| `types/index.ts` | 拆出 `cacheScan.ts`；`SearchOptions` 不再重复声明排序字段 |
| `types/storage.ts` | 新增 `CacheCleanSettings`（含 `enabledRoots` / `mode` / `maxEntries` / `minAgeMinutes`） |
| `composables/useSearchConfig.ts` | 托管 `cacheSettings` |
| `composables/useResultActions.ts` | **删除 PowerShell 兜底**；删除前系统路径守卫；`openPath` 判返回值 |
| `index.vue` | 双 Tab（文件搜索 / 缓存清理）；纯逻辑移出；过渡动画接线 |
| `components/*.vue`（7 个） | 原生控件 → 共享组件；无障碍补齐 |
| `styles/*.scss`（8 个） | 去 `backdrop-filter`、修 `z-index`、硬编码 → Token |
| `README.md` | 补双 Tab 说明与新目录结构 |
| `i18n/{zh_CN,en_US}/everythingSearch.json` | 新增缓存清理文案（含 `cacheRoot*` 7 条） |

---

## 六、验证

| 检查 | 命令 | 执行方 |
|---|---|---|
| 纯函数单测 | `pnpm test` | ✅ AI 执行 |
| i18n 键对齐 | `pnpm i18n:verify` | ✅ AI 执行 |
| 图标注册有效 | `pnpm validate:icons` | ✅ AI 执行 |
| 类型检查 | `pnpm typecheck`（`vue-tsc`，**不可用 `tsc`**） | ✅ AI 执行 |
| ESLint | `pnpm lint` | 用户 |
| 构建 | `pnpm build` | 用户 |
| SCSS 编译 | 构建时 | 用户 |

> 已知基线：`pnpm typecheck` 在本仓库有 **2 条既有错误**（`src/features/aiContentGenerator/skills/components/{CopySkillModal,SkillCard}.vue` 找不到 `../../SkillsManager`），与本次改动无关。
