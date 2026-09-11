<!-- gitPush 项目抓取失败明细弹窗：逐条列出失败项目名 / 本次使用路径 / 原因分类 / 原始报错 -->
<template>
  <Dialog
    :visible="true"
    size="large"
    :header="i18n.lineStatsFailuresTitle"
    :close-label="i18n.close"
    :dismissable-mask="true"
    @update:visible="emit('close')"
  >
    <!-- 说明：本次未纳入统计的项目数（修正路径/环境后重新分析即可纳入） -->
    <div class="gff-hint">{{ i18n.lineStatsFailuresHint.replace("{0}", String(failures.length)) }}</div>
    <div class="gff-list">
      <div
        v-for="item in failures"
        :key="item.projectId"
        class="gff-item"
      >
        <div class="gff-item-head">
          <span class="gff-name">{{ item.projectName }}</span>
          <!-- 原因分类短标签（可读性优先，完整报错见下方原始文本） -->
          <span class="gff-kind">{{ kindLabel(item.kind) }}</span>
        </div>
        <!-- 本次实际使用的本地路径：失败即发生在此路径上 -->
        <div class="gff-path">
          <span class="gff-path-label">{{ i18n.lineStatsFailurePath }}</span>
          <span
            class="gff-path-value"
            :title="item.path"
          >{{ item.path }}</span>
        </div>
        <!-- 原始报错：保留 git stderr 全文，便于直接定位；长文本限高滚动 -->
        <pre class="gff-reason">{{ item.reason }}</pre>
      </div>
    </div>
    <template #footer>
      <Button
        variant="ghost"
        :outlined="true"
        size="small"
        @click="emit('close')"
      >{{ i18n.close }}</Button>
    </template>
  </Dialog>
</template>

<script setup lang="ts">
// gitPush 项目抓取失败明细弹窗（失败项目名 + 本地路径 + 原因分类 + 原始报错）
import type { FetchFailureKind, ProjectFetchFailure } from "../../types"
import { FETCH_FAILURE_KIND_KEYS } from "../../types"
import Button from "@/components/Button.vue"
import Dialog from "@/components/Dialog.vue"

const props = defineProps<{
  i18n: Record<string, any>
  /** 失败项目明细（父以 v-if 挂载，空数组时不打开） */
  failures: ProjectFetchFailure[]
}>()

const emit = defineEmits<{
  close: []
}>()

/** 原因分类 → i18n 标签文案（缺键时回退分类名本身，避免弹窗出现空白标签） */
function kindLabel(kind: FetchFailureKind): string {
  return props.i18n[FETCH_FAILURE_KIND_KEYS[kind]] ?? kind
}
</script>

<style lang="scss">
@use "../../styles/FetchFailuresDialog.scss";
</style>
