<!-- 自定义成就 Tab：成就列表 + 新增成就表单（数据走 useMilestoneStorage，文案全部走 i18n） -->
<template>
  <div class="ach-tab">
    <!-- 空态："暂无自定义成就，点击下方按钮添加。" -->
    <div
      v-if="customAchievements.length === 0"
      class="ach-empty"
    >
      {{ i18n.achEmptyHint }}
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
        <!-- 稀有度徽章文案：普通/稀有/史诗/传说 -->
        <span
          class="ach-list-tier"
          :class="`tier-${ach.tier}`"
        >{{ tierText(ach.tier) }}</span>
        <!-- 统计类型名（按类型 i18n 键解析，如："笔记数"） -->
        <span class="ach-list-type">
          <IconWrapper
            :name="typeMetaOf(ach.type)?.icon as IconKey"
            :size="12"
          /> {{ typeText(ach.type) }}
        </span>
        <span class="ach-list-threshold">≥ {{ ach.threshold.toLocaleString() }}</span>
        <!-- 删除按钮提示："删除此成就" -->
        <button
          class="btn-del-ach-item"
          :title="i18n.deleteAchievementHint"
          @click="onDeleteAchievement(ach.id)"
        >
          <IconWrapper
            name="close"
            :size="14"
          />
        </button>
      </div>
    </div>

    <!-- 切换按钮："添加自定义成就" / "取消" -->
    <button
      class="btn-add-achievement"
      @click="showAddAchievement = !showAddAchievement"
    >
      <span class="btn-add-icon">{{ showAddAchievement ? '−' : '+' }}</span>
      {{ showAddAchievement ? i18n.cancelLabel : i18n.addCustomAchievement }}
    </button>

    <div
      v-if="showAddAchievement"
      class="add-achievement-form"
    >
      <div class="ach-form-row">
        <!-- 表单标签："统计类型" -->
        <label class="ach-form-label">{{ i18n.statTypeLabel }}</label>
        <select
          v-model="newAchievement.type"
          class="ach-form-select"
        >
          <!-- 类型选项按 labelKey 查 i18n（MILESTONE_TYPES 无 label 字段），如："笔记数" -->
          <option
            v-for="t in MILESTONE_TYPES"
            :key="t.key"
            :value="t.key"
          >
            {{ i18n[t.labelKey] }}
          </option>
        </select>
        <!-- 类型说明（按 statTypeDesc* 键解析，如："笔记总数达到指定值"） -->
        <span class="ach-form-hint">{{ typeHint(newAchievement.type) }}</span>
      </div>
      <div class="ach-form-row">
        <!-- 表单标签："达标阈值" -->
        <label class="ach-form-label">{{ i18n.thresholdLabel }}</label>
        <!-- 阈值输入占位："输入数值" -->
        <input
          v-model.number="newAchievement.threshold"
          type="number"
          class="ach-form-input"
          min="1"
          :placeholder="i18n.inputNumberPh"
        />
      </div>
      <div class="ach-form-row">
        <!-- 表单标签："图标" -->
        <label class="ach-form-label">{{ i18n.iconLabel }}</label>
        <input
          v-model="newAchievement.icon"
          class="ach-form-input ach-form-icon"
          placeholder="star"
        />
      </div>
      <div class="ach-form-row">
        <!-- 表单标签："名称" -->
        <label class="ach-form-label">{{ i18n.nameLabel }}</label>
        <!-- 名称输入占位："成就名称" -->
        <input
          v-model="newAchievement.title"
          class="ach-form-input"
          :placeholder="i18n.achievementNamePh"
        />
      </div>
      <div class="ach-form-row">
        <!-- 表单标签："描述" -->
        <label class="ach-form-label">{{ i18n.descLabel }}</label>
        <!-- 描述输入占位："成就描述（可选）" -->
        <input
          v-model="newAchievement.description"
          class="ach-form-input"
          :placeholder="i18n.achievementDescPh"
        />
      </div>
      <div class="ach-form-row">
        <!-- 表单标签："稀有度" -->
        <label class="ach-form-label">{{ i18n.tierLabel }}</label>
        <select
          v-model="newAchievement.tier"
          class="ach-form-select"
        >
          <!-- 稀有度选项由 TIER_LABELS 单一数据源驱动，值经 i18n 解析 -->
          <option
            v-for="(labelKey, key) in TIER_LABELS"
            :key="key"
            :value="key"
          >
            {{ i18n[labelKey] }}
          </option>
        </select>
      </div>
      <div class="ach-form-actions">
        <!-- 提交按钮："添加成就" -->
        <button
          class="btn-ach-submit"
          :disabled="!canSubmit"
          @click="onAddAchievement"
        >
          {{ i18n.addAchievementBtn }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 自定义成就管理 Tab：成就列表 + 新增表单（i18n 键见 i18n/statistics.json，类型元数据见 milestoneRules.ts）
import type { CustomAchievement, MilestoneTypeKey } from "../../types/milestoneRules"
import type { IconKey } from "@/config/icons"
import {
  COMMON_ICONS,
  FEATURE_ICONS,
} from "@/config/icons"
import { computed, ref } from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { useMilestoneStorage } from "../../composables/useMilestoneStorage"
import {
  MILESTONE_TYPES,
  STAT_TYPE_DESCRIPTIONS,
  TIER_LABELS,
} from "../../types/milestoneRules"
import type { Tier } from "../../types/milestoneData"

interface Props {
  i18n?: Record<string, any>
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
})

/** 类型 key → 图标/type i18n 键 映射（成就列表类型列展示用） */
const TYPE_LABEL_MAP = Object.fromEntries(
  MILESTONE_TYPES.map((t) => [t.key, {
    icon: t.icon,
    labelKey: t.labelKey,
  }]),
) as Record<MilestoneTypeKey, { icon: IconKey, labelKey: string }>

/** 空表单默认值工厂（初始化与提交后重置共用，id 在提交时生成） */
function createEmptyAchievement(): Omit<CustomAchievement, "id"> {
  return {
    icon: "star",
    title: "",
    description: "",
    tier: "common",
    type: "notes",
    threshold: 1,
  }
}

function generateAchievementId(): string {
  return `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

/** 图标键未注册时回退 star，避免任意字符串以 IconKey 入库 */
function normalizeIconKey(key: string): IconKey {
  return (key in FEATURE_ICONS || key in COMMON_ICONS) ? key as IconKey : "star"
}

/** i18n 键解析：命中返回译文，未命中返回空串（禁止键名直显，亦不做中文兜底） */
function textByKey(key: string | undefined): string {
  const v = typeof key === "string" ? props.i18n[key] : undefined
  return typeof v === "string" ? v : ""
}

/** 稀有度徽章文案（TIER_LABELS 值为 i18n 键，需二次解析） */
function tierText(tier: Tier): string {
  return textByKey(TIER_LABELS[tier])
}

/** 统计类型名称（MILESTONE_TYPES 仅含 labelKey，经 i18n 解析） */
function typeText(type: string): string {
  return textByKey((TYPE_LABEL_MAP as Record<string, { icon: IconKey, labelKey: string }>)[type]?.labelKey)
}

/** 统计类型说明（STAT_TYPE_DESCRIPTIONS 值为 i18n 键，需二次解析） */
function typeHint(type: string): string {
  return textByKey(STAT_TYPE_DESCRIPTIONS[type])
}

/** 类型元数据查询（返回 undefined 时不渲染图标） */
function typeMetaOf(type: string): { icon: IconKey, labelKey: string } | undefined {
  return (TYPE_LABEL_MAP as Record<string, { icon: IconKey, labelKey: string }>)[type]
}

const {
  customAchievements,
  addAchievement,
  deleteAchievement,
} = useMilestoneStorage()

const showAddAchievement = ref(false)
const newAchievement = ref<Omit<CustomAchievement, "id">>(createEmptyAchievement())

// 标题非空 + 阈值为 ≥1 的有限数值方可提交（v-model.number 解析失败时为字符串，一并拦截）
const canSubmit = computed(() => {
  const a = newAchievement.value
  return a.title.trim().length > 0 && Number.isFinite(a.threshold) && a.threshold >= 1
})

async function onAddAchievement() {
  if (!canSubmit.value) return
  const a = newAchievement.value
  try {
    await addAchievement({
      ...a,
      id: generateAchievementId(),
      icon: normalizeIconKey(a.icon),
      title: a.title.trim(),
      description: a.description.trim(),
      threshold: Math.floor(a.threshold),
    })
    newAchievement.value = createEmptyAchievement()
    showAddAchievement.value = false
  } catch (err) {
    console.error("添加自定义成就失败:", err)
  }
}

async function onDeleteAchievement(id: string) {
  // 删除不可撤销，先经原生确认（与成就墙删除行为共用 confirmDeleteAchievement 键）
  if (!window.confirm(textByKey("confirmDeleteAchievement"))) return
  try {
    await deleteAchievement(id)
  } catch (err) {
    console.error("删除自定义成就失败:", err)
  }
}
</script>

<style scoped lang="scss">
@use "../../styles/MilestoneRuleEditor.scss";
@use '../../styles/index.scss' as stats;
</style>
