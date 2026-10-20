<!-- 缓存清理面板容器：工具条 + 设置行 + 根目录/条目列表编排（逻辑全在 useCacheClean，子组件纯展示） -->
<template>
  <div class="cc-panel">
    <!-- 顶部工具条：扫描 + 已选统计 + 清理 -->
    <div class="cc-panel__toolbar">
      <Button
        :variant="scanResult ? 'secondary' : 'primary'"
        size="xsmall"
        icon="refresh"
        :loading="scanning"
        :disabled="cleaning"
        @click="scan"
      >{{ scanLabel }}</Button>

      <Button
        v-if="scanning || cleaning"
        variant="ghost"
        text
        size="xsmall"
        dense
        icon="stop"
        :title="i18n.cancel"
        @click="cancel"
      >{{ i18n.cancel }}</Button>

      <span class="cc-panel__spacer"></span>

      <span
        v-if="!cleaning"
        class="cc-panel__selected"
      >{{ selectedText }}</span>
      <span
        v-else
        class="cc-panel__selected"
      >{{ i18n.cacheCleaning }}</span>

      <Button
        variant="danger"
        size="xsmall"
        icon="delete"
        :loading="cleaning"
        :disabled="scanning || selectedEntries.length === 0"
        @click="clean"
      >{{ i18n.cacheClean }}</Button>
    </div>

    <!-- 进度行：扫描 / 清理各自的确定态进度 -->
    <div
      v-if="scanning"
      class="cc-panel__progress"
    >
      <ProgressBar
        :value="scanPercent"
        size="xsmall"
        :indeterminate-label="i18n.cacheScanning"
      />
      <span class="cc-panel__progress-text">{{ scanProgressText }}</span>
    </div>
    <div
      v-else-if="cleaning"
      class="cc-panel__progress"
    >
      <ProgressBar
        :value="cleanPercent"
        size="xsmall"
        severity="warning"
        :indeterminate-label="i18n.cacheCleaning"
      />
      <span class="cc-panel__progress-text">{{ cleanProgressText }}</span>
    </div>

    <!-- 反馈条（扫描取消/失败、清理结果） -->
    <Message
      v-if="feedback"
      class="cc-panel__feedback"
      size="xsmall"
      :severity="feedback.severity"
      :icon="feedback.severity === 'error' ? 'error' : feedback.severity === 'warn' ? 'warning' : 'success'"
    >{{ feedback.text }}</Message>

    <!-- 未扫描空态 -->
    <div
      v-if="!scanResult && !scanning"
      class="cc-panel__empty"
    >
      <IconWrapper
        name="databaseRemoveOutline"
        :size="32"
      />
      <p class="cc-panel__empty-text">{{ i18n.cacheScanIdle }}</p>
    </div>

    <template v-else>
      <!-- 合计卡片 -->
      <div
        v-if="scanResult"
        class="cc-panel__totals"
      >
        <div class="cc-panel__total">
          <span class="cc-panel__total-value">{{ formatSize(scanResult.size) }}</span>
          <span class="cc-panel__total-label">{{ i18n.cacheTotalSize }}</span>
        </div>
        <div class="cc-panel__total">
          <span class="cc-panel__total-value">{{ scanResult.files }}</span>
          <span class="cc-panel__total-label">{{ i18n.cacheTotalFiles }}</span>
        </div>
        <span
          v-if="elapsedText"
          class="cc-panel__elapsed"
        >{{ elapsedText }}</span>
      </div>

      <!-- 根目录勾选区 -->
      <CacheRootList
        :roots="rootRows"
        :i18n="i18n"
        @toggle="handleToggleRoot"
        @open="handleOpen"
      />

      <!-- 条目明细 -->
      <CacheEntryList
        :entries="scanEntries"
        :selected="selected"
        :i18n="i18n"
        @toggle-entry="handleToggleEntry"
        @open="handleOpen"
        @select-all="selectAll"
        @select-none="selectNone"
      />
    </template>

    <!-- 清理偏好设置 -->
    <CacheCleanOptions
      :mode="settings.mode"
      :min-age-minutes="settings.minAgeMinutes"
      :max-entries="settings.maxEntries"
      :i18n="i18n"
      @update-mode="setMode"
      @update-min-age="setMinAgeMinutes"
      @update-max-entries="setMaxEntries"
    />

    <!-- 确认弹窗（受控；confirm 不自动关闭，由 doClean 决定时机） -->
    <ConfirmDialog
      v-model:visible="confirmVisible"
      :header="confirmTitle"
      :message="confirmMessage"
      icon="warning"
      :accept-label="confirmAcceptLabel"
      :reject-label="confirmRejectLabel"
      accept-icon="delete"
      :accept-severity="settings.mode === 'permanent' ? 'danger' : 'primary'"
      size="small"
      @confirm="doClean"
      @cancel="closeConfirm"
    />
  </div>
</template>

<script setup lang="ts">
import type { ComputedRef } from "vue"
import type {
  CacheCleanSettings,
  CacheRootId,
} from "../../types"
import type { CachePanelFeedback } from "./types"
import {
  computed,
  isRef,
} from "vue"
import Button from "@/components/Button.vue"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import IconWrapper from "@/components/IconWrapper.vue"
import Message from "@/components/Message.vue"
import ProgressBar from "@/components/ProgressBar.vue"
import { openPathInShell } from "@/utils/electronDialog"
import { useCacheClean } from "../../composables/useCacheClean"
import CacheCleanOptions from "./CacheCleanOptions.vue"
import CacheEntryList from "./CacheEntryList.vue"
import CacheRootList from "./CacheRootList.vue"
import { flattenEntries } from "./rows"

interface Props {
  /** everythingSearch 命名空间的 i18n 文案（父层 computed，随语言切换即时更新） */
  i18n: Record<string, string> | ComputedRef<Record<string, string>>
  /** 缓存清理持久化偏好（父层 useSearchConfig 的 cacheSettings） */
  settings: CacheCleanSettings
  /** 更新单个偏好项 */
  updateSettings: <K extends keyof CacheCleanSettings>(key: K, value: CacheCleanSettings[K]) => void
  /** 记录某分类的显式勾选偏好 */
  setRootEnabled: (id: CacheRootId, enabled: boolean) => void
}

const props = defineProps<Props>()

/** i18n 归一为纯对象（computed 时取 .value），供子组件按普通 props 消费 */
const i18n = computed<Record<string, string>>(() => (
  isRef(props.i18n) ? props.i18n.value : props.i18n
))

const {
  rootRows,
  scanResult,
  scanStatus,
  scanPercent,
  scanProgressText,
  scanFeedback,
  cleanFeedback,
  scanLabel,
  elapsedText,
  selected,
  selectedEntries,
  selectedText,
  cleaning,
  cleanPercent,
  cleanProgressText,
  confirmVisible,
  confirmTitle,
  confirmMessage,
  confirmAcceptLabel,
  confirmRejectLabel,
  scan,
  cancel,
  toggleEntry,
  toggleRoot,
  selectAll,
  selectNone,
  clean,
  closeConfirm,
  doClean,
  setMode,
  setMinAgeMinutes,
  setMaxEntries,
  formatSize,
} = useCacheClean({
  i18n: i18n,
  settings: props.settings,
  updateSettings: props.updateSettings,
  setRootEnabled: props.setRootEnabled,
})

/** 扫描中（Button/进度条共用，避免模板里反复比较字符串） */
const scanning = computed(() => scanStatus.value === "scanning")

/** 待展示条目：各分类平铺后按体积降序（分类已在根目录区体现） */
const scanEntries = computed(() => flattenEntries(scanResult.value))

/** 反馈条：清理反馈优先（清理完成时扫描反馈已无意义） */
const feedback = computed<CachePanelFeedback | null>(
  () => cleanFeedback.value ?? scanFeedback.value,
)

/** 清理方式选项已由 CacheCleanOptions 子组件承担，此处不再重复文案构建 */

const handleToggleRoot = (id: CacheRootId, checked: boolean) => {
  toggleRoot(id, checked)
}

const handleToggleEntry = (path: string, checked: boolean) => {
  toggleEntry(path, checked)
}

/** 在资源管理器中打开路径（失败静默：目录可能已随清理被删除） */
const handleOpen = async (path: string) => {
  await openPathInShell(path)
}
</script>

<style scoped lang="scss">
@use "../../styles/CacheCleanPanel.scss";
</style>
