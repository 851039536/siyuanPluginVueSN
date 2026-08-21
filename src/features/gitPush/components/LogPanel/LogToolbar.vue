<!-- gitPush 操作日志顶部工具条（项目搜索 + 条数 + 类型筛选 + 仅失败 + 清空） -->
<template>
  <div class="gp-log-toolbar">
    <!-- 项目搜索框："搜索项目..." -->
    <div class="gp-log-search">
      <Icon
        icon="mdi:magnify"
        height="12"
      />
      <input
        v-model="searchQuery"
        type="text"
        :placeholder="i18n.logSearchPlaceholder"
      />
    </div>
    <!-- 当前筛选结果条数："{0} 条记录" -->
    <span class="gp-log-count">{{ i18n.logCount.replace("{0}", filteredCount) }}</span>
    <!-- 操作类型筛选 -->
    <div class="gp-log-filters">
      <button
        v-for="f in filters"
        :key="f.key"
        class="gp-log-filter-btn"
        :class="{ active: activeFilter === f.key }"
        @click="activeFilter = f.key"
      >
        {{ f.label }}
      </button>
      <!-- 仅失败快捷筛选（active 红色高亮） -->
      <button
        class="gp-log-filter-btn gp-log-filter-btn--fail"
        :class="{ active: failOnly }"
        :title="i18n.logFailOnlyTip"
        @click="failOnly = !failOnly"
      >
        <Icon
          icon="mdi:alert-circle-outline"
          height="12"
        />
        {{ i18n.logFailOnly }}
      </button>
    </div>
    <!-- 清空按钮 -->
    <button
      class="gp-log-clear-btn"
      :title="i18n.clearLogs"
      @click="emit('clear')"
    >
      <Icon
        icon="mdi:delete-outline"
        height="12"
      />
    </button>
  </div>
</template>

<script setup lang="ts">
// gitPush 操作日志顶部工具条（项目搜索 + 条数 + 类型筛选 + 仅失败 + 清空）
import { Icon } from "@iconify/vue"
import { computed } from "vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 当前筛选结果条数（入口 index.vue computed 传入） */
  filteredCount: number
}>()

const emit = defineEmits<{
  clear: []
}>()

const searchQuery = defineModel<string>("searchQuery", { required: true })
const activeFilter = defineModel<string>("activeFilter", { required: true })
const failOnly = defineModel<boolean>("failOnly", { required: true })

/** 操作类型筛选配置（全部/推送/拉取/提交） */
const filters = computed(() => [
  { key: "all", label: props.i18n.logFilterAll },
  { key: "push", label: props.i18n.opPush },
  { key: "pull", label: props.i18n.opPull },
  { key: "commit", label: props.i18n.opCommit },
])
</script>

<style lang="scss">
@use "../../styles/LogPanel.scss";
@use "../../styles/index.scss";
</style>
