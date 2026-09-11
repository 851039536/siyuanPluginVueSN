/**
 * 组件预览清单 — Timeline 分组数据
 * 清单条目：title（示例名）、props（透传给组件）、slots（具名/作用域插槽工厂）、code（对应可复制模板）。
 * 注：本组件无默认插槽，渲染完全由 content / opposite / marker 三个插槽驱动，故示例统一走 slots 字段；
 *     工厂按每个事件调用一次，因此必须在工厂内部新建 VNode（不可复用同一实例）。
 */
import type { VNode } from "vue"
import { h } from "vue"
import type { PreviewGroup } from "../types"
import Avatar from "@/components/Avatar.vue"
import Card from "@/components/Card.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Timeline from "@/components/Timeline.vue"

/** 示例事件数据（渲染字段由插槽决定，组件本身不感知数据结构） */
interface OrderEvent {
  status: string
  date: string
  note: string
}

/** 订单流转事件（官方示例同款题材：主内容看状态、对侧看时间、卡片看明细） */
const ORDER_EVENTS: OrderEvent[] = [
  {
    status: "已下单",
    date: "09-10 09:20",
    note: "订单 SN-20260910-001 已创建，等待付款",
  },
  {
    status: "已支付",
    date: "09-10 09:24",
    note: "微信支付 ¥149.00，发票已开具",
  },
  {
    status: "已发货",
    date: "09-10 16:05",
    note: "顺丰速运 SF1345789，预计次日送达",
  },
  {
    status: "已签收",
    date: "09-11 11:42",
    note: "本人签收，售后质保 12 个月",
  },
]

/**
 * 横向示例事件：列宽较窄，用短文案。
 * 横向布局下节点连线的横向对齐依赖「各列对侧块等高」，等长文案可保证演示效果规整。
 */
const COMPACT_EVENTS: OrderEvent[] = [
  {
    status: "下单",
    date: "09-10",
    note: "订单 SN-20260910-001 已创建",
  },
  {
    status: "支付",
    date: "09-10",
    note: "微信支付 ¥149.00",
  },
  {
    status: "发货",
    date: "09-10",
    note: "顺丰速运 SF1345789",
  },
  {
    status: "签收",
    date: "09-11",
    note: "本人签收，质保 12 个月",
  },
]

/** 主内容：事件状态（纯文本，样式交给调用方） */
const renderStatus = (slotProps: Record<string, any>): VNode =>
  h("div", null, (slotProps.item as OrderEvent).status)

/** 对侧内容：时间戳 */
const renderDate = (slotProps: Record<string, any>): VNode =>
  h("div", null, (slotProps.item as OrderEvent).date)

/** 节点：序号（复用 Avatar 的圆形文字头像） */
const renderIndexMarker = (slotProps: Record<string, any>): VNode =>
  h(Avatar, {
    text: String(slotProps.index + 1),
    size: "xsmall",
  })

/** 节点：已注册图标（复用 IconWrapper，图标名必须来自 kit/icons.ts 的 IconKey） */
const renderIconMarker = (): VNode =>
  h(IconWrapper, {
    name: "check",
    size: 14,
  })

/** 富内容：复用 Card 承载状态标题与明细 */
const renderCard = (slotProps: Record<string, any>): VNode => {
  const item = slotProps.item as OrderEvent
  return h(Card, {
    title: item.status,
    subtitle: item.date,
  }, { default: () => item.note })
}

export const timelineGroup: PreviewGroup = {
  id: "timeline",
  component: Timeline,
  name: "Timeline",
  summary: "时间线：事件集合 + 居左/居右/交错三档对齐，主内容 / 对侧 / 节点三类插槽，纯展示（末项连接线收口）",
  importCode: "import Timeline from \"@/components/Timeline.vue\"",
  sizeable: true,
  examples: [
    {
      title: "基础（仅主内容）",
      props: { value: ORDER_EVENTS },
      slots: { content: renderStatus },
      code: `<Timeline :value="events">
  <template #content="{ item }">
    {{ item.status }}
  </template>
</Timeline>`,
    },
    {
      title: "对侧日期（opposite）",
      props: { value: ORDER_EVENTS },
      slots: {
        content: renderStatus,
        opposite: renderDate,
      },
      code: `<Timeline :value="events">
  <template #opposite="{ item }">
    {{ item.date }}
  </template>
  <template #content="{ item }">
    {{ item.status }}
  </template>
</Timeline>`,
    },
    {
      title: "居右对齐（align=\"right\"）",
      props: {
        value: ORDER_EVENTS,
        align: "right",
      },
      slots: {
        content: renderStatus,
        opposite: renderDate,
      },
      code: `<Timeline :value="events" align="right">
  <template #opposite="{ item }">
    {{ item.date }}
  </template>
  <template #content="{ item }">
    {{ item.status }}
  </template>
</Timeline>`,
    },
    {
      title: "左右交错（align=\"alternate\"）",
      props: {
        value: ORDER_EVENTS,
        align: "alternate",
      },
      slots: {
        content: renderStatus,
        opposite: renderDate,
      },
      code: `<Timeline :value="events" align="alternate">
  <template #opposite="{ item }">
    {{ item.date }}
  </template>
  <template #content="{ item }">
    {{ item.status }}
  </template>
</Timeline>`,
    },
    {
      title: "自定义节点 - 序号（marker）",
      props: { value: ORDER_EVENTS },
      slots: {
        content: renderStatus,
        marker: renderIndexMarker,
      },
      code: `<Timeline :value="events">
  <template #marker="{ index }">
    <Avatar :text="String(index + 1)" size="xsmall" />
  </template>
  <template #content="{ item }">
    {{ item.status }}
  </template>
</Timeline>`,
    },
    {
      title: "自定义节点 - 图标（marker）",
      props: { value: ORDER_EVENTS },
      slots: {
        content: renderStatus,
        marker: renderIconMarker,
      },
      code: `<Timeline :value="events">
  <template #marker>
    <IconWrapper name="check" :size="14" />
  </template>
  <template #content="{ item }">
    {{ item.status }}
  </template>
</Timeline>`,
    },
    {
      title: "富内容 - 事件卡片",
      props: { value: ORDER_EVENTS },
      slots: { content: renderCard },
      code: `<Timeline :value="events">
  <template #content="{ item }">
    <Card :title="item.status" :subtitle="item.date">
      {{ item.note }}
    </Card>
  </template>
</Timeline>`,
    },
    {
      title: "尺寸 - large",
      props: {
        value: ORDER_EVENTS,
        size: "large",
      },
      slots: {
        content: renderStatus,
        opposite: renderDate,
      },
      code: `<Timeline :value="events" size="large">
  <template #opposite="{ item }">
    {{ item.date }}
  </template>
  <template #content="{ item }">
    {{ item.status }}
  </template>
</Timeline>`,
    },
    {
      title: "单条事件（末项不延长连接线）",
      props: { value: ORDER_EVENTS.slice(0, 1) },
      slots: {
        content: renderStatus,
        opposite: renderDate,
      },
      code: `<Timeline :value="events.slice(0, 1)">
  <template #opposite="{ item }">
    {{ item.date }}
  </template>
  <template #content="{ item }">
    {{ item.status }}
  </template>
</Timeline>`,
    },
    {
      title: "横向 - 内容居下（layout=\"horizontal\" + align=\"top\"）",
      props: {
        value: COMPACT_EVENTS,
        layout: "horizontal",
        align: "top",
      },
      slots: {
        content: renderStatus,
        opposite: renderDate,
      },
      code: `<Timeline :value="events" layout="horizontal" align="top">
  <template #opposite="{ item }">
    {{ item.date }}
  </template>
  <template #content="{ item }">
    {{ item.status }}
  </template>
</Timeline>`,
    },
    {
      title: "横向 - 内容居上（align=\"bottom\"）",
      props: {
        value: COMPACT_EVENTS,
        layout: "horizontal",
        align: "bottom",
      },
      slots: {
        content: renderStatus,
        opposite: renderDate,
      },
      code: `<Timeline :value="events" layout="horizontal" align="bottom">
  <template #opposite="{ item }">
    {{ item.date }}
  </template>
  <template #content="{ item }">
    {{ item.status }}
  </template>
</Timeline>`,
    },
    {
      title: "横向 - 上下交错（align=\"alternate\"）",
      props: {
        value: COMPACT_EVENTS,
        layout: "horizontal",
        align: "alternate",
      },
      slots: {
        content: renderStatus,
        opposite: renderDate,
      },
      code: `<Timeline :value="events" layout="horizontal" align="alternate">
  <template #opposite="{ item }">
    {{ item.date }}
  </template>
  <template #content="{ item }">
    {{ item.status }}
  </template>
</Timeline>`,
    },
    {
      title: "横向 - 自定义节点（marker）",
      props: {
        value: COMPACT_EVENTS,
        layout: "horizontal",
      },
      slots: {
        content: renderStatus,
        marker: renderIndexMarker,
      },
      code: `<Timeline :value="events" layout="horizontal">
  <template #marker="{ index }">
    <Avatar :text="String(index + 1)" size="xsmall" />
  </template>
  <template #content="{ item }">
    {{ item.status }}
  </template>
</Timeline>`,
    },
  ],
}

export const timelinePreviewGroups: PreviewGroup[] = [
  timelineGroup,
]
