<template>
  <div class="extended-stats-cards">
    <div class="stat-card-small gradient-1">
      <div class="card-icon">📅</div>
      <div class="card-content">
        <div class="card-value-small">{{ todayCreated }}</div>
        <div class="card-label-small">{{ i18n.todayCreated }}</div>
      </div>
    </div>
    <div class="stat-card-small gradient-2">
      <div class="card-icon">✏️</div>
      <div class="card-content">
        <div class="card-value-small">{{ todayModified }}</div>
        <div class="card-label-small">{{ i18n.todayModified }}</div>
      </div>
    </div>
    <div class="stat-card-small gradient-3">
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
@use "@/index.scss" as *;
@use "../../superPanel/styles/variables" as *;
@use "../../superPanel/styles/mixins" as *;

$stats-card-radius: 8px;
$stats-shadow-light: 0 2px 8px rgba(0, 0, 0, 0.1);
$stats-shadow-medium: 0 4px 12px rgba(0, 0, 0, 0.15);

$gradient-primary: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
$gradient-secondary: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
$gradient-tertiary: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);

@mixin stats-card-hover {
  transition: transform 0.2s, box-shadow 0.2s;

  &:hover {
    transform: translateY(-2px);
    box-shadow: $stats-shadow-medium;
  }
}

@mixin stats-theme-border {
  border: 1px solid var(--b3-border-color);

  .theme-github & {
    border-color: var(--b3-border-color);
  }
}

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
    border-radius: $stats-card-radius;
    color: white;
    box-shadow: $stats-shadow-light;
    @include stats-card-hover;

    &.gradient-1 {
      background: $gradient-primary;
    }

    &.gradient-2 {
      background: $gradient-secondary;
    }

    &.gradient-3 {
      background: $gradient-tertiary;
    }

    // GitHub theme overrides
    .theme-github &,
    .theme-github &.gradient-1,
    .theme-github &.gradient-2,
    .theme-github &.gradient-3 {
      @include stats-theme-border;
      background: var(--b3-theme-surface);
      color: var(--b3-theme-on-surface);
      box-shadow: none;

      &:hover {
        transform: none;
        border-color: var(--b3-theme-primary);
      }
    }

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
