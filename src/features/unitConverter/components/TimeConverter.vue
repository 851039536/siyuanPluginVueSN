<template>
  <div class="time-converter">
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
const fromUnit = ref('second')
const toUnit = ref('minute')

const units = [
  { key: 'nanosecond', name: '纳秒', symbol: 'ns', factor: 1e-9 },
  { key: 'microsecond', name: '微秒', symbol: 'μs', factor: 1e-6 },
  { key: 'millisecond', name: '毫秒', symbol: 'ms', factor: 0.001 },
  { key: 'second', name: '秒', symbol: 's', factor: 1 },
  { key: 'minute', name: '分钟', symbol: 'min', factor: 60 },
  { key: 'hour', name: '小时', symbol: 'h', factor: 3600 },
  { key: 'day', name: '天', symbol: 'd', factor: 86400 },
  { key: 'week', name: '周', symbol: 'week', factor: 604800 },
  { key: 'fortnight', name: '两周', symbol: '2 weeks', factor: 1209600 },
  { key: 'month', name: '月', symbol: 'month', factor: 2628000 },
  { key: 'quarter', name: '季度', symbol: 'quarter', factor: 7884000 },
  { key: 'year', name: '年', symbol: 'year', factor: 31536000 },
  { key: 'decade', name: '十年', symbol: 'decade', factor: 315360000 },
  { key: 'century', name: '世纪', symbol: 'century', factor: 3153600000 },
  { key: 'millennium', name: '千年', symbol: 'millennium', factor: 31536000000 }
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
.time-converter {
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