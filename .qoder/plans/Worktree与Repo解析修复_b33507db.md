# WorktreeOps 与 RepoOps 解析修复

## 范围
仅修改 `src/features/gitPush/managers/WorktreeOps.ts` 与 `RepoOps.ts`。方法签名与返回类型不变，上层无需改动。

## #1 重命名文件 porcelain 解析出错（WorktreeOps，核心）

根因：[getWorkingTreeStatus](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/managers/WorktreeOps.ts#L52-L85) 先对整行路径部分做"去首尾引号"，再按 ` -> ` 拆分。当重命名行是 `R  "old" -> "new"`（含特殊字符被 quote）时，整串被误当单一引号路径 `slice(1,-1)`，引号错位，`oldPath`/`actualPath` 解析错乱，导致后续 diff/discard 作用于错误文件名。

修复：调整顺序——先拆分 ` -> `，再对两段各自 unquote。采用最小改动（不引入 `-z` 重写，因 porcelain v1 对仅含空格路径不加引号，风险集中在引号处理）：

```ts
// git porcelain 仅对含特殊字符的路径加引号（core.quotepath=false 下非 ASCII 不加），去引号需按 -> 拆分后分别处理
const unquote = (s: string): string => {
  const t = s.trim()
  return t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1) : t
}
const rawPath = line.substring(2).trim()
if (!rawPath) continue
// ...（status 判定不变）...
let actualPath: string
let oldPath: string | undefined
if (status === "renamed" && rawPath.includes(" -> ")) {
  const arrowIdx = rawPath.indexOf(" -> ")
  oldPath = unquote(rawPath.substring(0, arrowIdx))
  actualPath = unquote(rawPath.substring(arrowIdx + 4))
} else {
  actualPath = unquote(rawPath)
}
files.push({ path: actualPath, status, staged, oldPath })
```

移除原先在 status 判定前对 `filePath` 的整体去引号逻辑（L54-56）。

## #7 同步递归扫描加边界（RepoOps）

[scanForGitRepos](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/managers/RepoOps.ts#L151-L195) 用 `fs.readdirSync`/`statSync` 同步 BFS 扫描整棵目录树，误选大目录（如磁盘根）会同步阻塞 Electron 渲染进程，且无深度/结果数上限。

修复：保持同步实现（用户主动触发、改异步改动过大），但加双重边界防失控：
- 队列项携带 depth：`const queue: { dir: string, depth: number }[] = [{ dir: dirPath, depth: 0 }]`
- 常量 `MAX_DEPTH = 8`、`MAX_RESULTS = 500`
- 超过 `MAX_DEPTH` 不再入队子目录
- `results.length >= MAX_RESULTS` 时终止外层循环
- 顶部注释说明边界值用途（防止扫描大目录树同步阻塞渲染进程）

## #3 porcelain 解析局限注释（WorktreeOps）

在 status 解析处补注释：说明基于 `core.quotepath=false` + 文本解析，路径含换行等极端字符仍有局限，未用 `-z` 是权衡（符合"脆弱 git 命令语义需注释"规范）。

## #5 commit log 字段注释（WorktreeOps）

[getCommitLog](file:///e:/programDevelopment/plugin/siyuanPluginVueSN/src/features/gitPush/managers/WorktreeOps.ts#L207-L213) 的 `%n` 分隔按 5 行固定切分，依赖 `%s`(subject) 单行。补注释："依赖 subject 单行，勿加入 %b(body) 等多行字段，否则 5 行切分错位"。

## 不在本次范围
- #2/#8（switchBranch、cloneRepo、scanForGitRepos 等中文错误文案 i18n 化）：需 manager 层注入 i18n，改动面大，建议后续跨 manager 统一处理
- #4（discardFile 的 catch 吞错）：经复查是有意设计——暂存的新增文件 reset 后变 untracked，`checkout -- file` 必然失败，吞错是为让"丢弃暂存新文件"正常，不改动
- #10（getGitGlobalConfig/getProjectGitConfig 不 catch）：可能有意让上层感知配置读取失败，低优先级不动

## 验证
- 由用户执行 `npx tsc --noEmit` 类型检查（AI 不运行 lint/build）
- 手动回归：重命名含空格/特殊字符的文件后查看变更列表路径正确；扫描大目录不卡死且结果有上限；提交日志显示正常
