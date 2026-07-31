<!-- 热力图日详情面板：选中日期的新增/修改文档列表 -->
<template>
  <div class="daily-detail">
    <div class="daily-detail-header">
      <span class="daily-detail-title">{{ date }}</span>
      <button
        class="daily-detail-close"
        @click="$emit('close')"
      >
        <IconWrapper
          name="close"
          :size="12"
        />
      </button>
    </div>

    <div
      v-if="loading"
      class="daily-detail-status"
    >
      <!-- 加载提示："加载中..." -->
      {{ i18n.loading }}
    </div>

    <div
      v-else-if="newDocs.length === 0 && modifiedDocs.length === 0"
      class="daily-detail-status"
    >
      <!-- 空状态："当天无新增或修改" -->
      {{ i18n.noDocChanges }}
    </div>

    <div
      v-else
      class="daily-detail-list"
    >
      <div
        v-if="newDocs.length > 0"
        class="detail-group"
      >
        <div class="detail-group-title">
          <IconWrapper
            name="success"
            :size="12"
          />
          <!-- 分组标题："新增（N）" -->
          {{ i18n.todayCreated }}（{{ newDocs.length }}）
        </div>
        <div
          v-for="doc in newDocs"
          :key="doc.id"
          class="detail-item new"
          @click="openDocById(doc.id)"
        >
          <span class="detail-icon">+</span>
          <!-- 文档标题（空标题显示"无标题"） -->
          <span class="detail-title">{{ doc.title || i18n.untitled }}</span>
          <span
            v-if="doc.time"
            class="detail-time"
          >{{ doc.time }}</span>
        </div>
      </div>

      <div
        v-if="modifiedDocs.length > 0"
        class="detail-group"
      >
        <div class="detail-group-title">
          <IconWrapper
            name="edit"
            :size="12"
          />
          <!-- 分组标题："修改（N）" -->
          {{ i18n.todayModified }}（{{ modifiedDocs.length }}）
        </div>
        <div
          v-for="doc in modifiedDocs"
          :key="doc.id"
          class="detail-item modified"
          @click="openDocById(doc.id)"
        >
          <span class="detail-icon">~</span>
          <!-- 文档标题（空标题显示"无标题"） -->
          <span class="detail-title">{{ doc.title || i18n.untitled }}</span>
          <span
            v-if="doc.time"
            class="detail-time"
          >{{ doc.time }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChangedDoc } from "../types"
import IconWrapper from "@/components/IconWrapper.vue"
import { openDocById } from "../utils"

interface Props {
  date: string
  loading?: boolean
  newDocs?: ChangedDoc[]
  modifiedDocs?: ChangedDoc[]
  i18n?: Record<string, any>
}

withDefaults(defineProps<Props>(), {
  loading: false,
  newDocs: () => [],
  modifiedDocs: () => [],
  i18n: () => ({}),
})

defineEmits<{
  close: []
}>()
</script>

<style lang="scss" scoped>
@use '../styles/HeatmapCard.scss';
@use '../styles/index.scss' as stats;
</style>
