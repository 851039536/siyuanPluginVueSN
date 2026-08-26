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
        >{{ healthPct.toFixed(2) }}%</span>
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
            <!-- 0B 排除书签区：勾选的书签值整体剔除出统计口径，重新分析后生效 -->
            <div class="exclude-section">
              <div class="exclude-section-title">0B 排除书签（勾选后自动重新分析）</div>
              <label
                v-for="bk in excludeBookmarkOptions"
                :key="bk"
                class="exclude-bookmark-item"
              >
                <input
                  type="checkbox"
                  :checked="healthSettings.zeroByteExcludeBookmarks.includes(bk)"
                  @change="toggleExcludeBookmark(bk, ($event.target as HTMLInputElement).checked)"
                />
                <span class="exclude-bookmark-label">{{ bk || "(空值)" }}</span>
              </label>
              <p
                v-if="excludeBookmarkOptions.length === 0"
                class="exclude-empty-tip"
              >暂无书签，可先在思源中为文档添加书签</p>
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
  healthyDocs: number
}

const props = defineProps<Props>()

const emit = defineEmits<{
  (e: "selectCategory", category: string): void
  (e: "update:healthSettings", settings: HealthSettings): void
}>()

/** 健康度详情弹出面板可见性 */
const detailVisible = ref(false)

/** 切换扣分项启用状态（emit 到父级，健康度随配置实时重算） */
function toggleDeduction(key: DeductionKey, checked: boolean) {
  const current = new Set(props.healthSettings.enabledDeductions)
  if (checked) current.add(key)
  else current.delete(key)
  emit("update:healthSettings", { ...props.healthSettings, enabledDeductions: [...current] })
}

/** 0B 排除书签可选项：动态书签分布 ∪ 已勾选书签（去重），保证已排除的书签仍可取消勾选 */
const excludeBookmarkOptions = computed(() => {
  const seen = new Set(props.healthSettings.zeroByteExcludeBookmarks)
  for (const b of props.stats.bookmarkDistribution) seen.add(b.value)
  return [...seen]
})

/** 切换 0B 排除书签（emit 保留全量字段，watch 自动持久化；SQL 层统计需重新分析后生效） */
function toggleExcludeBookmark(bookmark: string, checked: boolean) {
  const current = new Set(props.healthSettings.zeroByteExcludeBookmarks)
  if (checked) current.add(bookmark)
  else current.delete(bookmark)
  emit("update:healthSettings", { ...props.healthSettings, zeroByteExcludeBookmarks: [...current] })
}

/** 关闭详情面板 */
function closeDetail() {
  detailVisible.value = false
}
</script>

<style lang="scss" scoped>
@use "../../styles/HeroCard.scss";
</style>
