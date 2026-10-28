<!-- gitPush 主推送按钮（推送全部 / 推送中切换为取消；操作栏与手风琴摘要共用） -->
<template>
  <!-- 推送全部（主操作；无待推送提交时禁用，并在 tooltip 说明原因） -->
  <Button
    v-if="!derived.isPushing(project.id)"
    class="gp-action-btn"
    variant="primary"
    size="xsmall"
    dense
    :disabled="!hasAnyRemote(project) || derived.isPulling(project.id) || !pushStatus?.needsPush"
    :title="disabledHint"
    @click.stop="ops.pushToAll(project.id)"
  >
    {{ i18n.pushAll }}
  </Button>
  <!-- 推送中：主操作切换为取消 -->
  <Button
    v-else
    class="gp-action-btn"
    variant="danger"
    size="xsmall"
    dense
    @click.stop="ops.cancelPush(project.id)"
  >
    {{ i18n.cancel }}
  </Button>
</template>

<script setup lang="ts">
// gitPush 主推送按钮（推送全部 / 取消推送；状态派生与操作经 useCardServices 注入）
import type { GitProject } from "../../types"
import { computed } from "vue"
import { hasAnyRemote } from "../../utils"
import { useCardServices } from "../../composables/useCardServices"
import Button from "@/components/Button.vue"

const props = defineProps<{ project: GitProject }>()

const { services, pushStatus } = useCardServices(() => props.project)
const { shared, derived, ops } = services
const i18n = shared.i18n

/** 禁用原因（仅在推送状态已明确且确实无待推送提交时给出，避免「检测中」时误导） */
const disabledHint = computed(() =>
  pushStatus.value && !pushStatus.value.needsPush ? i18n.pushAllNoPending : undefined,
)
</script>
