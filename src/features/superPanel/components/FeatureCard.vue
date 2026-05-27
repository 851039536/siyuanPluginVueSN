<template>
  <div
    class="feature-card"
    :class="{ 'feature-card--expandable': selectorOptions && selectorOptions.length > 0 }"
  >
    <div class="feature-icon">
      <IconWrapper
        :name="feature.iconKey"
        :size="16"
      />
    </div>
    <div class="feature-body">
      <div class="feature-info">
        <span class="feature-title">{{ feature.title }}</span>
        <span class="feature-desc">{{ feature.desc }}</span>
      </div>
      <div
        v-if="selectorOptions && selectorOptions.length > 0"
        class="feature-selector"
      >
        <button
          v-for="opt in selectorOptions"
          :key="opt.value"
          class="theme-chip"
          :class="{ active: selectedOption === opt.value }"
          :style="{ '--chip-color': opt.color }"
          :aria-pressed="selectedOption === opt.value"
          @click.stop="emit('select', opt.value)"
        >
          <span
            class="theme-chip-dot"
            :style="{ backgroundColor: opt.color }"
          />
          {{ opt.label }}
        </button>
      </div>
    </div>
    <div class="feature-right">
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
      <Switch
        v-if="showToggle"
        :model-value="enabled"
        size="small"
        @update:model-value="emit('toggle', $event)"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Feature } from "../types"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Switch from "@/components/Switch.vue"

export interface SelectorOption {
  value: string
  label: string
  color: string
}

interface Props {
  feature: Feature
  enabled?: boolean
  showToggle?: boolean
  selectorOptions?: SelectorOption[]
  selectedOption?: string
}

interface Emits {
  (e: "action", action: string): void
  (e: "toggle", value: boolean): void
  (e: "select", value: string): void
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const handleAction = (actionKey: string) => {
  emit("action", actionKey)
}
</script>
