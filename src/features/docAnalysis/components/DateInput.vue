<template>
  <div
    ref="containerRef"
    class="date-input-wrapper"
  >
    <input
      ref="inputRef"
      type="text"
      class="date-text-input"
      :value="displayValue"
      :placeholder="placeholder"
      @input="handleInput"
      @focus="openPicker"
      @keydown.enter="($event.target as HTMLInputElement).blur()"
    />
    <Icon
      v-if="modelValue"
      icon="mdi:close-circle"
      class="date-clear-btn"
      @click.stop="clearValue"
    />
    <Icon
      icon="mdi:calendar-blank-outline"
      class="date-calendar-btn"
      @click.stop="togglePicker"
    />

    <div
      v-if="pickerOpen"
      class="date-picker-dropdown"
    >
      <div class="picker-nav">
        <button
          class="picker-nav-btn"
          @click="changeMonth(-1)"
        >
          <Icon icon="mdi:chevron-left" />
        </button>
        <span class="picker-nav-title">{{ viewYear }}-{{ String(viewMonth + 1).padStart(2, "0") }}</span>
        <button
          class="picker-nav-btn"
          @click="changeMonth(1)"
        >
          <Icon icon="mdi:chevron-right" />
        </button>
      </div>
      <div class="picker-weekdays">
        <span
          v-for="d in WEEKDAYS"
          :key="d"
          class="picker-wd"
        >{{ d }}</span>
      </div>
      <div class="picker-days">
        <button
          v-for="(day, i) in calendarDays"
          :key="i"
          class="picker-day"
          :class="{
            'other-month': !day.current,
            'today': day.isToday,
            'selected': day.selected,
          }"
          @click="selectDay(day.date)"
        >
          {{ day.day }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue"

withDefaults(defineProps<Props>(), {
  placeholder: "yyyy-MM-dd",
})

const WEEKDAYS = ["一", "二", "三", "四", "五", "六", "日"]

interface Props {
  placeholder?: string
}

const modelValue = defineModel<string>({ default: "" })

const containerRef = ref<HTMLElement>()
const inputRef = ref<HTMLInputElement>()
const pickerOpen = ref(false)
const viewYear = ref(new Date().getFullYear())
const viewMonth = ref(new Date().getMonth())

const displayValue = computed(() => modelValue.value || "")

function syncViewToValue() {
  if (modelValue.value) {
    const parts = modelValue.value.split("-")
    if (parts.length === 3) {
      viewYear.value = Number(parts[0])
      viewMonth.value = Number(parts[1]) - 1
    }
  }
}

function openPicker() {
  syncViewToValue()
  pickerOpen.value = true
}

function togglePicker() {
  if (pickerOpen.value) {
    pickerOpen.value = false
  }
  else {
    syncViewToValue()
    pickerOpen.value = true
    nextTick(() => inputRef.value?.focus())
  }
}

function handleInput(e: Event) {
  const val = (e.target as HTMLInputElement).value.trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) {
    modelValue.value = val
  }
}

function clearValue() {
  modelValue.value = ""
  pickerOpen.value = false
}

function changeMonth(delta: number) {
  viewMonth.value += delta
  if (viewMonth.value > 11) {
    viewMonth.value = 0
    viewYear.value++
  }
  else if (viewMonth.value < 0) {
    viewMonth.value = 11
    viewYear.value--
  }
}

const calendarDays = computed(() => {
  const y = viewYear.value
  const m = viewMonth.value
  const firstDay = new Date(y, m, 1)
  let startWeekday = firstDay.getDay() - 1
  if (startWeekday < 0) startWeekday = 6

  const daysInMonth = new Date(y, m + 1, 0).getDate()
  const prevMonthLast = new Date(y, m, 0).getDate()

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`

  const days: { day: number, date: string, current: boolean, isToday: boolean, selected: boolean }[] = []

  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = prevMonthLast - i
    const pm = m === 0 ? 11 : m - 1
    const py = m === 0 ? y - 1 : y
    const dateStr = `${py}-${String(pm + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    days.push({
      day: d,
      date: dateStr,
      current: false,
      isToday: dateStr === todayStr,
      selected: dateStr === modelValue.value,
    })
  }

  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    days.push({
      day: d,
      date: dateStr,
      current: true,
      isToday: dateStr === todayStr,
      selected: dateStr === modelValue.value,
    })
  }

  const total = days.length
  const remaining = total <= 35 ? 35 - total : 42 - total
  for (let d = 1; d <= remaining; d++) {
    const nm = m === 11 ? 0 : m + 1
    const ny = m === 11 ? y + 1 : y
    const dateStr = `${ny}-${String(nm + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`
    days.push({
      day: d,
      date: dateStr,
      current: false,
      isToday: dateStr === todayStr,
      selected: dateStr === modelValue.value,
    })
  }

  return days
})

function selectDay(dateStr: string) {
  modelValue.value = dateStr
  pickerOpen.value = false
}

function handleClickOutside(e: MouseEvent) {
  if (containerRef.value && !containerRef.value.contains(e.target as Node)) {
    pickerOpen.value = false
  }
}

onMounted(() => {
  document.addEventListener("click", handleClickOutside, true)
})

onBeforeUnmount(() => {
  document.removeEventListener("click", handleClickOutside, true)
})

watch(pickerOpen, (val) => {
  if (val) syncViewToValue()
})
</script>

<style lang="scss" scoped>
@use "../styles/codex-tokens" as *;

.date-input-wrapper {
  position: relative;
  display: flex;
  align-items: center;

  .date-text-input {
    width: 100%;
    padding: 4px 38px 4px 6px;
    border: 1px solid var(--b3-border-color);
    border-radius: $da-radius;
    background: var(--b3-theme-background);
    color: var(--b3-theme-on-background);
    font-size: 11px;
    font-family: $da-mono;
    outline: none;
    min-width: 0;

    &:focus {
      border-color: var(--b3-theme-primary);
      box-shadow: 0 0 0 2px var(--b3-theme-primary-lightest);
    }

    &::placeholder {
      color: var(--b3-theme-on-surface-variant);
      opacity: 0.5;
    }
  }

  .date-clear-btn {
    position: absolute;
    right: 18px;
    font-size: 12px;
    color: var(--b3-theme-on-surface-variant);
    opacity: 0.4;
    cursor: pointer;

    &:hover {
      opacity: 0.8;
    }
  }

  .date-calendar-btn {
    position: absolute;
    right: 4px;
    font-size: 13px;
    color: var(--b3-theme-on-surface-variant);
    opacity: 0.5;
    cursor: pointer;

    &:hover {
      opacity: 0.9;
      color: var(--b3-theme-primary);
    }
  }
}

.date-picker-dropdown {
  position: absolute;
  top: 100%;
  left: 0;
  z-index: 10001;
  margin-top: 2px;
  width: 224px;
  padding: 6px;
  border-radius: $da-radius;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-border-color);

  .picker-nav {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 4px;

    &-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      border: 1px solid var(--b3-border-color);
      border-radius: $da-radius;
      background: transparent;
      color: var(--b3-theme-on-surface-variant);
      cursor: pointer;
      font-size: 16px;

      &:hover {
        background: var(--b3-list-hover);
      }
    }

    &-title {
      font-size: 12px;
      font-weight: 600;
      font-family: $da-mono;
      color: var(--b3-theme-on-background);
    }
  }

  .picker-weekdays {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    margin-bottom: 2px;

    .picker-wd {
      text-align: center;
      font-size: 10px;
      color: var(--b3-theme-on-surface-variant);
      padding: 2px 0;
    }
  }

  .picker-days {
    display: grid;
    grid-template-columns: repeat(7, 1fr);
    gap: 1px;

    .picker-day {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 28px;
      height: 26px;
      margin: 0 auto;
      border: none;
      border-radius: $da-radius;
      background: transparent;
      color: var(--b3-theme-on-background);
      font-size: 11px;
      cursor: pointer;

      &:hover {
        background: var(--b3-list-hover);
      }

      &.other-month {
        opacity: 0.3;
      }

      &.today {
        font-weight: 700;
        color: var(--b3-theme-primary);
      }

      &.selected {
        background: var(--b3-theme-primary);
        color: var(--b3-theme-on-primary);
      }
    }
  }
}
</style>
