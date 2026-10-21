# Everything 本地搜索

集成 Windows 的 Everything 搜索引擎，在思源笔记中实现超快速的本地文件搜索。通过 HTTP API 与 Everything 服务通信，支持区分大小写、全词匹配、路径匹配、正则搜索等多种模式，支持按名称/路径/大小/修改时间排序。快捷键：`Ctrl+Alt+E`。

面板含两个 Tab：

- **文件搜索**：调用 Everything HTTP API 检索本地文件，支持打开 / 在资源管理器中定位 / 复制路径 / 移入回收站。
- **缓存清理**：扫描 Windows 常见缓存目录，统计可安全清理的体积并按用户选择移入回收站或永久删除。安全模型见下方「缓存清理安全边界」。

## 双形态承载

- **overlay 弹窗（默认）**：Teleport 到 body 的居中弹窗，快捷键 `Ctrl+Alt+E` 或超级面板「打开」触发。
- **独立窗口**：面板头部「在独立窗口打开」按钮，经 `addTab + openTab + openWindow` 官方 API 将页面弹出为独立浮动窗口（参考 minimalBrowser / toolCollection 双形态模式）。关闭浮动窗口页签自动移回主窗口；浮动窗口内自动隐藏「在独立窗口打开」按钮。

## 缓存清理安全边界

**只读扫描 + 白名单删除 + 系统 API 删除**，三层防护：

1. **扫描范围固定**：`cacheScan/roots.ts` 的 `CACHE_ROOTS` 是白名单唯一真源，只扫 7 个固定位置，不接受任意输入路径。
2. **扫描时排除**：进入目录前经 `isProtectedPath()` 复核；跳过符号链接 / junction（防循环与跨盘误删）。
3. **删除时三重守卫**：`isPathInside(白名单根)` && `path !== root` && `!isProtectedPath(path)`。

**绝对不删**：`C:\Windows`（含 `System32` / `WinSxS`）、`Program Files`、`ProgramData`（除单列的 Package Cache）、`$Recycle.Bin`、`System Volume Information`、`Recovery`、`Boot`、`PerfLogs`、`$WINDOWS.~BT/~WS`、`MSOCache`、`AppData\Local\Packages`、`AppData\*\Microsoft\Windows`、盘符根关键文件（`pagefile.sys` / `hiberfil.sys` / `swapfile.sys` / `bootmgr` 等）。

**为什么不会触发企业版安全软件上报**：全流程零子进程、无 PowerShell/cmd/WMI、无 `Add-Type` 反射加载、不碰注册表/服务/计划任务、不联网外发、不递归全盘；默认清理方式为**移入系统回收站**（与资源管理器删文件同一条系统 API 路径）。⚠️ 任何带删除能力的软件都无法保证不被某版本安全软件误报，本实现只保证消除全部已知高危行为特征。

**默认保守取向**：回收站模式 + 跳过 5 分钟内改动过的文件 + 条目上限 3000 + 浏览器缓存/安装包缓存默认不勾 + 仅手动触发扫描。

**诊断日志**：扫描/清理全链路的日志统一带 `[cacheClean]` 前缀，在 DevTools 控制台按该前缀过滤即可定位问题。
`info` 只打生命周期里程碑（开始 / 每根完成 / 汇总 / 首次成功的回收站通道），`warn` 打单条目失败（守卫拒绝、删除失败、根目录缺失），
逐条目成功不打日志（单次可达 3000 条）。实现见 `cacheScan/log.ts`。

## 目录结构

```
src/features/everythingSearch/
├── index.ts          # 注册函数 + 全局可见性 + Manager 挂载
├── index.vue         # 主面板（overlay 弹窗 / tab 独立页签双形态 + 双 Tab）
├── api.ts            # Everything HTTP 服务封装（仅 IO）
├── utils.ts          # 纯函数层（表达式组装 / 路径防护 / 时间解析 / 体积聚合）
├── utils.spec.ts     # 上述纯函数的单测
├── icons.ts          # 扩展名 → IconKey 映射
├── types/
│   ├── index.ts      # 类型定义 + EverythingSearchManager（addTab + openWindow）
│   ├── cacheScan.ts  # 缓存清理类型（根定义 / 扫描结果 / 清理结果）
│   └── storage.ts    # 配置 + 缓存清理偏好持久化
├── cacheScan/
│   ├── roots.ts      # CACHE_ROOTS 白名单唯一真源 + resolveCacheRoots()
│   ├── fsUtils.ts    # 递归体积统计 / 取消与让出事件循环（扫描与清理共用）
│   ├── log.ts        # 带 [cacheClean] 前缀的分级诊断日志（info / warn / error）
│   ├── scanner.ts    # scanCacheRoots()（只读扫描）
│   ├── cleaner.ts    # cleanCacheEntries() / isAllowedCachePath()（三重守卫删除）
│   └── *.spec.ts     # 白名单与扫描器行为断言
├── composables/      # useSearchConfig / useFileSearch / useResultActions / useCacheClean
├── components/       # DialogHeader / SearchBar / SearchOptions / SearchResults 等
│   ├── PanelTabs.vue # 双 Tab 切换栏
│   ├── SearchPathFilter.vue # 路径范围过滤（从 SearchOptions 拆出）
│   └── cacheClean/   # 缓存清理面板（容器 + 根列表 + 条目列表 + 偏好）
└── styles/           # 组件专属 SCSS + _mixins
```

## 审查记录

模块的冗余专项审查与安全整改详见 [docs/everything-search-redundancy-review.md](../../docs/everything-search-redundancy-review.md)。
