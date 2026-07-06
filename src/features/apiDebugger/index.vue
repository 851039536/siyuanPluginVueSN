<template>
  <div class="api-debugger">
    <!-- Endpoint Selection -->
    <div class="api-debugger__section">
      <div class="api-debugger__section-title">
        {{ i18n.endpoint || '接口端点' }}
      </div>
      <Select
        :model-value="endpointSelectValue"
        :options="endpointGroups"
        :placeholder="i18n.endpointPlaceholder || '选择预设接口'"
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
            :placeholder="i18n.pathPlaceholder || '/api/system/version'"
            size="xsmall"
          />
        </div>
      </div>
    </div>

    <!-- Custom Headers -->
    <div class="api-debugger__section">
      <div class="api-debugger__section-title">
        {{ i18n.customHeaders || '自定义请求头' }}
      </div>
      <div
        v-for="(header, index) in customHeaders"
        :key="index"
        class="api-debugger__header-row"
      >
        <div class="api-debugger__header-input">
          <Input
            v-model="header.key"
            :placeholder="i18n.headerKey || '键名'"
            size="xsmall"
          />
        </div>
        <div class="api-debugger__header-input">
          <Input
            v-model="header.value"
            :placeholder="i18n.headerValue || '值'"
            size="xsmall"
          />
        </div>
        <div class="api-debugger__header-remove">
          <Button
            variant="ghost"
            size="xsmall"
            icon="mdi:close"
            @click="removeHeader(index)"
          />
        </div>
      </div>
      <Button
        variant="ghost"
        size="xsmall"
        icon="mdi:plus"
        @click="addHeader"
      >
        {{ i18n.addHeader || '添加请求头' }}
      </Button>
    </div>

    <!-- Request Body -->
    <div class="api-debugger__section">
      <div class="api-debugger__section-title">
        {{ i18n.requestBody || '请求体' }}
      </div>
      <Input
        v-model="requestBody"
        type="textarea"
        :placeholder="i18n.requestBodyPlaceholder || '输入JSON格式的请求体...'"
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
        icon="mdi:send"
        :loading="loading"
        @click="sendRequest"
      >
        {{ loading ? (i18n.loading || '请求中...') : (i18n.send || '发送请求') }}
      </Button>
      <Button
        variant="ghost"
        size="xsmall"
        icon="mdi:eraser"
        @click="clearRequest"
      >
        {{ i18n.clear || '清空' }}
      </Button>
    </div>

    <!-- Tabs -->
    <div class="api-debugger__tabs">
      <button
        class="api-debugger__tab"
        :class="{ 'api-debugger__tab--active': activeTab === 'response' }"
        @click="activeTab = 'response'"
      >
        {{ i18n.response || '响应结果' }}
      </button>
      <button
        class="api-debugger__tab"
        :class="{ 'api-debugger__tab--active': activeTab === 'history' }"
        @click="activeTab = 'history'"
      >
        {{ i18n.history || '请求历史' }}
        <span v-if="history.length">({{ history.length }})</span>
      </button>
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
            {{ responseTime }}{{ i18n.ms || 'ms' }}
          </span>
          <div style="flex: 1;" />
          <Button
            variant="ghost"
            size="xsmall"
            icon="mdi:content-copy"
            @click="handleCopyResponse"
          >
            {{ i18n.copyResponse || '复制' }}
          </Button>
        </div>
        <div class="api-debugger__response-body">
          <code v-html="highlightedResponse" />
        </div>
      </template>
      <template v-else>
        <div class="api-debugger__empty">
          {{ i18n.noEndpoint || '发送请求后在此查看响应结果' }}
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
        style="display: flex; justify-content: flex-end; margin-bottom: 4px;"
      >
        <Button
          variant="ghost"
          size="xsmall"
          icon="mdi:delete"
          @click="clearHistory"
        >
          {{ i18n.clearHistory || '清空历史' }}
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
            :class="`api-debugger__history-method--${record.method.toLowerCase()}`"
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
        {{ i18n.noHistory || '暂无请求历史' }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import type { ApiEndpointPreset } from "./types"
import type {
  SelectGroupOption,
  SelectOption,
} from "@/components/Select.vue"

import { computed } from "vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"

import { useApiDebugger } from "./composables/useApiDebugger"
import { API_ENDPOINT_PRESETS } from "./types"

interface Props {
  i18n: Record<string, any>
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
  copyToClipboard,
} = useApiDebugger(props.plugin)

const methodOptions: SelectOption[] = [
  {
    value: "POST",
    label: "POST",
  },
  {
    value: "GET",
    label: "GET",
  },
  {
    value: "PUT",
    label: "PUT",
  },
  {
    value: "DELETE",
    label: "DELETE",
  },
]

const endpointGroups = computed<SelectGroupOption[]>(() => {
  const groups = new Map<string, ApiEndpointPreset[]>()
  for (const preset of API_ENDPOINT_PRESETS) {
    const list = groups.get(preset.category) || []
    list.push(preset)
    groups.set(preset.category, list)
  }
  return Array.from(groups.entries()).map(([, options]) => ({
    isGroup: true as const,
    label: props.i18n.categories?.[options[0].category] || options[0].category,
    options: options.map((p) => ({
      value: p.path,
      label: p.label,
    })),
  }))
})

const endpointSelectValue = computed(() => path.value)

function handleEndpointChange(val: string | number | boolean | null) {
  const preset = API_ENDPOINT_PRESETS.find((p) => p.path === val)
  if (preset) {
    selectEndpoint(preset)
  }
}

function handleMethodChange(val: string | number | boolean | null) {
  const valid = methodOptions.find((o) => o.value === val)
  if (valid) method.value = valid.value as typeof method.value
}

async function handleCopyResponse() {
  await copyToClipboard(responseBody.value)
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
