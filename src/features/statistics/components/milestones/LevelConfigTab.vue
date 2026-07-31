<!-- 等级设置 Tab：成就点配置 + 等级曲线乘数 + 前10级预览（数据走 useMilestoneStorage） -->
<template>
  <div class="level-tab">
    <div class="level-config-help">
      <p class="help-title">
        等级系统说明
      </p>
      <ul class="help-list">
        <li><b>成就点</b>：每达成一个里程碑获得对应稀有度的成就点，累积成就点提升等级。</li>
        <li><b>曲线乘数</b>：控制升级难度，值越大每级所需成就点越多，升级越慢。</li>
        <li>修改后点击「保存等级设置」生效，等级和进度条会立即重新计算。</li>
      </ul>
    </div>

    <div class="level-config-section">
      <div class="level-config-label">
        里程碑成就点
      </div>
      <div class="tier-points-grid">
        <div
          v-for="tier in ['common', 'rare', 'epic', 'legendary']"
          :key="tier"
          class="tier-point-item"
        >
          <span
            class="tier-point-badge"
            :class="`tier-${tier}`"
          >{{ TIER_LABELS[tier] }}</span>
          <input
            type="number"
            class="tier-point-input"
            :value="editableLevelConfig.tierPoints[tier]"
            min="1"
            @change="(e: Event) => onTierPointChange(tier, parseInt((e.target as HTMLInputElement).value) || 1)"
          />
          <span class="tier-point-unit">点</span>
        </div>
      </div>
    </div>

    <div class="level-config-section">
      <div class="level-config-label">
        等级曲线乘数
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
        <span class="curve-formula-hint">
          公式: <code>{{ editableLevelConfig.curveMultiplier }} × (等级−1) × √(等级−1)</code>
        </span>
      </div>
      <div class="curve-preview">
        <span class="curve-preview-label">预览前 10 级所需成就点：</span>
        <span class="curve-preview-values">
          <span
            v-for="lv in 10"
            :key="lv"
            class="curve-preview-lv"
          >
            Lv.{{ lv }}: {{ pointsForLevelPreview(lv) }}
          </span>
        </span>
      </div>
    </div>

    <div class="level-config-actions">
      <button
        class="btn-save-level"
        @click="onSaveLevelConfig"
      >
        保存等级设置
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { LevelConfig } from "../../types/milestoneRules"
import {
  ref,
  watch,
} from "vue"
import { useMilestoneStorage } from "../../composables/useMilestoneStorage"
import {
  DEFAULT_LEVEL_CONFIG,
  TIER_LABELS,
} from "../../types/milestoneRules"

interface Props {
  visible: boolean
}

const props = defineProps<Props>()

const {
  levelConfig,
  saveLevelConfig,
} = useMilestoneStorage()

const editableLevelConfig = ref<LevelConfig>({ ...DEFAULT_LEVEL_CONFIG })

watch(() => [props.visible, levelConfig.value], () => {
  if (props.visible) {
    editableLevelConfig.value = { ...levelConfig.value }
  }
}, { immediate: true })

function onTierPointChange(tier: string, val: number) {
  editableLevelConfig.value.tierPoints[tier] = Math.max(1, val)
}

function onCurveMultiplierChange(val: number) {
  editableLevelConfig.value.curveMultiplier = Math.max(1, val)
}

function pointsForLevelPreview(level: number): number {
  const m = editableLevelConfig.value.curveMultiplier
  if (level <= 1) return 0
  return Math.floor(m * (level - 1) * Math.sqrt(level - 1))
}

function onSaveLevelConfig() {
  saveLevelConfig({ ...editableLevelConfig.value })
}
</script>

<style scoped lang="scss">
@use "../../styles/MilestoneRuleEditor.scss";
@use '../../styles/index.scss' as stats;
</style>
