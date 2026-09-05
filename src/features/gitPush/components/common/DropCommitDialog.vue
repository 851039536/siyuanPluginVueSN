<!-- gitPush 删除历史提交弹窗（自包含：四项前置校验、bundle 备份、commit-tree 删除执行） -->
<template>
  <Teleport to="body">
    <div
      class="gp-mask"
      @click.self="onMaskClick"
    >
      <div class="gp-dialog gp-drop-dialog">
        <div class="gp-dialog-header">
          <!-- 弹窗标题："删除历史提交" -->
          <span class="gp-dialog-title">{{ i18n.dropCommitTitle }}</span>
          <button
            class="vp-btn vp-btn--ghost vp-btn--xs"
            :disabled="busy"
            @click="emit('close')"
          >
            <Icon icon="mdi:close" height="10" />
          </button>
        </div>

        <div class="gp-dialog-body">
          <!-- 加载中 -->
          <div
            v-if="loading"
            class="gp-loading"
          >
            <Loader />
          </div>

          <template v-else>
            <!-- 项目信息 + 提交 hash -->
            <div class="gp-drop-meta">
              <span class="gp-drop-project">{{ project?.name || target.projectName }}</span>
              <span class="gp-drop-hash">{{ target.hash }}</span>
            </div>

            <!-- 原提交信息 -->
            <div class="gp-drop-block">
              <!-- 标签："待删除提交" -->
              <label class="gp-label">{{ i18n.dropCommitTargetLabel }}</label>
              <pre class="gp-drop-original">{{ target.message }}</pre>
            </div>

            <!-- 内容不变说明（本操作的核心语义） -->
            <div class="gp-drop-note">
              <Icon icon="mdi:information-outline" height="12" />
              <span>{{ i18n.dropCommitBody }}</span>
            </div>

            <!-- 不可删除原因提示 -->
            <div
              v-if="!canDrop"
              class="gp-drop-warning"
            >
              <Icon icon="mdi:alert-circle-outline" height="12" />
              <span>{{ blockedReason }}</span>
            </div>

            <!-- hash 重写 + 强推警告 -->
            <div
              v-if="canDrop"
              class="gp-drop-warning gp-drop-warning--danger"
            >
              <Icon icon="mdi:alert-circle-outline" height="12" />
              <span>{{ i18n.dropCommitForcePushHint }}</span>
            </div>

            <!-- 备份中提示 -->
            <div
              v-if="backingUp"
              class="gp-drop-warning"
            >
              <Icon
                icon="mdi:loading"
                height="12"
                class="gp-spin"
              />
              <span>{{ i18n.dropCommitBackupRunning }}</span>
            </div>

            <!-- 删除执行中提示（含重写计数 + 进度条） -->
            <div
              v-if="dropping"
              class="gp-drop-warning"
            >
              <Icon
                icon="mdi:alert-circle-outline"
                height="12"
              />
              <span>{{ dropProgress ? i18n.dropCommitRunningProgress.replace("{0}", String(dropProgress.current)).replace("{1}", String(dropProgress.total)) : i18n.dropCommitRunning }}</span>
              <!-- 重写进度条（细条，宽度随计数实时更新） -->
              <div class="gp-drop-progress">
                <div
                  class="gp-drop-progress-bar"
                  :style="{ width: (dropProgress && dropProgress.total > 0 ? Math.round(dropProgress.current / dropProgress.total * 100) : 0) + '%' }"
                />
              </div>
            </div>

            <!-- 执行失败提示 -->
            <div
              v-if="error"
              class="gp-drop-warning gp-drop-warning--error"
            >
              <Icon icon="mdi:alert-circle-outline" height="12" />
              <span>{{ error }}</span>
            </div>

            <!-- 备份完成信息条：显示 bundle 完整路径，点击打开备份所在文件夹（删除前完整历史的唯一恢复点） -->
            <div
              v-if="backupPath"
              class="gp-drop-backup"
              role="button"
              tabindex="0"
              :title="i18n.dropCommitOpenBackupTip"
              @click="openBackupFolder"
              @keydown.enter="openBackupFolder"
            >
              <Icon icon="mdi:content-save-check-outline" height="12" />
              <span class="gp-drop-backup-label">{{ i18n.dropCommitBackupDone }}</span>
              <span class="gp-drop-backup-path">{{ backupPath }}</span>
              <span class="gp-drop-backup-open">
                <Icon icon="mdi:folder-open" height="12" />
                {{ i18n.openFolder }}
              </span>
            </div>
          </template>
        </div>

        <div class="gp-dialog-footer">
          <!-- 底部提示：reflog 可恢复 -->
          <span class="gp-drop-hint">{{ i18n.dropCommitRecoverHint }}</span>
          <div class="gp-grow" />
          <!-- 完成（删除成功后展示备份路径，由用户点击关闭） -->
          <button
            v-if="done"
            class="vp-btn vp-btn--primary vp-btn--sm"
            @click="emit('close')"
          >
            <Icon icon="mdi:check" height="12" />
            <span>{{ i18n.dropCommitDone }}</span>
          </button>
          <template v-else>
            <!-- 取消 -->
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm"
              :disabled="busy"
              @click="emit('close')"
            >
              {{ i18n.cancel }}
            </button>
            <!-- 确认删除（危险操作，红色） -->
            <button
              class="vp-btn vp-btn--danger vp-btn--sm"
              :disabled="!canDrop || busy"
              @click="performDrop"
            >
              <Icon
                :icon="dropping ? 'mdi:loading' : 'mdi:delete-outline'"
                height="12"
                :class="{ 'gp-spin': dropping }"
              />
              <span>{{ i18n.dropCommitConfirm }}</span>
            </button>
          </template>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// gitPush 删除历史提交弹窗（自包含：校验 HEAD/merge/祖先/rebase 四态，备份后执行 commit-tree 删除）
import type { CommitFixTarget, GitProject } from "../../types"
import { Icon } from "@iconify/vue"
import { computed, inject, onMounted, onUnmounted, ref } from "vue"
import { openLocalPath, resolveValidPath } from "../../utils"
import { CARD_SERVICES_KEY } from "../../types"
import { getNodeFsPathOs } from "@/utils/nodeModules"
import { getErrorMessage } from "@/utils/stringUtils"
import Loader from "@/components/Loader.vue"

const props = defineProps<{
  i18n: Record<string, any>
  target: CommitFixTarget
}>()

const emit = defineEmits<{
  close: []
  saved: [projectId: string]
}>()

const services = inject(CARD_SERVICES_KEY)!
const { manager } = services

const project = ref<GitProject | null>(null)
const loading = ref(true)
/** 备份中（bundle create --all） */
const backingUp = ref(false)
/** 删除执行中（历史重写） */
const dropping = ref(false)
/** 历史重写进度（{current, total}，null = 尚未开始） */
const dropProgress = ref<{ current: number, total: number } | null>(null)
/** 执行失败信息 */
const error = ref("")
/** 已生成的 bundle 备份文件完整路径（删除执行前的唯一恢复点；空 = 尚未生成） */
const backupPath = ref("")
/** 删除是否已成功完成（完成后停留展示备份路径，由用户点「完成」关闭） */
const done = ref(false)
const headHash = ref("")
/** 仓库是否处于 rebase 中断状态（上次重写失败的残留，此时任何重写都必须阻止） */
const rebaseStuck = ref(false)
/** 目标是否为当前 HEAD 的祖先（非祖先时删除无效） */
const isAncestor = ref(false)

/** 是否有操作进行中（备份/删除中禁止关闭与重复提交） */
const busy = computed(() => backingUp.value || dropping.value)

const projectPath = computed(() => project.value ? resolveValidPath(project.value) : "")

/** 目标是否为 HEAD（删 HEAD = reset 语义，阻止） */
const isHeadTarget = computed(() => !!headHash.value && headHash.value.startsWith(props.target.hash))

/** 是否可执行删除：非 HEAD、非 merge、为 HEAD 祖先、非 rebase 残留 */
const canDrop = computed(() =>
  !!projectPath.value && !!headHash.value && !isHeadTarget.value
  && props.target.isMerge !== true && isAncestor.value && !rebaseStuck.value,
)

/** 不可删除时的提示文案（按阻断优先级） */
const blockedReason = computed(() => {
  if (rebaseStuck.value) return props.i18n.ruleFixRebaseStuck
  if (isHeadTarget.value) return props.i18n.dropCommitBlockedHead
  if (props.target.isMerge === true) return props.i18n.dropCommitBlockedMerge
  if (!isAncestor.value) return props.i18n.dropCommitBlockedAncestor
  return ""
})

function handleKeydown(e: KeyboardEvent) {
  if (e.key === "Escape" && !busy.value) emit("close")
}

function onMaskClick() {
  if (!busy.value) emit("close")
}

onMounted(() => {
  window.addEventListener("keydown", handleKeydown)
  void init()
})
onUnmounted(() => {
  window.removeEventListener("keydown", handleKeydown)
})

async function init() {
  try {
    const p = await manager.getProjectById(props.target.projectId)
    project.value = p ?? null
    if (!p) return
    const path = resolveValidPath(p)
    const [head, stuck, ancestor] = await Promise.all([
      manager.getHeadHash(path),
      manager.isInRebaseState(path),
      manager.isAncestorOfHead(path, props.target.hash),
    ])
    headHash.value = head
    rebaseStuck.value = stuck
    isAncestor.value = ancestor
  } finally {
    loading.value = false
  }
}

/** 执行删除：先 bundle 全量备份（失败即中止），再 commit-tree 图重建删除；成功后停留展示备份位置 */
async function performDrop() {
  if (!canDrop.value || busy.value || !projectPath.value) return
  error.value = ""
  done.value = false
  backupPath.value = ""
  backingUp.value = true
  try {
    // 先备份后删除，成功后保留弹窗展示备份路径（撤销恢复点需用户主动关闭）
    backupPath.value = await manager.createProjectBackup(projectPath.value)
    backingUp.value = false
    dropping.value = true
    dropProgress.value = null
    await manager.dropCommit(projectPath.value, props.target.hash, (current, total) => {
      dropProgress.value = { current, total }
    })
    done.value = true
    emit("saved", props.target.projectId)
  } catch (e: unknown) {
    console.error("[gitPush] 删除历史提交失败:", e)
    error.value = getErrorMessage(e) || props.i18n.dropCommitFailed
  } finally {
    backingUp.value = false
    dropping.value = false
    dropProgress.value = null
  }
}

/** 在文件管理器中打开备份文件所在文件夹（bundle 保留删除前完整历史，可 git clone 恢复） */
async function openBackupFolder() {
  if (!backupPath.value) return
  const nodePath = getNodeFsPathOs()?.path
  if (!nodePath) return
  await openLocalPath(nodePath.dirname(backupPath.value))
}
</script>

<style lang="scss">
@use "../../styles/DropCommitDialog.scss";
@use "../../styles/index.scss";
</style>
