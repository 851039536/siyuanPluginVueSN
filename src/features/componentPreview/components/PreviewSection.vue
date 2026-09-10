<!-- 组件预览 — 单个组件分区：组件名 + 说明 + 快照卡片网格（真实组件渲染 + 可复制代码） -->
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
          :class="{ 'cp-card__stage--loader': group.id === 'loader' }"
        >
          <component
            :is="group.component"
            v-bind="resolveProps(example)"
          >
            <!-- 默认插槽示例文本 -->
            <template v-if="example.slotText">{{ example.slotText }}</template>
          </component>
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
import {
  ref,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import type {
  ComponentSize,
  I18n,
  PreviewExample,
  PreviewGroup,
} from "../types"
import CodeBlock from "./CodeBlock.vue"

interface Props {
  group: PreviewGroup
  i18n: I18n
  /** 全局组件尺寸档位 */
  size: ComponentSize
}

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
