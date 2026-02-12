<template>
  <div class="extended-stats-cards">
    <div class="stat-card-small">
      <div class="card-icon">📅</div>
      <div class="card-content">
        <div class="card-value-small">{{ todayCreated }}</div>
        <div class="card-label-small">{{ i18n.todayCreated }}</div>
      </div>
    </div>
    <div class="stat-card-small">
      <div class="card-icon">✏️</div>
      <div class="card-content">
        <div class="card-value-small">{{ todayModified }}</div>
        <div class="card-label-small">{{ i18n.todayModified }}</div>
      </div>
    </div>
    <div class="stat-card-small">
      <div class="card-icon">📊</div>
      <div class="card-content">
        <div class="card-value-small">{{ avgWordsPerDoc }}</div>
        <div class="card-label-small">{{ i18n.avgWordsPerDoc }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  todayCreated?: number
  todayModified?: number
  avgWordsPerDoc?: number
  i18n?: {
    todayCreated: string
    todayModified: string
    avgWordsPerDoc: string
  }
}

withDefaults(defineProps<Props>(), {
  todayCreated: 0,
  todayModified: 0,
  avgWordsPerDoc: 0,
  i18n: () => ({
    todayCreated: '今日新增',
    todayModified: '今日修改',
    avgWordsPerDoc: '平均字数',
  }),
})
</script>

<style scoped lang="scss">
@use "@/variables" as *;
@use "../../superPanel/styles/variables" as *;
@use "../../superPanel/styles/mixins" as *;
@use "../index.scss" as stats;

.extended-stats-cards {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: $spacing-sm;
  margin-bottom: $spacing-sm;

  .stat-card-small {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px;
    border-radius: stats.$stats-card-radius;
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);
    @include stats.stats-theme-border;
    @include stats.stats-card-hover;

    .card-icon {
      font-size: 24px;
      flex-shrink: 0;
    }

    .card-content {
      flex: 1;
      min-width: 0;

      .card-value-small {
        font-family: $font-heading;
        font-size: 20px;
        font-weight: 700;
        line-height: 1.2;
        margin-bottom: 2px;
        color: var(--b3-theme-primary);
      }

      .card-label-small {
        font-size: 10px;
        font-family: $font-body;
        opacity: 0.9;
        @include text-ellipsis;
      }
    }
  }
}


// Responsive design
@include tablet-only {
  .extended-stats-cards {
    grid-template-columns: 1fr;
  }
}
</style>
