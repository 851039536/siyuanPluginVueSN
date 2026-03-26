<template>
  <div class="volume-converter">
    <Input
      v-model="inputValue"
      type="number"
      label="输入值"
      placeholder="请输入数值"
      @input="convert"
    />

    <Select
      v-model="fromUnit"
      :options="unitOptions"
      label="从单位"
      @change="convert"
    />

    <Select
      v-model="toUnit"
      :options="unitOptions"
      label="到单位"
      @change="convert"
    />

    <div class="converter-result" v-if="result !== null">
      <div class="result-value">
        <span class="input-display">{{ inputValue }} {{ getUnitSymbol(fromUnit) }}</span>
        <span class="equals"> = </span>
        <span class="output-display">{{ result }} {{ getUnitSymbol(toUnit) }}</span>
      </div>
    </div>

    <div class="converter-quick-results" v-if="result !== null">
      <h4>快速转换结果</h4>
      <div class="quick-results-grid">
        <div 
          v-for="unit in units.filter(u => u.key !== fromUnit)" 
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
import { ref, computed } from 'vue'
import Input from '@/components/Input.vue'
import Select from '@/components/Select.vue'

interface I18n {
  inputValue?: string
  fromUnit?: string
  toUnit?: string
  placeholder?: string
  quickResults?: string
}

interface Props {
  i18n?: I18n
}

defineProps<Props>()

const inputValue = ref('1')
const fromUnit = ref('cubicMeter')
const toUnit = ref('liter')

const units = [
  { key: 'milliliter', name: '毫升', symbol: 'mL', factor: 1e-6 },
  { key: 'centiliter', name: '厘升', symbol: 'cL', factor: 1e-5 },
  { key: 'deciliter', name: '分升', symbol: 'dL', factor: 1e-4 },
  { key: 'liter', name: '升', symbol: 'L', factor: 0.001 },
  { key: 'cubicMillimeter', name: '立方毫米', symbol: 'mm³', factor: 1e-9 },
  { key: 'cubicCentimeter', name: '立方厘米', symbol: 'cm³', factor: 1e-6 },
  { key: 'cubicMeter', name: '立方米', symbol: 'm³', factor: 1 },
  { key: 'cubicKilometer', name: '立方千米', symbol: 'km³', factor: 1e9 },
  { key: 'teaspoon', name: '茶匙', symbol: 'tsp', factor: 4.92892e-6 },
  { key: 'tablespoon', name: '汤匙', symbol: 'tbsp', factor: 1.47868e-5 },
  { key: 'fluidOunce', name: '液盎司', symbol: 'fl oz', factor: 2.95735e-5 },
  { key: 'cup', name: '杯', symbol: 'cup', factor: 0.000236588 },
  { key: 'pint', name: '品脱', symbol: 'pt', factor: 0.000473176 },
  { key: 'quart', name: '夸脱', symbol: 'qt', factor: 0.000946353 },
  { key: 'gallon', name: '加仑', symbol: 'gal', factor: 0.00378541 },
  { key: 'cubicInch', name: '立方英寸', symbol: 'in³', factor: 1.63871e-5 },
  { key: 'cubicFoot', name: '立方英尺', symbol: 'ft³', factor: 0.0283168 },
  { key: 'cubicYard', name: '立方码', symbol: 'yd³', factor: 0.764555 }
]

const unitOptions = computed(() => 
  units.map(unit => ({
    value: unit.key,
    label: `${unit.name} (${unit.symbol})`
  }))
)

const getUnitFactor = (unitKey: string) => {
  const unit = units.find(u => u.key === unitKey)
  return unit ? unit.factor : 1
}

const getUnitSymbol = (unitKey: string) => {
  const unit = units.find(u => u.key === unitKey)
  return unit ? unit.symbol : ''
}

const convertToUnit = (targetUnit: string) => {
  const value = parseFloat(inputValue.value) || 0
  const fromFactor = getUnitFactor(fromUnit.value)
  const toFactor = getUnitFactor(targetUnit)
  const result = (value * fromFactor) / toFactor
  return formatResult(result)
}

const result = computed(() => {
  return convertToUnit(toUnit.value)
})

const formatResult = (value: number) => {
  if (value === 0) return '0'
  if (value < 0.000001) return value.toExponential(6)
  if (value < 0.01) return value.toFixed(8)
  if (value < 1) return value.toFixed(6)
  if (value > 1000000) return value.toExponential(6)
  return value.toFixed(6).replace(/\.?0+$/, '')
}

const convert = () => {
  // 转换逻辑在computed中处理
}
</script>

<style lang="scss" scoped>
.volume-converter {
  display: flex;
  flex-direction: column;
  gap: 16px;

  .converter-result {
    padding: 16px;
    background: var(--b3-theme-surface);
    border-radius: 8px;
    border-left: 4px solid var(--b3-primary);

    .result-value {
      font-size: 16px;
      font-weight: 600;
      color: var(--b3-theme-on-surface);
      text-align: center;

      .input-display {
        color: var(--b3-theme-secondary);
      }

      .equals {
        color: var(--b3-theme-outline);
        margin: 0 8px;
      }

      .output-display {
        color: var(--b3-primary);
      }
    }
  }

  .converter-quick-results {
    h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 500;
      color: var(--b3-theme-on-surface);
    }

    .quick-results-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 8px;

      .quick-result-item {
        display: flex;
        justify-content: space-between;
        padding: 8px 12px;
        background: var(--b3-theme-surface);
        border-radius: 4px;
        font-size: 12px;

        .unit-name {
          color: var(--b3-theme-on-surface);
          font-weight: 500;
        }

        .unit-value {
          color: var(--b3-theme-secondary);
        }
      }
    }
  }
}
</style>