<!-- gitPush diff 共享渲染片段：图例 + 着色行（行号双列 / 符号列 / 词级高亮），供工作区与提交内 diff 弹窗复用 -->
<template>
  <!-- 图例："+ 新增 / − 删除 / ⋯ 未变" -->
  <div class="wt-diff-legend">
    <span class="wt-legend-add">+ {{ i18n.legendAdd }}</span>
    <span class="wt-legend-del">− {{ i18n.legendDel }}</span>
    <span class="wt-legend-ctx">⋯ {{ i18n.legendCtx }}</span>
  </div>

  <!-- diff 内容区（空态 / 着色行） -->
  <div class="wt-diff-content">
    <div
      v-if="!lines.length"
      class="wt-diff-empty"
    >
      {{ i18n.diffEmpty }}
    </div>
    <div
      v-for="(line, i) in lines"
      :key="i"
      class="wt-diff-line"
      :class="`wt-dl-${line.type}`"
    >
      <!-- 旧/新文件行号双列（hunk/meta 行无行号，留空保持对齐） -->
      <span class="wt-dl-no">{{ line.oldNo ?? "" }}</span>
      <span class="wt-dl-no">{{ line.newNo ?? "" }}</span>
      <span class="wt-dl-sign">{{ DIFF_SIGN[line.type] }}</span>
      <span class="wt-dl-text">
        <!-- 词级差异：配对成功的行按分段渲染，变化片段加深底色 -->
        <template v-if="line.segments">
          <span
            v-for="(seg, j) in line.segments"
            :key="j"
            :class="{ 'wt-dl-seg-changed': seg.changed }"
          >{{ seg.text }}</span>
        </template>
        <template v-else>{{ line.text }}</template>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush diff 共享渲染片段（纯展示：图例 + 着色行，宿主负责 header 与容器布局）
import type { DiffLine } from "../../utils"
import { DIFF_SIGN } from "../../utils"

defineProps<{
  i18n: Record<string, any>
  /** 已解析的 diff 行数组（由宿主经 parseDiffLines 产出） */
  lines: DiffLine[]
}>()
</script>

<style lang="scss">
@use "../../styles/WorkingTreeDiffDialog.scss";
</style>
