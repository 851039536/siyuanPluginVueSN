<!-- 本地快照列表：刷新态 / 空态 / 条目与查看、恢复操作 -->
<template>
  <div class="ds-list">
    <div v-if="loading" class="ds-state">
      {{ i18n.refreshing }}
    </div>
    <div v-else-if="snapshots.length === 0" class="ds-state">
      {{ i18n.noSnapshots }}
    </div>
    <template v-else>
      <div
        v-for="snap in snapshots"
        :key="snap.id"
        class="ds-item"
      >
        <div class="ds-item__memo">{{ snap.memo || snap.id }}</div>
        <div class="ds-item__meta">
          <span>{{ formatSnapshotTime(snap) }}</span>
          <span v-if="snap.count">· {{ snap.count }} {{ i18n.snapshotFiles }}</span>
          <span v-if="sizeTextMap.get(snap.id)">· {{ sizeTextMap.get(snap.id) }}</span>
        </div>
        <div class="ds-item__actions">
          <Button
            size="xsmall"
            icon="eye"
            @click="emit('view', snap)"
          >
            {{ i18n.view }}
          </Button>
          <Button
            size="xsmall"
            icon="refreshLeft"
            :loading="restoringId === snap.id"
            @click="emit('restore', snap)"
          >
            {{ i18n.restore }}
          </Button>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { SnapshotInfo } from "@/api"
import type { DataSnapshotI18n } from "../types/i18n"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import { formatSnapshotSize, formatSnapshotTime } from "../utils"

interface Props {
  snapshots: SnapshotInfo[]
  loading: boolean
  /** 正在恢复的快照 id（按钮加载态） */
  restoringId: string | null
  i18n: DataSnapshotI18n
}

const props = defineProps<Props>()

const emit = defineEmits<{
  view: [snap: SnapshotInfo]
  restore: [snap: SnapshotInfo]
}>()

/** 快照大小一次性格式化，避免模板中对同一快照反复计算 */
const sizeTextMap = computed(() => {
  const map = new Map<string, string>()
  for (const snap of props.snapshots) {
    map.set(snap.id, formatSnapshotSize(snap))
  }
  return map
})
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
