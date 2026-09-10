/**
 * 组件预览清单 — Checkbox 分组数据
 * 清单条目：title（示例名）、props（透传给组件）、code（对应可复制模板），两者必须严格一致
 */
import type { PreviewGroup } from "../types"
import Checkbox from "@/components/Checkbox.vue"

export const checkboxGroup: PreviewGroup = {
  id: "checkbox",
  component: Checkbox,
  name: "Checkbox",
  summary: "复选框：二元 / 分组多选 / 半选 / 尺寸 / 描边实底 / 禁用只读错误",
  importCode: "import Checkbox from \"@/components/Checkbox.vue\"",
  sizeable: true,
  examples: [
    {
      title: "选中",
      props: {
        modelValue: true,
        label: "启用自动同步",
      },
      code: "<Checkbox v-model=\"checked\" label=\"启用自动同步\" />",
    },
    {
      title: "未选中",
      props: {
        modelValue: false,
        label: "启用自动同步",
      },
      code: "<Checkbox v-model=\"checked\" label=\"启用自动同步\" />",
    },
    {
      title: "自定义值对",
      props: {
        modelValue: "yes",
        trueValue: "yes",
        falseValue: "no",
        label: "同意条款",
      },
      code: "<Checkbox v-model=\"choice\" trueValue=\"yes\" falseValue=\"no\" label=\"同意条款\" />",
    },
    {
      title: "分组多选",
      props: {
        modelValue: ["vue"],
        value: "vue",
        label: "Vue",
      },
      code: "<Checkbox v-model=\"selected\" value=\"vue\" label=\"Vue\" />",
    },
    {
      title: "半选态",
      props: {
        modelValue: false,
        indeterminate: true,
        label: "部分选中",
      },
      code: "<Checkbox v-model=\"checked\" indeterminate label=\"部分选中\" />",
    },
    {
      title: "尺寸",
      props: {
        modelValue: true,
        size: "large",
        label: "large",
      },
      code: "<Checkbox v-model=\"checked\" size=\"large\" label=\"large\" />",
    },
    {
      title: "实底变体",
      props: {
        modelValue: false,
        variant: "filled",
        label: "实底",
      },
      code: "<Checkbox v-model=\"checked\" variant=\"filled\" label=\"实底\" />",
    },
    {
      title: "标签在前",
      props: {
        modelValue: true,
        label: "自动保存",
        labelBefore: true,
      },
      code: "<Checkbox v-model=\"checked\" label=\"自动保存\" labelBefore />",
    },
    {
      title: "纯方框（无标签）",
      props: {
        modelValue: true,
      },
      code: "<Checkbox v-model=\"checked\" />",
    },
    {
      title: "辅助说明",
      props: {
        modelValue: true,
        label: "压缩图片",
        hint: "仅对大于 1MB 的图片生效",
      },
      code: "<Checkbox v-model=\"checked\" label=\"压缩图片\" hint=\"仅对大于 1MB 的图片生效\" />",
    },
    {
      title: "错误状态",
      props: {
        modelValue: false,
        label: "我已阅读并同意协议",
        error: "必须勾选后才能继续",
      },
      code: "<Checkbox v-model=\"checked\" label=\"我已阅读并同意协议\" error=\"必须勾选后才能继续\" />",
    },
    {
      title: "禁用",
      props: {
        modelValue: true,
        disabled: true,
        label: "禁用",
      },
      code: "<Checkbox v-model=\"checked\" disabled label=\"禁用\" />",
    },
    {
      title: "只读",
      props: {
        modelValue: true,
        readonly: true,
        label: "只读",
      },
      code: "<Checkbox v-model=\"checked\" readonly label=\"只读\" />",
    },
  ],
}

export const checkboxPreviewGroups: PreviewGroup[] = [
  checkboxGroup,
]
