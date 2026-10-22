<!-- AI 设置 - 「联网搜索」Tab：DeepSeek 搜索引擎说明 + 测试搜索 -->
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
    const results = await searchWeb("今天是几号 最新新闻", {
      searchProvider: "deepseek",
      deepseekApiKey: props.deepseekApiKey || "",
    })

    if (results.length > 0) {
      searchTestResult.value = `搜索成功！获取到 ${results.length} 条结果，首条：${results[0].title} - ${results[0].content.slice(0, 80)}...`
      showMessage("联网搜索测试成功", 2000, "info")
    } else {
      searchTestError.value = true
      searchTestResult.value = props.i18n.searchNoResults
    }
  } catch (error) {
    searchTestError.value = true
    searchTestResult.value = `搜索失败: ${(error as Error).message}`
  } finally {
    isTestingSearch.value = false
  }
}
</script>

<style lang="scss" scoped>
@use "../styles/AiSearchSettings.scss";
</style>
