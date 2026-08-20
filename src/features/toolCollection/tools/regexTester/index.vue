<!-- 正则测试器 — 正则输入 + flags + 测试文本 + 匹配结果（高亮预览 + 引导示例 + 速查表） -->
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
      <!-- flags 切换（hover 显示各标志含义） -->
      <div class="rt-flags">
        <button
          v-for="flag in FLAGS"
          :key="flag"
          class="rt-flag"
          :class="{ active: activeFlags.includes(flag) }"
          :title="i18n.regexTester?.[FLAG_HINTS[flag]]"
          @click="toggleFlag(flag)"
        >
          {{ flag }}
        </button>
      </div>
    </div>

    <!-- 错误提示（已做友好化映射） -->
    <div
      v-if="errorMsg"
      class="rt-error"
    >
      {{ errorMsg }}
    </div>

    <!-- 正则逐段解释（有 pattern 时实时拆解含义） -->
    <div
      v-if="pattern && explainTokens.length"
      class="rt-explain"
    >
      <span
        v-for="(tok, idx) in explainTokens"
        :key="idx"
        class="rt-explain-token"
        :class="{ meta: tok.isMeta }"
        :title="i18n.regexTester?.[tok.meaningKey]"
      >
        <code class="rt-explain-raw">{{ tok.raw }}</code>
        <span class="rt-explain-mean">{{ i18n.regexTester?.[tok.meaningKey] }}</span>
      </span>
    </div>

    <!-- 首次空态引导：无正则且无测试文本时显示可点击示例 -->
    <div
      v-if="showIntro"
      class="rt-intro"
    >
      <span class="rt-intro-title">{{ i18n.regexTester?.introTitle }}</span>
      <span class="rt-intro-desc">{{ i18n.regexTester?.introDesc }}</span>
      <div class="rt-example-list">
        <button
          v-for="ex in EXAMPLES"
          :key="ex.labelKey"
          class="rt-example-btn"
          @click="applyExample(ex)"
        >
          {{ i18n.regexTester?.[ex.labelKey] }}
        </button>
      </div>
    </div>

    <!-- 有输入时：测试文本 + 结果 + 速查表 -->
    <template v-else>
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
        <!-- 匹配数达到上限被截断提示 -->
        <span
          v-if="result.truncated"
          class="rt-no-match"
        >
          {{ i18n.regexTester?.truncatedHint }}
        </span>
        <!-- 无匹配提示 -->
        <span
          v-if="pattern && result.matches.length === 0"
          class="rt-no-match"
        >
          {{ i18n.regexTester?.noMatchHint }}
        </span>
        <!-- 测试文本高亮预览（匹配段高亮） -->
        <pre
          v-if="highlightedText"
          class="rt-highlight"
          v-html="highlightedText"
        />
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

      <!-- 常用正则速查表（可折叠，点击符号插入到 pattern） -->
      <div class="rt-cheatsheet">
        <button
          class="rt-cheatsheet-toggle"
          @click="showCheat = !showCheat"
        >
          {{ i18n.regexTester?.cheatSheetTitle }}
          <span class="rt-chevron">{{ showCheat ? "▾" : "▸" }}</span>
        </button>
        <div
          v-show="showCheat"
          class="rt-cheatsheet-body"
        >
          <div
            v-for="sec in CHEAT_SHEET"
            :key="sec.section"
            class="rt-cheatsheet-section"
          >
            <span class="rt-cheatsheet-section-title">{{ i18n.regexTester?.[sec.section] }}</span>
            <div class="rt-cheatsheet-grid">
              <button
                v-for="item in sec.items"
                :key="item.symbol"
                class="rt-cheatsheet-item"
                :title="i18n.regexTester?.[item.descKey]"
                @click="insertToken(item.symbol)"
              >
                <code class="rt-cheatsheet-symbol">{{ item.symbol }}</code>
                <span class="rt-cheatsheet-desc">{{ i18n.regexTester?.[item.descKey] }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
/**
 * 正则测试器工具 - 主组件
 * 实时正则匹配 + flags 切换 + 捕获组展示
 * 增强：flags tooltip、空态引导示例、错误友好化、匹配高亮、速查表
 */
import type { Plugin } from "siyuan"
import {
  computed,
  ref,
} from "vue"
import { escapeHtml } from "@/utils/stringUtils"
import { explainRegex } from "./utils/explain"
import { safeMatch } from "./utils/match"

interface Props {
  plugin: Plugin
  i18n: Record<string, any>
}

const props = defineProps<Props>()

const FLAGS = ["g", "i", "m", "s"] as const

/** flag → i18n 键（tooltip 说明） */
const FLAG_HINTS: Record<string, string> = {
  g: "flagGlobal",
  i: "flagIgnoreCase",
  m: "flagMultiline",
  s: "flagDotAll",
}

/** 空态引导示例：点击即填充 pattern + testText + flags */
interface RegexExample {
  labelKey: string
  pattern: string
  testText: string
  flags: string
}

const EXAMPLES: RegexExample[] = [
  {
    labelKey: "exampleEmail",
    pattern: "[\\w.-]+@[\\w-]+\\.[a-zA-Z]{2,}",
    testText: "联系我们：support@example.com 或 admin@test.org",
    flags: "gi",
  },
  {
    labelKey: "examplePhone",
    pattern: "1[3-9]\\d{9}",
    testText: "手机号：13812345678，备用：15987654321",
    flags: "g",
  },
  {
    labelKey: "exampleNumber",
    pattern: "\\d+",
    testText: "订单编号 A-2024-007，共 3 件商品",
    flags: "g",
  },
]

/** 常见正则报错 → i18n 键（友好化提示） */
const ERROR_HINTS: { pattern: RegExp, key: string }[] = [
  {
    pattern: /Unterminated group/i,
    key: "errorUnterminatedGroup",
  },
  {
    pattern: /Unterminated character class/i,
    key: "errorUnterminatedClass",
  },
  {
    pattern: /Nothing to repeat/i,
    key: "errorNothingToRepeat",
  },
  {
    pattern: /Invalid group/i,
    key: "errorInvalidGroup",
  },
  {
    pattern: /Invalid escape/i,
    key: "errorInvalidEscape",
  },
  {
    pattern: /Range out of order/i,
    key: "errorRangeOrder",
  },
]

/** 速查表分组（section 为分组标题 i18n 键，descKey 为条目说明 i18n 键） */
interface CheatItem { symbol: string, descKey: string }
interface CheatSection { section: string, items: CheatItem[] }

const CHEAT_SHEET: CheatSection[] = [
  {
    section: "cheatSheetMeta",
    items: [
      {
        symbol: "\\d",
        descKey: "cheatDigit",
      },
      {
        symbol: "\\w",
        descKey: "cheatWord",
      },
      {
        symbol: "\\s",
        descKey: "cheatWhitespace",
      },
      {
        symbol: ".",
        descKey: "cheatAny",
      },
      {
        symbol: "[abc]",
        descKey: "cheatCharClass",
      },
    ],
  },
  {
    section: "cheatSheetQuantifier",
    items: [
      {
        symbol: "?",
        descKey: "cheatOpt",
      },
      {
        symbol: "*",
        descKey: "cheatZeroMore",
      },
      {
        symbol: "+",
        descKey: "cheatOneMore",
      },
      {
        symbol: "{n,m}",
        descKey: "cheatRepeat",
      },
    ],
  },
  {
    section: "cheatSheetAnchor",
    items: [
      {
        symbol: "^",
        descKey: "cheatStart",
      },
      {
        symbol: "$",
        descKey: "cheatEnd",
      },
      {
        symbol: "(...)",
        descKey: "cheatGroup",
      },
    ],
  },
]

const pattern = ref("")
const testText = ref("")
const activeFlags = ref("gi")
const showCheat = ref(false)

const toggleFlag = (flag: string): void => {
  activeFlags.value = activeFlags.value.includes(flag)
    ? activeFlags.value.replace(flag, "")
    : activeFlags.value + flag
}

const result = computed(() => safeMatch(pattern.value, activeFlags.value, testText.value))

/** 是否显示首次空态引导 */
const showIntro = computed(() => !pattern.value && !testText.value)

/** 正则逐段解释 token（非法正则也能尽力拆解） */
const explainTokens = computed(() => explainRegex(pattern.value))

/** 错误信息（原始报错 → 友好化中文提示） */
const errorMsg = computed(() => {
  const raw = result.value.error
  if (!raw) return ""
  for (const hint of ERROR_HINTS) {
    if (hint.pattern.test(raw)) {
      return props.i18n.regexTester?.[hint.key] ?? raw
    }
  }
  return raw
})

/**
 * 测试文本高亮 HTML：将每个匹配段用 <mark> 包裹。
 * 输入为纯文本，经 escapeHtml 转义后拼接，避免 XSS。
 */
const highlightedText = computed(() => {
  const text = testText.value
  if (!text) return ""
  const matches = result.value.matches.filter((m) => m.text.length > 0)
  if (matches.length === 0) return escapeHtml(text)

  let html = ""
  let cursor = 0
  for (const m of matches) {
    const start = m.index
    if (start < cursor) continue // 防御重叠（全局匹配本身不重叠，仅零宽除外）
    html += escapeHtml(text.slice(cursor, start))
    html += `<mark>${escapeHtml(text.slice(start, start + m.text.length))}</mark>`
    cursor = start + m.text.length
  }
  html += escapeHtml(text.slice(cursor))
  return html
})

/** 应用引导示例 */
const applyExample = (ex: RegexExample): void => {
  pattern.value = ex.pattern
  testText.value = ex.testText
  activeFlags.value = ex.flags
}

/** 将速查表符号追加到 pattern 末尾 */
const insertToken = (token: string): void => {
  pattern.value += token
}
</script>

<style lang="scss" scoped>
@use "./styles/index.scss";
</style>
