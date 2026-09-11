<!-- 组件预览 — 单个组件分区：组件名 + 说明 + 卡片网格（真实组件渲染，受控组件可交互 + 可复制代码） -->
<template>
  <section
    :id="`cp-group-${group.id}`"
    class="cp-section"
  >
    <header class="cp-section__head">
      <span class="cp-section__name">{{ group.name }}</span>
      <span class="cp-section__summary">{{ group.summary }}</span>
    </header>
    <!-- 组件 import 示例（可复制） -->
    <div class="cp-section__import">
      <CodeBlock
        :code="group.importCode"
        :i18n="i18n"
      />
    </div>

    <div class="cp-section__grid">
      <div
        v-for="example in group.examples"
        :key="example.title"
        class="cp-card"
      >
        <div
          class="cp-card__stage"
          :class="{
            'cp-card__stage--loader': group.id === 'loader',
            'cp-card__stage--speeddial': group.id === 'speedDial',
          }"
        >
          <!-- 受控示例由 PreviewStage 持有本地值，使 v-model 在预览中真正可交互 -->
          <PreviewStage
            :component="group.component"
            :component-props="resolveProps(example)"
            :has-slot="!!example.render || !!example.slotText"
            :named-slots="example.slots"
          >
            <!-- 复合示例：默认插槽需放多个子组件，交由 render 函数组装 -->
            <SlotRenderer
              v-if="example.render"
              :render="example.render"
              :example-props="resolveProps(example)"
            />
            <!-- 默认插槽示例文本 -->
            <template v-else-if="example.slotText">{{ example.slotText }}</template>
          </PreviewStage>
        </div>
        <footer class="cp-card__foot">
          <span class="cp-card__title">{{ example.title }}</span>
          <button
            class="cp-card__code-btn"
            type="button"
            :title="showCode === example.title ? i18n.hideCode : i18n.viewCode"
            @click="toggleCode(example.title)"
          >
            <!-- 查看 / 收起代码图标 -->
            <IconWrapper
              :name="showCode === example.title ? 'chevronUp' : 'code'"
              :size="13"
            />
          </button>
        </footer>
        <CodeBlock
          v-if="showCode === example.title"
          :code="example.code"
          :i18n="i18n"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
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
import IconWrapper from "@/components/IconWrapper.vue"
import type {
  ComponentSize,
  I18n,
  PreviewExample,
  PreviewGroup,
} from "../types"
import CodeBlock from "./CodeBlock.vue"

/** 复合示例插槽渲染器：把 example.render 的返回值作为插槽内容渲染（无 render 时该组件不挂载） */
const SlotRenderer = defineComponent({
  name: "PreviewSlotRenderer",
  props: {
    render: {
      type: Function as PropType<(props: Record<string, any>) => VNode | VNode[]>,
      required: true,
    },
    exampleProps: {
      type: Object as PropType<Record<string, any>>,
      required: true,
    },
  },
  setup(props): () => VNode | VNode[] {
    return () => props.render(props.exampleProps)
  },
})

interface Props {
  group: PreviewGroup
  i18n: I18n
  /** 全局组件尺寸档位 */
  size: ComponentSize
}

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
 * 示例舞台：为受控示例持有本地值并回写 `update:modelValue`，使 v-model 在预览中真正可交互
 * （拖动 / 输入 / 点选都会反映到组件状态）。
 * 其余 props 每次渲染重新解析 —— 故切换全局尺寸档位即时生效，且不会覆盖用户已改的本地值。
 */
const PreviewStage = defineComponent({
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
      const componentProps: Record<string, any> = {
        ...resolvedProps.value,
      }

      if (isControlledComponent(stageProps.component)) {
        componentProps.modelValue = modelValue.value
        componentProps["onUpdate:modelValue"] = (value: unknown) => {
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

const props = defineProps<Props>()

/**
 * 示例实际渲染 props：组件支持 size 档位、且示例未显式指定 size 时注入全局档位；
 * 显式指定 size 的示例（尺寸对比用例）保持原样，避免标题与实际渲染不符。
 */
const resolveProps = (example: PreviewExample): Record<string, any> => {
  const base = example.props ?? {}
  if (!props.group.sizeable || base.size !== undefined) {
    return base
  }
  return {
    ...base,
    size: props.size,
  }
}

/** 当前展开代码的示例标题（同一分区同时只展开一个） */
const showCode = ref<string | null>(null)

const toggleCode = (title: string) => {
  showCode.value = showCode.value === title ? null : title
}
</script>

<style lang="scss">
@use '../styles/PreviewSection.scss';
@use '../styles/index.scss';
</style>
