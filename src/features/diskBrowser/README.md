# 本地磁盘浏览器

在思源笔记中浏览本地磁盘、桌面和文件夹。注册为右侧边栏 Dock 面板，显示桌面入口与本地磁盘驱动器列表（含用量）、文件夹层级列表、面包屑导航，按文件格式自动区分图标，支持收藏文件夹、复制路径、查看文件大小和修改时间。

## 使用方法

1. 在设置中启用「本地磁盘浏览器」
2. **面板打开即默认展示桌面内容**；也可在左侧导航栏点击「桌面」或任一磁盘切换
3. 双击文件夹进入子目录，双击文件在系统默认程序中打开
4. 文件图标按格式自动区分（图片/视频/音频/压缩包/代码/文档/快捷方式）
5. 点击星标按钮收藏常用文件夹
6. 通过面包屑导航快速跳转任意层级
7. 页脚刷新按钮更新磁盘列表，地址栏刷新按钮更新当前目录

## 架构

- **Dock 面板** — `createVueDockApp` 注册为右侧边栏；**打开即默认选中桌面**
- **磁盘枚举** — `fs.statfsSync` 逐盘符探测容量（C:–Z:，跳过 A:/B:），卷标走 `cmd /c vol`
- **桌面定位** — 优先读注册表 `User Shell Folders\Desktop`（兼容 OneDrive/自定义重定向），回退 `homedir()/Desktop` 并校验存在；解析失败时隐藏桌面入口且保持欢迎空态
- **目录读取** — Node.js `fs.readdirSync`，返回 `null` 表示读取失败（与空目录区分）；按名过滤 `desktop.ini` / `thumbs.db` 等系统文件
- **文件格式分类** — `utils/fileKind.ts` 按扩展名归入 9 类，映射到已注册 `IconKey`（零新增图标）
- **显示名剥扩展名** — 照搬资源管理器的 `NeverShowExt` 规则：`.lnk` / `.url` / `.pif` 等 12 类**永久隐藏**扩展名不显示（`chrome.exe.lnk` → `chrome.exe`），其余如 `.txt` / `.docx` 如实显示；原始文件名保留在行悬浮提示中
- **导航根抽象** — `expandedDisk` 既可为盘符（`"E:"`）也可为桌面绝对路径，路径拼接经 `joinRoot()` 统一处理两者形态差异
- **选中 vs 切换** — `selectDesktop()` 幂等（挂载默认用），`toggleDesktop()` 可收起（点击入口用）
- **缓存策略** — 会话内记忆化，面板关闭即释放（不做时间过期）
- **持久化** — 收藏夹路径通过 PluginStorage / TypedStorage 保存

## 组件结构

```
diskBrowser/
├── index.vue                      # 面板根 — 单一双栏布局（导航栏 + 内容区）
├── components/
│   ├── NavPane.vue                # 导航栏 — 桌面入口 + 磁盘列表（含用量条）+ 收藏夹 + 容量页脚
│   ├── FolderList.vue             # 内容区 — 地址栏 + 列头 + 列表 + 状态栏
│   ├── FolderListItem.vue         # 列表行 — 格式图标 + 名称/大小/日期 + hover 操作
│   └── AddressBar.vue             # 地址栏 — 面包屑（根名随导航根变化）+ 打开/复制/刷新
├── composables/useDiskBrowser.ts  # 磁盘/桌面/目录/收藏夹/导航编排
├── utils/
│   ├── index.ts                   # listDrives / readVolumeLabel / resolveDesktopPath / readDirectoryContents / formatVolumePair / formatDate
│   └── fileKind.ts                # 扩展名 → 格式分类（9 类）→ IconKey；系统文件过滤
├── types/{index,storage}.ts       # 类型契约 + 收藏夹持久化
└── styles/                        # _mixins.scss（共享）+ index/NavPane/FolderList/FolderListItem/AddressBar
```

## 文件格式分类

| 分类 | 图标键 | 代表扩展名 |
|---|---|---|
| `folder` | `folder` | —（目录） |
| `image` | `image` | png / jpg / gif / webp / svg / psd / heic |
| `video` | `video` | mp4 / mkv / avi / mov / webm |
| `audio` | `headphones` | mp3 / wav / flac / m4a / ape |
| `archive` | `archiveOutline` | zip / rar / 7z / tar.gz / iso |
| `code` | `code` | ts / js / vue / py / go / json / md / yml |
| `document` | `file` | pdf / docx / xlsx / pptx / txt / csv |
| `link` | `linkVariant` | lnk / url / rdp |
| `other` | `fileOutline` | 无扩展名或未识别 |

> ⚠️ `.ts` 归入 `code`（TypeScript 源码）而非 `video`（MPEG 传输流）—— 扩展名冲突时按本项目用户群体的实际使用频率取舍。

## 复用共享组件

`ProgressBar`（磁盘用量，`severity` 按 60%/85% 阈值变色）、`Button`、`Badge`、`IconWrapper`、`Loader`、`formatFileSize`（`@/utils/format`）、`openPathInShell`（`@/utils/electronDialog`）、`copyToClipboard`（`@/utils/domUtils`）。
