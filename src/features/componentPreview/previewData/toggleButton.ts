/**
 * 组件预览清单 — ToggleButton 分组数据
 * 清单条目：title（示例名）、props（透传给组件）、code（对应可复制模板），两者必须严格一致
 * 注：本组件无默认插槽与具名插槽（文案经 onLabel/offLabel 传入），故示例全部只用 props + code。
 */
import type { PreviewGroup } from "../types"
import ToggleButton from "@/components/ToggleButton.vue"

export const toggleButtonGroup: PreviewGroup = {
  id: "toggleButton",
  component: ToggleButton,
  name: "ToggleButton",
  summary: "按钮式开关：按下态切换文案与图标 / 四档尺寸 / 占满宽 / 禁用与校验态",
  importCode: "import ToggleButton from \"@/components/ToggleButton.vue\"",
  sizeable: true,
  examples: [
    {
      title: "基础（未按下）",
      props: {
        modelValue: false,
        onLabel: "已启用",
        offLabel: "已停用",
        ariaLabel: "启用状态",
      },
      code: "<ToggleButton v-model=\"enabled\" on-label=\"已启用\" off-label=\"已停用\" aria-label=\"启用状态\" />",
    },
    {
      title: "基础（已按下）",
      props: {
        modelValue: true,
        onLabel: "已启用",
        offLabel: "已停用",
        ariaLabel: "启用状态",
      },
      code: "<ToggleButton v-model=\"enabled\" on-label=\"已启用\" off-label=\"已停用\" aria-label=\"启用状态\" />",
    },
    {
      title: "文案 + 图标切换",
      props: {
        modelValue: false,
        onLabel: "已显示",
        offLabel: "已隐藏",
        onIcon: "eye",
        offIcon: "eyeOff",
        ariaLabel: "显示状态",
      },
      code: "<ToggleButton v-model=\"visible\" on-label=\"已显示\" off-label=\"已隐藏\" on-icon=\"eye\" off-icon=\"eyeOff\" aria-label=\"显示状态\" />",
    },
    {
      title: "纯图标（无文案）",
      props: {
        modelValue: true,
        onIcon: "star",
        offIcon: "starOutline",
        ariaLabel: "收藏",
      },
      code: "<ToggleButton v-model=\"starred\" on-icon=\"star\" off-icon=\"starOutline\" aria-label=\"收藏\" />",
    },
    {
      title: "尺寸 - large",
      props: {
        size: "large",
        modelValue: true,
        onLabel: "开",
        offLabel: "关",
        ariaLabel: "开关状态",
      },
      code: "<ToggleButton v-model=\"enabled\" size=\"large\" on-label=\"开\" off-label=\"关\" aria-label=\"开关状态\" />",
    },
    {
      title: "占满宽度（fluid）",
      props: {
        fluid: true,
        modelValue: false,
        onLabel: "启用同步",
        offLabel: "同步已关闭",
        ariaLabel: "同步开关",
      },
      code: "<ToggleButton v-model=\"enabled\" fluid on-label=\"启用同步\" off-label=\"同步已关闭\" aria-label=\"同步开关\" />",
    },
    {
      title: "带提示文本",
      props: {
        hint: "关闭后不再写入本地缓存",
        modelValue: false,
        onLabel: "开",
        offLabel: "关",
        ariaLabel: "缓存开关",
      },
      code: "<ToggleButton v-model=\"enabled\" hint=\"关闭后不再写入本地缓存\" on-label=\"开\" off-label=\"关\" aria-label=\"缓存开关\" />",
    },
    {
      title: "错误状态",
      props: {
        error: "必须先开启此项才能继续",
        modelValue: false,
        onLabel: "已同意",
        offLabel: "未同意",
        ariaLabel: "同意条款",
      },
      code: "<ToggleButton v-model=\"agreed\" error=\"必须先开启此项才能继续\" on-label=\"已同意\" off-label=\"未同意\" aria-label=\"同意条款\" />",
    },
    {
      title: "禁用",
      props: {
        disabled: true,
        modelValue: false,
        onLabel: "开",
        offLabel: "关",
        ariaLabel: "禁用示例",
      },
      code: "<ToggleButton v-model=\"enabled\" disabled on-label=\"开\" off-label=\"关\" aria-label=\"禁用示例\" />",
    },
  ],
}

export const toggleButtonPreviewGroups: PreviewGroup[] = [
  toggleButtonGroup,
]
