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
  gap: $spacing-md;
  margin-bottom: $spacing-md;

  .stat-card-small {
    @include stats.stats-card-base;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 16px;
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);

    .card-icon {
      font-size: 28px;
      width: 44px;
      height: 44px;
      display: flex;
      align-items: center;
      justify-content: center;
      background: var(--b3-theme-background);
      border-radius: 10px;
      flex-shrink: 0;
      transition: stats.$stats-transition;
    }

    &:hover .card-icon {
      background: var(--b3-theme-primary-lighter, rgba(var(--b3-theme-primary-rgb), 0.1));
      transform: scale(1.1);
    }

    .card-content {
      flex: 1;
      min-width: 0;

      .card-value-small {
        font-family: $font-heading;
        font-size: 22px;
        font-weight: 800;
        line-height: 1.1;
        margin-bottom: 2px;
        color: var(--b3-theme-primary);
      }

      .card-label-small {
        font-size: 11px;
        font-family: $font-body;
        font-weight: 500;
        opacity: 0.6;
        @include text-ellipsis;
      }
    }
  }
}

// Responsive design
@include tablet-only {
  .extended-stats-cards {
    grid-template-columns: repeat(2, 1fr);
  }
}

@include mobile-only {
  .extended-stats-cards {
    grid-template-columns: 1fr;
    gap: 12px;
  }
}
</style>

