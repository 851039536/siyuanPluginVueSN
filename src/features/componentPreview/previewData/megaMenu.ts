/**
 * 组件预览清单 — MegaMenu 分组数据
 *
 * 注 1：MegaMenu 的展开面板需要真实开合状态才能目视，纯 props 快照看不出「多列并排」这一特征
 *      ⇒ 这里内联一个**演示宿主**：装载后用 `mouseenter` 模拟一次悬停展开指定的根项，
 *      使快照直接呈现面板内容（不做任何网络/持久化动作）。
 * 注 2：宿主可真实交互 —— 悬停根项、点叶子、键盘漫游都可用（展开态为组件非受控自持）。
 * 注 3：宿主的 `openKey` 为预览脚手架：装载时自动展开哪一项（不传则不展开）。
 * 注 4：宿主自身只是预览脚手架，转发 props 时用宽松对象（与渲染层 `PreviewStage` 同法）。
 */
import type { Component, VNode } from "vue"
import {
  defineComponent,
  h,
  ref,
} from "vue"
import type { PreviewGroup } from "../types"
import MegaMenu from "@/components/MegaMenu.vue"

/**
 * 菜单项结构（预览数据本地声明）。
 * ⚠️ 不从 `@/components/MegaMenu.vue` 导入类型：`.vue` 文件的类型转出在 TS 视角下不可靠
 *    （仓库内 `statusBar/featureRegistry.ts` 正是栽在这里，属既有问题），
 *    预览清单按「宽松对象」惯例自带一份形状即可（与渲染层 PreviewStage 同法）。
 */
interface PreviewMenuItem {
  key: string
  label: string
  icon?: string
  disabled?: boolean
  header?: boolean
  description?: string
  items?: PreviewMenuItem[]
  command?: (item: PreviewMenuItem, event: MouseEvent | KeyboardEvent) => void
}

/** 造一个叶子项（key 由标签派生，避免手写重复） */
const leaf = (label: string, extra: Partial<PreviewMenuItem> = {}): PreviewMenuItem => ({
  key: `leaf-${label}`,
  label,
  ...extra,
})

/** 「产品」根项的完整面板：三个分组列（这就是 MegaMenu 与普通下拉的区别） */
const PRODUCT_ITEMS: PreviewMenuItem[] = [
  { key: "h-write", label: "写作", header: true },
  leaf("文档编辑", { icon: "fileOutline", description: "富文本与 Markdown 双模式" }),
  leaf("表格", { icon: "viewGrid", description: "结构化数据与公式" }),
  leaf("闪卡", { icon: "star", description: "间隔重复记忆" }),
  { key: "h-manage", label: "管理", header: true },
  leaf("文件树", { icon: "folderOutline", description: "笔记本与文档组织" }),
  leaf("标签", { icon: "magnify", description: "跨笔记本检索" }),
  { key: "h-ext", label: "扩展", header: true },
  leaf("插件市场", { icon: "folderPlus", description: "安装与更新插件" }),
  leaf("主题", { icon: "star", description: "外观与配色", disabled: true }),
]

/** 「资源」根项：演示「首个 header 之前有散项」的无标题列 */
const RESOURCE_ITEMS: PreviewMenuItem[] = [
  leaf("最近打开", { icon: "fileOutline", description: "承接未归类的散项（本列无标题）" }),
  { key: "h-media", label: "媒体", header: true },
  leaf("图片", { icon: "fileOutline" }),
  leaf("视频", { icon: "fileOutline" }),
  { key: "h-other", label: "其它", header: true },
  leaf("附件", { icon: "upload" }),
  leaf("回收站", { icon: "delete" }),
]

/** 基础模型：两个可展开根项 + 两个纯叶子根项（无面板，点击即回调） */
const buildModel = (withPanel: boolean): PreviewMenuItem[] => [
  { key: "product", label: "产品", icon: "viewGrid", items: withPanel ? PRODUCT_ITEMS : [] },
  { key: "resource", label: "资源", icon: "folderOutline", items: withPanel ? RESOURCE_ITEMS : [] },
  { key: "pricing", label: "定价", icon: "star" },
  { key: "about", label: "关于", icon: "menu" },
]

const MegaMenuDemo = defineComponent({
  name: "MegaMenuDemo",
  props: {
    size: { type: String, default: "small" },
    orientation: { type: String, default: "horizontal" },
    disabled: { type: Boolean, default: false },
    openOnHover: { type: Boolean, default: true },
    scrollHeight: { type: String, default: "20rem" },
    columnMinWidth: { type: Number, default: 160 },
    ariaLabel: { type: String, default: "主导航" },
    /** 预览脚手架：装载时自动展开的根项 key（不传则不展开） */
    openKey: { type: String, default: "" },
    /** 预览脚手架：是否给根项配面板内容 */
    withPanel: { type: Boolean, default: true },
  },
  setup(props) {
    const rootRef = ref<HTMLElement | null>(null)
    /** 只在首次渲染后模拟一次悬停，避免每次重渲都抢展开态 */
    let seeded = false

    return (): VNode => {
      if (!seeded && props.openKey) {
        seeded = true
        requestAnimationFrame(() => {
          const root = rootRef.value
          if (!root) return
          const index = buildModel(props.withPanel).findIndex((item) => item.key === props.openKey)
          if (index < 0) return
          const trigger = root.querySelectorAll<HTMLElement>(".si-megamenu__root-item")[index]
          trigger?.dispatchEvent(new MouseEvent("mouseenter", { bubbles: false }))
        })
      }

      return h("div", { class: "cp-megamenu-demo", ref: rootRef }, [
        h(MegaMenu, {
          model: buildModel(props.withPanel),
          size: props.size,
          orientation: props.orientation,
          disabled: props.disabled,
          openOnHover: props.openOnHover,
          scrollHeight: props.scrollHeight,
          columnMinWidth: props.columnMinWidth,
          ariaLabel: props.ariaLabel,
        }),
      ])
    }
  },
})

export const megaMenuGroup: PreviewGroup = {
  id: "megaMenu",
  component: MegaMenuDemo as Component,
  name: "MegaMenu",
  summary: "大型菜单：根项水平排列，展开时在下方以多列并排面板同时展示分组子菜单",
  importCode: "import MegaMenu from \"@/components/MegaMenu.vue\"",
  sizeable: true,
  examples: [
    {
      title: "基础（展开态：多列面板）",
      props: { openKey: "product" },
      code: `<script setup>
const model = [
  {
    key: "product",
    label: "产品",
    icon: "viewGrid",
    items: [
      { key: "h-write", label: "写作", header: true },
      { key: "doc", label: "文档编辑", icon: "fileOutline", description: "富文本与 Markdown 双模式" },
      { key: "table", label: "表格", icon: "viewGrid" },
      { key: "h-manage", label: "管理", header: true },
      { key: "tree", label: "文件树", icon: "folderOutline" },
    ],
  },
  { key: "pricing", label: "定价" },
]
</script>

<template>
  <!-- 面板以「多列并排」同时展示，这是 MegaMenu 区别于普通下拉的核心 -->
  <MegaMenu :model="model" aria-label="主导航" @select="(item) => onPick(item)" />
</template>`,
    },
    {
      title: "收起态（默认）",
      props: {},
      code: `<MegaMenu :model="model" aria-label="主导航" />`,
    },
    {
      title: "第二个根项（资源）",
      props: { openKey: "resource" },
      code: `<!-- 首个 header 之前的散项会归入一个「无标题列」，允许不分组直接列条目 -->
<MegaMenu :model="model" aria-label="主导航" />`,
    },
    {
      title: "仅点击展开（open-on-hover=false）",
      props: {
        openOnHover: false,
        openKey: "product",
      },
      code: `<!-- 关闭悬停展开：适合触屏为主的场景，避免划过时误触弹出 -->
<MegaMenu :model="model" :open-on-hover="false" aria-label="主导航" />`,
    },
    {
      title: "无子项（根项即叶子）",
      props: {
        withPanel: false,
      },
      code: `<!-- items 为空 / 不传 ⇒ 该根项不可展开，点击直接触发 command -->
<MegaMenu :model="model" aria-label="主导航" />`,
    },
    {
      title: "竖排（orientation=\"vertical\"）",
      props: {
        orientation: "vertical",
        openKey: "product",
        columnMinWidth: 140,
      },
      code: `<!-- vertical：根菜单竖排，面板改在根项右侧展开（面板收为单列避免挤成窄条） -->
<MegaMenu :model="model" orientation="vertical" aria-label="主导航" />`,
    },
    {
      title: "禁用（disabled）",
      props: {
        disabled: true,
        openKey: "product",
      },
      code: `<MegaMenu :model="model" disabled aria-label="主导航" />`,
    },
    {
      title: "面板限高（scroll-height=8rem）",
      props: {
        openKey: "product",
        scrollHeight: "8rem",
      },
      code: `<!-- 面板超出上限时内部滚动，不撑高页面 -->
<MegaMenu :model="model" scroll-height="8rem" aria-label="主导航" />`,
    },
    {
      title: "列宽下限（column-min-width=200）",
      props: {
        openKey: "product",
        columnMinWidth: 200,
      },
      code: `<!-- 列宽低于该值时自动少排几列（列数随面板可用宽度自适应） -->
<MegaMenu :model="model" :column-min-width="200" aria-label="主导航" />`,
    },
  ],
}

export const megaMenuPreviewGroups: PreviewGroup[] = [megaMenuGroup]
