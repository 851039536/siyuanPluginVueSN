<!-- gitPush 设置弹窗「提交规则检查」分组：最短字数 + 4 条可选规则 + AI diff 预算（即时保存） -->
<template>
  <section class="gp-set-section">
    <!-- 分组标题："提交规则检查" -->
    <div class="gp-set-section-title">{{ i18n.settingsGroupRuleCheck }}</div>
    <!-- 描述最短字数 -->
    <div class="gp-set-row">
      <!-- 设置项标签："描述最短字数"（tooltip：少于该字数判为描述过短） -->
      <label
        class="gp-set-label"
        :title="i18n.ruleCheckMinSubjectLengthHint"
      >{{ i18n.ruleCheckMinSubjectLength }}</label>
      <Input
        :model-value="minSubjectDraft"
        type="number"
        size="xsmall"
        class="gp-set-number-input"
        :placeholder="minSubjectRange"
        @update:model-value="onMinSubjectInput"
        @blur="commitMinSubject"
        @keydown.enter="commitMinSubject"
      />
    </div>
    <!-- 可选规则：描述首字母大写 -->
    <div class="gp-set-row">
      <!-- 设置项标签："描述首字母大写"（tooltip：小写英文字母开头判违规） -->
      <label
        class="gp-set-label"
        :title="i18n.ruleCheckOptCapitalizedHint"
      >{{ i18n.ruleCheckOptCapitalized }}</label>
      <Checkbox
        size="xsmall"
        binary
        :model-value="ruleConfig.requireCapitalizedSubject"
        :aria-label="i18n.ruleCheckOptCapitalized"
        @update:model-value="onRuleToggle('requireCapitalizedSubject', $event)"
      />
    </div>
    <!-- 可选规则：WIP 临时提交检测 -->
    <div class="gp-set-row">
      <!-- 设置项标签："WIP 临时提交检测"（tooltip：wip/todo/fixme/tbd 开头判违规） -->
      <label
        class="gp-set-label"
        :title="i18n.ruleCheckOptWipHint"
      >{{ i18n.ruleCheckOptWip }}</label>
      <Checkbox
        size="xsmall"
        binary
        :model-value="ruleConfig.detectWipSubject"
        :aria-label="i18n.ruleCheckOptWip"
        @update:model-value="onRuleToggle('detectWipSubject', $event)"
      />
    </div>
    <!-- 可选规则：scope 格式校验 -->
    <div class="gp-set-row">
      <!-- 设置项标签："scope 格式校验"（tooltip：仅允许小写字母/数字/连字符） -->
      <label
        class="gp-set-label"
        :title="i18n.ruleCheckOptScopeFormatHint"
      >{{ i18n.ruleCheckOptScopeFormat }}</label>
      <Checkbox
        size="xsmall"
        binary
        :model-value="ruleConfig.scopeFormatEnabled"
        :aria-label="i18n.ruleCheckOptScopeFormat"
        @update:model-value="onRuleToggle('scopeFormatEnabled', $event)"
      />
    </div>
    <!-- 可选规则：正文行长限制（勾选即时保存 + 行长阈值草稿提交） -->
    <div class="gp-set-row">
      <!-- 设置项标签："正文行长限制"（tooltip：正文每行超限判违规） -->
      <label
        class="gp-set-label"
        :title="i18n.ruleCheckOptBodyLineLimitHint"
      >{{ i18n.ruleCheckOptBodyLineLimit }}</label>
      <div class="gp-set-input-row">
        <Checkbox
          size="xsmall"
          binary
          :model-value="ruleConfig.bodyLineLimitEnabled"
          :aria-label="i18n.ruleCheckOptBodyLineLimit"
          @update:model-value="onRuleToggle('bodyLineLimitEnabled', $event)"
        />
        <Input
          :model-value="bodyLineDraft"
          type="number"
          size="xsmall"
          class="gp-set-number-input"
          :placeholder="bodyLineRange"
          :disabled="!ruleConfig.bodyLineLimitEnabled"
          @update:model-value="onBodyLineInput"
          @blur="commitBodyLine"
          @keydown.enter="commitBodyLine"
        />
      </div>
    </div>
    <!-- AI diff 上下文预算 -->
    <div class="gp-set-row">
      <!-- 设置项标签："Diff 上下文预算"（tooltip：AI 生成提交信息时送入的字符上限） -->
      <label
        class="gp-set-label"
        :title="i18n.ruleCheckDiffBudgetHint"
      >{{ i18n.ruleCheckDiffBudget }}</label>
      <Input
        :model-value="diffBudgetDraft"
        type="number"
        size="xsmall"
        class="gp-set-number-input"
        :placeholder="diffBudgetRange"
        @update:model-value="onDiffBudgetInput"
        @blur="commitDiffBudget"
        @keydown.enter="commitDiffBudget"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
// 提交规则分组：阈值走草稿态提交，可选规则勾选即时保存（父级实时重算违规）
import type { CommitRuleConfig } from "../../../types"
import Checkbox from "@/components/Checkbox.vue"
import Input from "@/components/Input.vue"
import { useNumberDraft } from "../../../composables/useNumberDraft"
import {
  BODY_LINE_LENGTH_MAX,
  BODY_LINE_LENGTH_MIN,
  clampDiffContextBudget,
  clampMaxBodyLineLength,
  clampMinSubjectLength,
  DIFF_CONTEXT_BUDGET_MAX,
  DIFF_CONTEXT_BUDGET_MIN,
  MIN_SUBJECT_LENGTH_MAX,
  MIN_SUBJECT_LENGTH_MIN,
} from "../../../types"

const props = defineProps<{
  i18n: Record<string, any>
  ruleConfig: CommitRuleConfig
}>()

const emit = defineEmits<{
  saveRuleConfig: [patch: Partial<CommitRuleConfig>]
}>()

/** 范围占位符由常量拼出，与钳位边界保持单一数据源 */
const minSubjectRange = `${MIN_SUBJECT_LENGTH_MIN}~${MIN_SUBJECT_LENGTH_MAX}`
const bodyLineRange = `${BODY_LINE_LENGTH_MIN}~${BODY_LINE_LENGTH_MAX}`
const diffBudgetRange = `${DIFF_CONTEXT_BUDGET_MIN}~${DIFF_CONTEXT_BUDGET_MAX}`

const {
  draft: minSubjectDraft,
  onInput: onMinSubjectInput,
  commitDraft: commitMinSubject,
} = useNumberDraft({
  value: () => props.ruleConfig.minSubjectLength,
  clamp: clampMinSubjectLength,
  commit: (v) => emit("saveRuleConfig", { minSubjectLength: v }),
})

const {
  draft: bodyLineDraft,
  onInput: onBodyLineInput,
  commitDraft: commitBodyLine,
} = useNumberDraft({
  value: () => props.ruleConfig.maxBodyLineLength,
  clamp: clampMaxBodyLineLength,
  commit: (v) => emit("saveRuleConfig", { maxBodyLineLength: v }),
})

const {
  draft: diffBudgetDraft,
  onInput: onDiffBudgetInput,
  commitDraft: commitDiffBudget,
} = useNumberDraft({
  value: () => props.ruleConfig.diffContextBudget,
  clamp: clampDiffContextBudget,
  commit: (v) => emit("saveRuleConfig", { diffContextBudget: v }),
})

/** 可选规则开关切换（binary 模式下载荷恒为布尔，类型收窄兜底数组） */
function onRuleToggle(key: "requireCapitalizedSubject" | "detectWipSubject" | "scopeFormatEnabled" | "bodyLineLimitEnabled", value: boolean | any[]) {
  const patch: Partial<CommitRuleConfig> = {}
  patch[key] = Array.isArray(value) ? value.length > 0 : value
  emit("saveRuleConfig", patch)
}
</script>
