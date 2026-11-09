<!-- gitPush 设置弹窗「推送与链接」分组：推送分支模式 + PR 基线分支 -->
<template>
  <section class="gp-set-section">
    <!-- 分组标题："推送与链接" -->
    <div class="gp-set-section-title">{{ i18n.settingsGroupPushLink }}</div>
    <!-- 推送分支模式（radio 切换即时保存） -->
    <div class="gp-set-row">
      <!-- 设置项标签："推送分支模式"（tooltip："仅当前分支模式更快，避免推送无变更的其他分支"） -->
      <label
        class="gp-set-label"
        :title="i18n.pushBranchHint"
      >{{ i18n.pushBranchModeLabel }}</label>
      <!-- 分支模式单选组（同组共用 name，方向键与 ARIA 语义方生效） -->
      <div class="gp-set-radio-group">
        <RadioButton
          class="gp-set-radio"
          name="gp-push-branch-mode"
          :model-value="pushBranchMode"
          value="all"
          size="xsmall"
          :label="i18n.pushBranchAllOpt"
          @update:model-value="onBranchModeChange"
        />
        <RadioButton
          class="gp-set-radio"
          name="gp-push-branch-mode"
          :model-value="pushBranchMode"
          value="head"
          size="xsmall"
          :label="i18n.pushBranchHeadOpt"
          @update:model-value="onBranchModeChange"
        />
      </div>
    </div>
    <!-- Compare 基线分支（失焦/回车即时保存） -->
    <div class="gp-set-row">
      <!-- 设置项标签："PR 基线分支"（tooltip："Compare 深链使用的基线分支，默认 main"） -->
      <label
        class="gp-set-label"
        :title="i18n.compareBaseHint"
      >{{ i18n.compareBaseLabel }}</label>
      <Input
        :model-value="compareDraft"
        size="xsmall"
        class="gp-set-text-input"
        :placeholder="i18n.compareBasePlaceholder"
        @update:model-value="compareDraft = String($event ?? '')"
        @blur="commitCompare"
        @keydown.enter="commitCompare"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
// 推送与链接分组：分支模式即时保存，基线分支失焦/回车提交（空值回退 main）
import { ref, watch } from "vue"
import Input from "@/components/Input.vue"
import RadioButton from "@/components/RadioButton.vue"

const props = defineProps<{
  i18n: Record<string, any>
  pushBranchMode: "all" | "head"
  compareBaseBranch: string
}>()

const emit = defineEmits<{
  saveBranchMode: [mode: "all" | "head"]
  saveCompareBase: [value: string]
}>()

/** Compare 基线本地草稿（父级值变化时同步，如首次异步加载完成） */
const compareDraft = ref(props.compareBaseBranch || "main")

watch(() => props.compareBaseBranch, (v) => {
  compareDraft.value = v || "main"
})

/** Select/RadioButton 载荷收窄为分支模式：非枚举值回退 "head"（与默认行为一致） */
function onBranchModeChange(value: unknown) {
  emit("saveBranchMode", value === "all" ? "all" : "head")
}

/** 提交基线分支：空值回退 main，避免生成坏链接；值未变不写存储 */
function commitCompare() {
  const next = compareDraft.value.trim() || "main"
  compareDraft.value = next
  if (next !== (props.compareBaseBranch || "main")) emit("saveCompareBase", next)
}
</script>
