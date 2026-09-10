/**
 * 组件预览清单 — Button / IconWrapper 分组数据
 * 清单条目：title（示例名）、props（透传给组件）、slotText（默认插槽文本）、code（对应可复制模板）
 */
import type { PreviewGroup } from "../types"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"

export const buttonGroup: PreviewGroup = {
  id: "button",
  component: Button,
  name: "Button",
  summary: "按钮：variant 变体 / size 尺寸 / 图标 / 加载 / 禁用 / 块级",
  importCode: "import Button from \"@/components/Button.vue\"",
  sizeable: true,
  examples: [
    {
      title: "primary",
      props: { variant: "primary" },
      slotText: "保存",
      code: "<Button variant=\"primary\" @click=\"handleClick\">保存</Button>",
    },
    {
      title: "secondary",
      props: { variant: "secondary" },
      slotText: "次要操作",
      code: "<Button variant=\"secondary\">次要操作</Button>",
    },
    {
      title: "success",
      props: { variant: "success" },
      slotText: "完成",
      code: "<Button variant=\"success\">完成</Button>",
    },
    {
      title: "danger",
      props: { variant: "danger" },
      slotText: "删除",
      code: "<Button variant=\"danger\">删除</Button>",
    },
    {
      title: "ghost",
      props: { variant: "ghost" },
      slotText: "取消",
      code: "<Button variant=\"ghost\">取消</Button>",
    },
    {
      title: "尺寸 xsmall",
      props: { size: "xsmall" },
      slotText: "xsmall",
      code: "<Button size=\"xsmall\">xsmall</Button>",
    },
    {
      title: "尺寸 small",
      props: { size: "small" },
      slotText: "small",
      code: "<Button size=\"small\">small</Button>",
    },
    {
      title: "尺寸 medium",
      props: { size: "medium" },
      slotText: "medium",
      code: "<Button size=\"medium\">medium</Button>",
    },
    {
      title: "尺寸 large",
      props: { size: "large" },
      slotText: "large",
      code: "<Button size=\"large\">large</Button>",
    },
    {
      title: "图标按钮（左图标）",
      props: { icon: "save" },
      slotText: "保存",
      code: "<Button icon=\"save\">保存</Button>",
    },
    {
      title: "图标按钮（右图标）",
      props: {
        icon: "chevronDown",
        iconPosition: "right",
      },
      slotText: "更多",
      code: "<Button icon=\"chevronDown\" iconPosition=\"right\">更多</Button>",
    },
    {
      title: "纯图标按钮",
      props: {
        icon: "settings",
        title: "设置",
      },
      code: "<Button icon=\"settings\" title=\"设置\" />",
    },
    {
      title: "加载状态",
      props: { loading: true },
      slotText: "保存中…",
      code: "<Button loading>保存中…</Button>",
    },
    {
      title: "禁用状态",
      props: { disabled: true },
      slotText: "禁用",
      code: "<Button disabled>禁用</Button>",
    },
    {
      title: "块级按钮",
      props: { block: true },
      slotText: "块级按钮",
      code: "<Button block>块级按钮</Button>",
    },
  ],
}

export const iconWrapperGroup: PreviewGroup = {
  id: "iconWrapper",
  component: IconWrapper,
  name: "IconWrapper",
  summary: "图标包装：按 IconKey 渲染已注册的 Iconify 图标，统一尺寸与颜色",
  importCode: "import IconWrapper from \"@/components/IconWrapper.vue\"",
  examples: [
    {
      title: "默认尺寸",
      props: { name: "settings" },
      code: "<IconWrapper name=\"settings\" />",
    },
    {
      title: "自定义尺寸",
      props: {
        name: "search",
        size: 24,
      },
      code: "<IconWrapper name=\"search\" :size=\"24\" />",
    },
    {
      title: "自定义颜色",
      props: {
        name: "info",
        color: "#3b82f6",
        size: 20,
      },
      code: "<IconWrapper name=\"info\" color=\"#3b82f6\" :size=\"20\" />",
    },
    {
      title: "成功色图标",
      props: {
        name: "success",
        size: 18,
      },
      code: "<IconWrapper name=\"success\" :size=\"18\" />",
    },
    {
      title: "危险色图标",
      props: {
        name: "error",
        size: 18,
      },
      code: "<IconWrapper name=\"error\" :size=\"18\" />",
    },
    {
      title: "带 tooltip",
      props: {
        name: "help",
        title: "帮助",
      },
      code: "<IconWrapper name=\"help\" title=\"帮助\" />",
    },
  ],
}

export const buttonPreviewGroups: PreviewGroup[] = [
  buttonGroup,
  iconWrapperGroup,
]
