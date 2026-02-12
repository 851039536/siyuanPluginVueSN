<template>
  <div class="snapshot-view">
    <h3 class="section-title">
      {{ i18n.title }}
      <Button
        icon="delete"

        variant="ghost"
        size="small"
        :title="i18n.clearTitle"
        @click="handleClear"
      />
    </h3>

    <div v-if="snapshotRows.length > 0" class="snapshot-stats">
      <p class="snapshot-info">
        📸 {{ i18n.savedCount }}: {{ snapshotRows.length }}
      </p>
    </div>


    <!-- 快照数据列表 -->
    <div class="snapshot-data-list">
      <div
        v-for="row in snapshotRows"
        :key="row.snapshot.timestamp"
        class="snapshot-item"
      >
        <div class="snapshot-header">
          <div class="snapshot-time">
            <span class="time-icon">⏰</span>
            <span class="time-text">{{ row.snapshot.datetime }}</span>
            <span v-if="row.isLatest" class="tag tag-success">{{ i18n.latest }}</span>
          </div>
        </div>
        <div class="snapshot-stats-grid">
          <div class="snapshot-stat">
            <span class="stat-icon">📓</span>
            <span class="stat-value">{{ formatNumber(row.snapshot.totalNotes) }}</span>
            <span class="stat-label">{{ i18n.notes }}</span>
          </div>
          <div class="snapshot-stat">
            <span class="stat-icon">✍️</span>
            <span class="stat-value">{{ formatNumber(row.snapshot.totalWords) }}</span>
            <span class="stat-label">{{ i18n.words }}</span>
          </div>
          <div class="snapshot-stat">
            <span class="stat-icon">🧩</span>
            <span class="stat-value">{{ formatShortNumber(row.snapshot.totalBlocks) }}</span>
            <span class="stat-label">{{ i18n.blocks }}</span>
          </div>
          <div class="snapshot-stat">
            <span class="stat-icon">📎</span>
            <span class="stat-value">{{ formatShortNumber(row.snapshot.totalAssets) }}</span>
            <span class="stat-label">{{ i18n.assets }}</span>
          </div>
          <div class="snapshot-stat">
            <span class="stat-icon">📅</span>
            <span class="stat-value">{{ row.snapshot.todayCreated }}</span>
            <span class="stat-label">{{ i18n.created }}</span>
          </div>
          <div class="snapshot-stat">
            <span class="stat-icon">✏️</span>
            <span class="stat-value">{{ row.snapshot.todayModified }}</span>
            <span class="stat-label">{{ i18n.modified }}</span>
          </div>
        </div>
        <!-- 显示与上一个快照的差异 -->
        <div v-if="row.hasComparison" class="snapshot-diff">
          <span class="diff-label">{{ i18n.changeLabel }}:</span>
          <span class="tag tag-small" :class="getDiffClass(row.wordDiff)">
            {{ (row.wordDiff > 0 ? '+' : '') + formatNumber(row.wordDiff) + ' ' + i18n.wordsUnit }}
          </span>
          <span class="tag tag-small" :class="getDiffClass(row.noteDiff)">
            {{ (row.noteDiff > 0 ? '+' : '') + row.noteDiff + ' ' + i18n.notesUnit }}
          </span>
        </div>
      </div>
      <div v-if="snapshotRows.length === 0" class="empty-snapshot">
        📸 {{ i18n.emptyMessage }}
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Button from '@/components/Button.vue'
import { formatNumber, formatShortNumber } from '../utils'



interface SnapshotData {
  timestamp: number
  datetime: string
  totalNotes: number
  totalWords: number
  totalBlocks: number
  totalAssets: number
  todayCreated: number
  todayModified: number
}

interface Props {
  snapshotData?: SnapshotData[]
  i18n?: {
    title: string
    clearTitle: string
    savedCount: string
    latest: string
    notes: string
    words: string
    blocks: string
    assets: string
    created: string
    modified: string
    changeLabel: string
    wordsUnit: string
    notesUnit: string
    emptyMessage: string
    confirmClear: string
  }
}

interface Emits {
  (e: 'clear'): void
}

const props = withDefaults(defineProps<Props>(), {
  snapshotData: () => [],
  i18n: () => ({
    title: '快照分析',
    clearTitle: '清除快照',
    savedCount: '已保存',
    latest: '最新',
    notes: '笔记',
    words: '字数',
    blocks: '块',
    assets: '附件',
    created: '新增',
    modified: '修改',
    changeLabel: '变化',
    wordsUnit: '字',
    notesUnit: '笔记',
    emptyMessage: '还没有快照数据，等待系统自动收集...',
    confirmClear: '确认清除所有快照数据吗？',
  }),
})

const emit = defineEmits<Emits>()

const snapshotRows = computed(() => {
  return props.snapshotData.map((snapshot, index) => {
    const previous = props.snapshotData[index + 1]
    const wordDiff = previous ? getSnapshotWordDiff(snapshot, previous) : 0
    const noteDiff = previous ? getSnapshotNoteDiff(snapshot, previous) : 0
    return {
      snapshot,
      index,
      wordDiff,
      noteDiff,
      hasComparison: Boolean(previous),
      isLatest: index === 0,
    }
  })
})

function getDiffClass(diff: number): string {
  if (diff > 0) return 'tag-success'
  if (diff < 0) return 'tag-danger'
  return 'tag-secondary'
}

function getSnapshotWordDiff(current: SnapshotData, previous: SnapshotData): number {
  if (!current || !previous) return 0
  return current.totalWords - previous.totalWords
}

function getSnapshotNoteDiff(current: SnapshotData, previous: SnapshotData): number {
  if (!current || !previous) return 0
  return current.totalNotes - previous.totalNotes
}

function handleClear() {
  if (confirm(props.i18n.confirmClear)) {
    emit('clear')
  }
}
</script>


<style scoped lang="scss">
@use "@/variables" as *;
@use "../../superPanel/styles/variables" as *;
@use "../../superPanel/styles/mixins" as *;
@use "../index.scss" as stats;

$stats-transition: all 0.2s ease;

.snapshot-view {
  // Tag 组件样式
  .tag {
    display: inline-flex;
    align-items: center;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;
    font-family: $font-body;

    &.tag-small {
      font-size: 10px;
      padding: 2px 6px;
    }

    &.tag-success {
      background: rgba(16, 185, 129, 0.15);
      color: #10b981;
    }

    &.tag-danger {
      background: rgba(239, 68, 68, 0.15);
      color: #ef4444;
    }

    &.tag-secondary {
      background: rgba(107, 114, 128, 0.15);
      color: #6b7280;
    }
  }

  .snapshot-stats {
    margin-bottom: 12px;
    padding: 10px 12px;
    background: var(--b3-theme-surface);
    border-radius: 6px;
    border-left: 3px solid var(--b3-theme-primary);

    .snapshot-info {
      margin: 0;
      font-family: $font-body;
      font-size: 12px;
      color: var(--b3-theme-on-surface);
    }
  }

  .snapshot-data-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
    max-height: 500px;
    overflow-y: auto;
    @include scrollbar-thin;

    .snapshot-item {
      padding: 12px;
      background: var(--b3-theme-surface);
      border: 1px solid var(--b3-border-color);
      border-radius: stats.$stats-card-radius;
      transition: $stats-transition;

      &:hover {
        border-color: var(--b3-theme-primary);
        box-shadow: stats.$stats-shadow-light;
      }

      .snapshot-header {
        margin-bottom: 10px;

        .snapshot-time {
          display: flex;
          align-items: center;
          gap: 6px;

          .time-icon {
            font-size: 14px;
          }

          .time-text {
            font-family: $font-heading;
            font-size: 12px;
            font-weight: 600;
            color: var(--b3-theme-on-surface);
          }
        }
      }

      .snapshot-stats-grid {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 8px;
        margin-bottom: 8px;

        .snapshot-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 4px;
          padding: 8px;
          background: var(--b3-theme-background);
          border-radius: 6px;
          transition: $stats-transition;

          &:hover {
            transform: translateY(-2px);
            box-shadow: 0 2px 6px rgba(0, 0, 0, 0.1);
          }

          .stat-icon {
            font-size: 16px;
          }

          .stat-value {
            font-family: $font-heading;
            font-size: 14px;
            font-weight: 700;
            color: var(--b3-theme-primary);
          }

          .stat-label {
            font-family: $font-body;
            font-size: 9px;
            color: var(--b3-theme-on-surface);
            opacity: 0.7;
          }
        }
      }

      .snapshot-diff {
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 10px;
        background: var(--b3-theme-background);
        border-radius: 4px;
        font-size: 11px;
        font-family: $font-body;

        .diff-label {
          font-weight: 600;
          color: var(--b3-theme-on-surface);
        }
      }
    }

    .empty-snapshot {
      text-align: center;
      padding: 40px 20px;
      font-family: $font-body;
      font-size: 13px;
      color: var(--b3-theme-on-surface);
      opacity: 0.7;
    }
  }
}


// Responsive design
@include tablet-only {
  .snapshot-view .snapshot-stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@include mobile-only {
  .snapshot-view .snapshot-stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
