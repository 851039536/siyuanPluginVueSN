<!-- 代码注释生成器 — 为代码生成多种风格的注释 -->
<template>
  <div class="code-comment-panel">
    <div class="panel-content">
      <div class="input-section">
        <Input
          v-model="codeInput"
          type="textarea"
          class="code-textarea"
          :placeholder="i18n.codeInputPlaceholder || '粘贴需要添加注释的代码...'"
          :rows="8"
        />
      </div>

      <div class="style-section">
        <div class="style-label">
          <IconWrapper
            name="format"
            :size="14"
          />
          {{ i18n.commentStyle || '注释风格' }}
        </div>
        <div class="style-options">
          <div
            v-for="style in COMMENT_STYLES"
            :key="style.id"
            class="style-option"
            :class="{ active: selectedStyle.id === style.id }"
            @click="selectStyle(style)"
          >
            <div class="style-name">
              {{ style.label }}
            </div>
            <div class="style-example">
              {{ style.example }}
            </div>
          </div>
        </div>
      </div>

      <div class="action-section">
        <Button
          variant="primary"
          size="xsmall"
          :disabled="isGenerating || !codeInput.trim()"
          :loading="isGenerating"
          @click="handleGenerate"
        >
          <IconWrapper
            name="sparkles"
            :size="16"
          />
          {{ isGenerating ? (i18n.generating || '生成中...') : (i18n.generate || '生成注释') }}
        </Button>
        <Button
          variant="ghost"
          size="xsmall"
          :disabled="!codeInput.trim() && !result"
          @click="handleClear"
        >
          <IconWrapper
            name="delete"
            :size="16"
          />
          {{ i18n.clear || '清除' }}
        </Button>
      </div>

      <div
        v-if="result"
        class="result-section"
      >
        <div class="result-header">
          <span class="result-label">
            <IconWrapper
              name="success"
              :size="14"
            />
            {{ i18n.generatedResult || '生成结果' }}
          </span>
          <Button
            variant="ghost"
            size="xsmall"
            @click="copyResult"
          >
            <IconWrapper
              name="contentCopy"
              :size="14"
            />
            {{ i18n.copy || '复制' }}
          </Button>
        </div>
        <div class="result-content">
          <pre class="code-result">{{ result.commented }}</pre>
        </div>
      </div>

      <div
        v-if="errorMessage"
        class="error-section"
      >
        <IconWrapper
          name="error"
          :size="16"
        />
        {{ errorMessage }}
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type {
  CodeCommentResult,
  CommentStyle,
} from "../utils/codeUtils"
import { ref } from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"
import { useCodeFeature } from "../composables/useCodeFeature"
import {
  COMMENT_STYLES,
  generateCodeComments,
} from "../utils/codeUtils"
import type { WordQueryComponentProps } from "../types"

const props = defineProps<WordQueryComponentProps>()

const codeInput = ref("")
const selectedStyle = ref<CommentStyle>(COMMENT_STYLES[0])
const result = ref<CodeCommentResult | null>(null)
const isGenerating = ref(false)

const {
  errorMessage,
  clearErrorOnInput,
  getApiConfig,
  copyText,
} = useCodeFeature(props.plugin)
clearErrorOnInput(codeInput)

function selectStyle(style: CommentStyle) {
  selectedStyle.value = style
}

async function handleGenerate() {
  if (!codeInput.value.trim()) {
    errorMessage.value = props.i18n.enterCode || "请输入代码内容"
    return
  }

  isGenerating.value = true
  errorMessage.value = ""

  try {
    const config = getApiConfig()
    const res = await generateCodeComments(
      codeInput.value.trim(),
      selectedStyle.value,
      config,
    )
    result.value = res
  } catch (error) {
    console.error("生成注释失败:", error)
    errorMessage.value =
      (error as Error).message
      || props.i18n.generateFailed
      || "生成失败，请重试"
  } finally {
    isGenerating.value = false
  }
}

function handleClear() {
  codeInput.value = ""
  result.value = null
  errorMessage.value = ""
}

function copyResult() {
  if (result.value) {
    copyText(result.value.commented)
  }
}
</script>

<style scoped lang="scss">
@use "../styles/codeUtils.scss";
</style>
