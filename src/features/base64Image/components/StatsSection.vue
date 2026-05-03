<template>
  <div v-if="originalSize > 0" class="stats-section">
    <h4>{{ title }}</h4>
    <div class="stats-grid">
      <div class="stat-item">
        <span class="stat-label">{{ originalLabel }}</span>
        <span class="stat-value">{{ formatFileSize(originalSize) }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">{{ outputLabel }}</span>
        <span class="stat-value">{{ formatFileSize(outputSize) }}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">{{ ratioLabel }}</span>
        <span class="stat-value" :class="ratioClass">{{ ratio }}%</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

interface Props {
  title: string;
  originalLabel: string;
  outputLabel: string;
  ratioLabel: string;
  originalSize: number;
  outputSize: number;
}

const props = defineProps<Props>();

const ratio = computed(() => {
  if (props.originalSize === 0) return 0;
  return Math.round((1 - props.outputSize / props.originalSize) * 100);
});

const ratioClass = computed(() => {
  const r = ratio.value;
  if (r > 0) return "positive";
  if (r < 0) return "negative";
  return "neutral";
});

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + " " + sizes[i];
};
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
