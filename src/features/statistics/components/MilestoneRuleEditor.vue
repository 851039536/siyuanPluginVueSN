<!-- 里程碑规则编辑对话框：里程碑阈值表格 + 成就管理 + 等级曲线配置 -->
<template>
  <div
    v-if="visible"
    class="rule-editor-overlay"
    @click.self="$emit('close')"
  >
    <div class="rule-editor-panel">
      <div class="rule-editor-header">
        <h3 class="rule-editor-title">
          规则设置
        </h3>
        <button
          class="rule-editor-close"
          @click="$emit('close')"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 16 16"
          ><path
            d="M4 4l8 8M12 4l-8 8"
            fill="none"
            stroke="currentColor"
            stroke-width="1.5"
            stroke-linecap="round"
          /></svg>
        </button>
      </div>

      <!-- Tab bar -->
      <div class="rule-editor-tabs">
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'milestones' }"
          @click="activeTab = 'milestones'"
        >里程碑规则</button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'achievements' }"
          @click="activeTab = 'achievements'"
        >自定义成就</button>
        <button
          class="tab-btn"
          :class="{ active: activeTab === 'level' }"
          @click="activeTab = 'level'"
        >等级设置</button>
      </div>

      <!-- Milestones tab toolbar -->
      <div
        v-if="activeTab === 'milestones'"
        class="rule-editor-toolbar"
      >
        <label class="level-count-label">
          每类里程碑级数:
          <input
            type="number"
            class="level-count-input"
            :value="levelCount"
            min="1"
            @change="onLevelCountChange"
          />
        </label>
        <button
          class="btn-reset-all"
          @click="onResetAll"
        >
          恢复默认值
        </button>
      </div>

      <div class="rule-editor-body">
        <!-- ═══ Milestones Tab ═══ -->
        <div v-show="activeTab === 'milestones'">
          <div class="rule-editor-help">
            <p class="help-title">
              使用说明
            </p>
            <ul class="help-list">
              <li>每行对应一种统计类型，输入框为该类型各<b>等级</b>的达标目标值。</li>
              <li>等级从 <b>Lv.1</b> 开始递增，值必须从小到大排列（第一个里程碑最简单，越往后越难）。</li>
              <li>修改「每类里程碑级数」可统一调整所有类型的等级数量，新增的等级会自动按 1.3 倍递增。</li>
              <li>留空某个等级或填入 0 表示该等级及之后不再生成里程碑。</li>
              <li>点击「恢复默认值」将重置为系统预设的公式计算值。</li>
            </ul>
          </div>

          <div class="level-header-row">
            <div class="level-header-spacer"></div>
            <div class="level-header-inputs">
              <span
                v-for="i in levelCount"
                :key="i"
                class="level-header-label"
              >Lv.{{ i }}</span>
            </div>
          </div>
          <div
            v-for="row in rows"
            :key="row.key"
            class="rule-row"
          >
            <div class="rule-row-header">
              <IconWrapper
                class="rule-row-icon"
                :name="row.icon as IconKey"
                :size="14"
              />
              <span class="rule-row-label">{{ row.label }}</span>
              <button
                class="btn-reset-row"
                title="恢复此行默认值"
                @click="onResetRow(row.key)"
              >
                ↺
              </button>
            </div>
            <div class="rule-row-inputs">
              <input
                v-for="(_val, idx) in row.targets"
                :key="idx"
                type="number"
                class="rule-input"
                :value="row.targets[idx]"
                min="1"
                @change="(e: Event) => onTargetChange(row.key, idx, parseInt((e.target as HTMLInputElement).value) || 1)"
              />
            </div>
          </div>
        </div>

        <!-- ═══ Achievements Tab ═══ -->
        <div
          v-show="activeTab === 'achievements'"
          class="ach-tab"
        >
          <div
            v-if="customAchievements.length === 0"
            class="ach-empty"
          >
            暂无自定义成就，点击下方按钮添加。
          </div>
          <div
            v-else
            class="ach-list"
          >
            <div
              v-for="ach in customAchievements"
              :key="ach.id"
              class="ach-list-item"
            >
              <IconWrapper
                class="ach-list-icon"
                :name="ach.icon as IconKey"
                :size="16"
              />
              <span class="ach-list-title">{{ ach.title }}</span>
              <span
                class="ach-list-tier"
                :class="`tier-${ach.tier}`"
              >{{ TIER_LABELS[ach.tier] }}</span>
              <span class="ach-list-type"><IconWrapper
                :name="(TYPE_LABEL_MAP[ach.type]?.icon as IconKey)"
                :size="12"
              /> {{ TYPE_LABEL_MAP[ach.type]?.label }}</span>
              <span class="ach-list-threshold">≥ {{ ach.threshold.toLocaleString() }}</span>
              <button
                class="btn-del-ach-item"
                title="删除此成就"
                @click="onDeleteAchievement(ach.id)"
              >
                ×
              </button>
            </div>
          </div>

          <button
            class="btn-add-achievement"
            @click="showAddAchievement = !showAddAchievement"
          >
            <span class="btn-add-icon">{{ showAddAchievement ? '−' : '+' }}</span>
            {{ showAddAchievement ? '取消' : '添加自定义成就' }}
          </button>

          <div
            v-if="showAddAchievement"
            class="add-achievement-form"
          >
            <div class="ach-form-row">
              <label class="ach-form-label">统计类型</label>
              <select
                v-model="newAchievement.type"
                class="ach-form-select"
              >
                <option
                  v-for="t in MILESTONE_TYPES"
                  :key="t.key"
                  :value="t.key"
                >
                  <IconWrapper
                    :name="t.icon"
                    :size="12"
                  /> {{ t.label }}
                </option>
              </select>
              <span class="ach-form-hint">{{ STAT_TYPE_DESCRIPTIONS[newAchievement.type] }}</span>
            </div>
            <div class="ach-form-row">
              <label class="ach-form-label">达标阈值</label>
              <input
                v-model.number="newAchievement.threshold"
                type="number"
                class="ach-form-input"
                min="1"
                placeholder="输入数值"
              />
            </div>
            <div class="ach-form-row">
              <label class="ach-form-label">图标</label>
              <input
                v-model="newAchievement.icon"
                class="ach-form-input ach-form-icon"
                placeholder="star"
              />
            </div>
            <div class="ach-form-row">
              <label class="ach-form-label">名称</label>
              <input
                v-model="newAchievement.title"
                class="ach-form-input"
                placeholder="成就名称"
              />
            </div>
            <div class="ach-form-row">
              <label class="ach-form-label">描述</label>
              <input
                v-model="newAchievement.description"
                class="ach-form-input"
                placeholder="成就描述（可选）"
              />
            </div>
            <div class="ach-form-row">
              <label class="ach-form-label">稀有度</label>
              <select
                v-model="newAchievement.tier"
                class="ach-form-select"
              >
                <option value="common">
                  普通
                </option>
                <option value="rare">
                  稀有
                </option>
                <option value="epic">
                  史诗
                </option>
                <option value="legendary">
                  传说
                </option>
              </select>
            </div>
            <div class="ach-form-actions">
              <button
                class="btn-ach-submit"
                @click="onAddAchievement"
              >
                添加成就
              </button>
            </div>
          </div>
        </div>

        <!-- ═══ Level Tab ═══ -->
        <div
          v-show="activeTab === 'level'"
          class="level-tab"
        >
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
      </div>

      <div class="rule-editor-footer">
        <button
          class="btn-cancel"
          @click="$emit('close')"
        >
          关闭
        </button>
        <button
          v-if="activeTab === 'milestones'"
          class="btn-save"
          @click="onSave"
        >
          保存规则
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  CustomAchievement,
  LevelConfig,
  MilestoneTypeKey,
} from "../types/milestoneRules"
import type { IconKey } from "@/config/icons"
import {
  computed,
  ref,
  watch,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import {
  DEFAULT_LEVEL_CONFIG,
  MILESTONE_TYPES,
  STAT_TYPE_DESCRIPTIONS,
} from "../types/milestoneRules"
import { generateDefaultRules } from "../utils/milestones"
import { useMilestoneStorage } from "../composables/useMilestoneStorage"

interface Row {
  key: MilestoneTypeKey
  icon: string
  label: string
  targets: number[]
}

interface Props {
  visible: boolean
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
}>()

const {
  customRules,
  customAchievements,
  levelConfig,
  saveRules,
  addAchievement,
  deleteAchievement,
  saveLevelConfig,
} = useMilestoneStorage()

const TIER_LABELS: Record<string, string> = {
  common: "普通",
  rare: "稀有",
  epic: "史诗",
  legendary: "传说",
}

const TYPE_LABEL_MAP = Object.fromEntries(
  MILESTONE_TYPES.map((t) => [t.key, {
    icon: t.icon,
    label: t.label,
  }]),
) as Record<string, { icon: string, label: string }>

// ── Tabs ──
const activeTab = ref<"milestones" | "achievements" | "level">("milestones")

// ── Milestones state ──
const editableRows = ref<Row[]>([])

function buildRows(rules: Record<string, number[]>): Row[] {
  const hasRules = Object.keys(rules).length > 0
  const defaults = hasRules ? null : generateDefaultRules()
  return MILESTONE_TYPES.map((t) => ({
    key: t.key,
    icon: t.icon,
    label: t.label,
    targets: [...(rules[t.key] ?? defaults?.[t.key] ?? [])],
  }))
}

watch(() => [props.visible, customRules.value], () => {
  if (props.visible) {
    editableRows.value = buildRows(customRules.value)
    activeTab.value = "milestones"
  }
}, { immediate: true })

const rows = computed(() => editableRows.value)

const levelCount = computed(() => {
  const first = editableRows.value[0]
  return first ? first.targets.length : 10
})

function onTargetChange(typeKey: MilestoneTypeKey, idx: number, val: number) {
  const row = editableRows.value.find((r) => r.key === typeKey)
  if (row && idx < row.targets.length) {
    row.targets[idx] = val
  }
}

function onLevelCountChange(e: Event) {
  const count = Number.parseInt((e.target as HTMLInputElement).value) || 10
  const clamped = Math.max(1, count)
  for (const row of editableRows.value) {
    while (row.targets.length < clamped) {
      const last = row.targets[row.targets.length - 1] || 10
      row.targets.push(Math.max(1, Math.round(last * 1.3)))
    }
    row.targets.length = clamped
  }
}

function onResetRow(key: MilestoneTypeKey) {
  const defaults = generateDefaultRules(levelCount.value)
  const row = editableRows.value.find((r) => r.key === key)
  if (row) {
    row.targets = [...(defaults[key] ?? row.targets)]
  }
}

function onResetAll() {
  const defaults = generateDefaultRules(levelCount.value)
  editableRows.value = buildRows(defaults)
}

function onSave() {
  const rules: Record<string, number[]> = {}
  for (const row of editableRows.value) {
    rules[row.key] = [...row.targets]
  }
  saveRules(rules)
  emit("close")
}

// ── Achievements state ──
const showAddAchievement = ref(false)
const newAchievement = ref<CustomAchievement>({
  id: "",
  icon: "star",
  title: "",
  description: "",
  tier: "common",
  type: "notes",
  threshold: 1,
})

function generateAchievementId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function onAddAchievement() {
  const a = newAchievement.value
  if (!a.title.trim() || a.threshold <= 0) return
  addAchievement({
    ...a,
    id: generateAchievementId(),
  })
  newAchievement.value = {
    id: "",
    icon: "star",
    title: "",
    description: "",
    tier: "common",
    type: "notes",
    threshold: 1,
  }
  showAddAchievement.value = false
}

function onDeleteAchievement(id: string) {
  deleteAchievement(id)
}

// ── Level config state ──
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
@use "../styles/MilestoneRuleEditor.scss";
</style>
