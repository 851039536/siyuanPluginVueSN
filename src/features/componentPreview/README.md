# 组件预览（Component Preview）

在思源内以独立窗口/页签形态查看共享 Codex UI 组件库（`src/components/`）全部 29 个组件的真实渲染用法快照，附可复制的示例代码，便于组件开发者查看效果、改动后快速回归验证。

## 功能

- **双形态承载（纯官方 API）**：`plugin.addTab` 注册自定义 Tab 模型 + `openTab({custom})` 在主窗口创建页签；面板头部「在独立窗口打开」调 `openWindow({tab})` 把页签移入浮动窗口；浮动窗口内经 `isFloating`（`getFrontend() === "desktop-window"`）隐藏重复面板标题与打开按钮。
- **全组件覆盖**：Avatar / Badge / Button / Card / Chart / Checkbox / ColorField / ConfirmDialog / DatePicker / Divider / FormField / IconWrapper / Input / InputGroup / Label / Listbox / Loader / Paginator / Panel / RadioButton / Select / Slider / SpeedDial / Switch / Tag / Textarea / **Timeline** / ToggleButton 各一个分组分区（`InputGroup` 与 `InputGroupAddon` 为配套组件，共用「InputGroup」一个分区），分组内为典型 props 组合（含具名/作用域插槽）快照卡片。
- **示例清单驱动**：预览数据集中在 `previewData/`（一份清单），渲染层通用遍历——新增组件/新用法只需在清单追加，不改渲染框架。清单里的 `code` 模板与渲染 props 共用同一数据源，杜绝漂移。
- **受控示例可交互**：声明了 `modelValue` 的组件（Slider / Input / Select / Switch / Checkbox / RadioButton / DatePicker / Listbox 等）在卡片内即可直接拖动、输入、点选，状态由 `PreviewStage` 持有的本地值回写 —— 所以 `showValue` 的数字、开关的选中态等会实时变化。**仅当目标组件确实声明了该 prop 时才注入**（否则 `modelValue` / `onUpdate:modelValue` 会落进 attrs，多根组件如 `FormField` 会因此报 extraneous attrs 警告）；切换全局尺寸档位只重新解析注入的 `size`，**不会覆盖你已经改动的本地值**。`render` 复合示例内部的子组件仍使用静态 props（示例 `code` 里展示的仍是最初的静态组合）。
- **复合控件内嵌能力**：`Input` 的 `borderless` 去边框去底色（三条高特异性选择器覆盖基类 hover/focus-within），供「标签输入框」这类自定义容器把输入框内嵌其中；焦点反馈由外层容器的 `:focus-within` 承担。
- **多行文本域**：`Textarea` 是新增的**独立多行控件**（与 PrimeVue `Textarea` 语义对齐），四档尺寸 + `label`/`required`/`hint`/`error`/字数统计齐备，三项特有开关：`autoResize`（内容增多自动增高，`rows` 为初始高度与默认下限、`minRows`/`maxRows` 可覆盖；`maxRows` 不传则不设上限，超出上限时转内部滚动）、`variant`（`outlined` 默认 / `filled` 实底，实底聚焦用内嵌 outline 环，因实底 border 为透明）、`fluid`（**默认 `true`** 占满容器宽；`:fluid="false"` 时交回原生 `cols` 决定固有宽度）。⚠️ 本组件**无插槽**；`Input` 的 `type="textarea"` 为兼容保留的旧入口，**新代码一律用 `Textarea`**。
- **按钮式开关**：`ToggleButton` 是**单按钮布尔开关**（`v-model` 为 boolean），参考 PrimeVue ToggleButton。**内部复用共享 `Button`（零样式复制）**：未按下走 `variant="ghost"` + `outlined` 取中性描边（`error` 时改用 `severity="danger"` 的红描边），按下走 `severity="primary"` 的填充外观 —— 因此**强弱对比明显，与分段组（弱对比文字色切换）观感有意区分**。`onLabel`/`offLabel`/`onIcon`/`offIcon` 按状态切换，**均无默认值**（项目禁止硬编码 UI 文案；都不传时会渲染空内容并在 DEV 告警）；无文案时按钮自动退化为**方形纯图标按钮**（沿用 `Button` 的 icon-only 档位尺寸，避免 `gap` 造成图标偏心）。⚠️ 无障碍红线：**可见文案/图标随状态变化时，必须提供不随状态变化的 `ariaLabel` / `ariaLabelledby` / `title`**（PrimeVue 官方建议，Dev 环境会对缺失场景告警）。⚠️ 选用边界：**单按钮开关用 `ToggleButton`；一组互斥选项的分段切换仍用 `Button` 分组 + `:aria-pressed`**（后者是本项目已有范式，未迁移）。`fluid` 默认 `false`（按钮天然内容宽，与 `Textarea.fluid` 默认 `true` 相反）。
- **浮动动作按钮**：`SpeedDial` 是**主按钮按下后按方向与轨迹展开一组动作**的浮钮（参考 PrimeVue SpeedDial）。**内部复用共享 `Button`（零样式复制）**：主按钮与动作项都是 `rounded` 的圆形浮钮，外观/悬停/焦点环/禁用态全部沿用库内既有约定。8 个 `direction` × 四档 `type`（`linear` / `circle` / `semi-circle` / `quarter-circle` + `radius`，扇区中心始终对准所选方向）；轨迹偏移由私有纯函数 `speedDial/geometry.ts` 一次性算出（`O(n)`）。`position` 四档角落 + `offset`，**默认 `position: fixed`**（需在舞台沙箱覆盖为 `absolute`，见上节）。动作气泡复用**思源内置 `b3-tooltips b3-tooltips__{方向}` + `aria-label`**（无新依赖）；展开时主按钮图标旋转 45°（提供 `hideIcon` 时改用独立图标、不旋转）。无障碍按官方约定落实：`aria-haspopup` / `aria-expanded` / `aria-controls`、列表 `role="menu"`、动作项 `role="menuitem"`，键盘 Enter/Space 切换、方向键与 Home/End 移动焦点、**Esc 关闭并把焦点返还主按钮**（鼠标操作不抢焦点）。`hideOnClickOutside` 默认开启；**不做 `mask`**。尺寸用 `size`（同时决定轨迹几何的按钮边长），**请勿经 `buttonProps.size` 覆盖**，否则几何与渲染会脱节。⚠️ 本组件示例的 `visible` 默认给 `true`，便于目视展开形态。
- **分页器**：`Paginator` 由 **`page`（1 基）/ `rows` / `total`** 三要素驱动（对齐项目既有「当前页 / 总页数」心智，**不采用** PrimeVue 的 `first` 零基行偏移）。组成全部用**显式 props** 控制（`showFirstLast` / `showPageLinks` / `pageLinkSize` / `showReport` / `rowsPerPageOptions` / `showJumpInput` / `alwaysShow`），**不采用** PrimeVue v5 的 `template` 字符串。页码窗口以当前页为中心滑动、首页与末页恒显，且**窗口与首末页只隔 1 页时直接补上该页、间隔 ≥2 页才折叠为省略号**（避免「跳号却看不到省略号」的错觉）。默认 `reportTemplate` 为 `"{page} / {totalPages}"`，可精确复现项目原有「1 / 3」文案；占位符支持 `{page}` / `{totalPages}` / `{rows}` / `{total}` / `{first}` / `{last}`，未识别的占位符原样保留。`rowsPerPageOptions` 接受 **`Array<number | SelectOption>`** —— 传对象即可携带本地化文案（如「30 张/页」），传数字则 label 取数字本身。边界兜底：`rows <= 0` 视为 1（否则 `Math.ceil(total / 0)` 得 `Infinity`）、`total <= 0` 视为 0、**页码越界（含数据变少后超界）自动收敛并回派 `update:page`**、`rows` 变更自动回第 1 页。导航按钮的 aria-label 由 `labels` 提供（中文默认值 + 可覆盖为调用方 i18n 文案），故**零 i18n 分片改动**。⚠️ 组件以 `v-model:page` 驱动，而预览框架只识别 `modelValue` ⇒ **示例为静态快照，点击页码不会改变高亮**（故示例特意用不同 `page` 值覆盖贴左 / 居中 / 贴右 / 折叠等形态）。
- **时间线**：`Timeline` 把一串按先后发生的事件沿线排布，由 **`value`**（事件集合，元素为任意对象）+ **`layout`** 两向（`vertical` 默认：事件自上而下、线在左/右；`horizontal`：事件自左向右、线在上/下）+ **`align`** 三档（竖向 `left` 默认 / `right` 镜像 / `alternate` 左右交替；横向 `top` 默认 / `bottom` 镜像 / `alternate` 上下交替）驱动，渲染完全交给 **`content`（必填）/ `opposite`（对侧内容，如时间戳）/ `marker`（节点，缺省为主题色空心圆）** 三个作用域插槽（作用域统一 `{ item, index }`；官方另有 `icon` 作用域参数与 `connector` 插槽，本项目**均不提供** —— 图标由调用方在插槽内自行渲染 `IconWrapper`）。`opposite` 容器**恒渲染**（即使未传该插槽），以保持两侧等宽、竖线位置稳定；`alternate` 下 0 基偶数索引内容在右、奇数索引在左（等价官方 `nth-child(even) { flex-direction: row-reverse }`），对侧文本始终朝线一侧对齐（横向布局下两侧都是横排文本块，改为统一左对齐），内容一律左对齐。**横向布局**下各列等高（列高由该列内容决定），对侧与内容各占列高的一半 ⇒ 分隔行落在垂直中线上、节点跨列对齐，连接线为横线且同样**末列不延长**；⚠️ 若各列 `opposite` 的高度不一致（例如换行后行数不同），连线会呈阶梯状（与官方实现一致）—— 需要严格水平对齐时让 `opposite` 等高或留空。默认节点是 **10px 空心圆**（2px 主题色描边 + 背景色填充，填充遮住穿行的线），连接线 2px 取 `--b3-border-color`，**末项不再延长**（列表自然收口）。四档 `size` **只驱动字号**（10/12/14/16px），节点直径与线宽恒定，切换档位时线条结构不抖动。**纯展示**：无自有事件、无 hover / 焦点 / 过渡样式，组件内无可聚焦元素（Tab 直接跳过整块），根节点为语义化 `<ol>`、每项为 `<li>`（额外 attrs 透传到 `<ol>`）；节点上的点击行为由调用方在自己的插槽内容里提供。⚠️ 本分区的示例由清单的 **`slots`** 字段渲染（见「具名插槽」与「清单扩展指南」）。
- **分隔线**：`Divider` 用 **`type`**（`solid` 默认 / `dashed` / `dotted`）× **`layout`**（`horizontal` 默认 / `vertical`）× **`align`** 描述一条 1px 细线，默认插槽可在线上承载文字或图标（**仅有默认插槽**，无具名/作用域插槽）。`align` 语义严格对齐官方：水平取 `left` / `center` / `right`、垂直取 `top` / `center` / `bottom`；**未传时按居中处理**，且**取值与方向不匹配（如水平 + `top`）时不报错、静默回落居中**。实现上**用两段真实线段 + 中间内容**，按对齐隐藏**首段**（`left` / `top`）或**末段**（`right` / `bottom`）线 —— **不复刻官方「根元素画线 + 内容背景遮罩」**：遮罩底色必须等于父容器底色，而本项目父容器底色有 `--b3-theme-background` / `--b3-theme-surface` / Card 内部等多种，遮罩必露色块。线色取 `--b3-border-color`（相邻色陷阱：surface 与 background 灰度仅差约 3%，画细线不可辨）；默认间距水平 `$s-3 0` / 垂直 `0 $s-3`（官方主题为 `1rem`，属有意差异化；单根元素 ⇒ 调用方可用 `class` / `style` 直接覆盖）。⚠️ **垂直分隔需要父容器有确定高度**（非 flex 父容器下会塌成 0），组件已用 `min-height` 兜底；本分区的垂直示例用 `style="height: 80px"` 透传高度。**纯展示**：无自有事件、无 hover / 焦点样式、组件内无可聚焦元素。
- **面板**：`Panel` 是可折叠的内容容器（参考 PrimeVue Panel），由 **`header`**（头部文本，或用 `header` 插槽整体替换）+ **`toggleable`**（是否可折叠，默认 `false`）+ **`collapsed`** 驱动，插槽共 6 个（`default` / `header` / `icons` / `togglebutton` / `toggleicon` / `footer`），事件为 `update:collapsed`（新值）与 `toggle`（`{ originalEvent, value }`）。**`collapsed` 不传时组件内部自持**（非受控，可独立开合），传入即受控（配合 `v-model:collapsed`）—— 因此本分区的「可折叠」示例在预览中**可真实点击切换**，而传了 `collapsed` 的示例是受控但无监听 ⇒ 静态快照。⚠️ **未开启 `toggleable` 时忽略 `collapsed`**（避免「没有切换按钮却已收起」的死锁）。**与官方三处有意差异**：①**不提供 `toggleButtonProps`**（`object` 型 props 袋无法在本项目既宽又安全地类型化），同一需求由官方同样存在的 `togglebutton` 插槽覆盖（可放任意共享 `Button`）；②`header` 插槽作用域**只给 `{ collapsed }`**（官方的 `id` / `class` 分别对应其内部 id 与图标字体类名，本项目用 `IconWrapper` + IconKey，提供会产生误导）；③**折叠用 `v-show` 瞬时收起 + 切换图标 0.12s 旋转，不做官方的高度折叠动画**（不用 JS 测高、不用 `grid-template-rows` 兼容 hack；`v-show` 同时保证内容 DOM 保留、表单状态不丢，且收起后退出 a11y 树与 Tab 序列）。无障碍：切换按钮是共享 `Button` 的纯图标形态 ⇒ 必有 `aria-label`（文案走 `toggleLabel` prop + 中文默认值，可覆盖为调用方 i18n ⇒ **零 i18n 分片改动**）+ `aria-expanded` / `aria-controls`，内容区 `role="region"` + `aria-labelledby` 指向标题；自定义切换按钮请用 `togglebutton` 插槽（作用域含 `toggleCallback` 与 `keydownCallback`，**原生 button 只绑 `toggleCallback`，只有非 button 元素才需 `keydownCallback`**，否则会双触发）。
- **无缝拼接控件**：`InputGroup` + `InputGroupAddon` 把输入框、按钮、下拉、日期与附加项拼成一体化控件（组内零间距、相邻边框 1px 重叠、仅最外侧保留圆角，档位经 `--ig-addon-*` CSS 变量从容器继承）；组内按钮建议用描边外观（`outlined` / `variant="secondary"`），填充态按钮边框为透明，拼接处会呈现实色块；示例默认插槽需渲染多个子组件，故由 `PreviewExample.render` 组装（见下方「清单扩展指南」）。
- **表单标签能力**：`Label` 支持包裹控件建立**原生隐式关联**（`wrapper`，插槽内容直出、不套文本层，避免控件被文本层挤压与样式串染）、**禁用态三入口**（`disabled` prop / 容器 `data-disabled` / 邻近被禁用的兄弟控件）、**必填无障碍**（`required` 的 `*` 对屏幕阅读器隐藏，`required-text` 以视觉隐藏文本播报）。⚠️ 禁用联动的「邻近兜底」仅覆盖**禁用态就在根元素上**的成员（`Switch` 的原生 `button[disabled]`、原生 `input`）；`Input` / `Select` / `DatePicker` 的禁用态加在内部元素上，根元素无 `disabled`，**需由包装层显式标记 `data-disabled`**。另：`FormField` 的 `labelId` 可为内部 `<label>` 指定 id，供控件用 `aria-labelledby` 建立原生关联（不传时输出完全不变，`Select` 已用其建立「可见标签 ↔ 组合框」关联）。
- **内联列表选择**：`Listbox` 在页面上平铺选项列表（与下拉形态的 `Select` 互补），支持单选 / 多选（`multiple`，多选时 `v-model` 为数组）、复选指示（`checkbox`，每项常驻方框）与勾选指示（`checkmark`，配 `highlightOnSelect: false` 可做到「仅勾选、不高亮整行」）、内置筛选（复用 `Input`，按 `label` 与 `keywords` 双字段匹配）、单项禁用（`option.disabled`）、整体禁用与 `error` 校验态；无数据与筛选无结果共用 `emptyText`。⚠️ 键盘范围**只含基础键**（Tab / ↑↓ / Enter / Space / Home / End），不做 Shift/Ctrl 组合键、字符定位与虚拟滚动，也不做选项分组与字段映射。指示器是**纯装饰元素**（`role="option"` 内不得嵌套可交互元素，故刻意不复用 `Checkbox`；勾选图标复用 `IconWrapper`）。
- **下拉选择的无障碍与键盘**：`Select` 对外暴露 `role="combobox"`（`aria-haspopup` / `aria-expanded` / `aria-controls` / `aria-activedescendant` / `aria-disabled`），下拉面板为 `role="listbox"`、每个选项为 `role="option"`（带 `aria-selected` / `aria-disabled`）、分组为 `role="group"`（`aria-labelledby` 指向可见分组标题）。有关联可见标签时控件的无障碍名称自动取自该标签（组件经 `FormField` 的 `labelId` 建立关联）；无可见标签时用 `ariaLabel` / `ariaLabelledby` 显式指定，清除按钮的名称用 `clearLabel`（默认「清除」）。键盘行为：Tab 进入 → ↑↓ 移动并把激活项**滚动入视野** → Enter/Space 选中 → Esc 关闭且**焦点回到选择框**；打开面板时优先定位到当前已选项（无已选项时 ↓ 落首项、↑ 落末项）；`filterable` 时筛选框内 ↑↓/Enter/Esc 同样生效（Space 与可打印字符正常输入）。列表容器恒常渲染（无匹配时也保留 `role="listbox"` 落点），筛选框在无匹配结果时不再消失。
- **滑块能力**：`Slider` 基于原生 `input[type=range]`，键盘（←→↑↓ / Home / End / PageUp / PageDown）与 `role="slider"` + `aria-valuemin|valuemax|valuenow` 全部由浏览器原生提供，组件只补 `aria-labelledby`（有可见标签时自动关联，经 `FormField` 的 `labelId`）与 `aria-readonly`。`showValue` 在轨道右侧显示当前值，`showMinMax` 在轨道**下方两侧**显示最小/最大值；两者共用 `formatValue`（极值也走同一格式化函数）。`readonly` 会拦截拖拽与全部改值按键（原生 range 不支持 `readonly`，组件内自行把 DOM 值回滚到受控值）；`disabled` 交给原生属性。四档尺寸经根类输出 `--si-slider-track-h` / `--si-slider-thumb-size` 单点驱动轨道与拇指，档位值为 3/4/6/8px 与 10/14/16/18px。
- **代码复制**：每个示例卡片对应一段可复制的 Vue 用法代码（`copyToClipboard` + 已复制反馈）。
- **导航与检索**：左侧锚点导航（按组件分区跳转）+ 组件名搜索过滤，兼容超长内容滚动。
- **组件尺寸档位**：头部 XS / S / M / L 四档切换，作用于所有支持 `size` 的组件（`PreviewGroup.sizeable` 标记的 Button / ToggleButton / Input / Textarea / InputGroup / FormField / Label / Select / Listbox / Switch / Checkbox / RadioButton / DatePicker / Slider / SpeedDial / Paginator / Timeline / Tag / Badge / Avatar / Card / ConfirmDialog）——渲染时向**未显式指定 `size`** 的示例注入全局档位；显式指定 `size` 的示例（尺寸对比用例）保持原样，避免标题与实际渲染不符。选择经 `TypedStorage` 持久化。
  - 四档字号阶梯为 **10 / 12 / 14 / 16px**（`$font-size-2xs` / `$font-size-xs` / `$font-size-sm` / `$font-size-base`），切档后文字大小可辨；Card 标题四档同步为 10/12/14/16、副标题为 10/10/12/14，Switch 标签随档位变化，Checkbox 标签随档位变化（方框与指示器图标同步为 14/16/18/20px 与 10/12/14/16px），RadioButton 标签随档位变化（圆框同步为 14/16/18/20px，内部圆点按 50% 等比），Textarea 的字号与内边距随档位变化（2px 6px / 2px 6px / 6px 10px / 10px 14px），Slider 的当前值与极值标签随档位变化（轨道与拇指同步为 3/4/6/8px 与 10/14/16/18px），DatePicker 的输入框与日历单元格字号同阶变化（单元格边长 22/24/28/32px），Select 的 XS 档下拉内部（筛选框/空态/分组标题）一并降为 10px，Timeline 的事件文字随档位变化（10/12/14/16px，节点直径与连接线宽恒定）。规则见 `AGENTS_STYLE.md` § 组件 size 档位字号阶梯。
  - 注：Chart（`size` 为预设像素宽高，大档会撑破卡片）、IconWrapper（`size` 为像素数）、Loader（无 props）、Divider（无 `size` prop）、Panel（无 `size` prop）不参与档位切换；图标尺寸不随档位缩放。
- **明暗适配**：不自行造主题——面板与组件全部消费思源 `--b3-theme-*` 变量，明暗随思源主题自动切换（Chart 经自身 `theme: "auto"` 同样跟随）。
- **单选组的快照局限**：`RadioButton` 是「多实例互相约束」的组件（同组共享同一个 `v-model` 与 `name`，各实例 `value` 不同），单卡片快照只能呈现一个实例，因此分区内快照用于确认外观与状态；组用法见 `previewData/radioButton.ts` 中「单选组（同 v-model + 同 name）」示例的 `code` 模板。

## 承载与生命周期

- Manager 类（`types/index.ts`）：模块级 `tabRegistered` 防重复注册 `addTab` 模型；`open()`/`openFloating()` 切换主窗口/浮动窗口；`mountPanel`/`unmountPanel` 管理 Vue 挂载（容器补 `vp-dock-root` 全局基准字号）。
- 注册入口（`index.ts`）：`registerComponentPreview(plugin)` 内部实例化并自挂载 `(plugin as any).__componentPreview`（实现 `destroy()`），已加入 `src/index.ts` 的 `DESTROYABLE_KEYS` 统一销毁；另注册页签图标。
- 命令入口：`addCommand` 的 langKey 为 `openComponentPreview`，**不绑定默认快捷键**（`⌃⌥V` 已由视频管理器占用），仅作为命令面板入口存在；超级面板 action 经 `ACTION_EVENT_MAP` 派发 `openComponentPreview` 全局事件打开。
- 状态栏集成：已登记到 `statusBar/featureRegistry.ts` 功能列表——抽屉中可 pin 到状态栏快捷区、带功能开关角标（`enableComponentPreview`）、可分配自定义分类；点击派发 `openComponentPreview` 事件打开窗口。快捷项图标色 `--status-color-component-preview`。

## 弹层类组件的预览沙箱

`ConfirmDialog` 这类弹层组件的遮罩是 `position: fixed; inset: 0`，直接放进快照会铺满整个预览窗口。`styles/PreviewSection.scss` 的 `.cp-card__stage` 因此设置 `position: relative`，并把舞台内的 `.si-confirm-mask` 覆盖为 `position: absolute; z-index: 1` —— **仅作用于预览沙箱，不改组件本体**（组件在真实调用处仍是全屏固定弹层）。后续新增其它弹层类共享组件时，在同一处追加对应遮罩类名即可。

`SpeedDial` 默认 `position: fixed` 悬浮于视口角落（角落档位靠 `right/bottom` 定位），同样按上述机制在舞台内覆盖为 `position: absolute`（`right/bottom` 遂改为相对舞台生效），并新增 `.cp-card__stage--speeddial` 给足高度 —— 因为 `.cp-card` 是 `overflow: hidden`，展开后的动作会超出舞台被裁掉。该高度类由 `PreviewSection.vue` 按 `group.id === 'speedDial'` 判定，追加其它需要特殊舞台尺寸的组件时照此办理。

## 具名插槽（作用域插槽可经 `slots` 渲染，其余在此登记）

`PreviewExample` 支持 `props` + 默认插槽（`slotText`，或 `render` 函数组装多个子组件）+ **具名/作用域插槽（`slots`，值为接收该插槽作用域参数的 VNode 工厂）**；作用域插槽现已能在快照卡片中渲染（`Timeline` 的 `content` / `opposite` / `marker` 即由 `slots` 呈现），无法用单卡片快照表达的语义（如需要跨实例协作）仍在此登记，改动时同步维护：

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
| `Listbox` | `option` | `{ option, selected }` | 自定义列表项内容（双行文案、徽标等）；不传时回退为 `option.label`。本分区未提供该插槽示例（需配合 `slots` 渲染），用法见本行 |
| `SpeedDial` | `item` | `{ item, onClick, toggleCallback }` | 整块替换单个动作项（如「图标 + 文案」的横排卡片）；不传时渲染为圆形图标动作按钮 |
| `SpeedDial` | `button` | `{ visible, toggleCallback }` | 整块替换主按钮；`toggleCallback` 需自行接到点击事件上 |
| `SpeedDial` | `icon` | `{ visible }` | 仅替换主按钮内的图标（保留圆形浮钮本体与开合逻辑） |
| `Timeline` | `content` | `{ item, index }` | 事件主内容（渲染在线的内容侧：竖向为左/右、横向为上/下）；组件不校验，未传时该侧留空 |
| `Timeline` | `opposite` | `{ item, index }` | 线另一侧的附加内容（典型为时间戳）；**容器恒渲染**，未传该插槽时对侧留空（两侧等宽 / 等高、线位置稳定） |
| `Timeline` | `marker` | `{ item, index }` | 自定义节点（序号 / 图标 / 缩略图）；未传时回退为 10px 主题色空心圆 |
| `Card` | `title` | — | 覆盖标题内容（渲染在标题样式容器 `.si-card__title` 内，可放「图标 + 文本」等富内容）；不传时回退 `title` prop |
| `Card` | `subtitle` | — | 覆盖副标题内容；不传时回退 `subtitle` prop |
| `Card` | `content` | — | 覆盖主体内容；**未传时回落默认插槽**，故官方的 `<template #content>` 写法可直接照搬 |
| `Card` | `header` | — | ⚠️ **语义与官方不同**：本项目是「整块替换标题栏（caption + `header-extra`）」，官方是 body 之外的通栏区（通常是整宽图片）——对应官方通栏请用 `cover` |
| `Card` | `header-extra` | — | 标题栏右侧附加区（按钮、徽标等）；标题栏渲染时才可见 |
| `Card` | `cover` | — | 封面区（`cover` prop 的图片也可由本插槽替换），承担官方的通栏 header 角色 |
| `Card` | `footer` | — | 底部区；⚠️ 本项目为**独立分区并带上边框**（官方 footer 位于 body 内、无上边框），内容排列（如按钮组）由调用方自行提供 |
| `Panel` | `header` | `{ collapsed }` | 头部整体替换（⚠️ 官方另传 `id` / `class`，本项目不提供：分别是其内部 id 与图标字体类名）；不传时回退 `header` prop |
| `Panel` | `icons` | — | 头部操作区（与内置切换按钮同区，位于其左侧），可放图标按钮、菜单触发器等 |
| `Panel` | `togglebutton` | `{ collapsed, toggleCallback, keydownCallback }` | 整块替换切换按钮；**原生 button 只绑 `toggleCallback`**，非 button 元素才需 `keydownCallback`（否则双触发） |
| `Panel` | `toggleicon` | `{ collapsed }` | 仅替换切换按钮内的图标（此时走「传默认插槽」分支，不改动内置按钮的其余行为；仅此分支不参与 180° 旋转动画） |
| `Panel` | `footer` | — | 底部区（内置上边框与 surface 底色），适合放按钮组；不传时不渲染 |

`SelectOption` 的 `keywords?: string` 为 `filterable` 的附加检索词（标签之外的别名/描述检索），清单中已有对应示例。

## 事件契约（无法在快照中呈现，在此登记）

快照只能展示初始 props 的渲染结果，**事件语义**无法呈现。约定语义特殊（非纯 `v-model`）的事件在此登记，改动时同步维护：

| 组件 | 事件 | 语义 |
| --- | --- | --- |
| `ColorField` | `update:modelValue` | 实时值：hex 文本框逐字输入时持续触发，仅更新内存 |
| `ColorField` | `change` | 提交信号：文本框 blur/回车、或在调色板选色后触发；消费方据此落盘，避免逐字写盘 |
| `Slider` | `update:modelValue` / `change` | 同上模式：拖动过程只发 `update:modelValue`，松手才发 `change` |
| `Input` | `update:modelValue` / `change` | 同上模式：原生 `input` / `change` 分别转发 |
| `Textarea` | `update:modelValue` / `change` | 同上模式：原生 `input` / `change` 分别转发；另有 `input` / `focus` / `blur` / `keydown` 事件透传 |
| `ToggleButton` | `update:modelValue` / `change` / `click` | 点击即同时派发 `update:modelValue`（翻转后的布尔值）与 `change`（提交信号），随后派发原生 `click` 事件；`disabled` 时三者均不派发 |
| `SpeedDial` | `update:visible` / `show` / `hide` | 开合状态变更：`update:visible` 承载新值（支持 `v-model:visible`），并按新值派发 `show` 或 `hide`；不传 `visible` 时组件也可独立开合（内部兜底状态） |
| `SpeedDial` | `select` / `click` | `select(action, event)` 在点击某个动作时派发（同时会先调用该项的 `onClick`，随后收起）；`click(event)` 是主按钮的原生点击；另有 `focus` / `blur` 转发主按钮焦点事件 |
| `Paginator` | `update:page` / `update:rows` / `change` | `update:page`（1 基新页码）与 `update:rows`（每页条数）为实时跟随；`change` 为一次性提交信号，载荷 `{ page, rows, total, totalPages, first, last }`。**`rows` 变更会在同一次交互中先派发 `update:rows`、再（必要时）派发 `update:page(1)`，最后派发一次 `change`** —— 消费方按 `change` 落盘即可 |
| `DatePicker` | `update:modelValue` / `change` | 同日提交：选中、手输解析、清除时两者同时触发（无「实时跟随」阶段）；另有 `visibleChange`（弹层开合）、`viewChange`（视图切换）、`clear` |
| `ConfirmDialog` | `confirm` / `cancel` | 确认按钮触发 `confirm`（不自动关闭，由父组件决定关闭时机，便于异步操作）；取消（取消按钮 / 遮罩点关 / Esc）触发 `cancel` 并同时派发 `update:visible(false)`，故支持 `v-model:visible` |
| `Card` | `click` | 仅在 `clickable` 为真且非 `disabled` / `loading` 时派发（载荷为原生 `MouseEvent`）；`disabled` / `loading` 时静默不派发 |
| `Panel` | `update:collapsed` | 折叠状态变更的新值（`boolean`），**受控与非受控两种模式下都会派发**；支持 `v-model:collapsed` |
| `Panel` | `toggle` | 切换时派发的完整事件：`{ originalEvent: Event, value: boolean }`；与 `update:collapsed` 同时派发，顺序为先 `update:collapsed` 后 `toggle` |

> 通用建议：需要「实时跟随 + 一次性落盘」的交互（滑块、颜色、文本输入），消费方应监听 `update:modelValue` 做内存更新、监听 `change` 做持久化，可避免写放大与提示刷屏。

## 清单扩展指南

1. 在 `previewData/` 对应分组文件（或新文件）追加 `PreviewGroup` / 往 `examples` 添加 `PreviewExample`：
   - `title`：示例标题（中文）
   - `props`：透传给组件的 props 组合
   - `slotText`：默认插槽文本（需要插槽的组件）
   - `render`：复合示例的默认插槽渲染函数（可选，存在时优先于 `slotText`；入参为注入全局档位后的实际渲染 props，返回 VNode 或 VNode[]；用于 `InputGroup` 这类插槽内需放多个子组件的示例）
   - `slots`：具名 / 作用域插槽渲染（可选），形如 `{ content: (slotProps) => VNode }`；键为插槽名，工厂接收该插槽的作用域参数。**工厂可能被多次调用（列表类组件每个事件一次），必须在工厂内部新建 VNode**，不可在数据文件顶层构造后复用同一实例
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
