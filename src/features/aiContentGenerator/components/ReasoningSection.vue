<!-- 思考过程可折叠区块 -->
<template>
  <div
    v-if="reasoningContent"
    class="reasoning-section"
  >
    <button
      class="reasoning-toggle"
      @click="$emit('toggle')"
    >
      <svg
        width="12"
        height="12"
        class="reasoning-chevron"
        :class="{ expanded: showReasoning }"
      >
        <use xlink:href="#iconRight"></use>
      </svg>
      <svg
        width="14"
        height="14"
      ><use xlink:href="#iconSparkles"></use></svg>
      <span>思考过程</span>
      <span
        v-if="isGenerating"
        class="reasoning-dot"
      ></span>
    </button>
    <div
      v-if="showReasoning"
      class="reasoning-content"
    >{{ reasoningContent }}</div>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  reasoningContent?: string
  showReasoning?: boolean
  isGenerating: boolean
}>()

defineEmits<{
  (e: "toggle"): void
}>()
</script>

<style scoped lang="scss">
@use "../styles/ReasoningSection.scss" as *;
@use "../styles/index.scss" as *;
</style>
