# 组件预览（Component Preview）

在思源内以独立窗口/页签形态查看共享 Codex UI 组件库（`src/components/`）全部 21 个组件的真实渲染用法快照，附可复制的示例代码，便于组件开发者查看效果、改动后快速回归验证。

## 功能

- **双形态承载（纯官方 API）**：`plugin.addTab` 注册自定义 Tab 模型 + `openTab({custom})` 在主窗口创建页签；面板头部「在独立窗口打开」调 `openWindow({tab})` 把页签移入浮动窗口；浮动窗口内经 `isFloating`（`getFrontend() === "desktop-window"`）隐藏重复面板标题与打开按钮。
- **全组件覆盖**：Avatar / Badge / Button / Card / Chart / Checkbox / ColorField / ConfirmDialog / DatePicker / FormField / IconWrapper / Input / InputGroup / Label / Listbox / Loader / Select / Slider / Switch / Tag 各一个分组分区（`InputGroup` 与 `InputGroupAddon` 为配套组件，共用「InputGroup」一个分区），分组内为典型 props 组合快照卡片。
- **示例清单驱动**：预览数据集中在 `previewData/`（一份清单），渲染层通用遍历——新增组件/新用法只需在清单追加，不改渲染框架。清单里的 `code` 模板与渲染 props 共用同一数据源，杜绝漂移。
- **复合控件内嵌能力**：`Input` 的 `borderless` 去边框去底色（三条高特异性选择器覆盖基类 hover/focus-within），供「标签输入框」这类自定义容器把输入框内嵌其中；焦点反馈由外层容器的 `:focus-within` 承担。
- **无缝拼接控件**：`InputGroup` + `InputGroupAddon` 把输入框、按钮、下拉、日期与附加项拼成一体化控件（组内零间距、相邻边框 1px 重叠、仅最外侧保留圆角，档位经 `--ig-addon-*` CSS 变量从容器继承）；组内按钮建议用描边外观（`outlined` / `variant="secondary"`），填充态按钮边框为透明，拼接处会呈现实色块；示例默认插槽需渲染多个子组件，故由 `PreviewExample.render` 组装（见下方「清单扩展指南」）。
- **表单标签能力**：`Label` 支持包裹控件建立**原生隐式关联**（`wrapper`，插槽内容直出、不套文本层，避免控件被文本层挤压与样式串染）、**禁用态三入口**（`disabled` prop / 容器 `data-disabled` / 邻近被禁用的兄弟控件）、**必填无障碍**（`required` 的 `*` 对屏幕阅读器隐藏，`required-text` 以视觉隐藏文本播报）。⚠️ 禁用联动的「邻近兜底」仅覆盖**禁用态就在根元素上**的成员（`Switch` 的原生 `button[disabled]`、原生 `input`）；`Input` / `Select` / `DatePicker` 的禁用态加在内部元素上，根元素无 `disabled`，**需由包装层显式标记 `data-disabled`**。
- **内联列表选择**：`Listbox` 在页面上平铺选项列表（与下拉形态的 `Select` 互补），支持单选 / 多选（`multiple`，多选时 `v-model` 为数组）、复选指示（`checkbox`，每项常驻方框）与勾选指示（`checkmark`，配 `highlightOnSelect: false` 可做到「仅勾选、不高亮整行」）、内置筛选（复用 `Input`，按 `label` 与 `keywords` 双字段匹配）、单项禁用（`option.disabled`）、整体禁用与 `error` 校验态；无数据与筛选无结果共用 `emptyText`。⚠️ 键盘范围**只含基础键**（Tab / ↑↓ / Enter / Space / Home / End），不做 Shift/Ctrl 组合键、字符定位与虚拟滚动，也不做选项分组与字段映射。指示器是**纯装饰元素**（`role="option"` 内不得嵌套可交互元素，故刻意不复用 `Checkbox`；勾选图标复用 `IconWrapper`）。
- **代码复制**：每个示例卡片对应一段可复制的 Vue 用法代码（`copyToClipboard` + 已复制反馈）。
- **导航与检索**：左侧锚点导航（按组件分区跳转）+ 组件名搜索过滤，兼容超长内容滚动。
- **组件尺寸档位**：头部 XS / S / M / L 四档切换，作用于所有支持 `size` 的组件（`PreviewGroup.sizeable` 标记的 Button / Input / InputGroup / FormField / Label / Select / Listbox / Switch / Checkbox / DatePicker / Slider / Tag / Badge / Avatar / Card / ConfirmDialog）——渲染时向**未显式指定 `size`** 的示例注入全局档位；显式指定 `size` 的示例（尺寸对比用例）保持原样，避免标题与实际渲染不符。选择经 `TypedStorage` 持久化。
  - 四档字号阶梯为 **10 / 12 / 14 / 16px**（`$font-size-2xs` / `$font-size-xs` / `$font-size-sm` / `$font-size-base`），切档后文字大小可辨；Card 标题四档同步为 10/12/14/16、副标题为 10/10/12/14，Switch 标签随档位变化，Checkbox 标签随档位变化（方框与指示器图标同步为 14/16/18/20px 与 10/12/14/16px），DatePicker 的输入框与日历单元格字号同阶变化（单元格边长 22/24/28/32px），Select 的 XS 档下拉内部（筛选框/空态/分组标题）一并降为 10px。规则见 `AGENTS_STYLE.md` § 组件 size 档位字号阶梯。
  - 注：Chart（`size` 为预设像素宽高，大档会撑破卡片）、IconWrapper（`size` 为像素数）、Loader（无 props）不参与档位切换；图标尺寸不随档位缩放。
- **明暗适配**：不自行造主题——面板与组件全部消费思源 `--b3-theme-*` 变量，明暗随思源主题自动切换（Chart 经自身 `theme: "auto"` 同样跟随）。

## 承载与生命周期

- Manager 类（`types/index.ts`）：模块级 `tabRegistered` 防重复注册 `addTab` 模型；`open()`/`openFloating()` 切换主窗口/浮动窗口；`mountPanel`/`unmountPanel` 管理 Vue 挂载（容器补 `vp-dock-root` 全局基准字号）。
- 注册入口（`index.ts`）：`registerComponentPreview(plugin)` 内部实例化并自挂载 `(plugin as any).__componentPreview`（实现 `destroy()`），已加入 `src/index.ts` 的 `DESTROYABLE_KEYS` 统一销毁；另注册页签图标。
- 命令入口：`addCommand` 的 langKey 为 `openComponentPreview`，**不绑定默认快捷键**（`⌃⌥V` 已由视频管理器占用），仅作为命令面板入口存在；超级面板 action 经 `ACTION_EVENT_MAP` 派发 `openComponentPreview` 全局事件打开。
- 状态栏集成：已登记到 `statusBar/featureRegistry.ts` 功能列表——抽屉中可 pin 到状态栏快捷区、带功能开关角标（`enableComponentPreview`）、可分配自定义分类；点击派发 `openComponentPreview` 事件打开窗口。快捷项图标色 `--status-color-component-preview`。

## 弹层类组件的预览沙箱

`ConfirmDialog` 这类弹层组件的遮罩是 `position: fixed; inset: 0`，直接放进快照会铺满整个预览窗口。`styles/PreviewSection.scss` 的 `.cp-card__stage` 因此设置 `position: relative`，并把舞台内的 `.si-confirm-mask` 覆盖为 `position: absolute; z-index: 1` —— **仅作用于预览沙箱，不改组件本体**（组件在真实调用处仍是全屏固定弹层）。后续新增其它弹层类共享组件时，在同一处追加对应遮罩类名即可。

## 具名插槽（无法在快照中呈现，在此登记）

`PreviewExample` 支持 `props` + 默认插槽（`slotText`，或 `render` 函数组装多个子组件）；**具名/作用域插槽无法在快照卡片中渲染**，故在此登记，改动时同步维护：

| 组件 | 插槽 | 作用域参数 | 用途 |
| --- | --- | --- | --- |
| `Select` | `selected` | `{ option }` | 已选项富内容（如"名称 + 来源标记"）；不传时回退为纯文本 `option.label` |
| `Select` | `option` | `{ option }` | 下拉选项富内容；不传时回退为纯文本 `option.label` |
| `DatePicker` | `date` | `CalendarCell`（`date` / `inCurrentMonth` / `disabled` / `today` / `selected` / `inRange` / `rangeStart` / `rangeEnd`） | 自定义日期单元格内容（如价格、事件标记）；不传时回退为日序数字 |
| `DatePicker` | `buttonbar` | `{ today, selectToday, clear }` | 面板底部按钮栏整体替换（默认渲染「今天 / 清除」两个文本按钮） |
| `InputGroup` | 默认插槽（**多个子组件**） | — | 组内成员，可放 `Input` / `Select` / `DatePicker` / `Button` / `InputGroupAddon`，数量与顺序不限；成员**不得带 `label`/`hint`/`error`**（会撑高错位），容器**禁设 `overflow: hidden`**（会裁剪 `Select` 下拉） |
| `InputGroupAddon` | 默认插槽 | — | 附加项内容（前缀/后缀文本或图标） |
| `ConfirmDialog` | 默认插槽 | — | 覆盖消息区，用于承载富内容（如快照备注与时间）；不传时按 `message` 的 `\n` 拆行渲染 |
| `Label` | 默认插槽 | — | 标签文本；`wrapper` 模式下插槽内容**直出**（不套 `.si-label__text`），可放控件以建立原生隐式关联；`wrapper` 建议配合 `tag="label"`（默认值），与 `tag="span"/"div"` 的 inline 外观语义冲突 |
| `Listbox` | `option` | `{ option, selected }` | 自定义列表项内容（双行文案、徽标等）；不传时回退为 `option.label`。快照只能渲染默认插槽内容，故该插槽在本分区无示例，用法见本行 |

`SelectOption` 的 `keywords?: string` 为 `filterable` 的附加检索词（标签之外的别名/描述检索），清单中已有对应示例。

## 事件契约（无法在快照中呈现，在此登记）

快照只能展示初始 props 的渲染结果，**事件语义**无法呈现。约定语义特殊（非纯 `v-model`）的事件在此登记，改动时同步维护：

| 组件 | 事件 | 语义 |
| --- | --- | --- |
| `ColorField` | `update:modelValue` | 实时值：hex 文本框逐字输入时持续触发，仅更新内存 |
| `ColorField` | `change` | 提交信号：文本框 blur/回车、或在调色板选色后触发；消费方据此落盘，避免逐字写盘 |
| `Slider` | `update:modelValue` / `change` | 同上模式：拖动过程只发 `update:modelValue`，松手才发 `change` |
| `Input` | `update:modelValue` / `change` | 同上模式：原生 `input` / `change` 分别转发 |
| `DatePicker` | `update:modelValue` / `change` | 同日提交：选中、手输解析、清除时两者同时触发（无「实时跟随」阶段）；另有 `visibleChange`（弹层开合）、`viewChange`（视图切换）、`clear` |
| `ConfirmDialog` | `confirm` / `cancel` | 确认按钮触发 `confirm`（不自动关闭，由父组件决定关闭时机，便于异步操作）；取消（取消按钮 / 遮罩点关 / Esc）触发 `cancel` 并同时派发 `update:visible(false)`，故支持 `v-model:visible` |

> 通用建议：需要「实时跟随 + 一次性落盘」的交互（滑块、颜色、文本输入），消费方应监听 `update:modelValue` 做内存更新、监听 `change` 做持久化，可避免写放大与提示刷屏。

## 清单扩展指南

1. 在 `previewData/` 对应分组文件（或新文件）追加 `PreviewGroup` / 往 `examples` 添加 `PreviewExample`：
   - `title`：示例标题（中文）
   - `props`：透传给组件的 props 组合
   - `slotText`：默认插槽文本（需要插槽的组件）
   - `render`：复合示例的默认插槽渲染函数（可选，存在时优先于 `slotText`；入参为注入全局档位后的实际渲染 props，返回 VNode 或 VNode[]；用于 `InputGroup` 这类插槽内需放多个子组件的示例）
   - `code`：与 props 对应的可复制 Vue 模板代码
2. `previewData/index.ts` 聚合后导出 `PREVIEW_GROUPS`（index.vue 遍历渲染）。
3. 面板 UI 文案走 i18n 分片（`componentPreview` 键），新增文案需 zh_CN / en_US 同步。
4. 新增支持尺寸档位的组件：在该 `PreviewGroup` 上标记 `sizeable: true`（渲染时会注入全局尺寸档位）；增删档位改 `types/size.ts` 的 `COMPONENT_SIZES` 与 i18n 的 `sizeXsmall` 等键。
5. 新增/修改共享组件的 props、行为、**具名插槽**或**事件契约**后，必须同步 `previewData/*.ts` 与本文档（见上方「具名插槽」表与「事件契约」表）。

> 约定：`Label` 的 `required` 只负责**视觉标记 + 屏幕阅读器替代文本**（`*` 已 `aria-hidden`、`required-text` 视觉隐藏播报），**控件侧仍需自行声明 `required` / `aria-required`** —— 有意不在 `<label>` 上输出 `aria-required`（该属性属输入类角色，放在标签元素上是无效 ARIA）。

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
