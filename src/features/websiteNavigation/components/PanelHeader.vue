<!--
  网站导航面板头部 — 标题 + 条目计数 + 添加按钮
-->
<template>
  <div class="panel-header">
    <div class="header-title">
      <IconWrapper
        name="browser"
        :size="20"
      />
      <h2>{{ i18n.panelTitle }}</h2>
      <span class="entry-count">{{ count }}/{{ totalCount }}</span>
    </div>
    <div class="header-actions">
      <Button
        icon="add"
        variant="primary"
        size="xsmall"
        :title="i18n.addWebsite"
        @click="emit('add')"
      />
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
