/**
 * 组件预览清单 — DatePicker 分组数据
 * 清单条目：title（示例名）、props（透传给组件）、code（对应可复制模板），两者必须严格一致
 * 注：快照仅呈现面板收起态；点击输入框即可实时展开日历面板交互验证
 */
import type { PreviewGroup } from "../types"
import DatePicker from "@/components/DatePicker.vue"

export const datePickerGroup: PreviewGroup = {
  id: "datepicker",
  component: DatePicker,
  name: "DatePicker",
  summary: "日期选择：单选 / 区间 / 日月年视图 / 格式 / 范围与禁用 / 清除",
  importCode: "import DatePicker from \"@/components/DatePicker.vue\"",
  sizeable: true,
  examples: [
    {
      title: "基础单选",
      props: {
        modelValue: new Date(2026, 8, 10),
        label: "日期",
      },
      code: "<DatePicker v-model=\"date\" label=\"日期\" />",
    },
    {
      title: "未选择",
      props: {
        modelValue: null,
        label: "日期",
      },
      code: "<DatePicker v-model=\"date\" label=\"日期\" />",
    },
    {
      title: "自定义格式",
      props: {
        modelValue: new Date(2026, 8, 10),
        dateFormat: "yy年mm月dd日",
        label: "中文格式",
      },
      code: "<DatePicker v-model=\"date\" label=\"中文格式\" dateFormat=\"yy年mm月dd日\" />",
    },
    {
      title: "区间选择",
      props: {
        modelValue: [new Date(2026, 8, 10), new Date(2026, 8, 20)],
        selectionMode: "range",
        label: "日期范围",
      },
      code: "<DatePicker v-model=\"range\" selectionMode=\"range\" label=\"日期范围\" />",
    },
    {
      title: "区间进行中",
      props: {
        modelValue: [new Date(2026, 8, 10)],
        selectionMode: "range",
        label: "仅选了起点",
      },
      code: "<DatePicker v-model=\"range\" selectionMode=\"range\" label=\"仅选了起点\" />",
    },
    {
      title: "月视图",
      props: {
        modelValue: new Date(2026, 8, 10),
        view: "month",
        label: "选择月份",
      },
      code: "<DatePicker v-model=\"date\" view=\"month\" label=\"选择月份\" />",
    },
    {
      title: "年视图",
      props: {
        modelValue: new Date(2026, 8, 10),
        view: "year",
        label: "选择年份",
      },
      code: "<DatePicker v-model=\"date\" view=\"year\" label=\"选择年份\" />",
    },
    {
      title: "限定可选范围",
      props: {
        modelValue: new Date(2026, 8, 10),
        minDate: new Date(2026, 8, 1),
        maxDate: new Date(2026, 8, 30),
        label: "仅限 9 月",
      },
      code: "<DatePicker v-model=\"date\" :min-date=\"min\" :max-date=\"max\" label=\"仅限 9 月\" />",
    },
    {
      title: "禁用指定日期",
      props: {
        modelValue: new Date(2026, 8, 10),
        disabledDates: [new Date(2026, 8, 15), new Date(2026, 8, 16)],
        label: "禁选 15/16 日",
      },
      code: "<DatePicker v-model=\"date\" :disabled-dates=\"[new Date(2026, 8, 15), new Date(2026, 8, 16)]\" label=\"禁选 15/16 日\" />",
    },
    {
      title: "禁用周末",
      props: {
        modelValue: new Date(2026, 8, 10),
        disabledDays: [0, 6],
        label: "仅工作日",
      },
      code: "<DatePicker v-model=\"date\" :disabled-days=\"[0, 6]\" label=\"仅工作日\" />",
    },
    {
      title: "可清除",
      props: {
        modelValue: new Date(2026, 8, 10),
        showClear: true,
        label: "可清除",
      },
      code: "<DatePicker v-model=\"date\" show-clear label=\"可清除\" />",
    },
    {
      title: "字符串值",
      props: {
        modelValue: "2026-09-10",
        valueFormat: true,
        label: "valueFormat",
      },
      code: "<DatePicker v-model=\"dateText\" value-format label=\"valueFormat\" />",
    },
    {
      title: "错误状态",
      props: {
        modelValue: null,
        error: "请选择有效日期",
        label: "必填日期",
      },
      code: "<DatePicker v-model=\"date\" label=\"必填日期\" error=\"请选择有效日期\" />",
    },
    {
      title: "禁用",
      props: {
        modelValue: new Date(2026, 8, 10),
        disabled: true,
        label: "禁用",
      },
      code: "<DatePicker v-model=\"date\" disabled label=\"禁用\" />",
    },
  ],
}

export const datePickerPreviewGroups: PreviewGroup[] = [
  datePickerGroup,
]
