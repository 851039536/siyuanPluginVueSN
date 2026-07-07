<!-- 正则表达式生成器 — 根据描述和示例生成并测试正则 -->
<template>
  <div class="regex-generator-panel">
    <div class="panel-content">
      <div class="input-section">
        <div class="input-label">
          <IconWrapper
            name="edit"
            :size="14"
          />
          {{ i18n.regexDescription || '正则描述' }}
        </div>
        <Input
          v-model="description"
          type="textarea"
          class="description-textarea"
          :placeholder="i18n.regexDescPlaceholder || '描述你想要的正则表达式，例如：匹配邮箱地址、匹配手机号码...'"
          :rows="3"
        />
      </div>

      <div class="examples-section">
        <div class="examples-header">
          <span class="examples-label">
            <IconWrapper
              name="list"
              :size="14"
            />
            {{ i18n.matchExamples || '匹配示例' }}
          </span>
          <Button
            variant="ghost"
            size="xsmall"
            @click="addExample"
          >
            <IconWrapper
              name="add"
              :size="14"
            />
            {{ i18n.addExample || '添加示例' }}
          </Button>
        </div>
        <div class="examples-list">
          <div
            v-for="(example, index) in examples"
            :key="index"
            class="example-item"
          >
            <div class="example-inputs">
              <Input
                v-model="example.match"
                :placeholder="i18n.matchText || '匹配文本'"
                size="xsmall"
                class="match-input"
              />
              <Input
                v-model="example.notMatch"
                :placeholder="i18n.notMatchText || '不匹配文本（可选）'"
                size="xsmall"
                class="not-match-input"
              />
            </div>
            <Button
              variant="ghost"
              size="xsmall"
              @click="removeExample(index)"
            >
              <IconWrapper
                name="delete"
                :size="14"
              />
            </Button>
          </div>
        </div>
      </div>

      <div class="action-section">
        <Button
          variant="primary"
          size="xsmall"
          :disabled="isGenerating || (!description.trim() && examples.length === 0)"
          :loading="isGenerating"
          @click="handleGenerate"
        >
          <IconWrapper
            name="sparkles"
            :size="16"
          />
          {{ isGenerating ? (i18n.generating || '生成中...') : (i18n.generateRegex || '生成正则') }}
        </Button>
        <Button
          variant="ghost"
          size="xsmall"
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
            {{ i18n.regexResult || '生成结果' }}
          </span>
        </div>

        <div class="result-content">
          <div class="regex-display">
            <code class="regex-pattern">/{{ result.regex }}/</code>
            <Button
              variant="ghost"
              size="xsmall"
              @click="copyRegex"
            >
              <IconWrapper
                name="contentCopy"
                :size="14"
              />
            </Button>
          </div>

          <div
            v-if="result.explanation"
            class="explanation-section"
          >
            <h4 class="section-title">
              {{ i18n.regexExplanation || '正则解释' }}
            </h4>
            <div class="explanation-text">
              {{ result.explanation }}
            </div>
          </div>

          <div
            v-if="result.examples.length > 0"
            class="examples-result-section"
          >
            <h4 class="section-title">
              {{ i18n.matchExamples || '匹配示例' }}
            </h4>
            <div class="examples-result-list">
              <div
                v-for="(example, index) in result.examples"
                :key="index"
                class="example-result-item"
              >
                {{ example }}
              </div>
            </div>
          </div>
        </div>

        <!-- 测试区域 -->
        <div class="test-section">
          <h4 class="section-title">
            {{ i18n.testRegex || '测试正则' }}
          </h4>
          <div class="test-input-area">
            <Input
              v-model="testString"
              :placeholder="i18n.testStringPlaceholder || '输入测试文本...'"
              size="xsmall"
            />
            <Button
              variant="secondary"
              size="xsmall"
              @click="handleTest"
            >
              {{ i18n.test || '测试' }}
            </Button>
          </div>
          <div
            v-if="testResult"
            class="test-result"
          >
            <div
              v-if="testResult.isValid && testResult.matches.length > 0"
              class="matches-info"
            >
              <span class="match-count">{{ i18n.found || '找到' }} {{ testResult.matches.length }} {{ i18n.matches || '个匹配' }}</span>
              <div class="matches-list">
                <span
                  v-for="(match, i) in testResult.matches"
                  :key="i"
                  class="match-item"
                >{{ match }}</span>
              </div>
            </div>
            <div
              v-else-if="testResult.isValid && testResult.matches.length === 0"
              class="no-match"
            >
              {{ i18n.noMatchFound || '未找到匹配' }}
            </div>
            <div
              v-else
              class="error-info"
            >
              <IconWrapper
                name="error"
                :size="14"
              />
              {{ testResult.error }}
            </div>
          </div>
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
  RegexExample,
  RegexResult,
} from "../utils/codeUtils"
import { ref } from "vue"
import Button from "@/components/Button.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Input from "@/components/Input.vue"
import { useCodeFeature } from "../composables/useCodeFeature"
import { generateRegex, testRegex } from "../utils/codeUtils"
import type { WordQueryComponentProps } from "../types"

const props = defineProps<WordQueryComponentProps>()

const description = ref("")
const examples = ref<RegexExample[]>([{
  match: "",
  notMatch: "",
}])
const result = ref<RegexResult | null>(null)
const testString = ref("")
const testResult = ref<{
  matches: string[]
  isValid: boolean
  error?: string
} | null>(null)
const isGenerating = ref(false)

const {
  errorMessage,
  clearErrorOnInput,
  getApiConfig,
  copyText,
} = useCodeFeature(props.plugin)
clearErrorOnInput(description)

function addExample() {
  examples.value.push({
    match: "",
    notMatch: "",
  })
}

function removeExample(index: number) {
  if (examples.value.length > 1) {
    examples.value.splice(index, 1)
  }
}

async function handleGenerate() {
  const validExamples = examples.value.filter((e) => e.match.trim())
  if (!description.value.trim() && validExamples.length === 0) {
    errorMessage.value =
      props.i18n.enterDescOrExample || "请输入描述或提供匹配示例"
    return
  }

  isGenerating.value = true
  errorMessage.value = ""

  try {
    const config = getApiConfig()
    const res = await generateRegex(
      description.value.trim(),
      validExamples,
      config,
    )
    result.value = res
    testResult.value = null
  } catch (error) {
    console.error("生成正则失败:", error)
    errorMessage.value =
      (error as Error).message
      || props.i18n.generateFailed
      || "生成失败，请重试"
  } finally {
    isGenerating.value = false
  }
}

function handleTest() {
  if (!result.value?.regex || !testString.value.trim()) return

  testResult.value = testRegex(result.value.regex, testString.value)
}

function handleClear() {
  description.value = ""
  examples.value = [{
    match: "",
    notMatch: "",
  }]
  result.value = null
  testString.value = ""
  testResult.value = null
  errorMessage.value = ""
}

function copyRegex() {
  if (result.value) {
    copyText(result.value.regex)
  }
}
</script>

<style scoped lang="scss">
@use "../styles/codeUtils.scss";
</style>
