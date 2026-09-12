/**
 * 组件预览清单 — Textarea 分组数据
 * 清单条目：title（示例名）、props（透传给组件）、code（对应可复制模板），两者必须严格一致
 * 注：本组件无默认插槽与具名插槽，故示例全部只用 props + code。
 */
import type { PreviewGroup } from "../types"
import Textarea from "@/components/Textarea.vue"

export const textareaGroup: PreviewGroup = {
  id: "textarea",
  component: Textarea,
  name: "Textarea",
  summary: "多行文本域：四档尺寸 / 描边实底 / 自动增高 / 宽度控制 / 禁用只读 / 字数统计",
  importCode: "import Textarea from \"@/components/Textarea.vue\"",
  sizeable: true,
  examples: [
    {
      title: "基础",
      props: {
        placeholder: "请输入多行内容",
        modelValue: "第一行\n第二行",
      },
      code: "<Textarea v-model=\"content\" placeholder=\"请输入多行内容\" />",
    },
    {
      title: "带标签 + 必填",
      props: {
        label: "备注",
        required: true,
        placeholder: "请填写备注",
      },
      code: "<Textarea v-model=\"content\" label=\"备注\" required placeholder=\"请填写备注\" />",
    },
    {
      title: "带提示文本",
      props: {
        label: "提交说明",
        hint: "支持 Markdown，提交后仅仓库成员可见",
        placeholder: "描述本次变更",
      },
      code: "<Textarea v-model=\"content\" label=\"提交说明\" hint=\"支持 Markdown，提交后仅仓库成员可见\" />",
    },
    {
      title: "错误状态",
      props: {
        label: "变更原因",
        error: "变更原因不能为空",
        modelValue: "",
      },
      code: "<Textarea v-model=\"content\" label=\"变更原因\" error=\"变更原因不能为空\" />",
    },
    {
      title: "实底变体",
      props: {
        variant: "filled",
        label: "实底",
        modelValue: "浅表面填充、边框透明，聚焦时以内嵌描边环反馈",
      },
      code: "<Textarea v-model=\"content\" variant=\"filled\" label=\"实底\" />",
    },
    {
      title: "自动增高",
      props: {
        autoResize: true,
        minRows: 2,
        maxRows: 6,
        label: "自动增高",
        hint: "内容增多时自动长高，超过 maxRows 后转为内部滚动",
        modelValue: "第一行\n第二行\n第三行",
      },
      code: "<Textarea v-model=\"content\" autoResize :min-rows=\"2\" :max-rows=\"6\" label=\"自动增高\" />",
    },
    {
      title: "字数统计",
      props: {
        showCount: true,
        maxlength: 60,
        label: "简介",
        placeholder: "不超过 60 字",
        modelValue: "已有内容",
      },
      code: "<Textarea v-model=\"content\" show-count :maxlength=\"60\" label=\"简介\" placeholder=\"不超过 60 字\" />",
    },
    {
      title: "固定字宽（fluid 关闭）",
      props: {
        fluid: false,
        cols: 24,
        label: "按 cols 呈现固有宽度",
        modelValue: "宽度由原生 cols 决定，不再占满容器",
      },
      code: "<Textarea v-model=\"content\" :fluid=\"false\" :cols=\"24\" label=\"按 cols 呈现固有宽度\" />",
    },
    {
      title: "禁用",
      props: {
        disabled: true,
        label: "禁用",
        modelValue: "不可编辑",
      },
      code: "<Textarea v-model=\"content\" disabled label=\"禁用\" />",
    },
    {
      title: "只读",
      props: {
        readonly: true,
        label: "只读",
        modelValue: "只读内容可选中复制",
      },
      code: "<Textarea v-model=\"content\" readonly label=\"只读\" />",
    },
  ],
}

export const textareaPreviewGroups: PreviewGroup[] = [
  textareaGroup,
]
