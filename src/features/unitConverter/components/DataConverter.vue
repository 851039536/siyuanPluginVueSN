<template>
  <div class="data-converter">
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
const fromUnit = ref('byte')
const toUnit = ref('kilobyte')

const units = [
  { key: 'bit', name: '位', symbol: 'bit', factor: 0.125 },
  { key: 'byte', name: '字节', symbol: 'B', factor: 1 },
  { key: 'kilobyte', name: '千字节', symbol: 'KB', factor: 1024 },
  { key: 'megabyte', name: '兆字节', symbol: 'MB', factor: 1048576 },
  { key: 'gigabyte', name: '吉字节', symbol: 'GB', factor: 1073741824 },
  { key: 'terabyte', name: '太字节', symbol: 'TB', factor: 1099511627776 },
  { key: 'petabyte', name: '拍字节', symbol: 'PB', factor: 1125899906842624 },
  { key: 'exabyte', name: '艾字节', symbol: 'EB', factor: 1.152921504606847e+18 },
  { key: 'kilobit', name: '千位', symbol: 'Kbit', factor: 128 },
  { key: 'megabit', name: '兆位', symbol: 'Mbit', factor: 131072 },
  { key: 'gigabit', name: '吉位', symbol: 'Gbit', factor: 134217728 },
  { key: 'terabit', name: '太位', symbol: 'Tbit', factor: 137438953472 },
  { key: 'petabit', name: '拍位', symbol: 'Pbit', factor: 140737488355328 },
  { key: 'exabit', name: '艾位', symbol: 'Ebit', factor: 1.4411518807585587e+17 },
  { key: 'kibibyte', name: '二进制千字节', symbol: 'KiB', factor: 1024 },
  { key: 'mebibyte', name: '二进制兆字节', symbol: 'MiB', factor: 1048576 },
  { key: 'gibibyte', name: '二进制吉字节', symbol: 'GiB', factor: 1073741824 },
  { key: 'tebibyte', name: '二进制太字节', symbol: 'TiB', factor: 1099511627776 }
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
.data-converter {
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