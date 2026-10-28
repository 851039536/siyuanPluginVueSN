<!-- gitPush 项目卡片操作栏（拉取/推送下拉 + 条件强制推送 + 主操作推送全部，数据与操作经 useCardServices 注入） -->
<template>
  <div class="gp-actions-bar">
    <!-- 拉取下拉：按钮即菜单（hint 合并进 tooltip，替代原区标签 + 信息图标组合） -->
    <div class="gp-inline-menu-wrap gp-menu-wrap">
      <Button
        class="gp-action-btn"
        variant="ghost"
        size="xsmall"
        dense
        icon="unfoldMoreHorizontal"
        icon-position="right"
        :class="{ 'gp-action-btn--active': derived.isPulling(project.id) || fetching }"
        :disabled="!hasAnyRemote(project) || derived.isPulling(project.id) || derived.isPushing(project.id)"
        :title="`${i18n.pull} — ${i18n.pullVsFetchHint}`"
        aria-haspopup="menu"
        :aria-expanded="openMenu === 'pull'"
        @click.stop="toggleMenu('pull')"
      >
        {{ i18n.pull }}
      </Button>
      <MenuPopover
        v-if="openMenu === 'pull'"
        class="gp-inline-menu-popover"
        :aria-label="i18n.pull"
      >
        <button
          v-for="r in remotes"
          :key="`pull-${r.key}`"
          class="gp-inline-menu-item"
          role="menuitem"
          :class="{ 'gp-inline-menu-item--active': derived.isPulling(project.id, r.key) }"
          :disabled="!project[r.remoteProp] || derived.isPulling(project.id) || derived.isPushing(project.id)"
          :title="`${i18n.pull} ${r.label} — ${i18n.pullBtnHint}`"
          @click="ops.confirmPullSingle(project.id, r.key); openMenu = null"
        >
          <span>{{ r.label }}</span>
        </button>
        <div
          class="gp-inline-menu-divider"
          role="separator"
        />
        <!-- Fetch 项："更新远程状态"（悬停：仅刷新状态不合并代码） -->
        <button
          class="gp-inline-menu-item gp-inline-menu-item--muted"
          role="menuitem"
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
      </MenuPopover>
    </div>

    <!-- 推送下拉：单远程推送菜单 -->
    <div class="gp-inline-menu-wrap gp-menu-wrap">
      <Button
        class="gp-action-btn"
        variant="ghost"
        size="xsmall"
        dense
        icon="unfoldMoreHorizontal"
        icon-position="right"
        :class="{ 'gp-action-btn--active': derived.isPushing(project.id) }"
        :disabled="!hasAnyRemote(project) || derived.isPushing(project.id) || derived.isPulling(project.id)"
        :title="i18n.push"
        aria-haspopup="menu"
        :aria-expanded="openMenu === 'push'"
        @click.stop="toggleMenu('push')"
      >
        {{ i18n.push }}
      </Button>
      <MenuPopover
        v-if="openMenu === 'push'"
        class="gp-inline-menu-popover"
        :aria-label="i18n.push"
      >
        <button
          v-for="r in remotes"
          :key="`push-${r.key}`"
          class="gp-inline-menu-item"
          role="menuitem"
          :class="pushBtnClass(derived.getPushStatus(project.id, r.key))"
          :disabled="!project[r.remoteProp] || derived.isPushing(project.id) || derived.isPulling(project.id) || !derived.needsPushFor(project.id, r.key)"
          :title="`${i18n.push} ${r.label}`"
          @click="ops.pushSingle(project.id, r.key); openMenu = null"
        >
          <span>{{ pushBtnText(derived.getPushStatus(project.id, r.key), r.label) }}</span>
        </button>
        <!-- Compare / 创建 PR：当前分支已推送或待推送时均可直达比较页（菜单文案："创建 PR / Compare · 平台名"） -->
        <template v-if="compareLinks.length">
          <div
            class="gp-inline-menu-divider"
            role="separator"
          />
          <button
            v-for="c in compareLinks"
            :key="`compare-${c.key}`"
            class="gp-inline-menu-item gp-inline-menu-item--muted"
            role="menuitem"
            :title="i18n.compareHint"
            @click="openCompare(c.url)"
          >
            <Icon
              icon="mdi:source-pull"
              height="12"
            />
            <span>{{ i18n.compareCreatePr }} · {{ c.label }}</span>
          </button>
        </template>
      </MenuPopover>
    </div>

    <!-- 强制推送（--force-with-lease，二次确认）：仅在有待推送变更时出现，避免危险操作常驻 -->
    <Button
      v-if="pushStatus?.needsPush"
      class="gp-action-btn"
      variant="danger"
      size="xsmall"
      dense
      :disabled="!hasAnyRemote(project) || derived.isPushing(project.id) || derived.isPulling(project.id)"
      :title="i18n.forcePushHint"
      @click="ops.handleForcePushToAll(project.id)"
    >
      {{ i18n.forcePush }}
    </Button>

    <!-- 弹性间隔：主操作靠右 -->
    <div class="gp-actions-spacer" />

    <!-- 推送全部（主操作）："推送全部" / 推送中切换为"取消"（与手风琴摘要共用同一按钮组件） -->
    <CardPushAllButton :project="project" />
  </div>
</template>

<script setup lang="ts">
// gitPush 项目卡片操作栏（拉取/推送/强制推送/Fetch）
import type { GitProject } from "../../types"
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import { PLATFORM_META, REMOTES } from "../../types"
import { buildCompareUrl, hasAnyRemote, openRepoWebUrl } from "../../utils"
import { useCardServices } from "../../composables/useCardServices"
import { useCardMenu } from "../../composables/useCardMenu"
import Button from "@/components/Button.vue"
import CardPushAllButton from "./CardPushAllButton.vue"
import MenuPopover from "../common/MenuPopover.vue"

const props = defineProps<{
  project: GitProject
}>()

const { services, pushStatus, fetching } = useCardServices(() => props.project)
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

/**
 * Compare / 创建 PR 深链（每个已配置且受支持的平台一项）。
 * 当前分支未知或等于基线分支时不展示（自己和自己比较没有意义）。
 */
const compareLinks = computed(() => {
  const branch = pushStatus.value?.branch?.trim()
  const base = shared.compareBaseBranch.value.trim()
  if (!branch || branch === base) return []
  return PLATFORM_META.flatMap((pm) => {
    const url = buildCompareUrl(pm.key, props.project[pm.urlProp], base, branch)
    return url ? [{ key: pm.key, label: pm.label, url }] : []
  })
})

/** 在浏览器打开 Compare 页面并关闭菜单 */
function openCompare(url: string) {
  void openRepoWebUrl(url)
  openMenu.value = null
}
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "../../styles/CardActionBar.scss";
</style>
