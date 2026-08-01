<!-- 成本换算面板 — 输入 token 数与模型，实时计算缓存命中率与费用 -->
<template>
  <div class="dc-calc">
    <!-- 模型选择 -->
    <div class="dc-field">
      <!-- 标签："模型" -->
      <span class="dc-label">{{ i18n.model }}</span>
      <div class="dc-model-row">
        <button
          v-for="m in DEEPSEEK_PRICES"
          :key="m.id"
          class="dc-model-btn"
          :class="{ active: modelId === m.id }"
          @click="modelId = m.id"
        >
          {{ m.name }}
        </button>
      </div>
    </div>

    <!-- Token 输入区 -->
    <div class="dc-fields">
      <!-- 标签："输入（命中缓存）" -->
      <div class="dc-input-item">
        <span class="dc-label">{{ i18n.hitTokens }}</span>
        <input
          v-model.number="hitTokens"
          class="dc-input"
          type="number"
          min="0"
          placeholder="0"
        />
      </div>
      <!-- 标签："输入（未命中缓存）" -->
      <div class="dc-input-item">
        <span class="dc-label">{{ i18n.missTokens }}</span>
        <input
          v-model.number="missTokens"
          class="dc-input"
          type="number"
          min="0"
          placeholder="0"
        />
      </div>
      <!-- 标签："输出" -->
      <div class="dc-input-item">
        <span class="dc-label">{{ i18n.outputTokens }}</span>
        <input
          v-model.number="outputTokens"
          class="dc-input"
          type="number"
          min="0"
          placeholder="0"
        />
      </div>
    </div>

    <!-- 峰谷开关 + 示例按钮 -->
    <div class="dc-toolbar">
      <!-- 提示："高峰时段价格 ×2" -->
      <label class="dc-check">
        <input
          v-model="isPeak"
          type="checkbox"
        />
        <span>{{ i18n.peak }}</span>
      </label>
      <!-- 按钮："填入示例" -->
      <button
        class="dc-example-btn"
        @click="fillExample"
      >
        {{ i18n.fillExample }}
      </button>
    </div>
    <!-- 提示："价格来源与高峰时段说明" -->
    <p class="dc-hint">{{ i18n.priceHint }}</p>

    <!-- 结果卡片 -->
    <div class="dc-result">
      <div class="dc-total-row">
        <!-- 标签："总费用" -->
        <span class="dc-label">{{ i18n.totalCost }}</span>
        <span class="dc-total">¥ {{ formatCost(result.total) }}</span>
      </div>
      <div class="dc-hit-row">
        <!-- 标签："缓存命中率" -->
        <span class="dc-label">{{ i18n.hitRate }}</span>
        <span class="dc-hit-value">{{ formatPercent(result.hitRate) }}</span>
      </div>
      <div class="dc-detail-list">
        <!-- 标签："命中缓存费用" -->
        <div class="dc-detail">
          <span>{{ i18n.hitCost }}</span>
          <span>¥ {{ formatCost(result.cacheHitCost) }}</span>
        </div>
        <!-- 标签："未命中缓存费用" -->
        <div class="dc-detail">
          <span>{{ i18n.missCost }}</span>
          <span>¥ {{ formatCost(result.cacheMissCost) }}</span>
        </div>
        <!-- 标签："输出费用" -->
        <div class="dc-detail">
          <span>{{ i18n.outputCost }}</span>
          <span>¥ {{ formatCost(result.outputCost) }}</span>
        </div>
        <!-- 标签："相比全部未命中节省" -->
        <div class="dc-detail dc-detail-saved">
          <span>{{ i18n.saved }}</span>
          <span>¥ {{ formatCost(result.saved) }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 成本换算组件：模型/峰谷选择 + token 输入 → 实时费用与命中率计算
import {
  computed,
  onMounted,
  ref,
} from "vue"
import {
  calcCost,
  DEEPSEEK_PRICES,
  formatCost,
  formatPercent,
  isPeakHour,
} from "../utils/pricing"

interface Props {
  i18n: Record<string, string>
}

const props = defineProps<Props>()

// 从全局 i18n 中解出本工具文案对象
const i18n = props.i18n

const modelId = ref(DEEPSEEK_PRICES[0].id)
const hitTokens = ref(0)
const missTokens = ref(0)
const outputTokens = ref(0)
const isPeak = ref(false)

// 挂载时按当前北京时间自动识别是否处于高峰时段
onMounted(() => {
  isPeak.value = isPeakHour(new Date())
})

const model = computed(() =>
  DEEPSEEK_PRICES.find((m) => m.id === modelId.value) ?? DEEPSEEK_PRICES[0],
)

const result = computed(() =>
  calcCost(
    Number(hitTokens.value) || 0,
    Number(missTokens.value) || 0,
    Number(outputTokens.value) || 0,
    model.value,
    isPeak.value,
  ),
)

// 填入用户给出的示例数据（总 token 8,195,888）
function fillExample() {
  hitTokens.value = 7830144
  missTokens.value = 222757
  outputTokens.value = 142987
}
</script>

<style scoped lang="scss">
@use "../styles/CostCalculator.scss";
@use "../styles/index.scss";
</style>
