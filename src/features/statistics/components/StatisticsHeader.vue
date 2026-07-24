<!-- 统计面板头部：标题栏 + 刷新按钮 + 存储路径展示 -->
<template>
  <div class="statistics-header">
    <div class="header-left">
      <Button
        :icon="refreshIcon"
        variant="ghost"
        size="xsmall"
        :loading="loading"
        :title="i18n.refresh"
        @click="handleRefresh"
      />
      <button
        class="storage-toggle-btn"
        :title="showStorage ? '隐藏存储路径' : '查看存储路径'"
        @click="showStorage = !showStorage"
      >
        <svg><use xlink:href="#iconFolder"></use></svg>
      </button>
    </div>
    <div class="header-right">
      <div class="last-update">
        {{ i18n.lastUpdate }}: {{ lastUpdateTime }}
      </div>
    </div>
  </div>
  <div
    v-if="showStorage && storagePaths && storagePaths.length > 0"
    class="storage-paths"
  >
    <div
      v-for="item in storagePaths"
      :key="item.key"
      class="storage-path-item"
    >
      <span class="storage-key">{{ item.key }}</span>
      <span class="storage-desc">{{ item.desc }}</span>
      <span
        class="storage-path"
        :title="item.path"
      >{{ item.path }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { IconKey } from "@/config/icons"
import {
  computed,
  ref,
} from "vue"
import Button from "@/components/Button.vue"

interface StoragePathItem {
  key: string
  desc: string
  path: string
}

interface Props {
  loading?: boolean
  lastUpdateTime?: string
  storagePaths?: StoragePathItem[]
  i18n?: Record<string, any>
}

interface Emits {
  (e: "refresh"): void
}

const props = withDefaults(defineProps<Props>(), {
  loading: false,
  lastUpdateTime: "",
  storagePaths: () => [],
  i18n: () => ({
    refresh: "刷新",
    lastUpdate: "最后更新",
  }),
})

const emit = defineEmits<Emits>()

const showStorage = ref(false)

const refreshIcon = computed<IconKey>(() => {
  return props.loading ? "loading" : "refresh"
})

function handleRefresh() {
  emit("refresh")
}
</script>

<style scoped lang="scss">
@use "../styles/StatisticsHeader.scss";
</style>

