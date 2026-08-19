<!-- 正则测试器 — 正则输入 + flags + 测试文本 + 匹配结果 -->
<template>
  <div class="regex-tester">
    <!-- 正则表达式输入行 -->
    <div class="rt-pattern-row">
      <span class="rt-slash">/</span>
      <input
        v-model="pattern"
        class="rt-pattern-input"
        :placeholder="i18n.regexTester?.patternPlaceholder"
        spellcheck="false"
      >
      <span class="rt-slash">/</span>
      <!-- flags 切换 -->
      <div class="rt-flags">
        <button
          v-for="flag in FLAGS"
          :key="flag"
          class="rt-flag"
          :class="{ active: activeFlags.includes(flag) }"
          @click="toggleFlag(flag)"
        >
          {{ flag }}
        </button>
      </div>
    </div>

    <!-- 错误提示 -->
    <div
      v-if="errorMsg"
      class="rt-error"
    >
      {{ errorMsg }}
    </div>

    <!-- 测试文本区 -->
    <div class="rt-test-area">
      <!-- 测试文本标签 -->
      <span class="rt-test-label">{{ i18n.regexTester?.testText }}</span>
      <textarea
        v-model="testText"
        :placeholder="i18n.regexTester?.testPlaceholder"
        spellcheck="false"
      />
    </div>

    <!-- 匹配结果 -->
    <div class="rt-results">
      <!-- 结果统计 -->
      <span class="rt-results-header">
        {{ i18n.regexTester?.matches }}: {{ result.matches.length }}
      </span>
      <div class="rt-match-list">
        <div
          v-for="(m, idx) in result.matches"
          :key="idx"
          class="rt-match-item"
        >
          <span class="rt-match-idx">#{{ idx + 1 }} @{{ m.index }}</span>
          <span class="rt-match-text">{{ m.text }}</span>
          <span
            v-if="m.groups.length"
            class="rt-match-groups"
          >
            [{{ m.groups.join(", ") }}]
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * 正则测试器工具 - 主组件
 * 实时正则匹配 + flags 切换 + 捕获组展示
 */
import type { Plugin } from "siyuan"
import { computed, ref } from "vue"
import { safeMatch } from "./utils/match"

interface Props {
  plugin: Plugin
  i18n: Record<string, any>
}

defineProps<Props>()

const FLAGS = ["g", "i", "m", "s"] as const

const pattern = ref("")
const testText = ref("")
const activeFlags = ref("gi")

const toggleFlag = (flag: string) => {
  activeFlags.value = activeFlags.value.includes(flag)
    ? activeFlags.value.replace(flag, "")
    : activeFlags.value + flag
}

const result = computed(() => safeMatch(pattern.value, activeFlags.value, testText.value))
const errorMsg = computed(() => result.value.error ?? "")
</script>

<style lang="scss" scoped>
@use "./styles/index.scss";
</style>
