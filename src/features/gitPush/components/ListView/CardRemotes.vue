<!-- gitPush 项目卡片远程仓库状态（远程列表 + 推送状态徽章 + 冲突警告，数据经 useCardServices 注入） -->
<template>
  <!-- 远程仓库状态 -->
  <div class="gp-remotes">
    <span class="gp-remotes-label">REMOTES</span>
    <button
      class="vp-btn vp-btn--ghost vp-btn--sm gp-section-refresh"
      :disabled="remoteStatusLoading"
      :title="i18n.refreshRemoteStatus"
      @click.stop="ops.handleRefreshRemoteStatus(project.id)"
    >
      <Icon :icon="remoteStatusLoading ? 'mdi:loading' : 'mdi:refresh'" height="12" :class="{ 'gp-spin': remoteStatusLoading }" />
    </button>
    <!-- 当前分支名（原操作栏分支检查按钮的信息价值合并至此） -->
    <span
      v-if="pushStatus?.branch"
      class="gp-remote-branch"
    >
      <Icon
        icon="mdi:source-branch"
        height="12"
      />
      {{ pushStatus.branch }}
    </span>
    <div
      v-for="r in visibleRemotes"
      :key="r.key"
      class="gp-remote-item active"
    >
      <Icon
        :icon="r.icon"
        height="12"
      />
      <span>{{ project[r.remoteProp] }}</span>
      <span
        v-if="pushStatus?.remotes[r.key] && derived.statusLabel(project.id, r.key)"
        class="gp-status-badge"
        :class="derived.statusBadgeClass(project.id, r.key)"
      >
        {{ derived.statusLabel(project.id, r.key) }}
      </span>
    </div>
  </div>

  <!-- 远程冲突警告："远程有新的提交，建议先拉取再推送" -->
  <div
    v-if="derived.hasBehind(project.id)"
    class="gp-conflict-warn"
  >
    <Icon
      icon="mdi:alert-circle-outline"
      height="12"
    />
    <span>{{ i18n.conflictWarn }}</span>
  </div>
</template>

<script setup lang="ts">
// gitPush 项目卡片远程状态区（已配置远程列表 + 状态徽章 + 冲突警告）
import type { GitProject } from "../../types"
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import { REMOTES } from "../../types"
import { useCardServices } from "../../composables/useCardServices"

const props = defineProps<{
  project: GitProject
}>()

const { services, pushStatus, remoteStatusLoading } = useCardServices(() => props.project)
const { shared, derived, ops } = services
const i18n = shared.i18n

/** 已配置 URL 的远程（未配置的整项不显示，避免灰色图标噪音） */
const visibleRemotes = computed(() => REMOTES.filter((r) => !!props.project[r.remoteProp]))
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "../../styles/CardRemotes.scss";
</style>
