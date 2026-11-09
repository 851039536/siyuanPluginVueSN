<!-- gitPush 设置弹窗「性能与超时」分组：并发数 + 网络/本地命令超时（失焦或回车即时保存） -->
<template>
  <section class="gp-set-section">
    <!-- 分组标题："性能与超时" -->
    <div class="gp-set-section-title">{{ i18n.settingsGroupPerformance }}</div>
    <!-- 并发数 -->
    <div class="gp-set-row">
      <!-- 设置项标签："Git 并发数"（tooltip：并发上限说明） -->
      <label
        class="gp-set-label"
        :title="i18n.concurrencyHint"
      >{{ i18n.gitConcurrency }}</label>
      <Input
        :model-value="concurrencyDraft"
        type="number"
        size="xsmall"
        class="gp-set-number-input"
        :placeholder="concurrencyRange"
        @update:model-value="onConcurrencyInput"
        @blur="commitConcurrency"
        @keydown.enter="commitConcurrency"
      />
    </div>
    <!-- 网络命令超时 -->
    <div class="gp-set-row">
      <!-- 设置项标签："网络超时（秒）"（tooltip：超时上限说明） -->
      <label
        class="gp-set-label"
        :title="i18n.networkTimeoutHint"
      >{{ i18n.networkTimeout }}</label>
      <Input
        :model-value="networkTimeoutDraft"
        type="number"
        size="xsmall"
        class="gp-set-number-input"
        :placeholder="networkTimeoutRange"
        @update:model-value="onNetworkTimeoutInput"
        @blur="commitNetworkTimeout"
        @keydown.enter="commitNetworkTimeout"
      />
    </div>
    <!-- 本地命令超时 -->
    <div class="gp-set-row">
      <!-- 设置项标签："本地命令超时（秒）"（tooltip：超时上限说明） -->
      <label
        class="gp-set-label"
        :title="i18n.localTimeoutHint"
      >{{ i18n.localTimeout }}</label>
      <Input
        :model-value="localTimeoutDraft"
        type="number"
        size="xsmall"
        class="gp-set-number-input"
        :placeholder="localTimeoutRange"
        @update:model-value="onLocalTimeoutInput"
        @blur="commitLocalTimeout"
        @keydown.enter="commitLocalTimeout"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
// 性能与超时分组：三个数字项共用草稿态提交，避免逐字钳位导致无法键入多位数
import Input from "@/components/Input.vue"
import { useNumberDraft } from "../../../composables/useNumberDraft"
import {
  clampGitConcurrency,
  clampLocalTimeout,
  clampNetworkTimeout,
  GIT_CONCURRENCY_MAX,
  GIT_CONCURRENCY_MIN,
  LOCAL_TIMEOUT_MAX,
  LOCAL_TIMEOUT_MIN,
  NETWORK_TIMEOUT_MAX,
  NETWORK_TIMEOUT_MIN,
} from "../../../types"

const props = defineProps<{
  i18n: Record<string, any>
  concurrency: number
  networkTimeout: number
  localTimeout: number
}>()

const emit = defineEmits<{
  save: [value: number]
  saveNetworkTimeout: [value: number]
  saveLocalTimeout: [value: number]
}>()

/** 范围占位符由常量拼出，与钳位边界保持单一数据源 */
const concurrencyRange = `${GIT_CONCURRENCY_MIN}~${GIT_CONCURRENCY_MAX}`
const networkTimeoutRange = `${NETWORK_TIMEOUT_MIN}~${NETWORK_TIMEOUT_MAX}`
const localTimeoutRange = `${LOCAL_TIMEOUT_MIN}~${LOCAL_TIMEOUT_MAX}`

const {
  draft: concurrencyDraft,
  onInput: onConcurrencyInput,
  commitDraft: commitConcurrency,
} = useNumberDraft({
  value: () => props.concurrency,
  clamp: clampGitConcurrency,
  commit: (v) => emit("save", v),
})

const {
  draft: networkTimeoutDraft,
  onInput: onNetworkTimeoutInput,
  commitDraft: commitNetworkTimeout,
} = useNumberDraft({
  value: () => props.networkTimeout,
  clamp: clampNetworkTimeout,
  commit: (v) => emit("saveNetworkTimeout", v),
})

const {
  draft: localTimeoutDraft,
  onInput: onLocalTimeoutInput,
  commitDraft: commitLocalTimeout,
} = useNumberDraft({
  value: () => props.localTimeout,
  clamp: clampLocalTimeout,
  commit: (v) => emit("saveLocalTimeout", v),
})
</script>
