<!-- 组件预览 — 单个组件分区：组件名 + 说明 + 卡片网格（真实组件渲染，受控组件可交互 + 可复制代码） -->
<template>
  <section
    :id="`cp-group-${group.id}`"
    :data-cp-group="group.id"
    class="cp-section"
  >
    <header class="cp-section__head">
      <span class="cp-section__name">{{ group.name }}</span>
      <!-- 摘要可能很长（含机制告警），最多两行 + 悬浮看全文 -->
      <span
        class="cp-section__summary"
        :title="group.summary"
      >{{ group.summary }}</span>
    </header>
    <!-- 组件 import 示例（可复制） -->
    <div class="cp-section__import">
      <CodeBlock
        :code="group.importCode"
        :i18n="i18n"
      />
    </div>

    <!-- 懒挂载：active 由父级的 IntersectionObserver 控制，远区卸载时不实例化任何示例 -->
    <div
      v-if="active"
      class="cp-section__grid"
    >
      <!-- 单张示例卡独立成组件：props 每帧只解析一次，且受控值不再随分区重渲染而重建 -->
      <PreviewCard
        v-for="example in group.examples"
        :key="example.title"
        :group="group"
        :example="example"
        :i18n="i18n"
        :size="size"
        :stage-classes="STAGE_CLASS_BY_GROUP[group.id]"
        :wide="isWideStage(group.id)"
        :code-open="showCode === example.title"
        @toggle-code="toggleCode"
      />
    </div>
    <!-- 卸载后的高度占位：用实测高度撑住，避免滚动位置跳动（读屏忽略） -->
    <div
      v-else
      class="cp-section__placeholder"
      :style="placeholderHeight ? { height: `${placeholderHeight}px` } : undefined"
      aria-hidden="true"
    />
  </section>
</template>

<script setup lang="ts">
import {
  ref,
} from "vue"
import type {
  ComponentSize,
  I18n,
  PreviewGroup,
} from "../types"
import CodeBlock from "./CodeBlock.vue"
import PreviewCard from "./PreviewCard.vue"

/**
 * 分区 → 舞台修饰类（**可叠加**，数组可按需组合「高度特例 + 布局分档」）。
 * 高度值与布局规则仍写在 SCSS，这里只做登记：新增此类分区只改这一处。
 *
 * 分档依据（组件根元素的宽度 / 高度特性，2026-09-12 逐区核对）：
 * - `--compact`：原子控件内容仅 20~44px 高，用 64px 舞台
 * - `--fill`：根元素无 width（会被舞台行 flex 收缩成内容宽）⇒ 满宽 + 顶对齐
 * - `--top`：内容高度随示例变化 ⇒ 顶对齐，避免上边距随机漂移
 * - `--chart`：Chart 默认档 200×150 ⇒ 需要更高舞台
 */
const STAGE_CLASS_BY_GROUP: Record<string, string[]> = {
  // 高度 / 沙箱特例（既有）
  loader: ["cp-card__stage--loader"],
  speedDial: ["cp-card__stage--speeddial"],
  dialog: ["cp-card__stage--dialog"],
  drawer: ["cp-card__stage--drawer"],
  megaMenu: ["cp-card__stage--megaMenu"],
  tieredMenu: ["cp-card__stage--tieredMenu"],
  toast: ["cp-card__stage--toast"],
  // 紧凑舞台：矮控件
  button: ["cp-card__stage--compact"],
  iconWrapper: ["cp-card__stage--compact"],
  toggleButton: ["cp-card__stage--compact"],
  tag: ["cp-card__stage--compact"],
  badge: ["cp-card__stage--compact"],
  avatar: ["cp-card__stage--compact"],
  switch: ["cp-card__stage--compact"],
  checkbox: ["cp-card__stage--compact"],
  radioButton: ["cp-card__stage--compact"],
  label: ["cp-card__stage--compact"],
  divider: ["cp-card__stage--compact"],
  // 满宽容器类（根元素无 width）
  card: ["cp-card__stage--fill"],
  panel: ["cp-card__stage--fill"],
  message: ["cp-card__stage--fill"],
  paginator: ["cp-card__stage--fill"],
  // MeterGroup：根元素 width: 100% ⇒ 满宽；且纵向示例的竖条需高舞台（同 loader 的 `--meterGroup`）
  meterGroup: ["cp-card__stage--fill", "cp-card__stage--meterGroup"],
  // 顶对齐：内容高度多变
  timeline: ["cp-card__stage--top"],
  tabs: ["cp-card__stage--top"],
  fileUpload: ["cp-card__stage--top"],
  listbox: ["cp-card__stage--top"],
  splitter: ["cp-card__stage--top"],
  // 图表：需要更高的舞台
  chart: ["cp-card__stage--chart"],
}

/** 需要横向空间的分区：卡片跨两列（展开面板 / 三段结构 / 长分页条 / 图表） */
const WIDE_STAGE_GROUP_IDS: readonly string[] = [
  "dialog",
  "drawer",
  "megaMenu",
  "tieredMenu",
  "toolbar",
  "paginator",
]

/** 卡片是否需要跨列（宽舞台浮层给展开留出横向空间） */
const isWideStage = (groupId: string): boolean => WIDE_STAGE_GROUP_IDS.includes(groupId)

interface Props {
  group: PreviewGroup
  i18n: I18n
  /** 全局组件尺寸档位 */
  size: ComponentSize
  /** 是否实例化本节区的示例卡片（懒挂载，由父级 IntersectionObserver 控制） */
  active?: boolean
  /** 卸载后的占位高度（px，父级记录的网格实测高度） */
  placeholderHeight?: number
}

const props = defineProps<Props>()

/** 当前展开代码的示例标题（同一分区同时只展开一个） */
const showCode = ref<string | null>(null)

const toggleCode = (title: string) => {
  showCode.value = showCode.value === title ? null : title
}
</script>

<style lang="scss">
// 面板级样式（styles/index.scss）由根组件 index.vue 统一引入，子组件不再重复引入
@use '../styles/PreviewSection.scss';
</style>
