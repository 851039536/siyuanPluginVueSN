<!-- gitPush 项目卡片编排层（仅 project prop，数据与操作全部经 useCardServices/useCardData 注入） -->
<template>
  <div class="gp-card" @click.capture="handleCardClick">
    <!-- 卡片顶栏：信息区 + 操作按钮区 -->
    <CardHeader
      :project="project"
      :branches="branches"
      :md-files="mdFiles"
      :reload-log="reloadLog"
      :refresh-tags="refreshTags"
    />

    <!-- 远程仓库状态 + 冲突警告 -->
    <CardRemotes :project="project" />

    <!-- 多面板 Tab 切换（工作区 / 提交日志 / Stash / Tag） -->
    <div class="gp-stash-tag-tabs">
      <div class="gp-stash-tag-tab-bar">
        <button
          class="gp-stash-tag-tab"
          :class="{ active: stashTagTab === 'worktree' }"
          @click="stashTagTab = 'worktree'"
        >
          CHANGES
          <span
            v-if="workingTree?.hasChanges"
            class="gp-stash-tag-tab-count"
          >{{ (workingTree?.stagedCount || 0) + (workingTree?.unstagedCount || 0) + (workingTree?.untrackedCount || 0) }}</span>
        </button>
        <button
          class="gp-stash-tag-tab"
          :class="{ active: stashTagTab === 'log' }"
          @click="stashTagTab = 'log'"
        >
          LOG
          <span
            v-if="logEntries.length"
            class="gp-stash-tag-tab-count"
          >{{ logEntries.length }}</span>
        </button>
        <button
          class="gp-stash-tag-tab"
          :class="{ active: stashTagTab === 'stash' }"
          @click="stashTagTab = 'stash'"
        >
          STASH
          <span
            v-if="stashList.length"
            class="gp-stash-tag-tab-count"
          >{{ stashList.length }}</span>
        </button>
        <button
          class="gp-stash-tag-tab"
          :class="{ active: stashTagTab === 'tag' }"
          @click="stashTagTab = 'tag'"
        >
          TAG
          <span
            v-if="tags.length"
            class="gp-stash-tag-tab-count"
          >{{ tags.length }}</span>
        </button>
      </div>

      <!-- 工作区变更 -->
      <WorkingTreePanel
        v-if="stashTagTab === 'worktree'"
        :i18n="i18n"
        :tree="workingTree"
        :committing="committing || false"
        :generating="generatingMsg?.generating || false"
        :commit-output="commitOutput || ''"
        :generated-msg="generatingMsg?.text || ''"
        :file-diffs="fileDiffs"
        :git-op-loading="gitOpLoading || false"
        :refreshing-working-tree="refreshingWorkingTree || false"
        :commit-templates="commitTemplates"
        @stage-file="(file: string) => ops.stageItem(project.id, file)"
        @unstage-file="(file: string) => ops.unstageItem(project.id, file)"
        @stage-all="ops.stageAllItems(project.id)"
        @unstage-all="ops.unstageAllItems(project.id)"
        @commit="(msg: string) => ops.handleCommit(project.id, msg)"
        @generate-msg="ops.handleGenerateMsg(project.id)"
        @load-diff="loadDiff"
        @clear-output="ops.clearOutput(project.id)"
        @discard-file="(file: string, staged: boolean, status: string) => ops.handleDiscard(project.id, file, staged, status)"
        @refresh-working-tree="ops.handleRefreshWorkingTree(project.id)"
      />

      <!-- 提交日志（数据卡内自持，刷新/换条数直调卡内重载） -->
      <BranchCommitList
        v-if="stashTagTab === 'log'"
        :i18n="i18n"
        :entries="logEntries"
        :loading="logLoading"
        @reload-commit-log="(count: number | 'all') => reloadLog(count)"
        @refresh-commit-log="() => reloadLog()"
        @fix-commit="openCommitFix"
      />

      <!-- Stash -->
      <StashSection
        v-if="stashTagTab === 'stash'"
        :entries="stashList"
        :loading="stashLoading || false"
        :tree="workingTree"
        :gen-desc-loading="genStashDescLoading || false"
        :generated-msg="generatedStashMsg"
        :i18n="i18n"
        @stash-confirm="(msg: string) => ops.handleStashConfirmMsg(project.id, msg)"
        @gen-stash-desc="ops.handleGenStashDesc(project.id)"
        @stash-pop="(idx: number) => ops.handleStashPop(project.id, idx)"
        @stash-apply="(idx: number) => ops.handleStashApply(project.id, idx)"
        @stash-drop="(idx: number) => ops.handleStashDrop(project.id, idx)"
      />

      <!-- Tag（列表数据卡内自持，刷新直调卡内重载） -->
      <TagPanel
        v-if="stashTagTab === 'tag'"
        :tags="tags"
        :loading="tagsLoading"
        :push-loaded="tagPushLoading"
        :i18n="i18n"
        @create="(name: string, message?: string) => ops.handleCreateTag(project.id, name, message)"
        @push="(tag: string) => ops.handlePushTag(project.id, tag)"
        @delete="(tag: string) => ops.handleDeleteTag(project.id, tag)"
        @refresh="refreshTags"
      />
    </div>

    <!-- 冲突区（合并冲突的列表 + 解决操作） -->
    <ConflictSection
      :conflicts="conflicts"
      :i18n="i18n"
      @resolve-conflict="(file: string, strategy: 'theirs' | 'ours') => ops.handleResolveConflict(project.id, file, strategy)"
      @abort-merge="ops.handleAbortMerge(project.id)"
    />

    <!-- 操作栏：拉取 / 推送 -->
    <CardActionBar :project="project" />

    <!-- 拉取/推送输出（失败时内置 AI 分析入口） -->
    <OutputPanel
      v-for="panel in outputPanels"
      :key="panel.key"
      :entries="panel.entries"
      :i18n="i18n"
      :project-name="project.name"
      :action="panel.key"
    />

    <!-- 提交信息修正弹窗（LOG Tab 与规则检查共用） -->
    <CommitFixDialog
      v-if="fixingEntry"
      :i18n="i18n"
      :target="fixingEntry"
      @close="fixingEntry = null"
      @saved="handleFixSaved"
    />
  </div>
</template>

<script setup lang="ts">
// gitPush 项目卡片编排层（仅 project prop，区块组件与 Tab 子组件的数据/操作全部下沉注入）
import type {
  CommitFixTarget,
  CommitLogEntry,
  GitProject,
  PushOutputEntry,
} from "../../types"
import { computed, ref, watch } from "vue"
import { checkCommitRule } from "../../commitRuleChecker"
import { useCardData } from "../../composables/useCardData"
import { useCardServices } from "../../composables/useCardServices"
import { provideCardMenu } from "../../composables/useCardMenu"
import BranchCommitList from "./BranchCommitList.vue"
import CardActionBar from "./CardActionBar.vue"
import CardHeader from "./CardHeader.vue"
import CardRemotes from "./CardRemotes.vue"
import CommitFixDialog from "../common/CommitFixDialog.vue"
import ConflictSection from "./ConflictSection.vue"
import OutputPanel from "./OutputPanel.vue"
import StashSection from "./StashSection.vue"
import TagPanel from "./TagPanel.vue"
import WorkingTreePanel from "./WorkingTreePanel.vue"

const props = defineProps<{
  project: GitProject
}>()

// 卡片服务（共享数据 / 响应式 Record 派生 / 派生函数 / 操作集群）
const { services, workingTree, committing, stashLoading, commitOutput, generatingMsg, gitOpLoading, tagPushLoading, genStashDescLoading, generatedStashMsg, refreshingWorkingTree, pullOutputs, pushOutputs } = useCardServices(() => props.project)
const { shared, ops } = services
const i18n = shared.i18n
const commitTemplates = shared.commitTemplates

// 卡片内联下拉菜单（顶栏与操作栏共享互斥状态，行为与拆分前一致）
provideCardMenu()

// ── 卡片自持 Tab 数据（log/branches/stash/tags/冲突/diff/md，经 manager 直取 + 父层信号重载）──
const {
  branches,
  logEntries,
  logLoading,
  stashList,
  tags,
  tagsLoading,
  conflicts,
  fileDiffs,
  mdFiles,
  ensureDetailsLoaded,
  reloadLog,
  refreshTags,
  loadDiff,
} = useCardData(() => props.project)

/** Stash / Tag 面板 Tab 切换 */
const stashTagTab = ref<"worktree" | "log" | "stash" | "tag">("worktree")

/** 当前正在修正的提交条目（null = 未打开修正弹窗） */
const fixingEntry = ref<CommitFixTarget | null>(null)

/** LOG Tab 点击修正按钮：把 CommitLogEntry 转为通用修正目标 */
function openCommitFix(entry: CommitLogEntry) {
  fixingEntry.value = {
    projectId: props.project.id,
    projectName: props.project.name,
    hash: entry.hash,
    message: entry.message,
    reason: checkCommitRule(entry.message) ?? undefined,
  }
}

/** 修正成功后关闭弹窗并刷新 LOG 数据 */
function handleFixSaved() {
  fixingEntry.value = null
  void reloadLog()
}

// 切换回 worktree 时自动刷新工作区（父层数据）；切到 log/stash/tag 时懒加载卡内详情
watch(stashTagTab, (val) => {
  if (val === "worktree") {
    ops.handleRefreshWorkingTree(props.project.id)
  } else {
    void ensureDetailsLoaded()
  }
})

/** 点击卡片任意位置时加载当前项目数据（仅首次触发） */
let cardDataLoaded = false
function handleCardClick() {
  if (cardDataLoaded) return
  cardDataLoaded = true
  ops.handleRefreshWorkingTree(props.project.id)
  void ensureDetailsLoaded()
}

/** 拉取/推送输出面板列表（key 即操作类型，传给 OutputPanel 的 action prop） */
const outputPanels = computed<{ key: 'push' | 'pull', entries: PushOutputEntry[] }[]>(() => [
  { key: 'pull', entries: pullOutputs.value },
  { key: 'push', entries: pushOutputs.value },
])
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "../../styles/index.scss";
</style>
