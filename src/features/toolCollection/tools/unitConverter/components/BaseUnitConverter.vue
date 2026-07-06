<template>
  <div class="base-unit-converter">
    <div class="input-section">
      <Input
        v-model="inputValue"
        type="number"
        size="xsmall"
        label="INPUT"
        placeholder="请输入数值"
      />
    </div>

    <div class="unit-select-row">
      <div class="select-wrapper">
        <Select
          v-model="fromUnit"
          :options="unitOptions"
          size="xsmall"
          label="FROM"
        />
      </div>

      <button
        class="swap-btn"
        title="互换单位"
        @click="swapUnits"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          stroke-width="2"
          stroke-linecap="round"
          stroke-linejoin="round"
        >
          <path d="M7 16V4m0 12l-3-3m3 3l3-3" />
          <path d="M17 8v12m0-12l3 3m-3-3l-3 3" />
        </svg>
      </button>

      <div class="select-wrapper">
        <Select
          v-model="toUnit"
          :options="unitOptions"
          size="xsmall"
          label="TO"
        />
      </div>
    </div>

    <div
      v-if="result"
      class="converter-result"
    >
      <div class="result-value">
        <span class="input-display">{{ inputValue }} {{ lookup.getSymbol(fromUnit) }}</span>
        <span class="equals">=</span>
        <span class="output-display">{{ result }} {{ lookup.getSymbol(toUnit) }}</span>
      </div>
    </div>

    <div
      v-if="result && showQuickResults"
      class="converter-quick-results"
    >
      <h4>QUICK REFERENCE</h4>
      <div class="quick-results-grid">
        <div
          v-for="unit in filteredUnits"
          :key="unit.key"
          class="quick-result-item"
        >
          <span class="unit-name">{{ unit.symbol }}</span>
          <span class="unit-value">{{ convertToUnit(unit.key) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { UnitDefinition } from "../utils/converter"
import {
  computed,
  ref,
} from "vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"
import {
  convertUnit,
  createUnitLookup,
  formatResult,
  generateUnitOptions,
} from "../utils/converter"

interface Props {
  units: UnitDefinition[]
  defaultFrom?: string
  defaultTo?: string
  showQuickResults?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  defaultFrom: "",
  defaultTo: "",
  showQuickResults: true,
})

// 创建查找器（只创建一次）
const lookup = computed(() => createUnitLookup(props.units))

const inputValue = ref("1")
const fromUnit = ref(props.defaultFrom || props.units[0]?.key || "")
const toUnit = ref(props.defaultTo || props.units[1]?.key || "")

// 互换单位
function swapUnits() {
  const tmp = fromUnit.value
  fromUnit.value = toUnit.value
  toUnit.value = tmp
}

// 生成选项（缓存）
const unitOptions = computed(() => generateUnitOptions(props.units))

// 过滤后的单位列表（排除当前源单位）
const filteredUnits = computed(() =>
  props.units.filter((u: UnitDefinition) => u.key !== fromUnit.value),
)

// 转换结果
const result = computed(() => convertToUnit(toUnit.value))

// 转换到指定单位
function convertToUnit(targetUnit: string): string {
  const value = Number.parseFloat(inputValue.value)
  if (isNaN(value)) return "0"

  const fromFactor = lookup.value.getFactor(fromUnit.value)
  const toFactor = lookup.value.getFactor(targetUnit)
  const converted = convertUnit(value, fromFactor, toFactor)

  return formatResult(converted)
}
</script>

<style lang="scss" scoped>
@use "../styles/index.scss" as *;

.base-unit-converter {
  display: flex;
  flex-direction: column;
  gap: 12px;
}
</style>
