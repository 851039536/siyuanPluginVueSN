<!-- gitPush 项目卡片操作栏（拉取/推送/强制推送/Fetch，数据与操作经 useCardServices 注入） -->
<template>
  <div class="gp-actions-bar">
    <!-- 拉取区（下拉菜单）：区标签"拉取" + 悬停说明图标 -->
    <div class="gp-actions-section">
      <span class="gp-actions-label">{{ i18n.pull }}</span>
      <Icon
        icon="mdi:information-outline"
        height="12"
        class="gp-actions-hint-icon"
        :title="i18n.pullVsFetchHint"
      />
      <div class="gp-inline-menu-wrap gp-menu-wrap">
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm gp-action-btn"
          :class="{ 'gp-action-btn--active': derived.isPulling(project.id) || fetching }"
          :disabled="!hasAnyRemote(project) || derived.isPulling(project.id) || derived.isPushing(project.id)"
          :title="i18n.pull"
          @click.stop="toggleMenu('pull')"
        >
          <span>{{ i18n.pull }}</span>
          <Icon
            icon="mdi:unfold-more-horizontal"
            height="12"
            class="gp-caret-icon"
          />
        </button>
        <div
          v-if="openMenu === 'pull'"
          class="gp-inline-menu-popover"
          @click.stop
        >
          <button
            v-for="r in remotes"
            :key="`pull-${r.key}`"
            class="gp-inline-menu-item"
            :class="{ 'gp-inline-menu-item--active': derived.isPulling(project.id, r.key) }"
            :disabled="!project[r.remoteProp] || derived.isPulling(project.id) || derived.isPushing(project.id)"
            :title="`${i18n.pull} ${r.label} — ${i18n.pullBtnHint}`"
            @click="ops.confirmPullSingle(project.id, r.key); openMenu = null"
          >
            <span>{{ r.label }}</span>
          </button>
          <div class="gp-inline-menu-divider" />
          <!-- Fetch 项："更新远程状态"（悬停：仅刷新状态不合并代码） -->
          <button
            class="gp-inline-menu-item gp-inline-menu-item--muted"
            :class="{ 'gp-inline-menu-item--active': fetching }"
            :disabled="!hasAnyRemote(project) || derived.isPulling(project.id) || derived.isPushing(project.id) || fetching"
            :title="i18n.fetchHint"
            @click="ops.handleFetchAll(project.id); openMenu = null"
          >
            <Icon
              icon="mdi:cloud-refresh-outline"
              height="12"
            />
            <span>{{ i18n.fetchAll }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 推送区：区标签"推送" + 分支状态检查 + 强制推送 + 单远程菜单 + 推送全部/取消 -->
    <div class="gp-actions-section">
      <span class="gp-actions-label">{{ i18n.push }}</span>
      <div class="gp-actions-btns">
        <!-- 检查当前分支状态（复用远程状态刷新，展示当前分支名 + 各远程 ↑/↓） -->
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm gp-action-btn"
          :disabled="remoteStatusLoading || derived.isPushing(project.id) || derived.isPulling(project.id)"
          :title="i18n.checkBranchStatus"
          @click="ops.handleRefreshRemoteStatus(project.id)"
        >
          <Icon
            :icon="remoteStatusLoading ? 'mdi:loading' : 'mdi:source-branch'"
            height="12"
            :class="{ 'gp-spin': remoteStatusLoading }"
          />
          <span v-if="pushStatus?.branch">{{ pushStatus.branch }}</span>
          <span v-else>{{ i18n.checkBranchStatus }}</span>
        </button>
        <!-- 强制推送（--force-with-lease，二次确认） -->
        <button
          class="vp-btn vp-btn--danger vp-btn--sm gp-action-btn"
          :disabled="!hasAnyRemote(project) || derived.isPushing(project.id) || derived.isPulling(project.id) || !pushStatus?.needsPush"
          :title="i18n.forcePushHint"
          @click="ops.handleForcePushToAll(project.id)"
        >
          <span>{{ i18n.forcePush }}</span>
        </button>
        <!-- 单远程推送（下拉菜单） -->
        <div class="gp-inline-menu-wrap gp-menu-wrap">
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm gp-action-btn"
            :class="{ 'gp-action-btn--active': derived.isPushing(project.id) }"
            :disabled="!hasAnyRemote(project) || derived.isPushing(project.id) || derived.isPulling(project.id)"
            :title="i18n.push"
            @click.stop="toggleMenu('push')"
          >
            <span>{{ i18n.push }}</span>
            <Icon
              icon="mdi:unfold-more-horizontal"
              height="12"
              class="gp-caret-icon"
            />
          </button>
          <div
            v-if="openMenu === 'push'"
            class="gp-inline-menu-popover"
            @click.stop
          >
            <button
              v-for="r in remotes"
              :key="`push-${r.key}`"
              class="gp-inline-menu-item"
              :class="pushBtnClass(derived.getPushStatus(project.id, r.key))"
              :disabled="!project[r.remoteProp] || derived.isPushing(project.id) || derived.isPulling(project.id) || !derived.needsPushFor(project.id, r.key)"
              :title="`${i18n.push} ${r.label}`"
              @click="ops.pushSingle(project.id, r.key); openMenu = null"
            >
              <span>{{ pushBtnText(derived.getPushStatus(project.id, r.key), r.label) }}</span>
            </button>
          </div>
        </div>

        <!-- 推送全部："推送全部" -->
        <button
          v-if="!derived.isPushing(project.id)"
          class="vp-btn vp-btn--primary vp-btn--sm gp-action-btn"
          :disabled="!hasAnyRemote(project) || derived.isPulling(project.id) || !pushStatus?.needsPush"
          @click="ops.pushToAll(project.id)"
        >
          <span>{{ i18n.pushAll }}</span>
        </button>

        <!-- 取消推送："取消" -->
        <button
          v-else
          class="vp-btn vp-btn--danger vp-btn--sm gp-action-btn"
          @click="ops.cancelPush(project.id)"
        >
          <span>{{ i18n.cancel }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
// gitPush 项目卡片操作栏（拉取/推送/强制推送/Fetch）
import type { GitProject } from "../../types"
import { Icon } from "@iconify/vue"
import { REMOTES } from "../../types"
import { hasAnyRemote } from "../../utils"
import { useCardServices } from "../../composables/useCardServices"
import { useCardMenu } from "../../composables/useCardMenu"

const props = defineProps<{
  project: GitProject
}>()

const { services, pushStatus, fetching, remoteStatusLoading } = useCardServices(() => props.project)
const { shared, derived, ops } = services
const i18n = shared.i18n
const remotes = REMOTES

// 菜单开关（操作栏 pull/push 与顶栏 platform/ide/refresh 共用同一互斥状态）
const { openMenu, toggleMenu } = useCardMenu()

/** 推送按钮状态 class 映射（消除模板中 3 次 getPushStatus 调用） */
function pushBtnClass(status: string | undefined): Record<string, boolean> {
  return {
    'gp-action-btn--ok': status === 'ok',
    'gp-action-btn--fail': status === 'fail',
    'gp-action-btn--active': status === 'pushing',
  }
}

/** 推送按钮文本映射（消除模板中 4 次三元判断） */
function pushBtnText(status: string | undefined, label: string): string {
  if (status === 'pushing') return i18n.pushing
  if (status === 'ok') return i18n.done
  if (status === 'fail') return i18n.failed
  return label
}
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "../../styles/CardActionBar.scss";
</style>
