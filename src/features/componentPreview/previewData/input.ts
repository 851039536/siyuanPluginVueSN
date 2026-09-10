/**
 * 组件预览清单 — Input / FormField / Label 分组数据
 * 清单条目：title（示例名）、props（透传给组件）、slotText（默认插槽文本）、
 * render（复合示例的自定义插槽，见 Label「包裹控件」示例）、code（对应可复制模板）
 */
import type { VNode } from "vue"
import { createTextVNode, h } from "vue"
import type { PreviewGroup } from "../types"
import Input from "@/components/Input.vue"
import FormField from "@/components/FormField.vue"
import Label from "@/components/Label.vue"
import Switch from "@/components/Switch.vue"

export const inputGroup: PreviewGroup = {
  id: "input",
  component: Input,
  name: "Input",
  summary: "输入框：类型 / 尺寸 / 前后缀图标 / 密码可见 / 可清空 / 字数统计 / 校验态 / 无边框内嵌",
  importCode: "import Input from \"@/components/Input.vue\"",
  sizeable: true,
  examples: [
    {
      title: "基础输入",
      props: { placeholder: "请输入名称" },
      code: "<Input v-model=\"value\" placeholder=\"请输入名称\" />",
    },
    {
      title: "带标签 + 必填",
      props: {
        label: "用户名",
        required: true,
        placeholder: "请输入用户名",
      },
      code: "<Input v-model=\"value\" label=\"用户名\" required placeholder=\"请输入用户名\" />",
    },
    {
      title: "带提示文本",
      props: {
        label: "简介",
        hint: "将展示在文档个人页",
        placeholder: "一句话介绍",
      },
      code: "<Input v-model=\"value\" label=\"简介\" hint=\"将展示在文档个人页\" />",
    },
    {
      title: "错误状态",
      props: {
        label: "邮箱",
        error: "邮箱格式不正确",
        modelValue: "abc",
      },
      code: "<Input v-model=\"value\" label=\"邮箱\" error=\"邮箱格式不正确\" />",
    },
    {
      title: "前缀图标",
      props: {
        placeholder: "搜索",
        prefixIcon: "search",
      },
      code: "<Input v-model=\"value\" prefixIcon=\"search\" placeholder=\"搜索\" />",
    },
    {
      title: "后缀图标",
      props: {
        placeholder: "点击图标执行",
        suffixIcon: "send",
      },
      code: "<Input v-model=\"value\" suffixIcon=\"send\" placeholder=\"点击图标执行\" />",
    },
    {
      title: "密码 + 可见切换",
      props: {
        type: "password",
        showPassword: true,
        placeholder: "请输入密码",
        modelValue: "123456",
      },
      code: "<Input v-model=\"value\" type=\"password\" showPassword placeholder=\"请输入密码\" />",
    },
    {
      title: "可清空",
      props: {
        clearable: true,
        placeholder: "可清空输入",
        modelValue: "内容可清除",
      },
      code: "<Input v-model=\"value\" clearable placeholder=\"可清空输入\" />",
    },
    {
      title: "字数统计",
      props: {
        showCount: true,
        maxlength: 20,
        placeholder: "不超过 20 字",
        modelValue: "已有内容",
      },
      code: "<Input v-model=\"value\" showCount maxlength=\"20\" placeholder=\"不超过 20 字\" />",
    },
    {
      title: "禁用",
      props: {
        disabled: true,
        modelValue: "不可编辑",
      },
      code: "<Input v-model=\"value\" disabled />",
    },
    {
      title: "只读",
      props: {
        readonly: true,
        modelValue: "只读内容",
      },
      code: "<Input v-model=\"value\" readonly />",
    },
    {
      title: "多行文本域",
      props: {
        type: "textarea",
        rows: 3,
        placeholder: "支持多行输入",
        modelValue: "第一行\n第二行",
      },
      code: "<Input v-model=\"value\" type=\"textarea\" :rows=\"3\" placeholder=\"支持多行输入\" />",
    },
    {
      title: "无边框（borderless）",
      props: {
        borderless: true,
        placeholder: "内嵌到自定义容器中",
        modelValue: "",
      },
      code: "<Input v-model=\"value\" borderless placeholder=\"内嵌到自定义容器中\" />",
    },
  ],
}

export const formFieldGroup: PreviewGroup = {
  id: "formField",
  component: FormField,
  name: "FormField",
  summary: "表单字段容器：label / required / hint / error / showCount，供各控件包装使用",
  importCode: "import FormField from \"@/components/FormField.vue\"",
  sizeable: true,
  examples: [
    {
      title: "标签 + 必填 + 默认插槽",
      props: {
        label: "字段名",
        required: true,
      },
      slotText: "此处放表单控件",
      code: "<FormField label=\"字段名\" required><Input v-model=\"value\" /></FormField>",
    },
    {
      title: "提示文本",
      props: {
        label: "字段名",
        hint: "这是一段帮助提示",
      },
      slotText: "表单控件",
      code: "<FormField label=\"字段名\" hint=\"这是一段帮助提示\"><Input v-model=\"value\" /></FormField>",
    },
    {
      title: "错误状态",
      props: {
        label: "字段名",
        error: "校验未通过",
      },
      slotText: "表单控件",
      code: "<FormField label=\"字段名\" error=\"校验未通过\"><Input v-model=\"value\" /></FormField>",
    },
    {
      title: "字数统计",
      props: {
        showCount: true,
        countCurrent: 12,
        countMax: 20,
      },
      slotText: "表单控件",
      code: "<FormField showCount :count-current=\"12\" :count-max=\"20\"><Input v-model=\"value\" /></FormField>",
    },
    {
      // labelId 无可见渲染差异，靠 code 承载「控件用 aria-labelledby 关联标签」的用法
      title: "标签关联 id（labelId）",
      props: {
        label: "字段名",
        labelId: "field-label-1",
      },
      slotText: "表单控件",
      code: "<FormField label=\"字段名\" label-id=\"field-label-1\">\n  <Input v-model=\"value\" aria-labelledby=\"field-label-1\" />\n</FormField>",
    },
  ],
}

export const labelGroup: PreviewGroup = {
  id: "label",
  component: Label,
  name: "Label",
  summary: "标签：必填星号 + 无障碍替代文本 / 状态色 / 图标 / 变体 / 包裹控件隐式关联 / 禁用态三入口 / 对齐三档",
  importCode: "import Label from \"@/components/Label.vue\"",
  sizeable: true,
  examples: [
    {
      title: "基础标签",
      props: {},
      slotText: "名称",
      code: "<Label>名称</Label>",
    },
    {
      title: "必填",
      props: { required: true },
      slotText: "名称",
      code: "<Label required>名称</Label>",
    },
    {
      title: "带图标",
      props: { icon: "info" },
      slotText: "信息字段",
      code: "<Label icon=\"info\">信息字段</Label>",
    },
    {
      title: "错误状态",
      props: { state: "error" },
      slotText: "错误标签",
      code: "<Label state=\"error\">错误标签</Label>",
    },
    {
      title: "成功状态",
      props: { state: "success" },
      slotText: "成功标签",
      code: "<Label state=\"success\">成功标签</Label>",
    },
    {
      title: "变体展示-primary",
      props: {
        tag: "span",
        variant: "primary",
      },
      slotText: "Primary",
      code: "<Label tag=\"span\" variant=\"primary\">Primary</Label>",
    },
    {
      title: "span 渲染",
      props: { tag: "span" },
      slotText: "行内标签",
      code: "<Label tag=\"span\">行内标签</Label>",
    },
    {
      title: "包裹控件（隐式关联）",
      props: { wrapper: true },
      render: (p): VNode[] => [
        h(Switch, {
          size: p.size,
          modelValue: true,
        }),
        createTextVNode("启用同步通知"),
      ],
      code: `<Label wrapper>
  <Switch v-model="enabled" />
  启用同步通知
</Label>`,
    },
    {
      title: "禁用态-容器标记",
      props: { "data-disabled": "true" },
      slotText: "不可编辑字段",
      code: "<Label data-disabled=\"true\">不可编辑字段</Label>",
    },
    {
      title: "禁用态-手动 prop",
      props: { disabled: true },
      slotText: "不可编辑字段",
      code: "<Label disabled>不可编辑字段</Label>",
    },
    {
      title: "必填 + 无障碍替代文本",
      props: {
        required: true,
        requiredText: "必填",
      },
      slotText: "邮箱",
      code: "<Label required required-text=\"必填\">邮箱</Label>",
    },
    {
      title: "对齐-居中",
      props: {
        align: "center",
        width: "120px",
      },
      slotText: "居中标签",
      code: "<Label align=\"center\" width=\"120px\">居中标签</Label>",
    },
    {
      title: "对齐-右对齐",
      props: {
        align: "right",
        width: "120px",
      },
      slotText: "右对齐标签",
      code: "<Label align=\"right\" width=\"120px\">右对齐标签</Label>",
    },
  ],
}

export const inputPreviewGroups: PreviewGroup[] = [
  inputGroup,
  formFieldGroup,
  labelGroup,
]
