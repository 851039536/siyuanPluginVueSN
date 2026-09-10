# 组件预览（Component Preview）

在思源内以独立窗口/页签形态查看共享 Codex UI 组件库（`src/components/`）全部 15 个组件的真实渲染用法快照，附可复制的示例代码，便于组件开发者查看效果、改动后快速回归验证。

## 功能

- **双形态承载（纯官方 API）**：`plugin.addTab` 注册自定义 Tab 模型 + `openTab({custom})` 在主窗口创建页签；面板头部「在独立窗口打开」调 `openWindow({tab})` 把页签移入浮动窗口；浮动窗口内经 `isFloating`（`getFrontend() === "desktop-window"`）隐藏重复面板标题与打开按钮。
- **全组件覆盖**：Avatar / Badge / Button / Card / Chart / Checkbox / FormField / IconWrapper / Input / Label / Loader / Select / Slider / Switch / Tag 各一个分组分区，分组内为典型 props 组合快照卡片。
- **示例清单驱动**：预览数据集中在 `previewData/`（一份清单），渲染层通用遍历——新增组件/新用法只需在清单追加，不改渲染框架。清单里的 `code` 模板与渲染 props 共用同一数据源，杜绝漂移。
- **代码复制**：每个示例卡片对应一段可复制的 Vue 用法代码（`copyToClipboard` + 已复制反馈）。
- **导航与检索**：左侧锚点导航（按组件分区跳转）+ 组件名搜索过滤，兼容超长内容滚动。
- **组件尺寸档位**：头部 XS / S / M / L 四档切换，作用于所有支持 `size` 的组件（`PreviewGroup.sizeable` 标记的 Button / Input / FormField / Label / Select / Switch / Checkbox / Slider / Tag / Badge / Avatar / Card）——渲染时向**未显式指定 `size`** 的示例注入全局档位；显式指定 `size` 的示例（尺寸对比用例）保持原样，避免标题与实际渲染不符。选择经 `TypedStorage` 持久化。
  - 四档字号阶梯为 **10 / 12 / 14 / 16px**（`$font-size-2xs` / `$font-size-xs` / `$font-size-sm` / `$font-size-base`），切档后文字大小可辨；Card 标题四档同步为 10/12/14/16、副标题为 10/10/12/14，Switch 标签随档位变化，Checkbox 标签随档位变化（方框与指示器图标同步为 14/16/18/20px 与 10/12/14/16px），Select 的 XS 档下拉内部（筛选框/空态/分组标题）一并降为 10px。规则见 `AGENTS_STYLE.md` § 组件 size 档位字号阶梯。
  - 注：Chart（`size` 为预设像素宽高，大档会撑破卡片）、IconWrapper（`size` 为像素数）、Loader（无 props）不参与档位切换；图标尺寸不随档位缩放。
- **明暗适配**：不自行造主题——面板与组件全部消费思源 `--b3-theme-*` 变量，明暗随思源主题自动切换（Chart 经自身 `theme: "auto"` 同样跟随）。

## 承载与生命周期

- Manager 类（`types/index.ts`）：模块级 `tabRegistered` 防重复注册 `addTab` 模型；`open()`/`openFloating()` 切换主窗口/浮动窗口；`mountPanel`/`unmountPanel` 管理 Vue 挂载（容器补 `vp-dock-root` 全局基准字号）。
- 注册入口（`index.ts`）：`registerComponentPreview(plugin)` 内部实例化并自挂载 `(plugin as any).__componentPreview`（实现 `destroy()`），已加入 `src/index.ts` 的 `DESTROYABLE_KEYS` 统一销毁；另注册页签图标。
- 命令入口：`addCommand` 的 langKey 为 `openComponentPreview`，**不绑定默认快捷键**（`⌃⌥V` 已由视频管理器占用），仅作为命令面板入口存在；超级面板 action 经 `ACTION_EVENT_MAP` 派发 `openComponentPreview` 全局事件打开。
- 状态栏集成：已登记到 `statusBar/featureRegistry.ts` 功能列表——抽屉中可 pin 到状态栏快捷区、带功能开关角标（`enableComponentPreview`）、可分配自定义分类；点击派发 `openComponentPreview` 事件打开窗口。快捷项图标色 `--status-color-component-preview`。

## 具名插槽（无法在快照中呈现，在此登记）

`PreviewExample` 只支持 `props` + 默认插槽（`slotText`），具名/作用域插槽无法在快照卡片中渲染，故在此登记，改动时同步维护：

| 组件 | 插槽 | 作用域参数 | 用途 |
| --- | --- | --- | --- |
| `Select` | `selected` | `{ option }` | 已选项富内容（如"名称 + 来源标记"）；不传时回退为纯文本 `option.label` |
| `Select` | `option` | `{ option }` | 下拉选项富内容；不传时回退为纯文本 `option.label` |

`SelectOption` 的 `keywords?: string` 为 `filterable` 的附加检索词（标签之外的别名/描述检索），清单中已有对应示例。

## 清单扩展指南

1. 在 `previewData/` 对应分组文件（或新文件）追加 `PreviewGroup` / 往 `examples` 添加 `PreviewExample`：
   - `title`：示例标题（中文）
   - `props`：透传给组件的 props 组合
   - `slotText`：默认插槽文本（需要插槽的组件）
   - `code`：与 props 对应的可复制 Vue 模板代码
2. `previewData/index.ts` 聚合后导出 `PREVIEW_GROUPS`（index.vue 遍历渲染）。
3. 面板 UI 文案走 i18n 分片（`componentPreview` 键），新增文案需 zh_CN / en_US 同步。
4. 新增支持尺寸档位的组件：在该 `PreviewGroup` 上标记 `sizeable: true`（渲染时会注入全局尺寸档位）；增删档位改 `types/size.ts` 的 `COMPONENT_SIZES` 与 i18n 的 `sizeXsmall` 等键。
5. 新增/修改共享组件的 props、行为或**具名插槽**后，必须同步 `previewData/*.ts` 与本文档（插槽部分见上方「具名插槽」表）。

## 视图偏好

| 存储键 | 内容 |
| --- | --- |
| `component-preview-size` | 组件尺寸档位（`xsmall` / `small` / `medium` / `large`，默认 `small`） |

- 类型与档位清单定义在 `types/size.ts`（独立文件、无 vue/plugin 依赖，供 composable 安全引用以避免 `composable → types/index.ts → index.vue` 运行时循环）；`types/index.ts` 统一转出。
- 读写经 `composables/usePreviewSize.ts`（`TypedStorage` + `isComponentSize` 兜底），面板 `onMounted` 加载、切换即落盘。

## 注册位置

| 文件 | 变更 |
| --- | --- |
| `src/features/index.ts` | 导出 `registerComponentPreview` / `showComponentPreview`；`_Registered` 追加 `"componentPreview"` |
| `src/index.ts` | import + `DESTROYABLE_KEYS` 追加 `__componentPreview` + `registerFeatures()` 追加开关 |
| `src/config/settings.ts` | `enableComponentPreview: boolean`（默认 `true`） |
| `src/features/config.ts` | `FEATURE_CONFIG` 追加 `componentPreview` 条目 |
| `src/config/icons.ts` | `FEATURE_ICONS` 追加 `componentPreview` |
| `src/features/superPanel/types/index.ts` | `ACTION_EVENT_MAP` 追加 `openComponentPreview` |
| `src/i18n/{zh_CN,en_US}/componentPreview.json` | 面板文案 + 顶层 `openComponentPreview` / `enableComponentPreview` / `enableComponentPreviewDesc` |
