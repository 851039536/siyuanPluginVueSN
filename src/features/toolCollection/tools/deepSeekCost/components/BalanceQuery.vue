<!-- 余额查询面板 — 读取 DeepSeek API Key 调用余额接口，展示账户余额明细 -->
<template>
  <div class="dc-balance">
    <!-- 密钥状态区 -->
    <div class="dc-key-status">
      <!-- 标签："DeepSeek API Key" -->
      <span class="dc-label">{{ i18n.apiKey }}</span>
      <!-- 状态："已配置 / 未配置" -->
      <span
        v-if="apiKey"
        class="dc-key-masked"
      >
        {{ maskedKey }}
      </span>
      <span
        v-else
        class="dc-key-missing"
      >
        {{ i18n.keyMissing }}
      </span>
      <!-- 提示："前往超级面板 AI 设置中配置" -->
      <p
        v-if="!apiKey"
        class="dc-hint"
      >
        {{ i18n.keyMissingHint }}
      </p>
    </div>

    <!-- 查询按钮 -->
    <button
      class="dc-query-btn"
      :disabled="!apiKey || loading"
      @click="queryBalance"
    >
      <!-- 按钮文案："查询余额" -->
      {{ loading ? i18n.querying : i18n.query }}
    </button>

    <!-- 错误信息 -->
    <div
      v-if="error"
      class="dc-error"
    >
      {{ error }}
    </div>

    <!-- 查询结果 -->
    <div
      v-if="balanceData"
      class="dc-result"
    >
      <!-- 状态："账户可用" -->
      <div class="dc-avail-row">
        <span class="dc-label">{{ i18n.available }}</span>
        <span
          class="dc-avail"
          :class="balanceData.is_available ? 'ok' : 'no'"
        >
          {{ balanceData.is_available ? "✓" : "✗" }}
        </span>
      </div>

      <!-- 币种余额明细 -->
      <div
        v-for="info in balanceData.balance_infos"
        :key="info.currency"
        class="dc-balance-card"
      >
        <div class="dc-currency">{{ info.currency }}</div>
        <!-- 标签："总余额" -->
        <div class="dc-balance-row">
          <span>{{ i18n.totalBalance }}</span>
          <span>{{ info.total_balance }}</span>
        </div>
        <!-- 标签："赠送余额" -->
        <div class="dc-balance-row">
          <span>{{ i18n.grantedBalance }}</span>
          <span>{{ info.granted_balance }}</span>
        </div>
        <!-- 标签："充值余额" -->
        <div class="dc-balance-row">
          <span>{{ i18n.toppedUpBalance }}</span>
          <span>{{ info.topped_up_balance }}</span>
        </div>
      </div>

      <!-- 提示："优先扣减赠送余额" -->
      <p class="dc-hint">{{ i18n.deductHint }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
// 余额查询组件：读取密钥 → GET /user/balance → 展示余额明细
import {
  computed,
  ref,
} from "vue"
import type { Plugin } from "siyuan"

interface Props {
  plugin: Plugin
  i18n: Record<string, string>
}

const props = defineProps<Props>()

const i18n = props.i18n

/** 余额 API 响应类型 */
interface BalanceInfo {
  currency: string
  total_balance: string
  granted_balance: string
  topped_up_balance: string
}

interface BalanceResponse {
  is_available: boolean
  balance_infos: BalanceInfo[]
}

// DeepSeek 专用密钥（无论当前 AI provider 是什么，都从 aiApiKeys.deepseek 取）
const apiKey = computed(() =>
  (props.plugin.settings as any)?.aiApiKeys?.deepseek || "",
)

// 掩码显示：前 6 位 + ****
const maskedKey = computed(() => {
  if (!apiKey.value) return ""
  return apiKey.value.length > 6
    ? `${apiKey.value.slice(0, 6)}****`
    : "****"
})

const loading = ref(false)
const error = ref("")
const balanceData = ref<BalanceResponse | null>(null)

async function queryBalance() {
  if (!apiKey.value) {
    error.value = i18n.keyMissing
    return
  }

  loading.value = true
  error.value = ""
  balanceData.value = null

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 10000)
    try {
      const response = await fetch("https://api.deepseek.com/user/balance", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey.value}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      })

      if (!response.ok) {
        const text = await response.text()
        throw new Error(`${i18n.queryFailed}: ${response.status} ${text}`)
      }

      balanceData.value = (await response.json()) as BalanceResponse
    } finally {
      clearTimeout(timer)
    }
  } catch (e) {
    error.value = (e as Error).message || String(e)
  } finally {
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
@use "../styles/BalanceQuery.scss";
@use "../styles/index.scss";
</style>
