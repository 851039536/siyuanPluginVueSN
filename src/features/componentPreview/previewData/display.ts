/**
 * 组件预览清单 — Card / Chart / Loader 分组数据
 * 清单条目：title（示例名）、props（透传给组件）、slotText（默认插槽文本）、
 *           slots（具名 / 作用域插槽工厂）、code（对应可复制模板）
 */
import type { VNode } from "vue"
import { h } from "vue"
import type { PreviewGroup } from "../types"
import Button from "@/components/Button.vue"
import Card from "@/components/Card.vue"
import Chart from "@/components/Chart.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Loader from "@/components/Loader.vue"

/** 纯文本槽工厂：预览插槽工厂必须返回 VNode，故统一包一层容器 */
const textSlot = (text: string) => (): VNode => h("div", null, text)

export const cardGroup: PreviewGroup = {
  id: "card",
  component: Card,
  name: "Card",
  summary: "卡片：具名插槽（title / subtitle / content / footer）+ 容器钩子（contentClass / captionClass） / 变体 / 可点击 / 加载 / 无内边距",
  importCode: "import Card from \"@/components/Card.vue\"",
  sizeable: true,
  examples: [
    {
      title: "标题卡片",
      props: {
        title: "卡片标题",
        subtitle: "副标题说明文字",
      },
      slotText: "这是卡片主体内容，支持任意插槽渲染。",
      code: "<Card title=\"卡片标题\" subtitle=\"副标题说明文字\">这是卡片主体内容</Card>",
    },
    {
      title: "变体-elevated",
      props: {
        variant: "elevated",
        title: "悬浮卡片",
      },
      slotText: "elevated 变体，带背景层次。",
      code: "<Card variant=\"elevated\" title=\"悬浮卡片\">elevated 变体</Card>",
    },
    {
      title: "变体-flat",
      props: {
        variant: "flat",
        title: "扁平卡片",
      },
      slotText: "flat 变体，无边框弱层次。",
      code: "<Card variant=\"flat\" title=\"扁平卡片\">flat 变体</Card>",
    },
    {
      title: "变体-outlined",
      props: {
        variant: "outlined",
        title: "描边卡片",
      },
      slotText: "outlined 变体，细边框卡片。",
      code: "<Card variant=\"outlined\" title=\"描边卡片\">outlined 变体</Card>",
    },
    {
      title: "可点击卡片",
      props: {
        title: "项目文档",
        clickable: true,
      },
      slotText: "整卡可点击，移入有反馈。",
      code: "<Card title=\"项目文档\" clickable @click=\"handleClick\">整卡可点击</Card>",
    },
    {
      title: "激活卡片",
      props: {
        title: "当前方案",
        active: true,
      },
      slotText: "激活态高亮。",
      code: "<Card title=\"当前方案\" active>激活态高亮</Card>",
    },
    {
      title: "加载中",
      props: {
        title: "统计报告",
        loading: true,
      },
      slotText: "内容加载中…",
      code: "<Card title=\"统计报告\" loading>内容加载中…</Card>",
    },
    {
      title: "无内边距",
      props: {
        title: "图片展示",
        bodyNoPadding: true,
      },
      slotText: "内容紧贴卡片边缘。",
      code: "<Card title=\"图片展示\" bodyNoPadding>内容紧贴卡片边缘</Card>",
    },
    {
      title: "具名插槽 - title / subtitle / content",
      slots: {
        title: (): VNode =>
          h("div", null, [
            h(IconWrapper, {
              name: "check",
              size: 14,
            }),
            " 具名插槽标题",
          ]),
        subtitle: textSlot("副标题也可用插槽自定义"),
        content: textSlot("content 插槽承载正文；未传时自动回落默认插槽，官方写法可直接照搬。"),
      },
      code: `<Card>
  <template #title>
    <IconWrapper name="check" :size="14" /> 具名插槽标题
  </template>
  <template #subtitle>副标题也可用插槽自定义</template>
  <template #content>
    content 插槽承载正文；未传时自动回落默认插槽。
  </template>
</Card>`,
    },
    {
      title: "底部工具栏（footer 典型用法）",
      slots: {
        title: textSlot("项目文档"),
        subtitle: textSlot("最近更新 09-11"),
        content: textSlot("footer 内放按钮组是官方典型用法，按钮排列由调用方自行提供。"),
        footer: (): VNode[] => [
          h(Button, {
            variant: "primary",
          }, "保存"),
          h(Button, {
            variant: "ghost",
            text: true,
          }, "取消"),
        ],
      },
      code: `<Card>
  <template #title>项目文档</template>
  <template #subtitle>最近更新 09-11</template>
  <template #content>
    footer 内放按钮组是官方典型用法。
  </template>
  <template #footer>
    <Button variant="primary">保存</Button>
    <Button variant="ghost" text>取消</Button>
  </template>
</Card>`,
    },
    {
      title: "容器钩子 - contentClass / captionClass",
      props: {
        captionClass: "cp-hook-caption",
        contentClass: "cp-hook-content",
      },
      slots: {
        title: textSlot("钩子类挂载位置"),
        subtitle: textSlot("captionClass → 标题区容器（caption）"),
        content: textSlot("contentClass → 主体容器，替代 :deep() 硬钻组件内部。"),
      },
      code: `<Card caption-class="card-caption" content-class="card-content">
  <template #title>钩子类挂载位置</template>
  <template #subtitle>captionClass → 标题区容器</template>
  <template #content>contentClass → 主体容器</template>
</Card>`,
    },
  ],
}

const chartSample = [
  { label: "1月", value: 12 },
  { label: "2月", value: 19 },
  { label: "3月", value: 8 },
  { label: "4月", value: 24 },
  { label: "5月", value: 16 },
  { label: "6月", value: 30 },
]

export const chartGroup: PreviewGroup = {
  id: "chart",
  component: Chart,
  name: "Chart",
  summary: "图表：柱状 / 折线 / 面积 / 饼图 / 环形（基于 Chart.js）",
  importCode: "import Chart from \"@/components/Chart.vue\"",
  examples: [
    {
      title: "柱状图",
      props: {
        type: "bar",
        data: chartSample,
        height: 140,
      },
      code: "<Chart type=\"bar\" :data=\"chartData\" />",
    },
    {
      title: "折线图",
      props: {
        type: "line",
        data: chartSample,
        height: 140,
      },
      code: "<Chart type=\"line\" :data=\"chartData\" />",
    },
    {
      title: "面积图",
      props: {
        type: "area",
        data: chartSample,
        height: 140,
      },
      code: "<Chart type=\"area\" :data=\"chartData\" />",
    },
    {
      title: "饼图",
      props: {
        type: "pie",
        data: [
          { label: "Vue", value: 40 },
          { label: "React", value: 30 },
          { label: "Svelte", value: 30 },
        ],
        height: 150,
      },
      code: "<Chart type=\"pie\" :data=\"pieData\" />",
    },
    {
      title: "环形图",
      props: {
        type: "doughnut",
        data: [
          { label: "文档", value: 55 },
          { label: "代码", value: 30 },
          { label: "素材", value: 15 },
        ],
        height: 150,
      },
      code: "<Chart type=\"doughnut\" :data=\"donutData\" />",
    },
    {
      title: "空数据提示",
      props: {
        type: "bar",
        data: [],
        height: 120,
        emptyText: "暂无统计数据",
      },
      code: "<Chart type=\"bar\" :data=\"[]\" empty-text=\"暂无统计数据\" />",
    },
  ],
}

export const loaderGroup: PreviewGroup = {
  id: "loader",
  component: Loader,
  name: "Loader",
  summary: "加载指示器：CSS 动画飞船 + 光带，无需 props",
  importCode: "import Loader from \"@/components/Loader.vue\"",
  examples: [
    {
      title: "默认加载",
      props: {},
      code: "<Loader />",
    },
  ],
}

export const displayPreviewGroups: PreviewGroup[] = [
  cardGroup,
  chartGroup,
  loaderGroup,
]
