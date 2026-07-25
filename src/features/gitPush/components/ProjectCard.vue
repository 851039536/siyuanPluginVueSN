<!-- gitPush 项目卡片子组件 -->
<template>
  <div class="gp-card">
    <div class="gp-card-top">
      <div class="gp-card-info">
        <div class="gp-card-name-row">
          <!-- 收藏星标 -->
          <button
            class="gp-star-btn"
            :class="{ active: project.starred }"
            :title="project.starred ? i18n.unstar : i18n.starPin"
            @click.stop="$emit('toggleStar', project.id)"
          >
            <Icon
              :icon="project.starred ? 'mdi:star' : 'mdi:star-outline'"
              height="12"
            />
          </button>
          <input
            v-if="editingNameId === project.id"
            :value="editingNameInput"
            class="gp-card-name-input"
            @input="$emit('update:editingNameInput', ($event.target as HTMLInputElement).value)"
            @blur="$emit('nameEditSave', project)"
            @keyup.enter="($event.target as HTMLInputElement).blur()"
            @keyup.escape="$emit('update:editingNameId', '')"
            @click.stop
          />
          <span
            v-else
            class="gp-card-name"
            :title="i18n.clickToRename"
            @click.stop="$emit('startNameEdit', project)"
          ><template
            v-for="(seg, i) in nameSegments"
            :key="i"
          ><span
            v-if="seg.hit"
            class="gp-hl"
          >{{ seg.text }}</span><template v-else>{{ seg.text }}</template></template></span>
          <!-- 状态徽章 -->
          <button
            class="gp-project-status-btn"
            :class="`gp-psb-${project.status || 'active'}`"
            :title="i18n.statusTitle.replace('{0}', statusMeta[project.status || 'active'].label)"
            @click.stop="$emit('cycleStatus', project.id, project.status)"
          >
            <Icon
              :icon="statusMeta[project.status || 'active'].icon"
              height="12"
            />
          </button>
          <span
            v-if="project.archived"
            class="gp-archived-tag"
            :title="i18n.archivedTitle"
          >
            <Icon
              icon="mdi:archive-outline"
              height="12"
            />{{ i18n.archivedShort }}
          </span>
        </div>
        <div
          class="gp-card-path"
          :title="project.path"
        >
          <Icon
            icon="mdi:folder-outline"
            height="11"
            class="gp-path-icon"
          />
          <span class="gp-path-text">{{ project.path }}</span>
          <span
            v-if="project.localPaths?.length"
            class="gp-multi-path-badge"
            :title="i18n.devicePathsCount.replace('{0}', String(project.localPaths.length + 1))"
          >+{{ project.localPaths.length }}{{ i18n.pathsSuffix }}</span>
          <span
            v-if="project.lastActivity"
            class="gp-activity"
            :class="`gp-act-${activityLevel(project.lastActivity)}`"
            :title="activityLevel(project.lastActivity) === 'dead' ? i18n.inactiveHint : ''"
          >
            <Icon
              icon="mdi:clock-outline"
              height="12"
            />
            {{ relativeTime(project.lastActivity) }}
          </span>
        </div>
        <!-- Markdown 文件标识 -->
        <div
          v-if="mdFiles.length"
          class="gp-md-files"
        >
          <MarkdownFileBadge
            v-for="f in mdFiles"
            :key="f.name"
            :filename="f.name"
            :label="f.label"
            :variant="f.variant"
            @select="$emit('openMarkdownPreview', project, f.name)"
          />
        </div>
        <!-- 分支标签 -->
        <div
          v-if="branches?.length"
          class="gp-branch-row"
        >
          <Icon
            icon="mdi:source-branch"
            height="12"
          />
          <button
            v-for="b in branches"
            :key="b.name"
            class="gp-branch-tag"
            :class="{ current: b.current }"
            :title="b.current ? i18n.currentBranch : i18n.switchToBranch.replace('{0}', b.name)"
            @click="$emit('switchBranch', project.id, b.name)"
          >
            {{ b.name }}
            <Icon
              v-if="b.current"
              icon="mdi:check"
              height="12"
            />
          </button>
        </div>
        <!-- 备注 -->
        <div
          v-if="project.note"
          class="gp-card-note"
          :title="project.note"
        >
          <Icon
            icon="mdi:note-text-outline"
            height="12"
          />
          <span>{{ project.note }}</span>
        </div>
      </div>
      <div class="gp-card-actions">
        <select
          class="gp-cat-select"
          :value="project.categoryId"
          :title="i18n.moveCategory"
          @change.stop="$emit('moveProject', project.id, ($event.target as HTMLSelectElement).value)"
        >
          <option
            v-for="cat in categories"
            :key="cat.id"
            :value="cat.id"
            :selected="cat.id === project.categoryId"
          >
            {{ cat.name }}
          </option>
        </select>
        <template
          v-for="pm in platformMeta"
          :key="pm.key"
        >
          <button
            v-if="getProjectUrl(project, pm.urlProp)"
            class="vp-btn vp-btn--ghost vp-btn--sm"
            :title="i18n.openPlatformHint.replace('{0}', pm.label)"
            @click="$emit('openWeb', getProjectUrl(project, pm.urlProp)!)"
            @contextmenu.prevent="$emit('copyUrl', getProjectUrl(project, pm.urlProp)!)"
          >
            <Icon
              :icon="pm.icon"
              height="12"
            />
          </button>
        </template>
        <div class="gp-ide-wrap">
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm"
            :title="i18n.openProject"
            @click.stop="$emit('toggleIdeMenu', project.id)"
          >
            <Icon
              icon="mdi:folder-open"
              height="12"
            />
            <Icon
              icon="mdi:unfold-more-horizontal"
              height="12"
              style="margin-left:1px;opacity:0.5"
            />
          </button>
          <div
            v-if="openIdeMenu.has(project.id)"
            class="gp-ide-popover"
            @click.stop
          >
            <button
              class="gp-ide-item"
              @click="$emit('openPath', resolvedPath(project)); openIdeMenu.delete(project.id)"
            >
              <Icon
                icon="mdi:folder-open"
                height="12"
              />
              <span>{{ i18n.openFolder }}</span>
            </button>
            <div class="gp-ide-divider" />
            <button
              v-if="detectedIdes.length === 0 && customIdes.length === 0"
              class="gp-ide-item gp-ide-item--none"
              disabled
            >
              <Icon
                icon="mdi:information-outline"
                height="12"
              />
              <span>{{ i18n.noIdeDetected }}</span>
            </button>
            <button
              v-for="ide in detectedIdes"
              :key="`detected-${ide.name}`"
              class="gp-ide-item"
              @click="$emit('openIde', resolvedPath(project), ide); openIdeMenu.delete(project.id)"
            >
              <Icon
                :icon="ide.icon"
                height="12"
              />
              <span>{{ ide.name }}</span>
            </button>
            <button
              v-for="(custom, idx) in customIdes"
              :key="`custom-${idx}`"
              class="gp-ide-item gp-ide-item--custom"
              @click="$emit('openCustomIde', resolvedPath(project), custom.name, custom.path); openIdeMenu.delete(project.id)"
            >
              <Icon
                icon="mdi:application-brackets"
                height="12"
              />
              <span>{{ custom.name }}</span>
              <template v-if="confirmingDelIdx === idx">
                <span class="gp-ide-del-confirm">{{ i18n.confirmDeleteShort }}</span>
                <button
                  class="gp-ide-del-yes"
                  @click.stop="$emit('doRemoveCustomIde', idx)"
                >
                  {{ i18n.yes }}
                </button>
                <button
                  class="gp-ide-del-no"
                  @click.stop="$emit('update:confirmingDelIdx', -1)"
                >
                  {{ i18n.no }}
                </button>
              </template>
              <button
                v-else
                class="gp-ide-item-del"
                :title="i18n.deleteCustomIde"
                @click.stop="$emit('update:confirmingDelIdx', idx)"
              >
                <Icon
                  icon="mdi:delete-outline"
                  height="12"
                />
              </button>
            </button>
            <div class="gp-ide-divider" />
            <button
              class="gp-ide-item gp-ide-item--add"
              @click.stop="$emit('showIdeDialog'); openIdeMenu.delete(project.id)"
            >
              <Icon
                icon="mdi:cog-outline"
                height="12"
              />
              <span>{{ i18n.manageIde }}</span>
            </button>
          </div>
        </div>
        <div class="gp-refresh-wrap">
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm"
            :title="i18n.refreshOptions"
            @click.stop="$emit('toggleRefreshMenu', project.id)"
          >
            <Icon
              icon="mdi:refresh"
              height="12"
              :class="{ 'gp-spin': isRefreshing }"
            />
          </button>
          <div
            v-if="openRefreshMenu.has(project.id)"
            class="gp-refresh-popover"
            @click.stop
          >
            <button class="gp-refresh-item" @click="$emit('refreshWorkingTree', project.id); openRefreshMenu.delete(project.id)">
              <Icon icon="mdi:file-tree" height="12" />
              <span>{{ i18n.refreshWorkingTree }}</span>
            </button>
            <button class="gp-refresh-item" @click="$emit('refreshCommitLog', project.id); openRefreshMenu.delete(project.id)">
              <Icon icon="mdi:history" height="12" />
              <span>{{ i18n.refreshCommitLog  }}</span>
            </button>
            <button class="gp-refresh-item" @click="$emit('refreshTags', project.id); openRefreshMenu.delete(project.id)">
              <Icon icon="mdi:tag-outline" height="12" />
              <span>{{ i18n.refreshTags}}</span>
            </button>
            <button class="gp-refresh-item" @click="$emit('refreshRemoteStatus', project.id); openRefreshMenu.delete(project.id)">
              <Icon icon="mdi:cloud-refresh-outline" height="12" />
              <span>{{ i18n.refreshRemoteStatus }}</span>
            </button>
            <div class="gp-refresh-divider" />
            <button class="gp-refresh-item gp-refresh-item--all" @click="$emit('refresh', project.id); openRefreshMenu.delete(project.id)">
              <Icon icon="mdi:refresh-circle" height="12" />
              <span>{{ i18n.refreshAll }}</span>
            </button>
          </div>
        </div>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          :title="i18n.editProjectBtn"
          @click="$emit('openEditDialog', project)"
        >
          <Icon
            icon="mdi:pencil-outline"
            height="12"
          />
        </button>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          :title="i18n.viewProjectGitConfig"
          @click="$emit('openProjectGitConfig', project.id)"
        >
          <Icon
            icon="mdi:file-document-outline"
            height="12"
          />
        </button>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm gp-btn-danger"
          @click="$emit('remove', project)"
        >
          <Icon
            icon="mdi:delete-outline"
            height="12"
          />
        </button>
      </div>
    </div>

    <!-- 远程仓库状态 -->
    <div class="gp-remotes">
      <span class="gp-remotes-label">REMOTES</span>
      <button
        class="vp-btn vp-btn--ghost vp-btn--sm gp-section-refresh"
        :disabled="remoteStatusLoading"
        :title="i18n.refreshRemoteStatus"
        @click.stop="$emit('refreshRemoteStatus', project.id)"
      >
        <Icon icon="mdi:refresh" height="12" :class="{ 'gp-spin': remoteStatusLoading }" />
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
        <span
          v-else
          class="gp-remote-none"
        >{{ i18n.notDetected}}</span>
        <span
          v-if="pushStatus?.remotes[r.key]"
          class="gp-status-badge"
          :class="statusBadgeClass(project.id, r.key)"
        >
          {{ statusLabel(project.id, r.key) }}
        </span>
      </div>
    </div>

    <!-- 远程冲突警告 -->
    <div
      v-if="hasBehind(project.id)"
      class="gp-conflict-warn"
    >
      <Icon
        icon="mdi:alert-circle-outline"
        height="12"
      />
      <span>{{ i18n.conflictWarn}}</span>
    </div>

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
            v-if="commitLogEntries?.length"
            class="gp-stash-tag-tab-count"
          >{{ commitLogEntries.length }}</span>
        </button>
        <button
          class="gp-stash-tag-tab"
          :class="{ active: stashTagTab === 'stash' }"
          @click="stashTagTab = 'stash'"
        >
          STASH
          <span
            v-if="stashEntries?.length"
            class="gp-stash-tag-tab-count"
          >{{ stashEntries.length }}</span>
        </button>
        <button
          class="gp-stash-tag-tab"
          :class="{ active: stashTagTab === 'tag' }"
          @click="stashTagTab = 'tag'"
        >
          TAG
          <span
            v-if="tagsCache?.length"
            class="gp-stash-tag-tab-count"
          >{{ tagsCache.length }}</span>
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
        :commit-templates="commitTemplates"
        @stage-file="(file: string) => $emit('stageFile', project.id, file)"
        @unstage-file="(file: string) => $emit('unstageFile', project.id, file)"
        @stage-all="$emit('stageAll', project.id)"
        @unstage-all="$emit('unstageAll', project.id)"
        @commit="(msg: string) => $emit('commit', project.id, msg)"
        @generate-msg="$emit('generateMsg', project.id)"
        @load-diff="(file: string, staged: boolean) => $emit('loadDiff', project.id, file, staged)"
        @clear-output="$emit('clearOutput', project.id)"
        @discard-file="(file: string, staged: boolean, status: string) => $emit('discardFile', project.id, file, staged, status)"
        @expand="$emit('expand', project.id)"
        @refresh-working-tree="$emit('refreshWorkingTree', project.id)"
      />

      <!-- 提交日志 -->
      <BranchCommitList
        v-if="stashTagTab === 'log'"
        :entries="commitLogEntries"
        :loading="commitLogLoading"
        @reload-commit-log="(count: number) => $emit('reloadCommitLog', project.id, count)"
        @refresh-commit-log="$emit('refreshCommitLog', project.id)"
      />

      <!-- Stash -->
      <StashSection
        v-if="stashTagTab === 'stash'"
        :entries="stashEntries"
        :loading="stashLoading || false"
        :has-changes="!!workingTree?.hasChanges"
        :gen-desc-loading="genStashDescLoading || false"
        :generated-msg="generatedStashMsg"
        :i18n="i18n"
        @stash-confirm="(msg: string) => $emit('stashConfirmMsg', project.id, msg)"
        @gen-stash-desc="$emit('genStashDesc', project.id)"
        @stash-pop="(idx: number) => $emit('stashPop', project.id, idx)"
        @stash-apply="(idx: number) => $emit('stashApply', project.id, idx)"
        @stash-drop="(idx: number) => $emit('stashDrop', project.id, idx)"
      />

      <!-- Tag -->
      <TagPanel
        v-if="stashTagTab === 'tag'"
        :tags="tagsCache || []"
        :loading="tagLoading"
        :push-loaded="tagPushLoading"
        :remotes="platformMeta.filter(pm => project[pm.remoteProp]).map(pm => ({
          key: pm.key,
          icon: pm.icon,
        }))"
        :i18n="i18n"
        @create="(p: { name: string, message: string }) => $emit('createTag', project.id, p.name, p.message)"
        @push="(p: { tag: string }) => $emit('pushTag', project.id, p.tag)"
        @delete="(p: { tag: string }) => $emit('deleteTag', project.id, p.tag)"
        @refresh="$emit('refreshTags', project.id)"
      />
    </div>

    <!-- 冲突警告 -->
    <ConflictSection
      :conflicts="conflicts"
      :i18n="i18n"
      @resolve-conflict="(file: string, strategy: string) => $emit('resolveConflict', project.id, file, strategy)"
      @abort-merge="$emit('abortMerge', project.id)"
    />

    <!-- 操作栏：拉取 / 推送 -->
    <div class="gp-actions-bar">
      <!-- 拉取区（下拉菜单） -->
      <div class="gp-actions-section">
        <span class="gp-actions-label">{{ i18n.pull }}</span>
        <Icon
          icon="mdi:information-outline"
          height="12"
          class="gp-actions-hint-icon"
          :title="i18n.pullVsFetchHint"
        />
        <div class="gp-inline-menu-wrap">
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm gp-action-btn"
            :class="{ 'gp-action-btn--active': isPulling(project.id) || fetching }"
            :disabled="!hasAnyRemote(project) || isPulling(project.id) || isPushing(project.id)"
            :title="i18n.pull"
            @click.stop="toggleMenu('pull')"
          >
            <Icon
              icon="mdi:arrow-down"
              height="12"
              :class="{ 'gp-spin': isPulling(project.id) || fetching }"
            />
            <span>{{ i18n.pull }}</span>
            <Icon
              icon="mdi:unfold-more-horizontal"
              height="12"
              style="margin-left:1px;opacity:0.5"
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
              :class="{ 'gp-inline-menu-item--active': isPulling(project.id, r.key) }"
              :disabled="!project[r.remoteProp] || isPulling(project.id) || isPushing(project.id)"
              :title="`${i18n.pull} ${r.label} — ${i18n.pullBtnHint}`"
              @click="$emit('confirmPull', project.id, r.key); openMenu = null"
            >
              <Icon
                icon="mdi:arrow-down"
                height="12"
              />
              <span>{{ r.label }}</span>
            </button>
            <div class="gp-inline-menu-divider" />
            <!-- Fetch 项 -->
            <button
              class="gp-inline-menu-item gp-inline-menu-item--muted"
              :class="{ 'gp-inline-menu-item--active': fetching }"
              :disabled="!hasAnyRemote(project) || isPulling(project.id) || isPushing(project.id) || fetching"
              :title="i18n.fetchHint"
              @click="$emit('fetchAll', project.id); openMenu = null"
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

      <!-- 推送区 -->
      <div class="gp-actions-section">
        <span class="gp-actions-label">{{ i18n.push }}</span>
        <div class="gp-actions-btns">
          <!-- 单远程推送（下拉菜单） -->
          <div class="gp-inline-menu-wrap">
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm gp-action-btn"
              :class="{ 'gp-action-btn--active': isPushing(project.id) }"
              :disabled="!hasAnyRemote(project) || isPushing(project.id) || isPulling(project.id)"
              :title="i18n.push"
              @click.stop="toggleMenu('push')"
            >
              <Icon
                icon="mdi:arrow-up"
                height="12"
                :class="{ 'gp-spin': isPushing(project.id) }"
              />
              <span>{{ i18n.push }}</span>
              <Icon
                icon="mdi:unfold-more-horizontal"
                height="12"
                style="margin-left:1px;opacity:0.5"
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
                :class="pushBtnClass(getPushStatus(project.id, r.key))"
                :disabled="!project[r.remoteProp] || isPushing(project.id) || isPulling(project.id) || !needsPushFor(project.id, r.key)"
                :title="`${i18n.push} ${r.label}`"
                @click="$emit('pushSingle', project.id, r.key); openMenu = null"
              >
                <Icon
                  icon="mdi:arrow-up"
                  height="12"
                />
                <span>{{ pushBtnText(getPushStatus(project.id, r.key), r.label, i18n) }}</span>
              </button>
            </div>
          </div>

          <!-- 推送全部 -->
          <button
            v-if="!isPushing(project.id)"
            class="vp-btn vp-btn--primary vp-btn--sm gp-action-btn"
            :disabled="!hasAnyRemote(project) || isPulling(project.id) || !pushStatus?.needsPush"
            @click="$emit('pushToAll', project.id)"
          >
            <span>{{ i18n.pushAll }}</span>
          </button>

          <!-- 取消推送 -->
          <button
            v-else
            class="vp-btn vp-btn--danger vp-btn--sm gp-action-btn"
            @click="$emit('cancelPush', project.id)"
          >
            <span>{{ i18n.cancel }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- 拉取/推送输出 -->
    <OutputPanel
      v-for="panel in outputPanels"
      :key="panel.key"
      :entries="panel.entries"
    />
  </div>
</template>

<script setup lang="ts">
import type {
  BranchInfo,
  CommitLogEntry,
  ConflictFile,
  GitProject,
  PlatformKey,
  ProjectCategory,
  ProjectStatus,
  PushStatusInfo,
  StashEntry,
  TagInfo,
  WorkingTreeInfo,
} from "../types"
import { Icon } from "@iconify/vue"
import { computed, onBeforeUnmount, ref, watch } from "vue"
import {
  PLATFORM_META,
  REMOTES,
  STATUS_META,
} from "../types"
import { highlightSegments } from "../utils"
import type { MdFileEntry } from "../composables/useMarkdownFiles"
import type { PushOutputEntry } from "../composables/useGitOps"
import BranchCommitList from "./BranchCommitList.vue"
import ConflictSection from "./ConflictSection.vue"
import MarkdownFileBadge from "./MarkdownFileBadge.vue"
import OutputPanel from "./OutputPanel.vue"
import StashSection from "./StashSection.vue"
import TagPanel from "./TagPanel.vue"
import WorkingTreePanel from "./WorkingTreePanel.vue"

// ── Props: 基础 ──
const props = defineProps<{
  project: GitProject
  i18n: Record<string, any>
  // 共享数据
  categories: ProjectCategory[]
  platformMeta: typeof PLATFORM_META
  remotes: typeof REMOTES
  statusMeta: typeof STATUS_META
  detectedIdes: { name: string, icon: string, path?: string }[]
  customIdes: { name: string, path: string }[]
  // 编辑状态
  editingNameId: string
  editingNameInput: string
  searchQuery?: string
  refreshing: string | null
  fetching: boolean
  openIdeMenu: Set<string>
  workingTreeLoading?: boolean
  /** 工作区面板展开状态（按 projectId 持久化） */
  workingTreeExpanded?: boolean
  remoteStatusLoading?: boolean
  openRefreshMenu: Set<string>
  confirmingDelIdx: number
  // 每项目响应式数据（单项目值，非全量 Record，避免跨卡片 re-render）
  branches: BranchInfo[]
  pushStatus: PushStatusInfo
  workingTree: WorkingTreeInfo
  stashEntries: StashEntry[]
  stashLoading: boolean
  conflicts: ConflictFile[]
  commitOutput: string
  pullOutputs: PushOutputEntry[]
  pushOutputs: PushOutputEntry[]
  committing: boolean
  generatingMsg: { generating: boolean, text: string }
  gitOpLoading: boolean
  commitLogLoading: boolean
  tagsCache: TagInfo[]
  tagLoading: boolean
  tagPushLoading: string
  genStashDescLoading: boolean
  generatedStashMsg: string
  commitTemplates: { id: string, name: string, pattern: string, builtin?: boolean }[]
  selectedTags: Set<string>
  fileDiffs: Record<string, string>
  commitLogEntries: CommitLogEntry[]
  // Markdown 文件列表
  mdFiles: MdFileEntry[]
  // 计算辅助函数
  getProjectUrl: (project: GitProject, prop: string) => string | undefined
  resolvedPath: (project: GitProject) => string
  relativeTime: (date: string) => string
  activityLevel: (date: string) => string
  statusBadgeClass: (id: string, key: string) => string
  statusLabel: (id: string, key: string) => string
  hasBehind: (id: string) => boolean
  hasAnyRemote: (project: GitProject) => boolean
  isPulling: (id: string, key?: string) => boolean
  isPushing: (id: string) => boolean
  needsPushFor: (id: string, key: string) => boolean
  getPushStatus: (id: string, key: string) => string | undefined
}>()

// ── Events ──
const emit = defineEmits<{
  "toggleStar": [id: string]
  "cycleStatus": [id: string, status: ProjectStatus | undefined]
  "startNameEdit": [project: GitProject]
  "nameEditSave": [project: GitProject]
  "toggleTagFilter": [tag: string]
  "switchBranch": [id: string, name: string]
  "remove": [project: GitProject]
  "openEditDialog": [project: GitProject]
  "moveProject": [id: string, categoryId: string]
  // URL & IDE
  "openWeb": [url: string]
  "copyUrl": [url: string]
  "openPath": [path: string]
  "openIde": [path: string, ide: { name: string, path?: string }]
  "openCustomIde": [path: string, name: string, idePath: string]
  "toggleIdeMenu": [id: string]
  "showIdeDialog": []
  "doRemoveCustomIde": [idx: number]
  // 编辑状态
  "update:editingNameId": [id: string]
  "update:editingNameInput": [value: string]
  "update:confirmingDelIdx": [idx: number]
  // 工作区
  "refresh": [id: string]
  "toggleRefreshMenu": [id: string]
  "refreshWorkingTree": [id: string]
  "refreshCommitLog": [id: string]
  "refreshTags": [id: string]
  "refreshRemoteStatus": [id: string]
  "stageFile": [id: string, file: string]
  "unstageFile": [id: string, file: string]
  "stageAll": [id: string]
  "unstageAll": [id: string]
  "commit": [id: string, msg: string]
  "generateMsg": [id: string]
  "loadDiff": [id: string, file: string, staged: boolean]
  "clearOutput": [id: string]
  "discardFile": [id: string, file: string, staged: boolean, status: string]
  "expand": [id: string]
  "update:workingTreeExpanded": [id: string, value: boolean]
  "reloadCommitLog": [id: string, count: number]
  // Stash
  "stashConfirmMsg": [id: string, msg: string]
  "genStashDesc": [id: string]
  "stashPop": [id: string, idx: number]
  "stashApply": [id: string, idx: number]
  "stashDrop": [id: string, idx: number]
  // Tag
  "createTag": [id: string, name: string, message: string]
  "pushTag": [id: string, tag: string]
  "deleteTag": [id: string, tag: string]
  // 冲突
  "resolveConflict": [id: string, file: string, strategy: string]
  "abortMerge": [id: string]
  // 推送/拉取
  "confirmPull": [id: string, key: PlatformKey]
  "pushSingle": [id: string, key: PlatformKey]
  "pushToAll": [id: string]
  "cancelPush": [id: string]
  "fetchAll": [id: string]
  // Markdown 预览
  "openMarkdownPreview": [project: GitProject, fileName: string]
  "openProjectGitConfig": [id: string]
}>()

/** 项目名搜索高亮分段（按当前 searchQuery 切分） */
const nameSegments = computed(() => highlightSegments(props.project.name, props.searchQuery || ""))

/** Stash / Tag 面板 Tab 切换 */
const stashTagTab = ref<"worktree" | "log" | "stash" | "tag">("worktree")

// 从其他 Tab 切换回 worktree 时自动刷新当前项目工作区（跳过初始值）
let tabSwitchInitialized = false
watch(stashTagTab, (val) => {
  if (!tabSwitchInitialized) { tabSwitchInitialized = true; return }
  if (val === "worktree") emit("refreshWorkingTree", props.project.id)
})

/** 推送按钮状态 class 映射（消除模板中 3 次 getPushStatus 调用） */
function pushBtnClass(status: string | undefined): Record<string, boolean> {
  return {
    'gp-action-btn--ok': status === 'ok',
    'gp-action-btn--fail': status === 'fail',
    'gp-action-btn--active': status === 'pushing',
  }
}

/** 推送按钮文本映射（消除模板中 4 次三元判断） */
function pushBtnText(status: string | undefined, label: string, i18n: Record<string, any>): string {
  if (status === 'pushing') return i18n.pushing
  if (status === 'ok') return i18n.done
  if (status === 'fail') return i18n.failed
  return label
}

/** 拉取/推送输出面板列表 */
const outputPanels = computed(() => [
  { key: 'pull', entries: props.pullOutputs },
  { key: 'push', entries: props.pushOutputs },
])

/** 仅"全部刷新"时转动下拉菜单按钮 */
const isRefreshing = computed(() => props.refreshing === props.project.id)

/** 拉取/推送内联下拉菜单开关（同时只允许一个展开） */
const openMenu = ref<"pull" | "push" | null>(null)

/** 切换内联下拉菜单（再次点击同一菜单则关闭） */
function toggleMenu(name: "pull" | "push") {
  openMenu.value = openMenu.value === name ? null : name
}

/** 点击卡片外部时关闭内联下拉菜单 */
function closeMenuOnOutside(e: MouseEvent) {
  const target = e.target as HTMLElement | null
  if (target && !target.closest(".gp-inline-menu-wrap")) {
    openMenu.value = null
  }
}

// 菜单打开时才挂载全局点击监听，关闭时移除，避免多卡片常驻监听
watch(openMenu, (open) => {
  if (open) {
    document.addEventListener("click", closeMenuOnOutside)
  } else {
    document.removeEventListener("click", closeMenuOnOutside)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener("click", closeMenuOnOutside)
})
</script>
