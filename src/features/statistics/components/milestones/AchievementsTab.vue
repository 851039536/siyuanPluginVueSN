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
          <!-- 原生 option 不渲染元素子节点，只放文本标签 -->
          <option
            v-for="t in MILESTONE_TYPES"
            :key="t.key"
            :value="t.key"
          >
            {{ t.label }}
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
          <!-- 稀有度选项由 TIER_LABELS 单一数据源驱动 -->
          <option
            v-for="(label, key) in TIER_LABELS"
            :key="key"
            :value="key"
          >
            {{ label }}
          </option>
        </select>
      </div>
      <div class="ach-form-actions">
        <button
          class="btn-ach-submit"
          :disabled="!canSubmit"
          @click="onAddAchievement"
        >
          添加成就
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// 模块级常量与纯工具：只构建一次，不随组件实例重建
import type { CustomAchievement } from "../../types/milestoneRules"
import type { IconKey } from "@/config/icons"
import {
  COMMON_ICONS,
  FEATURE_ICONS,
} from "@/config/icons"
import {
  computed,
  ref,
} from "vue"
import IconWrapper from "@/components/IconWrapper.vue"
import { useMilestoneStorage } from "../../composables/useMilestoneStorage"
import {
  MILESTONE_TYPES,
  STAT_TYPE_DESCRIPTIONS,
  TIER_LABELS,
} from "../../types/milestoneRules"

/** 类型 key → 图标/标签映射（成就列表项展示用） */
const TYPE_LABEL_MAP = Object.fromEntries(
  MILESTONE_TYPES.map((t) => [t.key, {
    icon: t.icon,
    label: t.label,
  }]),
) as Record<string, { icon: IconKey, label: string }>

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
  // 删除不可撤销，先经原生确认
  if (!window.confirm("确定删除此成就？")) return
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
