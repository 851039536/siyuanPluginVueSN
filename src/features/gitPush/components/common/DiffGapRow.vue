<!--
  gitPush diff 折叠条：两个 hunk 之间被 git 省略的未变行。
  可展开时整条是按钮（点击向父层请求更大上下文的 diff），不可展开时退化为纯信息行。
-->
<template>
  <button
    type="button"
    class="wt-dl-gap-btn"
    :class="{ 'is-expandable': expandable }"
    :disabled="!expandable"
    :title="expandable ? i18n.diffGapExpand : undefined"
    @click="expandable && emit('expand')"
  >
    <span class="wt-dl-gap-text">{{ label }}</span>
    <span
      v-if="expandable"
      class="wt-dl-gap-cta"
    >{{ i18n.diffGapExpand }}</span>
  </button>
</template>

<script setup lang="ts">
import { computed } from "vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 被省略的未变行数 */
  count: number
  /** 是否可点击展开（到顶或宿主不支持时只作信息展示） */
  expandable: boolean
}>()

const emit = defineEmits<{
  expand: []
}>()

/** 折叠条文案（"⋯ N 行未变"） */
const label = computed(() => String(props.i18n.diffGapLines ?? "{0}").replace("{0}", String(props.count)))
</script>
