/**
 * 组件预览 — 示例舞台（渲染函数组件，无自有 DOM）
 *
 * 职责：为受控示例持有本地 modelValue 并回写 `update:modelValue`（使 v-model 在预览中真正可交互），
 * 并把默认 / 具名 / 作用域插槽转发给目标组件。因为必须**直接**把目标组件作为根节点渲染、
 * 不能有包裹层，所以用 .ts 承载渲染函数（不需要模板），而非 .vue。
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
  toRef,
} from "vue"

/**
 * 组件是否声明了 modelValue：只有声明了才注入 v-model 相关 props。
 * 未声明时不注入任何额外属性 —— 否则 `modelValue` / `onUpdate:modelValue` 会落进 attrs，
 * 多根组件（如 `FormField`）会因此产生 extraneous attrs 警告。
 */
const isControlledComponent = (component: Component): boolean => {
  const declared = (component as unknown as { props?: Record<string, unknown> }).props
  return !!declared && Object.prototype.hasOwnProperty.call(declared, "modelValue")
}

/**
 * 同值判定：原始值走 `Object.is`，数组做逐项浅比较。
 * 受控组件常回写「内容相同的新数组」（如队列类、多选类），若一律写回就会形成
 * `emit → 写回 modelValue → 重渲染 → 再 emit` 的自激循环（内存持续增长），故此守卫必须保留。
 */
const isSameValue = (current: unknown, next: unknown): boolean => {
  if (Object.is(current, next)) {
    return true
  }
  if (Array.isArray(current) && Array.isArray(next)) {
    return current.length === next.length
      && current.every((item, index) => Object.is(item, (next as unknown[])[index]))
  }
  return false
}

export default defineComponent({
  name: "PreviewStage",
  props: {
    component: {
      type: [Object, Function] as PropType<Component>,
      required: true,
    },
    componentProps: {
      type: Object as PropType<Record<string, any>>,
      required: true,
    },
    /** 是否把默认插槽转发给目标组件（无插槽内容时必须为 false，否则 `$slots.default` 恒真会改变组件内部分支） */
    hasSlot: {
      type: Boolean,
      default: false,
    },
    /**
     * 具名 / 作用域插槽：键为插槽名，值为接收该插槽作用域参数的 VNode 工厂。
     * 工厂每次调用都必须新建 VNode —— 同一实例重复挂载会触发 Vue 告警。
     * 工厂第二个入参为注入全局档位后的实际渲染 props（供插槽内共享控件取同档 `size`）。
     */
    namedSlots: {
      type: Object as PropType<Record<string, (
        slotProps: Record<string, any>,
        exampleProps: Record<string, any>,
      ) => VNode | VNode[]>>,
    },
  },
  setup: (stageProps, { slots }) => {
    const resolvedProps = toRef(stageProps, "componentProps")
    /** 受控值：初始取示例声明的 modelValue，之后仅由 update:modelValue 更新 */
    const modelValue = ref<unknown>(resolvedProps.value.modelValue)

    return (): VNode => {
      // 其余 props 每次渲染重新解析 —— 故切换全局尺寸档位即时生效
      const componentProps: Record<string, any> = {
        ...resolvedProps.value,
      }

      if (isControlledComponent(stageProps.component)) {
        componentProps.modelValue = modelValue.value
        componentProps["onUpdate:modelValue"] = (value: unknown) => {
          // 同值不写回：截断「组件无条件回写 → 重渲染 → 再回写」的自激循环
          if (isSameValue(modelValue.value, value)) {
            return
          }
          modelValue.value = value
        }
      }

      // 默认插槽与具名插槽合并为 h() 的 children；两者皆空时传 undefined（不传空对象）
      const children: Record<string, any> = {}
      if (stageProps.hasSlot && slots.default) {
        children.default = slots.default
      }
      for (const [name, factory] of Object.entries(stageProps.namedSlots ?? {})) {
        children[name] = (slotProps: Record<string, any>) => {
          // 第二参传本次渲染的实际 props（含注入的全局档位），插槽内共享控件据此对齐档位
          const rendered = factory(slotProps ?? {}, componentProps)
          return Array.isArray(rendered) ? rendered : [rendered]
        }
      }

      return h(
        stageProps.component as Component,
        componentProps,
        Object.keys(children).length > 0 ? children : undefined,
      )
    }
  },
})
