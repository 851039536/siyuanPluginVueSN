/**
 * 组件预览清单 — Sidebar 分组数据
 *
 * 注 1：`Sidebar` + `SidebarMain` 是**两件套**（共用本分区，同 Tabs 五件套先例），
 *      「让位 / 折叠 / 浮层」都必须成对渲染才看得出效果 ⇒ 内联一个**演示宿主**
 *      把两者装进一个定位容器，示例通过 props 组合侧边栏形态。
 * 注 2：宿主容器自带 `position: relative`（浮层模式的定位基准）与固定高度，
 *      否则 `overlay` 的绝对定位无处落地、`inset` 也无从内缩。
 * 注 3：展开态由组件**非受控自持**（不传 `open`）⇒ 预览中可真实点击 / 悬停切换；
 *      仅「受控」一条示例由宿主自持 `open`（静态快照）。
 * 注 4：折叠为图标条时，标记了 `si-sidebar__label` 的文案会被隐藏（样式约定），
 *      故宿主内的项都是「图标 + 带该类名的文案」结构。
 */
import type { Component, VNode } from "vue"
import {
  defineComponent,
  h,
  ref,
} from "vue"
import type { PreviewGroup } from "../types"
import type { IconKey } from "@/components/kit/icons"
import IconWrapper from "@/components/IconWrapper.vue"
import Sidebar from "@/components/Sidebar.vue"
import SidebarMain from "@/components/SidebarMain.vue"

/** 宿主内的导航项（图标 + 文案，文案带 `si-sidebar__label` 以便折叠时隐藏） */
const navItem = (icon: IconKey, label: string) => h(
  "div",
  { class: "cp-sidebar-item" },
  [
    h(IconWrapper, { name: icon, size: 16 }),
    h("span", { class: "si-sidebar__label" }, label),
  ],
)

const NAV_ITEMS: [IconKey, string][] = [
  ["fileOutline", "文档"],
  ["folder", "笔记本"],
  ["star", "收藏"],
  ["magnify", "搜索"],
  ["viewGrid", "全部"],
]

const SidebarDemo = defineComponent({
  name: "SidebarDemo",
  props: {
    size: { type: String, default: "small" },
    side: { type: String, default: "left" },
    variant: { type: String, default: "sidebar" },
    collapsible: { type: String, default: "icon" },
    overlay: { type: Boolean, default: false },
    openOnHover: { type: Boolean, default: false },
    dismissable: { type: Boolean, default: true },
    width: { type: String, default: "16rem" },
    iconWidth: { type: String, default: "3rem" },
    ariaLabel: { type: String, default: "主导航" },
    /** 预览脚手架：初始收起（非受控无初始 open 入参，故收起示例统一走受控模式） */
    collapsed: { type: Boolean, default: false },
    /** 预览脚手架：受控示例 */
    controlled: { type: Boolean, default: false },
  },
  setup(props) {
    const controlledOpen = ref(true)

    return (): VNode => {
      const sidebarProps: Record<string, any> = {
        side: props.side,
        variant: props.variant,
        collapsible: props.collapsible,
        overlay: props.overlay,
        openOnHover: props.openOnHover,
        dismissable: props.dismissable,
        width: props.width,
        iconWidth: props.iconWidth,
        size: props.size,
        ariaLabel: props.ariaLabel,
      }

      if (props.controlled || props.collapsed) {
        sidebarProps.open = props.collapsed ? false : controlledOpen.value
        sidebarProps["onUpdate:open"] = (value: boolean) => {
          controlledOpen.value = value
        }
      }

      return h("div", { class: "cp-sidebar-demo" }, [
        h(Sidebar, sidebarProps, {
          default: () => NAV_ITEMS.map(([icon, label]) => navItem(icon, label)),
        }),
        h(SidebarMain, { size: props.size }, () => [
          h("div", { class: "cp-sidebar-demo__title" }, "主内容区"),
          h("p", { class: "cp-sidebar-demo__text" }, "侧边栏展开 / 收起时，本区域自动让位或收回（浮层模式下不让位）。"),
        ]),
      ])
    }
  },
})

export const sidebarGroup: PreviewGroup = {
  id: "sidebar",
  component: SidebarDemo as Component,
  name: "Sidebar",
  summary: "侧边栏（与配套的 SidebarMain 共用本分区）：三变体 × 三档折叠 + 浮层模式，主内容区自动让位",
  importCode: "import Sidebar from \"@/components/Sidebar.vue\"\nimport SidebarMain from \"@/components/SidebarMain.vue\"",
  sizeable: true,
  examples: [
    {
      title: "基础（sidebar + icon 折叠，可点击切换）",
      props: {},
      code: `<script setup>
const items = [
  { icon: "fileOutline", label: "文档" },
  { icon: "folderOutline", label: "笔记本" },
  { icon: "star", label: "收藏" },
]
</script>

<template>
  <!-- 非受控：不传 open，内部自持；折叠为图标条时 .si-sidebar__label 自动隐藏 -->
  <div class="my-layout">
    <Sidebar collapsible="icon" aria-label="主导航">
      <div v-for="item in items" :key="item.label" class="my-nav-item">
        <IconWrapper :name="item.icon" :size="16" />
        <span class="si-sidebar__label">{{ item.label }}</span>
      </div>
    </Sidebar>
    <SidebarMain>
      <p>主内容区自动让位</p>
    </SidebarMain>
  </div>
</template>`,
    },
    {
      title: "初始收起（受控，静态快照）",
      props: {
        collapsed: true,
        controlled: true,
      },
      code: `<!-- 受控：传入 open 即由调用方接管，组件派发 update:open -->
<Sidebar v-model:open="open" collapsible="icon" aria-label="主导航">
  <span class="si-sidebar__label">文档</span>
</Sidebar>`,
    },
    {
      title: "offcanvas 折叠（完全隐藏）",
      props: {
        collapsible: "offcanvas",
        collapsed: true,
        controlled: true,
      },
      code: `<!-- offcanvas：收起即完全移出，不保留图标条 -->
<Sidebar v-model:open="open" collapsible="offcanvas" aria-label="主导航" />`,
    },
    {
      title: "不可折叠（collapsible=\"none\"）",
      props: {
        collapsible: "none",
      },
      code: `<!-- none：open 恒真，没有「关闭」语义（避免关不掉又不可折叠的死状态） -->
<Sidebar collapsible="none" aria-label="主导航" />`,
    },
    {
      title: "floating 变体（悬浮卡片）",
      props: {
        variant: "floating",
      },
      code: `<!-- floating：四周留白 + 全描边 + 四向圆角 -->
<Sidebar variant="floating" aria-label="主导航" />`,
    },
    {
      title: "inset 变体（内嵌）",
      props: {
        variant: "inset",
      },
      code: `<!-- inset：贴容器边缘但整体内缩，四向圆角 -->
<Sidebar variant="inset" aria-label="主导航" />`,
    },
    {
      title: "右侧（side=\"right\"）",
      props: {
        side: "right",
      },
      code: `<Sidebar side="right" aria-label="主导航" />`,
    },
    {
      title: "悬停展开（open-on-hover，图标条形态）",
      props: {
        openOnHover: true,
        collapsed: true,
        controlled: true,
      },
      code: `<!-- 悬停图标条即展开（带 50ms 展开 / 100ms 收起延迟，避免边缘抖动闪合） -->
<Sidebar
  collapsible="icon"
  open-on-hover
  :hover-open-delay="50"
  :hover-close-delay="100"
  aria-label="主导航"
/>`,
    },
    {
      title: "浮层模式（overlay + offcanvas）",
      props: {
        overlay: true,
        collapsible: "offcanvas",
      },
      code: `<!-- overlay：不占文档流，叠在内容之上；SidebarMain 因此不让位。
     典型用于窄容器 / 移动端，遮罩点击可收起（dismissable 默认开） -->
<Sidebar overlay collapsible="offcanvas" aria-label="主导航" />`,
    },
    {
      title: "浮层 - 不可点遮罩关闭",
      props: {
        overlay: true,
        collapsible: "offcanvas",
        dismissable: false,
      },
      code: `<!-- dismissable=false：遮罩不再点关，需靠外部按钮或 Esc 语义自行控制 -->
<Sidebar overlay collapsible="offcanvas" :dismissable="false" aria-label="主导航" />`,
    },
    {
      title: "自定义宽度（width=12rem / icon-width=3.5rem）",
      props: {
        width: "12rem",
        iconWidth: "3.5rem",
      },
      code: `<Sidebar width="12rem" icon-width="3.5rem" aria-label="主导航" />`,
    },
    {
      title: "尺寸 - large",
      props: {
        size: "large",
      },
      code: `<Sidebar size="large" aria-label="主导航" />
<SidebarMain size="large">…</SidebarMain>`,
    },
    {
      title: "尺寸 - xsmall",
      props: {
        size: "xsmall",
      },
      code: `<Sidebar size="xsmall" aria-label="主导航" />`,
    },
  ],
}

export const sidebarPreviewGroups: PreviewGroup[] = [sidebarGroup]
