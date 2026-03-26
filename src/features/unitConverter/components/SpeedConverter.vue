<template>
  <div class="speed-converter">
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
const fromUnit = ref('meterPerSecond')
const toUnit = ref('kilometerPerHour')

const units = [
  { key: 'millimeterPerSecond', name: '毫米/秒', symbol: 'mm/s', factor: 0.001 },
  { key: 'centimeterPerSecond', name: '厘米/秒', symbol: 'cm/s', factor: 0.01 },
  { key: 'meterPerSecond', name: '米/秒', symbol: 'm/s', factor: 1 },
  { key: 'kilometerPerSecond', name: '千米/秒', symbol: 'km/s', factor: 1000 },
  { key: 'kilometerPerHour', name: '千米/小时', symbol: 'km/h', factor: 0.2777777778 },
  { key: 'meterPerHour', name: '米/小时', symbol: 'm/h', factor: 0.0002777778 },
  { key: 'milePerHour', name: '英里/小时', symbol: 'mph', factor: 0.44704 },
  { key: 'footPerSecond', name: '英尺/秒', symbol: 'ft/s', factor: 0.3048 },
  { key: 'footPerHour', name: '英尺/小时', symbol: 'ft/h', factor: 0.0000846667 },
  { key: 'yardPerSecond', name: '码/秒', symbol: 'yd/s', factor: 0.9144 },
  { key: 'yardPerHour', name: '码/小时', symbol: 'yd/h', factor: 0.000254 },
  { key: 'knot', name: '节', symbol: 'kn', factor: 0.5144444444 },
  { key: 'mach', name: '马赫', symbol: 'Ma', factor: 343 },
  { key: 'speedOfLight', name: '光速', symbol: 'c', factor: 299792458 },
  { key: 'milePerSecond', name: '英里/秒', symbol: 'mi/s', factor: 1609.344 }
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
.speed-converter {
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