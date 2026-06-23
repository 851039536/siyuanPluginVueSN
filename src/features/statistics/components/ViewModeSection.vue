<template>
  <div class="view-mode-section">
    <!-- 视图模式切换 -->
    <div class="mode-row">
      <div class="mode-tabs">
        <button
          v-for="mode in periodModes"
          :key="mode.value"
          class="mode-tab"
          :class="{ active: modelValue === mode.value }"
          @click="$emit('update:modelValue', mode.value)"
        >
          <IconWrapper
            v-if="mode.icon"
            :name="mode.icon"
            :size="12"
          />
          {{ mode.label }}
        </button>
      </div>
    </div>

    <!-- 时段统计卡片 -->
    <div
      v-if="periodAvgWords > 0 || periodTotalWords > 0"
      class="period-stats-cards"
    >
      <div
        v-if="periodAvgWords > 0"
        class="period-stat-card"
      >
        <span class="stat-value">{{ formatNumber(periodAvgWords) }} {{ i18n.wordsUnit || '字' }}</span>
        <span class="stat-label">{{ periodAvgLabel }}</span>
      </div>
      <div
        v-if="periodTotalWords > 0"
        class="period-stat-card"
      >
        <span class="stat-value">{{ formatNumber(periodTotalWords) }} {{ i18n.wordsUnit }}</span>
        <span class="stat-label">{{ i18n.totalLabel || '总字数' }}</span>
      </div>
    </div>


    <!-- 日视图范围选择 -->
    <div
      v-if="modelValue === 'day'"
      class="range-selector"
    >
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
    <div
      v-if="modelValue === 'month'"
      class="range-selector"
    >
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
    <div
      v-if="modelValue === 'year'"
      class="year-selector"
    >
      <select
        :value="selectedYear"
        class="year-select"
        @change="$emit('update:selectedYear', Number(($event.target as HTMLSelectElement).value)); $emit('refresh')"
      >
        <option
          v-for="year in availableYears"
          :key="year"
          :value="year"
        >
          {{ year }}
        </option>
      </select>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { formatNumber } from "../utils"

interface Props {
  modelValue?: "day" | "week" | "month" | "year"
  dayRange?: 7 | 15 | 30 | 90 | 180 | 365
  monthYearRange?: 1 | 2 | 3
  selectedYear?: number
  periodAvgWords?: number
  periodTotalWords?: number
  i18n?: Record<string, any>
}

interface Emits {
  (
    e: "update:modelValue",
    value: "day" | "week" | "month" | "year",
  ): void
  (e: "update:dayRange", value: 7 | 15 | 30 | 90 | 180 | 365): void
  (e: "update:monthYearRange", value: 1 | 2 | 3): void
  (e: "update:selectedYear", value: number): void
  (e: "refresh"): void
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
    weekAvg: "周均字数",
    monthAvg: "月均字数",
    yearAvg: "年均字数",
  }),
})

const emit = defineEmits<Emits>()

function onRangeChange(mode: "day" | "month", value: number): void {
  if (mode === "day") {
    emit("update:dayRange", value as 7 | 15 | 30 | 90 | 180 | 365)
  } else {
    emit("update:monthYearRange", value as 1 | 2 | 3)
  }
  emit("refresh")
}

const periodModes = computed(() => [
  {
    value: "day" as const,
    label: props.i18n.day || '日',
    icon: "list" as const,
  },
  {
    value: "week" as const,
    label: props.i18n.week || '周',
    icon: "format" as const,
  },
  {
    value: "month" as const,
    label: props.i18n.month || '月',
    icon: "list" as const,
  },
  {
    value: "year" as const,
    label: props.i18n.year || '年',
    icon: undefined,
  },
])

const dayRanges = computed(() => [
  {
    value: 7 as const,
    label: props.i18n.days7 || '7天',
  },
  {
    value: 15 as const,
    label: props.i18n.days15 || '15天',
  },
  {
    value: 30 as const,
    label: props.i18n.days30 || '30天',
  },
  {
    value: 90 as const,
    label: props.i18n.quarter || '季度',
  },
  {
    value: 180 as const,
    label: props.i18n.halfYear || '半年',
  },
  {
    value: 365 as const,
    label: props.i18n.fullYear || '整年',
  },
])

const monthRanges = computed(() => [
  {
    value: 1 as const,
    label: props.i18n.last1Year || '最近一年',
  },
  {
    value: 2 as const,
    label: props.i18n.last2Years || '最近两年',
  },
  {
    value: 3 as const,
    label: props.i18n.last3Years || '最近三年',
  },
])

const availableYears = computed(() => {
  const currentYear = new Date().getFullYear()
  const years = []
  for (let year = currentYear; year >= 2020; year--) {
    years.push(year)
  }
  return years
})

const periodAvgLabel = computed(() => {
  const labels: Record<string, string> = {
    day: props.i18n.avgLabel || '日均字数',
    week: props.i18n.weekAvg || '周均字数',
    month: props.i18n.monthAvg || '月均字数',
    year: props.i18n.yearAvg || '年均字数',
  }
  return labels[props.modelValue] || props.i18n.avgLabel || '日均字数'
})


</script>

<style scoped lang="scss">
@use "@/variables" as *;
@use "../../superPanel/styles/shared" as *;
@use "../styles/index.scss" as stats;

.view-mode-section {
  .mode-row {
    display: flex;
    gap: 6px;
    align-items: center;
  }

  .mode-tabs {
    display: flex;
    flex: 1;
    gap: 4px;
    padding: 3px;
    background: var(--b3-theme-surface);
    border: 1px solid var(--b3-border-color);
    border-radius: 4px;
    align-items: center;
  }

  .mode-tab {
    flex: 1;
    padding: 6px 4px;
    border: none;
    background: transparent;
    color: var(--b3-theme-on-surface);
    cursor: pointer;
    font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
    font-size: 11px;
    font-weight: 600;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    border-radius: 4px;
    white-space: nowrap;

    &:hover {
      background: var(--b3-theme-background);
      color: var(--b3-theme-primary);
    }

    &.active {
      background: var(--b3-theme-primary);
      color: var(--b3-theme-on-primary);
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
    font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
    font-size: 10px;
    font-weight: 600;
    border-radius: 4px;

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
      border-radius: 4px;
      background: var(--b3-theme-surface);
      color: var(--b3-theme-on-surface);
      font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
      font-size: 12px;
      font-weight: 600;
      cursor: pointer;
      outline: none;

      &:focus {
        border-color: var(--b3-theme-primary);
        box-shadow: 0 0 0 2px var(--b3-theme-primary-lightest, rgba(var(--b3-theme-primary-rgb), 0.12));
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
      font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      color: var(--b3-theme-on-surface);
      opacity: 0.45;
      margin-bottom: 2px;
    }

    .stat-value {
      font-family: "JetBrains Mono", "Fira Code", "Consolas", monospace;
      font-size: 16px;
      font-weight: 700;
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
