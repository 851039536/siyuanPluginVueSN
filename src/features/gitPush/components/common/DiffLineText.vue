<!-- gitPush diff 单行文本：词级分段着色 + hunk 作用域弱化展示（统一/并排视图共用） -->
<template>
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
    <!-- hunk 头尾部的所属作用域（函数 / 类名）：git 按语言规则带出，弱化展示以区分行区间与位置 -->
    <span
      v-if="line.type === 'hunk' && line.scope"
      class="wt-dl-scope"
      :title="line.scope"
    >{{ line.scope }}</span>
  </span>
</template>

<script setup lang="ts">
import type { DiffLine } from "../../utils"

defineProps<{
  /** 单行数据（词级分段由 parseDiffLines 预先生成） */
  line: DiffLine
}>()
</script>
