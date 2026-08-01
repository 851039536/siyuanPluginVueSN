<!-- gitPush 通用「加载更多」按钮（消除 CommitAnalysisPanel / LogPanel 两处重复） -->
<template>
  <div class="gp-load-more">
    <!-- 按钮文案："加载更多 (可见/总数)" -->
    <button
      class="vp-btn vp-btn--ghost vp-btn--sm"
      @click="emit('loadMore')"
    >
      {{ i18n.loadMoreLogs }} ({{ visible }} / {{ total }})
    </button>
  </div>
</template>

<script setup lang="ts">
defineProps<{
  i18n: Record<string, any>
  visible: number
  total: number
}>()

const emit = defineEmits<{
  loadMore: []
}>()
</script>
