<template>
  <div class="view-mode-section">
    <!-- 视图模式切换 -->
    <div class="mode-tabs">
      <button
        v-for="mode in viewModes"
        :key="mode.value"
        class="mode-tab"
        :class="{ active: modelValue === mode.value }"
        @click="$emit('update:modelValue', mode.value)"
      >
        {{ mode.icon }} {{ mode.label }}
      </button>
    </div>

    <!-- 时段统计卡片 -->
    <div v-if="periodAvgWords > 0 || periodTotalWords > 0" class="period-stats-cards">
      <div v-if="periodAvgWords > 0" class="period-stat-card">
        <span class="stat-value">{{ formatNumber(periodAvgWords) }} {{ i18n.wordsUnit }}</span>
        <span class="stat-label">{{ periodAvgLabel }}</span>
      </div>
      <div v-if="periodTotalWords > 0" class="period-stat-card">
        <span class="stat-value">{{ formatNumber(periodTotalWords) }} {{ i18n.wordsUnit }}</span>
        <span class="stat-label">{{ i18n.totalLabel }}</span>
      </div>
    </div>


    <!-- 日视图范围选择 -->
    <div v-if="modelValue === 'day'" class="range-selector">
      <button
        v-for="range in dayRanges"
        :key="range.value"
        class="range-btn"
        :class="{ active: dayRange === range.value }"
        @click="onRangeChange('day', range.value)"
      >
        {{ range.label }}
      </button>
    </div>

    <!-- 月视图范围选择 -->
    <div v-if="modelValue === 'month'" class="range-selector">
      <button
        v-for="range in monthRanges"
        :key="range.value"
        class="range-btn"
        :class="{ active: monthYearRange === range.value }"
        @click="onRangeChange('month', range.value)"
      >
        {{ range.label }}
      </button>
    </div>

    <!-- 年视图选择 -->
    <div v-if="modelValue === 'year'" class="year-selector">
      <select
        :value="selectedYear"
        @change="$emit('update:selectedYear', Number(($event.target as HTMLSelectElement).value)); $emit('refresh')"
        class="year-select"
      >
        <option v-for="year in availableYears" :key="year" :value="year">{{ year }}</option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { formatNumber } from "../utils";

interface Props {
  modelValue?: "day" | "week" | "month" | "year" | "trend";
  dayRange?: 7 | 15 | 30 | 90 | 180 | 365;
  monthYearRange?: 1 | 2 | 3;
  selectedYear?: number;
  periodAvgWords?: number;
  periodTotalWords?: number;
  i18n?: {
    day: string;
    week: string;
    month: string;
    year: string;
    trend: string;
    avgLabel: string;
    totalLabel: string;
    wordsUnit: string;
    days7: string;
    days15: string;
    days30: string;
    quarter: string;
    halfYear: string;
    fullYear: string;
    last1Year: string;
    last2Years: string;
    last3Years: string;
  };
}

interface Emits {
  (
    e: "update:modelValue",
    value: "day" | "week" | "month" | "year" | "trend",
  ): void;
  (e: "update:dayRange", value: 7 | 15 | 30 | 90 | 180 | 365): void;
  (e: "update:monthYearRange", value: 1 | 2 | 3): void;
  (e: "update:selectedYear", value: number): void;
  (e: "refresh"): void;
}

const props = withDefaults(defineProps<Props>(), {
  modelValue: "day",
  dayRange: 7,
  monthYearRange: 1,
  selectedYear: new Date().getFullYear(),
  periodAvgWords: 0,
  periodTotalWords: 0,
  i18n: () => ({
    day: "日",
    week: "周",
    month: "月",
    year: "年",
    trend: "趋势",
    avgLabel: "日均字数",
    totalLabel: "总字数",
    wordsUnit: "字",
    days7: "7天",
    days15: "15天",
    days30: "30天",
    quarter: "季度",
    halfYear: "半年",
    fullYear: "整年",
    last1Year: "最近一年",
    last2Years: "最近两年",
    last3Years: "最近三年",
  }),
});

const emit = defineEmits<Emits>();

function onRangeChange(mode: "day" | "month", value: number): void {
  if (mode === "day") {
    emit("update:dayRange", value as 7 | 15 | 30 | 90 | 180 | 365);
  } else {
    emit("update:monthYearRange", value as 1 | 2 | 3);
  }
  emit("refresh");
}

const viewModes = computed(() => [
  { value: "day" as const, label: props.i18n.day, icon: "📅" },
  { value: "week" as const, label: props.i18n.week, icon: "📊" },
  { value: "month" as const, label: props.i18n.month, icon: "📆" },
  { value: "year" as const, label: props.i18n.year, icon: "📈" },
  { value: "trend" as const, label: props.i18n.trend, icon: "📈" },
]);

const dayRanges = computed(() => [
  { value: 7 as const, label: props.i18n.days7 },
  { value: 15 as const, label: props.i18n.days15 },
  { value: 30 as const, label: props.i18n.days30 },
  { value: 90 as const, label: props.i18n.quarter },
  { value: 180 as const, label: props.i18n.halfYear },
  { value: 365 as const, label: props.i18n.fullYear },
]);

const monthRanges = computed(() => [
  { value: 1 as const, label: props.i18n.last1Year },
  { value: 2 as const, label: props.i18n.last2Years },
  { value: 3 as const, label: props.i18n.last3Years },
]);

const availableYears = computed(() => {
  const currentYear = new Date().getFullYear();
  const years = [];
  for (let year = currentYear; year >= 2020; year--) {
    years.push(year);
  }
  return years;
});

const periodAvgLabel = computed(() => {
  const labels: Record<string, string> = {
    day: props.i18n.avgLabel,
    week: "周均字数",
    month: "月均字数",
    year: "年均字数",
  };
  return labels[props.modelValue] || props.i18n.avgLabel;
});


</script>

<style scoped lang="scss">
@use "@/variables" as *;
@use "../../superPanel/styles/variables" as *;
@use "../../superPanel/styles/mixins" as *;
@use "../styles/index.scss" as stats;

.view-mode-section {
  .mode-tabs {
    display: flex;
    gap: 4px;
    // margin-bottom: 12px;
    padding: 3px;
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 8px;
  }

  .mode-tab {
    flex: 1;
    padding: 6px 4px;
    border: none;
    background: transparent;
    color: var(--b3-theme-on-surface);
    cursor: pointer;
    font-family: $font-body;
    font-size: 11px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    border-radius: 5px;
    white-space: nowrap;

    &:hover {
      background: var(--b3-theme-background);
      color: var(--b3-theme-primary);
    }

    &.active {
      background: var(--b3-theme-primary);
      color: var(--b3-theme-on-primary);
      box-shadow: 0 2px 8px rgba(var(--b3-theme-primary-rgb), 0.2);
    }
  }

  .range-selector {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-top: 10px;
    justify-content: center;
  }

  .range-btn {
    padding: 5px 12px;
    border: 1px solid var(--b3-border-color);
    background: var(--b3-theme-surface);
    color: var(--b3-theme-on-surface);
    cursor: pointer;
    font-family: $font-body;
    font-size: 10px;
    font-weight: 600;
    border-radius: 15px;

    &:hover {
      border-color: var(--b3-theme-primary);
      color: var(--b3-theme-primary);
      background: var(--b3-theme-primary-lighter, rgba(var(--b3-theme-primary-rgb), 0.05));
    }

    &.active {
      border-color: var(--b3-theme-primary);
      background: var(--b3-theme-primary);
      color: var(--b3-theme-on-primary);
    }
  }

  .year-selector {

    margin-top: 10px;
    .year-select {
      width: 100%;
      padding: 6px 12px;
      border: 1px solid var(--b3-border-color);
      border-radius: 8px;
      background: var(--b3-theme-surface);
      color: var(--b3-theme-on-surface);
      font-family: $font-body;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      outline: none;

      &:focus {
        border-color: var(--b3-theme-primary);
        box-shadow: 0 0 0 2px rgba(var(--b3-theme-primary-rgb), 0.1);
      }
    }
  }

  .period-stats-cards {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 8px;
    margin-top: 10px;
  }

  .period-stat-card {
    @include stats.stats-card-base;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 10px 12px;
    background: stats.$gradient-surface;

    .stat-label {
      font-family: $font-body;
      font-size: 10px;
      font-weight: 600;
      color: var(--b3-theme-on-surface);
      opacity: 0.5;
      margin-bottom: 2px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }

    .stat-value {
      font-family: $font-heading;
      font-size: 16px;
      font-weight: 800;
      color: var(--b3-theme-primary);
    }
  }
}


// Responsive design
@include mobile-only {
  .view-mode-section {
    .mode-tabs {
      overflow-x: auto;
      padding-bottom: 4px;
      
      &::-webkit-scrollbar {
        display: none;
      }
    }

    .mode-tab {
      flex: none;
      padding: 8px 16px;
    }

    .range-selector {
      justify-content: center;
    }

    .period-stats-cards {
      grid-template-columns: 1fr;
      gap: 12px;
    }
  }
}
</style>
