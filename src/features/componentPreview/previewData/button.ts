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
  summary: "按钮：颜色变体 / 外观修饰（描边·文本）/ severity 颜色轴 / size 尺寸 / 图标四向 / 加载 / 禁用 / 块级 / 圆形 / 无障碍命名",
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
      title: "info",
      props: { variant: "info" },
      slotText: "提示",
      code: "<Button variant=\"info\">提示</Button>",
    },
    {
      title: "warning",
      props: { variant: "warning" },
      slotText: "注意",
      code: "<Button variant=\"warning\">注意</Button>",
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
      title: "描边（outlined）",
      props: {
        variant: "primary",
        outlined: true,
      },
      slotText: "描边主色",
      code: "<Button variant=\"primary\" outlined>描边主色</Button>",
    },
    {
      title: "文本（text）",
      props: {
        variant: "primary",
        text: true,
      },
      slotText: "文本主色",
      code: "<Button variant=\"primary\" text>文本主色</Button>",
    },
    {
      title: "severity 覆盖颜色（warning）",
      props: { severity: "warning" },
      slotText: "severity 警告",
      code: "<Button severity=\"warning\">severity 警告</Button>",
    },
    {
      title: "描边危险（severity + outlined）",
      props: {
        severity: "danger",
        outlined: true,
      },
      slotText: "描边危险",
      code: "<Button severity=\"danger\" outlined>描边危险</Button>",
    },
    {
      title: "文本危险（severity + text）",
      props: {
        severity: "danger",
        text: true,
      },
      slotText: "文本危险",
      code: "<Button severity=\"danger\" text>文本危险</Button>",
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
      title: "图标在上（iconPosition: top）",
      props: {
        icon: "save",
        iconPosition: "top",
      },
      slotText: "保存",
      code: "<Button icon=\"save\" iconPosition=\"top\">保存</Button>",
    },
    {
      title: "图标在下（iconPosition: bottom）",
      props: {
        icon: "chevronDown",
        iconPosition: "bottom",
      },
      slotText: "展开",
      code: "<Button icon=\"chevronDown\" iconPosition=\"bottom\">展开</Button>",
    },
    {
      title: "纯图标按钮（title 作可访问名称）",
      props: {
        icon: "settings",
        title: "设置",
      },
      code: "<Button icon=\"settings\" title=\"设置\" />",
    },
    {
      title: "纯图标按钮（ariaLabel）",
      props: {
        icon: "plus",
        ariaLabel: "新增条目",
      },
      code: "<Button icon=\"plus\" ariaLabel=\"新增条目\" />",
    },
    {
      title: "圆形纯图标按钮（rounded）",
      props: {
        icon: "refresh",
        rounded: true,
        ariaLabel: "刷新",
      },
      code: "<Button icon=\"refresh\" rounded ariaLabel=\"刷新\" />",
    },
    {
      title: "加载状态（文案保留占位，宽度不跳变）",
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
      title: "块级按钮（文案居中）",
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
