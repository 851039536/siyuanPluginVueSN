<!-- 思考过程可折叠区块 -->
<template>
  <CollapsibleSection
    v-if="reasoningContent"
    title="思考过程"
    icon="#iconSparkles"
    :open="showReasoning"
    :status-dot="isGenerating"
    @update:open="$emit('toggle')"
  >
    <div class="reasoning-content">{{ reasoningContent }}</div>
  </CollapsibleSection>
</template>

<script setup lang="ts">
import CollapsibleSection from "./CollapsibleSection.vue"

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
