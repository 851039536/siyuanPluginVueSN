<!-- 技能选择器区域组件：共享 Select（可搜索）选择技能 + 技能细则预览入口 -->
<template>
  <div class="skill-selector-wrapper">
    <!-- 技能下拉：选中项与下拉选项均展示"技能名 + 来源工具色点" -->
    <Select
      class="skill-select"
      size="xsmall"
      placement="top"
      :max-height="240"
      filterable
      :model-value="selectedSkillId"
      :options="skillOptions"
      :placeholder="i18n.skillNone"
      :title="i18n.skillSelectTitle"
      :filter-placeholder="i18n.skillSearchPlaceholder"
      :empty-text="i18n.skillNoMatch"
      @update:model-value="onSelect"
    >
      <!-- 已选项富内容：技能名 + 来源工具色点 -->
      <template #selected="{ option }">
        <span class="skill-item-main">
          <span class="skill-item-name">{{ option?.label }}</span>
          <span
            v-if="option?.skill"
            class="skill-source-dots"
          >
            <span
              v-for="(color, i) in getSourceDotColors(option.skill)"
              :key="i"
              class="source-dot"
              :style="{ background: color }"
            ></span>
          </span>
        </span>
      </template>
      <!-- 下拉选项富内容：技能名 + 来源工具色点 -->
      <template #option="{ option }">
        <span class="skill-item-main">
          <span class="skill-item-name">{{ option.label }}</span>
          <span
            v-if="option.skill"
            class="skill-source-dots"
          >
            <span
              v-for="(color, i) in getSourceDotColors(option.skill)"
              :key="i"
              class="source-dot"
              :style="{ background: color }"
            ></span>
          </span>
        </span>
      </template>
    </Select>
    <!-- 纯图标按钮：预览技能细则（ariaLabel："预览技能细则"） -->
    <Button
      v-if="hasCurrentSkill"
      variant="ghost"
      text
      size="xsmall"
      icon="eye"
      :aria-label="i18n.skillPreviewTitle"
      @click="$emit('showPreview')"
    />
  </div>
</template>

<script setup lang="ts">
import type { SelectOption } from "@/components/Select.vue"
import type { SkillItem } from "@/types/ai"
import { computed } from "vue"
import Button from "@/components/Button.vue"
import Select from "@/components/Select.vue"
import { getSourceDotColors } from "../utils"

const props = defineProps<{
  /** 国际化文案 */
  i18n: Record<string, string>
  currentSkillIndex: number
  currentSkill: SkillItem | null
  skills: SkillItem[]
}>()

const emit = defineEmits<{
  'selectSkill': [index: number]
  'showPreview': []
}>()

/** "无技能"选项值（与 currentSkill 为空时的选中值一致） */
const NONE_VALUE = ""

/** 当前是否有选中技能（索引越界时 currentSkill 为 null，避免 UI 状态不一致） */
const hasCurrentSkill = computed(() => props.currentSkillIndex >= 0 && !!props.currentSkill)

/** 当前选中值：无技能时回落到"无技能"选项 */
const selectedSkillId = computed(() => props.currentSkill?.id ?? NONE_VALUE)

/**
 * 下拉选项：首项为"无技能"，其余为技能列表。
 * keywords 覆盖名称 + 描述 + 来源工具，保留原自建下拉的多字段检索能力。
 */
const skillOptions = computed<SelectOption[]>(() => [
  { value: NONE_VALUE, label: props.i18n.skillNone },
  ...props.skills.map((skill) => ({
    value: skill.id,
    label: skill.name,
    keywords: [
      skill.description,
      ...skill.sources.map((src) => src.tool),
    ].join(" "),
    skill,
  })),
])

/** 选择回调：按 id 反查索引（索引不稳定，持久化也按 id） */
const onSelect = (value: string | number | boolean | null) => {
  const id = String(value ?? "")
  if (!id) {
    emit("selectSkill", -1)
    return
  }
  const index = props.skills.findIndex((s) => s.id === id)
  if (index === -1) return // 防御：找不到时静默退出，禁止误选"无技能"
  emit("selectSkill", index)
}
</script>

<style scoped lang="scss">
@use "./styles/SkillSection.scss" as *;
</style>
