<!-- Git 推送/拉取操作输出面板（控制台风格） -->
<template>
  <div
    v-if="entries?.length"
    class="gp-output"
  >
    <div class="gp-output-scroll">
      <template
        v-for="entry in entries"
        :key="entry.platform"
      >
        <div
          class="gp-output-line"
          :class="{
            'gp-output-line--ok': entry.ok,
            'gp-output-line--fail': !entry.ok && !entry.skipped,
            'gp-output-line--skipped': entry.skipped,
          }"
        >
          <Icon
            v-if="entry.ok"
            icon="mdi:check"
            height="12"
          />
          <Icon
            v-else-if="entry.skipped"
            icon="mdi:minus"
            height="12"
          />
          <Icon
            v-else
            icon="mdi:close"
            height="12"
          />
          {{ entry.label }}
          │ {{ entry.duration }}ms
          │ {{ entry.summary }}
        </div>
        <pre
          v-if="entry.fullStdout"
          class="gp-output-stdout"
        >{{ entry.fullStdout.length > MAX_STDOUT_PREVIEW ? `${entry.fullStdout.slice(0, MAX_STDOUT_PREVIEW)}...` : entry.fullStdout }}</pre>
        <pre
          v-if="entry.fullStderr"
          class="gp-output-stderr"
        >{{ entry.fullStderr }}</pre>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PushOutputEntry } from "../composables/useGitOps"
import { Icon } from "@iconify/vue"

const MAX_STDOUT_PREVIEW = 500

defineProps<{
  entries: PushOutputEntry[]
}>()
</script>
