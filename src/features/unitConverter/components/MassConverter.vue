<template>
  <div class="mass-converter">
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
const fromUnit = ref('kilogram')
const toUnit = ref('gram')

const units = [
  { key: 'microgram', name: '微克', symbol: 'μg', factor: 1e-9 },
  { key: 'milligram', name: '毫克', symbol: 'mg', factor: 1e-6 },
  { key: 'gram', name: '克', symbol: 'g', factor: 0.001 },
  { key: 'kilogram', name: '千克', symbol: 'kg', factor: 1 },
  { key: 'metricTon', name: '公吨', symbol: 't', factor: 1000 },
  { key: 'carat', name: '克拉', symbol: 'ct', factor: 0.0002 },
  { key: 'ounce', name: '盎司', symbol: 'oz', factor: 0.0283495 },
  { key: 'pound', name: '磅', symbol: 'lb', factor: 0.453592 },
  { key: 'stone', name: '石', symbol: 'st', factor: 6.35029 },
  { key: 'shortTon', name: '短吨', symbol: 'US ton', factor: 907.185 },
  { key: 'longTon', name: '长吨', symbol: 'UK ton', factor: 1016.05 },
  { key: 'grain', name: '格令', symbol: 'gr', factor: 6.47989e-5 },
  { key: 'dram', name: '打兰', symbol: 'dr', factor: 0.00177185 },
  { key: 'quarter', name: '四分之一英担', symbol: 'qr', factor: 12.7006 },
  { key: 'hundredweight', name: '英担', symbol: 'cwt', factor: 50.8023 }
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
.mass-converter {
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