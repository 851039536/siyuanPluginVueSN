# 侧边栏（Dock）功能移动端兼容计划

> 状态：待执行 · 创建 2026-11-05
> 背景：gitPush、磁盘管理、AI 信息生成、资源管理、接口端点、脚本启动器已在移动端跳过注册；
> 其余侧边栏功能需要评估「如何在移动端正常显示与使用」。

## 1. 结论先行

- 思源移动端**原生支持插件 Dock**：`addDock` 会为移动端生成 `mobileModel`，入口在移动端主菜单的
  「插件停靠栏」分组（`#menuPluginDocks`），点击后在移动端侧栏（`.side-panel`）中渲染。
- 当前剩余的 8 个 Dock 功能里，**7 个没有 Node 依赖**，挂载层面可直接复用 `createVueDockApp`；
  真正的工作量在「窄屏布局 + 触摸交互 + 桌面能力降级」，而不是「能不能显示」。
- `storageManager` 是最特殊的一个：体检/备份/还原依赖 Node `fs`，移动端必须降级或隐藏对应分区。
- 建议按 P0 基础设施 → P1 首批 3 个功能 → P2 其余 4 个功能 → P3 storageManager → P4 回归的顺序推进。

## 2. 移动端 Dock 的承载机制（对照思源前端源码确认）

| 项目 | 桌面端 | 移动端 |
|------|--------|--------|
| 注册 | `plugin.addDock(config)` | 同一 API，额外生成 `mobileModel` |
| 入口 | 左右/底部停靠栏图标 | 主菜单 → 「插件停靠栏」，标题为 `插件显示名 - dock title` |
| 容器 | 停靠栏面板，按 `size.width` 固定宽度 | 移动端侧栏 `side-panel`，宽度由思源控制（近全屏），`width` 不生效 |
| `position` | 4 个方位（LeftTop/LeftBottom/RightTop/RightBottom） | 仅映射左右：`LeftTop`/`LeftBottom`/`BottomLeft` → 左，其余 → 右 |
| 生命周期 | `init` / `update` / `destroy` | 相同；实例按 `type` 缓存在 `window.siyuan.mobile.docks`，移除/重载时调用 `destroy` |

对 `createVueDockApp` 的影响：

1. 挂载容器仍是 `this.element`，现有实现可直接工作；
2. 面板根必须按 **100% 宽 × 100% 高** 布局，不能依赖桌面端的 350~440px 宽度；
3. 移动端同一时间只展示一个 Dock 面板，返回操作由思源侧栏负责，功能内不需要再提供关闭按钮；
4. `position` 只用于决定挂在左侧还是右侧，功能内部布局不要假设“右侧窄栏”。

## 3. 现状盘点

### 3.1 已在移动端跳过注册（2026-11-05）

统一登记在 `src/features/config.ts` 的 `DESKTOP_ONLY_FEATURE_IDS`，由
`src/index.ts → registerFeatures()` 的 `canRegister()` 门控；超级面板在移动端也会隐藏这些功能卡片。

| 功能 | Feature ID | 跳过原因 |
|------|-----------|----------|
| Git 推送 | `gitPush` | git 子进程 / `fs.watch` / SQLite |
| 磁盘管理 | `diskBrowser` | Electron `shell` + Node `fs`（浏览本地磁盘） |
| AI 信息生成 | `aiContentGenerator` | 技能目录读写依赖 Node `fs`；核心交互面向桌面 |
| 资源管理 | `resourceManager` | 桌面文件资源管理定位（打开目录/资源引用） |
| 接口端点 | `apiDebugger` | 面向桌面的开发调试工具，核心交互不适配窄屏 |
| 脚本启动器 | `scriptLauncher` | `child_process` 执行脚本 |

### 3.2 待兼容的侧边栏功能（8 个）

> 「Node 依赖」按 `src/features/<feature>/` 内对 `getNode*` / `node:*` 的引用统计；
> 「风险」按现有 SCSS 中的固定宽度、多列网格、宽表格与交互方式预估。

| 功能 | Dock 类型 | 默认位置/宽度 | Node 依赖 | 主要风险 | 优先级 |
|------|-----------|--------------|-----------|----------|--------|
| 数据统计 | `statistics-dock` | RightBottom / 350 | 无（SQL 走内核 API） | 图表宽度、排行/表格列多；已有 `mobile-only` mixin 可复用 | **P1** |
| 文档分析 | `doc-analysis-dock` | RightTop / 400 | 无 | 2 列属性面板、宽表格与筛选条 | **P1** |
| RSS 订阅 | `rss-reader-dock` | RightTop / 400 | 无（`fetch` + 代理链） | 移动端 CORS/代理可用性、文章详情排版 | **P1** |
| 单词阅读 | `flashcardreading-dock` | RightTop / 400 | 无 | 闪卡翻转交互适配触摸、分类栏占宽 | P2 |
| 通用设置 | `general-settings-dock` | RightTop / 360 | 无 | 3 列网格、表单弹窗在窄屏被压缩 | P2 |
| 技能学习 | `skilllearning-dock` | RightTop / 420 | 无 | 2/3 列网格、代码块横向滚动 | P2 |
| 数据快照 | `data-snapshot-dock` | RightTop / 400 | 无 | 列表/上传入口在窄屏的排布 | P2 |
| 数据管理 | `storage-manager-dock` | RightTop / 440 | **fs**（体检/备份/还原） | Node 能力缺失时必须降级或整体隐藏 | P3 |

## 4. 分阶段计划

### P0 基础设施（先做，所有功能受益）

1. **面板根适配**：为 `vp-dock-root`（或 `createVueDockApp` 注入的容器）增加移动端规则：
   `width: 100%`、`height: 100%`、`min-width: 0`、`box-sizing: border-box`，
   底部留 `env(safe-area-inset-bottom)`。
2. **断点统一**：复用 `$bp-mobile: 768px`，移动端规则写在功能 SCSS 末尾的 `@media` 中；
   不新增第二套断点。
3. **触摸目标**：可点击行/图标 ≥ 40px；禁止仅靠 `:hover` 暴露的操作（改为常驻按钮或长按菜单）。
4. **滚动容器**：宽表格统一放进横向滚动容器；面板内主滚动区禁用 `overflow: hidden`。
5. **弹窗适配**：Dock 内打开的模态框宽度改为 `min(<原宽度>, calc(100vw - 24px))`，高度不超 80vh。

验收：任一 Dock 功能在移动端打开后无横向溢出、无元素被裁切、主要按钮可点。

### P1 首批验证（建议先做 3 个，摸清通用问题）

**数据统计**

- 复用已有 `_mixins.scss → mobile-only`，统计卡片改单列；
- 图表在容器宽度变化时 `resize`（chart.js 已响应容器，需要确认 Dock 打开动画后尺寸正确）；
- 排行/表格列做横向滚动或按优先级折叠。

**文档分析**

- 属性面板 2 列改 1 列；文档列表宽表格改横向滚动；
- 顶部筛选条换行（`flex-wrap`），避免挤压输入框（参考 `AGENTS_STYLE.md` 的密集工具条约定）。

**RSS 订阅**

- 真机验证 `fetchRss` 的「直连 → 代理」链路在移动端是否可用；不可用时给出明确提示，
  并考虑改用内核 `forwardProxy`；
- 文章详情页在窄屏下隐藏左右分栏，改为“列表 → 详情”单视图切换。

验收：移动端菜单可进入、核心流程（统计查询/文档分析/RSS 阅读）可用、无控制台报错。

### P2 其余 4 个功能

- **单词阅读**：分类筛选改抽屉/顶部横向滚动；翻转卡占满可用宽度，按钮加大；
- **通用设置**：`repeat(3, 1fr)` 网格改单列；设置项弹窗在移动端全屏化或限高滚动；
- **技能学习**：`1fr 1fr` / 三列统计卡改单列；代码块横向滚动并保留复制按钮；
- **数据快照**：列表行改两行式（主信息 + 操作），上传/下载入口保持可达。

验收：同上，并补“旋转屏幕后布局不破”检查。

### P3 数据管理（storageManager）

两条路线，建议先做 A：

- **A. 移动端降级（推荐）**：用 `getNodeModules()` 判空；
  移动端只保留 JSON 导入/导出（`triggerBlobDownload` + 现有 `FileUpload`），
  隐藏「体检 / 备份 / 还原 / SQLite 快照」等依赖文件系统的分区，并给出说明文案。
- **B. 整体桌面专属**：登记进 `DESKTOP_ONLY_FEATURE_IDS`，与现有 6 个功能一致。
  代价是移动端完全无法做数据导入导出。

### P4 回归与文档

1. 每个完成兼容的功能在 `src/features/<feature>/README.md` 增加「平台支持」一节
   （移动端可用范围、降级项）；
2. 真机回归清单（Android / iOS 各一轮）：
   - 菜单入口存在且标题正确；
   - 打开/关闭/切换左侧、旋转屏幕；
   - 无 Node/Electron 报错；
   - 数据读写与桌面端一致；
   - 无横向溢出、无被遮挡的按钮。

## 5. 通用改造清单（每个功能逐项勾选）

- [ ] 根容器 `width: 100% / min-width: 0 / height: 100%`
- [ ] 多列网格 → 单列（`@media (max-width: $bp-mobile)`）
- [ ] 宽表格 → 横向滚动容器或卡片化
- [ ] `:hover` 操作 → 常驻按钮 / 长按菜单
- [ ] 右键菜单 → 触摸长按（如已有）
- [ ] 文件拖拽 → 移动端提供“选择文件”兜底
- [ ] Node / Electron 能力调用前判空，缺失时给出可读提示
- [ ] 弹窗宽度/高度适配窄屏
- [ ] 不依赖物理键盘快捷键

## 6. 风险与待确认

1. 移动端侧栏的实际可用宽度、安全区不同机型差异较大，需真机确认；
2. `rssReader` 的公网 CORS 代理在移动网络的可用性未知，可能需要内核 `forwardProxy`；
3. 部分功能内含 `ResizeObserver`/`chart.js`，Dock 在移动端是懒加载（首次点击才 `mobileModel`），
   需确认首次渲染尺寸正确；
4. 若后续有新 Dock 功能，登记时需同时回答：是否加入 `DESKTOP_ONLY_FEATURE_IDS`、是否需要本计划的
   P0 基础设施、README 是否补充「平台支持」。

## 7. 参考

- 思源移动端 Dock 实现：移动端前端包 `build/mobile/main.*.js` 中 `addDock → mobileModel`、
  `#menuPluginDocks` 菜单项与 `sidebar-<type>-tab` 打开逻辑；
- 本项目统一挂载入口：`src/utils/vueAppHelper.ts → createVueDockApp`；
- 桌面专属门控：`src/features/config.ts → DESKTOP_ONLY_FEATURE_IDS`、
  `src/index.ts → registerFeatures()`、`src/features/superPanel/index.vue` 的卡片过滤。
