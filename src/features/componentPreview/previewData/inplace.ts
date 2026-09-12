/**
 * 组件预览清单 — Inplace 分组数据
 *
 * 注 1：Inplace 的两态互换需要**真实可交互**才有意义（点击 display → 切到 content → 点按钮收起），
 *      纯 props 快照无法表达 ⇒ 这里内联一个**演示宿主**，把它作为 `PreviewGroup.component`。
 * 注 2：宿主用 `defaultActive` 脚手架开关指定首帧态：`false` 时展示「只读输出」形态，
 *      `true` 时直接展示「编辑内容」形态（静态对比两态观感）。
 * 注 3：组件自身不带任何文案（display / content 都是插槽），故示例文案由宿主提供；
 *      ⚠️ 这也是它**零 i18n 分片改动**的原因 —— 全部文案来自调用方。
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
import type {
  ComponentSize,
  PreviewGroup,
} from "../types"
import Button from "@/components/Button.vue"
import Inplace from "@/components/Inplace.vue"

/**
 * 演示宿主：自持 `active` 并接线 v-model，使两态切换在预览中**真实可用**。
 * - `displayText`：只读态文案
 * - `editorKind`：编辑态形态（`input` 文本框 / `buttons` 一组按钮 / `text` 纯文本）
 */
const InplaceDemo = defineComponent({
  name: "InplaceDemo",
  props: {
    // ⚠️ 联合类型必须用 `PropType` 收窄：只写 `type: String` 会让 props 退化为 `string`，
    //    透传给 Button 的严格联合 `ButtonSize` 时报 TS2769
    size: { type: String as PropType<ComponentSize>, default: "small" },
    disabled: { type: Boolean, default: false },
    /** 预览脚手架：首帧是否直接处于编辑态 */
    defaultActive: { type: Boolean, default: false },
    /** 预览脚手架：只读态文案 */
    displayText: { type: String, default: "点击此处编辑" },
    /** 预览脚手架：编辑态形态 */
    editorKind: { type: String, default: "input" },
  },
  setup(props) {
    const active = ref(props.defaultActive)
    const draft = ref(props.displayText)

    /** 编辑态内容：文本框 / 按钮组 / 纯文本三选一（覆盖典型用法） */
    const renderEditor = (closeCallback: () => void): VNode => {
      if (props.editorKind === "buttons") {
        return h("div", { class: "cp-inplace-demo__row" }, [
          h(Button, {
            variant: "ghost",
            outlined: true,
            size: props.size,
            onClick: closeCallback,
          }, () => "取消"),
          h(Button, {
            variant: "primary",
            size: props.size,
            onClick: closeCallback,
          }, () => "保存"),
        ])
      }
      if (props.editorKind === "text") {
        return h("span", { class: "cp-inplace-demo__text" }, "编辑态内容（自定义插槽）")
      }
      return h("input", {
        class: "cp-inplace-demo__input",
        value: draft.value,
        onInput: (event: Event) => {
          draft.value = (event.target as HTMLInputElement).value
        },
        onKeydown: (event: KeyboardEvent) => {
          if (event.key === "Enter") closeCallback()
        },
      })
    }

    return (): VNode => h(Inplace, {
      active: active.value,
      disabled: props.disabled,
      "onUpdate:active": (value: boolean) => {
        active.value = value
      },
    }, {
      display: () => h("span", { class: "cp-inplace-demo__display" }, props.displayText),
      content: ({ closeCallback }: { closeCallback: () => void }) => renderEditor(closeCallback),
    })
  },
})

export const inplaceGroup: PreviewGroup = {
  id: "inplace",
  component: InplaceDemo as Component,
  name: "Inplace",
  summary: "就地编辑：点击只读输出切换为编辑内容（display / content 两态互换、v-model:active、关闭时焦点归还 display）",
  importCode: "import Inplace from \"@/components/Inplace.vue\"",
  examples: [
    {
      title: "基本用法（文本框）",
      props: { displayText: "点击编辑标题" },
      code: `<Inplace v-model:active="active">
  <template #display>{{ title }}</template>
  <template #content="{ closeCallback }">
    <Input v-model="draft" @keydown.enter="closeCallback" />
  </template>
</Inplace>`,
    },
    {
      title: "编辑态为按钮组",
      props: { displayText: "2026-09-12", editorKind: "buttons" },
      code: `<Inplace v-model:active="active">
  <template #display>{{ date }}</template>
  <template #content="{ closeCallback }">
    <Button variant="ghost" outlined @click="closeCallback">取消</Button>
    <Button variant="primary" @click="closeCallback">保存</Button>
  </template>
</Inplace>`,
    },
    {
      title: "编辑态为自定义内容",
      props: { displayText: "查看详情", editorKind: "text" },
      code: `<Inplace v-model:active="active">
  <template #display>查看详情</template>
  <template #content="{ closeCallback }">
    <span>任意自定义编辑内容</span>
  </template>
</Inplace>`,
    },
    {
      title: "编辑态快照（defaultActive）",
      props: { displayText: "点击编辑", defaultActive: true },
      code: `<!-- 受控为 true 时直接渲染 content 插槽 -->
<Inplace :active="true">
  <template #display>只读输出</template>
  <template #content="{ closeCallback }">编辑内容</template>
</Inplace>`,
    },
    {
      title: "禁用",
      props: { displayText: "不可编辑", disabled: true },
      code: "<Inplace disabled>  <!-- display 不可点击 / 不可聚焦 -->",
    },
  ],
}

export const inplacePreviewGroups: PreviewGroup[] = [inplaceGroup]
