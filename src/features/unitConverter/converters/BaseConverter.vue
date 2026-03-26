<template>
  <div class="base-converter">
    <Input
      v-model="inputValue"
      type="text"
      label="输入值"
      placeholder="请输入数值"
      @input="convert"
    />

    <Select
      v-model="fromBase"
      :options="baseOptions"
      label="从进制"
      @change="convert"
    />

    <Select
      v-model="toBase"
      :options="baseOptions"
      label="到进制"
      @change="convert"
    />

    <div class="converter-result" v-if="result && !error">
      <div class="result-value">
        <span class="input-display">{{ inputValue }} ({{ fromBase }})</span>
        <span class="equals"> = </span>
        <span class="output-display">{{ result }} ({{ toBase }})</span>
      </div>
    </div>

    <div class="converter-error" v-if="error">
      <div class="error-message">{{ error }}</div>
    </div>

    <div class="converter-quick-results" v-if="result && !error">
      <h4>快速转换结果</h4>
      <div class="quick-results-grid">
        <div
          v-for="base in bases.filter(b => b.value !== fromBase)"
          :key="base.value"
          class="quick-result-item"
        >
          <span class="base-name">{{ base.name }}:</span>
          <span class="base-value">{{ convertToBase(base.value) }}</span>
        </div>
      </div>
    </div>

    <div class="converter-info">
      <h4>使用说明</h4>
      <ul>
        <li v-for="info in usageInfo" :key="info.base">
          <strong>{{ info.name }} ({{ info.base }}):</strong> {{ info.chars }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import Input from '@/components/Input.vue'
import Select from '@/components/Select.vue'

interface I18n {
  inputValue?: string
  fromBase?: string
  toBase?: string
  placeholder?: string
  quickResults?: string
  usageInfo?: string
  invalidInput?: string
}

interface Props {
  i18n?: I18n
}

defineProps<Props>()

const inputValue = ref('10')
const fromBase = ref(10)
const toBase = ref(2)
const error = ref('')

const bases = [
  { value: 2, name: '二进制' },
  { value: 8, name: '八进制' },
  { value: 10, name: '十进制' },
  { value: 16, name: '十六进制' },
  { value: 32, name: '三十二进制' },
  { value: 36, name: '三十六进制' }
]

const baseOptions = computed(() => 
  bases.map(base => ({
    value: base.value,
    label: `${base.name} (${base.value})`
  }))
)

const usageInfo = [
  { base: 2, name: '二进制', chars: '0-1' },
  { base: 8, name: '八进制', chars: '0-7' },
  { base: 10, name: '十进制', chars: '0-9' },
  { base: 16, name: '十六进制', chars: '0-9, A-F' },
  { base: 32, name: '三十二进制', chars: '0-9, A-V' },
  { base: 36, name: '三十六进制', chars: '0-9, A-Z' }
]

const isValidInput = (value: string, base: number): boolean => {
  if (!value) return false

  const validChars = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ'.slice(0, base)
  const upperValue = value.toUpperCase()

  for (const char of upperValue) {
    if (!validChars.includes(char)) {
      return false
    }
  }

  return true
}

const convertToBase = (targetBase: number): string => {
  if (!isValidInput(inputValue.value, fromBase.value)) {
    return '无效输入'
  }

  try {
    // 先转换为十进制
    const decimalValue = parseInt(inputValue.value, fromBase.value)

    if (isNaN(decimalValue)) {
      return '无效输入'
    }

    // 再转换为目标进制
    return decimalValue.toString(targetBase).toUpperCase()
  } catch (e) {
    return '转换错误'
  }
}

const result = computed(() => {
  error.value = ''

  if (!inputValue.value) return ''

  if (!isValidInput(inputValue.value, fromBase.value)) {
    error.value = `无效的${fromBase.value}进制输入`
    return ''
  }

  return convertToBase(toBase.value)
})

const convert = () => {
  // 转换逻辑在computed中处理
}
</script>

<style lang="scss" scoped>
.base-converter {
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

  .converter-error {
    padding: 16px;
    background: var(--b3-theme-error-container);
    border-radius: 8px;
    border-left: 4px solid var(--b3-error);

    .error-message {
      font-size: 14px;
      color: var(--b3-error);
      text-align: center;
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

        .base-name {
          color: var(--b3-theme-on-surface);
          font-weight: 500;
        }

        .base-value {
          color: var(--b3-theme-secondary);
        }
      }
    }
  }

  .converter-info {
    h4 {
      margin: 0 0 12px 0;
      font-size: 14px;
      font-weight: 500;
      color: var(--b3-theme-on-surface);
    }

    ul {
      margin: 0;
      padding-left: 20px;
      font-size: 12px;
      color: var(--b3-theme-on-surface);
      line-height: 1.5;

      li {
        margin-bottom: 4px;
      }
    }
  }
}
</style>
