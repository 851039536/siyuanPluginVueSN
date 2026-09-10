<!-- 快照详情：基础字段信息与文件类型分布 -->
<template>
  <div class="ds-detail">
    <Button
      class="ds-detail__back"
      text
      block
      size="xsmall"
      icon="back"
      @click="emit('back')"
    >
      {{ i18n.snapshotDetail }}
    </Button>
    <div class="ds-detail__info">
      <div v-if="snapshot.memo">
        <span class="ds-detail__key">{{ i18n.memo }}:</span> {{ snapshot.memo }}
      </div>
      <div>
        <span class="ds-detail__key">{{ i18n.createdAt }}:</span> {{ formatSnapshotTime(snapshot) }}
      </div>
      <div v-if="snapshot.count">
        <span class="ds-detail__key">{{ i18n.fileCount }}:</span> {{ snapshot.count }}
      </div>
      <div v-if="sizeText">
        <span class="ds-detail__key">{{ i18n.size }}:</span> {{ sizeText }}
      </div>
      <div v-if="snapshot.hTagUpdated">
        <span class="ds-detail__key">{{ i18n.tagUpdated }}:</span> {{ snapshot.hTagUpdated }}
      </div>
      <div v-if="snapshot.systemName">
        <span class="ds-detail__key">{{ i18n.device }}:</span> {{ snapshot.systemName }}
        <template v-if="snapshot.systemOS">({{ snapshot.systemOS }})</template>
      </div>
    </div>
    <div v-if="typeCounts.length > 0" class="ds-detail__section">
      <div class="ds-detail__section-title">
        {{ i18n.typesDistribution }}
      </div>
      <div
        v-for="tc in typeCounts"
        :key="tc.type"
        class="ds-detail__type-row"
      >
        <span class="ds-detail__type-name">{{ tc.type }}</span>
        <span class="ds-detail__type-count">{{ tc.count }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SnapshotInfo } from "@/api"
import type { DataSnapshotI18n } from "../types/i18n"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import { formatSnapshotSize, formatSnapshotTime } from "../utils"

interface Props {
  snapshot: SnapshotInfo
  i18n: DataSnapshotI18n
}

const props = defineProps<Props>()

const emit = defineEmits<{
  back: []
}>()

/** 快照大小一次性格式化，避免模板重复计算 */
const sizeText = computed(() => formatSnapshotSize(props.snapshot))
const typeCounts = computed(() => props.snapshot.typesCount ?? [])
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
