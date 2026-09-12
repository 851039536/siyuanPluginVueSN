/**
 * 组件预览清单 — FocusTrap 分组数据
 *
 * 注 1：FocusTrap 的能力是**键盘焦点行为**（Tab 回绕、焦点逃逸拉回），无法用静态快照表达 ⇒
 *      这里内联一个**演示宿主**：把一组按钮包进陷阱，并在宿主内显示当前焦点是否被困住，
 *      便于在预览面板里**直接用 Tab 键实测**。
 * 注 2：宿主提供 `showStatus` 脚手架开关，在陷阱内渲染一行状态说明（含退出按钮），
 *      使「Tab 只在框内循环」这件事在视觉上可验证。
 * 注 3：组件纯行为、**零视觉**（不设内边距 / 边框 / 底色），故示例用虚线框标出陷阱边界，
 *      该虚线框属于**演示宿主**而非组件本体。
 */
import type {
  Component,
  PropType,
  VNode,
} from "vue"
import {
  defineComponent,
  h,
  ref,
} from "vue"
import type { PreviewGroup } from "../types"
import Button from "@/components/Button.vue"
import FocusTrap from "@/components/FocusTrap.vue"
import type { ComponentSize } from "../types"

/**
 * 演示宿主：陷阱内放三个按钮 +（可选）状态行，用于实测 Tab 回绕。
 * `trapFocusIn` / `autoFocus` / `disabled` 直接透传，便于对照三种行为差异。
 */
const FocusTrapDemo = defineComponent({
  name: "FocusTrapDemo",
  props: {
    // ⚠️ 联合类型必须用 `PropType` 收窄：只写 `type: String` 会让 props 退化为 `string`，
    //    透传给 Button 的严格联合 `ButtonSize` 时报 TS2769
    size: { type: String as PropType<ComponentSize>, default: "small" },
    disabled: { type: Boolean, default: false },
    autoFocus: { type: Boolean, default: true },
    trapFocusIn: { type: Boolean, default: true },
    /** 预览脚手架：是否在陷阱内渲染状态说明行 */
    showStatus: { type: Boolean, default: true },
  },
  setup(props) {
    const escapedCount = ref(0)

    return (): VNode => h(
      FocusTrap,
      {
        class: "cp-focustrap-demo",
        disabled: props.disabled,
        autoFocus: props.autoFocus,
        trapFocusIn: props.trapFocusIn,
        onFocusEscaped: () => {
          escapedCount.value += 1
        },
      },
      {
        default: () => [
          props.showStatus
            ? h("div", { class: "cp-focustrap-demo__status" }, [
              h("span", "按 Tab 键：焦点应在本框内循环"),
              escapedCount.value > 0
                ? h("span", { class: "cp-focustrap-demo__caught" }, `已拦截逃逸 ${escapedCount.value} 次`)
                : null,
            ])
            : null,
          h("div", { class: "cp-focustrap-demo__row" }, [
            h(Button, {
              variant: "ghost",
              outlined: true,
              size: props.size,
            }, () => "按钮一"),
            h(Button, {
              variant: "ghost",
              outlined: true,
              size: props.size,
            }, () => "按钮二"),
            h(Button, {
              variant: "ghost",
              outlined: true,
              size: props.size,
            }, () => "按钮三"),
          ]),
        ],
      },
    )
  },
})

export const focusTrapGroup: PreviewGroup = {
  id: "focusTrap",
  component: FocusTrapDemo as Component,
  name: "FocusTrap",
  summary: "焦点陷阱：Tab 焦点限制在包裹区域内（Tab 回绕 + 焦点逃逸拉回 + 挂载自动聚焦）；纯行为组件、零视觉",
  importCode: "import FocusTrap from \"@/components/FocusTrap.vue\"",
  examples: [
    {
      title: "基本用法（Tab 在此框内循环）",
      props: {},
      code: `<FocusTrap>
  <Button>按钮一</Button>
  <Button>按钮二</Button>
  <Button>按钮三</Button>
</FocusTrap>`,
    },
    {
      title: "不自动聚焦（autoFocus: false）",
      props: { autoFocus: false },
      code: `<!-- 挂载时不抢焦点，但进入后仍会被困住 -->
<FocusTrap :auto-focus="false">
  <Button>按钮一</Button>
  <Button>按钮二</Button>
</FocusTrap>`,
    },
    {
      title: "仅 Tab 回绕，不限制外部聚焦",
      props: { trapFocusIn: false },
      code: `<!-- trapFocusIn: false —— 允许点击外部把焦点移出（适合非模态浮层） -->
<FocusTrap :trap-focus-in="false">
  <Button>按钮一</Button>
  <Button>按钮二</Button>
</FocusTrap>`,
    },
    {
      title: "禁用（disabled）",
      props: { disabled: true, showStatus: false },
      code: `<!-- disabled：不拦截 Tab、不拉回逃逸焦点（autoFocus 独立生效） -->
<FocusTrap disabled>
  <Button>按钮一</Button>
  <Button>按钮二</Button>
</FocusTrap>`,
    },
  ],
}

export const focusTrapPreviewGroups: PreviewGroup[] = [focusTrapGroup]
