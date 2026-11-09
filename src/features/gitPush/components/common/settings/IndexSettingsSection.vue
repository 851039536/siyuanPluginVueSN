<!-- gitPush 设置弹窗「本地提交索引」分组：开关 + 状态摘要 + 重建（自包含异步逻辑） -->
<template>
  <section class="gp-set-section">
    <!-- 分组标题："本地提交索引" -->
    <div class="gp-set-section-title">{{ i18n.indexTitle }}</div>
    <div class="gp-set-row">
      <!-- 索引总开关：关闭后统计路径全部回退直接跑 git -->
      <ToggleButton
        :model-value="indexEnabled"
        size="xsmall"
        dense
        :on-label="i18n.indexEnabledLabel"
        :off-label="i18n.indexDisabledLabel"
        :aria-label="i18n.indexToggleTip"
        :title="i18n.indexToggleTip"
        :disabled="indexBusy"
        @update:model-value="toggleIndexEnabled"
      />
      <div class="gp-set-input-row">
        <!-- 按钮文案："查看状态" -->
        <Button
          variant="ghost"
          size="xsmall"
          dense
          :disabled="indexBusy"
          @click="refreshIndexStatus"
        >
          {{ i18n.indexRefreshStatus }}
        </Button>
        <!-- 按钮文案："重建索引"（tooltip：清空索引，下次统计全量重扫） -->
        <Button
          variant="ghost"
          size="xsmall"
          dense
          :disabled="indexBusy || !indexEnabled"
          :title="i18n.indexRebuildHint"
          @click="rebuildIndex"
        >
          {{ i18n.indexRebuild }}
        </Button>
      </div>
    </div>
    <!-- 索引状态摘要：目录 + 已索引项目数/提交数；命中即表示统计不再重跑全量 git log -->
    <div class="gp-set-hint">
      <!-- 读取失败与「索引为空」必须区分：否则目录不可写会伪装成正常空态 -->
      <span v-if="indexError">{{ i18n.indexLoadFailed }}</span>
      <template v-else-if="indexStatus">
        <span v-if="!indexEnabled">{{ i18n.indexDisabled }}</span>
        <template v-else-if="indexStatus.projects.length === 0">
          {{ i18n.indexEmpty }}
        </template>
        <template v-else>
          {{ i18n.indexSummary
            .replace("{0}", String(indexStatus.projects.length))
            .replace("{1}", String(indexTotalCommits)) }}
        </template>
        <!-- 只显示末级目录，完整路径放 title，避免整行绝对路径占用版面 -->
        <div
          v-if="indexDirName"
          class="gp-set-index-dir"
          :title="indexStatus.dir"
        >{{ indexDirName }}</div>
      </template>
      <template v-else>
        {{ i18n.indexChecking }}
      </template>
    </div>
  </section>
</template>

<script setup lang="ts">
// 本地提交索引分组：打开弹窗即查询状态，开关与重建直接经 manager 持久化
import type { GitPushManager } from "../../../types"
import {
  computed,
  onMounted,
  ref,
} from "vue"
import { showMessage } from "siyuan"
import Button from "@/components/Button.vue"
import ToggleButton from "@/components/ToggleButton.vue"

const props = defineProps<{
  i18n: Record<string, any>
  manager: GitPushManager
}>()

/** 索引状态摘要（null = 尚未查询/查询中） */
const indexStatus = ref<{ dir: string, projects: Array<{ projectId: string, commits: number, complete: boolean, analyzedAt: string }> } | null>(null)
/** 索引开关当前值（关闭时统计回退直接跑 git） */
const indexEnabled = ref(true)
/** 索引操作进行中（防并发点击） */
const indexBusy = ref(false)
/**
 * 索引状态读取失败（与「索引为空」区分展示）。
 * 目录不可写/权限拒绝时若也归入空态，用户无法察觉索引其实坏了。
 */
const indexError = ref(false)
/**
 * 索引操作的并发深度。
 * `rebuildIndex` 会内层调用 `refreshIndexStatus`，若各自在 finally 里清 `indexBusy`，
 * 内层结束就会提前解锁按钮（外层仍在跑），"防并发点击"形同虚设。
 * 故用深度计数：只有最外层结束时才复位。
 */
let indexBusyDepth = 0

function beginIndexBusy() {
  indexBusyDepth++
  indexBusy.value = true
}

function endIndexBusy() {
  indexBusyDepth = Math.max(0, indexBusyDepth - 1)
  indexBusy.value = indexBusyDepth > 0
}

/** 已索引项目的提交总数（状态摘要展示用） */
const indexTotalCommits = computed(() => {
  const list = indexStatus.value?.projects ?? []
  return list.reduce((sum, p) => sum + p.commits, 0)
})

/** 索引目录末级名（完整路径由 title 承载） */
const indexDirName = computed(() => {
  const dir = indexStatus.value?.dir
  if (!dir) return ""
  const parts = dir.split(/[\\/]/).filter(Boolean)
  return parts[parts.length - 1] ?? dir
})

/** 查询索引状态（打开弹窗时自动调用，也可手动刷新） */
async function refreshIndexStatus() {
  beginIndexBusy()
  try {
    indexEnabled.value = await props.manager.isIndexEnabled()
    indexStatus.value = await props.manager.getIndexStatus()
    indexError.value = false
  } catch (e) {
    console.warn("[gitPush] 读取索引状态失败", e)
    indexStatus.value = null
    indexError.value = true
  } finally {
    endIndexBusy()
  }
}

/** 切换索引开关（关闭后统计路径全部回退直接跑 git；下次统计生效） */
async function toggleIndexEnabled() {
  if (indexBusy.value) return
  beginIndexBusy()
  try {
    const next = !indexEnabled.value
    await props.manager.setIndexEnabled(next)
    indexEnabled.value = next
    showMessage(next ? props.i18n.indexEnabledOn : props.i18n.indexEnabledOff, 3000, "info")
    // 关闭后状态摘要已无意义（索引不再参与统计）；开启则重新查询一次
    if (next) await refreshIndexStatus()
  } catch (e) {
    showMessage(String(e), 3000, "error")
  } finally {
    endIndexBusy()
  }
}

/**
 * 重建索引：清空索引，下次统计时按当前结构全量重建。
 * 只做清空不做立即重扫（重扫需用户进入统计视图，那里有进度反馈）。
 */
async function rebuildIndex() {
  if (indexBusy.value) return
  beginIndexBusy()
  try {
    await props.manager.clearIndex()
    await refreshIndexStatus()
    showMessage(props.i18n.indexRebuilt, 3000, "info")
  } catch (e) {
    showMessage(String(e), 3000, "error")
  } finally {
    endIndexBusy()
  }
}

// 打开弹窗即查询一次，用户无需额外操作即可看到索引是否在工作
onMounted(() => {
  void refreshIndexStatus()
})
</script>
