<template>
  <div class="code-comment-panel">
    <div class="panel-header">
      <h3 class="panel-title">
        <IconWrapper
          name="code"
          :size="18"
        />
        {{ i18n.codeCommentGenerator || '代码注释生成' }}
      </h3>
    </div>

    <div class="panel-content">
      <div class="input-section">
        <div class="input-label">
          <IconWrapper
            name="code"
            :size="14"
          />
          {{ i18n.enterCode || '输入代码' }}
        </div>
        <Input
          v-model="codeInput"
          type="textarea"
          class="code-textarea"
          :placeholder="i18n.codeInputPlaceholder || '粘贴需要添加注释的代码...'"
          :rows="8"
          @input="handleInput"
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
            v-for="style in commentStyles"
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
          size="small"
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
          size="small"
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
            size="small"
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
import type { Plugin } from "siyuan"
import type {
  CodeCommentResult,
  CommentStyle,
} from "../utils/codeUtils"
import { showMessage } from "siyuan"
import { ref } from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"
import { useCodeFeature } from "../composables/useCodeFeature"
import {

  COMMENT_STYLES,

  generateCodeComments,
} from "../utils/codeUtils"

interface Props {
  i18n: Record<string, any>
  plugin?: Plugin
}

const props = defineProps<Props>()

const codeInput = ref("")
const selectedStyle = ref<CommentStyle>(COMMENT_STYLES[0])
const result = ref<CodeCommentResult | null>(null)
const isGenerating = ref(false)

const {
  errorMessage,
  clearErrorOnInput,
  getApiConfig,
} = useCodeFeature(props.plugin)
clearErrorOnInput(codeInput)

const commentStyles = COMMENT_STYLES

function selectStyle(style: CommentStyle) {
  selectedStyle.value = style
}

function handleInput() {
  errorMessage.value = ""
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
    navigator.clipboard.writeText(result.value.commented)
    showMessage(props.i18n.copied || "已复制", 1500, "info")
  }
}
</script>

<style scoped lang="scss">
@use "../styles/codeUtils.scss";
</style>
