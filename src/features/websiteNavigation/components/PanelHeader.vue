<template>
  <div class="panel-header">
    <div class="header-title">
      <IconWrapper
        name="browser"
        :size="20"
      />
      <h2>{{ i18n.panelTitle || '网站导航' }}</h2>
      <span class="entry-count">{{ count }}/{{ totalCount }}</span>
    </div>
    <div class="header-actions">
      <Button
        icon="add"
        variant="primary"
        size="small"
        @click="emit('add')"
      >
        {{ i18n.addWebsite || '添加网站' }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { I18n } from "../types"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"

defineProps<{
  i18n: I18n
  count: number
  totalCount: number
}>()

const emit = defineEmits<{
  (e: "add"): void
}>()
</script>
