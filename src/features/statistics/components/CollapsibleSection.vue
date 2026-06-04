<template>
  <div class="collapsible-section">
    <button
      class="collapse-header"
      @click="toggle"
    >
      <span class="collapse-icon">{{ expanded ? '▼' : '▶' }}</span>
      <span class="collapse-title">{{ title }}</span>
      <span
        v-if="badge"
        class="collapse-badge"
      >{{ badge }}</span>
    </button>
    <div
      v-if="expanded"
      class="collapse-body"
    >
      <slot />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue"

interface Props {
  title?: string
  badge?: string
  defaultExpanded?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: "",
  badge: "",
  defaultExpanded: false,
})

const expanded = ref(props.defaultExpanded)

function toggle() {
  expanded.value = !expanded.value
}
</script>

<style scoped lang="scss">
@use "@/variables" as *;
@use "../../superPanel/styles/shared" as *;
@use "../styles/index.scss" as stats;

.collapsible-section {
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  overflow: hidden;
  background: var(--b3-theme-surface);

  .collapse-header {
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    padding: 8px 12px;
    background: rgba(var(--b3-theme-primary-rgb), 0.03);
    border: none;
    cursor: pointer;
    font-family: $font-body;
    color: var(--b3-theme-on-surface);

    &:hover {
      background: rgba(var(--b3-theme-primary-rgb), 0.06);
    }
  }

  .collapse-icon {
    font-size: 9px;
    color: var(--b3-theme-primary);
    opacity: 0.7;
    transition: transform 0.2s;
  }

  .collapse-title {
    font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    color: var(--b3-theme-on-surface);
    opacity: 0.7;
  }

  .collapse-badge {
    margin-left: auto;
    font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
    font-size: 10px;
    font-weight: 700;
    color: var(--b3-theme-primary);
    opacity: 0.5;
  }

  .collapse-body {
    padding: 8px;
    border-top: 1px solid var(--b3-border-color);
  }
}
</style>
