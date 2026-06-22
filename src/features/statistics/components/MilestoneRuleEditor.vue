<template>
  <div v-if="visible" class="rule-editor-overlay" @click.self="$emit('close')">
    <div class="rule-editor-panel">
      <div class="rule-editor-header">
        <h3 class="rule-editor-title">规则设置</h3>
        <button class="rule-editor-close" @click="$emit('close')">
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
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
      <div v-if="activeTab === 'milestones'" class="rule-editor-toolbar">
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
        <button class="btn-reset-all" @click="onResetAll">恢复默认值</button>
      </div>

      <div class="rule-editor-body">
        <!-- ═══ Milestones Tab ═══ -->
        <div v-show="activeTab === 'milestones'">
          <div class="rule-editor-help">
            <p class="help-title">使用说明</p>
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
              <IconWrapper class="rule-row-icon" :name="row.icon as IconKey" :size="14" />
              <span class="rule-row-label">{{ row.label }}</span>
              <button class="btn-reset-row" title="恢复此行默认值" @click="onResetRow(row.key)">↺</button>
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
        <div v-show="activeTab === 'achievements'" class="ach-tab">
          <div v-if="customAchievements.length === 0" class="ach-empty">
            暂无自定义成就，点击下方按钮添加。
          </div>
          <div v-else class="ach-list">
            <div
              v-for="ach in customAchievements"
              :key="ach.id"
              class="ach-list-item"
            >
              <IconWrapper class="ach-list-icon" :name="ach.icon as IconKey" :size="16" />
              <span class="ach-list-title">{{ ach.title }}</span>
              <span class="ach-list-tier" :class="`tier-${ach.tier}`">{{ TIER_LABELS[ach.tier] }}</span>
              <span class="ach-list-type"><IconWrapper :name="(TYPE_LABEL_MAP[ach.type]?.icon as IconKey)" :size="12" /> {{ TYPE_LABEL_MAP[ach.type]?.label }}</span>
              <span class="ach-list-threshold">≥ {{ ach.threshold.toLocaleString() }}</span>
              <button class="btn-del-ach-item" title="删除此成就" @click="onDeleteAchievement(ach.id)">×</button>
            </div>
          </div>

          <button class="btn-add-achievement" @click="showAddAchievement = !showAddAchievement">
            <span class="btn-add-icon">{{ showAddAchievement ? '−' : '+' }}</span>
            {{ showAddAchievement ? '取消' : '添加自定义成就' }}
          </button>

          <div v-if="showAddAchievement" class="add-achievement-form">
            <div class="ach-form-row">
              <label class="ach-form-label">统计类型</label>
              <select v-model="newAchievement.type" class="ach-form-select">
              <option v-for="t in MILESTONE_TYPES" :key="t.key" :value="t.key">
                <IconWrapper :name="t.icon" :size="12" /> {{ t.label }}
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
              <select v-model="newAchievement.tier" class="ach-form-select">
                <option value="common">普通</option>
                <option value="rare">稀有</option>
                <option value="epic">史诗</option>
                <option value="legendary">传说</option>
              </select>
            </div>
            <div class="ach-form-actions">
              <button class="btn-ach-submit" @click="onAddAchievement">添加成就</button>
            </div>
          </div>
        </div>

        <!-- ═══ Level Tab ═══ -->
        <div v-show="activeTab === 'level'" class="level-tab">
          <div class="level-config-help">
            <p class="help-title">等级系统说明</p>
            <ul class="help-list">
              <li><b>成就点</b>：每达成一个里程碑获得对应稀有度的成就点，累积成就点提升等级。</li>
              <li><b>曲线乘数</b>：控制升级难度，值越大每级所需成就点越多，升级越慢。</li>
              <li>修改后点击「保存等级设置」生效，等级和进度条会立即重新计算。</li>
            </ul>
          </div>

          <div class="level-config-section">
            <div class="level-config-label">里程碑成就点</div>
            <div class="tier-points-grid">
              <div v-for="tier in ['common','rare','epic','legendary']" :key="tier" class="tier-point-item">
                <span class="tier-point-badge" :class="`tier-${tier}`">{{ TIER_LABELS[tier] }}</span>
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
            <div class="level-config-label">等级曲线乘数</div>
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
                <span v-for="lv in 10" :key="lv" class="curve-preview-lv">
                  Lv.{{ lv }}: {{ pointsForLevelPreview(lv) }}
                </span>
              </span>
            </div>
          </div>

          <div class="level-config-actions">
            <button class="btn-save-level" @click="onSaveLevelConfig">保存等级设置</button>
          </div>
        </div>
      </div>

      <div class="rule-editor-footer">
        <button class="btn-cancel" @click="$emit('close')">关闭</button>
        <button v-if="activeTab === 'milestones'" class="btn-save" @click="onSave">保存规则</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"
import type { IconKey } from "@/config/icons"
import IconWrapper from "@/components/IconWrapper.vue"
import type { CustomAchievement, LevelConfig, MilestoneTypeKey } from "../types/milestoneRules"
import { DEFAULT_LEVEL_CONFIG, MILESTONE_TYPES, STAT_TYPE_DESCRIPTIONS } from "../types/milestoneRules"
import { generateDefaultRules } from "../utils/milestones"

interface Row {
  key: MilestoneTypeKey
  icon: string
  label: string
  targets: number[]
}

interface Props {
  visible: boolean
  rules: Record<string, number[]>
  customAchievements: CustomAchievement[]
  levelConfig: LevelConfig
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  save: [rules: Record<string, number[]>]
  addAchievement: [achievement: CustomAchievement]
  deleteAchievement: [id: string]
  saveLevelConfig: [config: LevelConfig]
}>()

const TIER_LABELS: Record<string, string> = {
  common: "普通",
  rare: "稀有",
  epic: "史诗",
  legendary: "传说",
}

const TYPE_LABEL_MAP = Object.fromEntries(
  MILESTONE_TYPES.map((t) => [t.key, { icon: t.icon, label: t.label }]),
) as Record<string, { icon: string; label: string }>

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

watch(() => [props.visible, props.rules], () => {
  if (props.visible) {
    editableRows.value = buildRows(props.rules)
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
  const count = parseInt((e.target as HTMLInputElement).value) || 10
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
  emit("save", rules)
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
  emit("addAchievement", {
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
  emit("deleteAchievement", id)
}

// ── Level config state ──
const editableLevelConfig = ref<LevelConfig>({ ...DEFAULT_LEVEL_CONFIG })

watch(() => [props.visible, props.levelConfig], () => {
  if (props.visible) {
    editableLevelConfig.value = { ...props.levelConfig }
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
  emit("saveLevelConfig", { ...editableLevelConfig.value })
}
</script>

<style scoped lang="scss">
@use "@/variables" as *;
@use "../styles/index.scss" as stats;

.rule-editor-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
}

.rule-editor-panel {
  width: 720px;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-border-color);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.2);
}

.rule-editor-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--b3-border-color);
  flex-shrink: 0;
}

.rule-editor-title {
  margin: 0;
  font-family: stats.$font-mono;
  font-size: 14px;
  font-weight: 700;
  color: var(--b3-theme-on-background);
}

.rule-editor-close {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  background: transparent;
  color: var(--b3-theme-on-surface-light);
  cursor: pointer;
  border-radius: 4px;
  &:hover {
    background: var(--b3-list-hover);
    color: var(--b3-theme-on-surface);
  }
}

// ── Tab bar ──
.rule-editor-tabs {
  display: flex;
  gap: 0;
  padding: 0 20px;
  background: var(--b3-theme-surface);
  border-bottom: 1px solid var(--b3-border-color);
  flex-shrink: 0;
}

.tab-btn {
  padding: 8px 14px;
  border: none;
  background: transparent;
  color: var(--b3-theme-on-surface-light);
  font-family: $font-body;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  cursor: pointer;
  position: relative;

  &:hover {
    color: var(--b3-theme-on-surface);
  }

  &.active {
    color: var(--b3-theme-primary);
    font-weight: 700;

    &::after {
      content: '';
      position: absolute;
      bottom: 0;
      left: 8px;
      right: 8px;
      height: 2px;
      background: var(--b3-theme-primary);
      border-radius: 1px 1px 0 0;
    }
  }
}

// ── Toolbar (milestones tab) ──
.rule-editor-toolbar {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 12px 20px;
  border-bottom: 1px solid var(--b3-border-color);
  flex-shrink: 0;
}

.level-count-label {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
}

.level-count-input {
  width: 56px;
  padding: 2px 6px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-family: stats.$font-mono;
  font-size: 12px;
  text-align: center;
  &:focus {
    outline: none;
    border-color: var(--b3-theme-primary);
  }
}

.btn-reset-all {
  padding: 4px 12px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 12px;
  cursor: pointer;
  &:hover {
    background: var(--b3-list-hover);
  }
}

// ── Body ──
.rule-editor-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 20px 16px;
}

// Help box
.rule-editor-help {
  padding: 10px 12px;
  margin-bottom: 10px;
  background: rgba(var(--b3-theme-primary-rgb), 0.04);
  border: 1px solid rgba(var(--b3-theme-primary-rgb), 0.12);
  border-radius: 4px;
}

.help-title {
  margin: 0 0 6px 0;
  font-size: 12px;
  font-weight: 700;
  color: var(--b3-theme-primary);
}

.help-list {
  margin: 0;
  padding-left: 16px;
  font-size: 11px;
  line-height: 1.6;
  color: var(--b3-theme-on-surface);

  li {
    margin-bottom: 2px;
  }

  b {
    color: var(--b3-theme-on-surface);
    font-weight: 700;
  }
}

// Level header
.level-header-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 4px 0 2px;
  border-bottom: 1px solid var(--b3-border-color);
  margin-bottom: 4px;
}

.level-header-spacer {
  width: 130px;
  flex-shrink: 0;
}

.level-header-inputs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex: 1;
}

.level-header-label {
  width: 64px;
  font-family: stats.$font-mono;
  font-size: 9px;
  font-weight: 700;
  text-align: center;
  color: var(--b3-theme-on-surface);
  opacity: 0.35;
  text-transform: uppercase;
  letter-spacing: 0.03em;
}

// Rule rows
.rule-row {
  display: flex;
  align-items: flex-start;
  gap: 12px;
  padding: 8px 0;
  border-bottom: 1px solid var(--b3-border-color);
  &:last-child {
    border-bottom: none;
  }
}

.rule-row-header {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 130px;
  flex-shrink: 0;
  padding-top: 3px;
}

.rule-row-icon {
  font-size: 14px;
}

.rule-row-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  flex: 1;
}

.btn-reset-row {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  background: transparent;
  color: var(--b3-theme-on-surface-light);
  font-size: 12px;
  cursor: pointer;
  padding: 0;
  flex-shrink: 0;
  &:hover {
    background: var(--b3-list-hover);
    color: var(--b3-theme-on-surface);
  }
}

.rule-row-inputs {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  flex: 1;
}

.rule-input {
  width: 64px;
  padding: 3px 6px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-family: stats.$font-mono;
  font-size: 12px;
  text-align: right;
  &:focus {
    outline: none;
    border-color: var(--b3-theme-primary);
    box-shadow: 0 0 0 2px rgba(var(--b3-theme-primary-rgb), 0.15);
  }
}

// ── Footer ──
.rule-editor-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--b3-border-color);
  flex-shrink: 0;
}

.btn-cancel {
  padding: 6px 16px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 13px;
  cursor: pointer;
  &:hover {
    background: var(--b3-list-hover);
  }
}

.btn-save {
  padding: 6px 20px;
  border: none;
  border-radius: 4px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  &:hover {
    opacity: 0.85;
  }
}

// ═══════════════════════════════════════
// Achievements tab
// ═══════════════════════════════════════

.ach-tab {
  padding-top: 4px;
}

.ach-empty {
  padding: 24px 0;
  text-align: center;
  font-size: 12px;
  color: var(--b3-theme-on-surface);
  opacity: 0.4;
}

// Achievement list
.ach-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.ach-list-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 10px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  background: var(--b3-theme-surface);
  font-size: 12px;

  &:hover {
    border-color: rgba(var(--b3-theme-primary-rgb), 0.3);
  }
}

.ach-list-icon {
  font-size: 16px;
  flex-shrink: 0;
}

.ach-list-title {
  flex: 1;
  font-weight: 600;
  color: var(--b3-theme-on-surface);
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ach-list-tier {
  font-family: stats.$font-mono;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 3px;
  flex-shrink: 0;

  &.tier-common { background: rgba(stats.$color-success, 0.15); color: stats.$color-success; }
  &.tier-rare { background: rgba(var(--b3-theme-primary-rgb), 0.15); color: var(--b3-theme-primary); }
  &.tier-epic { background: rgba(stats.$color-tier-epic, 0.15); color: stats.$color-tier-epic; }
  &.tier-legendary { background: rgba(stats.$color-tier-legendary, 0.2); color: stats.$color-tier-legendary; }
}

.ach-list-type {
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
  flex-shrink: 0;
}

.ach-list-threshold {
  font-family: stats.$font-mono;
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  opacity: 0.6;
  flex-shrink: 0;
  min-width: 60px;
  text-align: right;
}

.btn-del-ach-item {
  width: 22px;
  height: 22px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--b3-theme-on-surface);
  opacity: 0.25;
  font-size: 14px;
  cursor: pointer;
  border-radius: 4px;
  flex-shrink: 0;

  &:hover {
    opacity: 1;
    color: var(--stat-color-danger, #cf222e);
    background: rgba(207, 34, 46, 0.08);
  }
}

// Add achievement button
.btn-add-achievement {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  margin-top: 10px;
  border: 1px dashed var(--b3-border-color);
  border-radius: 4px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  font-family: stats.$font-mono;
  font-size: 11px;
  cursor: pointer;
  transition: border-color 0.15s, color 0.15s;

  &:hover {
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
  }
}

.btn-add-icon {
  font-size: 14px;
  font-weight: 700;
}

// Add form
.add-achievement-form {
  margin-top: 8px;
  padding: 12px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  background: rgba(var(--b3-theme-surface-rgb), 0.5);
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.ach-form-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.ach-form-label {
  width: 64px;
  flex-shrink: 0;
  font-family: stats.$font-mono;
  font-size: 10px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
  text-align: right;
}

.ach-form-input {
  width: 160px;
  padding: 4px 8px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-family: stats.$font-mono;
  font-size: 12px;

  &:focus {
    outline: none;
    border-color: var(--b3-theme-primary);
    box-shadow: 0 0 0 2px rgba(var(--b3-theme-primary-rgb), 0.12);
  }
}

.ach-form-icon {
  width: 48px;
  text-align: center;
  font-size: 16px;
}

.ach-form-select {
  padding: 4px 6px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-size: 12px;
  cursor: pointer;

  &:focus {
    outline: none;
    border-color: var(--b3-theme-primary);
  }
}

.ach-form-hint {
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  opacity: 0.35;
  font-style: italic;
}

.ach-form-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 4px;
}

.btn-ach-submit {
  padding: 5px 16px;
  border: none;
  border-radius: 4px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    opacity: 0.85;
  }
}

// ═══════════════════════════════════════
// Level config tab
// ═══════════════════════════════════════

.level-tab {
  padding-top: 4px;
}

.level-config-help {
  padding: 10px 12px;
  margin-bottom: 12px;
  background: rgba(var(--b3-theme-primary-rgb), 0.04);
  border: 1px solid rgba(var(--b3-theme-primary-rgb), 0.12);
  border-radius: 4px;

  .help-title {
    margin: 0 0 6px 0;
    font-size: 12px;
    font-weight: 700;
    color: var(--b3-theme-primary);
  }

  .help-list {
    margin: 0;
    padding-left: 16px;
    font-size: 11px;
    line-height: 1.6;
    color: var(--b3-theme-on-surface);

    li { margin-bottom: 2px; }
    b { color: var(--b3-theme-on-surface); font-weight: 700; }
  }
}

.level-config-section {
  margin-bottom: 14px;
}

.level-config-label {
  font-family: stats.$font-mono;
  font-size: 10px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
  margin-bottom: 8px;
}

.tier-points-grid {
  display: flex;
  gap: 8px;
}

.tier-point-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  background: var(--b3-theme-surface);
}

.tier-point-badge {
  font-family: stats.$font-mono;
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 3px;
  min-width: 32px;
  text-align: center;

  &.tier-common { background: rgba(stats.$color-success, 0.15); color: stats.$color-success; }
  &.tier-rare { background: rgba(var(--b3-theme-primary-rgb), 0.15); color: var(--b3-theme-primary); }
  &.tier-epic { background: rgba(stats.$color-tier-epic, 0.15); color: stats.$color-tier-epic; }
  &.tier-legendary { background: rgba(stats.$color-tier-legendary, 0.2); color: stats.$color-tier-legendary; }
}

.tier-point-input {
  width: 56px;
  padding: 3px 6px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-surface);
  font-family: stats.$font-mono;
  font-size: 13px;
  font-weight: 600;
  text-align: center;

  &:focus {
    outline: none;
    border-color: var(--b3-theme-primary);
    box-shadow: 0 0 0 2px rgba(var(--b3-theme-primary-rgb), 0.15);
  }
}

.tier-point-unit {
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  opacity: 0.4;
}

.curve-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.curve-input {
  width: 64px;
  padding: 4px 8px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  font-family: stats.$font-mono;
  font-size: 14px;
  font-weight: 600;
  text-align: center;

  &:focus {
    outline: none;
    border-color: var(--b3-theme-primary);
    box-shadow: 0 0 0 2px rgba(var(--b3-theme-primary-rgb), 0.15);
  }
}

.curve-formula-hint {
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;

  code {
    font-family: stats.$font-mono;
    font-size: 11px;
    color: var(--b3-theme-primary);
    background: rgba(var(--b3-theme-primary-rgb), 0.06);
    padding: 1px 4px;
    border-radius: 2px;
  }
}

.curve-preview {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.curve-preview-label {
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  opacity: 0.4;
}

.curve-preview-values {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.curve-preview-lv {
  font-family: stats.$font-mono;
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  opacity: 0.45;
  background: var(--b3-theme-surface);
  padding: 2px 6px;
  border-radius: 3px;
  border: 1px solid var(--b3-border-color);
}

.level-config-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 8px;
  border-top: 1px solid var(--b3-border-color);
  margin-top: 8px;
}

.btn-save-level {
  padding: 5px 16px;
  border: none;
  border-radius: 4px;
  background: var(--b3-theme-primary);
  color: var(--b3-theme-on-primary);
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;

  &:hover {
    opacity: 0.85;
  }
}
</style>
