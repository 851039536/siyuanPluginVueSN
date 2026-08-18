# 极简浏览器（Minimal Browser）

在思源笔记中内置极简浏览器：独立窗口浏览网页，支持地址栏导航、前进/后退/刷新/主页，可一键收藏当前页并与「网站导航」共享书签数据，主页网址可配置。

## 功能

- **独立窗口**：通过 `plugin.addTab` 注册自定义 Tab 模型 + `openTab` 创建页签 + `openWindow({tab})` 移入独立窗口（若移窗失败，页签保留在主窗口右侧，优雅降级）。
- **网页浏览**：`<iframe>` 加载网页（`referrerpolicy="no-referrer"`）；地址栏输入自动补全 `https://`；前进/后退由本地历史栈维护，刷新即重新加载。
- **收藏**：收藏当前页（可编辑名称）→ 写入共享存储键 `website-navigation-entries`，与「网站导航」面板双向一致；侧栏按分类分组展示，支持改名/删除/点击导航。
- **外部打开兜底**：部分站点通过 `X-Frame-Options` 拒绝 iframe 嵌入，工具栏「外部打开」按钮经 `electron.shell.openExternal` 兜底。
- **主页设置**：`minimal-browser-settings` 存储，留空时以收藏列表作为起始页。

## 存储

| 键 | 内容 |
|----|------|
| `website-navigation-entries` | 收藏条目（与网站导航共享，不新建键） |
| `website-navigation-categories` | 分类（与网站导航共享） |
| `minimal-browser-settings` | `{ homeUrl: string }` |

数据层定义在 `src/utils/sharedStorage/websiteStorage.ts`（共享层，避免 feature 间直接导入）。
