<!-- gitPush 行数统计文件格式过滤配置弹窗：扩展名多选排除列表，应用后下次分析跳过排除格式的文件 -->
<template>
  <Transition name="gp-dialog-fade">
    <div
      ref="rootRef"
      tabindex="-1"
      class="gfe-mask"
      @keydown.escape="emit('close')"
      @click.self="emit('close')"
    >
      <div class="gfe-dialog">
        <!-- 弹窗标题："文件格式过滤" -->
        <div class="gfe-header">
          <span class="gfe-title">{{ i18n.lineStatsExtFilterTitle }}</span>
          <button
            class="gfe-close"
            :title="i18n.close"
            @click="emit('close')"
          >
            <Icon icon="mdi:close" />
          </button>
        </div>
        <!-- 说明文字："勾选要排除的文件格式，统计时将跳过这些格式的文件" -->
        <div class="gfe-hint">{{ i18n.lineStatsExtFilterHint }}</div>
        <!-- 操作区：已选计数 + 全选/清空 -->
        <div class="gfe-actions">
          <span class="gfe-count">{{ i18n.lineStatsExtSelectedCount.replace("{0}", String(draft.length)) }}</span>
          <button
            class="gfe-act-btn"
            @click="selectAll"
          >{{ i18n.lineStatsExtSelectAll }}</button>
          <button
            class="gfe-act-btn"
            @click="clearAll"
          >{{ i18n.lineStatsExtClearAll }}</button>
        </div>
        <!-- 扩展名多选网格 -->
        <div class="gfe-grid">
          <button
            v-for="ext in LINE_STATS_EXTENSIONS"
            :key="ext"
            class="gfe-chip"
            :class="{ 'gfe-chip--active': draft.includes(ext) }"
            @click="toggle(ext)"
          >{{ ext }}</button>
        </div>
        <!-- 底部操作栏：取消 / 应用 -->
        <div class="gfe-footer">
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm"
            @click="emit('close')"
          >{{ i18n.cancel }}</button>
          <button
            class="vp-btn vp-btn--primary vp-btn--sm"
            @click="apply"
          >{{ i18n.lineStatsExtApply }}</button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { Icon } from "@iconify/vue"
import { ref } from "vue"
import { LINE_STATS_EXTENSIONS } from "../../composables/useCommitAnalysis"
import { useDialogKeyboard } from "../../composables/useDialogKeyboard"

const props = defineProps<{
  i18n: Record<string, any>
  /** 初始选中的扩展名（父以 v-if 挂载，每次打开为新实例） */
  selected: string[]
}>()

const emit = defineEmits<{
  close: []
  apply: [exts: string[]]
}>()

/** 临时选中副本（不直接改父数据，确定时统一 emit） */
const draft = ref<string[]>([...props.selected])

/** 切换单个扩展名选中状态 */
function toggle(ext: string) {
  const set = new Set(draft.value)
  if (set.has(ext)) { set.delete(ext) }
  else { set.add(ext) }
  draft.value = [...set]
}

/** 选中全部预定义扩展名（即排除所有常见格式，仅统计未知格式文件） */
function selectAll() {
  draft.value = [...LINE_STATS_EXTENSIONS]
}

/** 清空所有选择（等价于不过滤所有文件） */
function clearAll() {
  draft.value = []
}

/** 应用过滤：回传选中列表并关闭 */
function apply() {
  emit("apply", [...draft.value])
}

const { rootRef } = useDialogKeyboard()
</script>

<style lang="scss">
@use "../../styles/ExtFilterDialog.scss";
@use "../../styles/index.scss";
</style>
