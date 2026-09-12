<!-- gitPush 行数统计文件格式过滤配置弹窗：扩展名多选排除列表，应用后下次分析跳过排除格式的文件 -->
<template>
  <Transition name="gp-dialog-fade">
    <!-- 遮罩/层级/基准字号取自共享基座 .gp-mask，本地仅保留弹窗尺寸与进出场缩放 -->
    <div
      ref="rootRef"
      tabindex="-1"
      class="gp-mask"
      @keydown.escape="emit('close')"
      @click.self="emit('close')"
    >
      <div class="gfe-dialog">
        <!-- 弹窗标题："文件格式过滤" -->
        <div class="gfe-header">
          <span class="gfe-title">{{ i18n.lineStatsExtFilterTitle }}</span>
          <Button
            icon="close"
            size="xsmall"
            variant="ghost"
            :text="true"
            :title="i18n.close"
            @click="emit('close')"
          />
        </div>
        <!-- 说明文字："勾选要排除的文件格式，统计时将跳过这些格式的文件" -->
        <div class="gfe-hint">{{ i18n.lineStatsExtFilterHint }}</div>
        <!-- 操作区：已排除计数 + 全选/清空 -->
        <div class="gfe-actions">
          <span class="gfe-count">{{ i18n.lineStatsExtSelectedCount.replace("{0}", String(draft.length)) }}</span>
          <Button
            variant="primary"
            :outlined="true"
            size="xsmall"
            @click="selectAll"
          >{{ i18n.lineStatsExtSelectAll }}</Button>
          <Button
            variant="primary"
            :outlined="true"
            size="xsmall"
            @click="clearAll"
          >{{ i18n.lineStatsExtClearAll }}</Button>
        </div>
        <!-- 扩展名多选网格（共享 Checkbox 数组模式：v-model 为选中数组） -->
        <div class="gfe-grid">
          <Checkbox
            v-for="ext in LINE_STATS_EXTENSIONS"
            :key="ext"
            v-model="draft"
            :value="ext"
            size="xsmall"
          >
            <span class="gfe-ext-name">{{ ext }}</span>
          </Checkbox>
        </div>
        <!-- 底部操作栏：取消 / 应用 -->
        <div class="gfe-footer">
          <Button
            variant="ghost"
            :outlined="true"
            size="small"
            @click="emit('close')"
          >{{ i18n.cancel }}</Button>
          <Button
            variant="primary"
            size="small"
            @click="apply"
          >{{ i18n.lineStatsExtApply }}</Button>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
// gitPush 行数统计文件格式过滤配置弹窗（扩展名多选排除列表）
import { ref } from "vue"
import Button from "@/components/Button.vue"
import Checkbox from "@/components/Checkbox.vue"
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

// ⚠️ `rootRef` 必须保留为本地绑定：模板 `ref="rootRef"` 依赖它把根节点交给 composable 聚焦。
// TS 看不到「模板里的使用」，故以 void 显式消费，避免 noUnusedLocals 误判（下同各弹窗）。
const { rootRef } = useDialogKeyboard()
void rootRef
</script>

<style lang="scss">
@use "../../styles/ExtFilterDialog.scss";
@use "../../styles/index.scss";
</style>
