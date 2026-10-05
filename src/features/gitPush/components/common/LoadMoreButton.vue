<!-- gitPush 通用「加载更多」按钮（消除 CommitAnalysisPanel / LogPanel 两处重复） -->
<template>
  <div class="gp-load-more">
    <!-- 按钮文案："加载更多 (可见/总数)"；共享 Button（ghost + xsmall + dense，视觉以文字为主） -->
    <Button
      variant="ghost"
      size="xsmall"
      dense
      @click="emit('loadMore')"
    >
      {{ i18n.loadMoreLogs }} ({{ visible }} / {{ total }})
    </Button>
  </div>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue"

defineProps<{
  i18n: Record<string, any>
  visible: number
  total: number
}>()

const emit = defineEmits<{
  loadMore: []
}>()
</script>
