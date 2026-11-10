<!--
  gitPush diff 视图栏：图例 + 布局三态（统一 / 并排 / 自适应）+ 行号显隐 + 仅改动。
  单文件弹窗由 DiffLines 自带一条；审阅流把它提到弹窗顶部全局共用一条。
-->
<template>
  <div class="wt-diff-bar">
    <div class="wt-diff-legend">
      <span class="wt-legend-add">+ {{ i18n.legendAdd }}</span>
      <span class="wt-legend-del">− {{ i18n.legendDel }}</span>
      <span class="wt-legend-ctx">⋯ {{ i18n.legendCtx }}</span>
    </div>
    <div class="wt-diff-views">
      <!-- 布局三态：自适应按可用宽度在统一/并排之间切换 -->
      <Button
        v-for="opt in LAYOUT_OPTIONS"
        :key="opt.value"
        :variant="layout === opt.value ? 'primary' : 'ghost'"
        text
        size="xsmall"
        :aria-pressed="layout === opt.value"
        :title="i18n.diffLayoutTip"
        @click="layout = opt.value"
      >
        {{ i18n[opt.labelKey] }}
      </Button>
      <Divider
        class="wt-diff-bar-sep"
        layout="vertical"
      />
      <!-- 行号显隐（并排视图下每列只保留本侧行号） -->
      <Button
        variant="ghost"
        text
        size="xsmall"
        :aria-pressed="showLineNumbers"
        :title="i18n.diffLineNumbers"
        @click="showLineNumbers = !showLineNumbers"
      >
        {{ i18n.diffLineNumbers }}
      </Button>
      <!-- 仅改动：隐去未变行与折叠条，只看增删 -->
      <Button
        variant="ghost"
        text
        size="xsmall"
        :aria-pressed="onlyChanges"
        :title="i18n.diffOnlyChanges"
        @click="onlyChanges = !onlyChanges"
      >
        {{ i18n.diffOnlyChanges }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { DiffLayout } from "../../utils"
import Button from "@/components/Button.vue"
import Divider from "@/components/Divider.vue"

defineProps<{
  i18n: Record<string, any>
}>()

/** 视图布局（自适应 = 按可用宽度在统一 / 并排之间切换） */
const layout = defineModel<DiffLayout>("layout", { default: "auto" })
/** 是否显示行号列 */
const showLineNumbers = defineModel<boolean>("showLineNumbers", { default: true })
/** 仅改动：隐去未变行与折叠条 */
const onlyChanges = defineModel<boolean>("onlyChanges", { default: false })

/** 布局三态选项（labelKey 指向 i18n） */
const LAYOUT_OPTIONS: { value: DiffLayout, labelKey: string }[] = [
  {
    value: "unified",
    labelKey: "diffLayoutUnified",
  },
  {
    value: "split",
    labelKey: "diffLayoutSplit",
  },
  {
    value: "auto",
    labelKey: "diffLayoutAuto",
  },
]
</script>
