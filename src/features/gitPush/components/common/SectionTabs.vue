<!-- gitPush 视图内分区切换条（分段控件；提交分析 / 代码报告 / 统计中心共用） -->
<template>
  <div
    class="gp-sectiontabs"
    role="group"
    :aria-label="ariaLabel"
  >
    <Button
      v-for="tab in items"
      :key="tab.id"
      class="gp-sectiontab"
      variant="ghost"
      size="xsmall"
      dense
      :icon="tab.icon"
      :aria-pressed="modelValue === tab.id"
      :title="tab.hint"
      @click="modelValue = tab.id"
    >
      {{ tab.label }}
    </Button>
  </div>
</template>

<script setup lang="ts" generic="T extends string">
// 视图内分区切换条：收敛提交分析三视角、代码报告四分区与统计中心三视图的共同 Tab 结构。
// 语义采用「切换按钮组」而非 tablist：各分区面板未注册 tabpanel/aria-controls，
// 用 role=group + aria-pressed 如实表达，避免指向不存在节点的无效 ARIA 引用。
import type { SectionTabItem } from "./sectionTabs"
import Button from "@/components/Button.vue"

defineProps<{
  /** 分区项（label 已渲染为 i18n 文案；icon 受已注册 IconKey 约束） */
  items: SectionTabItem<T>[]
  /** 整组无障碍名称 */
  ariaLabel?: string
}>()

const modelValue = defineModel<T>({ required: true })
</script>

<style lang="scss">
@use "../../styles/SectionTabs.scss";
@use "../../styles/index.scss";
</style>
