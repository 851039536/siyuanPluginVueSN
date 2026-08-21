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
    <div
      v-for="r in remotes"
      :key="r.key"
      class="gp-remote-item"
      :class="{ active: !!project[r.remoteProp] }"
    >
      <Icon
        :icon="r.icon"
        height="12"
      />
      <span v-if="project[r.remoteProp]">{{ project[r.remoteProp] }}</span>
      <!-- 未配置占位："未检测到" -->
      <span
        v-else
        class="gp-remote-none"
      >{{ i18n.notDetected }}</span>
      <span
        v-if="pushStatus?.remotes[r.key]"
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
// gitPush 项目卡片远程状态区（远程列表 + 状态徽章 + 冲突警告）
import type { GitProject } from "../../types"
import { Icon } from "@iconify/vue"
import { REMOTES } from "../../types"
import { useCardServices } from "../../composables/useCardServices"

const props = defineProps<{
  project: GitProject
}>()

const { services, pushStatus, remoteStatusLoading } = useCardServices(() => props.project)
const { shared, derived, ops } = services
const i18n = shared.i18n
const remotes = REMOTES
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "../../styles/CardRemotes.scss";
</style>
