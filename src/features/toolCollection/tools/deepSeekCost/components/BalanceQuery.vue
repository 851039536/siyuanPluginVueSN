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

    <!-- 模型列表与每百万 token 价格 -->
    <div
      v-if="modelsData"
      class="dc-models"
    >
      <!-- 区块标题："可用模型" + 汇率提示 -->
      <div class="dc-models-head">
        <span class="dc-label">{{ i18n.models }}</span>
        <span class="dc-rate">{{ i18n.rateHint }}: 1 USD ≈ ¥{{ CNY_PER_USD }}</span>
      </div>
      <!-- 模型卡片 -->
      <div
        v-for="row in modelRows"
        :key="row.id"
        class="dc-model-card"
      >
        <div class="dc-model-name">
          {{ row.id }}
          <!-- 标签："每百万 tokens" -->
          <span class="dc-per-m">{{ i18n.perMillion }}</span>
        </div>
        <!-- 价格表已收录的模型：展示命中/未命中/输出单价（¥ + $） -->
        <template v-if="row.price">
          <!-- 标签："输入（命中缓存）" -->
          <div class="dc-price-row">
            <span>{{ i18n.cacheHitPrice }}</span>
            <span>¥ {{ formatCost(row.price.cacheHitCny) }} / $ {{ formatUSD(row.price.cacheHitUsd) }}</span>
          </div>
          <!-- 标签："输入（未命中缓存）" -->
          <div class="dc-price-row">
            <span>{{ i18n.cacheMissPrice }}</span>
            <span>¥ {{ formatCost(row.price.cacheMissCny) }} / $ {{ formatUSD(row.price.cacheMissUsd) }}</span>
          </div>
          <!-- 标签："输出" -->
          <div class="dc-price-row">
            <span>{{ i18n.outputPrice }}</span>
            <span>¥ {{ formatCost(row.price.outputCny) }} / $ {{ formatUSD(row.price.outputUsd) }}</span>
          </div>
        </template>
        <!-- 提示："价格表未收录该模型" -->
        <p
          v-else
          class="dc-hint"
        >
          {{ i18n.priceUnknown }}
        </p>
      </div>
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
import {
  CNY_PER_USD,
  findPriceForModel,
  formatCost,
  formatUSD,
  toUSD,
} from "../utils/pricing"

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

/** 模型列表 API 响应类型 */
interface ModelItem {
  id: string
  object: string
  owned_by: string
}

interface ModelsResponse {
  object: string
  data: ModelItem[]
}

/** 模型卡片展示行（含每百万 token 的中美价格） */
interface ModelRow {
  id: string
  price: {
    cacheHitCny: number
    cacheHitUsd: number
    cacheMissCny: number
    cacheMissUsd: number
    outputCny: number
    outputUsd: number
  } | null
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
const modelsData = ref<ModelsResponse | null>(null)

/** 模型列表展示行：将模型 ID 匹配价格表并换算美元 */
const modelRows = computed<ModelRow[]>(() => {
  const list = modelsData.value?.data ?? []
  return list.map((m) => {
    const p = findPriceForModel(m.id)
    return {
      id: m.id,
      price: p
        ? {
            cacheHitCny: p.cacheHit,
            cacheHitUsd: toUSD(p.cacheHit),
            cacheMissCny: p.cacheMiss,
            cacheMissUsd: toUSD(p.cacheMiss),
            outputCny: p.output,
            outputUsd: toUSD(p.output),
          }
        : null,
    }
  })
})

async function queryBalance() {
  if (!apiKey.value) {
    error.value = i18n.keyMissing
    return
  }

  loading.value = true
  error.value = ""
  balanceData.value = null
  modelsData.value = null

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)

  try {
    // 并行请求：余额 + 模型列表（任一失败单独提示，互不影响）
    const [balanceRes, modelsRes] = await Promise.all([
      fetch("https://api.deepseek.com/user/balance", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey.value}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      }),
      fetch("https://api.deepseek.com/models", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${apiKey.value}`,
          "Content-Type": "application/json",
        },
        signal: controller.signal,
      }),
    ])

    const errs: string[] = []
    if (balanceRes.ok) {
      balanceData.value = (await balanceRes.json()) as BalanceResponse
    } else {
      errs.push(`${i18n.queryFailed}: ${balanceRes.status}`)
    }
    if (modelsRes.ok) {
      modelsData.value = (await modelsRes.json()) as ModelsResponse
    } else {
      errs.push(`${i18n.modelsFailed}: ${modelsRes.status}`)
    }
    if (errs.length > 0) {
      error.value = errs.join("；")
    }
  } catch (e) {
    error.value = (e as Error).message || String(e)
  } finally {
    clearTimeout(timer)
    loading.value = false
  }
}
</script>

<style scoped lang="scss">
@use "../styles/BalanceQuery.scss";
@use "../styles/index.scss";
</style>
