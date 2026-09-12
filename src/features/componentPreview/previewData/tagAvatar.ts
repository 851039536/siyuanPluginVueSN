/**
 * 组件预览清单 — Tag / Badge / Avatar 分组数据
 * 清单条目：title（示例名）、props（透传给组件）、slotText（默认插槽文本）、code（对应可复制模板）
 */
import type { PreviewGroup } from "../types"
import Tag from "@/components/Tag.vue"
import Badge from "@/components/Badge.vue"
import Avatar from "@/components/Avatar.vue"

export const tagGroup: PreviewGroup = {
  id: "tag",
  component: Tag,
  name: "Tag",
  summary: "标签：变体（含官方 Badge severity 取值）/ 形状（含圆形计数徽标）/ 实底外观 fill / content 便捷入口 / 图标 / 可关闭 / 禁用",
  importCode: "import Tag from \"@/components/Tag.vue\"",
  sizeable: true,
  examples: [
    {
      title: "default",
      props: { variant: "default" },
      slotText: "默认标签",
      code: "<Tag>默认标签</Tag>",
    },
    {
      title: "primary",
      props: { variant: "primary" },
      slotText: "主要标签",
      code: "<Tag variant=\"primary\">主要标签</Tag>",
    },
    {
      title: "success",
      props: { variant: "success" },
      slotText: "成功",
      code: "<Tag variant=\"success\">成功</Tag>",
    },
    {
      title: "warning",
      props: { variant: "warning" },
      slotText: "警告",
      code: "<Tag variant=\"warning\">警告</Tag>",
    },
    {
      title: "danger",
      props: { variant: "danger" },
      slotText: "危险",
      code: "<Tag variant=\"danger\">危险</Tag>",
    },
    {
      title: "info",
      props: { variant: "info" },
      slotText: "信息",
      code: "<Tag variant=\"info\">信息</Tag>",
    },
    {
      title: "圆形标签",
      props: { shape: "circle" },
      slotText: "圆形",
      code: "<Tag shape=\"circle\">圆形</Tag>",
    },
    {
      title: "方形标签",
      props: { shape: "square" },
      slotText: "方形",
      code: "<Tag shape=\"square\">方形</Tag>",
    },
    {
      title: "带图标",
      props: { icon: "tagOutline" },
      slotText: "分类",
      code: "<Tag icon=\"tagOutline\">分类</Tag>",
    },
    {
      title: "可关闭",
      props: { closable: true },
      slotText: "可关闭标签",
      code: "<Tag closable @close=\"handleClose\">可关闭标签</Tag>",
    },
    {
      title: "禁用",
      props: { disabled: true },
      slotText: "禁用标签",
      code: "<Tag disabled>禁用标签</Tag>",
    },
    {
      title: "自定义颜色",
      props: {
        color: "#eef2ff",
        textColor: "#4f46e5",
        borderColor: "#c7d2fe",
      },
      slotText: "自定义",
      code: "<Tag color=\"#eef2ff\" textColor=\"#4f46e5\" borderColor=\"#c7d2fe\">自定义</Tag>",
    },
    {
      title: "实底外观（fill）",
      props: { variant: "primary", fill: true },
      slotText: "实底主要",
      code: "<Tag variant=\"primary\" fill>实底主要</Tag>",
    },
    {
      title: "实底 · danger",
      props: { variant: "danger", fill: true },
      slotText: "实底危险",
      code: "<Tag variant=\"danger\" fill>实底危险</Tag>",
    },
    {
      title: "实底 · contrast",
      props: { variant: "contrast", fill: true },
      slotText: "实底反色",
      code: "<Tag variant=\"contrast\" fill>实底反色</Tag>",
    },
    {
      title: "官方 severity 取值（warn）",
      props: { variant: "warn" },
      slotText: "警告",
      code: "<Tag variant=\"warn\">警告</Tag>",
    },
    {
      title: "官方 severity 取值（secondary）",
      props: { variant: "secondary" },
      slotText: "中性",
      code: "<Tag variant=\"secondary\">中性</Tag>",
    },
    {
      title: "content 纯文本便捷入口",
      props: { content: "纯文本", variant: "info" },
      code: "<Tag variant=\"info\" content=\"纯文本\" />",
    },
    {
      title: "计数徽标（content + max 折叠）",
      props: { content: 128, max: 99, shape: "circle", variant: "danger", fill: true },
      code: "<Tag :content=\"128\" :max=\"99\" shape=\"circle\" variant=\"danger\" fill />",
    },
    {
      title: "圆形计数（个位数）",
      props: { content: 5, shape: "circle", variant: "primary", fill: true },
      code: "<Tag :content=\"5\" shape=\"circle\" variant=\"primary\" fill />",
    },
  ],
}

export const badgeGroup: PreviewGroup = {
  id: "badge",
  component: Badge,
  name: "Badge",
  summary: "徽标：包裹内容显示数字/圆点，支持变体 / 位置 / 上限",
  importCode: "import Badge from \"@/components/Badge.vue\"",
  sizeable: true,
  examples: [
    {
      title: "数字徽标",
      props: { content: 5 },
      slotText: "消息",
      code: "<Badge :content=\"5\"><span>消息</span></Badge>",
    },
    {
      title: "圆点徽标",
      props: {
        content: "",
        dot: true,
      },
      slotText: "在线状态",
      code: "<Badge dot><span>在线状态</span></Badge>",
    },
    {
      title: "上限显示",
      props: { content: 100 },
      slotText: "通知",
      code: "<Badge :content=\"100\"><span>通知</span></Badge>",
    },
    {
      title: "success 变体",
      props: {
        content: "new",
        variant: "success",
      },
      slotText: "版本",
      code: "<Badge content=\"new\" variant=\"success\"><span>版本</span></Badge>",
    },
    {
      title: "info 变体",
      props: {
        content: 3,
        variant: "info",
      },
      slotText: "更新",
      code: "<Badge :content=\"3\" variant=\"info\"><span>更新</span></Badge>",
    },
    {
      title: "底部右侧",
      props: {
        content: 2,
        position: "bottom-right",
      },
      slotText: "评论",
      code: "<Badge :content=\"2\" position=\"bottom-right\"><span>评论</span></Badge>",
    },
    {
      title: "隐藏徽标",
      props: {
        content: 5,
        hidden: true,
      },
      slotText: "已隐藏",
      code: "<Badge :content=\"5\" hidden><span>已隐藏</span></Badge>",
    },
    {
      title: "自定义颜色",
      props: {
        content: 8,
        color: "#8b5cf6",
      },
      slotText: "待办",
      code: "<Badge :content=\"8\" color=\"#8b5cf6\"><span>待办</span></Badge>",
    },
  ],
}

export const avatarGroup: PreviewGroup = {
  id: "avatar",
  component: Avatar,
  name: "Avatar",
  summary: "头像：图片 / 文本 / 图标 / 尺寸 / 形状",
  importCode: "import Avatar from \"@/components/Avatar.vue\"",
  sizeable: true,
  examples: [
    {
      title: "文字头像",
      props: { text: "张" },
      code: "<Avatar text=\"张\" />",
    },
    {
      title: "图标头像",
      props: { icon: "accountGroup" },
      code: "<Avatar icon=\"accountGroup\" />",
    },
    {
      title: "方形头像",
      props: {
        text: "Vue",
        shape: "square",
        color: "#10b981",
        textColor: "#ffffff",
      },
      code: "<Avatar text=\"Vue\" shape=\"square\" color=\"#10b981\" textColor=\"#ffffff\" />",
    },
    {
      title: "自定义像素尺寸",
      props: {
        text: "C",
        customSize: 56,
        color: "#f59e0b",
        textColor: "#ffffff",
      },
      code: "<Avatar text=\"C\" :custom-size=\"56\" color=\"#f59e0b\" textColor=\"#ffffff\" />",
    },
    {
      title: "激活态",
      props: {
        text: "张",
        active: true,
      },
      code: "<Avatar text=\"张\" active />",
    },
    {
      title: "禁用态",
      props: {
        text: "张",
        disabled: true,
      },
      code: "<Avatar text=\"张\" disabled />",
    },
  ],
}

export const tagAvatarPreviewGroups: PreviewGroup[] = [
  tagGroup,
  badgeGroup,
  avatarGroup,
]
