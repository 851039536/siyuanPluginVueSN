<template>
  <div class="snapshot-view">
    <h3 class="section-title">
      {{ i18n.title }}
      <Button @click="handleClear" class="clear-btn" :title="i18n.clearTitle" icon="pi pi-trash" severity="danger" text rounded />
    </h3>

    <div v-if="snapshotData.length > 0" class="snapshot-stats">
      <p class="snapshot-info">
        📸 {{ i18n.savedCount }}: {{ snapshotData.length }}
      </p>
    </div>

    <!-- 快照数据列表 -->
    <div class="snapshot-data-list">
      <div
        v-for="(snapshot, index) in snapshotData"
        :key="snapshot.timestamp"
        class="snapshot-item"
      >
        <div class="snapshot-header">
          <div class="snapshot-time">
            <span class="time-icon">⏰</span>
            <span class="time-text">{{ snapshot.datetime }}</span>
            <Tag v-if="index === 0" :value="i18n.latest" severity="success" />
          </div>
        </div>
        <div class="snapshot-stats-grid">
          <div class="snapshot-stat">
            <span class="stat-icon">📓</span>
            <span class="stat-value">{{ formatNumber(snapshot.totalNotes) }}</span>
            <span class="stat-label">{{ i18n.notes }}</span>
          </div>
          <div class="snapshot-stat">
            <span class="stat-icon">✍️</span>
            <span class="stat-value">{{ formatNumber(snapshot.totalWords) }}</span>
            <span class="stat-label">{{ i18n.words }}</span>
          </div>
          <div class="snapshot-stat">
            <span class="stat-icon">🧩</span>
            <span class="stat-value">{{ formatShortNumber(snapshot.totalBlocks) }}</span>
            <span class="stat-label">{{ i18n.blocks }}</span>
          </div>
          <div class="snapshot-stat">
            <span class="stat-icon">📎</span>
            <span class="stat-value">{{ formatShortNumber(snapshot.totalAssets) }}</span>
            <span class="stat-label">{{ i18n.assets }}</span>
          </div>
          <div class="snapshot-stat">
            <span class="stat-icon">📅</span>
            <span class="stat-value">{{ snapshot.todayCreated }}</span>
            <span class="stat-label">{{ i18n.created }}</span>
          </div>
          <div class="snapshot-stat">
            <span class="stat-icon">✏️</span>
            <span class="stat-value">{{ snapshot.todayModified }}</span>
            <span class="stat-label">{{ i18n.modified }}</span>
          </div>
        </div>
        <!-- 显示与上一个快照的差异 -->
        <div v-if="index < snapshotData.length - 1" class="snapshot-diff">
          <span class="diff-label">{{ i18n.changeLabel }}:</span>
          <Tag size="small"
            :value="(getSnapshotWordDiff(snapshot, snapshotData[index + 1]) > 0 ? '+' : '') + formatNumber(getSnapshotWordDiff(snapshot, snapshotData[index + 1])) + ' ' + i18n.wordsUnit"
            :severity="getSnapshotWordDiff(snapshot, snapshotData[index + 1]) > 0 ? 'success' : getSnapshotWordDiff(snapshot, snapshotData[index + 1]) < 0 ? 'danger' : 'secondary'"
          />
          <Tag size="small"
            :value="(getSnapshotNoteDiff(snapshot, snapshotData[index + 1]) > 0 ? '+' : '') + getSnapshotNoteDiff(snapshot, snapshotData[index + 1]) + ' ' + i18n.notesUnit"
            :severity="getSnapshotNoteDiff(snapshot, snapshotData[index + 1]) > 0 ? 'success' : getSnapshotNoteDiff(snapshot, snapshotData[index + 1]) < 0 ? 'danger' : 'secondary'"
          />
        </div>
      </div>
      <div v-if="snapshotData.length === 0" class="empty-snapshot">
        📸 {{ i18n.emptyMessage }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from 'primevue/button'
import Tag from 'primevue/tag'

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

function formatNumber(num: number): string {
  return num.toLocaleString('zh-CN')
}

function formatShortNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  } else if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return String(num)
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
@use "@/index.scss" as *;
@use "../../superPanel/styles/variables" as *;
@use "../../superPanel/styles/mixins" as *;

$stats-card-radius: 8px;
$stats-transition: all 0.2s ease;

.snapshot-view {
  .section-title {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin: 0 0 12px 0;
    font-family: $font-heading;
    font-size: 14px;
    font-weight: 600;
    color: var(--b3-theme-on-surface);

    .clear-btn {
      padding: 4px 8px;
      border: 1px solid var(--b3-border-color);
      border-radius: 4px;
      background: transparent;
      cursor: pointer;
      font-size: 14px;
      transition: $stats-transition;
      font-family: $font-body;

      &:hover {
        background: var(--b3-theme-error);
        color: white;
        border-color: var(--b3-theme-error);
      }
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
      border-radius: $stats-card-radius;
      transition: $stats-transition;

      &:hover {
        border-color: var(--b3-theme-primary);
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
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
