<!-- 面包屑导航组件 — 显示当前路径层级，支持点击跳转任意层级 -->
<template>
  <div
    v-if="currentPath"
    class="breadcrumb-nav"
  >
    <button
      class="breadcrumb-item"
      :title="i18n.backToRoot || '返回根目录'"
      @click="$emit('navigate-root')"
    >
      <IconWrapper
        name="diskBrowser"
        :size="12"
      />
      {{ expandedDisk }}
    </button>
    <span
      v-for="(segment, index) in pathSegments"
      :key="index"
      class="breadcrumb-segment"
    >
      <span class="breadcrumb-sep">\</span>
      <button
        class="breadcrumb-item"
        :title="segment"
        @click="$emit('navigate-path', index)"
      >
        {{ segment }}
      </button>
    </span>
  </div>
</template>

<script setup lang="ts">
import type { DiskBrowserI18n } from "../types"
import IconWrapper from "@/components/IconWrapper.vue"

interface Props {
  currentPath: string
  expandedDisk: string
  pathSegments: string[]
  i18n: DiskBrowserI18n
}

defineProps<Props>()
defineEmits<{
  "navigate-root": []
  "navigate-path": [index: number]
}>()
</script>

<style scoped lang="scss">
@use "../styles/BreadcrumbNav.scss";
@use "../styles/index.scss";
</style>
