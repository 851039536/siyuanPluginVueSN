<template>
  <div class="base-converter">
    <Input
      v-model="inputValue"
      type="text"
      label="输入值"
      placeholder="请输入数值"
    />

    <Select
      v-model="fromBase"
      :options="baseOptions"
      label="从进制"
    />

    <Select
      v-model="toBase"
      :options="baseOptions"
      label="到进制"
    />

    <div
      v-if="result && !error"
      class="converter-result"
    >
      <div class="result-value">
        <span class="input-display">{{ inputValue }} ({{ fromBase }})</span>
        <span class="equals"> = </span>
        <span class="output-display">{{ result }} ({{ toBase }})</span>
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
      <h4>快速转换结果</h4>
      <div class="quick-results-grid">
        <div
          v-for="base in filteredBases"
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
import {
  computed,
  ref,
  shallowRef,
} from "vue"
import Input from "@/components/Input.vue"
import Select from "@/components/Select.vue"

// 进制配置（合并名称与有效字符集，消除 BASES/USAGE_INFO 重复）
const BASES = shallowRef([
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
])

const inputValue = ref("10")
const fromBase = ref(10)
const toBase = ref(2)
const error = ref("")

const baseOptions = computed(() =>
  BASES.value.map((base) => ({
    value: base.value,
    label: `${base.name} (${base.value})`,
  })),
)

const filteredBases = computed(() =>
  BASES.value.filter((b) => b.value !== fromBase.value),
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

  const upperValue = value.toUpperCase()
  for (const char of upperValue) {
    if (!validChars.includes(char)) return false
  }
  return true
}

function convertToBase(targetBase: number): string {
  if (!isValidInput(inputValue.value, fromBase.value)) return "无效输入"

  const decimalValue = Number.parseInt(inputValue.value, fromBase.value)
  if (isNaN(decimalValue)) return "无效输入"

  return decimalValue.toString(targetBase).toUpperCase()
}

const result = computed(() => {
  error.value = ""
  if (!inputValue.value) return ""

  if (!isValidInput(inputValue.value, fromBase.value)) {
    error.value = `无效的${fromBase.value}进制输入`
    return ""
  }

  return convertToBase(toBase.value)
})
</script>

<style lang="scss" scoped>
@use "../styles/index.scss" as *;

.base-converter {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
