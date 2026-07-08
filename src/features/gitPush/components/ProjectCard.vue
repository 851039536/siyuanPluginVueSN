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
            :title="project.starred ? '取消收藏' : '收藏置顶'"
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
            title="点击修改名称"
            @click.stop="$emit('startNameEdit', project)"
          >{{ project.name }}</span>
          <!-- 状态徽章 -->
          <button
            class="gp-project-status-btn"
            :class="`gp-psb-${project.status || 'active'}`"
            :title="`状态: ${statusMeta[project.status || 'active'].label}（点击切换）`"
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
            title="已归档"
          >
            <Icon
              icon="mdi:archive-outline"
              height="12"
            />归档
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
            :title="`已配置 ${project.localPaths.length + 1} 个设备路径`"
          >+{{ project.localPaths.length }}路径</span>
          <span
            v-if="project.lastActivity"
            class="gp-activity"
            :class="`gp-act-${activityLevel(project.lastActivity)}`"
            :title="activityLevel(project.lastActivity) === 'dead' ? '长时间未活动，建议归档' : ''"
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
            :title="b.current ? '当前分支' : `切换到 ${b.name}`"
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
          :title="i18n.moveCategory || '移动分类'"
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
            :title="`打开 ${pm.label}（右键复制链接）`"
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
            title="打开项目"
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
              <span>打开文件夹</span>
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
              <span>未检测到 IDE</span>
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
                <span class="gp-ide-del-confirm">确认删除?</span>
                <button
                  class="gp-ide-del-yes"
                  @click.stop="$emit('doRemoveCustomIde', idx)"
                >
                  是
                </button>
                <button
                  class="gp-ide-del-no"
                  @click.stop="$emit('update:confirmingDelIdx', -1)"
                >
                  否
                </button>
              </template>
              <button
                v-else
                class="gp-ide-item-del"
                title="删除此自定义 IDE"
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
              <span>管理 IDE...</span>
            </button>
          </div>
        </div>
        <div class="gp-refresh-wrap">
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm"
            title="刷新选项"
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
              <span>{{ i18n.refreshWorkingTree || '刷新工作空间' }}</span>
            </button>
            <button class="gp-refresh-item" @click="$emit('refreshCommitLog', project.id); openRefreshMenu.delete(project.id)">
              <Icon icon="mdi:history" height="12" />
              <span>{{ i18n.refreshCommitLog || '刷新提交日志' }}</span>
            </button>
            <button class="gp-refresh-item" @click="$emit('refreshTags', project.id); openRefreshMenu.delete(project.id)">
              <Icon icon="mdi:tag-outline" height="12" />
              <span>{{ i18n.refreshTags || '刷新标签' }}</span>
            </button>
            <button class="gp-refresh-item" @click="$emit('refreshRemoteStatus', project.id); openRefreshMenu.delete(project.id)">
              <Icon icon="mdi:cloud-refresh-outline" height="12" />
              <span>{{ i18n.refreshRemoteStatus || '刷新远程状态' }}</span>
            </button>
            <div class="gp-refresh-divider" />
            <button class="gp-refresh-item gp-refresh-item--all" @click="$emit('refresh', project.id); openRefreshMenu.delete(project.id)">
              <Icon icon="mdi:refresh-circle" height="12" />
              <span>{{ i18n.refreshAll || '全部刷新' }}</span>
            </button>
          </div>
        </div>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          title="编辑项目（标签/状态/备注）"
          @click="$emit('openEditDialog', project)"
        >
          <Icon
            icon="mdi:pencil-outline"
            height="12"
          />
        </button>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          title="查看项目 Git 配置"
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
        title="刷新远程状态"
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
        >{{ i18n.notDetected || '未检测到' }}</span>
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
      <span>{{ i18n.conflictWarn || '远程有新的提交，建议先拉取再推送' }}</span>
    </div>

    <!-- 工作区变更状态 -->
    <WorkingTreePanel
      :i18n="i18n"
      :tree="workingTree"
      :committing="committing || false"
      :generating="generatingMsg?.generating || false"
      :commit-output="commitOutput || ''"
      :generated-msg="generatingMsg?.text || ''"
      :file-diffs="fileDiffs"
      :git-op-loading="gitOpLoading || false"
      :commit-log-entries="commitLogEntries"
      :commit-log-loading="commitLogLoading || false"
      :working-tree-loading="workingTreeLoading || false"
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
      @reload-commit-log="(count: number) => $emit('reloadCommitLog', project.id, count)"
      @refresh-working-tree="$emit('refreshWorkingTree', project.id)"
      @refresh-commit-log="$emit('refreshCommitLog', project.id)"
    />

    <!-- Stash 暂存 -->
    <StashSection
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

    <!-- Tag 管理 -->
    <TagPanel
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

    <!-- 冲突警告 -->
    <ConflictSection
      :conflicts="conflicts"
      :i18n="i18n"
      @resolve-conflict="(file: string, strategy: string) => $emit('resolveConflict', project.id, file, strategy)"
      @abort-merge="$emit('abortMerge', project.id)"
    />

    <!-- 操作栏：拉取 / 推送 -->
    <div class="gp-actions-bar">
      <!-- 拉取区 -->
      <div class="gp-actions-section">
        <span class="gp-actions-label">{{ i18n.pull || '拉取' }}</span>
        <div class="gp-actions-btns">
          <button
            v-for="r in remotes"
            :key="`pull-${r.key}`"
            class="vp-btn vp-btn--ghost vp-btn--sm gp-action-btn"
            :class="{ 'gp-action-btn--active': isPulling(project.id, r.key) }"
            :disabled="!project[r.remoteProp] || isPulling(project.id) || isPushing(project.id)"
            :title="`${i18n.pull || 'Pull'} ${r.label}`"
            @click="$emit('confirmPull', project.id, r.key)"
          >
            <span>{{ r.label }}</span>
          </button>
          <!-- Fetch 按钮 -->
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm gp-action-btn gp-fetch-btn"
            :class="{ 'gp-action-btn--active': fetching }"
            :disabled="!hasAnyRemote(project) || isPulling(project.id) || isPushing(project.id) || fetching"
            :title="i18n.fetchHint || '获取最新远程状态'"
            @click="$emit('fetchAll', project.id)"
          >
            <span>{{ i18n.fetchAll || 'Fetch' }}</span>
          </button>
        </div>
      </div>

      <!-- 推送区 -->
      <div class="gp-actions-section">
        <span class="gp-actions-label">{{ i18n.push || '推送' }}</span>
        <div class="gp-actions-btns">
          <button
            v-for="r in remotes"
            :key="`push-${r.key}`"
            class="vp-btn vp-btn--ghost vp-btn--sm gp-action-btn"
            :class="pushBtnClass(getPushStatus(project.id, r.key))"
            :disabled="!project[r.remoteProp] || isPushing(project.id) || isPulling(project.id) || !needsPushFor(project.id, r.key)"
            :title="`${i18n.push || 'Push'} ${r.label}`"
            @click="$emit('pushSingle', project.id, r.key)"
          >
            <span>{{ pushBtnText(getPushStatus(project.id, r.key), r.label, i18n) }}</span>
          </button>

          <!-- 推送全部 -->
          <button
            v-if="!isPushing(project.id)"
            class="vp-btn vp-btn--primary vp-btn--sm gp-action-btn"
            :disabled="!hasAnyRemote(project) || isPulling(project.id) || !pushStatus?.needsPush"
            @click="$emit('pushToAll', project.id)"
          >
            <span>{{ i18n.pushAll || '推送全部' }}</span>
          </button>

          <!-- 取消推送 -->
          <button
            v-else
            class="vp-btn vp-btn--danger vp-btn--sm gp-action-btn"
            @click="$emit('cancelPush', project.id)"
          >
            <span>{{ i18n.cancel || '取消' }}</span>
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
  GitProject,
  PlatformKey,
  ProjectCategory,
  ProjectStatus,
} from "../types"
import { Icon } from "@iconify/vue"
import { computed } from "vue"
import {
  PLATFORM_META,
  REMOTES,
  STATUS_META,
} from "../types"
import type { MdFileEntry } from "../composables/useMarkdownFiles"
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
  refreshing: string | null
  fetching: boolean
  openIdeMenu: Set<string>
  workingTreeLoading?: boolean
  remoteStatusLoading?: boolean
  openRefreshMenu: Set<string>
  confirmingDelIdx: number
  // 每项目响应式数据（单项目值，非全量 Record，避免跨卡片 re-render）
  branches: any[]
  pushStatus: any
  workingTree: any
  stashEntries: any[]
  stashLoading: boolean
  conflicts: any[]
  commitOutput: string
  pullOutputs: any[]
  pushOutputs: any[]
  committing: boolean
  generatingMsg: { generating: boolean, text: string }
  gitOpLoading: boolean
  commitLogLoading: boolean
  tagsCache: any[]
  tagLoading: boolean
  tagPushLoading: any
  genStashDescLoading: boolean
  generatedStashMsg: string
  commitTemplates: { id: string, name: string, pattern: string, builtin?: boolean }[]
  selectedTags: Set<string>
  fileDiffs: Record<string, string>
  commitLogEntries: any[]
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
defineEmits<{
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
  "openProjectGitConfig": [id: string]
}>()

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
  if (status === 'pushing') return i18n.pushing || '推送中…'
  if (status === 'ok') return i18n.done || '完成'
  if (status === 'fail') return i18n.failed || '失败'
  return label
}

/** 拉取/推送输出面板列表 */
const outputPanels = computed(() => [
  { key: 'pull', entries: props.pullOutputs },
  { key: 'push', entries: props.pushOutputs },
])

/** 仅"全部刷新"时转动下拉菜单按钮 */
const isRefreshing = computed(() => props.refreshing === props.project.id)
</script>
