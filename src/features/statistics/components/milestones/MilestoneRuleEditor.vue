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
          <IconWrapper
            name="close"
            :size="16"
          />
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
            v-for="row in editableRows"
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
                min="0"
                @change="(e: Event) => onTargetChange(row.key, idx, (e.target as HTMLInputElement).value)"
              />
            </div>
          </div>
        </div>

        <!-- ═══ Achievements Tab（自定义成就管理） ═══ -->
        <AchievementsTab v-show="activeTab === 'achievements'" />

        <!-- ═══ Level Tab（等级设置） ═══ -->
        <LevelConfigTab
          v-show="activeTab === 'level'"
          :visible="visible"
        />
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
import type { MilestoneTypeKey } from "../../types/milestoneRules"
import type { IconKey } from "@/config/icons"
import {
  computed,
  ref,
  watch,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { useMilestoneStorage } from "../../composables/useMilestoneStorage"
import { MILESTONE_TYPES } from "../../types/milestoneRules"
import { generateDefaultRules } from "../../utils/milestones"
import AchievementsTab from "./AchievementsTab.vue"
import LevelConfigTab from "./LevelConfigTab.vue"

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
  saveRules,
} = useMilestoneStorage()

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

const levelCount = computed(() => {
  const first = editableRows.value[0]
  return first ? first.targets.length : 10
})

function onTargetChange(typeKey: MilestoneTypeKey, idx: number, raw: string) {
  const row = editableRows.value.find((r) => r.key === typeKey)
  if (row && idx < row.targets.length) {
    const v = Number.parseInt(raw)
    // 留空/非数字视为 0：0 表示该等级及之后不再生成里程碑
    row.targets[idx] = Number.isNaN(v) ? 0 : Math.max(0, v)
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
    const targets = [...row.targets]
    // 裁剪末尾 0（0 表示该等级起不再生成）；全 0 时保留单个 0 使该类型整体不生成
    while (targets.length > 1 && targets[targets.length - 1] <= 0) {
      targets.pop()
    }
    rules[row.key] = targets
  }
  saveRules(rules)
  emit("close")
}
</script>

<style scoped lang="scss">
@use "../../styles/MilestoneRuleEditor.scss";
@use '../../styles/index.scss' as stats;
</style>
