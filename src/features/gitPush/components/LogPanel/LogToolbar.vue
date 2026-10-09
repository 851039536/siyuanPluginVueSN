<!-- gitPush 操作日志顶部工具条（项目搜索 + 条数 + 类型筛选 + 仅失败 + 清空） -->
<template>
  <Toolbar
    class="gp-log-toolbar"
    variant="borderless"
    :padded="false"
    size="xsmall"
    :aria-label="i18n.logView"
  >
    <template #start>
      <!-- 项目搜索框（走既有 SearchBox：共享 Input + 前缀图标 + 可清除） -->
      <div class="gp-log-search">
        <SearchBox
          v-model="searchQuery"
          :placeholder="i18n.logSearchPlaceholder"
        />
      </div>
      <!-- 当前筛选结果条数："{0} 条记录" -->
      <span class="gp-log-count">{{ i18n.logCount.replace("{0}", String(filteredCount)) }}</span>
    </template>
    <template #end>
      <!-- 操作类型筛选（一组互斥选项 → 共享 Button 分组 + aria-pressed，与全站分段切换同构） -->
      <div class="gp-log-filters">
        <Button
          v-for="f in filters"
          :key="f.key"
          variant="ghost"
          size="xsmall"
          dense
          :outlined="activeFilter === f.key"
          :severity="activeFilter === f.key ? 'primary' : undefined"
          :aria-pressed="activeFilter === f.key"
          @click="activeFilter = f.key"
        >{{ f.label }}</Button>
        <!-- 仅失败快捷筛选（active 红色高亮） -->
        <Button
          variant="ghost"
          size="xsmall"
          dense
          icon="alertCircleOutline"
          :outlined="failOnly"
          :severity="failOnly ? 'danger' : undefined"
          :aria-pressed="failOnly"
          :title="i18n.logFailOnlyTip"
          @click="failOnly = !failOnly"
        >{{ i18n.logFailOnly }}</Button>
      </div>
      <!-- 清空按钮（二次确认由入口 index.vue 的 confirmClearOpLogs 提供） -->
      <Button
        variant="ghost"
        size="xsmall"
        icon="deleteOutline"
        :title="i18n.clearLogs"
        :aria-label="i18n.clearLogs"
        @click="emit('clear')"
      />
    </template>
  </Toolbar>
</template>

<script setup lang="ts">
// gitPush 操作日志顶部工具条（项目搜索 + 条数 + 类型筛选 + 仅失败 + 清空）。
// 全部控件改走共享组件：原实现为手写 <input>/<button>（违反「必须使用共享组件」规范，
// 且筛选按钮缺 aria-pressed 导致选中态对读屏不可见）。
import { computed } from "vue"
import Button from "@/components/Button.vue"
import Toolbar from "@/components/Toolbar.vue"
import SearchBox from "../common/SearchBox.vue"

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
