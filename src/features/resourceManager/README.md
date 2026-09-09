# 资源管理

管理思源笔记资源文件：图片/文件资源浏览与分类筛选、定位资源引用文档并跳转、移动资源并同步更新文档引用、检测丢失/未使用资源、批量清理与重建索引。

行内快捷操作：复制路径 / 复制 Markdown 引用（空格编码形态，图片用 `![]()` 语法）/ 在系统文件管理器中打开资源目录（`resolveAssetPath` 解析 OS 绝对路径 + Electron shell，非桌面端静默跳过该操作）；丢失资源页签同样支持定位引用文档以修复断链。

图片资源页签行首显示缩略图（`/assets/` 相对 URL 直出 + `loading="lazy"`），hover 弹出放大预览（与缩略图同 URL 命中缓存，加载失败自动隐藏；可见列表变化时重置失败缓存）。

「文档资源」页签展示当前活动文档引用的全部资源（`getDocAssets`，含文件大小），支持定位/复制路径/复制 MD 引用。

定位查询三级兜底：assets 表 path 等值匹配（原文/仅空格编码/全量编码三形态）→ blocks 表全路径模糊匹配 → 文件名模糊匹配（覆盖移动后思源索引异步刷新的窗口期）。任一层查询失败（内核/数据库异常）即中止并提示定位失败，不再降级为「未找到引用该资源的文档」。

移动时引用更新两级匹配：全路径三形态精确替换 → 文件名兜底（正则将 `assets/任意目录/文件名` 整体替换为新路径，自愈历史移动遗留的失效引用）。磁盘操作前通过 `safeDecodeURI` + `assetFileExists` 解析真实文件路径（assets 表存储 URL 编码形态、磁盘为解码文件名）。引用更新成功后调用 `getAllEditor().reload()` 重载打开中的编辑器，避免 protyle 渲染缓存仍显示旧路径。

分类目录名与筛选前缀统一小写（`normalizeCategoryKey`）：自定义分类输入 `Photos` 会落盘为 `assets/photos/`，与筛选前缀一致，避免「分类筛选结果恒为空」。

## 文件结构

```
resourceManager/
├── index.ts                          # registerResourceManager — 创建 Dock 面板
├── index.vue                         # 主面板：页签切换、资源列表、移动表单、缩略图预览
├── utils.ts                          # 纯函数与共享常量：SQL 转义、路径形态变换、目录扫描
├── types/index.ts                    # ResourceManagerI18n 文案接口
├── components/
│   └── DocAssetsSection.vue          # 「文档资源」页签（自包含加载活动文档资源）
├── composables/
│   ├── useResourceManager.ts         # 资源加载与缓存、分类筛选、移动/删除/重建索引
│   ├── useAssetLocator.ts            # 引用定位三级兜底（assets → blocks 全路径 → 文件名）
│   ├── useAssetActions.ts            # 复制 MD 引用、文件管理器中打开目录
│   └── useDocAssets.ts               # 活动文档资源加载（含请求代际令牌）
└── styles/                           # index.scss（主面板）+ DocAssetsSection.scss
```

## 关键实现说明

- **资源加载**：`sql(assets)` 与 `scanAssetDir("/data/assets")` 并行，合并去重排序后存入 `shallowRef`；同一时刻的重复请求复用进行中的 Promise，避免快速切换页签触发多次全量扫描。`assets` 表查询上限 102400 行。
- **目录扫描**：递归分批（每批 8 个条目）并发读取，避免大树下瞬时打出大量内核请求；单目录失败记录日志并跳过，不中断整体扫描。
- **缓存失效**：删除/移动成功后同步剔除 `allAssetPaths` / `missingAssets` / `unusedAssets` 中的失效路径，避免其它页签残留幽灵条目。
- **移动目标校验**：`isValidAssetMovePath` 先解码再校验，拦截路径穿越、反斜杠、NUL、空目录段与目录结尾。
