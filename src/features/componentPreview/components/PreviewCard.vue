<!-- 组件预览 — 单张示例卡：舞台（真实组件渲染）+ 示例名 + 代码切换 + 可复制代码 -->
<template>
  <div
    class="cp-card"
    :class="{ 'cp-card--wide': wide }"
  >
    <div
      class="cp-card__stage"
      :class="stageClasses"
    >
      <!-- 受控示例由 PreviewStage 持有本地值，使 v-model 在预览中真正可交互 -->
      <PreviewStage
        :component="group.component"
        :component-props="resolvedProps"
        :has-slot="!!example.render || !!example.slotText"
        :named-slots="example.slots"
      >
        <!-- 复合示例：默认插槽需放多个子组件，交由 render 函数组装 -->
        <SlotRenderer
          v-if="example.render"
          :render="example.render"
          :example-props="resolvedProps"
        />
        <!-- 默认插槽示例文本 -->
        <template v-else-if="example.slotText">{{ example.slotText }}</template>
      </PreviewStage>
    </div>
    <footer class="cp-card__foot">
      <!-- 标题可能被省略号截断，悬浮看全文 -->
      <span
        class="cp-card__title"
        :title="example.title"
      >{{ example.title }}</span>
      <!-- 查看 / 收起代码：纯图标走共享 Button（icon-only 必须给 ariaLabel） -->
      <Button
        size="xsmall"
        variant="ghost"
        text
        :icon="codeOpen ? 'chevronUp' : 'code'"
        :ariaLabel="codeOpen ? i18n.hideCode : i18n.viewCode"
        :title="codeOpen ? i18n.hideCode : i18n.viewCode"
        @click="emit('toggle-code', example.title)"
      />
    </footer>
    <CodeBlock
      v-if="codeOpen"
      :code="example.code"
      :i18n="i18n"
    />
  </div>
</template>

<script setup lang="ts">
import type {
  PropType,
  VNode,
} from "vue"
import {
  computed,
  defineComponent,
} from "vue"
import Button from "@/components/Button.vue"
import type {
  ComponentSize,
  I18n,
  PreviewExample,
  PreviewGroup,
} from "../types"
import CodeBlock from "./CodeBlock.vue"
import PreviewStage from "./PreviewStage"

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
  example: PreviewExample
  i18n: I18n
  /** 全局组件尺寸档位 */
  size: ComponentSize
  /** 该分区的舞台修饰类（由分区登记表给出，可叠加） */
  stageClasses?: string[]
  /** 是否跨两列（宽舞台分区） */
  wide?: boolean
  /** 本示例的代码块是否展开（同一分区同时只展开一个，状态由分区持有） */
  codeOpen?: boolean
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "toggle-code", title: string): void
}>()

/**
 * 示例实际渲染 props：组件支持 size 档位、且示例未显式指定 size 时注入全局档位。
 * 面板头部的 XS / S / M / L 切换是唯一的尺寸演示入口（各分区不再单设「尺寸」示例卡）；
 * 兜底分支保留 —— 将来若有示例显式声明 size，保持原样以免标题与实际渲染不符。
 *
 * ⚠️ 用 computed 缓存结果：组件本体与复合示例 render 共用**同一个** props 对象，
 * 避免模板里重复解析（每次渲染都新建对象）带来的无谓分配与子组件更新。
 */
const resolvedProps = computed<Record<string, any>>(() => {
  const base = props.example.props ?? {}
  if (!props.group.sizeable || base.size !== undefined) {
    return base
  }
  return {
    ...base,
    size: props.size,
  }
})
</script>

<style lang="scss">
// 面板级样式（styles/index.scss）由根组件 index.vue 统一引入，卡片不再重复引入
@use '../styles/PreviewCard.scss';
</style>
