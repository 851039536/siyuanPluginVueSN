<!-- 克隆日志面板：实时滚动显示 git clone --progress 输出（编辑弹窗仓库链接区下方） -->
<template>
  <div
    v-if="lines.length"
    class="gp-clone-log"
  >
    <div class="gp-clone-log-header">
      <Icon
        :icon="running ? 'mdi:loading' : 'mdi:console'"
        :class="{ 'gp-spin': running }"
        height="12"
      />
      <!-- 面板标题："克隆日志" -->
      <span>{{ i18n.cloneLogTitle }}</span>
      <!-- 关闭按钮（克隆进行中隐藏，完成后可清空面板） -->
      <button
        v-if="!running"
        class="vp-btn vp-btn--ghost vp-btn--sm gp-clone-log-close"
        @click="$emit('clear')"
      >
        <Icon icon="mdi:close" height="12" />
      </button>
    </div>
    <div
      ref="bodyRef"
      class="gp-clone-log-body"
    >
      <div
        v-for="(line, i) in lines"
        :key="i"
        class="gp-clone-log-line"
      >
        {{ line }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import { nextTick, ref, watch } from "vue"

const props = defineProps<{
  lines: string[]
  running: boolean
  i18n: Record<string, any>
}>()

defineEmits<{
  clear: []
}>()

const bodyRef = ref<HTMLElement | null>(null)

// 日志内容变化后自动滚动到底部（进度行原地刷新也触发）
watch(() => props.lines, async () => {
  await nextTick()
  if (bodyRef.value) {
    bodyRef.value.scrollTop = bodyRef.value.scrollHeight
  }
}, { deep: true })
</script>
