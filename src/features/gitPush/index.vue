<template>
  <div class="git-push-panel">
    <!-- 头部 -->
    <div class="gp-header">
      <div class="gp-header-left">
        <span class="gp-title">{{ i18n.panelTitle || 'Git 推送' }}</span>
        <span v-if="projectCount > 0" class="gp-count-badge">{{ projectCount }}</span>
      </div>
      <div class="gp-header-btns">
        <!-- 视图切换 -->
        <div class="gp-view-toggle">
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm gp-view-btn"
            :class="{ active: currentView === 'list' }"
            title="列表视图"
            @click="currentView = 'list'"
          >
            <Icon icon="mdi:view-list" height="14" />
          </button>
          <button
            class="vp-btn vp-btn--ghost vp-btn--sm gp-view-btn"
            :class="{ active: currentView === 'stats' }"
            title="统计视图"
            @click="currentView = 'stats'"
          >
            <Icon icon="mdi:chart-bar" height="14" />
          </button>
        </div>
        <button class="vp-btn vp-btn--ghost vp-btn--sm" @click="showCatDialog = true">
          <Icon icon="mdi:tag-outline" />
        </button>
        <button class="vp-btn vp-btn--ghost vp-btn--sm" title="设置" @click="showSettings = true">
          <Icon icon="mdi:cog-outline" />
        </button>
        <button
          class="vp-btn vp-btn--ghost vp-btn--sm"
          title="手动刷新当前分类"
          :disabled="refreshingAll"
          @click="handleRefreshAll"
        >
          <Icon icon="mdi:sync" :class="{ 'gp-spin': refreshingAll }" />
        </button>
        <button class="vp-btn vp-btn--ghost gp-add-btn" @click="showAddDialog = true">
          <Icon icon="mdi:plus" />
          <span>{{ i18n.addProject || '添加项目' }}</span>
        </button>
        <button class="vp-btn vp-btn--ghost gp-add-btn" @click="handleOpenScan">
          <Icon icon="mdi:file-find-outline" />
          <span>{{ i18n.importProject || '导入项目' }}</span>
        </button>
      </div>
    </div>

    <div class="gp-divider" />

    <!-- git 操作进度条 -->
    <div v-if="activeGitOps > 0" class="gp-progress-bar" />

    <!-- ========== 统计视图 ========== -->
    <StatsPanel
      v-if="currentView === 'stats'"
      :i18n="i18n"
      :project-count="projectCount"
      :remote-coverage="remoteCoverage"
      :push-status-stats="pushStatusStats"
      :needs-push-projects="needsPushProjects"
      :uncommitted-projects="uncommittedProjects"
      :no-platform-projects="noPlatformProjects"
      :platform-status-projects="platformStatusProjects"
      @view-project="onViewProject"
    />

    <!-- ========== 列表视图 ========== -->
    <template v-if="currentView === 'list'">
    <!-- 筛选工具栏（智能视图 + 归档 toggle + 标签筛选） -->
    <div v-if="projects.length > 0" class="gp-filter-bar">
      <div class="gp-view-modes">
        <button
          v-for="vm in (['all','needsPush','uncommitted','starred'] as const)"
          :key="vm"
          class="gp-vm-btn"
          :class="{ active: viewMode === vm }"
          :title="VIEW_MODE_META[vm].label"
          @click="viewMode = vm"
        >
          <Icon :icon="VIEW_MODE_META[vm].icon" height="13" />
          <span>{{ VIEW_MODE_META[vm].label }}</span>
        </button>
      </div>
      <div class="gp-filter-toggles">
        <button
          class="gp-ft-btn"
          :class="{ active: showArchived }"
          title="显示/隐藏归档项目"
          @click="showArchived = !showArchived"
        >
          <Icon icon="mdi:archive-outline" height="13" />
          <span v-if="showArchived">含归档</span>
        </button>
      </div>
    </div>

    <!-- 标签筛选条（有标签时显示） -->
    <div v-if="allTags.length > 0 && projects.length > 0" class="gp-tag-filter">
      <button
        v-for="t in allTags"
        :key="t"
        class="gp-tag-chip"
        :class="{ active: selectedTags.has(t) }"
        @click="toggleTagFilter(t)"
      >{{ t }}</button>
    </div>

    <!-- 分类 TAB 导航（仅 all 模式显示） -->
    <div v-if="viewMode === 'all' && groupedProjects.length > 0" class="gp-tabs">
      <button
        v-for="g in groupedProjects"
        :key="g.category.id"
        class="gp-tab"
        :class="{ active: activeCategory === g.category.id }"
        :style="activeCategory === g.category.id ? { borderBottomColor: g.category.color } : {}"
        @click="activeCategory = g.category.id"
      >
        <span class="gp-tab-dot" :style="{ background: g.category.color }" />
        <span>{{ g.category.name }}</span>
        <span class="gp-tab-count">{{ g.projects.length }}</span>
      </button>
    </div>

    <!-- 搜索框 -->
    <div v-if="projects.length > 0" class="gp-search-wrap">
      <Icon icon="mdi:magnify" class="gp-search-icon" />
      <input
        v-model="searchQuery"
        class="gp-search-input"
        :placeholder="i18n.searchPlaceholder || '搜索项目...'"
      />
      <button v-if="searchQuery" class="gp-search-clear" @click="searchQuery = ''">
        <Icon icon="mdi:close" height="14" />
      </button>
    </div>

    <!-- 项目列表 -->
    <div v-if="loading" class="gp-loading">{{ i18n.loading || '加载中...' }}</div>

    <div v-else-if="projects.length === 0" class="gp-empty">
      <div class="gp-empty-icon">
        <Icon icon="mdi:source-repository" width="48" />
      </div>
      <div class="gp-empty-text">{{ i18n.noProjects || '暂无项目，点击上方添加' }}</div>
    </div>

    <div v-else class="gp-list">
      <template v-for="group in filteredGroups" :key="group.category.id">
        <div
          v-for="project in group.projects"
          :key="project.id"
          class="gp-card"
        >
        <div class="gp-card-top">
          <div class="gp-card-info">
            <div class="gp-card-name-row">
              <!-- 收藏星标（高频，内联切换） -->
              <button
                class="gp-star-btn"
                :class="{ active: project.starred }"
                :title="project.starred ? '取消收藏' : '收藏置顶'"
                @click.stop="toggleStar(project.id)"
              >
                <Icon :icon="project.starred ? 'mdi:star' : 'mdi:star-outline'" height="14" />
              </button>
              <input
                v-if="editingNameId === project.id"
                v-model="editingNameInput"
                class="gp-card-name-input"
                @blur="handleNameEditSave(project)"
                @keyup.enter="($event.target as HTMLInputElement).blur()"
                @keyup.escape="editingNameId = ''"
                @click.stop
              />
              <span
                v-else
                class="gp-card-name"
                title="点击修改名称"
                @click.stop="startNameEdit(project)"
              >{{ project.name }}</span>
              <!-- 状态徽章（点击循环切换） -->
              <button
                class="gp-status-badge"
                :class="`gp-sb-${project.status || 'active'}`"
                :title="`状态: ${STATUS_META[project.status || 'active'].label}（点击切换）`"
                @click.stop="cycleStatus(project.id, project.status)"
              >
                <Icon :icon="STATUS_META[project.status || 'active'].icon" height="12" />
              </button>
              <span v-if="project.archived" class="gp-archived-tag" title="已归档">
                <Icon icon="mdi:archive-outline" height="11" />归档
              </span>
            </div>
            <div class="gp-card-path" :title="project.path">{{ project.path }}</div>
            <!-- 标签 + 最后活动时间 -->
            <div class="gp-card-meta">
              <div v-if="project.tags?.length" class="gp-card-tags">
                <span
                  v-for="t in project.tags.slice(0, 3)"
                  :key="t"
                  class="gp-card-tag"
                  :class="{ active: selectedTags.has(t) }"
                  :title="`点击筛选标签: ${t}`"
                  @click.stop="toggleTagFilter(t)"
                >{{ t }}</span>
                <span v-if="project.tags.length > 3" class="gp-card-tag gp-card-tag-more">+{{ project.tags.length - 3 }}</span>
              </div>
              <span
                v-if="project.lastActivity"
                class="gp-activity"
                :class="`gp-act-${activityLevel(project.lastActivity)}`"
                :title="activityLevel(project.lastActivity) === 'dead' ? '长时间未活动，建议归档' : ''"
              >
                <Icon icon="mdi:clock-outline" height="10" />
                {{ relativeTime(project.lastActivity) }}
              </span>
            </div>
            <!-- 分支标签 -->
            <div v-if="branches[project.id]?.length" class="gp-branch-row">
              <Icon icon="mdi:source-branch" height="11" />
              <button
                v-for="b in branches[project.id]"
                :key="b.name"
                class="gp-branch-tag"
                :class="{ current: b.current }"
                :title="b.current ? '当前分支' : `切换到 ${b.name}`"
                @click="handleSwitchBranch(project.id, b.name)"
              >
                {{ b.name }}
                <Icon v-if="b.current" icon="mdi:check" height="9" />
              </button>
            </div>
            <!-- 备注 -->
            <div v-if="project.note" class="gp-card-note" :title="project.note">
              <Icon icon="mdi:note-text-outline" height="11" />
              <span>{{ project.note }}</span>
            </div>
          </div>
          <div class="gp-card-actions">
            <select
              class="gp-cat-select"
              :value="project.categoryId"
              :title="i18n.moveCategory || '移动分类'"
              @change.stop="handleMoveProject(project.id, ($event.target as HTMLSelectElement).value)"
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
            <button
              v-if="project.githubUrl"
              class="vp-btn vp-btn--ghost vp-btn--sm"
              :title="'打开 GitHub（右键复制链接）'"
              @click="handleOpenWeb(project.githubUrl)"
              @contextmenu.prevent="handleCopyUrl(project.githubUrl)"
            >
              <Icon icon="mdi:github" height="14" />
            </button>
            <button
              v-if="project.giteeUrl"
              class="vp-btn vp-btn--ghost vp-btn--sm"
              :title="'打开 Gitee（右键复制链接）'"
              @click="handleOpenWeb(project.giteeUrl)"
              @contextmenu.prevent="handleCopyUrl(project.giteeUrl)"
            >
              <Icon icon="mdi:git" height="14" />
            </button>
            <button
              v-if="project.giteaUrl"
              class="vp-btn vp-btn--ghost vp-btn--sm"
              :title="'打开 Gitea（右键复制链接）'"
              @click="handleOpenWeb(project.giteaUrl)"
              @contextmenu.prevent="handleCopyUrl(project.giteaUrl)"
            >
              <Icon icon="mdi:tea" height="14" />
            </button>
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm"
              title="打开项目目录"
              @click="handleOpenPath(project.path)"
            >
              <Icon icon="mdi:folder-open" height="14" />
            </button>
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm"
              title="重新检测远程仓库"
              @click="handleRefresh(project.id)"
            >
              <Icon icon="mdi:refresh" :class="{ 'gp-spin': refreshing === project.id }" />
            </button>
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm"
              title="仓库配置"
              @click="openRemoteConfig(project)"
            >
              <Icon icon="mdi:source-repository" height="14" />
            </button>
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm"
              title="编辑项目（标签/状态/备注）"
              @click="openEditDialog(project)"
            >
              <Icon icon="mdi:pencil-outline" height="14" />
            </button>
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm gp-btn-danger"
              @click="handleRemove(project)"
            >
              <Icon icon="mdi:delete-outline" />
            </button>
          </div>
        </div>

        <!-- 远程仓库状态 -->
        <div class="gp-remotes">
          <div
            v-for="r in REMOTES"
            :key="r.key"
            class="gp-remote-item"
            :class="{ active: !!project[r.remoteProp] }"
          >
            <Icon :icon="r.icon" />
            <span v-if="project[r.remoteProp]">{{ project[r.remoteProp] }}</span>
            <span v-else class="gp-remote-none">{{ i18n.notDetected || '未检测到' }}</span>
            <span
              v-if="pushStatuses[project.id]?.remotes[r.key]"
              class="gp-status-badge"
              :class="statusBadgeClass(project.id, r.key)"
            >
              {{ statusLabel(project.id, r.key) }}
            </span>
          </div>
        </div>

        <!-- 远程冲突警告 -->
        <div v-if="hasBehind(project.id)" class="gp-conflict-warn">
          <Icon icon="mdi:alert-circle-outline" height="14" />
          <span>{{ i18n.conflictWarn || '远程有新的提交，建议先拉取再推送' }}</span>
        </div>

        <!-- 工作区变更状态 -->
        <WorkingTreePanel
          v-if="workingTrees[project.id]"
          :i18n="i18n"
          :tree="workingTrees[project.id]"
          :committing="committing[project.id] || false"
          :generating="generatingMsgs[project.id]?.generating || false"
          :commit-output="commitOutputs[project.id] || ''"
          :generated-msg="generatingMsgs[project.id]?.text || ''"
          :file-diffs="fileDiffsForProject(project.id)"
          :git-op-loading="gitOpLoading[project.id] || false"
          :commit-log-entries="commitLogForProject(project.id)"
          :commit-log-loading="commitLogLoading[project.id] || false"
          @stage-file="(file) => handleGitOp('暂存失败', () => stageItem(project.id, file), project.id)"
          @unstage-file="(file) => handleGitOp('取消暂存失败', () => unstageItem(project.id, file), project.id)"
          @stage-all="handleGitOp('暂存失败', () => stageAllItems(project.id), project.id)"
          @unstage-all="handleGitOp('取消暂存失败', () => unstageAllItems(project.id), project.id)"
          @commit="(msg) => handleCommit(project.id, msg)"
          @generate-msg="handleGenerateMsg(project.id)"
          @load-diff="(file, staged) => loadFileDiff(project.id, file, staged)"
          @clear-output="commitOutputs[project.id] = ''"
          @discard-file="(file, staged, status) => handleDiscard(project.id, file, staged, status)"
          @expand="handleExpand(project.id)"
        />

        <!-- Stash 暂存 -->
        <div class="gp-stash-wrap">
          <div class="gp-stash-header">
            <span class="gp-stash-label">STASH</span>
            <span class="gp-stash-help" title="暂存：把当前未提交的修改临时保存起来，方便切换到其他分支工作。之后可以随时'恢复'回来继续编辑，就像把工作进度先放进抽屉里一样。">
              <Icon icon="mdi:help-circle-outline" height="14" />
            </span>
            <template v-if="stashInputProject === project.id">
              <input
                v-model="stashInputMsg"
                class="gp-stash-msg-input"
                placeholder="暂存描述（可选）"
                @keyup.enter="handleStashConfirm(project.id)"
              />
              <button
                class="vp-btn vp-btn--ghost vp-btn--sm"
                title="AI 生成描述"
                :disabled="genStashDescLoading[project.id]"
                @click="handleGenStashDesc(project.id)"
              >
                <Icon v-if="genStashDescLoading[project.id]" icon="mdi:loading" class="gp-spin" height="14" />
                <Icon v-else icon="mdi:auto-fix" height="14" />
              </button>
              <button class="vp-btn vp-btn--primary vp-btn--sm" :disabled="stashLoading[project.id]" @click="handleStashConfirm(project.id)">
                <Icon icon="mdi:check" height="14" /></button>
              <button class="vp-btn vp-btn--ghost vp-btn--sm" @click="stashInputProject = ''">
                <Icon icon="mdi:close" height="14" /></button>
            </template>
            <button
              v-else
              class="vp-btn vp-btn--ghost vp-btn--sm"
              :disabled="!workingTrees[project.id]?.hasChanges || stashLoading[project.id]"
              @click="stashInputProject = project.id; stashInputMsg = ''"
            >
              <Icon v-if="stashLoading[project.id]" icon="mdi:loading" class="gp-spin" height="13" />
              <Icon v-else icon="mdi:archive-outline" height="13" />
              {{ i18n.stashSave || '暂存变更' }}
            </button>
          </div>
          <div v-if="stashEntries[project.id]?.length" class="gp-stash-list">
            <div v-for="e in stashEntries[project.id]" :key="e.index" class="gp-stash-row">
              <span class="gp-stash-index">stash@{{ '{' + e.index + '}' }}</span>
              <span class="gp-stash-msg" :title="e.message">{{ e.message }}</span>
              <button
                class="vp-btn vp-btn--ghost vp-btn--sm"
                title="恢复并删除 (pop)"
                :disabled="stashLoading[project.id]"
                @click="handleStashPop(project.id, e.index)"
              >{{ i18n.stashRestore || '恢复' }}</button>
              <button
                class="vp-btn vp-btn--ghost vp-btn--sm"
                title="应用但不删除 (apply)"
                :disabled="stashLoading[project.id]"
                @click="handleStashApply(project.id, e.index)"
              >{{ i18n.stashApply || '应用' }}</button>
              <button
                class="vp-btn vp-btn--ghost vp-btn--sm"
                title="删除 (drop)"
                :disabled="stashLoading[project.id]"
                @click="handleStashDrop(project.id, e.index)"
              >{{ i18n.stashDrop || '删除' }}</button>
            </div>
          </div>
        </div>

        <!-- 拉取按钮组 -->
        <div class="gp-push-group">
          <button
            v-for="r in REMOTES"
            :key="`pull-${r.key}`"
            class="vp-btn vp-btn--ghost gp-push-btn"
            :disabled="!project[r.remoteProp] || isPulling(project.id) || isPushing(project.id)"
            @click="pullSingle(project.id, r.key as 'github' | 'gitee' | 'gitea')"
          >
            <Icon v-if="isPulling(project.id, r.key)" icon="mdi:loading" class="gp-spin" />
            <Icon v-else icon="mdi:source-pull" />
            <span v-if="isPulling(project.id, r.key)">{{ i18n.pulling || '拉取中...' }}</span>
            <span v-else>&#8203;</span>
          </button>
          <button
            class="vp-btn vp-btn--ghost gp-push-btn"
            :disabled="(!project.githubRemote && !project.giteeRemote && !project.giteaRemote) || isPulling(project.id) || isPushing(project.id)"
            @click="pullToAll(project.id)"
          >
            <Icon v-if="isPulling(project.id, 'all')" icon="mdi:loading" class="gp-spin" />
            <Icon v-else icon="mdi:source-pull" />
            <span v-if="isPulling(project.id, 'all')">{{ i18n.pulling || '拉取中...' }}</span>
            <span v-else>{{ i18n.pullAll || '拉取全部' }}</span>
          </button>
        </div>

        <!-- 推送按钮组 -->
        <div class="gp-push-group">
          <button
            v-for="r in REMOTES"
            :key="r.key"
            class="vp-btn vp-btn--ghost gp-push-btn"
            :disabled="!project[r.remoteProp] || isPushing(project.id) || isPulling(project.id) || !needsPushFor(project.id, r.key)"
            @click="pushSingle(project.id, r.key as 'github' | 'gitee' | 'gitea')"
          >
            <Icon v-if="isPushing(project.id, r.key)" icon="mdi:loading" class="gp-spin" />
            <Icon v-else :icon="r.icon" />
            <span v-if="isPushing(project.id, r.key)">{{ i18n.pushing || '推送中...' }}</span>
            <span v-else>{{ r.label }}</span>
          </button>
          <button
            class="vp-btn vp-btn--primary gp-push-btn"
            :disabled="(!project.githubRemote && !project.giteeRemote && !project.giteaRemote) || isPushing(project.id) || isPulling(project.id) || !pushStatuses[project.id]?.needsPush"
            @click="pushToAll(project.id)"
          >
            <Icon v-if="isPushing(project.id, 'all')" icon="mdi:loading" class="gp-spin" />
            <Icon v-else icon="mdi:cloud-upload" />
            <span v-if="isPushing(project.id, 'all')">{{ i18n.pushing || '推送中...' }}</span>
            <span v-else>{{ i18n.pushAll || '推送全部' }}</span>
          </button>
        </div>

        <!-- 拉取输出 -->
        <div v-if="pullOutputs[project.id]" class="gp-output">
          <pre>{{ pullOutputs[project.id] }}</pre>
        </div>

        <!-- 推送输出 -->
        <div v-if="pushOutputs[project.id]" class="gp-output">
          <pre>{{ pushOutputs[project.id] }}</pre>
        </div>
        </div>
      </template>
    </div>
    </template>
    <!-- 列表视图结束 -->

    <!-- 添加项目弹窗 -->
    <div v-if="showAddDialog" class="gp-mask" @click.self="showAddDialog = false">
      <div class="gp-dialog">
        <div class="gp-dialog-header">
          <span class="gp-dialog-title">{{ i18n.addProject || '添加项目' }}</span>
          <button class="vp-btn vp-btn--ghost vp-btn--sm" @click="showAddDialog = false">
            <Icon icon="mdi:close" />
          </button>
        </div>
        <div class="gp-dialog-body">
          <div class="gp-form-group">
            <label class="gp-label">{{ i18n.projectName || '项目名称' }}</label>
            <input
              v-model="newProjectName"
              class="gp-input"
              :placeholder="i18n.namePlaceholder || '输入项目名称...'"
              @keyup.enter="handleAdd"
            />
          </div>
          <div class="gp-form-group">
            <label class="gp-label">{{ i18n.projectPath || '项目路径' }}</label>
            <div class="gp-path-row">
              <input
                v-model="newProjectPath"
                class="gp-input"
                :placeholder="i18n.pathPlaceholder || '选择或输入项目路径...'"
                @keyup.enter="handleAdd"
              />
              <button class="vp-btn vp-btn--ghost vp-btn--sm" @click="selectDirectory">
                <Icon icon="mdi:folder-open" />
              </button>
            </div>
          </div>
          <div class="gp-form-group">
            <label class="gp-label">{{ i18n.category || '分类' }}</label>
            <select v-model="newProjectCat" class="gp-select">
              <option
                v-for="cat in categories"
                :key="cat.id"
                :value="cat.id"
              >
                {{ cat.name }}
              </option>
            </select>
          </div>
          <div class="gp-form-group">
            <label class="gp-label">标签（可选，逗号分隔）</label>
            <input
              v-model="newProjectTags"
              class="gp-input"
              placeholder="如：前端, 个人作品, 长期维护"
            />
          </div>
          <div v-if="addError" class="gp-error">{{ addError }}</div>
          <div v-if="addChecking" class="gp-checking">
            <Icon icon="mdi:loading" class="gp-spin" />
            {{ i18n.checkingGit || '正在检查 git 仓库...' }}
          </div>
          <div v-if="addResult !== null && !addChecking" class="gp-check-result" :class="{ success: addResult }">
            {{ addResult ? (i18n.gitRepoDetected || '✅ 已检测到 git 仓库') : (i18n.notGitRepo || '❌ 未检测到 git 仓库，将仅记录路径') }}
          </div>
        </div>
        <div class="gp-dialog-footer">
          <button class="vp-btn vp-btn--ghost" @click="showAddDialog = false">
            {{ i18n.cancel || '取消' }}
          </button>
          <button class="vp-btn vp-btn--primary" :disabled="!newProjectName || !newProjectPath" @click="handleAdd">
            {{ i18n.add || '添加' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 管理分类弹窗 -->
    <div v-if="showCatDialog" class="gp-mask" @click.self="showCatDialog = false">
      <div class="gp-dialog" style="width: 340px;">
        <div class="gp-dialog-header">
          <span class="gp-dialog-title">{{ i18n.manageCategories || '管理分类' }}</span>
          <button class="vp-btn vp-btn--ghost vp-btn--sm" @click="showCatDialog = false">
            <Icon icon="mdi:close" />
          </button>
        </div>
        <div class="gp-dialog-body">
          <div v-for="cat in categories" :key="cat.id" class="gp-cat-row">
            <span class="gp-cat-dot-sm" :style="{ background: cat.color }" />
            <span class="gp-cat-name-sm">{{ cat.name }}</span>
            <button
              v-if="cat.id !== '__ungrouped__'"
              class="vp-btn vp-btn--ghost vp-btn--sm gp-btn-danger"
              @click="handleDeleteCategory(cat.id)"
            >
              <Icon icon="mdi:delete-outline" height="12" />
            </button>
          </div>
          <div class="gp-cat-add-row">
            <input
              v-model="newCatName"
              class="gp-input"
              :placeholder="i18n.catNamePlaceholder || '分类名称'"
              @keyup.enter="handleAddCategory"
              style="flex:1"
            />
            <input
              v-model="newCatColor"
              type="color"
              class="gp-color-input"
              title="颜色"
            />
            <button
              class="vp-btn vp-btn--primary vp-btn--sm"
              :disabled="!newCatName.trim()"
              @click="handleAddCategory"
            >
              <Icon icon="mdi:plus" height="13" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 设置弹窗 -->
    <div v-if="showSettings" class="gp-mask" @click.self="showSettings = false">
      <div class="gp-dialog" style="width: 300px;">
        <div class="gp-dialog-header">
          <span class="gp-dialog-title">{{ i18n.settings || '设置' }}</span>
          <button class="vp-btn vp-btn--ghost vp-btn--sm" @click="showSettings = false">
            <Icon icon="mdi:close" />
          </button>
        </div>
        <div class="gp-dialog-body">
          <div class="gp-set-row">
            <label class="gp-set-label">Git 并发数</label>
            <div class="gp-set-input-row">
              <input
                v-model.number="gitConcurrency"
                type="number"
                class="gp-input"
                min="1"
                max="10"
                style="width: 50px; text-align: center;"
              />
              <button class="vp-btn vp-btn--primary vp-btn--sm" @click="handleSaveConcurrency">保存</button>
            </div>
          </div>
          <div class="gp-set-hint">同时执行的 git 子进程数上限（1~10）</div>
        </div>
      </div>
    </div>

    <!-- 扫描导入项目弹窗 -->
    <div v-if="showScanDialog" class="gp-mask" @click.self="handleCloseScan">
      <div class="gp-dialog" style="width: 520px;">
        <div class="gp-dialog-header">
          <span class="gp-dialog-title">{{ i18n.importProject || '导入项目' }}</span>
          <button class="vp-btn vp-btn--ghost vp-btn--sm" @click="handleCloseScan">
            <Icon icon="mdi:close" />
          </button>
        </div>
        <div class="gp-dialog-body">
          <div class="gp-form-group">
            <label class="gp-label">{{ i18n.scanDir || '扫描目录' }}</label>
            <div class="gp-path-row">
              <input
                v-model="scanDirInput"
                class="gp-input"
                :placeholder="i18n.scanDirPlaceholder || '选择要递归扫描的目录...'"
              />
              <button class="vp-btn vp-btn--ghost vp-btn--sm" @click="selectScanDirectory">
                <Icon icon="mdi:folder-open" />
              </button>
            </div>
          </div>
          <div style="display: flex; justify-content: center; margin-top: 4px;">
            <button
              class="vp-btn vp-btn--primary"
              :disabled="scanning || !scanDirInput.trim()"
              @click="handleStartScan"
            >
              <Icon v-if="scanning" icon="mdi:loading" class="gp-spin" />
              <Icon v-else icon="mdi:magnify" />
              <span>{{ scanning ? (i18n.scanning || '扫描中...') : (i18n.startScan || '开始扫描') }}</span>
            </button>
          </div>
          <div v-if="scanResults.length > 0" class="gp-scan-results">
            <div class="gp-scan-results-header">
              <span class="gp-scan-count">{{ i18n.scanResults || '扫描结果' }} ({{ scanResults.length }})</span>
              <button class="vp-btn vp-btn--ghost vp-btn--sm" style="font-size:10px;" @click="handleToggleSelectAll">
                {{ i18n.selectAll || '全选' }}
              </button>
            </div>
            <div v-for="repo in scanResults" :key="repo.path" class="gp-scan-item">
              <label class="gp-scan-item-row" :class="{ 'gp-scan-imported': repo.alreadyImported }">
                <input
                  type="checkbox"
                  :checked="scanSelection[repo.path] || false"
                  :disabled="repo.alreadyImported"
                  @change="toggleScanItem(repo.path)"
                />
                <div class="gp-scan-item-info">
                  <span class="gp-scan-item-name">{{ repo.name }}</span>
                  <span class="gp-scan-item-path">{{ repo.path }}</span>
                </div>
                <span v-if="repo.alreadyImported" class="gp-scan-badge">{{ i18n.imported || '已导入' }}</span>
              </label>
            </div>
          </div>
          <div v-else-if="!scanning && scanDirInput.trim() && scanResults.length === 0" class="gp-empty" style="padding:20px 0;">
            <Icon icon="mdi:folder-search-outline" width="36" />
            <div class="gp-empty-text">{{ i18n.noScanResults || '未找到 Git 仓库' }}</div>
          </div>
          <div v-if="scanError" class="gp-error">{{ scanError }}</div>
        </div>
        <div class="gp-dialog-footer">
          <button class="vp-btn vp-btn--ghost" @click="handleCloseScan">
            {{ i18n.cancel || '取消' }}
          </button>
          <button
            class="vp-btn vp-btn--primary"
            :disabled="selectedCount === 0"
            @click="handleImportSelected"
          >
            {{ (i18n.importSelected || '导入选中') + ' (' + selectedCount + ')' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 仓库配置弹窗 -->
    <div v-if="remoteConfigProject" class="gp-mask" @click.self="remoteConfigProject = null">
      <div class="gp-dialog" style="width: 420px;">
        <div class="gp-dialog-header">
          <span class="gp-dialog-title">仓库配置 — {{ remoteConfigProject.name }}</span>
          <button class="vp-btn vp-btn--ghost vp-btn--sm" @click="remoteConfigProject = null">
            <Icon icon="mdi:close" />
          </button>
        </div>
        <div class="gp-dialog-body">
          <!-- 当前远程列表 -->
          <div v-if="remoteList.length" class="gp-remote-list">
            <div v-for="r in remoteList" :key="r.name" class="gp-remote-row">
              <span class="gp-remote-name">{{ r.name }}</span>
              <template v-if="editingRemoteName === r.name">
                <input
                  v-model="editingRemoteUrl"
                  class="gp-input"
                  style="flex:1"
                  @keyup.enter="handleEditRemote(remoteConfigProject.id, r.name)"
                  @keyup.escape="editingRemoteName = ''"
                />
                <button
                  class="vp-btn vp-btn--primary vp-btn--sm"
                  :disabled="!editingRemoteUrl.trim()"
                  @click="handleEditRemote(remoteConfigProject.id, r.name)"
                >保存</button>
                <button
                  class="vp-btn vp-btn--ghost vp-btn--sm"
                  @click="editingRemoteName = ''"
                >取消</button>
              </template>
              <template v-else>
                <span class="gp-remote-url" :title="r.url">{{ r.url }}</span>
                <button
                  class="vp-btn vp-btn--ghost vp-btn--sm"
                  title="编辑此远程 URL"
                  @click="startEditRemote(r.name, r.url)"
                >编辑</button>
                <button
                  class="vp-btn vp-btn--ghost vp-btn--sm gp-btn-danger"
                  title="删除此远程"
                  @click="handleRemoveRemote(remoteConfigProject.id, r.name)"
                >删除</button>
              </template>
            </div>
          </div>
          <div v-else class="gp-remote-empty">暂无远程仓库</div>
          <!-- 添加远程表单 -->
          <div class="gp-remote-add">
            <select v-model="newRemoteName" class="gp-select" style="width:110px">
              <option value="" disabled>选择平台</option>
              <option v-for="r in REMOTES" :key="r.key" :value="r.key">{{ r.label }}</option>
            </select>
            <input v-model="newRemoteUrl" class="gp-input" placeholder="远程 URL" style="flex:1" />
            <button
              class="vp-btn vp-btn--primary vp-btn--sm"
              :disabled="!newRemoteName || !newRemoteUrl.trim()"
              @click="handleAddRemote(remoteConfigProject.id)"
            >添加</button>
          </div>
          <div v-if="remoteError" class="gp-error">{{ remoteError }}</div>
        </div>
      </div>
    </div>

    <!-- 项目编辑弹窗 -->
    <div v-if="editDialogProject" class="gp-mask" @click.self="editDialogProject = null">
      <div class="gp-dialog" style="width: 420px;">
        <div class="gp-dialog-header">
          <span class="gp-dialog-title">编辑项目 — {{ editDialogProject.name }}</span>
          <button class="vp-btn vp-btn--ghost vp-btn--sm" @click="editDialogProject = null">
            <Icon icon="mdi:close" />
          </button>
        </div>
        <div class="gp-dialog-body">
          <div class="gp-form-group">
            <label class="gp-label">项目名称</label>
            <input v-model="editName" class="gp-input" @keyup.enter="handleEditSave" />
          </div>
          <div class="gp-edit-row">
            <div class="gp-form-group" style="flex:1">
              <label class="gp-label">状态</label>
              <select v-model="editStatus" class="gp-select">
                <option v-for="s in STATUS_CYCLE" :key="s" :value="s">{{ STATUS_META[s].label }}</option>
              </select>
            </div>
            <div class="gp-form-group gp-edit-toggles">
              <label class="gp-label">标记</label>
              <div class="gp-toggle-row">
                <button
                  class="gp-toggle-chip"
                  :class="{ active: editStarred }"
                  @click="editStarred = !editStarred"
                >
                  <Icon :icon="editStarred ? 'mdi:star' : 'mdi:star-outline'" height="13" />收藏
                </button>
                <button
                  class="gp-toggle-chip"
                  :class="{ active: editArchived }"
                  @click="editArchived = !editArchived"
                >
                  <Icon icon="mdi:archive-outline" height="13" />归档
                </button>
              </div>
            </div>
          </div>
          <div class="gp-form-group">
            <label class="gp-label">标签</label>
            <div v-if="editTags.length" class="gp-edit-tags">
              <span v-for="t in editTags" :key="t" class="gp-edit-tag">
                {{ t }}
                <button class="gp-edit-tag-x" @click="handleEditRemoveTag(t)">
                  <Icon icon="mdi:close" height="11" />
                </button>
              </span>
            </div>
            <input
              v-model="editTagInput"
              class="gp-input"
              placeholder="输入标签后回车添加"
              list="gp-tag-suggestions"
              @keyup.enter="handleEditAddTag"
            />
            <datalist id="gp-tag-suggestions">
              <option v-for="t in allTags" :key="t" :value="t" />
            </datalist>
          </div>
          <div class="gp-form-group">
            <label class="gp-label">备注</label>
            <textarea v-model="editNote" class="gp-input" rows="3" placeholder="项目备注（可选）" />
          </div>
          <div class="gp-form-group">
            <label class="gp-label">仓库链接</label>
            <div class="gp-edit-urls">
              <div class="gp-edit-url-row">
                <Icon icon="mdi:github" height="14" />
                <input
                  v-model="editGithubUrl"
                  class="gp-input"
                  placeholder="GitHub 仓库 URL（可选）"
                />
              </div>
              <div class="gp-edit-url-row">
                <Icon icon="mdi:git" height="14" />
                <input
                  v-model="editGiteeUrl"
                  class="gp-input"
                  placeholder="Gitee 仓库 URL（可选）"
                />
              </div>
              <div class="gp-edit-url-row">
                <Icon icon="mdi:tea" height="14" />
                <input
                  v-model="editGiteaUrl"
                  class="gp-input"
                  placeholder="Gitea 仓库 URL（可选）"
                />
              </div>
            </div>
          </div>
        </div>
        <div class="gp-dialog-footer">
          <button class="vp-btn vp-btn--ghost" @click="editDialogProject = null">
            {{ i18n.cancel || '取消' }}
          </button>
          <button class="vp-btn vp-btn--primary" @click="handleEditSave">
            {{ i18n.save || '保存' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed, watch } from "vue"
import { Icon } from "@iconify/vue"
import { copyToClipboard } from "@/utils/domUtils"
import type { GitPushManager, GitProject, CommitLogEntry, ProjectStatus } from "./types"
import { PLATFORM_META } from "./types"
import { useGitPush } from "./composables/useGitPush"
import WorkingTreePanel from "./components/WorkingTreePanel.vue"
import StatsPanel from "./components/StatsPanel.vue"
import { pickDirectory } from "./composables/useDirectoryPicker"

/** 批次化并发处理：避免所有项目同时涌入 git 信号量导致排队拥堵 */
async function batchProcess<T>(items: T[], batchSize: number, fn: (item: T) => Promise<void>) {
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    await Promise.all(batch.map(fn))
  }
}

/** 远程平台元数据（从 types 导入共享定义） */
const REMOTES = PLATFORM_META.map(pm => ({ key: pm.key, icon: pm.icon, label: pm.label, remoteProp: pm.remoteProp }))

const props = defineProps<{
  i18n: Record<string, any>
  plugin: any
  manager: GitPushManager
}>()

const {
  projects,
  categories,
  groupedProjects,
  loading,
  isPushing,
  pushOutputs,
  isPulling,
  pullOutputs,
  pushStatuses,
  workingTrees,
  fileDiffs,
  committing,
  branches,
  loadProjects,
  loadPushStatus,
  loadWorkingTree,
  loadStatsData,
  loadFileDiff,
  stageItem,
  stageAllItems,
  unstageItem,
  unstageAllItems,
  discardFile,
  doCommit,
  generateCommitMsg,
  addProject,
  removeProject,
  refreshRemotes,
  pushToAll,
  pushSingle,
  pullToAll,
  pullSingle,
  checkIsGitRepo,
  addCategory: addCategoryFn,
  deleteCategory: deleteCategoryFn,
  moveProject,
  commitLogs,
  loadCommitLog,
  loadBranches,
  switchBranch,
  startScan,
  importScanResults,
  scanning,
  scanResults,
  scanDirInput,
  gitConcurrency,
  loadGitConcurrency,
  setGitConcurrency,
  stashEntries,
  stashLoading,
  loadStashList,
  doStashSave,
  doStashPop,
  doStashApply,
  doStashDrop,
  generateStashDesc,
  addRemoteOp,
  removeRemoteOp,
  editRemoteOp,
  // 统计视图数据
  projectCount,
  remoteCoverage,
  pushStatusStats,
  needsPushProjects,
  uncommittedProjects,
  noPlatformProjects,
  platformStatusProjects,
  // 项目聚合管理
  allTags,
  starredProjects,
  updateProjectMeta,
  toggleStar,
  setProjectStatus,
} = useGitPush(props.manager)

const showAddDialog = ref(false)
const showCatDialog = ref(false)
const showSettings = ref(false)
/** git 操作活跃数轮询 */
const activeGitOps = ref(0)
let opsPoller: ReturnType<typeof setInterval> | null = null
/** 当前视图: 'list' | 'stats' */
const currentView = ref<"list" | "stats">("list")
/** 当前选中的分类 ID（onMounted 中设为首个分类） */
const activeCategory = ref<string>("")

/** 扫描导入弹窗状态 */
const showScanDialog = ref(false)
const scanError = ref("")
const scanSelection = ref<Record<string, boolean>>({})
const selectedCount = computed(() =>
  Object.values(scanSelection.value).filter(Boolean).length,
)

/** 按分类 TAB 过滤后的分组 */
const visibleGroups = computed(() => {
  if (!activeCategory.value) return groupedProjects.value
  return groupedProjects.value.filter(g => g.category.id === activeCategory.value)
})
/** 项目搜索关键词 */
const searchQuery = ref("")

/** 智能视图模式：all=按分类 / needsPush=需推送 / uncommitted=有变更 / starred=已收藏 */
const viewMode = ref<"all" | "needsPush" | "uncommitted" | "starred">("all")
/** 是否显示归档项目（默认隐藏） */
const showArchived = ref(false)
/** 选中的标签（多选交集过滤） */
const selectedTags = ref<Set<string>>(new Set())

/** 智能视图模式元数据（标签 + 命中数） */
const VIEW_MODE_META: Record<typeof viewMode.value, { label: string; icon: string }> = {
  all: { label: "全部", icon: "mdi:view-grid-outline" },
  needsPush: { label: "需推送", icon: "mdi:cloud-upload-outline" },
  uncommitted: { label: "有变更", icon: "mdi:source-branch" },
  starred: { label: "收藏", icon: "mdi:star" },
}

/** 项目状态徽章元数据（颜色 + 文案 + 循环顺序） */
const STATUS_META: Record<string, { color: string; label: string; icon: string }> = {
  active: { color: "var(--b3-theme-success)", label: "活跃", icon: "mdi:circle-medium" },
  maintenance: { color: "var(--b3-theme-primary)", label: "维护中", icon: "mdi:circle-medium" },
  paused: { color: "var(--b3-theme-on-surface)", label: "暂停", icon: "mdi:pause-circle-outline" },
}
const STATUS_CYCLE: ProjectStatus[] = ["active", "maintenance", "paused"]

/** 把 ISO 时间转为相对时间文案（"刚刚/N分钟前/N天前/N个月前"），无法解析返回空 */
function relativeTime(iso?: string): string {
  if (!iso) return ""
  const t = Date.parse(iso)
  if (isNaN(t)) return ""
  const diff = Date.now() - t
  const min = 60 * 1000, hour = 60 * min, day = 24 * hour
  if (diff < min) return "刚刚"
  if (diff < hour) return `${Math.floor(diff / min)}分钟前`
  if (diff < day) return `${Math.floor(diff / hour)}小时前`
  if (diff < 30 * day) return `${Math.floor(diff / day)}天前`
  if (diff < 365 * day) return `${Math.floor(diff / (30 * day))}个月前`
  return `${Math.floor(diff / (365 * day))}年前`
}

/** 按活动时间分级（用于卡片颜色提示） */
function activityLevel(iso?: string): "fresh" | "recent" | "stale" | "dead" {
  if (!iso) return "dead"
  const t = Date.parse(iso)
  if (isNaN(t)) return "dead"
  const day = 24 * 60 * 60 * 1000
  const diff = Date.now() - t
  if (diff < 7 * day) return "fresh"
  if (diff < 30 * day) return "recent"
  if (diff < 90 * day) return "stale"
  return "dead"
}

/** 全局排序：starred 优先 → lastActivity 降序 → name */
function sortProjects(list: GitProject[]): GitProject[] {
  return [...list].sort((a, b) => {
    if (!!a.starred !== !!b.starred) return a.starred ? -1 : 1
    const ta = a.lastActivity ? Date.parse(a.lastActivity) : 0
    const tb = b.lastActivity ? Date.parse(b.lastActivity) : 0
    if (ta !== tb) return tb - ta
    return a.name.localeCompare(b.name)
  })
}

/** 智能视图模式下，命中条件的扁平项目列表 */
const smartViewProjects = computed<GitProject[]>(() => {
  if (viewMode.value === "needsPush") {
    const ids = new Set(needsPushProjects.value.map(n => n.project.id))
    return sortProjects(projects.value.filter(p => ids.has(p.id)))
  }
  if (viewMode.value === "uncommitted") {
    return sortProjects(uncommittedProjects.value.map(u => u.project))
  }
  if (viewMode.value === "starred") {
    return sortProjects(starredProjects.value)
  }
  return []
})

/** 统一筛选 + 分组管道：archived 过滤 → 标签交集 → 搜索词 → 分组/排序 */
const filteredGroups = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  const tags = selectedTags.value

  /** 应用三道过滤到一个项目列表 */
  const applyFilters = (list: GitProject[]) => {
    let r = list
    if (!showArchived.value) r = r.filter(p => !p.archived)
    if (tags.size > 0) r = r.filter(p => p.tags?.some(t => tags.has(t)))
    if (q) r = r.filter(p => p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q) || (p.tags?.some(t => t.toLowerCase().includes(q))))
    return r
  }

  // 智能视图：扁平成单个虚拟分组
  if (viewMode.value !== "all") {
    const filtered = applyFilters(smartViewProjects.value)
    if (filtered.length === 0) return []
    const meta = VIEW_MODE_META[viewMode.value]
    return [{
      category: { id: `__smart_${viewMode.value}__`, name: meta.label, color: "var(--b3-theme-primary)", order: -1 },
      projects: filtered,
    }]
  }

  // all 模式：沿用分类分组（visibleGroups 已按 activeCategory 过滤）
  return visibleGroups.value
    .map(g => ({ ...g, projects: applyFilters(g.projects) }))
    .map(g => ({ ...g, projects: sortProjects(g.projects) }))
    .filter(g => g.projects.length > 0)
})

const newProjectName = ref("")
const newProjectPath = ref("")
const newProjectCat = ref("__ungrouped__")
/** 添加项目时的初始标签（逗号分隔输入） */
const newProjectTags = ref("")
const newCatName = ref("")
const newCatColor = ref("#4a9eff")
const addError = ref("")
const addChecking = ref(false)
const addResult = ref<boolean | null>(null)
const refreshing = ref<string | null>(null)

/** 项目编辑弹窗状态 */
const editDialogProject = ref<GitProject | null>(null)
const editName = ref("")
const editStatus = ref<GitProject["status"]>("active")
const editStarred = ref(false)
const editArchived = ref(false)
const editNote = ref("")
const editTags = ref<string[]>([])
const editTagInput = ref("")
const editGithubUrl = ref("")
const editGiteeUrl = ref("")
const editGiteaUrl = ref("")
/** 行内名称编辑状态 */
const editingNameId = ref("")
const editingNameInput = ref("")
const refreshingAll = ref(false)
/** 远程仓库配置弹窗 */
const remoteConfigProject = ref<GitProject | null>(null)
const remoteList = ref<{ name: string; url: string }[]>([])
const newRemoteName = ref("")
const newRemoteUrl = ref("")
const remoteError = ref("")
/** 行内编辑远程 URL 状态 */
const editingRemoteName = ref("")
const editingRemoteUrl = ref("")
/** 提交输出 id → text */
const commitOutputs = ref<Record<string, string>>({})
/** AI 生成状态 id → { generating, text } */
const generatingMsgs = ref<Record<string, { generating: boolean; text: string }>>({})
/** 暂存/取消操作加载中 id → true */
const gitOpLoading = ref<Record<string, boolean>>({})
/** 提取指定项目相关的 fileDiffs（按前缀过滤） */
function fileDiffsForProject(projectId: string): Record<string, string> {
  const result: Record<string, string> = {}
  for (const [key, val] of Object.entries(fileDiffs.value)) {
    if (key.startsWith(`${projectId}::`)) {
      // 去掉 projectId 前缀作为组件内 key
      result[key.substring(projectId.length + 2)] = val
    }
  }
  return result
}

/** 提取指定项目相关的 commitLog */
function commitLogForProject(projectId: string): CommitLogEntry[] {
  return commitLogs.value[projectId] || []
}

/** 提交日志加载状态 */
const commitLogLoading = ref<Record<string, boolean>>({})

/** 已展开过的项目集合（避免重复懒加载详情） */
const expandedProjects = ref<Set<string>>(new Set())

/** 工作区面板首次展开时懒加载详情：commitLog + branches + stash
 *  首屏只加载了 workingTree/pushStatus，这三项延后到用户真正展开时才请求 */
async function handleExpand(projectId: string) {
  if (expandedProjects.value.has(projectId)) return
  expandedProjects.value.add(projectId)
  // 展开后立刻显示 loading 态
  commitLogLoading.value[projectId] = true
  try {
    await Promise.all([
      loadCommitLog(projectId),
      loadBranches(projectId),
      loadStashList(projectId),
    ])
  } finally {
    delete commitLogLoading.value[projectId]
  }
}

/** HEAD hash 缓存，用于跳过无变动项目的 commit log / branches 刷新 */
const headHashes = ref<Record<string, string>>({})

/** 静默刷新当前分类下的项目状态（批次处理，每批 3 个匹配 git 信号量上限） */
async function silentRefreshAll() {
  const catId = activeCategory.value
  if (!catId) return
  const projList = projects.value.filter(p => p.categoryId === catId)
  if (projList.length === 0) return

  await batchProcess(projList, 3, async (p) => {
    const prev = headHashes.value[p.id] || ""
    const [, curr] = await Promise.all([
      loadPushStatus(p.id),
      props.manager.getHeadHash(p.path),
    ])

    if (curr && curr !== prev) {
      headHashes.value[p.id] = curr
      await Promise.all([
        loadWorkingTree(p.id),
        loadCommitLog(p.id),
        loadBranches(p.id),
        loadStashList(p.id),
      ])
    } else if (curr) {
      await Promise.all([
        loadWorkingTree(p.id),
        loadStashList(p.id),
      ])
    }
  })
}

onMounted(async () => {
  await loadProjects()
  // 默认选中第一个分类
  if (!activeCategory.value && groupedProjects.value.length > 0) {
    activeCategory.value = groupedProjects.value[0].category.id
  }
  loadGitConcurrency()
  // 轮询 git 操作活跃数
  opsPoller = setInterval(() => { activeGitOps.value = props.manager.activeGitOps }, 120)
  // 首屏只加载显示卡片所需的最小集：工作区变更摘要 + 推送状态。
  // commitLog/branches/stash 改为展开工作区面板时按需懒加载（见 @expand）。
  // getHeadHash 仅刷新去重用，首屏无历史值可对比，跳过。
  setTimeout(async () => {
    const catId = activeCategory.value
    const projList = catId ? projects.value.filter(p => p.categoryId === catId) : projects.value
    await batchProcess(projList, 3, async (p) => {
      await Promise.all([
        // 首屏 index 未被本进程改动，跳过 update-index --refresh 提速
        loadWorkingTree(p.id, true),
        loadPushStatus(p.id),
      ])
    })
  }, 200)
})

onUnmounted(() => {
  if (opsPoller) { clearInterval(opsPoller); opsPoller = null }
})

/** 切换分类时懒加载该分类下项目的数据（首屏最小集，详情展开时再补） */
watch(activeCategory, async (catId) => {
  if (!catId) return
  const projList = projects.value.filter(p => p.categoryId === catId)
  if (projList.length === 0) return
  // 只加载尚未缓存的
  const pending = projList.filter(p => !workingTrees.value[p.id])
  if (pending.length === 0) return
  await batchProcess(pending, 3, async (p) => {
    await Promise.all([
      loadWorkingTree(p.id, true),
      loadPushStatus(p.id),
    ])
  })
})

/** 切换到统计视图时，补齐统计面板所需的最小数据集（pushStatus + workingTree）。
 *  commitLog/branches/stash 不在统计视图中展示，无需加载。
 *  使用 loadStatsData 共用 rev-parse，避免 loadPushStatus/loadWorkingTree 各调一次 */
watch(currentView, async (view) => {
  if (view !== "stats") return
  const pending = projects.value.filter(p => !pushStatuses.value[p.id] || !workingTrees.value[p.id])
  if (pending.length === 0) return
  await batchProcess(pending, 3, async (p) => {
    await loadStatsData(p.id)
  })
})

async function handleAdd() {
  addError.value = ""
  if (!newProjectName.value.trim()) {
    addError.value = "请输入项目名称"
    return
  }
  if (!newProjectPath.value.trim()) {
    addError.value = "请输入项目路径"
    return
  }

  addChecking.value = true
  addResult.value = null
  try {
    const isGit = await checkIsGitRepo(newProjectPath.value.trim())
    addResult.value = isGit
    // 解析标签（逗号分隔，去重去空白）
    const tags = newProjectTags.value
      .split(/[,，]/)
      .map(t => t.trim())
      .filter(Boolean)
    const seen = new Set<string>()
    const dedupTags = tags.filter(t => (seen.has(t) ? false : (seen.add(t), true)))
    // 即使不是 git 仓库也允许添加（用户可能后续初始化）
    await addProject(newProjectName.value.trim(), newProjectPath.value.trim(), newProjectCat.value, dedupTags.length > 0 ? dedupTags : undefined)
    showAddDialog.value = false
    newProjectName.value = ""
    newProjectPath.value = ""
    newProjectCat.value = "__ungrouped__"
    newProjectTags.value = ""
    addResult.value = null
  } catch (e: any) {
    addError.value = e?.message || "添加失败"
  } finally {
    addChecking.value = false
  }
}

async function handleRefresh(id: string) {
  refreshing.value = id
  try {
    // 并行执行：remote 检测 + push 状态一组，工作区/日志/分支/stash 一组
    await Promise.all([
      refreshRemotes(id),
      loadPushStatus(id),
    ])
    await Promise.all([
      loadWorkingTree(id),
      loadCommitLog(id),
      loadBranches(id),
      loadStashList(id),
    ])
  } finally {
    refreshing.value = null
  }
}

async function handleRefreshAll() {
  refreshingAll.value = true
  try {
    await silentRefreshAll()
  } finally {
    refreshingAll.value = false
  }
}

/** 从统计视图跳转到指定项目 */
function onViewProject(projectId: string) {
  const project = projects.value.find(p => p.id === projectId)
  if (!project) return
  // 切换到列表视图
  currentView.value = "list"
  // 切换到项目所属分类
  if (project.categoryId) {
    activeCategory.value = project.categoryId
  }
  // 设置搜索词为项目名称，方便快速定位
  searchQuery.value = project.name
}

/** 在文件管理器中打开项目路径 */
async function handleOpenPath(path: string) {
  if (typeof window.require === "function") {
    try {
      const electron = window.require("electron")
      const shell = electron.shell || electron.remote?.shell
      if (shell?.openPath) {
        await shell.openPath(path)
        return
      }
    } catch {
      // 降级
    }
  }
  // 浏览器环境：无法直接打开本地文件夹
}

/** 将 git URL 转为浏览器可访问的 web URL */
function gitUrlToWebUrl(url: string): string {
  // https://github.com/user/repo.git → https://github.com/user/repo
  if (url.startsWith("https://") || url.startsWith("http://")) {
    return url.replace(/\.git$/, "")
  }
  // git@github.com:user/repo.git → https://github.com/user/repo
  const sshMatch = url.match(/^git@([^:]+):(.+?)(?:\.git)?$/)
  if (sshMatch) {
    return `https://${sshMatch[1]}/${sshMatch[2]}`
  }
  return url
}

/** 在浏览器中打开远程仓库网页 */
async function handleOpenWeb(url: string) {
  const webUrl = gitUrlToWebUrl(url)
  if (typeof window.require === "function") {
    try {
      const electron = window.require("electron")
      const shell = electron.shell || electron.remote?.shell
      if (shell?.openExternal) {
        await shell.openExternal(webUrl)
        return
      }
    } catch {
      // 降级
    }
  }
  window.open(webUrl, "_blank")
}

/** 右键复制远程仓库链接 */
async function handleCopyUrl(url: string) {
  const ok = await copyToClipboard(url)
  if (ok) {
    // 用临时 tooltip 提示已复制（无外部依赖，纯 DOM）
    const el = document.activeElement as HTMLElement | null
    if (el) {
      const orig = el.title
      el.title = "已复制链接 ✓"
      setTimeout(() => { el.title = orig }, 1500)
    }
  }
}

function handleRemove(project: any) {
  if (confirm(`确定要删除项目 "${project.name}" 吗？`)) {
    removeProject(project.id)
  }
}

async function handleSwitchBranch(id: string, branch: string) {
  try {
    await switchBranch(id, branch)
  } catch (e: any) {
    alert(`分支切换失败: ${e?.message || e}`)
  }
}

// ---- 项目聚合管理操作 ----

/** 切换标签筛选（多选交集） */
function toggleTagFilter(tag: string) {
  const next = new Set(selectedTags.value)
  if (next.has(tag)) next.delete(tag)
  else next.add(tag)
  selectedTags.value = next
}

/** 状态徽章循环切换 active → maintenance → paused → active */
async function cycleStatus(id: string, current?: ProjectStatus) {
  const cur: ProjectStatus = current || "active"
  const idx = STATUS_CYCLE.indexOf(cur)
  const next = STATUS_CYCLE[(idx + 1) % STATUS_CYCLE.length]
  await setProjectStatus(id, next)
}

/** 打开项目编辑弹窗 */
function openEditDialog(project: GitProject) {
  editDialogProject.value = project
  editName.value = project.name
  editStatus.value = project.status || "active"
  editStarred.value = !!project.starred
  editArchived.value = !!project.archived
  editNote.value = project.note || ""
  editTags.value = [...(project.tags || [])]
  editTagInput.value = ""
  editGithubUrl.value = project.githubUrl || ""
  editGiteeUrl.value = project.giteeUrl || ""
  editGiteaUrl.value = project.giteaUrl || ""
}

/** 行内名称编辑：点击名称开始编辑 */
function startNameEdit(project: GitProject) {
  editingNameId.value = project.id
  editingNameInput.value = project.name
}

/** 行内名称编辑：失焦/回车保存 */
async function handleNameEditSave(project: GitProject) {
  const newName = editingNameInput.value.trim()
  if (newName && newName !== project.name) {
    await updateProjectMeta(project.id, { name: newName })
  }
  editingNameId.value = ""
}

/** 编辑弹窗：添加标签（Enter 确认） */
function handleEditAddTag() {
  const t = editTagInput.value.trim()
  if (t && !editTags.value.includes(t)) {
    editTags.value = [...editTags.value, t]
  }
  editTagInput.value = ""
}

/** 编辑弹窗：移除标签 */
function handleEditRemoveTag(tag: string) {
  editTags.value = editTags.value.filter(t => t !== tag)
}

/** 编辑弹窗：保存 */
async function handleEditSave() {
  const project = editDialogProject.value
  if (!project) return
  await updateProjectMeta(project.id, {
    name: editName.value.trim() || project.name,
    status: editStatus.value,
    starred: editStarred.value,
    archived: editArchived.value,
    note: editNote.value.trim() || undefined,
    tags: editTags.value.length > 0 ? editTags.value : undefined,
    githubUrl: editGithubUrl.value.trim() || undefined,
    giteeUrl: editGiteeUrl.value.trim() || undefined,
    giteaUrl: editGiteaUrl.value.trim() || undefined,
  })
  editDialogProject.value = null
}

// ---- 工作区操作 ----

/** 统一的 git 操作错误处理包装（含 loading 状态和调试日志） */
async function handleGitOp(label: string, fn: () => Promise<void>, id: string) {
  commitOutputs.value[id] = ""
  gitOpLoading.value[id] = true
  console.log(`[gitPush] ${label} 操作开始`)
  try {
    await fn()
    console.log(`[gitPush] ${label} 操作成功`)
  } catch (e: any) {
    console.error(`[gitPush] ${label} 失败:`, e)
    commitOutputs.value[id] = `${label}: ${e?.message || e}`
  } finally {
    delete gitOpLoading.value[id]
  }
}

async function handleDiscard(id: string, file: string, staged: boolean, status: string) {
  const label = status === "untracked" ? "删除未跟踪文件" : "丢弃更改"
  if (!confirm(`确定要${label} "${file}" 吗？此操作不可撤销。`)) return
  commitOutputs.value[id] = ""
  gitOpLoading.value[id] = true
  try {
    await discardFile(id, file, staged, status)
    await loadWorkingTree(id)
  } catch (e: any) {
    commitOutputs.value[id] = `${label}失败: ${e?.message || e}`
  } finally {
    delete gitOpLoading.value[id]
  }
}

// ---- Stash 操作 ----

const stashInputProject = ref("")
const stashInputMsg = ref("")
const genStashDescLoading = ref<Record<string, boolean>>({})

async function handleGenStashDesc(id: string) {
  genStashDescLoading.value[id] = true
  try {
    const desc = await generateStashDesc(id)
    if (desc) stashInputMsg.value = desc
  } catch {
    // 失败则保持输入内容不变
  } finally {
    delete genStashDescLoading.value[id]
  }
}

async function handleStashConfirm(id: string) {
  const ts = new Date().toLocaleString()
  const desc = stashInputMsg.value.trim()
  const msg = desc ? `${ts} - ${desc}` : ts
  stashInputProject.value = ""
  stashInputMsg.value = ""
  try {
    await doStashSave(id, msg)
  } catch (e: any) {
    alert(`暂存失败: ${e?.message || e}`)
  }
}

async function handleStashPop(id: string, index: number) {
  if (!confirm(`确定恢复 stash@{${index}} 并删除该条目？恢复过程中如有冲突会保留该 stash。`)) return
  try {
    await doStashPop(id, index)
  } catch (e: any) {
    alert(`恢复失败: ${e?.message || e}`)
  }
}

async function handleStashApply(id: string, index: number) {
  try {
    await doStashApply(id, index)
  } catch (e: any) {
    alert(`应用失败: ${e?.message || e}`)
  }
}

async function handleStashDrop(id: string, index: number) {
  if (!confirm(`确定删除 stash@{${index}}？此操作不可撤销。`)) return
  try {
    await doStashDrop(id, index)
  } catch (e: any) {
    alert(`删除失败: ${e?.message || e}`)
  }
}

async function handleCommit(id: string, message: string) {
  commitOutputs.value[id] = ""
  try {
    const result = await doCommit(id, message)
    commitOutputs.value[id] = result || "提交成功"
    await loadCommitLog(id)
  } catch (e: any) {
    commitOutputs.value[id] = `提交失败: ${e?.message || e}`
  }
}

async function handleGenerateMsg(id: string) {
  generatingMsgs.value = { ...generatingMsgs.value, [id]: { generating: true, text: "" } }
  commitOutputs.value[id] = ""
  try {
    const result = await generateCommitMsg(id)
    generatingMsgs.value = { ...generatingMsgs.value, [id]: { generating: false, text: result.message } }
    if (result.source === "heuristic") {
      commitOutputs.value[id] = "⚠️ AI 未返回有效信息，已使用启发式生成。"
    }
  } catch (e: any) {
    commitOutputs.value[id] = `❌ 生成失败: ${e?.message || e}`
    generatingMsgs.value = { ...generatingMsgs.value, [id]: { generating: false, text: "" } }
  }
}

// ---- 分类管理 ----

async function handleAddCategory() {
  const name = newCatName.value.trim()
  if (!name) return
  await addCategoryFn(name, newCatColor.value)
  newCatName.value = ""
}

async function handleDeleteCategory(id: string) {
  const cat = categories.value.find(c => c.id === id)
  if (!cat || !confirm(`确定删除分类 "${cat.name}"？\n该分类下的项目将移至「未分组」。`)) return
  // 如果删除的是当前选中分类，切到第一个可用分类
  if (activeCategory.value === id) {
    const others = groupedProjects.value.filter(g => g.category.id !== id)
    activeCategory.value = others.length > 0 ? others[0].category.id : ""
  }
  await deleteCategoryFn(id)
}

async function handleMoveProject(projectId: string, categoryId: string) {
  await moveProject(projectId, categoryId)
}

async function handleSaveConcurrency() {
  await setGitConcurrency(gitConcurrency.value)
  showSettings.value = false
}

async function openRemoteConfig(project: GitProject) {
  remoteError.value = ""
  newRemoteName.value = "github"
  newRemoteUrl.value = ""
  try {
    remoteList.value = await props.manager.detectRemotes(project.path)
  } catch {
    remoteList.value = []
  }
  remoteConfigProject.value = project
}

async function handleAddRemote(id: string) {
  remoteError.value = ""
  try {
    await addRemoteOp(id, newRemoteName.value.trim(), newRemoteUrl.value.trim())
    newRemoteName.value = "github"
    newRemoteUrl.value = ""
    const project = projects.value.find(p => p.id === id)
    if (project) remoteList.value = await props.manager.detectRemotes(project.path)
  } catch (e: any) {
    remoteError.value = e?.message || "添加失败"
  }
}

async function handleRemoveRemote(id: string, name: string) {
  remoteError.value = ""
  try {
    await removeRemoteOp(id, name)
    const project = projects.value.find(p => p.id === id)
    if (project) remoteList.value = await props.manager.detectRemotes(project.path)
  } catch (e: any) {
    remoteError.value = e?.message || "删除失败"
  }
}

/** 开始行内编辑远程 URL */
function startEditRemote(name: string, url: string) {
  editingRemoteName.value = name
  editingRemoteUrl.value = url
}

/** 保存行内编辑的远程 URL */
async function handleEditRemote(id: string, name: string) {
  remoteError.value = ""
  const newUrl = editingRemoteUrl.value.trim()
  if (!newUrl) return
  try {
    await editRemoteOp(id, name, newUrl)
    editingRemoteName.value = ""
    editingRemoteUrl.value = ""
    const project = projects.value.find(p => p.id === id)
    if (project) remoteList.value = await props.manager.detectRemotes(project.path)
  } catch (e: any) {
    remoteError.value = e?.message || "修改失败"
  }
}

/** 获取远程推送状态标签文案 */
function statusLabel(projectId: string, remoteKey: string): string {
  const status = pushStatuses.value[projectId]
  const rs = status?.remotes[remoteKey]
  if (!rs) return ""
  if (rs.noUpstream) return `+${rs.ahead}`
  if (rs.ahead > 0) return `↑${rs.ahead}`
  if (rs.behind > 0) return `↓${rs.behind}`
  return "✓"
}

/** 获取状态 badge 的 CSS 类 */
function statusBadgeClass(projectId: string, remoteKey: string): string {
  const status = pushStatuses.value[projectId]
  const rs = status?.remotes[remoteKey]
  if (!rs) return ""
  if (rs.noUpstream || rs.ahead > 0) return "gp-ahead"
  if (rs.behind > 0) return "gp-behind"
  return "gp-synced"
}

/** 判断某个远程是否需要推送（本地超前或从未推送） */
function needsPushFor(projectId: string, remoteKey: string): boolean {
  const status = pushStatuses.value[projectId]
  const rs = status?.remotes[remoteKey]
  if (!rs) return true // 尚未检测，允许点击
  return rs.noUpstream || rs.ahead > 0
}

/** 判断项目是否有远程落后（远程有新提交） */
function hasBehind(projectId: string): boolean {
  const status = pushStatuses.value[projectId]
  if (!status) return false
  return Object.values(status.remotes).some(r => r.behind > 0)
}

async function selectDirectory() {
  const path = await pickDirectory("选择项目目录")
  if (path) newProjectPath.value = path
}

// ---- 扫描导入 ----

function handleOpenScan() {
  scanError.value = ""
  scanDirInput.value = ""
  scanResults.value = []
  scanSelection.value = {}
  showScanDialog.value = true
}

function handleCloseScan() {
  showScanDialog.value = false
  scanError.value = ""
}

async function handleStartScan() {
  scanError.value = ""
  try {
    await startScan(scanDirInput.value.trim())
    // 扫描成功 → 自动全选未导入项
    const sel: Record<string, boolean> = {}
    for (const repo of scanResults.value) {
      if (!repo.alreadyImported) {
        sel[repo.path] = true
      }
    }
    scanSelection.value = sel
  } catch (e: any) {
    scanError.value = e?.message || (props.i18n.scanError || '扫描失败')
  }
}

function handleToggleSelectAll() {
  const allSelected = scanResults.value.every(
    r => r.alreadyImported || scanSelection.value[r.path],
  )
  const sel: Record<string, boolean> = {}
  for (const repo of scanResults.value) {
    if (!repo.alreadyImported) {
      sel[repo.path] = !allSelected
    }
  }
  scanSelection.value = sel
}

function toggleScanItem(path: string) {
  scanSelection.value = { ...scanSelection.value, [path]: !scanSelection.value[path] }
}

async function handleImportSelected() {
  const selected = scanResults.value
    .filter(r => scanSelection.value[r.path])
    .map(r => r.path)
  const catId = activeCategory.value || "__ungrouped__"
  await importScanResults(selected, catId)
  handleCloseScan()
}

/** 扫描目录专用路径选择，结果写入 scanDirInput */
async function selectScanDirectory() {
  const path = await pickDirectory("选择要扫描的目录")
  if (path) scanDirInput.value = path
}
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "./styles/variables" as *;
@use "./styles/mixins" as *;
@use "./styles/buttons";
@use "./styles/shared";
@use "./styles/index.scss";
</style>
