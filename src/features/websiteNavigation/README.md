# 网站导航

管理常用网站链接，支持分类筛选和快捷访问。

## 功能

- 添加/编辑/删除网站链接
- 自定义分类管理
- 搜索过滤
- 一键打开网址
- 复制网址链接

## 存储

| 键 | 内容 |
|---|---|
| `website-navigation-entries`（JSON） | 网站条目数组；与 minimalBrowser 共享 |
| `website-navigation-categories`（JSON） | 分类数组；未写入时返回内置默认分类 |

数据层在 `src/utils/sharedStorage/websiteStorage.ts`，经 `PluginStorage` / `TypedStorage` 写入；
读-改-写串行执行，不使用 SQLite（`plugin.db` 会让 Windows 思源同步 rename 失败）。
