<!-- 技能选择器区域组件 -->
<template>
  <div
    class="skill-selector-wrapper"
    :class="{ open: showSkillDropdown }"
  >
    <div
      class="skill-select-trigger"
      title="选择预设技能作为系统指令"
      @click="toggleSkillDropdown"
    >
      <span class="skill-select-value">
        <template v-if="currentSkillIndex >= 0 && currentSkill">
          {{ currentSkill.name }}
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
      v-if="currentSkillIndex >= 0 && currentSkill"
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
          :value="skillSearchQuery"
          type="text"
          placeholder="搜索技能..."
          class="skill-search-input"
          @input="onSkillSearchInput($event)"
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
import { nextTick, onMounted, onUnmounted, ref } from "vue"
import { getSourceDotColors } from "../utils"

const props = defineProps<{
  currentSkillIndex: number
  currentSkill: SkillItem | null
  skills: SkillItem[]
  filteredSkills: SkillItem[]
  skillSearchQuery: string
}>()

const emit = defineEmits<{
  'update:skillSearchQuery': [value: string]
  'selectSkill': [index: number]
  'showPreview': []
}>()

const showSkillDropdown = ref(false)
const skillSearchInputRef = ref<HTMLInputElement | null>(null)

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
  emit("selectSkill", index)
  showSkillDropdown.value = false
}

const onSkillSearchInput = (e: Event) => {
  const value = (e.target as HTMLInputElement).value
  emit("update:skillSearchQuery", value)
}

// 点击外部关闭下拉
const handleClickOutside = (e: MouseEvent) => {
  const wrapper = document.querySelector(".skill-selector-wrapper")
  if (wrapper && !wrapper.contains(e.target as Node)) {
    showSkillDropdown.value = false
  }
}
onMounted(() => document.addEventListener("click", handleClickOutside))
onUnmounted(() => document.removeEventListener("click", handleClickOutside))
</script>

<style scoped lang="scss">
@use "./styles/SkillSection.scss" as *;
</style>
