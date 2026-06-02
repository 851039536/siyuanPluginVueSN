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
        <span class="status-badge-wrapper">
          <span
            ref="statusBadgeRef"
            class="status-badge"
            :class="feature.status ? `status-${feature.status}` : ''"
            title="点击选择状态"
            @click.stop="toggleStatusMenu"
          >{{ feature.status ? statusLabels?.[feature.status] || feature.status : '+' }}</span>
          <Transition name="status-popover">
            <div
              v-if="showStatusMenu"
              class="status-popover"
              @click.stop
            >
              <button
                v-for="opt in statusOptions"
                :key="opt.value"
                class="status-option"
                :class="{ active: feature.status === opt.value }"
                @click="selectStatus(opt.value)"
              >
                <span
                  v-if="opt.value"
                  class="status-option-dot"
                  :class="`status-${opt.value}`"
                />
                {{ opt.label }}
              </button>
            </div>
          </Transition>
        </span>
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
import type {
  Feature,
  FeatureStatus,
} from "../types"
import {
  computed,
  onBeforeUnmount,
  ref,
  watch,
} from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Switch from "@/components/Switch.vue"
import { FEATURE_STATUSES } from "../types"

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
  statusLabels?: Record<string, string>
}

interface Emits {
  (e: "action", action: string): void
  (e: "toggle", value: boolean): void
  (e: "select", value: string): void
  (e: "statusChange", status: FeatureStatus): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const statusBadgeRef = ref<HTMLElement | null>(null)
const showStatusMenu = ref(false)

const statusOptions = computed(() => [
  ...FEATURE_STATUSES.map((v) => ({
    value: v,
    label: props.statusLabels?.[v] || v,
  })),
  {
    value: "",
    label: "清空",
  },
])

const toggleStatusMenu = (): void => {
  showStatusMenu.value = !showStatusMenu.value
}

const selectStatus = (status: FeatureStatus): void => {
  emit("statusChange", status)
  showStatusMenu.value = false
}

let clickOutsideHandler: ((e: MouseEvent) => void) | null = null

watch(showStatusMenu, (open) => {
  if (open) {
    clickOutsideHandler = (e: MouseEvent) => {
      if (statusBadgeRef.value && !statusBadgeRef.value.contains(e.target as Node)) {
        showStatusMenu.value = false
      }
    }
    document.addEventListener("click", clickOutsideHandler, true)
  } else {
    if (clickOutsideHandler) {
      document.removeEventListener("click", clickOutsideHandler, true)
      clickOutsideHandler = null
    }
  }
})

onBeforeUnmount(() => {
  if (clickOutsideHandler) {
    document.removeEventListener("click", clickOutsideHandler, true)
    clickOutsideHandler = null
  }
})

const handleAction = (actionKey: string): void => {
  emit("action", actionKey)
}
</script>
