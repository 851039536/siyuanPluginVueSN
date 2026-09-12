/**
 * 组件预览清单 — MeterGroup 分组数据
 *
 * 注 1：`value` 是**普通数据数组**（非 VNode / 非受控值），故纯清单数据即可表达全部形态，
 *      无需演示宿主 —— 与 Timeline / MegaMenu 不同（那些要么要插槽、要么要展开态）。
 * 注 2：尺寸档位不适用（组件无 `size` prop，字号固定 `$t-xs`）⇒ 不标 `sizeable`。
 * 注 3：颜色用十六进制字面量而非主题变量：条段的颜色来自**数据**（每项可不同），
 *      无法预生成类名，故与 Tag 的 `color` prop 同理走行内 style（官方亦如此）。
 */
import type { PreviewGroup } from "../types"
import MeterGroup from "@/components/MeterGroup.vue"

export const meterGroupPreviewGroup: PreviewGroup = {
  id: "meterGroup",
  component: MeterGroup,
  name: "MeterGroup",
  summary: "多段进度条：一组数值按区间换算为百分比并排成一条（横向/纵向、标签位置与排列、meter/label/start/end 插槽）",
  importCode: "import MeterGroup from \"@/components/MeterGroup.vue\"",
  examples: [
    {
      title: "基本用法（各项之和为 100）",
      props: {
        value: [
          { label: "应用", value: 40, color: "#4f46e5" },
          { label: "系统", value: 30, color: "#06b6d4" },
          { label: "存储", value: 20, color: "#f59e0b" },
          { label: "其他", value: 10, color: "#a1a1aa" },
        ],
      },
      code: `<MeterGroup :value="value" />

const value = [
  { label: "应用", value: 40, color: "#4f46e5" },
  { label: "系统", value: 30, color: "#06b6d4" },
  { label: "存储", value: 20, color: "#f59e0b" },
  { label: "其他", value: 10, color: "#a1a1aa" },
]`,
    },
    {
      title: "带图标标记",
      props: {
        value: [
          { label: "已完成", value: 60, color: "#10b981", icon: "checkCircle" },
          { label: "进行中", value: 25, color: "#f59e0b", icon: "loading" },
          { label: "未开始", value: 15, color: "#a1a1aa", icon: "circleOutline" },
        ],
      },
      code: `<MeterGroup :value="value" />

const value = [
  { label: "已完成", value: 60, color: "#10b981", icon: "checkCircle" },
  { label: "进行中", value: 25, color: "#f59e0b", icon: "loading" },
  { label: "未开始", value: 15, color: "#a1a1aa", icon: "circleOutline" },
]`,
    },
    {
      title: "纵向布局",
      props: {
        orientation: "vertical",
        labelOrientation: "vertical",
        value: [
          { label: "CPU", value: 72, color: "#ef4444" },
          { label: "内存", value: 45, color: "#f59e0b" },
          { label: "磁盘", value: 28, color: "#10b981" },
        ],
      },
      code: `<MeterGroup orientation="vertical" label-orientation="vertical" :value="value" />`,
    },
    {
      title: "标签在 start 侧",
      props: {
        labelPosition: "start",
        value: [
          { label: "已用", value: 65, color: "#4f46e5" },
          { label: "空闲", value: 35, color: "#e5e7eb" },
        ],
      },
      code: `<MeterGroup label-position="start" :value="value" />`,
    },
    {
      title: "自定义区间（min / max）",
      props: {
        min: 0,
        max: 200,
        value: [
          { label: "本月已用", value: 150, color: "#4f46e5" },
          { label: "预留", value: 50, color: "#a1a1aa" },
        ],
      },
      code: `<!-- 各项按 (value - min) / (max - min) 换算，故 max=200 时 150 占 75% -->
<MeterGroup :min="0" :max="200" :value="value" />`,
    },
    {
      title: "超出区间自动钳制",
      props: {
        value: [
          { label: "超额项", value: 150, color: "#ef4444" },
          { label: "正常项", value: 30, color: "#10b981" },
        ],
      },
      code: `<!-- value 超出 max（或低于 min）时钳制到 0~100%，不会撑破容器 -->
<MeterGroup :value="[
  { label: '超额项', value: 150, color: '#ef4444' },
  { label: '正常项', value: 30, color: '#10b981' },
]" />`,
    },
    {
      title: "零值项不渲染条段",
      props: {
        value: [
          { label: "有值", value: 80, color: "#4f46e5" },
          { label: "零值", value: 0, color: "#a1a1aa" },
        ],
      },
      code: `<!-- 百分比为 0 的项仍会出现在标签列表中，但不渲染条段（避免 0 宽的空 div 影响段间间隙） -->
<MeterGroup :value="[
  { label: '有值', value: 80, color: '#4f46e5' },
  { label: '零值', value: 0, color: '#a1a1aa' },
]" />`,
    },
    {
      title: "不传颜色（回落主题色）",
      props: {
        value: [
          { label: "甲", value: 50 },
          { label: "乙", value: 30 },
        ],
      },
      code: `<!-- 未给 color 时，条段与色块标记回落主题主色 -->
<MeterGroup :value="[
  { label: '甲', value: 50 },
  { label: '乙', value: 30 },
]" />`,
    },
    {
      title: "单项",
      props: {
        value: [{ label: "完成度", value: 65, color: "#4f46e5" }],
      },
      code: "<MeterGroup :value=\"[{ label: '完成度', value: 65, color: '#4f46e5' }]\" />",
    },
  ],
}

export const meterGroupPreviewGroups: PreviewGroup[] = [meterGroupPreviewGroup]
