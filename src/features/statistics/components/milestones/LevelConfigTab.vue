<!-- 等级设置 Tab：成就点配置 + 等级曲线乘数 + 前10级预览（数据走 useMilestoneStorage，文案走 i18n） -->
<template>
  <div class="level-tab">
    <div class="level-config-help">
      <!-- 帮助标题："等级系统说明" -->
      <p class="help-title">
        {{ i18n.levelHelpTitle }}
      </p>
      <ul class="help-list">
        <!-- 帮助条目 1 -->
        <li>{{ i18n.levelHelp1 }}</li>
        <!-- 帮助条目 2 -->
        <li>{{ i18n.levelHelp2 }}</li>
        <!-- 帮助条目 3 -->
        <li>{{ i18n.levelHelp3 }}</li>
      </ul>
    </div>

    <div class="level-config-section">
      <!-- 区块标题："里程碑成就点" -->
      <div class="level-config-label">
        {{ i18n.milestonePointsLabel }}
      </div>
      <div class="tier-points-grid">
        <div
          v-for="tier in TIERS"
          :key="tier"
          class="tier-point-item"
        >
          <!-- 稀有度徽章（值经 i18n 解析，如："普通"） -->
          <span
            class="tier-point-badge"
            :class="`tier-${tier}`"
          >{{ tierText(tier) }}</span>
          <input
            type="number"
            class="tier-point-input"
            :value="editableLevelConfig.tierPoints[tier]"
            min="1"
            @change="(e: Event) => onTierPointChange(tier, parseInt((e.target as HTMLInputElement).value) || 1)"
          />
          <!-- 点数单位："点" -->
          <span class="tier-point-unit">{{ i18n.pointsUnit }}</span>
        </div>
      </div>
    </div>

    <div class="level-config-section">
      <!-- 区块标题："等级曲线乘数" -->
      <div class="level-config-label">
        {{ i18n.curveMultiplierLabel }}
      </div>
      <div class="curve-row">
        <input
          type="number"
          class="curve-input"
          :value="editableLevelConfig.curveMultiplier"
          min="1"
          step="1"
          @change="(e: Event) => onCurveMultiplierChange(parseInt((e.target as HTMLInputElement).value) || 1)"
        />
        <!-- 公式前缀："公式:"（数学表达式用通用符号 n 表示等级序号） -->
        <span class="curve-formula-hint">
          {{ i18n.curveFormulaHint }} <code>{{ editableLevelConfig.curveMultiplier }} × (n−1) × √(n−1)</code>
        </span>
      </div>
      <!-- 预览标题："预览前 10 级所需成就点：" -->
      <div class="curve-preview">
        <span class="curve-preview-label">{{ i18n.curvePreviewLabel }}</span>
        <span class="curve-preview-values">
          <span
            v-for="lv in 10"
            :key="lv"
            class="curve-preview-lv"
          >
            Lv.{{ lv }}: {{ pointsForLevel(lv, editableLevelConfig.curveMultiplier) }}
          </span>
        </span>
      </div>
    </div>

    <div class="level-config-actions">
      <!-- 保存按钮："保存等级设置" -->
      <button
        class="btn-save-level"
        @click="onSaveLevelConfig"
      >
        {{ i18n.saveLevelConfigBtn }}
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
// 等级设置 Tab：成就点/曲线乘数配置 + 预览（i18n 键见 i18n/statistics.json，稀有度遍历以 TIER_LABELS 为单一数据源）
import type { LevelConfig } from "../../types/milestoneRules"
import type { Tier } from "../../types/milestoneData"
import {
  ref,
  watch,
} from "vue"
import { useMilestoneStorage } from "../../composables/useMilestoneStorage"
import {
  DEFAULT_LEVEL_CONFIG,
  TIER_LABELS,
  TIERS,
} from "../../types/milestoneRules"
import { pointsForLevel } from "../../utils/achievements"

interface Props {
  visible: boolean
  i18n?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
})

const {
  levelConfig,
  saveLevelConfig,
} = useMilestoneStorage()

const editableLevelConfig = ref<LevelConfig>({ ...DEFAULT_LEVEL_CONFIG })

/** i18n 键解析：命中返回译文，未命中返回空串（禁止键名直显） */
function textByKey(key: string | undefined): string {
  const v = typeof key === "string" ? props.i18n[key] : undefined
  return typeof v === "string" ? v : ""
}

/** 稀有度徽章文案（TIER_LABELS 值为 i18n 键，需二次解析） */
function tierText(tier: Tier): string {
  return textByKey(TIER_LABELS[tier])
}

watch(() => [props.visible, levelConfig.value], () => {
  if (props.visible) {
    editableLevelConfig.value = { ...levelConfig.value }
  }
}, { immediate: true })

function onTierPointChange(tier: Tier, val: number) {
  editableLevelConfig.value.tierPoints[tier] = Math.max(1, val)
}

function onCurveMultiplierChange(val: number) {
  editableLevelConfig.value.curveMultiplier = Math.max(1, val)
}

function onSaveLevelConfig() {
  saveLevelConfig({ ...editableLevelConfig.value })
}
</script>

<style scoped lang="scss">
@use "../../styles/MilestoneRuleEditor.scss";
@use '../../styles/index.scss' as stats;
</style>
