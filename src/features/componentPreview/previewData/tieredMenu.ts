/**
 * 组件预览清单 — TieredMenu 分组数据
 *
 * 注 1：级联菜单的关键特征是「**展开后的多层子菜单**」，纯 props 快照看不出
 *      ⇒ 这里内联一个**演示宿主**：首帧后派发一次 `pointerenter` 模拟悬停来展开首项子菜单，
 *      使快照直接呈现二级菜单（再做不做三层由 `depth` 控制）。
 * 注 2：展开态由组件**非受控自持** ⇒ 预览中可真实悬停、点击、键盘漫游。
 * 注 3：宿主内的项一律 `pointer-events: none` 之外的普通元素，模拟真实调用方的导航项。
 * 注 4：宿主自身只是预览脚手架，转发 props 时用宽松对象（与渲染层 PreviewStage 同法）。
 */
import type {
  Component,
  PropType,
  VNode,
} from "vue"
import {
  defineComponent,
  h,
  ref,
} from "vue"
import type {
  ComponentSize,
  PreviewGroup,
} from "../types"
import type { IconKey } from "@/components/kit/icons"
import Button from "@/components/Button.vue"
import TieredMenu from "@/components/TieredMenu.vue"

/** 菜单项结构（预览数据本地声明，避免从 .vue 导入类型 —— 该写法在 TS 视角下不可靠） */
interface PreviewMenuItem {
  key: string
  label?: string
  /** ⚠️ 用 `IconKey` 而非 `string`：透传给 TieredMenu 的严格项类型 `TieredMenuItem`（icon?: IconKey）时报 TS2769 */
  icon?: IconKey
  disabled?: boolean
  separator?: boolean
  items?: PreviewMenuItem[]
  command?: (item: PreviewMenuItem, event: MouseEvent | KeyboardEvent) => void
}

/** 三层嵌套模型：文件 → 导出 → 图片 / 文档（演示逐级下钻） */
const FILE_MENU: PreviewMenuItem[] = [
  { key: "new", label: "新建", icon: "plus" },
  { key: "open", label: "打开", icon: "folder" },
  { key: "sep-1", separator: true },
  {
    key: "export",
    label: "导出为",
    icon: "upload",
    items: [
      {
        key: "export-image",
        label: "图片",
        icon: "fileOutline",
        items: [
          { key: "export-png", label: "PNG（无损）" },
          { key: "export-jpg", label: "JPG（高压缩）" },
          { key: "export-webp", label: "WebP（现代格式）" },
        ],
      },
      {
        key: "export-doc",
        label: "文档",
        icon: "fileOutline",
        items: [
          { key: "export-pdf", label: "PDF" },
          { key: "export-docx", label: "Word (.docx)" },
          { key: "export-md", label: "Markdown" },
        ],
      },
      { key: "export-zip", label: "压缩包 (.zip)" },
    ],
  },
  {
    key: "share",
    label: "分享",
    icon: "magnify",
    items: [
      { key: "share-link", label: "复制链接" },
      { key: "share-email", label: "发送邮件" },
      { key: "share-qr", label: "二维码", disabled: true },
    ],
  },
  { key: "sep-2", separator: true },
  { key: "rename", label: "重命名", icon: "pencilMultiple" },
  { key: "delete", label: "删除", icon: "delete" },
]

/** 只到二级的浅模型（演示「不必都做深」） */
const SHALLOW_MENU: PreviewMenuItem[] = [
  { key: "copy", label: "复制", icon: "copy" },
  { key: "paste", label: "粘贴", icon: "fileOutline", disabled: true },
  { key: "sep", separator: true },
  {
    key: "sort",
    label: "排序方式",
    icon: "viewGrid",
    items: [
      { key: "sort-name", label: "按名称" },
      { key: "sort-size", label: "按大小" },
      { key: "sort-date", label: "按修改时间" },
    ],
  },
]

const TieredMenuDemo = defineComponent({
  name: "TieredMenuDemo",
  props: {
    // ⚠️ 联合类型必须用 `PropType` 收窄：只写 `type: String` 会让 props 退化为 `string`，
    //    透传给 Button / TieredMenu 的严格联合（ButtonSize / TieredMenuSize / TieredSubmenuSide）时报 TS2769
    size: { type: String as PropType<ComponentSize>, default: "small" },
    submenuSide: { type: String as PropType<"left" | "right">, default: "right" },
    disabled: { type: Boolean, default: false },
    tabindex: { type: Number, default: 0 },
    ariaLabel: { type: String, default: "文件操作" },
    /** 预览脚手架：用哪套模型 */
    model: { type: String, default: "file" },
    /** 预览脚手架：是否模拟展开首项子菜单 */
    expand: { type: Boolean, default: false },
    /** 预览脚手架：popup 模式的触发按钮文案 */
    popupDemo: { type: Boolean, default: false },
  },
  setup(props) {
    const rootRef = ref<HTMLElement | null>(null)
    const menuRef = ref<any>(null)
    let seeded = false

    return (): VNode => {
      const items = props.model === "shallow" ? SHALLOW_MENU : FILE_MENU

      // 首帧后模拟悬停，展开首个子菜单（让快照呈现级联形态）
      if (props.expand && !seeded) {
        seeded = true
        requestAnimationFrame(() => {
          const root = rootRef.value
          if (!root) return
          const firstParent = root.querySelector<HTMLElement>(
            '.si-tieredmenu__link[data-tm-has-submenu]',
          )
          firstParent?.dispatchEvent(new PointerEvent("pointerenter", { bubbles: false }))
        })
      }

      if (props.popupDemo) {
        return h("div", { class: "cp-tieredmenu-demo", ref: rootRef }, [
          h(Button, {
            variant: "ghost",
            outlined: true,
            size: props.size,
            onClick: (event: MouseEvent) => menuRef.value?.toggle(event),
          }, () => "右键式弹出（点击我）"),
          h(TieredMenu, {
            ref: menuRef,
            model: items,
            popup: true,
            size: props.size,
            submenuSide: props.submenuSide,
            disabled: props.disabled,
            ariaLabel: props.ariaLabel,
          }),
        ])
      }

      return h("div", { class: "cp-tieredmenu-demo", ref: rootRef }, [
        h(TieredMenu, {
          model: items,
          size: props.size,
          submenuSide: props.submenuSide,
          disabled: props.disabled,
          tabindex: props.tabindex,
          ariaLabel: props.ariaLabel,
        }),
      ])
    }
  },
})

export const tieredMenuGroup: PreviewGroup = {
  id: "tieredMenu",
  component: TieredMenuDemo as Component,
  name: "TieredMenu",
  summary: "级联菜单：子菜单逐级嵌套下钻（任意层），支持内联与事件坐标处弹出（popup）两种形态",
  importCode: "import TieredMenu from \"@/components/TieredMenu.vue\"",
  sizeable: true,
  examples: [
    {
      title: "基础（展开二级子菜单）",
      props: { expand: true },
      code: `<script setup>
// items 可**递归任意层** —— 这是 TieredMenu 与 MegaMenu（只支持一层）的根本区别
const model = [
  { key: "new", label: "新建", icon: "plus" },
  { key: "sep", separator: true },                       // 分隔线：不参与键盘漫游
  {
    key: "export",
    label: "导出为",
    icon: "upload",
    items: [
      { key: "png", label: "PNG" },
      {
        key: "doc", label: "文档",                        // 还可以继续往下嵌
        items: [{ key: "pdf", label: "PDF" }],
      },
    ],
  },
]
</script>

<template>
  <TieredMenu :model="model" aria-label="文件操作" @select="(item) => onPick(item)" />
</template>`,
    },
    {
      title: "收起态（默认）",
      props: {},
      code: `<TieredMenu :model="model" aria-label="文件操作" />`,
    },
    {
      title: "浅层菜单（只到二级）",
      props: {
        model: "shallow",
        expand: true,
      },
      code: `<!-- 不要求都做深：items 只在需要下钻的项上给 -->
<TieredMenu :model="model" aria-label="编辑操作" />`,
    },
    {
      title: "向左展开（submenu-side=\"left\"）",
      props: {
        expand: true,
        submenuSide: "left",
      },
      code: `<!-- 菜单靠近视口右缘时改用向左展开；实际项目中按可用空间选择 -->
<TieredMenu :model="model" submenu-side="left" aria-label="文件操作" />`,
    },
    {
      title: "禁用项与分隔线",
      props: {
        model: "shallow",
        expand: true,
      },
      code: `<!-- disabled 项：不可点击、不展开，方向键也跳过；separator 项不参与键盘漫游 -->
const model = [
  { key: "copy", label: "复制" },
  { key: "paste", label: "粘贴", disabled: true },
  { key: "sep", separator: true },
]`,
    },
    {
      title: "popup 模式（点击按钮在你点的位置弹出）",
      props: { popupDemo: true },
      code: `<script setup>
const menu = ref(null)

// 典型用法：右键或按钮点击 → 在**事件坐标处**弹出
function onContextMenu(event) {
  event.preventDefault()
  menu.value.show(event)
}
</script>

<template>
  <div @contextmenu="onContextMenu">
    <p>在此区域右键，或点下方按钮</p>
    <Button @click="(e) => menu.toggle(e)">打开菜单</Button>
    <!-- popup：菜单默认隐藏，经 defineExpose 的 show / hide / toggle 控制 -->
    <TieredMenu ref="menu" :model="model" popup aria-label="上下文菜单" />
  </div>
</template>`,
    },
    {
      title: "整体禁用（disabled）",
      props: {
        expand: true,
        disabled: true,
      },
      code: `<TieredMenu :model="model" disabled aria-label="文件操作" />`,
    },
    {
      title: "移出 Tab 序列（tabindex=-1）",
      props: {
        expand: true,
        tabindex: -1,
      },
      code: `<!-- tabindex=-1：整组移出 Tab 序列，仅能经 show() 等方式程序化聚焦 -->
<TieredMenu :model="model" :tabindex="-1" aria-label="文件操作" />`,
    },
    {
      title: "尺寸 - large",
      props: {
        expand: true,
        size: "large",
      },
      code: `<TieredMenu :model="model" size="large" aria-label="文件操作" />`,
    },
    {
      title: "尺寸 - xsmall",
      props: {
        expand: true,
        size: "xsmall",
      },
      code: `<TieredMenu :model="model" size="xsmall" aria-label="文件操作" />`,
    },
  ],
}

export const tieredMenuPreviewGroups: PreviewGroup[] = [tieredMenuGroup]
