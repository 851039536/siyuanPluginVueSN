/**
 * 组件预览清单 — Tooltip 分组数据
 *
 * 注 1：气泡需要「锚点元素」，纯清单数据无法表达 ⇒ 这里内联一个**演示宿主**
 *      （一个包裹按钮 + 一个 Tooltip，target 指向包裹元素），把它作为 `PreviewGroup.component`；
 *      示例通过 props 组合文案 / 方位 / 延迟等，全局尺寸档位由 `resolveProps` 注入宿主并透传。
 * 注 2：宿主默认走**非受控**（不传 `visible`）⇒ 预览中 hover / focus 真实可用；
 *      仅「受控」一条示例由宿主自持 `visible`（静态快照），用于演示 `v-model:visible` 写法。
 * 注 3：宿主的 `pinned` 为预览脚手架专用开关：为 true 时强制常显气泡，便于静态目视方位差异
 *      （hover 触发在截图中不可见，故方位对比示例需要常显）。
 * 注 4：宿主自身只是预览脚手架，转发 props 时用宽松对象（与渲染层 `PreviewStage` 同法）。
 */
import type { Component, VNode } from "vue"
import {
  defineComponent,
  h,
  ref,
} from "vue"
import type { PreviewGroup } from "../types"
import Button from "@/components/Button.vue"
import Tooltip from "@/components/Tooltip.vue"

/** 演示宿主：包裹按钮为锚点；`pinned` 时强制常显（静态目视方位），否则真实 hover / focus 触发 */
const TooltipDemo = defineComponent({
  name: "TooltipDemo",
  props: {
    size: { type: String, default: "small" },
    text: { type: String, default: "" },
    placement: { type: String, default: "top" },
    trigger: { type: String, default: "both" },
    showDelay: { type: Number, default: 0 },
    hideDelay: { type: Number, default: 0 },
    maxWidth: { type: Number, default: 240 },
    disabled: { type: Boolean, default: false },
    /** 预览脚手架：常显气泡（用于方位 / 尺寸等静态对比示例） */
    pinned: { type: Boolean, default: false },
    /** 预览脚手架：演示受控用法（v-model:visible） */
    controlled: { type: Boolean, default: false },
    /** 锚点按钮文案 */
    anchorText: { type: String, default: "悬停查看提示" },
  },
  setup(props) {
    const anchor = ref<HTMLElement | null>(null)
    /** 受控示例下由宿主自持的开合状态 */
    const controlledVisible = ref(true)

    return (): VNode => {
      const tooltipProps: Record<string, any> = {
        text: props.text,
        target: () => anchor.value,
        placement: props.placement,
        trigger: props.trigger,
        showDelay: props.showDelay,
        hideDelay: props.hideDelay,
        maxWidth: props.maxWidth,
        disabled: props.disabled,
        size: props.size,
      }

      if (props.pinned) {
        tooltipProps.visible = true
      } else if (props.controlled) {
        tooltipProps.visible = controlledVisible.value
        tooltipProps["onUpdate:visible"] = (value: boolean) => {
          controlledVisible.value = value
        }
      }

      return h("div", { class: "cp-tooltip-demo" }, [
        h("span", { class: "cp-tooltip-demo__anchor", ref: anchor }, [
          h(Button, {
            variant: "ghost",
            outlined: true,
            size: props.size,
            disabled: props.disabled,
          }, () => props.anchorText),
        ]),
        h(Tooltip, tooltipProps),
      ])
    }
  },
})

export const tooltipGroup: PreviewGroup = {
  id: "tooltip",
  component: TooltipDemo as Component,
  name: "Tooltip",
  summary: "文字提示：锚点旁气泡，hover / focus 触发 + 四向定位与 auto 翻转 + 延迟可调，非模态无遮罩",
  importCode: "import Tooltip from \"@/components/Tooltip.vue\"",
  sizeable: true,
  examples: [
    {
      title: "基础（hover 触发，真实可用）",
      props: {
        text: "这是一条提示文案",
        anchorText: "悬停或聚焦我",
      },
      code: `<script setup>
const anchor = ref(null)
</script>

<template>
  <span ref="anchor">
    <Button>悬停或聚焦我</Button>
  </span>
  <!-- 非受控：不传 visible，hover / focus 自动开合 -->
  <Tooltip text="这是一条提示文案" :target="() => anchor" />
</template>`,
    },
    {
      title: "方位 - 上方（placement=\"top\"，默认）",
      props: {
        text: "气泡在上方",
        placement: "top",
        pinned: true,
      },
      code: `<Tooltip text="气泡在上方" placement="top" :target="() => anchor" />`,
    },
    {
      title: "方位 - 下方（placement=\"bottom\"）",
      props: {
        text: "气泡在下方",
        placement: "bottom",
        pinned: true,
      },
      code: `<Tooltip text="气泡在下方" placement="bottom" :target="() => anchor" />`,
    },
    {
      title: "方位 - 左侧（placement=\"left\"）",
      props: {
        text: "气泡在左侧",
        placement: "left",
        pinned: true,
      },
      code: `<Tooltip text="气泡在左侧" placement="left" :target="() => anchor" />`,
    },
    {
      title: "方位 - 右侧（placement=\"right\"）",
      props: {
        text: "气泡在右侧",
        placement: "right",
        pinned: true,
      },
      code: `<Tooltip text="气泡在右侧" placement="right" :target="() => anchor" />`,
    },
    {
      title: "自动翻转（placement=\"auto\"）",
      props: {
        text: "auto：优先上方，空间不足自动下翻",
        placement: "auto",
        pinned: true,
      },
      code: `<!-- auto：优先上方，放不下自动下翻；两侧都不够时取空间更大的一侧 -->
<Tooltip text="auto：优先上方，空间不足自动下翻" placement="auto" :target="() => anchor" />`,
    },
    {
      title: "延迟显示（show-delay=600）",
      props: {
        text: "延迟 600ms 出现",
        showDelay: 600,
        anchorText: "悬停等 0.6 秒",
      },
      code: `<!-- 延迟显示：适合密集图标按钮，避免扫过时气泡乱闪 -->
<Tooltip text="延迟 600ms 出现" :show-delay="600" :target="() => anchor" />`,
    },
    {
      title: "仅键盘聚焦触发（trigger=\"focus\"）",
      props: {
        text: "只有聚焦（Tab 键）才显示",
        trigger: "focus",
        anchorText: "Tab 聚焦我",
      },
      code: `<!-- trigger="focus"：鼠标悬停不显示，仅键盘聚焦显示 -->
<Tooltip text="只有聚焦（Tab 键）才显示" trigger="focus" :target="() => anchor" />`,
    },
    {
      title: "长文案换行（max-width=180）",
      props: {
        text: "文案较长时会按 maxWidth 在气泡内换行，而不是拉成一条很长的横条，避免遮挡页面其余内容。",
        maxWidth: 180,
        pinned: true,
      },
      code: `<Tooltip
  text="文案较长时会按 maxWidth 在气泡内换行，而不是拉成一条很长的横条，避免遮挡页面其余内容。"
  :max-width="180"
  :target="() => anchor"
/>`,
    },
    {
      title: "受控（v-model:visible，静态快照）",
      props: {
        text: "开合由调用方完全控制",
        controlled: true,
        anchorText: "受控气泡",
      },
      code: `<!-- 受控：传入 visible 即由调用方接管，组件只派发 update:visible -->
<Tooltip v-model:visible="visible" text="开合由调用方完全控制" :target="() => anchor" />

<!-- 可据此做「点击固定气泡」等自定义交互 -->
<Button @click="visible = !visible">切换提示</Button>`,
    },
    {
      title: "禁用（disabled）",
      props: {
        text: "不会显示：disabled 时忽略一切触发",
        disabled: true,
        anchorText: "禁用态锚点",
      },
      code: `<Tooltip text="不会显示" disabled :target="() => anchor" />`,
    },
  ],
}

export const tooltipPreviewGroups: PreviewGroup[] = [tooltipGroup]
