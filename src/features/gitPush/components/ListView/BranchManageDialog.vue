<!-- gitPush 本地分支管理弹窗（列出分支并删除非当前分支；未合并分支需二次确认后强制删除） -->
<template>
  <Dialog
    :visible="visible"
    :header="`${i18n.branchManage} · ${project.name}`"
    size="small"
    @update:visible="emit('update:visible', $event)"
  >
    <div class="gp-branch-manage">
      <p class="gp-branch-manage__hint">
        {{ i18n.branchManageHint }}
      </p>
      <div
        v-if="!branches.length"
        class="gp-branch-manage__empty"
      >
        {{ i18n.branchManageEmpty }}
      </div>
      <div
        v-for="b in branches"
        :key="b.name"
        class="gp-branch-manage__row"
        :class="{ 'is-current': b.current }"
      >
        <Icon
          :icon="b.current ? 'mdi:check' : 'mdi:source-branch'"
          height="13"
          class="gp-branch-manage__icon"
        />
        <span
          class="gp-branch-manage__name"
          :title="b.name"
        >{{ b.name }}</span>
        <Tag
          v-if="b.current"
          size="xsmall"
          variant="secondary"
          :content="i18n.branchCurrentBadge"
        />
        <Button
          v-else
          class="gp-branch-manage__delete"
          variant="ghost"
          text
          size="xsmall"
          dense
          icon="deleteOutline"
          :title="i18n.branchDeleteTitle.replace('{0}', b.name)"
          :aria-label="i18n.branchDeleteTitle.replace('{0}', b.name)"
          :disabled="!!deleting"
          @click="askDelete(b.name)"
        />
      </div>
      <!-- 删除失败信息（分支已不存在 / 权限问题等） -->
      <div
        v-if="error"
        class="gp-branch-manage__error"
        role="alert"
      >
        {{ error }}
      </div>
    </div>
  </Dialog>

  <ConfirmDialog
    :visible="confirm.visible"
    :header="confirm.force ? i18n.deleteBranchForceConfirm : i18n.deleteBranchConfirm"
    :message="(confirm.force ? i18n.deleteBranchForceBody : i18n.deleteBranchConfirmBody).replace('{0}', confirm.branch)"
    :accept-label="i18n.delete"
    :reject-label="i18n.cancel"
    accept-severity="danger"
    :accept-loading="!!deleting"
    @update:visible="onConfirmVisible"
    @confirm="doDelete"
    @cancel="confirm.visible = false"
  />
</template>

<script setup lang="ts">
// gitPush 分支管理弹窗：删除本地分支（默认 -d；未合并时二次确认后 -D），列表由卡片自持数据驱动
import type { BranchInfo, GitProject } from "../../types"
import { Icon } from "@iconify/vue"
import { ref, watch } from "vue"
import { getErrorMessage } from "@/utils/stringUtils"
import { useCardServices } from "../../composables/useCardServices"
import Button from "@/components/Button.vue"
import ConfirmDialog from "@/components/ConfirmDialog.vue"
import Dialog from "@/components/Dialog.vue"
import Tag from "@/components/Tag.vue"

const props = defineProps<{
  visible: boolean
  project: GitProject
  /** 卡片自持分支列表（删除成功后经 bumpCardRefresh 自动重载） */
  branches: BranchInfo[]
}>()

const emit = defineEmits<{
  "update:visible": [value: boolean]
}>()

const { services } = useCardServices(() => props.project)
const { ops, shared } = services
const i18n = shared.i18n

/** 正在删除的分支名（空串 = 空闲；同时驱动按钮与确认框的 loading） */
const deleting = ref("")
/** 删除失败信息（在弹窗内呈现，不打断分支列表） */
const error = ref("")
const confirm = ref({ visible: false, branch: "", force: false })

function askDelete(branch: string) {
  error.value = ""
  confirm.value = { visible: true, branch, force: false }
}

/** 删除进行中忽略外部关闭请求，避免确认框消失后结果无处呈现 */
function onConfirmVisible(value: boolean) {
  if (!value && !deleting.value) confirm.value.visible = false
}

async function doDelete() {
  const branch = confirm.value.branch
  if (!branch || deleting.value) return
  deleting.value = branch
  error.value = ""
  try {
    await ops.deleteBranch(props.project.id, branch, confirm.value.force)
    confirm.value.visible = false
  } catch (e) {
    const message = getErrorMessage(e) || String(e)
    // 安全删除被 git 拒绝（分支含未合并提交）→ 同一确认框切换为强制删除说明
    if (!confirm.value.force && /not fully merged|未完全合并|未合并/i.test(message)) {
      confirm.value = { ...confirm.value, force: true }
      return
    }
    confirm.value.visible = false
    error.value = message
  } finally {
    deleting.value = ""
  }
}

watch(() => props.visible, (value) => {
  if (value) return
  confirm.value.visible = false
  error.value = ""
})
</script>

<style lang="scss">
@use "../../styles/BranchManageDialog.scss";
</style>
