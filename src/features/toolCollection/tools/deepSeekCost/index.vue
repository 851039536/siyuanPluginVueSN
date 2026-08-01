<!-- DeepSeek 成本工具主面板 — Tab 切换：成本换算 / 余额查询 -->
<template>
  <div class="deepseek-cost">
    <!-- Tab 切换栏 -->
    <div class="dc-tabs">
      <!-- Tab："成本换算" -->
      <button
        class="dc-tab"
        :class="{ active: currentTab === 'calc' }"
        @click="currentTab = 'calc'"
      >
        {{ i18n.calcTab }}
      </button>
      <!-- Tab："余额查询" -->
      <button
        class="dc-tab"
        :class="{ active: currentTab === 'balance' }"
        @click="currentTab = 'balance'"
      >
        {{ i18n.balanceTab }}
      </button>
    </div>

    <!-- 内容区 -->
    <div class="dc-content">
      <!-- 成本换算子面板 -->
      <CostCalculator
        v-if="currentTab === 'calc'"
        :i18n="i18n"
      />
      <!-- 余额查询子面板 -->
      <BalanceQuery
        v-else
        :plugin="props.plugin"
        :i18n="i18n"
      />
    </div>

    <!-- 底部官网链接栏 -->
    <div class="dc-footer">
      <!-- 标签："官方链接" -->
      <span class="dc-footer-label">{{ i18n.officialLinks }}</span>
      <!-- 链接："价格参考 / API 文档 / 控制台" -->
      <a
        v-for="link in OFFICIAL_LINKS"
        :key="link.href"
        class="dc-link"
        :href="link.href"
        target="_blank"
        rel="noreferrer"
      >
        {{ i18n[link.labelKey] }}
      </a>
    </div>
  </div>
</template>

<script setup lang="ts">
// DeepSeek 成本工具主容器：Tab 切换成本换算与余额查询两个子面板
import type { Plugin } from "siyuan"
import { ref } from "vue"
import BalanceQuery from "./components/BalanceQuery.vue"
import CostCalculator from "./components/CostCalculator.vue"

interface Props {
  plugin: Plugin
  i18n: Record<string, any> & { deepSeekCost?: Record<string, string> }
}

const props = defineProps<Props>()

const currentTab = ref<"calc" | "balance">("calc")

// 解出本工具文案对象（缺失时为空对象兜底，避免模板崩溃）
const i18n = props.i18n.deepSeekCost ?? ({} as Record<string, string>)

// 官网链接常量（href + 对应 i18n 文案键）
const OFFICIAL_LINKS = [
  {
    href: "https://api-docs.deepseek.com/zh-cn/quick_start/pricing",
    labelKey: "linkPricing",
  },
  {
    href: "https://api-docs.deepseek.com/zh-cn/api/",
    labelKey: "linkDocs",
  },
  {
    href: "https://platform.deepseek.com/",
    labelKey: "linkConsole",
  },
]
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
