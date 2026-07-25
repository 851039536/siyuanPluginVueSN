<!-- 自定义成就 Tab：成就列表 + 新增成就表单（数据走 useMilestoneStorage） -->
<template>
  <div class="ach-tab">
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
          <IconWrapper
            name="close"
            :size="14"
          />
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
</template>

<script setup lang="ts">
import type { CustomAchievement } from "../types/milestoneRules"
import type { IconKey } from "@/config/icons"
import { ref } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { useMilestoneStorage } from "../composables/useMilestoneStorage"
import {
  MILESTONE_TYPES,
  STAT_TYPE_DESCRIPTIONS,
  TIER_LABELS,
} from "../types/milestoneRules"

const {
  customAchievements,
  addAchievement,
  deleteAchievement,
} = useMilestoneStorage()

const TYPE_LABEL_MAP = Object.fromEntries(
  MILESTONE_TYPES.map((t) => [t.key, {
    icon: t.icon,
    label: t.label,
  }]),
) as Record<string, { icon: string, label: string }>

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
</script>

<style scoped lang="scss">
@use "../styles/MilestoneRuleEditor.scss";
@use '../styles/index.scss' as stats;
</style>
