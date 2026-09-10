---
name: 优化共享组件 Select（对照 PrimeVue：ARIA + 键盘焦点）
overview: 对照 PrimeVue Select，为共享组件 Select 补齐 ARIA 无障碍（combobox/listbox/option 全套 + 标签关联）与键盘/焦点基础行为（Esc 返还焦点、打开定位已选项、ArrowUp 关闭态打开、激活项滚动到可视区），并顺带修掉「筛选无结果时输入框被卸载」与「筛选框占高导致末项不可达」两个真实缺陷。不引入 multiple / 虚拟滚动 / editable 等大能力。
todos:
  - id: explore-impact
    content: 用 [subagent:code-explorer] 扫描全项目 Select 调用点，产出影响清单并确认无外部依赖被改动结构
    status: completed
  - id: select-nav-split
    content: 用 [mcp:Context7] 核对 PrimeVue Select 的 ARIA 与键盘表后，新建 select/navigation.ts 与 select/useSelectNavigation.ts 并改造 Select.vue 为单一 activeIndex
    status: completed
    dependencies:
      - explore-impact
  - id: select-aria
    content: 给 Select.vue 补齐 combobox/listbox/option/group ARIA 与 ariaLabel、ariaLabelledby、clearLabel，空态并入 listbox
    status: completed
    dependencies:
      - select-nav-split
  - id: select-keyboard
    content: 补键盘与焦点：打开定位已选项、ArrowUp 收起态打开末项、Esc 返还焦点、激活项滚动入视野、筛选框按键委托
    status: completed
    dependencies:
      - select-aria
  - id: select-fixes
    content: 让筛选框无结果时常驻，并把 Select.scss 下拉改 flex 列以修末项被裁切
    status: completed
    dependencies:
      - select-keyboard
  - id: formfield-label-id
    content: 为 FormField 增加可选 labelId 并在 Select 内建立标签关联
    status: completed
    dependencies:
      - select-fixes
  - id: preview-docs-sync
    content: 同步预览与文档：control.ts、input.ts、componentPreview/README.md、AGENTS.md 两行
    status: completed
    dependencies:
      - formfield-label-id
  - id: verify
    content: 用 [skill:universal-arch-skill] 做架构合规审查，并跑 read_lints、tsc 与 scoped 编译核对
    status: completed
    dependencies:
      - preview-docs-sync
  - id: update-memory
    content: 记录当日日志并更新 MEMORY.md 的 Select/FormField 事实
    status: completed
    dependencies:
      - verify
---

## 需求概述

对照 PrimeVue Select 官方文档，对项目已有的共享「下拉选择」组件做一次**无障碍与键盘交互补齐**。组件的外观、尺寸、颜色与调用方式均**保持不变**，改动只发生在「屏幕阅读器能读懂什么」与「只用键盘能否完整操作」这两件事上，因此使用方无需修改任何现有代码。

## 核心功能

### 1. 屏幕阅读器语义补全

- 选择框对外暴露为「组合框（可展开的下拉）」语义：标明它是可展开控件、当前是展开还是收起、展开后控制的是哪一个列表。
- 展开的选项面板对外暴露为「列表」语义，每个选项暴露为「列表项」，并各自标明是否已选中、是否被禁用。
- 选项分组暴露为「分组」语义，分组标题只作为分组名被播报一次（不重复朗读），分组内的选项仍可被逐个朗读。
- 当收起的下拉没有可见文字标签时，可显式指定无障碍名称；有可见标签时，标签文字自动成为控件名称（读到「技术栈，组合框，已折叠」）。
- 清除按钮具备「按钮」语义与名称（如「清除」），图标本身不再被当作文本朗读。

### 2. 键盘与焦点补全

- **Esc** 关闭面板后，焦点回到选择框本身（当前会丢失焦点，是真实缺陷）。
- **打开面板时自动定位到当前已选项**；若尚未选择任何值，则按方向决定落在第一项还是最后一项。
- **↑ 在收起状态打开面板并定位到最后一项**（当前在收起状态按 ↑ 无任何反应）。
- 键盘上下移动与鼠标悬停时，**高亮项自动滚动到可视区域内**，长列表下不再「高亮跑到视野外」。
- **可筛选下拉**中方向键、回车、Esc 直接生效（当前筛选框吞掉了全部按键，键盘完全无法选值）。

### 3. 同轮修掉的两个可见缺陷

- 筛选框在「搜不到任何结果时不再消失」，用户可继续修改关键词（当前会连同焦点一起消失，必须关掉重开）。
- 下拉面板高度改为弹性分配：**修复「筛选框占掉一部分高度后，列表末尾的选项被裁掉且滚动也够不到」**的问题。

## 视觉与交互效果

组件的常态外观、四档尺寸、分组与筛选样式、下拉出现动画、选中与禁用配色**全部保持原样**，无任何视觉回归；唯一的可见变化是上面第 3 条的两处缺陷修复（筛选框常驻、列表末项不再被裁切）。键盘操作时多出一条「高亮项自动滚入视野」的平滑跟随，属于既有交互的自然补全。焦点环、hover 反馈、清除按钮位置与尺寸均不变。

## 边界

本次**不引入**多选、复选框多选、标签片（chips）、超长列表虚拟滚动、可直接键入的编辑态、字段映射（选择项始终是「值 + 标签」结构）；多选场景继续使用已有的内联列表组件。也**不做**校验失败红框、加载态、实底外观、全宽、Home/End/翻页键、以及「输入字符跳到对应选项」的检索跳转。多选与字段映射会破坏两个组件共用的选项类型契约，故明确排除。

## 技术栈

- Vue 3 + TypeScript + SCSS（沿用既有栈，零新增依赖）
- 复用项目既有能力：`useId()`（已有先例：`DatePicker.vue`、`Listbox.vue`、`CollapsibleSection.vue`）、共享 `FormField.vue`、设计 Token（`@/variables.scss`、`components/styles/_mixins.scss`）
- 无障碍基线：WAI-ARIA 1.2 combobox + listbox 模式，与项目内 `DatePicker.vue`（combobox 先例）与 `Listbox.vue`（listbox + `aria-activedescendant` + `scrollIntoView` 先例）的写法严格对齐

## 实现方案

### 总体策略

在**不改动对外契约**的前提下，把 `Select.vue` 的三块逻辑重排：①导航状态由「双份 hover 状态（普通项下标 + 分组键）」收敛为**单一平铺激活下标**；②把平铺构建、锚点定位、id 派生等纯逻辑与响应式派生抽到组件私有子目录 `src/components/select/`；③在模板上补齐 ARIA 语义与键盘/焦点行为。同时对 `FormField.vue` 做一次**纯增量**的可选 prop 扩展，用于把可见标签与控件建立原生关联。

### 关键决策与理由

1. **收敛为单一 `activeIndex`**：现结构用 `hoveredIndex` + `hoveredGroupKey` 两套状态表达同一个「当前高亮项」，消费处需要 3 处重复 `.filter(Boolean)` 做 null 占位过滤，且分组/非分组两条分支的 hover 语义存在漂移风险。改为「渲染顺序 == 导航顺序 == 平铺下标」后，模板只需 `domIndex(option) === activeIndex` 一个判断即可同时驱动高亮与 `aria-activedescendant`，删除 4 个函数与 2 个 ref，净减代码量。

2. **对象 → 下标用 `WeakMap` 一次性构建**：模板渲染是嵌套的（分组 → 子项），需要把「选项对象」映射到平铺下标才能打 `id`。在 `filteredOptions` 变化的 `computed` 内一次性构建 `WeakMap<SelectOption, number>`，复杂度 O(n)，避免在模板里做索引推算，也避免每项每次渲染都重新查找。

3. **沿用 `Listbox` 的 `:ref` 数组滚动方案，不用 `document.getElementById`**：`setOptionRef(el, domIndex)` + `optionEls[domIndex]?.scrollIntoView({ block: "nearest" })`，与项目既有先例完全一致，避免引入全局 DOM 查询。

4. **`FormField` 加 `labelId?: string` 而非在 Select 内自己渲染标签**：共享组件缺能力时应先扩展共享组件（项目硬规则）。`labelId` 为可选、不传时输出零变化，向后兼容；`Select` 传 `labelId = \`${uid}-label\`` 到 `FormField`，trigger 用 `aria-labelledby` 指向它，浏览器/读屏即可自动读出标签文字。不采用「拆掉 FormField 换 Label」的方案（会变更 70 处调用点的 DOM 与样式作用域，风险不可接受）。

5. **筛选框采用独立按键处理函数**：不能直接复用 `handleKeydown`，否则 `Space` 会被 `preventDefault`，用户在筛选框里**无法输入空格**。故 `handleFilterKeydown` 只处理 `ArrowDown` / `ArrowUp` / `Enter` / `Escape`，其余按键原样放行。

6. **清除按钮保持非 Tab 焦点（`tabindex="-1"`）**：与 PrimeVue 行为一致——它是鼠标便捷入口，Tab 序列不应被它打断；补 `role="button"` + `aria-label` 使其在虚拟光标下仍可被读屏发现与激活。

7. **文件拆分放在同一轮完成**：`Select.vue` 当前 573 行，**已突破 500 行硬阈值**（项目硬规则；历史上 `DatePicker` 拆分即以此为依据）。本轮还要新增 ARIA 与键盘逻辑，不拆只会继续恶化。拆分采用私有子目录 `src/components/select/`（禁止 feature 直接导入），入口仍是 `@/components/Select.vue` 单一路径，70 处调用点零改动。

### 性能与可靠性

- 平铺构建与 `WeakMap` 均为 `computed` 缓存，仅在 `options` / `filterQuery` / `modelValue` 变化时重算，单次 O(n)；筛选路径不产生额外数组拷贝（沿用既有 `reduce` 单遍过滤）。
- `aria-activedescendant` 由 `activeIndex` 派生（O(1)），不引入新 watcher。
- 滚动定位仅在 `activeIndex` 变化后 `nextTick` 触发一次，使用原生 `scrollIntoView({ block: "nearest" })`（由浏览器合成，无布局抖动；不会带动外层页面滚动）。
- 无定时器、无新增事件监听（`document` click 监听已存在且 `onMounted`/`onUnmounted` 成对）。
- 可靠性：父级忽略 `v-model` 更新时的视觉表现与既有完全一致（组件仍是受控 + 即时读 `modelValue`）。

## 实现细节与注意事项

### A. ARIA 语义（`src/components/Select.vue`）

| 位置 | 变更 |
| --- | --- |
| `useId()` 派生 | `uid` / `listId = \`${uid}-list\`` / `optionId(i) = \`${uid}-opt-${i}\`` / `groupId(i) = \`${uid}-group-${i}\`` / `labelId = \`${uid}-label\`` |
| `.si-select__trigger` | 加 `role="combobox"`、`aria-haspopup="listbox"`、`:aria-expanded`、`:aria-controls="listId"`、`:aria-activedescendant="activeDescendantId"`、`:aria-disabled`、`:aria-labelledby="ariaLabelledby ?? (label ? labelId : undefined)"`、`:aria-label="ariaLabel"` |
| `.si-select__options` | 加 `role="listbox"` + `:id="listId"`；**空态节点从兄弟位置移入容器内部**（`v-if="filteredOptions.length === 0"` 作为 listbox 子节点，外层容器不再与空态互斥），保证 `aria-controls` 始终有落点 |
| `.si-select__group` / 分组标题 | `role="group"` + `:aria-label="option.label"`；可见的 `.si-select__group-label` 加 `aria-hidden="true"`（避免分组名被播报两次） |
| `.si-select__option`（普通与分组内） | `:id="optionId(domIndex(...))"`、`role="option"`、`:aria-selected="isSelected(...)"`、`:aria-disabled="option.disabled ? 'true' : undefined"` |
| `.si-select__filter-input` | `:aria-label="filterPlaceholder"`（对齐 `Listbox`） |
| `.si-select__clear` | `role="button"` + `tabindex="-1"` + `:aria-label="clearLabel"`；内部 `IconWrapper` 加 `aria-hidden="true"` |
| 新增可选 props | `ariaLabel?: string`、`ariaLabelledby?: string`（命名对齐 `DatePicker.vue`）、`clearLabel?: string`（默认 `"清除"`，沿用组件内中文默认值约定） |


### B. 键盘与焦点（`src/components/Select.vue`）

- `openDropdown(anchor: "selected" | "first" | "last" = "selected")`：先按 `modelValue` 在平铺数组中反查下标；查不到则按 `anchor` 取首项（`first`）或末项（`last`）；无选项则 `activeIndex = -1`。打开后 `nextTick` 滚动激活项入视野，`filterable` 时焦点给筛选框。
- `closeDropdown(options?: { restoreFocus?: boolean })`：`Escape` 与「键盘选中」路径传 `restoreFocus: true` → `trigger.focus()`；**外部点击、`Tab`、鼠标选中一律 `false`**（否则用户点击别处时会被抢焦点）。
- 收起态：`ArrowDown` / `Enter` / `Space` → `openDropdown("selected")`；`ArrowUp` → `openDropdown("last")`。
- 展开态：`ArrowDown` / `ArrowUp` 在当前下标的 ±1 上钳制（到端点保持不动），移动后滚动入视野；`Enter` / `Space` 选中当前高亮项（禁用项跳过）；`Escape` 关闭并返还焦点；`Tab` 关闭不抢焦点。
- `filterQuery` 变化（`filteredOptions` 重算）后，把 `activeIndex` 重置为 `-1`（避免指向已不存在的项）。
- `handleFilterKeydown`：只处理 `ArrowDown` / `ArrowUp` / `Enter` / `Escape` 并委托给同一套逻辑；**不得拦截 `Space` 与其他可打印字符**。

### C. 同轮修复（同一改动面）

1. 筛选框渲染条件由 `v-if="filterable && filteredOptions.length > 0"` 改为 `v-if="filterable"`（否则输入一个不匹配字符即卸载输入框、焦点掉到 body）。
2. `src/components/styles/Select.scss`：`.si-select__dropdown` 改 `display: flex; flex-direction: column`；`.si-select__options` 由 `max-height: inherit` 改为 `flex: 1 1 auto; min-height: 0; overflow-y: auto`（`max-height` 归零交给内联 `max-height` 的父层约束）。这样筛选框 + 列表在面板高度内正确分配，末项不再被 `overflow: hidden` 裁掉。

### D. SCSS 约束

- 档位变体必须继续写反向选择器 `.si-select--xsmall & { ... }` 形式；颜色保持 `var(--b3-theme-*, $color-*)` 双保险；不改动焦点环实现（`@include m.focus-ring`）。
- 本次 SCSS 改动仅「下拉容器 flex 化 + 列表高度」，**不新增选择器嵌套层级**，避免影响两处外部覆写（`gitPush/styles/CommitRuleCheckPanel.scss:34` 与 `RepoPushPanel.scss:34` 的 `.si-select__dropdown { min-width }`、`flashcardReading/styles/index.scss:173` 的 `.si-select { flex: 1 }`、`CardDialog.scss:75` 的 `width: 100%`）。

### E. 回归面控制（70 处调用点）

- 新增 props 全部可选、默认值不变；`props`/`emits`/`expose` 契约完全不变。
- DOM 变更仅 2 处（空态节点位置、筛选框常驻）；已 grep 确认全项目**无外部引用** `.si-select__empty` / `.si-select__options` / `.si-select__filter`，仅 2 处覆写 `.si-select__dropdown { min-width }`（不受 flex 化影响）。
- 拆分后 `@/components/Select.vue` 仍是唯一导入路径，`SelectOption` / `SelectGroupOption` 两个导出保持从 `Select.vue` 转出（`Listbox.vue` 与多个 feature 依赖它们，**不得改变导出位置**）。

### F. 文档与预览同步（项目硬规则）

- `previewData/control.ts` → `selectGroup` 新增示例「无障碍命名（无可见标签）」：`props: { ariaLabel: "技术栈", options, modelValue }`，`code` 与 props 严格一致。
- `previewData/input.ts` → `formFieldGroup` 新增示例「标签关联 id（labelId）」：`props: { label: "字段名", labelId: "field-label-1" }` + `slotText` + `code` 展示控件侧 `aria-labelledby` 的关联写法（`labelId` 无可见渲染差异，必须靠 `code` 承载 API 说明）。
- `componentPreview/README.md`：在「事件契约」/「具名插槽」区附近补 **Select 的无障碍与键盘约定**说明（combobox 关系、Esc 焦点返还、打开定位已选项、可用 `ariaLabel` / `ariaLabelledby` / `clearLabel`），并补 **FormField `labelId`** 一行。
- `AGENTS.md` 组件清单表：`Select.vue` 行关键 props 补 `ariaLabel` / `ariaLabelledby` / `clearLabel`；`FormField.vue` 行补 `labelId`。
- `.codebuddy/memory/2026-09-10.md` 追加本轮条目；`MEMORY.md` 的共享组件条目补 Select/FormField 的新事实。

## 架构设计

### 模块划分

- **入口层** `src/components/Select.vue`：模板（ARIA 属性 + 高亮判定）与组件本地状态（`isOpen` / `filterQuery` / `placement` / 焦点与滚动副作用），仅保留模板相关逻辑。
- **纯逻辑层** `src/components/select/navigation.ts`：无 Vue 依赖的类型与纯函数（平铺构建、锚点下标解析、按对象反查下标、类型守卫）。放在私有子目录，禁止 feature 直接导入。
- **响应式派生层** `src/components/select/useSelectNavigation.ts`：把纯函数与响应式状态绑定，对外暴露 `flatItems` / `domIndex(option)` / `activeIndex` / `activeDescendantId` / `optionId` / `groupId` / `setActiveByFlatIndex` / `setActiveByOption` / `registerOptionRef` / `scrollActiveIntoView`（composable 只接收结构化子集参数，不复用 SFC 宏类型，遵循 `DatePicker` 的既有做法）。

### 数据流

用户按键/悬停 → `activeIndex`（唯一来源）→ 派生 `activeDescendantId` 与模板高亮类 → `nextTick` 滚动激活项入视野；用户确认选中 → `emit("update:modelValue")` + `emit("change")` → 关闭面板（按来源决定是否返还焦点）。

## 目录结构

```
siyuanPluginVueSN/
├── src/
│   └── components/
│       ├── Select.vue                                   # [MODIFY] 入口：ARIA 属性、高亮判定改为单一 activeIndex、键盘/焦点/滚动调用、新增 3 个可选 props（净减行数，控制在 450 行内）
│       ├── FormField.vue                                # [MODIFY] 新增可选 prop labelId（:id 打在 .si-form-field__label），不传时输出零变化
│       ├── select/
│       │   ├── navigation.ts                            # [NEW] 纯类型 + 纯函数：FlatOptionItem、buildFlatItems、resolveAnchorIndex、resolveFlatIndexByOption、isGroupOption（从入口下移，避免循环依赖）
│       │   └── useSelectNavigation.ts                   # [NEW] 导航与 ARIA 派生 composable：useId 派生 id 工厂、WeakMap 下标映射、activeIndex、activeDescendantId、optionEls 注册与 scrollIntoView
│       └── styles/
│           └── Select.scss                              # [MODIFY] 下拉容器 flex 列化 + 列表高度弹性分配（修末项被裁切）
├── src/features/componentPreview/
│   ├── previewData/control.ts                           # [MODIFY] selectGroup 新增「无障碍命名（无可见标签）」示例
│   ├── previewData/input.ts                             # [MODIFY] formFieldGroup 新增「标签关联 id（labelId）」示例
│   └── README.md                                        # [MODIFY] 补 Select 无障碍与键盘约定说明 + FormField labelId 说明
├── AGENTS.md                                            # [MODIFY] 组件清单表 Select.vue 行补 3 个 props、FormField.vue 行补 labelId
└── .codebuddy/memory/
    ├── 2026-09-10.md                                    # [MODIFY] 追加本轮实施记录
    └── MEMORY.md                                        # [MODIFY] 补 Select/FormField 的 ARIA 与 labelId 事实
```

## 关键代码结构

```ts
// src/components/select/navigation.ts —— 纯逻辑契约（被入口与 composable 共用）
export interface FlatOptionItem {
  option: SelectOption
  /** 所属分组下标；-1 表示非分组选项 */
  groupIndex: number
  /** 分组内下标；-1 表示非分组选项 */
  optionIndex: number
  /** 渲染顺序下标（= 平铺数组下标 = DOM 顺序） */
  domIndex: number
}

/** 按渲染顺序展开分组，产出与 DOM 一一对应的平铺数组（无 null 占位） */
export function buildFlatItems(options: Array<SelectOption | SelectGroupOption>): FlatOptionItem[]

/** 解析打开面板时的初始激活下标：先找已选项，找不到按 anchor 取首/末项；无选项返回 -1 */
export function resolveAnchorIndex(
  items: FlatOptionItem[],
  selectedValue: string | number | boolean | null | undefined,
  anchor: "first" | "last",
): number
```

```ts
// 新增的对外 props（全部可选，向后兼容）
interface Props {
  // ...既有 props 不变
  /** 无障碍名称（无可见 label 时使用） */
  ariaLabel?: string
  /** 无障碍名称来源元素 id */
  ariaLabelledby?: string
  /** 清除按钮的无障碍名称 */
  clearLabel?: string
}

// src/components/FormField.vue 新增（可选，不传时零变化）
interface Props {
  /** 标签元素 id，供控件用 aria-labelledby 建立关联 */
  labelId?: string
}
```

## 验证方案

- 可执行（只读）：`read_lints`（`Select.vue` / `FormField.vue` / `select/*` / `previewData/control.ts` / `previewData/input.ts`）、`npx tsc --noEmit` 过滤上述路径确认零新增报错。
- SCSS：用 Sass 展平后喂 `@vue/compiler-sfc` 的 `compileStyle({ scoped: true })`，确认改动选择器仍锚定在带 `data-v` 的元素上。
- 结构：确认拆分后 `SelectOption` / `SelectGroupOption` 仍从 `@/components/Select.vue` 导出（`Listbox.vue` 等依赖点不改 import 来源）。
- **禁止** 执行 `pnpm lint` / `pnpm vite build`（由用户自行验证）。
- 用户侧目视清单：键盘 Tab 进入 → ↑↓ 移动并自动滚入视野 → Enter 选中 → Esc 关闭且焦点回到选择框；筛选态下方向键/回车/Esc 可用；无匹配结果时筛选框不消失；长列表末项可滚动到。

## Agent Extensions

### MCP

- **Context7**
- Purpose: 在执行前用 `resolve-library-id` + `query-docs` 拉取 PrimeVue Select 的**权威 API / Slots / 无障碍章节**（本次仅网页正文可取，API 表格缺失），交叉核对 combobox / listbox / option 三层 ARIA 属性清单与「关闭态 / 展开态 / 筛选框」三张键盘表，确认本项目落地的每一条语义都有官方依据。
- Expected outcome: 产出经官方文档核对过的 ARIA 属性与键盘行为对照清单，并明确记录本项目对 PrimeVue 的每一处有意偏离（不引入 multiple / 虚拟滚动 / editable / 字段映射；`error` 与 `loading` 本次不做；`clearable` 沿用项目命名而非 `showClear`）。

### SubAgent

- **code-explorer**
- Purpose: 对全项目 Select 调用点做一次影响面扫描，确认除已发现的 4 处样式覆写（2 处 `.si-select__dropdown { min-width }`、`.si-select { flex }`、`.si-select { width }`）外，没有任何 feature 依赖将被改动的 DOM 结构、类名或内部状态。
- Expected outcome: 一份「调用点影响清单」，明确需回归验证的文件与确认零依赖的结论，作为本轮改动的爆半径基线。

### Skill

- **universal-arch-skill**
- Purpose: 改动完成后运行模式 A（`validate-project-structure.py --lang vue --features componentPreview`）与模式 C 审查：核对新增私有子目录 `select/` 是否被 feature 直接导入、`.vue` 内 `<style>` 是否仅剩 `@use`、SCSS 是否零硬编码字号/颜色、文件头注释是否齐备、`Select.vue` 行数是否回到阈值内、预览清单与文档同步是否齐全。
- Expected outcome: 一份架构合规审查结论（0 错误 0 警告为目标），若有违规点则输出为修复清单并逐条闭环。