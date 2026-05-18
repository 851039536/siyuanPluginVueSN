<template>
  <div class="publish-history">
    <div
      v-if="loading"
      class="history-loading"
    >
      <Icon
        icon="mdi:loading"
        class="spin-icon"
      />
      加载中...
    </div>

    <div
      v-else-if="records.length === 0"
      class="history-empty"
    >
      <Icon
        icon="mdi:history"
        class="empty-icon"
      />
      <p>暂无发布记录</p>
    </div>

    <div
      v-else
      class="history-list"
    >
      <div
        v-for="record in records"
        :key="record.platformId"
        class="history-item"
        :class="record.status"
      >
        <div class="history-item-header">
          <Icon
            :icon="getStatusIcon(record.status)"
            :class="['status-icon', record.status]"
          />
          <span class="platform-name">{{ getPlatformName(record.platformId) }}</span>
          <span class="status-badge" :class="record.status">{{ getStatusText(record.status) }}</span>
        </div>
        <div
          v-if="record.remoteUrl"
          class="history-item-url"
        >
          <a
            :href="record.remoteUrl"
            target="_blank"
          >
            <Icon icon="mdi:open-in-new" />
            {{ record.remoteUrl }}
          </a>
        </div>
        <div
          v-if="record.publishedAt"
          class="history-item-time"
        >
          发布于 {{ formatTime(record.publishedAt) }}
        </div>
        <div
          v-if="record.updatedAt && record.updatedAt !== record.publishedAt"
          class="history-item-time"
        >
          更新于 {{ formatTime(record.updatedAt) }}
        </div>
        <div
          v-if="record.errorMessage"
          class="history-item-error"
        >
          {{ record.errorMessage }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DocPublishState, PublishRecord } from "../types/publish"
import type { Plugin } from "siyuan"
import { Icon } from "@iconify/vue"
import {
  onMounted,
  ref,
} from "vue"
import { usePublish } from "../composables/usePublish"

interface Props {
  docId: string
  plugin: Plugin
}

const props = defineProps<Props>()

const { getDocPublishState, platforms, loadPublishConfig } = usePublish(props.plugin)
const records = ref<PublishRecord[]>([])
const loading = ref(false)

onMounted(async () => {
  loading.value = true
  try {
    await loadPublishConfig()
    const state: DocPublishState | null = await getDocPublishState(props.docId)
    if (state) {
      records.value = state.records
    }
  } catch (error) {
    console.error("加载发布记录失败:", error)
  } finally {
    loading.value = false
  }
})

function getPlatformName(platformId: string): string {
  return platforms.value.find(p => p.id === platformId)?.name || "未知平台"
}

function getStatusIcon(status: string): string {
  switch (status) {
    case "published": return "mdi:check-circle"
    case "failed": return "mdi:alert-circle"
    case "publishing": return "mdi:loading"
    case "removed": return "mdi:minus-circle"
    default: return "mdi:circle-outline"
  }
}

function getStatusText(status: string): string {
  switch (status) {
    case "published": return "已发布"
    case "failed": return "失败"
    case "publishing": return "发布中"
    case "removed": return "已移除"
    default: return "未发布"
  }
}

function formatTime(isoStr: string): string {
  try {
    const d = new Date(isoStr)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`
  } catch {
    return isoStr
  }
}
</script>

<style lang="scss" scoped>
@use "../styles/publish";
</style>
