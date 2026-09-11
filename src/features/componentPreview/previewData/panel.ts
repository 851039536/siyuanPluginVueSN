/**
 * 组件预览清单 — Panel 分组数据
 * 清单条目：title（示例名）、props（透传给组件）、slotText（默认插槽文本）、
 *           slots（具名 / 作用域插槽工厂）、code（对应可复制模板）。
 * 注：`collapsed` 不传即为非受控 ⇒ 「可折叠」示例在预览中可真实点击切换；
 *     传了 `collapsed` 的示例是受控但无监听 ⇒ 静态快照（点击不会展开），示例「初始折叠」即属此列。
 */
import type { VNode } from "vue"
import { h } from "vue"
import type { PreviewGroup } from "../types"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Panel from "@/components/Panel.vue"

/** 各示例共用的正文（避免大段重复文案，同时让 code 与渲染同源） */
const TEXT = "面板内容支持任意插槽渲染：表单、列表、图表等可直接放入；收起时仅隐藏而不卸载，状态不丢。"

export const panelGroup: PreviewGroup = {
  id: "panel",
  component: Panel,
  name: "Panel",
  summary: "面板：头部文本 / 插槽 + 可折叠内容（受控或非受控）+ 操作区与底部插槽",
  importCode: "import Panel from \"@/components/Panel.vue\"",
  examples: [
    {
      title: "基础（header + 内容）",
      props: { header: "基础面板" },
      slotText: TEXT,
      code: `<Panel header="基础面板">${TEXT}</Panel>`,
    },
    {
      title: "可折叠（非受控，可直接点击）",
      props: {
        header: "可折叠面板",
        toggleable: true,
      },
      slotText: TEXT,
      code: `<Panel header="可折叠面板" toggleable>${TEXT}</Panel>`,
    },
    {
      title: "初始折叠（受控：静态快照）",
      props: {
        header: "初始折叠",
        toggleable: true,
        collapsed: true,
      },
      slotText: TEXT,
      code: `<Panel header="初始折叠" toggleable v-model:collapsed="collapsed">${TEXT}</Panel>`,
    },
    {
      title: "自定义 header 插槽",
      props: { toggleable: true },
      slots: {
        header: (p): VNode =>
          h("div", null, [
            h(IconWrapper, {
              name: "star",
              size: 14,
            }),
            p.collapsed ? " 已收起（header 插槽）" : " 已展开（header 插槽）",
          ]),
      },
      slotText: TEXT,
      code: `<Panel toggleable>
  <template #header="{ collapsed }">
    <IconWrapper name="star" :size="14" />
    {{ collapsed ? " 已收起" : " 已展开" }}
  </template>
  ${TEXT}
</Panel>`,
    },
    {
      title: "icons 插槽（操作区）",
      props: {
        header: "带操作区",
        toggleable: true,
      },
      slots: {
        icons: (): VNode =>
          h(Button, {
            variant: "ghost",
            text: true,
            size: "xsmall",
            icon: "magnify",
            ariaLabel: "搜索",
          }),
      },
      slotText: TEXT,
      code: `<Panel header="带操作区" toggleable>
  <template #icons>
    <Button variant="ghost" text size="xsmall" icon="magnify" aria-label="搜索" />
  </template>
  ${TEXT}
</Panel>`,
    },
    {
      title: "自定义 toggleicon 插槽",
      props: {
        header: "自定义切换图标",
        toggleable: true,
      },
      slots: {
        toggleicon: (p): VNode =>
          h(IconWrapper, {
            name: p.collapsed ? "chevronDown" : "chevronUp",
            size: 14,
          }),
      },
      slotText: TEXT,
      code: `<Panel header="自定义切换图标" toggleable>
  <template #toggleicon="{ collapsed }">
    <IconWrapper :name="collapsed ? 'chevronDown' : 'chevronUp'" :size="14" />
  </template>
  ${TEXT}
</Panel>`,
    },
    {
      title: "自定义 togglebutton 插槽",
      props: {
        header: "自定义切换按钮",
        toggleable: true,
      },
      slots: {
        togglebutton: (p): VNode =>
          h(Button, {
            variant: "secondary",
            size: "xsmall",
            onClick: p.toggleCallback as (event: Event) => void,
          }, () => (p.collapsed ? "展开" : "收起")),
      },
      slotText: TEXT,
      code: `<Panel header="自定义切换按钮" toggleable>
  <template #togglebutton="{ collapsed, toggleCallback }">
    <Button variant="secondary" size="xsmall" @click="toggleCallback">
      {{ collapsed ? "展开" : "收起" }}
    </Button>
  </template>
  ${TEXT}
</Panel>`,
    },
    {
      title: "footer 插槽（底部操作）",
      props: { header: "带底部操作" },
      slots: {
        footer: (): VNode[] => [
          h(Button, {
            variant: "primary",
            size: "xsmall",
          }, "保存"),
          h(Button, {
            variant: "ghost",
            text: true,
            size: "xsmall",
          }, "取消"),
        ],
      },
      slotText: TEXT,
      code: `<Panel header="带底部操作">
  ${TEXT}
  <template #footer>
    <Button variant="primary" size="xsmall">保存</Button>
    <Button variant="ghost" text size="xsmall">取消</Button>
  </template>
</Panel>`,
    },
    {
      title: "无 header（仅内容）",
      props: {},
      slotText: TEXT,
      code: `<Panel>${TEXT}</Panel>`,
    },
  ],
}

export const panelPreviewGroups: PreviewGroup[] = [
  panelGroup,
]
