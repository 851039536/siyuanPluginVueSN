# 脚本启动器（scriptLauncher）代码审查报告

- 审查日期：2026-10-26
- 审查范围：`src/features/scriptLauncher/` 全部 14 个文件（index.ts / index.vue / types×2 / composables×2 / components×3 / styles×4），联动验证 `eventBus.ts`、`vueAppHelper.ts`、`src/index.ts` DESTROYABLE_KEYS。
- 结论速览：**P0 正确性缺陷 3 个，P1 健壮性缺陷 5 个，P2 死代码/冗余 8 处，P3 小问题 6 处；存在 2 处有界内存泄漏；无重复类型定义。**

---

## P0 正确性缺陷（建议优先修复）

### P0-1 修改脚本语言后用错误的解释器执行
- 位置：`types/storage.ts` `update()` + `composables/useScriptRunner.ts` `getCommandAndArgs()`
- 问题：`update()` 修改 `language` 时不重写 `fileName`；而运行时 `getScriptPath()` 基于 `fileName` 取路径、`getCommandAndArgs()` 基于 `script.language` 选解释器。把 Python 脚本改成 Node.js 后，会用 `node.exe` 执行 `.py` 文件。同时 name 变更后 fileName 保持旧值，`ScriptList` 显示的 `data/storage/sc/{{ fileName }}` 与脚本名永久脱钩，用户困惑。
- 修复建议：`update()` 中 language 变化时同步重写 fileName（并重命名磁盘文件），或运行时按 fileName 实际扩展名推断解释器。

### P0-2 stopProcess 终止判定与实际结果矛盾
- 位置：`useScriptRunner.ts` `stopProcess()`
- 问题：Windows 上 taskkill 失败（如权限不足）但句柄 `kill("SIGKILL")` 成功时，`terminated = winKillOk`（不含 killOk）→ 返回 `ok:false`「进程停止失败」，但进程实际已被杀死；且 `target.status` 已无条件置为 `killed`，UI 状态与返回值矛盾。
- 修复建议：`terminated = winKillOk || killOk`，或在句柄 kill 成功时也返回 ok。

### P0-3 面板重建后「真身 entry」与「展示 entry」对象脱节，输出静默丢失
- 位置：`useScriptRunner.ts`（模块级 `procHandles` + `restoreProcesses`）+ `index.vue` onMounted/onUnmounted
- 问题链：Dock 面板关闭再打开时 Vue 实例重建，但模块级 `procHandles` 仍持有活的 child 进程句柄；`restoreProcesses()` 用 `persist.load()` 生成 **spread 副本**而非复用原 entry。此后：
  1. 旧闭包中 stdout/stderr 监听持续往**旧 entry 对象**追加输出（上限 200KB/100KB），新面板永远看不到 —— 输出静默丢失；
  2. `scheduleNotify` 的 120ms 定时器继续对已脱离 DOM 的旧 `processes` ref 触发 `notify()`；
  3. 用户点「停止」时 `stopProcess` 改的是新副本的 status，而 close 事件回调改的是旧 entry —— 两者状态可能不一致。
- 修复建议：`restoreProcesses()` 中若 `procHandles.has(p.id)` 则直接沿用原 entry 对象（不 spread）；或在面板 `onUnmounted` 时对 running 进程移除 data 监听/标记 stale 停止 append。

---

## P1 健壮性缺陷

### P1-1 ID 生成基于毫秒时间戳，可碰撞
- 位置：`types/storage.ts` `add()` / `importFileContent()` —— `script-${Date.now()}`
- 同毫秒内连续两次创建（如保存按钮双击、无防抖）产生重复 id，后续 `update/remove/updateLastRun` 的 `findIndex` 命中首条即可误伤。建议改用 `crypto.randomUUID()` 或时间戳 + 随机后缀（进程 id 生成处已用随机后缀，脚本元数据没有）。

### P1-2 importFileContent 无查重，与 add() 规则不一致
- 同一文件导入两次：`putContent` 覆盖同一物理文件，但元数据 push 两条同名 Script（同名同 fileName），列表出现两条指向同一文件的重复项。`add()` 有 `isNameUnique` 校验，导入没有。建议导入前查重（存在则更新 description/updatedAt 而非新增）。

### P1-3 dismissProcess 竞态可产生孤儿进程
- 位置：`index.vue` `dismissProcess()`
- 对运行中条目「关闭」：先 `stopProcess(id)` 再无条件从列表移除。若 `stopProcess` 返回 `ok:false`（杀失败，如权限不足），条目仍被移除 → 进程继续在后台跑但监控列表里没有它。建议仅在确认终止后移除，杀失败保留条目并提示。

### P1-4 execSync 阻塞渲染进程 UI 线程
- 位置：`useScriptRunner.ts` `killTreeSync` / `isProcessAliveSync`
- 两者均为 `execSync`，运行在渲染进程。`stopAllProcesses()` 循环同步杀多个进程；`restoreProcesses()` 在**面板挂载路径上**对每个遗留进程同步执行 tasklist —— 遗留进程多时打开面板明显卡顿。建议异步化（exec + Promise.all），至少 restore 校验改异步并行。

### P1-5 launchScript 失败提示不准确
- 位置：`index.vue` `handleRun()`
- 内置监听模式下 spawn 失败（如 python 未安装、spawn 抛错）一律返回 false，`handleRun` 统一显示 `launchFailedEnvNotSupported`（「环境不支持」），误导用户。建议 `launchScript` 返回失败原因，或区分「环境不支持」与「启动失败」。

---

## P2 死代码 / 冗余

| # | 位置 | 问题 | 建议 |
|---|------|------|------|
| 1 | `types/storage.ts` 构造函数 | `_dataDir` 参数从未使用，所有调用点传 `""` | 删除参数 |
| 2 | `types/storage.ts` `init()` | no-op，仍被 `ScriptLauncher.init()` await | 删除 |
| 3 | `ProcessPersistApi.clear` / `clearRunningProcesses()` | 全链路无调用 | 删除，或落地到「清空监控列表」场景 |
| 4 | `ScriptEditor.vue` `plugin` prop | 声明并传入，组件内从未使用 | 删除 prop 及传参 |
| 5 | `ScriptEditor.vue` `errors` | 只在 resetForm 清空、从未写入 → `isValid` 中 `Object.keys(errors).length === 0` 恒真，`errors.name` 传给 Input 永远为空 | 要么补前端校验（重名/非法文件名字符），要么删掉 errors 机制（现状：唯一性错误实际走 add() throw → catch → showMessage） |
| 6 | `useScriptRunner.ts` `getSpawnOptions()` | `windowsHide` 赋值两次（if 外 + win32 分支内）；`windowsVerbatimArguments:false`、`detached:false` 均为 Node 默认值；注释提 CREATE_NO_WINDOW 但代码只靠 windowsHide | 精简为 `{ windowsHide: true }`，修正注释 |
| 7 | `RunningMonitor.vue` `statusVariant` | 返回类型含 `"info"` 但永不返回 | 类型收窄 |
| 8 | `RunningMonitor.vue` `runningCountLabel` | 仅 `String(runningCount.value)` 的包装 computed | 可内联 |

另：`registerScriptLauncher` 返回 launcher 但调用点不接收返回值（AGENTS.md 也禁止接收）——去掉 return 保持签名纯净。

---

## P2 逻辑冗余（双重加载）

- 位置：`composables/useScriptStorage.ts`
- `add/update/delete` 内已显式 `await loadScripts()`，随后 `emitCustomEvent("scriptDataChanged")`（默认派发到 window）又被**自己注册的** window 监听器接收，再次触发 `loadScripts()` —— 每次 CRUD 双重加载。
- 该事件名过于泛化且挂在全局 window，有跨功能撞名风险（当前仅本功能使用）。
- 建议：若监听器仅为跨实例同步，去掉函数内的显式调用；否则去掉自监听。事件名加前缀，如 `scriptLauncher:dataChanged`。

---

## 内存泄露专项

1. **旧 entry 对象 + 定时器残留**（P0-3 同源，有界但持续）：面板 unmount 不清理 stdout/stderr 监听与 `scheduleNotify` 定时器，对长跑高频输出脚本，输出持续累积在脱离响应式系统的对象上（每 entry 上限 200KB/100KB），定时器持续空转 notify 旧 ref。
2. **procHandles 模块级 Map 生命周期过长**：句柄仅在 close/error/stop 时删除。`dismissProcess` 只从列表移除，若 `stopProcess` 失败句柄仍滞留到 close 事件到来。建议 dismiss 时对仍有句柄的条目强制 `procHandles.delete`。
3. **轻微**：`index.vue` onUnmounted 的 `storage.saveRunningProcesses(processes.value)` 未 catch（其它处均 `void + catch`），存在 unhandled rejection 可能。

---

## 重复类型专项

- ✅ **无重复类型定义**。`I18n`、`Script`、`RunningProcess` 等均单源于 `types/index.ts`，组件导入路径写法不一（`"../types"` vs `"../types/index"`）但指向同一模块，建议统一为 `"../types"`。
- `BufferLike`/`SpawnedProcess` 为本地最小接口模拟（有意避免依赖 @types/node），可接受，但 `SpawnedProcess.on` 的 close 回调参数类型 `code: number | null` 与 error 事件实际参数（Error 对象）不符 —— 当前 error 回调恰好未用参数所以未爆雷，属类型撒谎。

---

## P3 小问题

1. `ScriptList.vue` `formatLastRun` 硬编码中文（"刚刚"/"分钟前"），en_US 环境仍显示中文 —— i18n 违规。
2. `index.vue` `handleDelete` 用 `window.confirm`（带 eslint-disable 自证），与插件内统一 Modal 确认交互不一致。
3. `ScriptEditor.vue` mask 点击直接关闭，编辑内容丢失无确认。
4. `add()` 文件名未清洗非法字符（`\/:*?"<>|`），会导致 putFile 失败或路径异常；错误信息为英文硬编码（"Script name already exists"）。
5. `index.vue` onMounted 首行 `await storage.loadSettings()` 无 try/catch，失败会中断后续 restoreProcesses 与 setOnDestroy 注册。
6. `SCRIPT_LANGUAGE_CONFIG.other` 扩展名 `.txt` 但 `IMPORT_ACCEPT` 不含 `.txt`；且 `other` 类脚本走 `getCommandAndArgs` default 分支直接 spawn 文件路径本身，Windows 上必然失败 —— 「其他」语言在内置监听模式下实际不可用，UI 应提示或禁用。

---

## 修复优先级建议

1. **第一批（正确性）**：P0-1（语言/解释器错配）、P0-2（停止判定）、P0-3（恢复副本脱节）。
2. **第二批（健壮性）**：P1-1 ~ P1-5。
3. **第三批（清洁度）**：P2 死代码表 8 项 + 双重加载 + 泄漏点 3 的 catch 补齐。
4. **第四批（体验/i18n）**：P3 各项。
