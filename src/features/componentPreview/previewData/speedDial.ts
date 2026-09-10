/**
 * 组件预览清单 — SpeedDial 分组数据
 * 清单条目：title（示例名）、props（透传给组件）、code（对应可复制模板）
 * 注：示例统一给 `visible: true` 以便目视展开形态；本组件无默认插槽，故全部只用 props + code。
 * 注：props 里的图标必须写已注册的语义 IconKey（写 mdi:xxx 原样不会渲染）。
 */
import type { PreviewGroup } from "../types"
import SpeedDial from "@/components/SpeedDial.vue"

/** 基础三动作（与示例 code 中的 actions 对应） */
const actionsBasic = [
  {
    key: "edit",
    label: "编辑",
    icon: "pencil",
  },
  {
    key: "star",
    label: "收藏",
    icon: "star",
  },
  {
    key: "delete",
    label: "删除",
    icon: "delete",
  },
]

/** 带单项配色与禁用项的动作（演示 severity 与 disabled） */
const actionsMixed = [
  {
    key: "upload",
    label: "上传",
    icon: "upload",
    severity: "primary",
  },
  {
    key: "download",
    label: "下载",
    icon: "download",
    severity: "success",
  },
  {
    key: "remove",
    label: "移除（不可用）",
    icon: "delete",
    severity: "danger",
    disabled: true,
  },
]

/** 双动作（用于曲线轨迹示例） */
const actionsPair = [
  {
    key: "search",
    label: "搜索",
    icon: "magnify",
  },
  {
    key: "refresh",
    label: "刷新",
    icon: "refresh",
  },
]

export const speedDialGroup: PreviewGroup = {
  id: "speedDial",
  component: SpeedDial,
  name: "SpeedDial",
  summary: "浮动动作按钮：8 向 × 四档轨迹展开动作，角落悬浮定位、动作气泡、图标旋转与菜单无障碍",
  importCode: "import SpeedDial from \"@/components/SpeedDial.vue\"",
  sizeable: true,
  examples: [
    {
      title: "基础（向上直线）",
      props: {
        model: actionsBasic,
        visible: true,
        ariaLabel: "常用操作",
      },
      code: "<SpeedDial v-model:visible=\"open\" :model=\"actions\" aria-label=\"常用操作\" />",
    },
    {
      title: "整圆轨迹（circle）",
      props: {
        model: actionsBasic,
        type: "circle",
        radius: 72,
        visible: true,
        ariaLabel: "常用操作",
      },
      code: "<SpeedDial v-model:visible=\"open\" :model=\"actions\" type=\"circle\" :radius=\"72\" aria-label=\"常用操作\" />",
    },
    {
      title: "半圆轨迹（semi-circle）",
      props: {
        model: actionsBasic,
        type: "semi-circle",
        radius: 72,
        visible: true,
        ariaLabel: "常用操作",
      },
      code: "<SpeedDial v-model:visible=\"open\" :model=\"actions\" type=\"semi-circle\" :radius=\"72\" aria-label=\"常用操作\" />",
    },
    {
      title: "四分之一圆（quarter-circle）",
      props: {
        model: actionsPair,
        type: "quarter-circle",
        radius: 72,
        direction: "up-left",
        visible: true,
        ariaLabel: "常用操作",
      },
      code: "<SpeedDial v-model:visible=\"open\" :model=\"actions\" type=\"quarter-circle\" :radius=\"72\" direction=\"up-left\" aria-label=\"常用操作\" />",
    },
    {
      title: "向左展开（direction）",
      props: {
        model: actionsPair,
        direction: "left",
        visible: true,
        ariaLabel: "常用操作",
      },
      code: "<SpeedDial v-model:visible=\"open\" :model=\"actions\" direction=\"left\" aria-label=\"常用操作\" />",
    },
    {
      title: "单项配色与禁用（severity / disabled）",
      props: {
        model: actionsMixed,
        visible: true,
        ariaLabel: "文件操作",
      },
      code: "<SpeedDial v-model:visible=\"open\" :model=\"actions\" aria-label=\"文件操作\" />",
    },
    {
      title: "展开态独立图标（hideIcon）",
      props: {
        model: actionsBasic,
        showIcon: "plus",
        hideIcon: "close",
        visible: true,
        ariaLabel: "更多操作",
      },
      code: "<SpeedDial v-model:visible=\"open\" :model=\"actions\" show-icon=\"plus\" hide-icon=\"close\" aria-label=\"更多操作\" />",
    },
    {
      title: "关闭图标旋转（rotateAnimation）",
      props: {
        model: actionsBasic,
        rotateAnimation: false,
        visible: true,
        ariaLabel: "更多操作",
      },
      code: "<SpeedDial v-model:visible=\"open\" :model=\"actions\" :rotate-animation=\"false\" aria-label=\"更多操作\" />",
    },
    {
      title: "尺寸 - large",
      props: {
        model: actionsBasic,
        size: "large",
        visible: true,
        ariaLabel: "常用操作",
      },
      code: "<SpeedDial v-model:visible=\"open\" :model=\"actions\" size=\"large\" aria-label=\"常用操作\" />",
    },
    {
      title: "关闭点击外部收起（hideOnClickOutside）",
      props: {
        model: actionsPair,
        hideOnClickOutside: false,
        visible: true,
        ariaLabel: "常用操作",
      },
      code: "<SpeedDial v-model:visible=\"open\" :model=\"actions\" :hide-on-click-outside=\"false\" aria-label=\"常用操作\" />",
    },
    {
      title: "禁用",
      props: {
        model: actionsBasic,
        disabled: true,
        visible: true,
        ariaLabel: "常用操作（禁用）",
      },
      code: "<SpeedDial v-model:visible=\"open\" :model=\"actions\" disabled aria-label=\"常用操作（禁用）\" />",
    },
    {
      title: "自定义角落与边距（position / offset）",
      props: {
        model: actionsPair,
        position: "top-left",
        // 左上角需配合向下展开，否则动作会被卡片裁掉（卡片为 overflow: hidden）
        direction: "down",
        offset: "12px",
        visible: true,
        ariaLabel: "常用操作",
      },
      code: "<SpeedDial v-model:visible=\"open\" :model=\"actions\" position=\"top-left\" direction=\"down\" offset=\"12px\" aria-label=\"常用操作\" />",
    },
  ],
}

export const speedDialPreviewGroups: PreviewGroup[] = [
  speedDialGroup,
]
