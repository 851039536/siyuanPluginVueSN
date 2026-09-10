/**
 * 组件预览清单 — ColorField 分组数据
 * 清单条目：title（示例名）、props（透传给组件）、slotText（默认插槽文本）、code（对应可复制模板）
 */
import type { PreviewGroup } from "../types"
import ColorField from "@/components/ColorField.vue"

export const colorFieldGroup: PreviewGroup = {
  id: "color-field",
  component: ColorField,
  name: "ColorField",
  summary: "颜色字段：色块弹出 32 色自绘调色板 + hex 文本双向联动（思源 Electron 下原生 input[type=color] 不弹窗，故自绘）",
  importCode: "import ColorField from \"@/components/ColorField.vue\"",
  examples: [
    {
      title: "基础用法",
      props: { modelValue: "#1890ff" },
      code: "<ColorField v-model=\"color\" />",
    },
    {
      title: "带占位符",
      props: {
        modelValue: "#52c41a",
        placeholder: "输入十六进制色值",
      },
      code: "<ColorField v-model=\"color\" placeholder=\"输入十六进制色值\" />",
    },
    {
      title: "空值待填",
      props: {
        modelValue: "",
        placeholder: "#ffffff",
      },
      code: "<ColorField v-model=\"color\" placeholder=\"#ffffff\" />",
    },
  ],
}

export const colorFieldPreviewGroups: PreviewGroup[] = [
  colorFieldGroup,
]
