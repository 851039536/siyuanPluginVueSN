<!-- AI 设置 - 联网搜索区块（并入「模型」Tab 展示）：DeepSeek 搜索引擎说明 + 测试搜索 -->
<template>
  <div class="ai-search-settings">
    <!-- 搜索引擎说明（固定 DeepSeek Search API，复用 DeepSeek 供应商密钥） -->
    <SettingGroup>
      <div class="setting-desc deepseek-hint">
        <!-- 说明文字：使用 DeepSeek 自研搜索引擎，复用 DeepSeek 供应商的 API Key -->
        {{ i18n.searchDeepSeekDesc }}
      </div>
    </SettingGroup>

    <!-- 测试搜索 -->
    <SettingGroup>
      <button
        class="test-search-btn"
        :disabled="isTestingSearch"
        @click="testSearch"
      >
        <!-- 按钮文案："测试联网搜索" / "搜索中..." -->
        {{ isTestingSearch ? i18n.searching : i18n.testSearchButton }}
      </button>
      <div
        v-if="searchTestResult"
        class="setting-desc search-test-result"
        :class="{ error: searchTestError }"
      >
        {{ searchTestResult }}
      </div>
    </SettingGroup>
  </div>
</template>

<script setup lang="ts">
import { showMessage } from "siyuan"
import { ref } from "vue"
import { searchWeb } from "@/utils/webSearch"
import SettingGroup from "./SettingGroup.vue"

interface Props {
  /** DeepSeek 供应商 API Key（联网搜索复用该密钥） */
  deepseekApiKey: string
  i18n: Record<string, any>
}

const props = defineProps<Props>()

const isTestingSearch = ref(false)
const searchTestResult = ref("")
const searchTestError = ref(false)

const testSearch = async () => {
  isTestingSearch.value = true
  searchTestResult.value = ""
  searchTestError.value = false

  try {
    // 测试查询词走 i18n（搜索结果语言随查询语言变化）
    const query = props.i18n.searchTestQuery || "latest news"
    const results = await searchWeb(query, {
      searchProvider: "deepseek",
      deepseekApiKey: props.deepseekApiKey || "",
    })

    if (results.length > 0) {
      const first = `${results[0].title} - ${results[0].content.slice(0, 80)}...`
      const template: string = props.i18n.searchTestSuccess || "搜索成功，获取到 {n} 条结果，首条：{first}"
      // 单次正则替换：翻译值误含占位符字面量也不会被二次展开，未知占位符原样保留
      const params: Record<string, string> = {
        n: String(results.length),
        first,
      }
      searchTestResult.value = template.replace(/\{(\w+)\}/g, (match, key: string) => params[key] ?? match)
      showMessage(props.i18n.searchTestSuccessToast || "联网搜索测试成功", 2000, "info")
    } else {
      searchTestError.value = true
      searchTestResult.value = props.i18n.searchNoResults
    }
  } catch (error) {
    searchTestError.value = true
    searchTestResult.value = `${props.i18n.searchTestFailed || "搜索失败"}: ${(error as Error).message}`
  } finally {
    isTestingSearch.value = false
  }
}
</script>

<style lang="scss" scoped>
@use "../styles/AiSearchSettings.scss";
</style>
