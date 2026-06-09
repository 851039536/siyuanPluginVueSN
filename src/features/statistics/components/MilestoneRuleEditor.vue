<template>
  <div v-if="visible" class="rule-editor-overlay" @click.self="$emit('close')">
    <div class="rule-editor-panel">
      <div class="rule-editor-header">
        <h3 class="rule-editor-title">自定义里程碑规则</h3>
        <button class="rule-editor-close" @click="$emit('close')">
          <svg width="16" height="16" viewBox="0 0 16 16"><path d="M4 4l8 8M12 4l-8 8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
        </button>
      </div>

      <div class="rule-editor-toolbar">
        <label class="level-count-label">
          每类里程碑级数:
          <input
            type="number"
            class="level-count-input"
            :value="levelCount"
            min="1"
            max="30"
            @change="onLevelCountChange"
          />
        </label>
        <button class="btn-reset-all" @click="onResetAll">恢复默认值</button>
      </div>

      <div class="rule-editor-body">
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
            <span class="rule-row-icon">{{ row.icon }}</span>
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

      <div class="rule-editor-footer">
        <button class="btn-cancel" @click="$emit('close')">取消</button>
        <button class="btn-save" @click="onSave">保存规则</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from "vue"
import type { MilestoneTypeKey } from "../types/milestoneRules"
import { MILESTONE_TYPES } from "../types/milestoneRules"
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
}

const props = defineProps<Props>()
const emit = defineEmits<{
  close: []
  save: [rules: Record<string, number[]>]
}>()

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
  }
}, { immediate: true })

const rows = computed(() => editableRows.value)

const levelCount = computed(() => {
  const first = editableRows.value[0]
  return first ? first.targets.length : 10
})

function onTargetChange(typeKey: MilestoneTypeKey, idx: number, val: number) {
  const row = editableRows.value.find(r => r.key === typeKey)
  if (row && idx < row.targets.length) {
    row.targets[idx] = val
  }
}

function onLevelCountChange(e: Event) {
  const count = parseInt((e.target as HTMLInputElement).value) || 10
  const clamped = Math.max(1, Math.min(30, count))
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
  const row = editableRows.value.find(r => r.key === key)
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

.rule-editor-body {
  flex: 1;
  overflow-y: auto;
  padding: 8px 20px 16px;
}

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
</style>
