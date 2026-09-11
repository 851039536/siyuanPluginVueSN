/**
 * 组件预览清单 — Divider 分组数据
 * 清单条目：title（示例名）、props（透传给组件）、slotText（默认插槽文本）、
 *           render（默认插槽的 VNode 工厂）、code（对应可复制模板）。
 * 注：Divider 仅有默认插槽（无具名/作用域插槽），故示例不需要 slots 字段。
 * 注：垂直分隔需要父容器有确定高度，此处用 style 透传（单根元素，style 直接落到根元素）。
 */
import type { VNode } from "vue"
import { h } from "vue"
import type { PreviewGroup } from "../types"
import Divider from "@/components/Divider.vue"
import IconWrapper from "@/components/IconWrapper.vue"

/** 垂直示例的容器高度（style 透传给单根元素） */
const VERTICAL_HEIGHT = "height: 80px"

export const dividerGroup: PreviewGroup = {
  id: "divider",
  component: Divider,
  name: "Divider",
  summary: "分隔线：三种线型（实线 / 虚线 / 点线）× 两个方向（水平 / 垂直）× 三档内容位置，默认插槽可承载文字或图标",
  importCode: "import Divider from \"@/components/Divider.vue\"",
  examples: [
    {
      title: "基础（实线）",
      props: {},
      code: "<Divider />",
    },
    {
      title: "虚线",
      props: { type: "dashed" },
      code: "<Divider type=\"dashed\" />",
    },
    {
      title: "点线",
      props: { type: "dotted" },
      code: "<Divider type=\"dotted\" />",
    },
    {
      title: "带文字内容（居中）",
      slotText: "分组标题",
      code: "<Divider>分组标题</Divider>",
    },
    {
      title: "内容靠左（align）",
      props: { align: "left" },
      slotText: "靠左",
      code: "<Divider align=\"left\">靠左</Divider>",
    },
    {
      title: "内容靠右（align）",
      props: { align: "right" },
      slotText: "靠右",
      code: "<Divider align=\"right\">靠右</Divider>",
    },
    {
      title: "带图标内容",
      render: (): VNode[] => [
        h(IconWrapper, {
          name: "star",
          size: 14,
        }),
        h("span", null, "收藏"),
      ],
      code: `<Divider>
  <IconWrapper name="star" :size="14" /> 收藏
</Divider>`,
    },
    {
      title: "垂直分隔（layout + 容器高度）",
      props: {
        layout: "vertical",
        style: VERTICAL_HEIGHT,
      },
      code: "<Divider layout=\"vertical\" style=\"height: 80px\" />",
    },
    {
      title: "垂直 + 内容靠上（align）",
      props: {
        layout: "vertical",
        align: "top",
        style: VERTICAL_HEIGHT,
      },
      slotText: "上",
      code: "<Divider layout=\"vertical\" align=\"top\" style=\"height: 80px\">上</Divider>",
    },
  ],
}

export const dividerPreviewGroups: PreviewGroup[] = [
  dividerGroup,
]
