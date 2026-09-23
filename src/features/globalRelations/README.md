# 全局关系列表（globalRelations）

全库文档间**双向链接关系**浏览器：基于思源 `refs` 表聚合跨文档引用，识别互引（双向）与单向引用，并可按需展开查看引用锚文本与反链文档。

## 功能

- **关系总览**：按「引用方文档 → 被引用方文档」聚合，统计关系总数、涉及文档数、双向/单向关系数
- **方向筛选**：全部 / 双向 / 单向 三档切换
- **搜索**：按文档标题或路径即时过滤
- **详情展开**（点击行）：SQL 读取 `refs.content` 锚文本 + `getBacklink2` 反链文档列表
- **文档跳转**：点击文档名经 `siyuan://blocks/<id>` 打开
- **截断保护**：主列表最多 500 行（按引用数倒序），超出时显示提示

## 数据源

| 用途 | 来源 |
|------|------|
| 主列表（文档对聚合 + 双向判定） | `@/api` 的 `sql()` 查询 `refs` 表，`EXISTS` 子查询判定互引 |
| 引用锚文本 | `sql()` 查询 `refs.content`，经 `parseAnchorText` 归一 |
| 反链文档列表 | `@/api` 的 `getBacklinkDocs()`（内部走 `getBacklink2`，backlinks + backmentions 合并去重） |

> `refs` 表结构：`root_id` 引用方文档 / `def_block_root_id` 被引用方文档；文档块标题存于 `blocks.content`（`name` 为空）。

## 目录结构

```
globalRelations/
├── index.ts                     # registerGlobalRelations(plugin) — 命令注册 + Manager 自挂载
├── index.vue                    # 面板：头部 / 统计 / 工具栏 / 内容区
├── README.md
├── components/
│   ├── StatsRow.vue             # 统计卡片行（4 张）
│   └── RelationRow.vue          # 单条关系行 + 可展开详情
├── composables/
│   └── useGlobalRelations.ts    # 数据层：查询聚合、过滤、按需加载详情
├── types/
│   └── index.ts                 # 类型定义 + GlobalRelationsManager
├── utils.ts                     # parseAnchorText 纯函数（可单测）
└── styles/
    └── index.scss               # 面板样式（BEM: .gr-*）
```

## 生命周期与挂载

- `registerGlobalRelations(plugin)` 内部创建 `GlobalRelationsManager` 并**自挂载** `(plugin as any).__globalRelations`
- 字段名已登记于 `src/index.ts` 的 `DESTROYABLE_KEYS`，由 `onunload` 统一调用 `destroy()`
- 快捷键：`⌃⌥N`（命令面板可搜索「全局关系列表」）

## 复用说明

本模块不自建 UI 控件，一律复用共享组件库：

| 场景 | 使用组件 |
|------|---------|
| 刷新 / 关闭 / 方向筛选按钮 | `Button` |
| 双向、引用计数徽标 | `Tag` |
| 搜索框 | `Input`（`prefix-icon="search"`） |
| 加载态 | `Loader` |
| 图标 | `IconWrapper` |

跨模块能力同样走统一入口：SQL 走 `@/api` 的 `sql()`、转义走 `@/utils/sqlHelpers`、文档跳转走 `@/utils/domUtils` 的 `openBlock()`、Modal 走 `@/utils/vueAppHelper` 的 `createModalVueApp()`。

## 已知取舍

- 主列表按 `refCount` 倒序截断至 500 行：超限时双向关系的「另一半」可能被截掉，导致**统计出的双向计数与列表可见行不完全一致**。
- 详情中的「无锚文本 / 无反链」是**正常空态**（非错误）；仅请求真正抛错时才显示「详情加载失败或无数据」。
