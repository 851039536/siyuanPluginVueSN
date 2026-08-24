<!-- 文档分析功能 - Hero 汇总卡组件（总文档 + 健康度 + 问题速览 + 扣分项配置弹窗） -->
<template>
  <div class="hero-card">
    <div class="hero-top">
      <div class="hero-left">
        <span class="hero-label">总文档</span>
        <span class="hero-value">{{ stats.totalDocs }}</span>
      </div>
      <div class="hero-right">
        <span class="hero-health-label">健康度</span>
        <div
          class="hero-health-bar"
          :title="healthTooltip"
        >
          <div
            class="hero-health-fill"
            :style="{ width: `${healthPct}%` }"
          />
        </div>
        <span
          class="hero-health-value"
          :title="healthTooltip"
        >{{ healthPct }}%</span>
        <!-- 信息图标：点击弹出健康度详情 + 扣分项配置 -->
        <button
          class="hero-health-info"
          title="健康度详情"
          @click="detailVisible = true"
        >
          <Icon icon="mdi:information-outline" />
        </button>
      </div>
    </div>
    <!-- 问题速览（徽章行） -->
    <div
      v-if="hasIssues"
      class="hero-issues"
    >
      <div
        v-if="stats.zeroByteDocs"
        class="issue-item critical"
        @click="$emit('selectCategory', '0B')"
      >
        <span class="issue-value">{{ stats.zeroByteDocs }}</span>
        <span class="issue-label">0B空</span>
      </div>
      <div
        v-if="effectiveDupDocs > 0"
        class="issue-item warn"
        @click="$emit('selectCategory', 'duplicate')"
      >
        <span class="issue-value">{{ effectiveDupDocs }}</span>
        <span class="issue-label">重名</span>
      </div>
      <div
        v-if="stats.pendingPublishDocs"
        class="issue-item accent"
        @click="$emit('selectCategory', 'pendingPublish')"
      >
        <span class="issue-value">{{ stats.pendingPublishDocs }}</span>
        <span class="issue-label">待发布</span>
      </div>
      <div
        v-if="stats.orphanDocs"
        class="issue-item critical"
        @click="$emit('selectCategory', 'orphanDoc')"
      >
        <span class="issue-value">{{ stats.orphanDocs }}</span>
        <span class="issue-label">孤文档</span>
      </div>
    </div>

    <!-- 健康度详情 + 扣分项配置弹出面板 -->
    <Teleport to="body">
      <div
        v-if="detailVisible"
        class="health-detail-overlay"
        @click.self="closeDetail"
      >
        <div
          class="health-detail-panel"
          tabindex="-1"
          @keydown.esc="closeDetail"
        >
          <div class="health-detail-header">
            <span class="health-detail-title">
              <Icon icon="mdi:information-outline" />
              健康度详情
            </span>
            <button
              class="close-btn"
              @click="closeDetail"
            >
              <Icon icon="mdi:close" />
            </button>
          </div>
          <div class="health-detail-body">
            <div class="health-summary">
              <span>健康文档</span>
              <span class="health-summary-value">{{ healthyDocs }} / {{ stats.totalDocs }}</span>
            </div>
            <p class="health-summary-tip">同一文档可能有多类问题，故百分比可能偏低</p>
            <!-- 扣分项配置区：勾选的项才参与扣分分析 -->
            <div class="deduction-section">
              <div class="deduction-section-title">扣分项（勾选参与扣分）</div>
              <label
                v-for="row in deductionRows"
                :key="row.key"
                class="deduction-item"
              >
                <input
                  type="checkbox"
                  :checked="row.enabled"
                  @change="toggleDeduction(row.key, ($event.target as HTMLInputElement).checked)"
                />
                <span class="deduction-label">{{ row.label }}</span>
                <span
                  class="deduction-count"
                  :class="{ muted: !row.enabled }"
                >{{ row.count }}</span>
              </label>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import { computed, ref } from "vue"
import type {
  DeductionKey,
  DeductionRow,
  DocStats,
  HealthSettings,
} from "../../types/index"

interface Props {
  stats: DocStats
  healthPct: number
  healthTooltip: string
  hasIssues: boolean
  effectiveDupDocs: number
  healthSettings: HealthSettings
  deductionRows: DeductionRow[]
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "selectCategory", category: string): void
  (e: "update:healthSettings", settings: HealthSettings): void
}>()

/** 健康度详情弹出面板可见性 */
const detailVisible = ref(false)

/** 健康文档数（总文档 - 启用扣分项合计，与健康度百分比口径一致） */
const healthyDocs = computed(() => {
  const total = props.stats.totalDocs
  if (!total) return 0
  const issues = props.deductionRows
    .filter((r) => r.enabled)
    .reduce((sum, r) => sum + r.count, 0)
  return Math.max(0, total - Math.min(total, issues))
})

/** 切换扣分项启用状态（emit 到父级，健康度随配置实时重算） */
function toggleDeduction(key: DeductionKey, checked: boolean) {
  const current = new Set(props.healthSettings.enabledDeductions)
  if (checked) current.add(key)
  else current.delete(key)
  emit("update:healthSettings", { enabledDeductions: [...current] })
}

/** 关闭详情面板 */
function closeDetail() {
  detailVisible.value = false
}
</script>

<style lang="scss" scoped>
@use "../../styles/HeroCard.scss";
</style>
