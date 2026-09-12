/**
 * 组件预览清单 — ConfirmPopup 分组数据
 *
 * 注 1：气泡需要「锚点元素 + 开合状态」，纯清单数据无法表达 ⇒ 这里内联一个**演示宿主**
 *      （一个触发按钮 + 一个 ConfirmPopup，target 指向按钮外层包裹元素），
 *      把它作为 `PreviewGroup.component`；示例通过 props 组合气泡的文案 / 方位 / 配色，
 *      全局尺寸档位由 `resolveProps` 注入宿主并透传给按钮与气泡。
 * 注 2：宿主自身只是预览脚手架，转发 props 时用宽松对象（与渲染层 `PreviewStage` 同法），
 *      不为此引入对组件私有类型的依赖。
 */
import type { Component, VNode } from "vue"
import type { PropType } from "vue"
import {
  defineComponent,
  h,
  ref,
} from "vue"
import type { IconKey } from "@/components/kit/icons"
import type { PreviewGroup } from "../types"
import Button from "@/components/Button.vue"
import ConfirmPopup from "@/components/ConfirmPopup.vue"

/** 演示宿主：按钮为锚点，气泡默认展开，点按钮可重新打开（便于反复观察定位） */
const ConfirmPopupDemo = defineComponent({
  name: "ConfirmPopupDemo",
  props: {
    size: { type: String, default: "small" },
    header: { type: String, default: "" },
    message: { type: String, default: "" },
    icon: { type: String as PropType<IconKey | undefined>, default: undefined },
    acceptLabel: { type: String, default: undefined },
    rejectLabel: { type: String, default: undefined },
    acceptSeverity: { type: String, default: undefined },
    acceptLoading: { type: Boolean, default: false },
    placement: { type: String, default: "auto" },
    dismissable: { type: Boolean, default: true },
  },
  setup(props) {
    const anchor = ref<HTMLElement | null>(null)
    /** 开合状态由宿主自持：预览框架只接管 `modelValue`，不碰 `visible` */
    const visible = ref(true)

    return (): VNode => {
      const popupProps: Record<string, any> = {
        visible: visible.value,
        target: () => anchor.value,
        header: props.header,
        message: props.message,
        icon: props.icon,
        acceptLabel: props.acceptLabel,
        rejectLabel: props.rejectLabel,
        acceptSeverity: props.acceptSeverity,
        acceptLoading: props.acceptLoading,
        placement: props.placement,
        dismissable: props.dismissable,
        size: props.size,
        "onUpdate:visible": (value: boolean) => {
          visible.value = value
        },
      }

      return h("div", { class: "cp-popup-demo" }, [
        // 锚点用一层包裹元素承接 ref：Button 未暴露实例，包裹层与按钮尺寸一致故贴合无偏差
        h("span", {
          class: "cp-popup-demo__anchor",
          ref: (el: any) => {
            anchor.value = (el as HTMLElement) ?? null
          },
        }, [
          h(Button, {
            size: props.size,
            variant: "secondary",
            outlined: true,
            onClick: () => {
              visible.value = true
            },
          }, "删除快照"),
        ]),
        h(ConfirmPopup as Component, popupProps),
      ])
    }
  },
})

export const confirmPopupGroup: PreviewGroup = {
  id: "confirm-popup",
  component: ConfirmPopupDemo,
  name: "ConfirmPopup",
  summary: "气泡确认：受控显示 + target 锚点，八向自动定位与越界翻转，点外部 / Esc 关闭（非模态无遮罩）",
  importCode: "import ConfirmPopup from \"@/components/ConfirmPopup.vue\"",
  sizeable: true,
  examples: [
    {
      title: "基础（auto：优先下方、放不下上翻）",
      props: {
        header: "删除快照",
        message: "删除后不可恢复，确定继续吗？",
        acceptLabel: "删除",
      },
      code: `<Button ref="anchorRef" @click="visible = true">删除快照</Button>
<ConfirmPopup
  v-model:visible="visible"
  :target="() => anchorRef.$el"
  header="删除快照"
  message="删除后不可恢复，确定继续吗？"
  accept-label="删除"
  @confirm="handleConfirm"
/>`,
    },
    {
      title: "显式下方（placement=\"bottom\"）",
      props: {
        header: "下方弹出",
        message: "显式方位只做视口钳制、不翻转。",
        acceptSeverity: "primary",
        placement: "bottom",
      },
      code: `<ConfirmPopup
  v-model:visible="visible"
  :target="() => anchorRef.$el"
  header="下方弹出"
  placement="bottom"
  accept-severity="primary"
/>`,
    },
    {
      title: "显式上方（placement=\"top\"）",
      props: {
        header: "上方弹出",
        message: "空间不足时也不会翻到反方向。",
        acceptSeverity: "primary",
        placement: "top",
      },
      code: `<ConfirmPopup
  v-model:visible="visible"
  :target="() => anchorRef.$el"
  header="上方弹出"
  placement="top"
  accept-severity="primary"
/>`,
    },
    {
      title: "右侧（placement=\"right\"）",
      props: {
        header: "右侧弹出",
        message: "左右方位垂直居中于锚点。",
        acceptSeverity: "primary",
        placement: "right",
      },
      code: `<ConfirmPopup
  v-model:visible="visible"
  :target="() => anchorRef.$el"
  header="右侧弹出"
  placement="right"
  accept-severity="primary"
/>`,
    },
    {
      title: "标题图标 + 危险配色",
      props: {
        header: "清空日志？",
        message: "该操作不可撤销。",
        icon: "warning",
        acceptLabel: "清空",
      },
      code: `<ConfirmPopup
  v-model:visible="visible"
  :target="() => anchorRef.$el"
  header="清空日志？"
  message="该操作不可撤销。"
  icon="warning"
  accept-label="清空"
/>`,
    },
    {
      title: "确认按钮加载态",
      props: {
        header: "同步中",
        message: "确认按钮处于加载态，避免重复提交。",
        acceptSeverity: "primary",
        acceptLabel: "同步",
        acceptLoading: true,
      },
      code: `<ConfirmPopup
  v-model:visible="visible"
  :target="() => anchorRef.$el"
  header="同步中"
  accept-label="同步"
  :accept-loading="syncing"
/>`,
    },
    {
      title: "禁止点外部关闭（dismissable=false）",
      props: {
        header: "必须明确选择",
        message: "点外部不再关闭，只能点按钮或按 Esc。",
        acceptSeverity: "primary",
        dismissable: false,
      },
      code: `<ConfirmPopup
  v-model:visible="visible"
  :target="() => anchorRef.$el"
  header="必须明确选择"
  :dismissable="false"
  accept-severity="primary"
/>`,
    },
  ],
}

export const confirmPopupPreviewGroups: PreviewGroup[] = [confirmPopupGroup]
