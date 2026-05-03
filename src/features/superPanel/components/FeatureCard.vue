<template>
  <div
    class="feature-card"
    :class="{ enabled: feature.enabled, disabled: !feature.enabled }"
    @click="handleCardClick"
  >
    <div class="feature-icon">
      <IconWrapper :name="feature.iconKey" :size="16" />
    </div>
    <div class="feature-info">
      <span class="feature-title">{{ feature.title }}</span>
      <span class="feature-desc">{{ feature.desc }}</span>
    </div>
    <div v-if="feature.actions.length > 0 && feature.enabled" class="feature-actions">
      <Button
        v-for="action in feature.actions"
        :key="action.key"
        variant="ghost"
        size="small"
        @click.stop="handleAction(action.key)"
      >
        {{ action.label }}
        <span v-if="action.hotkey" class="action-hotkey">{{ action.hotkey }}</span>
      </Button>
    </div>
    <div class="feature-toggle" @click.stop>
      <Switch
        :model-value="feature.enabled"
        size="small"
        @update:model-value="handleToggle"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { showMessage } from "siyuan";
import IconWrapper from "@/components/IconWrapper.vue";
import Switch from "@/components/Switch.vue";
import Button from "@/components/Button.vue";
import type { Feature } from "../types";

interface Props {
  feature: Feature;
  i18n: any;
}

interface Emits {
  (e: "action", action: string): void;
  (e: "toggle", featureId: string, enabled: boolean): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

const handleCardClick = () => {
  if (!props.feature.enabled) {
    showMessage(props.i18n.featureDisabled || "该功能未启用", 2000, "info");
  }
};

const handleToggle = (newValue: boolean) => {
  emit("toggle", props.feature.id, newValue);
};

const handleAction = (actionKey: string) => {
  emit("action", actionKey);
};
</script>
