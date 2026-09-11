<!-- gitPush 行数统计顶部工具条（分析状态 + 过滤配置 + 条数选择 + 分析按钮） -->
<template>
  <!-- 顶部工具条：状态文案（start）+ 过滤/条数/分析（end），三段布局与 role="toolbar" 由共享 Toolbar 承载 -->
  <Toolbar
    class="gls-toolbar"
    variant="borderless"
    :padded="false"
    size="xsmall"
    :aria-label="i18n.lineStatsView"
  >
    <!-- 分析状态："分析中…/上次分析 xx/未分析" -->
    <template #start>
      <span class="gls-status">{{ statusText }}</span>
    </template>
    <template #end>
      <!-- 文件格式过滤配置按钮（已选数量走共享 Badge 角标；有生效过滤时描边转主题色） -->
      <Badge
        :content="selectedExtensions.length"
        :hidden="selectedExtensions.length === 0"
        variant="primary"
        size="xsmall"
      >
        <Button
          icon="filterVariant"
          size="xsmall"
          variant="ghost"
          :outlined="true"
          :severity="selectedExtensions.length > 0 ? 'primary' : undefined"
          :disabled="analyzing"
          :title="i18n.lineStatsExtFilter"
          @click="emit('openExtDialog')"
        />
      </Badge>
      <!-- 条数选择（公共组件：数字直显，"all" 显示「全部」） -->
      <CommitCountSelect
        :i18n="i18n"
        :commit-count="commitCount"
        @update-count="emit('updateCount', $event)"
      />
      <!-- 按钮文案："开始行数分析"/"重新分析"；分析中由组件 loading 态保宽（图标与文案隐占位） -->
      <Button
        variant="ghost"
        :outlined="true"
        size="xsmall"
        :icon="analyzing ? 'loading' : 'codeTags'"
        :loading="analyzing"
        @click="emit('runAnalysis')"
      >
        {{ analyzed ? i18n.auditRerun : i18n.lineStatsRun }}
      </Button>
    </template>
  </Toolbar>
</template>

<script setup lang="ts">
// gitPush 行数统计顶部工具条（分析状态 + 过滤配置 + 条数选择 + 分析按钮）
import type { CommitCount } from "../../composables/useCommitAnalysis"
import { computed } from "vue"
import Badge from "@/components/Badge.vue"
import Button from "@/components/Button.vue"
import Toolbar from "@/components/Toolbar.vue"
import CommitCountSelect from "../common/CommitCountSelect.vue"
import { analysisStatusText } from "../../utils"

const props = defineProps<{
  i18n: Record<string, any>
  analyzing: boolean
  analyzed: boolean
  /** 上次分析完成时间（ISO） */
  analyzedAt: string
  commitCount: CommitCount
  /** 选中的文件扩展名过滤（空数组 = 不过滤） */
  selectedExtensions: string[]
}>()

const emit = defineEmits<{
  runAnalysis: []
  updateCount: [n: CommitCount]
  openExtDialog: []
}>()

/** 分析状态文案（与提交分析/规则检查工具条共用统一逻辑；相对时间不可用时兜底「刚刚」） */
const statusText = computed(() => analysisStatusText({
  analyzing: props.analyzing,
  analyzed: props.analyzed,
  analyzedAt: props.analyzedAt,
  i18n: props.i18n,
  notRunKey: "lineStatsNotRun",
  fallbackKey: "timeJustNow",
}))
</script>

<style lang="scss">
@use "../../styles/LineStatsPanel.scss";
@use "../../styles/index.scss";
</style>
