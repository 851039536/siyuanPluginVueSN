<!-- API 调试器 Dock 面板根组件 — 预设端点、请求发送、响应与历史 -->
<template>
  <div class="api-debugger">
    <!-- Endpoint Selection -->
    <div class="api-debugger__section">
      <div class="api-debugger__section-title">
        {{ i18n.endpoint }}
      </div>
      <Select
        :model-value="path"
        :options="endpointGroups"
        :placeholder="i18n.endpointPlaceholder"
        filterable
        size="xsmall"
        :max-height="420"
        @update:model-value="handleEndpointChange"
      />
    </div>

    <!-- Method + Path -->
    <div class="api-debugger__section">
      <div class="api-debugger__row">
        <div class="api-debugger__method-select">
          <Select
            :model-value="method"
            :options="methodOptions"
            size="xsmall"
            @update:model-value="handleMethodChange"
          />
        </div>
        <div class="api-debugger__path-input">
          <Input
            v-model="path"
            :placeholder="i18n.pathPlaceholder"
            size="xsmall"
          />
        </div>
      </div>
    </div>

    <!-- Custom Headers -->
    <div class="api-debugger__section">
      <div class="api-debugger__section-title">
        {{ i18n.customHeaders }}
      </div>
      <div
        v-for="(header, index) in customHeaders"
        :key="index"
        class="api-debugger__header-row"
      >
        <div class="api-debugger__header-input">
          <Input
            v-model="header.key"
            :placeholder="i18n.headerKey"
            size="xsmall"
          />
        </div>
        <div class="api-debugger__header-input">
          <Input
            v-model="header.value"
            :placeholder="i18n.headerValue"
            size="xsmall"
          />
        </div>
        <div class="api-debugger__header-remove">
          <Button
            variant="ghost"
            size="xsmall"
            icon="close"
            @click="removeHeader(index)"
          />
        </div>
      </div>
      <Button
        variant="ghost"
        size="xsmall"
        icon="plus"
        @click="addHeader"
      >
        {{ i18n.addHeader }}
      </Button>
    </div>

    <!-- Request Body -->
    <div class="api-debugger__section">
      <div class="api-debugger__section-title">
        {{ i18n.requestBody }}
      </div>
      <Textarea
        v-model="requestBody"
        :placeholder="i18n.requestBodyPlaceholder"
        :rows="6"
        size="xsmall"
        resize="vertical"
      />
    </div>

    <!-- Actions -->
    <div class="api-debugger__actions">
      <Button
        variant="primary"
        size="xsmall"
        icon="send"
        :loading="loading"
        @click="sendRequest"
      >
        {{ loading ? i18n.loading : i18n.send }}
      </Button>
      <Button
        variant="ghost"
        size="xsmall"
        icon="eraser"
        @click="clearRequest"
      >
        {{ i18n.clear }}
      </Button>
    </div>

    <!-- Tabs -->
    <div class="api-debugger__tabs">
      <Button
        v-for="tab in responseTabs"
        :key="tab.id"
        :variant="activeTab === tab.id ? 'primary' : 'ghost'"
        text
        size="xsmall"
        :aria-pressed="activeTab === tab.id"
        @click="activeTab = tab.id"
      >
        {{ tab.label }}
        <span v-if="tab.id === 'history' && history.length">({{ history.length }})</span>
      </Button>
    </div>

    <!-- Response Tab -->
    <div
      v-if="activeTab === 'response'"
      class="api-debugger__section"
    >
      <template v-if="errorMessage && !responseBody">
        <div class="api-debugger__error-msg">
          {{ errorMessage }}
        </div>
      </template>
      <template v-else-if="statusCode !== null">
        <div class="api-debugger__response-meta">
          <span
            class="api-debugger__status-badge"
            :class="statusCode >= 200 && statusCode < 300 ? 'api-debugger__status-badge--success' : 'api-debugger__status-badge--error'"
          >
            {{ statusCode }}
          </span>
          <span class="api-debugger__response-time">
            {{ responseTime }}{{ i18n.ms }}
          </span>
          <div class="api-debugger__response-spacer" />
          <Button
            variant="ghost"
            size="xsmall"
            icon="copy"
            @click="handleCopyResponse"
          >
            {{ i18n.copyResponse }}
          </Button>
        </div>
        <div class="api-debugger__response-body">
          <code v-html="highlightedResponse" />
        </div>
      </template>
      <template v-else>
        <div class="api-debugger__empty">
          {{ i18n.noEndpoint }}
        </div>
      </template>
    </div>

    <!-- History Tab -->
    <div
      v-if="activeTab === 'history'"
      class="api-debugger__section"
    >
      <div
        v-if="history.length > 0"
        class="api-debugger__history-actions"
      >
        <Button
          variant="ghost"
          size="xsmall"
          icon="delete"
          @click="clearHistory"
        >
          {{ i18n.clearHistory }}
        </Button>
      </div>
      <div
        v-if="history.length > 0"
        class="api-debugger__history-list"
      >
        <div
          v-for="record in history"
          :key="record.id"
          class="api-debugger__history-item"
          @click="replayRecord(record)"
        >
          <span
            class="api-debugger__history-method"
            :class="`api-debugger__history-method--${record.method}`"
          >
            {{ record.method }}
          </span>
          <span class="api-debugger__history-path">
            {{ record.path }}
          </span>
          <span
            class="api-debugger__history-status"
            :class="record.success ? 'api-debugger__history-status--success' : 'api-debugger__history-status--error'"
          >
            {{ record.statusCode }}
          </span>
          <span class="api-debugger__history-time">
            {{ record.responseTime }}ms
          </span>
          <span class="api-debugger__history-time">
            {{ formatTimestamp(record.timestamp) }}
          </span>
        </div>
      </div>
      <div
        v-else
        class="api-debugger__empty"
      >
        {{ i18n.noHistory }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type {
  ApiDebuggerI18n,
  ApiEndpointPreset,
} from "./types"
import type {
  SelectGroupOption,
  SelectOption,
} from "@/components/Select.vue"
import { showMessage } from "siyuan"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"
import Textarea from "@/components/Textarea.vue"
import { copyToClipboard } from "@/utils/domUtils"
import { useApiDebugger } from "./composables/useApiDebugger"
import {
  API_ENDPOINT_PRESETS,
  HTTP_METHODS,
} from "./types"

interface Props {
  i18n: ApiDebuggerI18n
  plugin: Plugin
}

const props = defineProps<Props>()

const {
  method,
  path,
  requestBody,
  customHeaders,
  loading,
  activeTab,
  statusCode,
  responseBody,
  responseTime,
  errorMessage,
  history,
  selectEndpoint,
  addHeader,
  removeHeader,
  clearRequest,
  sendRequest,
  replayRecord,
  clearHistory,
  syntaxHighlight,
} = useApiDebugger(props.plugin)

const methodOptions: SelectOption[] = HTTP_METHODS.map((value) => ({
  value,
  label: value,
}))

/** 响应/历史分段切换（与 activeTab 同源的单一数据源） */
const responseTabs = computed(() => [
  {
    id: "response" as const,
    label: props.i18n.response,
  },
  {
    id: "history" as const,
    label: props.i18n.history,
  },
])

const endpointPresetMap = new Map(
  API_ENDPOINT_PRESETS.map((preset) => [preset.path, preset]),
)

const endpointGroups = computed<SelectGroupOption[]>(() => {
  const groups = new Map<string, ApiEndpointPreset[]>()
  for (const preset of API_ENDPOINT_PRESETS) {
    const list = groups.get(preset.category) || []
    list.push(preset)
    groups.set(preset.category, list)
  }
  return Array.from(groups.entries()).map(([, options]) => ({
    isGroup: true as const,
    label: props.i18n.categories[options[0].category],
    options: options.map((p) => ({
      value: p.path,
      label: p.label,
    })),
  }))
})

function handleEndpointChange(val: string | number | boolean | null): void {
  const preset = typeof val === "string" ? endpointPresetMap.get(val) : undefined
  if (preset) {
    selectEndpoint(preset)
  }
}

function handleMethodChange(val: string | number | boolean | null): void {
  const valid = methodOptions.find((o) => o.value === val)
  if (valid) method.value = valid.value as typeof method.value
}

async function handleCopyResponse(): Promise<void> {
  const ok = await copyToClipboard(responseBody.value)
  showMessage(
    ok
      ? props.i18n.responseCopied
      : props.i18n.copyFailed,
    ok ? 2000 : 3000,
    ok ? "info" : "error",
  )
}

function formatTimestamp(ts: number): string {
  const d = new Date(ts)
  const h = d.getHours().toString().padStart(2, "0")
  const m = d.getMinutes().toString().padStart(2, "0")
  const s = d.getSeconds().toString().padStart(2, "0")
  return `${h}:${m}:${s}`
}

const highlightedResponse = computed(() => {
  if (!responseBody.value) return ""
  return syntaxHighlight(responseBody.value)
})
</script>

<style lang="scss" scoped>
@use "./styles/index.scss";
</style>
