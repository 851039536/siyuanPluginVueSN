<!-- gitPush 项目卡片子组件 -->
<template>
  <div class="gp-card" @click.capture="handleCardClick">
    <!-- 卡片顶栏：项目信息（左）+ 操作按钮（右） -->
    <div class="gp-card-top">
      <div class="gp-card-info">
        <div class="gp-card-name-row">
          <!-- 收藏星标（悬停提示："取消收藏"/"收藏置顶"） -->
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
            v-if="editingName"
            v-model="nameInput"
            class="gp-card-name-input"
            @blur="saveNameEdit"
            @keyup.enter="($event.target as HTMLInputElement).blur()"
            @keyup.escape="cancelNameEdit"
            @click.stop
          />
          <!-- 项目名（悬停提示："点击修改名称"，含搜索命中高亮分段） -->
          <span
            v-else
            class="gp-card-name"
            :title="i18n.clickToRename"
            @click.stop="startNameEdit"
          ><template
            v-for="(seg, i) in nameSegments"
            :key="i"
          ><span
            v-if="seg.hit"
            class="gp-hl"
          >{{ seg.text }}</span><template v-else>{{ seg.text }}</template></template></span>
          <!-- 归档角标："归档"（悬停："已归档"） -->
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
        <!-- 项目路径行：路径 + 多设备路径角标（"已配置 {0} 个设备路径"）+ 活跃度（悬停："长时间未活动，建议归档"） -->
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
            <!-- 相对活动时间："刚刚 / N分钟前 / N天前…" -->
            {{ relativeTime(project.lastActivity, i18n) }}
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
            :i18n="i18n"
            @select="$emit('openMarkdownPreview', project, f.name)"
          />
        </div>
        <!-- 分支标签（悬停："当前分支"/"切换到 {0}"） -->
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
      <!-- 操作按钮区：分类选择/平台链接/IDE/刷新/编辑/Git配置/删除 -->
      <div class="gp-card-actions">
        <!-- 分类下拉（悬停提示："移动分类"） -->
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
        <!-- 平台链接按钮（悬停："打开 {0}（右键复制链接）"） -->
        <template
          v-for="pm in platformMeta"
          :key="pm.key"
        >
          <button
            v-if="projectUrl(pm.urlProp)"
            class="vp-btn vp-btn--ghost vp-btn--sm"
            :title="i18n.openPlatformHint.replace('{0}', pm.label)"
            @click="openRepoWebUrl(projectUrl(pm.urlProp)!)"
            @contextmenu.prevent="handleCopyUrl(projectUrl(pm.urlProp)!)"
          >
            <Icon
              :icon="pm.icon"
              height="12"
            />
          </button>
        </template>
        <!-- IDE 打开菜单（本地开关，与拉取/推送菜单同模式） -->
        <div class="gp-ide-wrap gp-menu-wrap">
          <!-- 悬停提示："打开项目" -->
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm"
            :title="i18n.openProject"
            @click.stop="toggleMenu('ide')"
          >
            <Icon
              icon="mdi:folder-open"
              height="12"
            />
            <Icon
              icon="mdi:unfold-more-horizontal"
              height="12"
              class="gp-caret-icon"
            />
          </button>
          <div
            v-if="openMenu === 'ide'"
            class="gp-ide-popover"
            @click.stop
          >
            <!-- 菜单项："打开文件夹" -->
            <button
              class="gp-ide-item"
              @click="openLocalPath(projectPath()); openMenu = null"
            >
              <Icon
                icon="mdi:folder-open"
                height="12"
              />
              <span>{{ i18n.openFolder }}</span>
            </button>
            <div class="gp-ide-divider" />
            <!-- 空态项："未检测到 IDE" -->
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
              @click="$emit('openIde', projectPath(), ide); openMenu = null"
            >
              <Icon
                :icon="ide.icon"
                height="12"
              />
              <span>{{ ide.name }}</span>
            </button>
            <button
              v-for="custom in uniqueCustomIdes"
              :key="`custom-${custom.name}`"
              class="gp-ide-item gp-ide-item--custom"
              :title="custom.paths.join('\n')"
              @click="$emit('openCustomIde', projectPath(), custom.name); openMenu = null"
            >
              <Icon
                icon="mdi:application-brackets"
                height="12"
              />
              <span>{{ custom.name }}</span>
              <template v-if="confirmingDelName === custom.name">
                <!-- 二次确认："确认删除?" -->
                <span class="gp-ide-del-confirm">{{ i18n.confirmDeleteShort }}</span>
                <button
                  class="gp-ide-del-yes"
                  @click.stop="$emit('removeCustomIde', custom.name); confirmingDelName = ''"
                >
                  {{ i18n.yes }}
                </button>
                <button
                  class="gp-ide-del-no"
                  @click.stop="confirmingDelName = ''"
                >
                  {{ i18n.no }}
                </button>
              </template>
              <button
                v-else
                class="gp-ide-item-del"
                :title="i18n.deleteCustomIde"
                @click.stop="confirmingDelName = custom.name"
              >
                <Icon
                  icon="mdi:delete-outline"
                  height="12"
                />
              </button>
            </button>
            <div class="gp-ide-divider" />
            <!-- 菜单项："管理 IDE..." -->
            <button
              class="gp-ide-item gp-ide-item--add"
              @click.stop="$emit('showIdeDialog'); openMenu = null"
            >
              <Icon
                icon="mdi:cog-outline"
                height="12"
              />
              <span>{{ i18n.manageIde }}</span>
            </button>
          </div>
        </div>
        <!-- 刷新选项菜单（本地开关，与拉取/推送菜单同模式） -->
        <div class="gp-refresh-wrap gp-menu-wrap">
          <!-- 悬停提示："刷新选项" -->
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm"
            :title="i18n.refreshOptions"
            @click.stop="toggleMenu('refresh')"
          >
            <Icon
              icon="mdi:refresh"
              height="12"
              :class="{ 'gp-spin': isRefreshing }"
            />
          </button>
          <div
            v-if="openMenu === 'refresh'"
            class="gp-refresh-popover"
            @click.stop
          >
            <!-- 菜单项："刷新工作空间" -->
            <button class="gp-refresh-item" @click="$emit('refreshWorkingTree', project.id); openMenu = null">
              <Icon icon="mdi:file-tree" height="12" />
              <span>{{ i18n.refreshWorkingTree }}</span>
            </button>
            <!-- 菜单项："刷新提交日志" -->
            <button class="gp-refresh-item" @click="$emit('refreshCommitLog', project.id); openMenu = null">
              <Icon icon="mdi:history" height="12" />
              <span>{{ i18n.refreshCommitLog }}</span>
            </button>
            <!-- 菜单项："刷新标签" -->
            <button class="gp-refresh-item" @click="$emit('refreshTags', project.id); openMenu = null">
              <Icon icon="mdi:tag-outline" height="12" />
              <span>{{ i18n.refreshTags }}</span>
            </button>
            <!-- 菜单项："刷新远程状态" -->
            <button class="gp-refresh-item" @click="$emit('refreshRemoteStatus', project.id); openMenu = null">
              <Icon icon="mdi:cloud-refresh-outline" height="12" />
              <span>{{ i18n.refreshRemoteStatus }}</span>
            </button>
            <div class="gp-refresh-divider" />
            <!-- 菜单项："全部刷新" -->
            <button class="gp-refresh-item gp-refresh-item--all" @click="$emit('refresh', project.id); openMenu = null">
              <Icon icon="mdi:refresh-circle" height="12" />
              <span>{{ i18n.refreshAll }}</span>
            </button>
          </div>
        </div>
        <!-- 悬停提示："编辑项目（标签/备注）" -->
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
        <!-- 悬停提示："查看项目 Git 配置" -->
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
        <!-- 悬停提示："删除"（移除项目） -->
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm gp-btn-danger"
          :title="i18n.delete"
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
        <!-- 未配置占位："未检测到" -->
        <span
          v-else
          class="gp-remote-none"
        >{{ i18n.notDetected }}</span>
        <span
          v-if="pushStatus?.remotes[r.key]"
          class="gp-status-badge"
          :class="statusBadgeClass(project.id, r.key)"
        >
          {{ statusLabel(project.id, r.key) }}
        </span>
      </div>
    </div>

    <!-- 远程冲突警告："远程有新的提交，建议先拉取再推送" -->
    <div
      v-if="hasBehind(project.id)"
      class="gp-conflict-warn"
    >
      <Icon
        icon="mdi:alert-circle-outline"
        height="12"
      />
      <span>{{ i18n.conflictWarn }}</span>
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
        :tree="workingTree"
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
        :i18n="i18n"
        @create="(name: string, message?: string) => $emit('createTag', project.id, name, message)"
        @push="(tag: string) => $emit('pushTag', project.id, tag)"
        @delete="(tag: string) => $emit('deleteTag', project.id, tag)"
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
            <!-- Fetch 项："更新远程状态"（悬停：仅刷新状态不合并代码） -->
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

      <!-- 推送区：区标签"推送" + 单远程菜单 + 推送全部/取消 -->
      <div class="gp-actions-section">
        <span class="gp-actions-label">{{ i18n.push }}</span>
        <div class="gp-actions-btns">
          <!-- 单远程推送（下拉菜单） -->
          <div class="gp-inline-menu-wrap gp-menu-wrap">
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
                :class="pushBtnClass(getPushStatus(project.id, r.key))"
                :disabled="!project[r.remoteProp] || isPushing(project.id) || isPulling(project.id) || !needsPushFor(project.id, r.key)"
                :title="`${i18n.push} ${r.label}`"
                @click="$emit('pushSingle', project.id, r.key); openMenu = null"
              >
                <Icon
                  icon="mdi:arrow-up"
                  height="12"
                />
                <span>{{ pushBtnText(getPushStatus(project.id, r.key), r.label) }}</span>
              </button>
            </div>
          </div>

          <!-- 推送全部："推送全部" -->
          <button
            v-if="!isPushing(project.id)"
            class="vp-btn vp-btn--primary vp-btn--sm gp-action-btn"
            :disabled="!hasAnyRemote(project) || isPulling(project.id) || !pushStatus?.needsPush"
            @click="$emit('pushToAll', project.id)"
          >
            <span>{{ i18n.pushAll }}</span>
          </button>

          <!-- 取消推送："取消" -->
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
} from "../types"
import { activityLevel, hasAnyRemote, highlightSegments, openLocalPath, openRepoWebUrl, relativeTime, resolveValidPath } from "../utils"
import type { MdFileEntry } from "../composables/useMarkdownFiles"
import type { PushOutputEntry } from "../composables/useGitOps"
import { useCardActions } from "../composables/useCardActions"
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
  detectedIdes: { name: string, icon: string, path?: string }[]
  customIdes: { name: string, path: string }[]
  // 编辑状态
  searchQuery?: string
  refreshing: string | null
  fetching: boolean
  remoteStatusLoading?: boolean
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
  fileDiffs: Record<string, string>
  commitLogEntries: CommitLogEntry[]
  // Markdown 文件列表
  mdFiles: MdFileEntry[]
  // 计算辅助函数
  statusBadgeClass: (id: string, key: string) => string
  statusLabel: (id: string, key: string) => string
  hasBehind: (id: string) => boolean
  isPulling: (id: string, key?: string) => boolean
  isPushing: (id: string) => boolean
  needsPushFor: (id: string, key: string) => boolean
  getPushStatus: (id: string, key: string) => string | undefined
}>()

// ── Events ──
const emit = defineEmits<{
  "toggleStar": [id: string]
  "switchBranch": [id: string, name: string]
  "remove": [project: GitProject]
  "openEditDialog": [project: GitProject]
  "moveProject": [id: string, categoryId: string]
  // IDE
  "openIde": [path: string, ide: { name: string, path?: string }]
  "openCustomIde": [path: string, name: string]
  "showIdeDialog": []
  "removeCustomIde": [name: string]
  // 工作区
  "refresh": [id: string]
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
  "reloadCommitLog": [id: string, count: number]
  // Stash
  "stashConfirmMsg": [id: string, msg: string]
  "genStashDesc": [id: string]
  "stashPop": [id: string, idx: number]
  "stashApply": [id: string, idx: number]
  "stashDrop": [id: string, idx: number]
  // Tag
  "createTag": [id: string, name: string, message?: string]
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

// ── 卡片本地动作（行内改名 / IDE 删除确认 / 复制链接，服务经 CardServices 注入）──
const {
  editingName,
  nameInput,
  startNameEdit,
  cancelNameEdit,
  saveNameEdit,
  confirmingDelName,
  handleCopyUrl,
} = useCardActions({ project: () => props.project, i18n: props.i18n })

/** 当前项目有效路径（多设备路径解析，点击时实时检测磁盘存在性，不用 computed 缓存） */
function projectPath(): string {
  return resolveValidPath(props.project)
}

/** 读取项目在指定平台的仓库 URL（模板动态属性访问辅助） */
function projectUrl(prop: typeof PLATFORM_META[number]["urlProp"]): string | undefined {
  return props.project[prop]
}

/** 自定义 IDE 按名称去重（同名多条 = 多台电脑的候选路径，菜单只展示一项，tooltip 列出全部路径） */
const uniqueCustomIdes = computed(() => {
  const map = new Map<string, string[]>()
  for (const c of props.customIdes) {
    const paths = map.get(c.name)
    if (paths) paths.push(c.path)
    else map.set(c.name, [c.path])
  }
  return [...map.entries()].map(([name, paths]) => ({ name, paths }))
})

/** Stash / Tag 面板 Tab 切换 */
const stashTagTab = ref<"worktree" | "log" | "stash" | "tag">("worktree")

// 切换回 worktree 时自动刷新工作区；切到 log/stash/tag 时懒加载次要数据
watch(stashTagTab, (val) => {
  if (val === "worktree") {
    emit("refreshWorkingTree", props.project.id)
  } else {
    emit("expand", props.project.id)
  }
})

/** 点击卡片任意位置时加载当前项目数据（仅首次触发） */
let cardDataLoaded = false
function handleCardClick() {
  if (cardDataLoaded) return
  cardDataLoaded = true
  emit("refreshWorkingTree", props.project.id)
  emit("expand", props.project.id)
}

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
  if (status === 'pushing') return props.i18n.pushing
  if (status === 'ok') return props.i18n.done
  if (status === 'fail') return props.i18n.failed
  return label
}

/** 拉取/推送输出面板列表 */
const outputPanels = computed(() => [
  { key: 'pull', entries: props.pullOutputs },
  { key: 'push', entries: props.pushOutputs },
])

/** 仅"全部刷新"时转动下拉菜单按钮 */
const isRefreshing = computed(() => props.refreshing === props.project.id)

/** 卡片内下拉菜单开关（拉取/推送/IDE/刷新，同时只允许一个展开） */
type CardMenu = "pull" | "push" | "ide" | "refresh"
const openMenu = ref<CardMenu | null>(null)

/** 切换内联下拉菜单（再次点击同一菜单则关闭） */
function toggleMenu(name: CardMenu) {
  openMenu.value = openMenu.value === name ? null : name
}

/** 点击卡片外部时关闭内联下拉菜单（.gp-menu-wrap 覆盖四类菜单容器） */
function closeMenuOnOutside(e: MouseEvent) {
  const target = e.target as HTMLElement | null
  if (target && !target.closest(".gp-menu-wrap")) {
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
