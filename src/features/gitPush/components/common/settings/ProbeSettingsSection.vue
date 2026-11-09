<!-- gitPush 设置弹窗「实时探测」分组：文件监听 / 工作区轮询 / mtime 预筛 / 网络轮询（改动即时保存） -->
<template>
  <section class="gp-set-section">
    <!-- 分组标题："实时探测（变更 / 推送 / 需拉取）" -->
    <div class="gp-set-section-title">{{ i18n.probeTitle }}</div>
    <!-- 第 1 层：.git 文件监听（0 次 git 子进程） -->
    <div class="gp-set-row">
      <!-- 设置项标签："文件监听"（tooltip：监听 .git 关键文件，不产生 git 子进程） -->
      <label
        class="gp-set-label"
        :title="i18n.probeWatchHint"
      >{{ i18n.probeWatchLabel }}</label>
      <div class="gp-set-input-row">
        <ToggleButton
          :model-value="localProbe.watch.enabled"
          size="xsmall"
          dense
          :on-label="i18n.probeOn"
          :off-label="i18n.probeOff"
          :aria-label="i18n.probeWatchLabel"
          :title="i18n.probeWatchHint"
          @update:model-value="patchProbe({ watch: { enabled: $event } })"
        />
        <!-- 已建立监听的项目数：0 且开关为开 = 环境不支持，已自动降级到轮询层 -->
        <span
          v-if="localProbe.watch.enabled"
          class="gp-set-watched"
        >{{ i18n.probeWatchedCount.replace("{0}", String(probeWatchedCount)) }}</span>
      </div>
    </div>
    <!-- 第 2 层：工作区轮询（stat 预筛 + 指数退避） -->
    <div class="gp-set-row">
      <!-- 设置项标签："工作区轮询（毫秒）"（tooltip：仅在面板可见时运行，无变化自动放慢） -->
      <label
        class="gp-set-label"
        :title="i18n.probePollHint"
      >{{ i18n.probePollLabel }}</label>
      <div class="gp-set-input-row">
        <ToggleButton
          :model-value="localProbe.poll.enabled"
          size="xsmall"
          dense
          :on-label="i18n.probeOn"
          :off-label="i18n.probeOff"
          :aria-label="i18n.probePollLabel"
          :title="i18n.probePollHint"
          @update:model-value="patchProbe({ poll: { enabled: $event } })"
        />
        <Input
          :model-value="intervalDraft"
          type="number"
          size="xsmall"
          class="gp-set-number-input"
          :disabled="!localProbe.poll.enabled"
          @update:model-value="onIntervalInput"
          @blur="commitInterval"
          @keydown.enter="commitInterval"
        />
        <!-- 立即检测：跑一轮本地状态查询，故跟随轮询开关 -->
        <Button
          variant="ghost"
          size="xsmall"
          dense
          :disabled="!localProbe.poll.enabled"
          :title="i18n.probeNowHint"
          @click="emit('probeNow')"
        >
          {{ i18n.probeNow }}
        </Button>
      </div>
    </div>
    <!-- stat 预筛：零子进程判断「值不值得跑 git」 -->
    <div class="gp-set-row">
      <!-- 设置项标签："mtime 预筛"（tooltip：先比对文件时间戳，未变则跳过 git） -->
      <label
        class="gp-set-label"
        :title="i18n.probePrefilterHint"
      >{{ i18n.probePrefilterLabel }}</label>
      <div class="gp-set-input-row">
        <ToggleButton
          :model-value="localProbe.poll.statPrefilter"
          size="xsmall"
          dense
          :on-label="i18n.probeOn"
          :off-label="i18n.probeOff"
          :aria-label="i18n.probePrefilterLabel"
          :title="i18n.probePrefilterHint"
          :disabled="!localProbe.poll.enabled"
          @update:model-value="patchProbe({ poll: { statPrefilter: $event } })"
        />
      </div>
    </div>
    <!-- 第 3 层：网络轮询（唯一能发现「需拉取」的层，默认关闭） -->
    <div class="gp-set-row">
      <!-- 设置项标签："网络轮询"（tooltip：定时 fetch 发现远程新提交，默认关闭） -->
      <label
        class="gp-set-label"
        :title="i18n.probeNetworkHint"
      >{{ i18n.probeNetworkLabel }}</label>
      <div class="gp-set-input-row">
        <ToggleButton
          :model-value="localProbe.network.enabled"
          size="xsmall"
          dense
          :on-label="i18n.probeOn"
          :off-label="i18n.probeOff"
          :aria-label="i18n.probeNetworkLabel"
          :title="i18n.probeNetworkHint"
          @update:model-value="patchProbe({ network: { enabled: $event } })"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
// 实时探测分组：三层开关即时保存并下发父级重排运行中的探测；轮询间隔走草稿态提交
import type { ProbeConfig } from "../../../types"
import { ref, watch } from "vue"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import ToggleButton from "@/components/ToggleButton.vue"
import { useNumberDraft } from "../../../composables/useNumberDraft"
import { clampProbeConfig } from "../../../types"

const props = defineProps<{
  i18n: Record<string, any>
  probeConfig: ProbeConfig
  probeWatchedCount: number
}>()

const emit = defineEmits<{
  saveProbeConfig: [config: ProbeConfig]
  probeNow: []
}>()

/** 探测配置本地副本（父级 probeConfig 为权威值，此处仅承载编辑态） */
const localProbe = ref<ProbeConfig>(clampProbeConfig(props.probeConfig))

// 父级配置变化（如首次异步加载完成）时同步下来，避免弹窗停留在默认值
watch(() => props.probeConfig, (cfg) => {
  localProbe.value = clampProbeConfig(cfg)
}, { deep: true })

/**
 * 提交探测配置变更（归一化后下发）。
 * 逐字段合并而非整体替换：调用方只改一个开关时不必构造完整对象。
 */
function patchProbe(patch: {
  watch?: Partial<ProbeConfig["watch"]>
  poll?: Partial<ProbeConfig["poll"]>
  network?: Partial<ProbeConfig["network"]>
}) {
  const next = clampProbeConfig({
    watch: { ...localProbe.value.watch, ...patch.watch },
    poll: { ...localProbe.value.poll, ...patch.poll },
    network: { ...localProbe.value.network, ...patch.network },
  })
  localProbe.value = next
  emit("saveProbeConfig", next)
}

/** 轮询间隔草稿：失焦/回车时经完整配置钳位后提交 */
const {
  draft: intervalDraft,
  onInput: onIntervalInput,
  commitDraft: commitInterval,
} = useNumberDraft({
  value: () => localProbe.value.poll.intervalMs,
  clamp: (n) => clampProbeConfig({
    ...localProbe.value,
    poll: { ...localProbe.value.poll, intervalMs: n },
  }).poll.intervalMs,
  commit: (n) => patchProbe({ poll: { intervalMs: n } }),
})
</script>
