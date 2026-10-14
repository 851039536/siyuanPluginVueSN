<!-- gitPush 列表视图顶部工具栏（视图模式 + 归档/暂停切换 + 分类TAB） -->
<template>
  <!-- 筛选工具栏（智能视图 + 归档 toggle + 暂停 toggle） -->
  <div
    v-if="projects.length > 0"
    class="gp-filter-bar"
  >
    <!-- 智能视图：一组互斥选项 ⇒ Button 分组 + aria-pressed（不引入面板，故不用 Tabs） -->
    <div class="gp-view-modes">
      <Button
        v-for="vm in VIEW_MODES"
        :key="vm"
        class="gp-vm-btn"
        variant="ghost"
        size="xsmall"
        dense
        :icon="VIEW_MODE_ICONS[vm]"
        :aria-pressed="viewMode === vm"
        :title="i18n[VIEW_MODE_META[vm].labelKey]"
        @click="viewMode = vm"
      >
        <!-- 视图模式标签："全部 / 需推送 / 有变更 / 收藏 / 归档" -->
        {{ i18n[VIEW_MODE_META[vm].labelKey] }}
      </Button>
    </div>
    <div class="gp-filter-toggles">
      <!-- 归档 toggle（归档视图下开关无效，直接隐藏；按下时显示"含归档"） -->
      <ToggleButton
        v-if="viewMode !== 'archived'"
        v-model="showArchived"
        class="gp-ft-btn"
        size="xsmall"
        dense
        on-icon="archiveOutline"
        off-icon="archiveOutline"
        :on-label="i18n.archivedIncluded"
        :aria-label="i18n.toggleArchivedTip"
        :title="i18n.toggleArchivedTip"
      />
      <!-- Git 状态加载暂停 toggle（悬停提示随状态变化，可访问名称固定为"暂停 Git 状态加载"） -->
      <ToggleButton
        v-model="gitOpsPaused"
        class="gp-ft-btn"
        size="xsmall"
        dense
        on-icon="pauseCircle"
        off-icon="pauseCircleOutline"
        :on-label="i18n.gitOpsPausedLabel"
        :aria-label="i18n.gitOpsPauseTip"
        :title="gitOpsPaused ? i18n.gitOpsPausedTip : i18n.gitOpsPauseTip"
      />
    </div>
  </div>

  <!-- 分类 TAB 导航（仅 all 模式显示；宽度不足时用鼠标滚轮横滑） -->
  <div
    v-if="viewMode === 'all' && groupedProjects.length > 0"
    ref="tabsRef"
    class="gp-tabs"
  >
    <Button
      v-for="g in groupedProjects"
      :key="g.category.id"
      class="gp-tab"
      variant="ghost"
      size="xsmall"
      dense
      :aria-pressed="activeCategory === g.category.id"
      :style="activeCategory === g.category.id ? { borderBottomColor: g.category.color } : {}"
      @click="activeCategory = g.category.id"
    >
      <span
        class="gp-tab-dot"
        :style="{ background: g.category.color }"
      />
      <span>{{ g.category.name }}</span>
      <span class="gp-tab-count">{{ g.projects.length }}</span>
    </Button>
  </div>
</template>

<script setup lang="ts">
import type { GitProject, ProjectCategory, ViewMode } from "../../types"
import { VIEW_MODE_META, VIEW_MODES } from "../../types"
import { onBeforeUnmount, ref, watch } from "vue"
import type { IconKey } from "@/components/kit/icons"
import Button from "@/components/Button.vue"
import ToggleButton from "@/components/ToggleButton.vue"

/** 视图模式 → IconKey 投影（共享 Button 的 icon 只接受已注册 IconKey，不接受任意 Iconify 名） */
const VIEW_MODE_ICONS: Record<ViewMode, IconKey> = {
  all: "layoutGrid",
  needsPush: "cloudUpload",
  needsPull: "downloadOutline",
  uncommitted: "sourceBranch",
  starred: "star",
  archived: "archiveOutline",
}

defineProps<{
  i18n: Record<string, any>
  projects: GitProject[]
  groupedProjects: { category: ProjectCategory, projects: GitProject[] }[]
}>()

const viewMode = defineModel<ViewMode>("viewMode", { required: true })
const activeCategory = defineModel<string>("activeCategory", { required: true })
const showArchived = defineModel<boolean>("showArchived", { required: true })
const gitOpsPaused = defineModel<boolean>("gitOpsPaused", { required: true })

/**
 * TAB 栏滚轮横滑。
 * 垂直滚轮（deltaY）转发为横向滚动，使普通鼠标无需按 Shift 即可横向浏览分类；
 * 触控板/Shift+滚轮本身已产生 deltaX，此时不再重复叠加，避免滚动速度翻倍。
 * 仅在容器确实可横向滚动、且该方向仍有剩余行程时 preventDefault，
 * 否则把纵向滚动交还页面，避免"滚到尽头仍被吞掉"的死区。
 */
function onTabsWheel(e: WheelEvent) {
  const el = e.currentTarget as HTMLElement
  if (!el) return

  const maxScroll = el.scrollWidth - el.clientWidth
  // 无横向溢出：完全交给页面纵向滚动
  if (maxScroll <= 0) return

  // 有横向分量时（触控板横滑 / Shift+滚轮）用浏览器默认行为即可
  if (e.deltaX !== 0 && Math.abs(e.deltaX) >= Math.abs(e.deltaY)) return

  const delta = e.deltaY
  if (delta === 0) return

  const atStart = el.scrollLeft <= 0 && delta < 0
  const atEnd = el.scrollLeft >= maxScroll && delta > 0
  // 已到尽头：不拦截，让页面继续滚动（避免滚动被吞）
  if (atStart || atEnd) return

  e.preventDefault()
  // 夹取到有效范围：deltaY 可能很大（鼠标滚轮一格 100+），直接相加会越界
  el.scrollLeft = Math.min(Math.max(el.scrollLeft + delta, 0), maxScroll)
}

const tabsRef = ref<HTMLElement | null>(null)

// 手动注册 wheel 监听：必须以 { passive: false } 注册才能 preventDefault（拦截纵向滚动）。
// 模板上的 @wheel 在部分运行时被当作 passive 处理，届时 preventDefault 会静默失效，
// 表现为"横滑的同时页面也一起纵向滚动"。此处显式声明避免该不确定性。
// TAB 容器为 v-if（随视图模式/分类数量创建销毁），故用 watch 跟随元素挂载变化绑定/解绑。
watch(tabsRef, (el, prevEl) => {
  if (prevEl) prevEl.removeEventListener("wheel", onTabsWheel)
  if (el) el.addEventListener("wheel", onTabsWheel, { passive: false })
})

onBeforeUnmount(() => {
  tabsRef.value?.removeEventListener("wheel", onTabsWheel)
})
</script>

<style lang="scss">
@use "../../styles/ListViewToolbar.scss";
</style>
