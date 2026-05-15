<template>
  <div class="feature-card">
    <div class="feature-icon">
      <IconWrapper
        :name="feature.iconKey"
        :size="16"
      />
    </div>
    <div class="feature-info">
      <span class="feature-title">{{ feature.title }}</span>
      <span class="feature-desc">{{ feature.desc }}</span>
    </div>
    <div
      v-if="feature.actions.length > 0"
      class="feature-actions"
    >
      <Button
        v-for="action in feature.actions"
        :key="action.key"
        variant="ghost"
        size="small"
        @click.stop="handleAction(action.key)"
      >
        {{ action.label }}
        <span
          v-if="action.hotkey"
          class="action-hotkey"
        >{{ action.hotkey }}</span>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Feature } from "../types"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"

interface Props {
  feature: Feature
}

interface Emits {
  (e: "action", action: string): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const handleAction = (actionKey: string) => {
  emit("action", actionKey)
}
</script>
