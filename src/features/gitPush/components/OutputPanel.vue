<!-- Git 推送/拉取操作输出面板 -->
<template>
  <div
    v-if="entries?.length"
    class="gp-output"
  >
    <button
      class="gp-output-copy"
      :title="i18n.copy || '复制'"
      @click="$emit('copy', copyText)"
    >
      <Icon
        icon="mdi:content-copy"
        height="12"
      />
    </button>
    <div class="gp-output-list">
      <div
        v-for="entry in entries"
        :key="entry.platform"
        class="gp-output-item"
      >
        <span
          class="gp-output-status"
          :class="{
            'gp-output-status--ok': entry.ok,
            'gp-output-status--fail': !entry.ok && !entry.skipped,
            'gp-output-status--skipped': entry.skipped,
          }"
        >
          <Icon v-if="entry.ok" icon="mdi:check" height="14" />
          <Icon v-else-if="entry.skipped" icon="mdi:minus" height="14" />
          <Icon v-else icon="mdi:close" height="14" />
        </span>
        <span class="gp-output-label">{{ entry.label }}</span>
        <span class="gp-output-duration">{{ entry.duration }}ms</span>
        <span class="gp-output-summary">{{ entry.summary }}</span>
        <details
          v-if="entry.fullStdout || entry.fullStderr"
          class="gp-output-details"
        >
          <summary>详情</summary>
          <pre
            v-if="entry.fullStdout"
            class="gp-output-stdout"
          >{{ entry.fullStdout.length > MAX_STDOUT_PREVIEW ? `${entry.fullStdout.slice(0, MAX_STDOUT_PREVIEW)}...` : entry.fullStdout }}</pre>
          <pre
            v-if="entry.fullStderr"
            class="gp-output-stderr"
          >{{ entry.fullStderr }}</pre>
        </details>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PushOutputEntry } from "../composables/useGitOps"
import { Icon } from "@iconify/vue"

const MAX_STDOUT_PREVIEW = 500

defineProps<{
  entries: PushOutputEntry[]
  copyText: string
  i18n: Record<string, any>
}>()

defineEmits<{
  copy: [text: string]
}>()
</script>
