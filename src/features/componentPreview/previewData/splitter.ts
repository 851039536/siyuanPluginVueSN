/**
 * 组件预览清单 — Splitter 分组数据（Splitter + SplitterPanel 配套，共用一个分区）
 * 清单条目：title（示例名）、props（透传给 Splitter）、render（默认插槽的 VNode 工厂，用于组装 SplitterPanel）、
 *           code（对应可复制模板）。
 * 注：Splitter 的尺寸为「非受控 + 内部自持」时预览中可真实拖动；传了 `sizes` 的示例是受控但无监听 ⇒ 静态快照。
 * 注：垂直布局与嵌套布局都需要父容器有确定高度，示例用 style 透传（Splitter 单根元素）。
 */
import type { VNode } from "vue"
import { h } from "vue"
import type { PreviewGroup } from "../types"
import Splitter from "@/components/Splitter.vue"
import SplitterPanel from "@/components/SplitterPanel.vue"

interface PanelOptions {
  size?: number
  minSize?: number
  maxSize?: number
  collapsible?: boolean
  collapsedSize?: number
}

/** 生成一个带文本内容的分割面板 */
const panel = (text: string, options: PanelOptions = {}): VNode =>
  h(SplitterPanel, options, () => text)

/** 生成一个可折叠面板（拖到最小尺寸以下会吸附折叠） */
const collapsiblePanel = (text: string, size: number): VNode =>
  h(SplitterPanel, {
    size,
    minSize: 15,
    collapsible: true,
    collapsedSize: 0,
  }, () => text)

export const splitterGroup: PreviewGroup = {
  id: "splitter",
  component: Splitter,
  name: "Splitter",
  summary: "分割面板：拖动分隔条或按方向键调整相邻面板尺寸，支持两向布局、受控/非受控、可折叠与尺寸持久化",
  importCode: "import Splitter from \"@/components/Splitter.vue\"\nimport SplitterPanel from \"@/components/SplitterPanel.vue\"",
  examples: [
    {
      title: "基础两栏（size 25 / 75）",
      props: { style: "height: 120px" },
      render: (): VNode[] => [
        panel("面板 1（25%）", { size: 25, minSize: 10 }),
        panel("面板 2（75%）"),
      ],
      code: `<Splitter style="height: 120px">
  <SplitterPanel :size="25" :min-size="10">面板 1</SplitterPanel>
  <SplitterPanel :size="75">面板 2</SplitterPanel>
</Splitter>`,
    },
    {
      title: "三栏等分（都不传 size）",
      props: { style: "height: 120px" },
      render: (): VNode[] => [
        panel("面板 1"),
        panel("面板 2"),
        panel("面板 3"),
      ],
      code: `<Splitter style="height: 120px">
  <SplitterPanel>面板 1</SplitterPanel>
  <SplitterPanel>面板 2</SplitterPanel>
  <SplitterPanel>面板 3</SplitterPanel>
</Splitter>`,
    },
    {
      title: "最小 / 最大尺寸限制",
      props: { style: "height: 120px" },
      render: (): VNode[] => [
        panel("左栏 min 20", { size: 30, minSize: 20 }),
        panel("右栏 max 70", { size: 70, maxSize: 70 }),
      ],
      code: `<Splitter style="height: 120px">
  <SplitterPanel :size="30" :min-size="20">左栏</SplitterPanel>
  <SplitterPanel :size="70" :max-size="70">右栏</SplitterPanel>
</Splitter>`,
    },
    {
      title: "垂直布局（layout=\"vertical\"）",
      props: {
        layout: "vertical",
        style: "height: 180px",
      },
      render: (): VNode[] => [
        panel("上栏", { size: 40 }),
        panel("下栏", { size: 60 }),
      ],
      code: `<Splitter layout="vertical" style="height: 180px">
  <SplitterPanel :size="40">上栏</SplitterPanel>
  <SplitterPanel :size="60">下栏</SplitterPanel>
</Splitter>`,
    },
    {
      title: "嵌套（右栏内再分上下）",
      props: { style: "height: 160px" },
      render: (): VNode[] => [
        panel("左栏", { size: 40 }),
        h(SplitterPanel, { size: 60 }, () =>
          h(Splitter, {
            layout: "vertical",
            style: "height: 100%",
          }, () => [
            h(SplitterPanel, null, () => "右上"),
            h(SplitterPanel, null, () => "右下"),
          ])),
      ],
      code: `<Splitter style="height: 160px">
  <SplitterPanel :size="40">左栏</SplitterPanel>
  <SplitterPanel :size="60">
    <Splitter layout="vertical" style="height: 100%">
      <SplitterPanel>右上</SplitterPanel>
      <SplitterPanel>右下</SplitterPanel>
    </Splitter>
  </SplitterPanel>
</Splitter>`,
    },
    {
      title: "更宽的拖拽区（gutterSize）",
      props: {
        gutterSize: 10,
        style: "height: 120px",
      },
      render: (): VNode[] => [
        panel("左栏"),
        panel("右栏"),
      ],
      code: `<Splitter :gutter-size="10" style="height: 120px">
  <SplitterPanel>左栏</SplitterPanel>
  <SplitterPanel>右栏</SplitterPanel>
</Splitter>`,
    },
    {
      title: "受控尺寸（静态快照）",
      props: {
        sizes: [40, 60],
        style: "height: 120px",
      },
      render: (): VNode[] => [
        panel("面板 1（40%）"),
        panel("面板 2（60%）"),
      ],
      code: `<Splitter v-model:sizes="sizes" style="height: 120px">
  <SplitterPanel>面板 1</SplitterPanel>
  <SplitterPanel>面板 2</SplitterPanel>
</Splitter>`,
    },
    {
      title: "禁用调整（disabled）",
      props: {
        disabled: true,
        style: "height: 120px",
      },
      render: (): VNode[] => [
        panel("左栏"),
        panel("右栏"),
      ],
      code: `<Splitter disabled style="height: 120px">
  <SplitterPanel>左栏</SplitterPanel>
  <SplitterPanel>右栏</SplitterPanel>
</Splitter>`,
    },
    {
      title: "可折叠面板（collapsible）",
      props: { style: "height: 120px" },
      render: (): VNode[] => [
        collapsiblePanel(`左栏（拖到最窄折叠）`, 30),
        panel("右栏"),
      ],
      code: `<Splitter style="height: 120px">
  <SplitterPanel :size="30" :min-size="15" collapsible :collapsed-size="0">左栏</SplitterPanel>
  <SplitterPanel>右栏</SplitterPanel>
</Splitter>`,
    },
    {
      title: "尺寸持久化（stateKey）",
      props: {
        stateKey: "component-preview-splitter",
        style: "height: 120px",
      },
      render: (): VNode[] => [
        panel(`左栏（拖动后切换分区再回来仍在）`, { size: 30 }),
        panel("右栏"),
      ],
      code: `<Splitter state-key="my-splitter" style="height: 120px">
  <SplitterPanel :size="30">左栏</SplitterPanel>
  <SplitterPanel>右栏</SplitterPanel>
</Splitter>`,
    },
  ],
}

export const splitterPreviewGroups: PreviewGroup[] = [
  splitterGroup,
]
