<!-- 云端快照列表：按标签分组，支持下载快照与删除标签 -->
<template>
  <div class="ds-list">
    <div v-if="loading" class="ds-state">
      {{ i18n.refreshing }}
    </div>
    <div v-else-if="tags.length === 0" class="ds-state">
      {{ i18n.noCloudSnapshots }}
    </div>
    <template v-else>
      <div
        v-for="tag in tags"
        :key="tag.tag"
        class="ds-cloud-tag"
      >
        <div class="ds-cloud-tag__header">
          <span class="ds-cloud-tag__name">{{ tag.tag }}</span>
          <div class="ds-cloud-tag__actions">
            <span class="ds-cloud-tag__count">{{ tag.snapshots.length }}</span>
            <Button
              size="xsmall"
              variant="danger"
              icon="delete"
              :title="i18n.removeCloudTag"
              :aria-label="i18n.removeCloudTag"
              :loading="removingTag === tag.tag"
              @click="emit('removeTag', tag.tag)"
            />
          </div>
        </div>
        <div
          v-for="snap in tag.snapshots"
          :key="snap.id"
          class="ds-item"
        >
          <div class="ds-item__memo">{{ snap.memo || snap.id }}</div>
          <div class="ds-item__meta">
            <span>{{ formatSnapshotTime(snap) }}</span>
          </div>
          <div class="ds-item__actions">
            <Button
              size="xsmall"
              icon="download"
              :loading="downloadingId === snap.id"
              @click="emit('download', tag.tag, snap.id)"
            >
              {{ downloadingId === snap.id ? i18n.downloading : i18n.download }}
            </Button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { CloudSnapshotTag } from "@/api"
import type { DataSnapshotI18n } from "../types/i18n"
import Button from "@/components/Button.vue"
import { formatSnapshotTime } from "../utils"

interface Props {
  tags: CloudSnapshotTag[]
  loading: boolean
  /** 正在下载的快照 id（按钮加载态） */
  downloadingId: string | null
  /** 正在删除的云端标签（按钮加载态） */
  removingTag: string | null
  i18n: DataSnapshotI18n
}

defineProps<Props>()

const emit = defineEmits<{
  download: [tag: string, id: string]
  removeTag: [tag: string]
}>()
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
