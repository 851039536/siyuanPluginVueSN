# Everything Search 功能代码审查与修复计划

## 摘要

对 `src/features/everythingSearch/` 全模块（index.ts / index.vue / api.ts / types/ / components/ 9 个子组件 / i18n 分片 / styles）进行审查，共发现 **17 项问题**：6 项逻辑漏洞、3 项冗余、1 项死代码、1 项重复类型、4 项 AGENTS 规范违规、1 项跨模块内存泄露（App.vue，用户已确认纳入）、1 项低优先级 UX 不一致。用户已确认：**全部修复**。

本次为功能内部重构 + 定点修复，**不触及 8 步功能注册链**（无 register/导出/设置/配置/图标注册变化）。

---

## 一、问题清单（审查结论）

### P1 逻辑漏洞

| # | 问题 | 位置 | 严重度 |
|---|------|------|--------|
| 1 | **搜索竞态（stale overwrite）**：`handleSearch` 无请求序号守卫。快速连续搜索（Enter 直搜绕过防抖 + 选项切换立即触发 `handleSearch`）时多个 `searchFiles` 并发，慢的旧请求后返回会覆盖新结果 | index.vue `handleSearch` | 高 |
| 2 | **快速关-开弹窗丢失配置**：保存防抖 500ms 内关闭再打开弹窗，`loadConfig` 用旧存储值覆盖内存修改，随后防抖定时器把回滚后的值写回，用户修改丢失 | index.vue `loadConfig`/`saveConfigToPlugin` | 中 |
| 3 | **PowerShell 兜底删除三缺陷**：① `execSync` 经 cmd.exe 执行，文件名含 `%` 时被 cmd 变量展开（如 `%TEMP%`）；② `DeleteFile` 对文件夹必然失败（而"空文件夹"正是本功能主打场景）；③ 裸 `window.require("child_process")` 违反 Node 模块统一入口规则 | index.vue `handleItemDelete` | 中 |
| 4 | **端口输入无校验**：清空端口输入时 `Number("") = 0`，config.port=0 后所有请求静默失败 | DialogFooter.vue | 低 |
| 5 | **shell 降级顺序缺陷**：`getRemoteShell() ?? getShell()` —— remote shell 存在但无 `trashItem` 时，本地 shell 的 `trashItem` 永远不会被尝试 | index.vue `handleItemDelete` | 低 |
| 6 | **删除后状态误报**：删除 `await` 期间若新搜索完成，`results.filter` 在新数组上空转；新结果为空时误置 `status="empty"` 显示"未找到匹配的文件" | index.vue `handleItemDelete` | 低 |

### P2 冗余

| # | 问题 | 位置 |
|---|------|------|
| 7 | **`EXT_ICON_KEY_MAP` 每实例重建**：定义在 `<script setup>` 内，注释错误声称"模块级常量，避免每次求值重建"——实际 script setup 顶层代码每个组件实例执行一次，500 条结果 = 重建 500 次 60 键对象 | ResultItem.vue |
| 8 | `handleSearch` 内逐字段手工拷贝 11 个选项构造 API 参数（14 行） | index.vue |
| 9 | `watch([config, options], ..., { deep: true })`：reactive 源已隐式 deep，`deep: true` 冗余 | index.vue |

### P3 死代码

| # | 问题 | 位置 |
|---|------|------|
| 10 | i18n 键 `close` 在 zh_CN/en_US 分片中均存在，但组件中无任何引用 | i18n/{zh_CN,en_US}/everythingSearch.json |

### P4 重复类型

| # | 问题 | 位置 |
|---|------|------|
| 11 | `EverythingSearchOptions`（api.ts）的 11 个字段与 `SearchOptions`（types/index.ts）完全重复定义；`sort` 联合类型 `"name" \| "path" \| "size" \| "date_modified"` 在两处重复 | api.ts / types/index.ts |

### P5 AGENTS 规范违规

| # | 问题 | 位置 |
|---|------|------|
| 12 | index.vue 共 525 行，超过 500 行硬阈值（需拆分 composables/） | index.vue |
| 13 | 裸 `window.setTimeout`（防抖搜索 + 防抖保存），未走 `TimerRegistry` 统一入口 | index.vue |
| 14 | `import { Plugin } from "siyuan"` 仅作类型使用，应为 `import type` | types/storage.ts |
| 15 | ResultItem 4 个操作按钮用 `<svg><use xlink:href="#iconOpen">` 等原始引用：`#iconOpen` 全仓库无注册处（非思源内置则图标空白），且违反"使用已注册 Iconify 图标"规则 | ResultItem.vue |

### P6 跨模块内存泄露（用户已确认纳入）

| # | 问题 | 位置 |
|---|------|------|
| 16 | App.vue `onMounted` 注册的 **21 个 window 事件监听器**（含 `openEverythingSearch`）全部为匿名函数且无 `onUnmounted` 清理，插件每次重载累积一套重复监听器 | App.vue L164-275 |

### 低优先级 UX 不一致

| # | 问题 | 位置 |
|---|------|------|
| 17 | 搜索按钮 `:disabled="isSearching \|\| !modelValue?.trim()"`：路径过滤启用时空查询按钮禁用，但 Enter 键与父组件逻辑均允许搜索（`hasPathFilter`） | SearchBar.vue |

### 审查确认无问题 / 不修项（记录）

- **内存泄露（功能内）**：防抖定时器在 `onUnmounted` 清理 ✓；Manager 经 `DESTROYABLE_KEYS` 统一销毁 ✓；`deletingItems` 在 finally 清理 ✓；模块级 `tabRegistered` 防重复注册 ✓
- `formatDate` 的 string 分支：防御性代码，保留
- `EverythingSearchStorage.init()` 仅一处调用：API 语义清晰，保留
- `openTabInMainWindow` 的 `|| "Everything搜索"` 兜底：TS 侧启动防御，非模板硬编码兜底，保留
- overlay 与 tab 双实例状态不互通：设计取舍，每次打开 `loadConfig` 已缓解，不修
- App.vue `window._sy_plugin_sample` 全局挂载：疑似供外部脚本使用，不动
- styles/ 与 i18n 其余键：全部有引用，无死样式/死键

---

## 二、修改方案

### 1. 新建 `src/features/everythingSearch/composables/useSearchConfig.ts`（约 130 行）

从 index.vue 迁出配置持久化域：

```ts
export function useSearchConfig(plugin: Plugin) {
  const storage = new EverythingSearchStorage(plugin)
  const config = reactive<EverythingConfig>({ ...DEFAULT_CONFIG })
  const options = reactive<SearchOptions>({ ...DEFAULT_OPTIONS })
  const timerRegistry = new TimerRegistry()   // 修复 #13
  let saveTimer: TimerHandle | null = null
  let isLoadingConfig = false

  const persist = async () => { await storage.config.save(config); await storage.options.save(options) }

  const loadConfig = async () => {
    // 修复 #2：冲刷-再加载——先把 pending 的防抖保存立即落盘，再用存储值回填，消除丢修改竞态
    if (saveTimer !== null) { timerRegistry.clear(saveTimer); saveTimer = null; await persist() }
    isLoadingConfig = true
    try {
      const saved = await storage.init()
      Object.assign(config, saved.config)
      Object.assign(options, saved.options)
    } catch (error) { console.error("从插件存储加载配置失败:", error) }
    finally { await nextTick(); isLoadingConfig = false }
  }

  const saveConfigToPlugin = () => {          // 修复 #13：TimerRegistry 托管
    timerRegistry.clear(saveTimer)
    saveTimer = timerRegistry.setTimeout(() => { void persist().catch(...) }, 500)
  }

  watch([config, options], () => {            // 修复 #9：去掉冗余 deep
    if (isLoadingConfig) return
    saveConfigToPlugin()
  })

  const updateOption = (key, value) => Object.assign(options, { [key]: value })
  const updateConfig = (key, value) => Object.assign(config, { [key]: value })
  const addKeyword = (kw: string) => { options.frequentKeywords.push(kw) }
  const deleteKeyword = (kw: string) => { ...splice... }

  onUnmounted(() => timerRegistry.clearAll())
  return { config, options, loadConfig, updateOption, updateConfig, addKeyword, deleteKeyword }
}
```

### 2. 新建 `src/features/everythingSearch/composables/useResultActions.ts`（约 130 行）

从 index.vue 迁出结果操作域，签名 `useResultActions(i18n: ComputedRef<Record<string, string>>, searchState: SearchState)`：

- 迁出 `getShell` / `getRemoteShell` / `handleItemOpen` / `handleItemShowInFolder` / `handleItemCopyPath` / `deletingItems`
- **修复 #5**：shell 瀑布尝试——`const shells = [getRemoteShell(), getShell()].filter(Boolean)`，先在所有 shell 中找 `trashItem`，再找 `moveItemToTrash`
- **修复 #3**：PowerShell 兜底改用 `getNodeProcessModules().child_process.execFileSync("powershell", ["-NoProfile", "-Command", script], { timeout: 5000 })`（无 cmd shell → 无 `%` 展开向量；走统一入口）；按 `item.type` 选择 `DeleteFile` / `DeleteDirectory`
- **修复 #6**：删除成功后 `if (searchState.results.includes(item))` 才执行 filter + 置 empty

### 3. 改 `index.vue`（525 行 → 约 330 行，修复 #12）

- 引入两个 composable，删除迁出代码；`handleOptionUpdate` 改为 `updateOption(key, value)` + 重搜判断；`handleConfigUpdate` 改为 `updateConfig(key, value)` + **host/port 变更后 `void checkService()`**（顺带修复改端口需手动重试的小缺陷）
- **修复 #1**：模块域 `let searchSeq = 0`；`handleSearch` 内 `const seq = ++searchSeq`，`await searchFiles` 返回后 `if (seq !== searchSeq) return` 丢弃过期响应（try 与 catch 两处都守卫）
- **修复 #8**：提取 `buildApiRequest(options, query): EverythingSearchOptions` 纯映射函数（值级映射保持显式，不用 rest 解构——`unused-imports/no-unused-vars` 会警告未使用解构变量）
- **修复 #13**：`debouncedSearch` 的防抖定时器改走 `TimerRegistry` 实例（组件内自建，`onUnmounted` clearAll）
- `hasPathFilter` / `createEmptySearchState` / searchState / visible watch / isFloating / handleOpenFloating 留守

### 4. 改 `api.ts`（修复 #11 类型侧）

```ts
export type EverythingSortField = "name" | "path" | "size" | "date_modified"
export interface EverythingSearchOptions {
  query: string
  ...
  sort?: EverythingSortField
  ...
}
```

其余逻辑不动。

### 5. 改 `types/index.ts`（修复 #11）

```ts
import type { EverythingSearchOptions } from "../api"

/** 搜索选项 = API 透传字段（必选化）+ UI 专属字段 */
export interface SearchOptions extends Required<Omit<EverythingSearchOptions, "query">> {
  debounceDelay: number
  advancedMode: boolean
  minSize: number; minSizeUnit: "KB" | "MB" | "GB"
  maxSize: number; maxSizeUnit: "KB" | "MB" | "GB"
  frequentKeywords: string[]
}
```

消除 11 个字段 + sort 联合的重复定义。`DEFAULT_OPTIONS` 常量不变（仍显式全量列出）。

### 6. 改 `types/storage.ts`（修复 #14）

`import { Plugin } from "siyuan"` → `import type { Plugin } from "siyuan"`。

### 7. 改 `components/ResultItem.vue`（修复 #7、#15）

- 新增普通 `<script lang="ts">` 块：`EXT_ICON_KEY_MAP` + `getFileExtension` 移入（真正的模块级，每渲染进程一次），删除错误注释；`<script setup>` 通过 import 使用
- 4 个操作按钮的 `<svg><use xlink:href="#iconXxx" /></svg>` 替换为已注册图标（IconWrapper，本文件已引入）：
  - 打开：`openInNew`（mdi:open-in-new）
  - 资源管理器显示：`folder`
  - 复制路径：`copy`
  - 删除：`delete`
- ResultItem.scss 的 `.vp-result-item__action svg` 选择器对 iconify 输出的 svg 同样生效，**样式无需改动**

### 8. 改 `components/DialogFooter.vue`（修复 #4）

端口输入处理：`const n = Number(value); if (Number.isFinite(n) && n > 0 && n <= 65535) updateConfig("port", n)`——非法/空输入不回写。

### 9. 改 `components/SearchBar.vue`（修复 #17）

新增 `canSearch?: boolean` prop（父组件传 `hasPathFilter()`），按钮 disabled 改为 `isSearching || !(modelValue?.trim() || canSearch)`。

### 10. 改 `i18n/zh_CN/everythingSearch.json` + `i18n/en_US/everythingSearch.json`（修复 #10）

两个分片各删除无引用的 `"close"` 键。

### 11. 改 `src/App.vue`（修复 #16）

- `onMounted` 内新增局部 `addWindowListener(type, listener)` 辅助函数：`window.addEventListener` 并推入 `windowListeners: Array<{ type: string; listener: EventListener }>`；21 个监听器逐个改用该函数注册（handler 逻辑原样保留，只换注册方式）
- 新增 `onUnmounted(() => { for (const { type, listener } of windowListeners) window.removeEventListener(type, listener); windowListeners.length = 0 })`
- 补充 `onUnmounted` 的 vue 导入

### 12. 改 `src/features/everythingSearch/README.md`

目录结构小节补充 `composables/`（useSearchConfig / useResultActions）。

---

## 三、假设与决策

1. **竞态守卫用请求序号而非 AbortController**：不依赖 `AbortSignal.any`，改动最小，过期响应直接丢弃即可（搜索请求本身轻量，无需取消网络）
2. **不创建 utils.ts**：Rule of Three——`getFullPath`/`isSystemPath` 仅 2 处使用，保留在 api.ts
3. **`buildApiRequest` 值级映射保持显式字段**：避免 rest 解构触发 `unused-imports/no-unused-vars` 警告
4. **`iconOpen` 直接替换为已注册的 `openInNew`**：不再依赖无法离线验证的思源内置图标，同时满足图标统一注册规则
5. **8 步注册链不动**：纯功能内重构，`FEATURE_CONFIG`/`features/index.ts`/`settings.ts`/`icons.ts` 均无需变更
6. **App.vue 只补监听器清理**：`window._sy_plugin_sample` 全局挂载等其余历史行为不动

## 四、验证步骤

AI 执行（构建/lint 以外）：
```bash
pnpm i18n:merge     # 重新生成 zh_CN.json / en_US.json（分片已改）
pnpm i18n:verify    # 中英键对齐校验
npx tsc --noEmit    # 类型检查（含 SearchOptions 派生重构）
```

用户执行（AGENTS 规定 AI 不运行）：
```bash
pnpm lint
pnpm dev            # 手动验证
```

手动验证清单：
1. 快速连续输入/按 Enter/切换选项 → 结果始终为最新查询（竞态修复）
2. 修改选项后 500ms 内关闭再打开弹窗 → 修改未丢失（冲刷-再加载）
3. 删除文件/空文件夹 → 移入回收站、列表即时移除；含 `%` 或空格的文件名可删除
4. 清空端口输入 → 端口不被置 0；修改地址/端口后服务状态自动重检
5. 独立窗口打开（addTab+openWindow）、关闭浮窗回主窗口 → 图标正常（openInNew/folder/copy/delete）
6. 插件重载（禁用→启用）→ 无重复监听器（DevTools 可断点验证 removeEventListener）
