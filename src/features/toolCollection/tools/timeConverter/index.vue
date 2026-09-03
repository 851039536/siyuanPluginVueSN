<template>
  <div class="time-converter">
    <!-- 智能识别输入区 -->
    <div class="tc-input-section">
      <!-- 输入框占位："输入时间戳（10位秒 / 13位毫秒）或日期时间，自动识别" -->
      <Input
        v-model="input"
        size="xsmall"
        clearable
        :placeholder="t.inputPlaceholder"
      />
      <!-- 识别状态徽标："识别为：Unix 秒 / Unix 毫秒 / 日期时间 / 无法识别" -->
      <div
        v-if="!isInputEmpty"
        class="tc-recognize-badge"
        :class="{ invalid: !parsed }"
      >
        {{ recognizeText }}
      </div>
    </div>

    <!-- 转换结果区（空输入时展示当前时间转换；无法识别时显示错误提示） -->
    <div
      v-if="resultRows.length"
      class="tc-result-section"
    >
      <!-- 结果徽标："当前时间"（空输入默认模式） -->
      <div
        v-if="isInputEmpty"
        class="tc-now-badge"
      >{{ t.currentBadge }}</div>
      <div class="tc-result-rows">
        <div
          v-for="row in resultRows"
          :key="row.key"
          class="tc-result-row"
        >
          <!-- 行标签："本地标准时间 / ISO 8601 / UTC / Unix 秒（10位）/ Unix 毫秒（13位）" -->
          <span class="tc-row-label">{{ row.label }}</span>
          <span class="tc-row-value">{{ row.value }}</span>
          <!-- 复制按钮："复制" / "已复制" -->
          <button
            class="tc-copy-btn"
            :class="{ copied: copiedKey === row.key }"
            @click="copyValue(row.value, row.key)"
          >
            {{ copiedKey === row.key ? t.copied : t.copy }}
          </button>
        </div>
      </div>
    </div>
    <!-- 错误提示："无法识别的输入，请输入时间戳或日期时间" -->
    <div
      v-else-if="!isInputEmpty"
      class="tc-error"
    >
      {{ t.errorHint }}
    </div>

    <!-- 当前时间区（常驻，1 秒刷新） -->
    <div class="tc-now-section">
      <!-- 区块标题："当前标准时间" -->
      <h4>{{ t.currentStandardTime }}</h4>
      <div class="tc-result-rows">
        <div
          v-for="row in nowRows"
          :key="row.key"
          class="tc-result-row"
        >
          <!-- 行标签："本地标准时间 / Unix 秒（10位）/ Unix 毫秒（13位）" -->
          <span class="tc-row-label">{{ row.label }}</span>
          <span class="tc-row-value">{{ row.value }}</span>
          <!-- 复制按钮："复制" / "已复制" -->
          <button
            class="tc-copy-btn"
            :class="{ copied: copiedKey === row.key }"
            @click="copyValue(row.value, row.key)"
          >
            {{ copiedKey === row.key ? t.copied : t.copy }}
          </button>
        </div>
      </div>
    </div>

    <!-- 使用说明 -->
    <div class="tc-info">
      <!-- 区块标题："说明" -->
      <h4>{{ t.usageTitle }}</h4>
      <!-- 说明条目 -->
      <ul>
        <li>{{ t.usageTimestamp }}</li>
        <li>{{ t.usageDate }}</li>
      </ul>
    </div>
  </div>
</template>

<script setup lang="ts">
// 时间转换工具：uTools 风格智能输入框自动识别时间戳/日期 + 双向多格式转换 + 实时当前时间戳
import type { Plugin } from "siyuan"
import { copyToClipboard } from "@/utils/domUtils"
import { TimerRegistry } from "@/utils/timerRegistry"
import type { TimerHandle } from "@/utils/timerRegistry"
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
} from "vue"
import Input from "@/components/Input.vue"
import {
  formatDateParts,
  getNowInfo,
  parseTimeInput,
  type TimeParseResult,
} from "./utils/time"

/** 时间转换工具的 i18n 键结构 */
interface TimeConverterI18n {
  inputPlaceholder: string
  recognizedSeconds: string
  recognizedMilliseconds: string
  recognizedDate: string
  currentBadge: string
  currentStandardTime: string
  labelLocal: string
  labelIso: string
  labelUtc: string
  labelUnixSec: string
  labelUnixMs: string
  copy: string
  copied: string
  errorHint: string
  usageTitle: string
  usageTimestamp: string
  usageDate: string
}

interface Props {
  plugin: Plugin
  i18n: Record<string, any>
}

const props = defineProps<Props>()

/** 面板文案（i18n 分片键缺失时以空对象承接，模板字段由分片保证存在） */
const t = (props.i18n as { timeConverter?: TimeConverterI18n }).timeConverter
  ?? ({} as TimeConverterI18n)

// ==================== 智能识别输入 ====================
const input = ref("")

const isInputEmpty = computed(() => input.value.trim() === "")
const parsed = computed<TimeParseResult>(() => parseTimeInput(input.value))

/** 识别状态徽标文案 */
const recognizeText = computed(() => {
  switch (parsed.value?.kind) {
    case "seconds":
      return t.recognizedSeconds
    case "milliseconds":
      return t.recognizedMilliseconds
    case "date":
      return t.recognizedDate
    default:
      return t.errorHint
  }
})

// ==================== 转换结果 ====================
/** 转换目标 Date：有效输入用解析结果，否则取当前时间（空输入 = 当前时间模式，uTools 打开即所得） */
const sourceDate = computed(() => parsed.value?.date ?? new Date())
const parts = computed(() => formatDateParts(sourceDate.value))

interface ResultRow {
  key: string
  label: string
  value: string | number
}

/** 结果行按输入类型分流：时间戳输入补齐另一单位实现双向转换 */
const resultRows = computed<ResultRow[]>(() => {
  const kind = parsed.value?.kind
  // 时间戳输入 → 日期方向（含另一单位时间戳）
  if (kind === "seconds" || kind === "milliseconds") {
    return [
      { key: "local", label: t.labelLocal, value: parts.value.local },
      { key: "iso", label: t.labelIso, value: parts.value.iso },
      { key: "utc", label: t.labelUtc, value: parts.value.utc },
      kind === "seconds"
        ? { key: "ms", label: t.labelUnixMs, value: parts.value.unixMs }
        : { key: "sec", label: t.labelUnixSec, value: parts.value.unixSec },
    ]
  }
  // 空输入（当前时间）与日期输入：本地时间 + ISO + 双单位时间戳
  return [
    { key: "local", label: t.labelLocal, value: parts.value.local },
    { key: "iso", label: t.labelIso, value: parts.value.iso },
    { key: "sec", label: t.labelUnixSec, value: parts.value.unixSec },
    { key: "ms", label: t.labelUnixMs, value: parts.value.unixMs },
  ]
})

// ==================== 复制 ====================
const copiedKey = ref<string | null>(null)
const timer = new TimerRegistry()
let copiedTimer: TimerHandle | null = null

const copyValue = async (value: string | number, key: string) => {
  const ok = await copyToClipboard(String(value))
  if (!ok) return
  copiedKey.value = key
  if (copiedTimer !== null) timer.clear(copiedTimer)
  copiedTimer = timer.setTimeout(() => {
    copiedKey.value = null
    copiedTimer = null
  }, 1500)
}

// ==================== 当前时间实时刷新 ====================
const nowInfo = ref(getNowInfo())

/** 当前时间区行（键加 now- 前缀，避免与结果区 copiedKey 冲突） */
const nowRows = computed<ResultRow[]>(() => [
  { key: "now-local", label: t.labelLocal, value: nowInfo.value.local },
  { key: "now-sec", label: t.labelUnixSec, value: nowInfo.value.unixSec },
  { key: "now-ms", label: t.labelUnixMs, value: nowInfo.value.unixMs },
])

onMounted(() => {
  timer.setInterval(() => {
    nowInfo.value = getNowInfo()
  }, 1000)
})

onUnmounted(() => {
  timer.clearAll()
  copiedTimer = null
})
</script>

<style lang="scss" scoped>
@use "./styles/index.scss";
</style>
