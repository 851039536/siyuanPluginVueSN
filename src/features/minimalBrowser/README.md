# 极简浏览器（Minimal Browser）

在思源笔记中内置极简浏览器：主窗口页签浏览网页，支持地址栏导航、前进/后退/刷新/主页，可一键收藏当前页并与「网站导航」共享书签数据，主页网址可配置，可把当前网页以 iframe 块嵌入思源文档。

## 功能

- **双形态承载（纯官方 API）**：通过 `plugin.addTab` 注册自定义 Tab 模型 + `openTab({custom})` 在主窗口创建页签；工具栏「在独立窗口打开」按钮调 `openWindow({tab})` 把页签移入浮动窗口，关闭浮动窗口即自动移回主窗口。
- **网页浏览**：`<iframe>` 加载网页（`referrerpolicy="no-referrer"`）；地址栏输入自动补全 `https://`；前进/后退由本地历史栈维护，刷新即重新加载。
- **收藏**：收藏当前页（可编辑名称）→ 写入共享存储（SQLite `website-navigation.db` 的 `entries` 表，环境不支持时回退 JSON 键 `website-navigation-entries`），与「网站导航」面板双向一致；侧栏按分类分组展示，支持改名/删除/点击导航、收起为缩略图栏、拖拽调整宽度。
- **外部打开兜底**：部分站点通过 `X-Frame-Options` 拒绝 iframe 嵌入，工具栏「外部打开」按钮经 `electron.shell.openExternal` 兜底。
- **主页设置**：`minimal-browser-settings` 存储，留空时以收藏列表作为起始页。

## 存储

| 键 / 文件 | 内容 |
|----|------|
| `plugin.db`（SQLite，**全插件统一单库**） | `wn_entries` 表（收藏条目）+ `wn_categories` 表（分类）；与网站导航共享同一份数据 |
| `minimal-browser-settings`（JSON） | `{ homeUrl: string, sidebarWidth: number }` |

数据层定义在 `src/utils/sharedStorage/websiteStorage.ts`（共享层，避免 feature 间直接导入）；
SQLite 访问统一走 `src/utils/sqliteDb.ts`，存储规范见 [AGENTS.md § SQLite 存储规范](../../../AGENTS.md#sqlite-存储规范强制2026-10-17)。

> **表命名**：统一单库下按功能前缀隔离，本功能用 `wn_` 前缀（`featureTables("wn", ...)`）。
> **纯 SQLite**：书签与分类均在库内，无 JSON 回退分支；运行时只建表，不做数据迁移。
> 库内若存在「指向已删除分类」的孤儿书签，启动时自动归入默认分类。
