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
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
