<template>
  <div class="base-unit-converter">
    <Input
      v-model="inputValue"
      type="number"
      label="输入值"
      placeholder="请输入数值"
    />

    <Select
      v-model="fromUnit"
      :options="unitOptions"
      label="从单位"
    />

    <Select
      v-model="toUnit"
      :options="unitOptions"
      label="到单位"
    />

    <div class="converter-result" v-if="result">
      <div class="result-value">
        <span class="input-display">{{ inputValue }} {{ lookup.getSymbol(fromUnit) }}</span>
        <span class="equals"> = </span>
        <span class="output-display">{{ result }} {{ lookup.getSymbol(toUnit) }}</span>
      </div>
    </div>

    <div class="converter-quick-results" v-if="result && showQuickResults">
      <h4>快速转换结果</h4>
      <div class="quick-results-grid">
        <div
          v-for="unit in filteredUnits"
          :key="unit.key"
          class="quick-result-item"
        >
          <span class="unit-name">{{ unit.name }}:</span>
          <span class="unit-value">{{ convertToUnit(unit.key) }} {{ unit.symbol }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, shallowRef } from 'vue'
import Input from '@/components/Input.vue'
import Select from '@/components/Select.vue'
import {
  type UnitDefinition,
  formatResult,
  createUnitLookup,
  convertUnit,
  generateUnitOptions
} from '../utils/converter'

interface Props {
  units: UnitDefinition[]
  defaultFrom?: string
  defaultTo?: string
  showQuickResults?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  defaultFrom: '',
  defaultTo: '',
  showQuickResults: true
})

// 使用 shallowRef 优化性能，单位数组不需要深层响应式
const unitsRef = shallowRef(props.units)

// 创建查找器（只创建一次）
const lookup = computed(() => createUnitLookup(unitsRef.value))

const inputValue = ref('1')
const fromUnit = ref(props.defaultFrom || props.units[0]?.key || '')
const toUnit = ref(props.defaultTo || props.units[1]?.key || '')

// 生成选项（缓存）
const unitOptions = computed(() => generateUnitOptions(unitsRef.value))

// 过滤后的单位列表（排除当前源单位）
const filteredUnits = computed(() =>
  unitsRef.value.filter(u => u.key !== fromUnit.value)
)

// 转换结果
const result = computed(() => convertToUnit(toUnit.value))

// 转换到指定单位
function convertToUnit(targetUnit: string): string {
  const value = parseFloat(inputValue.value)
  if (isNaN(value)) return '0'
  
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
  gap: 16px;
}
</style>
