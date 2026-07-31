<!-- 技能选择器区域组件 -->
<template>
  <div
    ref="wrapperRef"
    class="skill-selector-wrapper"
    :class="{ open: showSkillDropdown }"
  >
    <div
      class="skill-select-trigger"
      title="选择预设技能作为系统指令"
      @click="toggleSkillDropdown"
    >
      <span class="skill-select-value">
        <template v-if="hasCurrentSkill">
          {{ currentSkill?.name }}
          <span class="skill-source-dots">
            <span
              v-for="(color, i) in getSourceDotColors(currentSkill)"
              :key="i"
              class="source-dot"
              :style="{ background: color }"
            ></span>
          </span>
        </template>
        <template v-else>无技能</template>
      </span>
      <svg
        class="skill-select-arrow"
        width="10"
        height="10"
      ><use xlink:href="#iconDown"></use></svg>
    </div>
    <!-- 技能预览按钮 -->
    <button
      v-if="hasCurrentSkill"
      class="skill-preview-btn"
      title="预览技能细则"
      @click="$emit('showPreview')"
    >
      <svg
        width="11"
        height="11"
      ><use xlink:href="#iconEye" /></svg>
    </button>
    <!-- 下拉面板 -->
    <div
      v-if="showSkillDropdown"
      class="skill-dropdown"
    >
      <div class="skill-dropdown-search">
        <svg
          width="12"
          height="12"
        ><use xlink:href="#iconSearch"></use></svg>
        <input
          ref="skillSearchInputRef"
          v-model="skillSearchQuery"
          type="text"
          placeholder="搜索技能..."
          class="skill-search-input"
          @keydown.escape.stop="showSkillDropdown = false"
        />
      </div>
      <div class="skill-dropdown-list">
        <div
          class="skill-dropdown-item"
          :class="{ active: currentSkillIndex === -1 }"
          @click="selectSkill(-1)"
        >
          无技能
        </div>
        <div
          v-for="skill in filteredSkills"
          :key="skill.id"
          class="skill-dropdown-item"
          :class="{ active: currentSkill && currentSkill.id === skill.id }"
          @click="selectSkillByItem(skill)"
        >
          <div class="skill-item-main">
            <span class="skill-item-name">{{ skill.name }}</span>
            <span class="skill-source-dots">
              <span
                v-for="(color, i) in getSourceDotColors(skill)"
                :key="i"
                class="source-dot"
                :style="{ background: color }"
              ></span>
            </span>
          </div>
        </div>
        <div
          v-if="filteredSkills.length === 0"
          class="skill-dropdown-empty"
        >
          无匹配技能
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SkillItem } from "@/types/ai"
import { computed, nextTick, onMounted, onUnmounted, ref } from "vue"
import { getSourceDotColors } from "../utils"

const props = defineProps<{
  currentSkillIndex: number
  currentSkill: SkillItem | null
  skills: SkillItem[]
}>()

const emit = defineEmits<{
  'selectSkill': [index: number]
  'showPreview': []
}>()

const showSkillDropdown = ref(false)
const skillSearchInputRef = ref<HTMLInputElement | null>(null)
const wrapperRef = ref<HTMLElement | null>(null)

/** 当前是否有选中技能（索引越界时 currentSkill 为 null，避免 UI 状态不一致） */
const hasCurrentSkill = computed(() => props.currentSkillIndex >= 0 && !!props.currentSkill)

// ===== 技能搜索（本地状态，仅服务本组件下拉过滤） =====

const skillSearchQuery = ref("")

/** 根据搜索关键词过滤技能 */
const filteredSkills = computed(() => {
  if (!skillSearchQuery.value.trim()) {
    return props.skills
  }
  const query = skillSearchQuery.value.toLowerCase().trim()
  return props.skills.filter(
    (s) =>
      s.name.toLowerCase().includes(query)
      || s.description.toLowerCase().includes(query)
      || s.sources.some((src) => src.tool.toLowerCase().includes(query)),
  )
})

const toggleSkillDropdown = () => {
  showSkillDropdown.value = !showSkillDropdown.value
  if (showSkillDropdown.value) {
    nextTick(() => {
      skillSearchInputRef.value?.focus()
    })
  }
}

const selectSkill = (index: number) => {
  emit("selectSkill", index)
  showSkillDropdown.value = false
}

/** 通过技能对象选择（在原始 skills 中找到索引） */
const selectSkillByItem = (skill: SkillItem) => {
  const index = props.skills.findIndex((s) => s.id === skill.id)
  if (index === -1) return // 防御：找不到时静默退出，禁止误选"无技能"
  selectSkill(index)
}

// 点击外部关闭下拉（基于组件根 ref，避免全局 querySelector 命中错误实例）
const handleClickOutside = (e: MouseEvent) => {
  if (wrapperRef.value && !wrapperRef.value.contains(e.target as Node)) {
    showSkillDropdown.value = false
  }
}
onMounted(() => document.addEventListener("click", handleClickOutside))
onUnmounted(() => document.removeEventListener("click", handleClickOutside))
</script>

<style scoped lang="scss">
@use "./styles/SkillSection.scss" as *;
</style>
