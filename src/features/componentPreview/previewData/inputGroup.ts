/**
 * 组件预览清单 — InputGroup / InputGroupAddon 分组数据
 *
 * 复合示例的默认插槽需放多个子组件，故用 PreviewExample.render 组装；
 * 快照渲染时把注入的尺寸档位同时透传给组内成员，保证 XS/S/M/L 四档下高度与字号一致，
 * 而 code 展示默认档（成员不带 size，各自默认 small）的标准用法。
 */
import type { VNode } from "vue"
import { h } from "vue"
import type { PreviewGroup } from "../types"
import Button from "@/components/Button.vue"
import DatePicker from "@/components/DatePicker.vue"
import Input from "@/components/Input.vue"
import InputGroup from "@/components/InputGroup.vue"
import InputGroupAddon from "@/components/InputGroupAddon.vue"
import Select from "@/components/Select.vue"

/** 下拉拼接示例的选项数据 */
const CITY_OPTIONS = [
  { value: "beijing", label: "北京" },
  { value: "shanghai", label: "上海" },
  { value: "guangzhou", label: "广州" },
]

export const inputGroupComposite: PreviewGroup = {
  id: "inputGroup",
  component: InputGroup,
  name: "InputGroup",
  summary: "输入框组合器：与 InputGroupAddon 搭配，把输入框、按钮、下拉、日期无缝拼接为一体化控件（组内成员不要带 label / hint / error）",
  importCode: "import InputGroup from \"@/components/InputGroup.vue\"\nimport InputGroupAddon from \"@/components/InputGroupAddon.vue\"",
  sizeable: true,
  examples: [
    {
      title: "基础前后缀",
      render: (p): VNode[] => [
        h(InputGroupAddon, null, "https://"),
        h(Input, {
          size: p.size,
          placeholder: "example",
        }),
        h(InputGroupAddon, null, ".com"),
      ],
      code: `<InputGroup>
  <InputGroupAddon>https://</InputGroupAddon>
  <Input v-model="value" placeholder="example" />
  <InputGroupAddon>.com</InputGroupAddon>
</InputGroup>`,
    },
    {
      title: "多附加项",
      render: (p): VNode[] => [
        h(InputGroupAddon, null, "$"),
        h(Input, {
          type: "number",
          size: p.size,
          placeholder: "0",
        }),
        h(InputGroupAddon, null, ".00"),
      ],
      code: `<InputGroup>
  <InputGroupAddon>$</InputGroupAddon>
  <Input v-model="amount" type="number" placeholder="0" />
  <InputGroupAddon>.00</InputGroupAddon>
</InputGroup>`,
    },
    {
      title: "前置图标按钮",
      render: (p): VNode[] => [
        h(Button, {
          size: p.size,
          variant: "primary",
          outlined: true,
          icon: "magnify",
          ariaLabel: "搜索",
        }),
        h(Input, {
          size: p.size,
          placeholder: "搜索关键词",
        }),
      ],
      code: `<InputGroup>
  <Button variant="primary" outlined icon="magnify" aria-label="搜索" />
  <Input v-model="keyword" placeholder="搜索关键词" />
</InputGroup>`,
    },
    {
      title: "尾部提交按钮",
      render: (p): VNode[] => [
        h(Input, {
          size: p.size,
          placeholder: "输入待提交内容",
        }),
        h(Button, { size: p.size, variant: "primary" }, "提交"),
      ],
      code: `<InputGroup>
  <Input v-model="content" placeholder="输入待提交内容" />
  <Button variant="primary" @click="submit">提交</Button>
</InputGroup>`,
    },
    {
      title: "下拉拼接",
      render: (p): VNode[] => [
        h(Select, {
          size: p.size,
          options: CITY_OPTIONS,
          placeholder: "选择城市",
        }),
        h(Input, {
          size: p.size,
          placeholder: "详细地址",
        }),
      ],
      code: `<InputGroup>
  <Select v-model="city" :options="cities" placeholder="选择城市" />
  <Input v-model="address" placeholder="详细地址" />
</InputGroup>`,
    },
    {
      title: "日期区间拼接",
      render: (p): VNode[] => [
        h(DatePicker, {
          size: p.size,
          placeholder: "开始日期",
        }),
        h(InputGroupAddon, null, "至"),
        h(DatePicker, {
          size: p.size,
          placeholder: "结束日期",
        }),
      ],
      code: `<InputGroup>
  <DatePicker v-model="startDate" placeholder="开始日期" />
  <InputGroupAddon>至</InputGroupAddon>
  <DatePicker v-model="endDate" placeholder="结束日期" />
</InputGroup>`,
    },
  ],
}

export const inputGroupPreviewGroups: PreviewGroup[] = [
  inputGroupComposite,
]
