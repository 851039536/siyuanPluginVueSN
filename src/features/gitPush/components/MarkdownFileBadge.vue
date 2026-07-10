<!-- gitPush Markdown 文件标识徽章 — 显示在 ProjectCard 路径行下方 -->
<template>
  <button
    class="gp-md-badge"
    :class="`gp-md-badge--${variant}`"
    :title="`预览 ${filename}`"
    @click.stop="$emit('select')"
  >
    <Icon
      icon="mdi:file-document-outline"
      height="10"
    />
    <span class="gp-md-badge-label">{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
import type { MdFileVariant } from "../composables/useMarkdownFiles"
import { Icon } from "@iconify/vue"

defineProps<{
  filename: string
  label: string
  variant: MdFileVariant
}>()

defineEmits<{
  select: []
}>()
</script>

<style lang="scss" scoped>
@use "../styles/variables" as *;

.gp-md-badge {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 6px;
  font-size: 9px;
  font-family: $vp-mono;
  font-weight: $font-weight-semibold;
  letter-spacing: 0.03em;
  line-height: 1.4;
  border: 1px solid transparent;
  border-radius: $radius-sm;
  background: none;
  cursor: pointer;
  color: var(--b3-theme-on-surface);
  transition: background 0.12s, border-color 0.12s, color 0.12s;

  &:hover {
    background: var(--b3-list-hover);
  }

  &--readme {
    color: var(--b3-theme-primary);
    border-color: var(--b3-theme-primary-lightest);

    &:hover {
      border-color: var(--b3-theme-primary);
      background: var(--b3-theme-primary-lightest);
    }
  }

  &--agents {
    color: #ea580c;
    border-color: color-mix(in srgb, #ea580c 30%, transparent);

    &:hover {
      background: color-mix(in srgb, #ea580c 10%, transparent);
      border-color: #ea580c;
    }
  }

  &--claude {
    color: #7c3aed;
    border-color: color-mix(in srgb, #7c3aed 30%, transparent);

    &:hover {
      background: color-mix(in srgb, #7c3aed 10%, transparent);
      border-color: #7c3aed;
    }
  }

  &--codebuddy {
    color: #0891b2;
    border-color: color-mix(in srgb, #0891b2 30%, transparent);

    &:hover {
      background: color-mix(in srgb, #0891b2 10%, transparent);
      border-color: #0891b2;
    }
  }

  &--other {
    opacity: 0.6;

    &:hover {
      opacity: 1;
    }
  }
}

.gp-md-badge-label {
  white-space: nowrap;
}
</style>
