<!-- 面包屑地址栏 — 返回上级 + bucket 根 + 路径分段导航 + 条目计数/刷新 -->
<template>
  <div class="fm-breadcrumb-bar">
    <div class="fm-breadcrumb-left">
      <!-- 按钮提示："返回上级" -->
      <Button
        v-if="!isAtRoot"
        variant="ghost"
        size="xsmall"
        icon="back"
        :icon-size="14"
        :title="i18n.up"
        @click="$emit('navigateUp')"
      />
      <div class="fm-breadcrumb">
        <!-- 根节点：bucket 名（悬停提示"返回根目录"） -->
        <button
          class="fm-crumb"
          :title="i18n.backToRoot"
          @click="$emit('navigateSegment', -1)"
        >
          <IconWrapper
            name="s3FileManager"
            :size="11"
          />
          {{ bucketLabel }}
        </button>
        <template
          v-for="(segment, index) in pathSegments"
          :key="index"
        >
          <span class="fm-crumb-sep">&#9656;</span>
          <button
            class="fm-crumb"
            :title="segment"
            @click="$emit('navigateSegment', index)"
          >
            {{ segment }}
          </button>
        </template>
      </div>
    </div>

    <div class="fm-breadcrumb-actions">
      <!-- 条目计数："N 项" -->
      <span
        v-if="itemCount > 0"
        class="fm-item-count"
      >{{ itemCount }} {{ i18n.itemsUnit }}</span>
      <!-- 按钮提示："刷新" -->
      <Button
        variant="ghost"
        size="xsmall"
        icon="refresh"
        :icon-size="13"
        :loading="loading"
        :title="i18n.refresh"
        @click="$emit('refresh')"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { S3FileManagerI18n } from "../types"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"

interface Props {
  pathSegments: string[]
  bucketLabel: string
  isAtRoot: boolean
  loading: boolean
  itemCount: number
  i18n: S3FileManagerI18n
}

defineProps<Props>()
defineEmits<{
  navigateUp: []
  navigateSegment: [index: number]
  refresh: []
}>()
</script>

<style scoped lang="scss">
@use "../styles/FmBreadcrumb.scss";
@use "../styles/index.scss";
</style>
