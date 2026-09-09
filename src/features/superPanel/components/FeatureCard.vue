<!-- 超级面板功能卡片：开关、主题选择与快捷操作 -->
<template>
  <div
    class="feature-card"
    :class="{ 'feature-card--expandable': selectorOptions && selectorOptions.length > 0 }"
  >
    <div class="feature-body">
      <div class="feature-header">
        <div class="feature-icon">
          <IconWrapper
            :name="feature.iconKey"
            :size="12"
          />
        </div>
        <div class="feature-info">
          <span class="feature-title">{{ feature.title }}</span>
        </div>
        <div
          v-if="feature.actions.length > 0"
          class="feature-header-actions"
        >
          <Button
            v-for="action in feature.actions"
            :key="action.key"
            variant="ghost"
            size="xsmall"
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
          size="xsmall"
          class="feature-toggle"
          @update:model-value="emit('toggle', $event)"
        />
      </div>
      <span class="feature-desc">{{ feature.desc }}</span>
      <div
        v-if="feature.subFeatures?.length"
        class="feature-sub-features"
      >
        <div
          v-for="sub in feature.subFeatures"
          :key="sub.id"
          class="sub-feature-item"
        >
          <div class="sub-feature-icon">
            <Icon
              :icon="sub.icon"
              :size="10"
              :style="{ color: sub.color }"
            />
          </div>
          <span class="sub-feature-label">{{ sub.label }}</span>
          <Switch
            :model-value="sub.enabled"
            size="xsmall"
            class="sub-feature-toggle"
            @update:model-value="emit('toggleSubFeature', sub.id)"
          />
        </div>
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
      <div
        v-if="colorValue !== undefined"
        class="feature-color-input"
      >
        <span class="feature-color-label">{{ colorLabel || '' }}</span>
        <input
          type="color"
          :value="colorValue"
          @input="onColorInput"
        >
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Feature } from "../types"
import { Icon } from "@iconify/vue"
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
  colorValue?: string
  colorLabel?: string
}

interface Emits {
  (e: "action", action: string): void
  (e: "toggle", value: boolean): void
  (e: "select", value: string): void
  (e: "toggleSubFeature", featureId: string): void
  (e: "colorChange", value: string): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const handleAction = (actionKey: string): void => {
  emit("action", actionKey)
}

const onColorInput = (event: Event): void => {
  const input = event.target as HTMLInputElement
  emit("colorChange", input.value)
}
</script>
