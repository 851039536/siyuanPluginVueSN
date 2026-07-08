<template>
  <div class="base-converter">
    <Input
      v-model="inputValue"
      type="text"
      size="xsmall"
      label="INPUT"
      placeholder="请输入数值"
    />

    <div class="unit-select-row">
      <div class="select-wrapper">
        <Select
          v-model="fromBase"
          :options="baseOptions"
          size="xsmall"
          label="FROM"
        />
      </div>

      <button
        class="swap-btn"
        title="互换进制"
        @click="swapBases"
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
          v-model="toBase"
          :options="baseOptions"
          size="xsmall"
          label="TO"
        />
      </div>
    </div>

    <div
      v-if="result && !error"
      class="converter-result"
    >
      <div class="result-value">
        <span class="input-display">{{ inputValue }}<sub>({{ fromBase }})</sub></span>
        <span class="equals">=</span>
        <span class="output-display">{{ result }}<sub>({{ toBase }})</sub></span>
      </div>
    </div>

    <div
      v-if="error"
      class="converter-error"
    >
      <div class="error-message">
        {{ error }}
      </div>
    </div>

    <div
      v-if="result && !error"
      class="converter-quick-results"
    >
      <h4>QUICK REFERENCE</h4>
      <div class="quick-results-grid">
        <div
          v-for="base in filteredBases"
          :key="base.value"
          class="quick-result-item"
        >
          <span class="base-name">BASE {{ base.value }}</span>
          <span class="base-value">{{ convertToBase(base.value) }}</span>
        </div>
      </div>
    </div>

    <div class="converter-info">
      <h4>CHAR SET</h4>
      <ul>
        <li
          v-for="info in BASES"
          :key="info.value"
        >
          <strong>{{ info.name }} ({{ info.value }}):</strong> {{ info.chars }}
        </li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
// 进制转换器组件：支持 2/8/10/16/32/36 进制互转，含快速参考和有效字符集说明
import {
  computed,
  ref,
} from "vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"

// 进制配置（静态常量）
const BASES = [
  {
    value: 2,
    name: "二进制",
    chars: "0-1",
  },
  {
    value: 8,
    name: "八进制",
    chars: "0-7",
  },
  {
    value: 10,
    name: "十进制",
    chars: "0-9",
  },
  {
    value: 16,
    name: "十六进制",
    chars: "0-9, A-F",
  },
  {
    value: 32,
    name: "三十二进制",
    chars: "0-9, A-V",
  },
  {
    value: 36,
    name: "三十六进制",
    chars: "0-9, A-Z",
  },
] as const

const inputValue = ref("10")
const fromBase = ref(10)
const toBase = ref(2)

// 互换进制
function swapBases() {
  const tmp = fromBase.value
  fromBase.value = toBase.value
  toBase.value = tmp
}

const baseOptions = computed(() =>
  BASES.map((base) => ({
    value: base.value,
    label: `${base.name} (${base.value})`,
  })),
)

const filteredBases = computed(() =>
  BASES.filter((b) => b.value !== fromBase.value),
)

// 预计算有效字符集
const VALID_CHARS_MAP = new Map<number, string>()
for (let i = 2; i <= 36; i++) {
  VALID_CHARS_MAP.set(i, "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ".slice(0, i))
}

function isValidInput(value: string, base: number): boolean {
  if (!value) return false
  const validChars = VALID_CHARS_MAP.get(base)
  if (!validChars) return false

  // 允许首位可选的负号
  const startIndex = value.startsWith("-") ? 1 : 0
  if (startIndex >= value.length) return false // 单独的 "-" 不合法

  for (let i = startIndex; i < value.length; i++) {
    const char = value[i].toUpperCase()
    if (!validChars.includes(char)) return false
  }
  return true
}

// 错误校验（纯 computed，无副作用）
const error = computed(() => {
  if (!inputValue.value) return ""
  if (!isValidInput(inputValue.value, fromBase.value)) {
    return `无效的${fromBase.value}进制输入`
  }
  return ""
})

// 转换指定进制（输入已由 error 校验）
function convertToBase(targetBase: number): string {
  const decimalValue = Number.parseInt(inputValue.value, fromBase.value)
  if (isNaN(decimalValue)) return "无效输入"
  return decimalValue.toString(targetBase).toUpperCase()
}

const result = computed(() => {
  if (!inputValue.value) return ""
  if (error.value) return ""
  return convertToBase(toBase.value)
})
</script>

<style lang="scss" scoped>
@use "../styles/index.scss" as *;

.base-converter {
  display: flex;
  flex-direction: column;
  gap: 12px;

  sub {
    font-size: 0.7em;
    opacity: 0.5;
    margin-left: 2px;
  }
}
</style>
