<!-- 思考过程可折叠区块 -->
<template>
  <CollapsibleSection
    v-if="reasoningContent"
    :title="i18n.reasoningTitle"
    icon="sparkles"
    :open="showReasoning"
    :status-dot="isGenerating"
    @update:open="$emit('toggle')"
  >
    <div class="reasoning-content">{{ reasoningContent }}</div>
  </CollapsibleSection>
</template>

<script setup lang="ts">
import CollapsibleSection from "./CollapsibleSection.vue"

withDefaults(
  defineProps<{
    /** 国际化文案 */
    i18n: Record<string, string>
    reasoningContent?: string
    showReasoning?: boolean
    isGenerating: boolean
  }>(),
  {
    reasoningContent: "",
    showReasoning: false,
  },
)

defineEmits<{
  (e: "toggle"): void
}>()
</script>

<style scoped lang="scss">
@use "../styles/ReasoningSection.scss" as *;
@use "../styles/index.scss" as *;
</style>
