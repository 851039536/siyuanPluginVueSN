<!-- 单词查询主面板 — 模式切换外壳（单词查询、长文翻译、编程翻译、注释生成、代码解释、正则生成） -->
<template>
  <div class="word-query-panel">
    <div class="query-header">
      <div class="mode-tabs">
        <Button
          class="mode-tab"
          :class="{ active: currentMode === 'word' }"
          variant="ghost"
          size="xsmall"
          @click="switchMode('word')"
        >
          <IconWrapper
            name="wordQuery"
            :size="16"
          />
          {{ props.i18n.wordQuery?.title }}
        </Button>
        <Button
          class="mode-tab"
          :class="{ active: currentMode === 'translate' }"
          variant="ghost"
          size="xsmall"
          @click="switchMode('translate')"
        >
          <IconWrapper
            name="translate"
            :size="16"
          />
          {{ props.i18n.wordQuery?.translation }}
        </Button>
        <Button
          class="mode-tab"
          :class="{ active: currentMode === 'codeTranslation' }"
          variant="ghost"
          size="xsmall"
          @click="switchMode('codeTranslation')"
        >
          <IconWrapper
            name="codeTranslation"
            :size="16"
          />
          {{ props.i18n.wordQuery?.codeTranslation }}
        </Button>
        <Button
          class="mode-tab"
          :class="{ active: currentMode === 'codeComment' }"
          variant="ghost"
          size="xsmall"
          @click="switchMode('codeComment')"
        >
          <IconWrapper
            name="codeComment"
            :size="16"
          />
          {{ props.i18n.wordQuery?.codeComment }}
        </Button>
        <Button
          class="mode-tab"
          :class="{ active: currentMode === 'codeExplain' }"
          variant="ghost"
          size="xsmall"
          @click="switchMode('codeExplain')"
        >
          <IconWrapper
            name="search"
            :size="16"
          />
          {{ props.i18n.wordQuery?.codeExplain}}
        </Button>
        <Button
          class="mode-tab"
          :class="{ active: currentMode === 'regex' }"
          variant="ghost"
          size="xsmall"
          @click="switchMode('regex')"
        >
          <IconWrapper
            name="regex"
            :size="16"
          />
          {{ props.i18n.wordQuery?.regexGenerator }}
        </Button>
      </div>
    </div>

    <div class="mode-content">
      <WordQueryPanel
        v-if="currentMode === 'word'"
        :i18n="props.i18n.wordQuery || {}"
        :plugin="props.plugin"
      />
      <TranslatePanel
        v-else-if="currentMode === 'translate'"
        :i18n="props.i18n.wordQuery || {}"
        :plugin="props.plugin"
      />
      <CodeTranslationPanel
        v-else-if="currentMode === 'codeTranslation'"
        :i18n="props.i18n.wordQuery || {}"
        :plugin="props.plugin"
      />
      <CodeCommentGenerator
        v-else-if="currentMode === 'codeComment'"
        :i18n="props.i18n.wordQuery || {}"
        :plugin="props.plugin"
      />
      <CodeExplainer
        v-else-if="currentMode === 'codeExplain'"
        :i18n="props.i18n.wordQuery || {}"
        :plugin="props.plugin"
      />
      <RegexGenerator
        v-else-if="currentMode === 'regex'"
        :i18n="props.i18n.wordQuery || {}"
        :plugin="props.plugin"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import type { Plugin } from "siyuan"
import { ref } from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import CodeCommentGenerator from "./components/CodeCommentGenerator.vue"
import CodeExplainer from "./components/CodeExplainer.vue"
import CodeTranslationPanel from "./components/CodeTranslationPanel.vue"
import RegexGenerator from "./components/RegexGenerator.vue"
import TranslatePanel from "./components/TranslatePanel.vue"
import WordQueryPanel from "./components/WordQueryPanel.vue"

interface Props {
  i18n: Record<string, any> & { wordQuery?: Record<string, string> }
  plugin?: Plugin
}

const props = defineProps<Props>()

type Mode = "word" | "translate" | "codeTranslation" | "codeComment" | "codeExplain" | "regex"

const currentMode = ref<Mode>("word")

const switchMode = (mode: Mode) => {
  currentMode.value = mode
}
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
