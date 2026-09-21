# 本地磁盘浏览器

在思源笔记中浏览本地磁盘和文件夹。注册为右侧边栏 Dock 面板，显示本地磁盘驱动器列表与用量、文件夹层级列表、面包屑导航，支持收藏文件夹、复制路径、查看文件大小和修改时间。

## 使用方法

1. 在设置中启用「本地磁盘浏览器」
2. 右侧边栏 Dock 面板左侧导航栏中点击磁盘
3. 双击文件夹进入子目录，双击文件在系统默认程序中打开
4. 点击星标按钮收藏常用文件夹
5. 通过面包屑导航快速跳转任意层级
6. 页脚刷新按钮更新磁盘列表，地址栏刷新按钮更新当前目录

## 架构

- **Dock 面板** — `createVueDockApp` 注册为右侧边栏
- **磁盘枚举** — `fs.statfsSync` 逐盘符探测容量（C:–Z:，跳过 A:/B:），卷标走 `cmd /c vol`
- **目录读取** — Node.js `fs.readdirSync`，返回 `null` 表示读取失败（与空目录区分）
- **缓存策略** — 会话内记忆化，面板关闭即释放（不做时间过期）
- **持久化** — 收藏夹路径通过 PluginStorage / TypedStorage 保存

## 组件结构

```
diskBrowser/
├── index.vue                      # 面板根 — 单一双栏布局（导航栏 + 内容区）
├── components/
│   ├── NavPane.vue                # 导航栏 — 磁盘列表（含用量条）+ 收藏夹 + 容量页脚
│   ├── FolderList.vue             # 内容区 — 地址栏 + 列头 + 列表 + 状态栏
│   ├── FolderListItem.vue         # 列表行 — 名称/大小/日期 + hover 操作
│   └── AddressBar.vue             # 地址栏 — 面包屑 + 打开/复制/刷新
├── composables/useDiskBrowser.ts  # 磁盘/目录/收藏夹/导航编排
├── utils/index.ts                 # 纯函数 — listDrives / readVolumeLabel / readDirectoryContents / formatDate
├── types/{index,storage}.ts       # 类型契约 + 收藏夹持久化
└── styles/                        # _mixins.scss（共享）+ index/NavPane/FolderList/FolderListItem/AddressBar
```

## 复用共享组件

`ProgressBar`（磁盘用量，`severity` 按 60%/85% 阈值变色）、`Button`、`Badge`、`IconWrapper`、`Loader`、`formatFileSize`（`@/utils/format`）、`openPathInShell`（`@/utils/electronDialog`）、`copyToClipboard`（`@/utils/domUtils`）。
