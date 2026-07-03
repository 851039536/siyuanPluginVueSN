<!-- gitPush Git 项目管理主面板 -->
<template>
  <div class="git-push-panel">
    <!-- 头部 -->
    <PanelHeader
      v-model:currentView="currentView"
      v-model:showPlatformMenu="showPlatformMenu"
      v-model:showAddMenu="showAddMenu"
      :i18n="i18n"
      :project-count="projectCount"
      :refreshing-all="refreshingAll"
      :needs-push-count="needsPushCount"
      :pushing-all-projects="pushingAllProjects"
      :push-all-done="pushAllDone"
      :push-all-total="pushAllTotal"
      @open-category="showCatDialog = true"
      @open-settings="showSettings = true"
      @refresh-all="handleRefreshAll"
      @push-all-projects="handlePushAllProjects"
      @cancel-push-all="pushingAllProjects = false"
      @open-add-project="showAddDialog = true"
      @open-scan="handleOpenScan"
      @open-web="handleOpenWeb"
    />

    <div class="gp-divider" />

    <!-- git 操作进度条 -->
    <div
      v-if="activeGitOps > 0"
      class="gp-progress-bar"
    />

    <!-- ========== 统计视图 ========== -->
    <StatsPanel
      v-if="currentView === 'stats'"
      :i18n="i18n"
      :project-count="projectCount"
      :remote-coverage="remoteCoverage"
      :push-status-stats="pushStatusStats"
      :needs-push-projects="needsPushProjects"
      :uncommitted-projects="uncommittedProjects"
      :platform-status-projects="platformStatusProjects"
      @view-project="onViewProject"
    />

    <!-- ========== 列表视图 ========== -->
    <template v-if="currentView === 'list'">
      <!-- 筛选工具栏（智能视图 + 归档 toggle + 标签筛选） -->
      <div
        v-if="projects.length > 0"
        class="gp-filter-bar"
      >
        <div class="gp-view-modes">
          <button
            v-for="vm in (['all', 'needsPush', 'uncommitted', 'starred', 'archived'] as const)"
            :key="vm"
            class="gp-vm-btn"
            :class="{ active: viewMode === vm }"
            :title="VIEW_MODE_META[vm].label"
            @click="viewMode = vm"
          >
            <Icon
              :icon="VIEW_MODE_META[vm].icon"
              height="12"
            />
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
            <Icon
              icon="mdi:archive-outline"
              height="12"
            />
            <span v-if="showArchived">含归档</span>
          </button>
          <button
            class="gp-ft-btn"
            :class="{ active: gitOpsPaused }"
            :title="gitOpsPaused ? '已暂停 Git 状态加载' : '暂停 Git 状态加载'"
            @click="gitOpsPaused = !gitOpsPaused"
          >
            <Icon
              :icon="gitOpsPaused ? 'mdi:pause-circle' : 'mdi:pause-circle-outline'"
              height="12"
            />
            <span v-if="gitOpsPaused">已暂停</span>
          </button>
        </div>
      </div>

      <!-- 标签筛选条（有标签时显示） -->
      <div
        v-if="allTags.length > 0 && projects.length > 0"
        class="gp-tag-filter"
      >
        <button
          v-for="t in allTags"
          :key="t"
          class="gp-tag-chip"
          :class="{ active: selectedTags.has(t) }"
          @click="toggleTagFilter(t)"
        >{{ t }}</button>
      </div>

      <!-- 分类 TAB 导航（仅 all 模式显示） -->
      <div
        v-if="viewMode === 'all' && groupedProjects.length > 0"
        class="gp-tabs"
      >
        <button
          v-for="g in groupedProjects"
          :key="g.category.id"
          class="gp-tab"
          :class="{ active: activeCategory === g.category.id }"
          :style="activeCategory === g.category.id ? { borderBottomColor: g.category.color } : {}"
          @click="activeCategory = g.category.id"
        >
          <span
            class="gp-tab-dot"
            :style="{ background: g.category.color }"
          />
          <span>{{ g.category.name }}</span>
          <span class="gp-tab-count">{{ g.projects.length }}</span>
        </button>
      </div>

      <!-- 搜索框 -->
      <div
        v-if="projects.length > 0"
        class="gp-search-wrap"
      >
        <Icon
          icon="mdi:magnify"
          class="gp-search-icon"
          height="12"
        />
        <input
          v-model="searchQuery"
          class="gp-search-input"
          :placeholder="i18n.searchPlaceholder || '搜索项目...'"
        />
        <button
          v-if="searchQuery"
          class="gp-search-clear"
          @click="searchQuery = ''"
        >
          <Icon
            icon="mdi:close"
            height="12"
          />
        </button>
      </div>

      <!-- 项目列表 -->
      <div
        v-if="loading"
        class="gp-loading"
      >
        {{ i18n.loading || '加载中...' }}
      </div>

      <div
        v-else-if="projects.length === 0"
        class="gp-empty"
      >
        <div class="gp-empty-icon">
          <Icon
            icon="mdi:source-repository"
            width="48"
            height="48"
          />
        </div>
        <div class="gp-empty-text">
          {{ i18n.noProjects || '暂无项目，点击上方添加' }}
        </div>
      </div>

      <div
        v-else
        class="gp-list"
        style="display: flex !important; flex-wrap: wrap !important; width: 100% !important; align-content: flex-start;"
      >
        <template
          v-for="group in filteredGroups"
          :key="group.category.id"
        >
          <div
            v-for="project in group.projects"
            :key="project.id"
            class="gp-card"
            style="box-sizing: border-box !important; flex: 1 1 calc(50% - 10px) !important; min-width: 390px !important;"
            @click="handleCardClick(project.id, $event)"
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
                    <Icon
                      :icon="project.starred ? 'mdi:star' : 'mdi:star-outline'"
                      height="12"
                    />
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
                    class="gp-project-status-btn"
                    :class="`gp-psb-${project.status || 'active'}`"
                    :title="`状态: ${STATUS_META[project.status || 'active'].label}（点击切换）`"
                    @click.stop="cycleStatus(project.id, project.status)"
                  >
                    <Icon
                      :icon="STATUS_META[project.status || 'active'].icon"
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
                </div>
                <!-- 标签 + 最后活动时间 -->
                <div class="gp-card-meta">
                  <div
                    v-if="project.tags?.length"
                    class="gp-card-tags"
                  >
                    <span
                      v-for="t in project.tags.slice(0, 3)"
                      :key="t"
                      class="gp-card-tag"
                      :class="{ active: selectedTags.has(t) }"
                      :title="`点击筛选标签: ${t}`"
                      @click.stop="toggleTagFilter(t)"
                    >{{ t }}</span>
                    <span
                      v-if="project.tags.length > 3"
                      class="gp-card-tag gp-card-tag-more"
                    >+{{ project.tags.length - 3 }}</span>
                  </div>
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
                <!-- 分支标签 -->
                <div
                  v-if="branches[project.id]?.length"
                  class="gp-branch-row"
                >
                  <Icon
                    icon="mdi:source-branch"
                    height="12"
                  />
                  <button
                    v-for="b in branches[project.id]"
                    :key="b.name"
                    class="gp-branch-tag"
                    :class="{ current: b.current }"
                    :title="b.current ? '当前分支' : `切换到 ${b.name}`"
                    @click="handleSwitchBranch(project.id, b.name)"
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
                <template
                  v-for="pm in PLATFORM_META"
                  :key="pm.key"
                >
                  <button
                    v-if="getProjectUrl(project, pm.urlProp)"
                    class="vp-btn vp-btn--ghost vp-btn--sm"
                    :title="`打开 ${pm.label}（右键复制链接）`"
                    @click="handleOpenWeb(getProjectUrl(project, pm.urlProp)!)"
                    @contextmenu.prevent="handleCopyUrl(getProjectUrl(project, pm.urlProp)!)"
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
                    @click.stop="toggleIdeMenu(project.id)"
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
                      @click="handleOpenPath(resolvedPath(project)); openIdeMenu.delete(project.id)"
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
                      @click="handleOpenIde(resolvedPath(project), ide); openIdeMenu.delete(project.id)"
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
                      @click="handleOpenCustomIde(resolvedPath(project), custom.name, custom.path); openIdeMenu.delete(project.id)"
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
                          @click.stop="doRemoveCustomIde(idx)"
                        >
                          是
                        </button>
                        <button
                          class="gp-ide-del-no"
                          @click.stop="confirmingDelIdx = -1"
                        >
                          否
                        </button>
                      </template>
                      <button
                        v-else
                        class="gp-ide-item-del"
                        title="删除此自定义 IDE"
                        @click.stop="confirmingDelIdx = idx"
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
                      @click.stop="showIdeDialog = true; openIdeMenu.delete(project.id)"
                    >
                      <Icon
                        icon="mdi:cog-outline"
                        height="12"
                      />
                      <span>管理 IDE...</span>
                    </button>
                  </div>
                </div>
                <button
                  class="vp-btn vp-btn--ghost vp-btn--sm"
                  title="重新检测远程仓库"
                  @click="handleRefresh(project.id)"
                >
                  <Icon
                    icon="mdi:refresh"
                    height="12"
                    :class="{ 'gp-spin': refreshing === project.id }"
                  />
                </button>
                <button
                  class="vp-btn vp-btn--ghost vp-btn--sm"
                  title="编辑项目（标签/状态/备注）"
                  @click="openEditDialog(project)"
                >
                  <Icon
                    icon="mdi:pencil-outline"
                    height="12"
                  />
                </button>
                <button
                  class="vp-btn vp-btn--ghost vp-btn--sm gp-btn-danger"
                  @click="handleRemove(project)"
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
              <div
                v-for="r in REMOTES"
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
                  v-if="pushStatuses[project.id]?.remotes[r.key]"
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
              :commit-templates="commitTemplates"
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
            <StashSection
              :entries="stashEntries[project.id]"
              :loading="stashLoading[project.id] || false"
              :has-changes="!!workingTrees[project.id]?.hasChanges"
              :gen-desc-loading="genStashDescLoading[project.id] || false"
              :generated-msg="generatedStashMsg"
              :i18n="i18n"
              @stash-confirm="(msg) => handleStashConfirmMsg(project.id, msg)"
              @gen-stash-desc="handleGenStashDesc(project.id)"
              @stash-pop="(idx) => handleStashPop(project.id, idx)"
              @stash-apply="(idx) => handleStashApply(project.id, idx)"
              @stash-drop="(idx) => handleStashDrop(project.id, idx)"
            />

            <!-- Tag 管理 -->
            <TagPanel
              :tags="tagsCache[project.id] || []"
              :loading="tagLoading[project.id]"
              :push-loaded="tagPushLoading[project.id]"
              :remotes="PLATFORM_META.filter(pm => project[pm.remoteProp]).map(pm => ({
                key: pm.key,
                icon: pm.icon,
              }))"
              :i18n="i18n"
              @create="(p) => handleCreateTag(project.id, p.name, p.message)"
              @push="(p) => handlePushTag(project.id, p.tag)"
              @delete="(p) => handleDeleteTag(project.id, p.tag)"
            />

            <!-- 冲突警告 -->
            <ConflictSection
              :conflicts="conflicts[project.id]"
              :i18n="i18n"
              @resolve-conflict="(file, strategy) => handleResolveConflict(project.id, file, strategy)"
              @abort-merge="handleAbortMerge(project.id)"
            />

            <!-- 操作栏：拉取 / 推送 -->
            <div class="gp-actions-bar">
              <!-- 拉取区 -->
              <div class="gp-actions-section">
                <span class="gp-actions-label">{{ i18n.pull || '拉取' }}</span>
                <div class="gp-actions-btns">
                  <button
                    v-for="r in REMOTES"
                    :key="`pull-${r.key}`"
                    class="vp-btn vp-btn--ghost vp-btn--sm gp-action-btn"
                    :class="{ 'gp-action-btn--active': isPulling(project.id, r.key) }"
                    :disabled="!project[r.remoteProp] || isPulling(project.id) || isPushing(project.id)"
                    :title="`${i18n.pull || 'Pull'} ${r.label}`"
                    @click="confirmPullSingle(project.id, r.key)"
                  >
                    <Icon
                      v-if="isPulling(project.id, r.key)"
                      icon="mdi:loading"
                      class="gp-spin"
                      height="12"
                    />
                    <Icon
                      v-else
                      :icon="r.icon"
                      height="12"
                    />
                    <span>{{ r.label }}</span>
                  </button>
                  <!-- Fetch 按钮 -->
                  <button
                    class="vp-btn vp-btn--ghost vp-btn--sm gp-action-btn gp-fetch-btn"
                    :class="{ 'gp-action-btn--active': fetching[project.id] }"
                    :disabled="!hasAnyRemote(project) || isPulling(project.id) || isPushing(project.id) || fetching[project.id]"
                    :title="i18n.fetchHint || '获取最新远程状态'"
                    @click="handleFetchAll(project.id)"
                  >
                    <Icon
                      v-if="fetching[project.id]"
                      icon="mdi:loading"
                      class="gp-spin"
                      height="12"
                    />
                    <Icon
                      v-else
                      icon="mdi:cloud-download"
                      height="12"
                    />
                    <span>{{ i18n.fetchAll || 'Fetch' }}</span>
                  </button>
                </div>
              </div>

              <!-- 分隔线 -->
              <div class="gp-actions-sep" />

              <!-- 推送区 -->
              <div class="gp-actions-section">
                <span class="gp-actions-label">{{ i18n.push || '推送' }}</span>
                <div class="gp-actions-btns">
                  <button
                    v-for="r in REMOTES"
                    :key="`push-${r.key}`"
                    class="vp-btn vp-btn--ghost vp-btn--sm gp-action-btn"
                    :class="{
                      'gp-action-btn--ok': getPushStatus(project.id, r.key) === 'ok',
                      'gp-action-btn--fail': getPushStatus(project.id, r.key) === 'fail',
                      'gp-action-btn--active': getPushStatus(project.id, r.key) === 'pushing',
                    }"
                    :disabled="!project[r.remoteProp] || isPushing(project.id) || isPulling(project.id) || !needsPushFor(project.id, r.key)"
                    :title="`${i18n.push || 'Push'} ${r.label}`"
                    @click="pushSingle(project.id, r.key)"
                  >
                    <Icon
                      v-if="getPushStatus(project.id, r.key) === 'pushing'"
                      icon="mdi:loading"
                      class="gp-spin"
                      height="12"
                    />
                    <Icon
                      v-else-if="getPushStatus(project.id, r.key) === 'ok'"
                      icon="mdi:check-circle"
                      height="12"
                    />
                    <Icon
                      v-else-if="getPushStatus(project.id, r.key) === 'fail'"
                      icon="mdi:close-circle"
                      height="12"
                    />
                    <Icon
                      v-else
                      :icon="r.icon"
                      height="12"
                    />
                    <span>{{ getPushStatus(project.id, r.key) === 'pushing' ? i18n.pushing || '推送中…' : getPushStatus(project.id, r.key) === 'ok' ? i18n.done || '完成' : getPushStatus(project.id, r.key) === 'fail' ? i18n.failed || '失败' : r.label }}</span>
                  </button>

                  <!-- 推送全部 -->
                  <button
                    v-if="!isPushing(project.id)"
                    class="vp-btn vp-btn--primary vp-btn--sm gp-action-btn"
                    :disabled="(!project.githubRemote && !project.giteeRemote && !project.giteaRemote && !project.cnbRemote) || isPulling(project.id) || !pushStatuses[project.id]?.needsPush"
                    @click="pushToAll(project.id)"
                  >
                    <Icon
                      icon="mdi:cloud-upload"
                      height="12"
                    />
                    <span>{{ i18n.pushAll || '推送全部' }}</span>
                  </button>

                  <!-- 取消推送 -->
                  <button
                    v-else
                    class="vp-btn vp-btn--danger vp-btn--sm gp-action-btn"
                    @click="cancelPush(project.id)"
                  >
                    <Icon
                      icon="mdi:close-circle"
                      height="12"
                    />
                    <span>{{ i18n.cancel || '取消' }}</span>
                  </button>
                </div>
              </div>
            </div>

            <!-- 拉取输出 -->
            <OutputPanel
              :entries="pullOutputs[project.id]"
              :copy-text="entriesToText(pullOutputs[project.id])"
              :i18n="i18n"
              @copy="handleCopyOutput"
            />

            <!-- 推送输出 -->
            <OutputPanel
              :entries="pushOutputs[project.id]"
              :copy-text="entriesToText(pushOutputs[project.id])"
              :i18n="i18n"
              @copy="handleCopyOutput"
            />
          </div>
        </template>
      </div>
    </template>
    <!-- 列表视图结束 -->

    <AddProjectDialog
      v-if="showAddDialog"
      :i18n="i18n"
      :categories="categories"
      :selected-path="newProjectPath"
      @close="showAddDialog = false"
      @pick-dir="selectDirectory"
      @add="handleAddFromDialog"
    />
    <CategoryDialog
      v-if="showCatDialog"
      :i18n="i18n"
      :categories="categories"
      @close="showCatDialog = false"
      @add-category="handleAddCategory"
      @delete-category="handleDeleteCategory"
    />
    <SettingsDialog
      v-if="showSettings"
      :i18n="i18n"
      :concurrency="gitConcurrency"
      :push-branch-mode="pushBranchMode"
      @close="showSettings = false"
      @save="handleSaveConcurrency"
      @save-branch-mode="handleSaveBranchMode"
    />
    <!-- 拉取确认弹窗 -->
    <ConfirmDialog
      :visible="showPullConfirm"
      :title="i18n.pullConfirm || '确认拉取'"
      message=""
      confirm-text="确认拉取"
      cancel-text="取消"
      @confirm="doPullSingle"
      @cancel="cancelPullConfirm"
    >
      <template #message>
        <p class="gp-confirm-message">将从 <strong>{{ pendingPullLabel }}</strong> 拉取代码，可能覆盖本地修改。<br>确定要继续吗？</p>
      </template>
    </ConfirmDialog>
    <!-- 通用确认弹窗（删除/丢弃/恢复/分类等破坏性操作） -->
    <ConfirmDialog
      :visible="genericConfirm.visible"
      :title="genericConfirm.title"
      :message="genericConfirm.message"
      :confirm-text="genericConfirm.confirmText || '确定'"
      cancel-text="取消"
      @confirm="doGenericConfirm"
      @cancel="cancelGenericConfirm"
    />
    <IdeManagementDialog
      v-if="showIdeDialog"
      :custom-ides="customIdes"
      :preset-options="IDE_PRESETS"
      :get-icon="getIdePresetIcon"
      @close="showIdeDialog = false"
      @add-ide="(preset: string, path: string) => { addIdePreset = preset; addIdePath = path; addCustomIde() }"
      @save-edit-ide="(idx: number, preset: string, path: string) => { editingIdeIdx = idx; editIdePreset = preset; editIdePath = path; saveEditIde(idx) }"
      @delete-ide="doRemoveCustomIde"
    />
    <ScanImportDialog
      v-if="showScanDialog"
      :i18n="i18n"
      :scanning="scanning"
      :error="scanError"
      :results="scanResults"
      :selection="scanSelection"
      :scan-dir="scanDirInput"
      @close="handleCloseScan"
      @pick-scan-dir="selectScanDirectory"
      @start-scan="handleStartScan"
      @toggle-select-all="handleToggleSelectAll"
      @toggle-item="toggleScanItem"
      @import-selected="handleImportSelected"
    />
    <EditProjectDialog
      v-if="editDialogProjectId"
      :project-id="editDialogProjectId"
      :manager="manager"
      :i18n="i18n"
      :all-tags="allTags"
      @close="editDialogProjectId = ''"
      @saved="handleEditSaved"
    />
  </div>
</template>

<script setup lang="ts">
import type {
  CommitLogEntry,
  GitProject,
  GitPushManager,
  PlatformKey,
  ProjectStatus,
} from "./types"
import { Icon } from "@iconify/vue"
import { showMessage } from "siyuan"
import {
  computed,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from "vue"
import { copyToClipboard } from "@/utils/domUtils"
import AddProjectDialog from "./components/AddProjectDialog.vue"
import CategoryDialog from "./components/CategoryDialog.vue"
import ConfirmDialog from "./components/ConfirmDialog.vue"
import ConflictSection from "./components/ConflictSection.vue"
import EditProjectDialog from "./components/EditProjectDialog.vue"
import IdeManagementDialog from "./components/IdeManagementDialog.vue"
import OutputPanel from "./components/OutputPanel.vue"
import PanelHeader from "./components/PanelHeader.vue"
import ScanImportDialog from "./components/ScanImportDialog.vue"
import SettingsDialog from "./components/SettingsDialog.vue"
import StashSection from "./components/StashSection.vue"
import StatsPanel from "./components/StatsPanel.vue"
import TagPanel from "./components/TagPanel.vue"
import WorkingTreePanel from "./components/WorkingTreePanel.vue"
import { pickDirectory } from "./composables/useDirectoryPicker"
import { useGitPush } from "./composables/useGitPush"
import {
  IDE_PRESETS,
  useIdeManagement,
} from "./composables/useIdeManagement"
import {
  useProjectFilters,
  VIEW_MODE_META,
} from "./composables/useProjectFilters"
import { useTimeUtils } from "./composables/useTimeUtils"
import { PLATFORM_META, REMOTES, STATUS_CYCLE, STATUS_META } from "./types"
import {
  batchProcess,
  gitUrlToWebUrl,
  hasAnyRemote,
  pruneRecordCache,
  resolveValidPath,
} from "./utils"


const props = defineProps<{
  i18n: Record<string, any>
  plugin: any
  manager: GitPushManager
}>()

const ut = useTimeUtils()
const {
  relativeTime,
  activityLevel,
  sortProjects,
} = ut





const {
  projects,
  categories,
  groupedProjects,
  loading,
  getPushStatus,
  isPushing,
  pushOutputs,
  entriesToText,
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
  pullSingle,
  cancelPush,
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
  fetchAllRemotes,
  // Tag 管理
  tagsCache,
  tagLoading,
  loadTags,
  createTagOp,
  deleteTagOp,
  pushTagOp,
  // 冲突检测
  conflicts,
  checkConflicts,
  abortMergeOp,
  resolveConflictOp,
  // 提交信息模板
  commitTemplates,
  loadCommitTemplates,
  // 统计视图数据
  projectCount,
  remoteCoverage,
  pushStatusStats,
  needsPushProjects,
  uncommittedProjects,
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
const showAddMenu = ref(false)
const showPlatformMenu = ref(false)
/** 拉取确认状态 */
const showPullConfirm = ref(false)
interface PendingPull { id: string, key: PlatformKey }
const pendingPull = ref<PendingPull | null>(null)
const pendingPullLabel = computed(() => {
  if (!pendingPull.value) return ""
  return PLATFORM_META.find((pm) => pm.key === pendingPull.value!.key)?.label ?? pendingPull.value!.key
})
function confirmPullSingle(id: string, key: PlatformKey) {
  pendingPull.value = {
    id,
    key,
  }
  showPullConfirm.value = true
}
function cancelPullConfirm() {
  showPullConfirm.value = false
  pendingPull.value = null
}
function doPullSingle() {
  if (!pendingPull.value) return
  const {
    id,
    key,
  } = pendingPull.value
  pullSingle(id, key)
  showPullConfirm.value = false
  pendingPull.value = null
}
/** 通用确认弹窗状态 */
interface ConfirmState {
  visible: boolean
  title: string
  message: string
  confirmText?: string
  onConfirm: () => void
}
const genericConfirm = ref<ConfirmState>({
  visible: false,
  title: "",
  message: "",
  onConfirm: () => {},
})

/** 打开通用确认弹窗 */
function showConfirm(title: string, message: string, onConfirm: () => void, confirmText?: string) {
  genericConfirm.value = { visible: true, title, message, onConfirm, confirmText }
}

/** 执行确认回调并关闭 */
function doGenericConfirm() {
  genericConfirm.value.onConfirm()
  genericConfirm.value.visible = false
}

/** 取消确认 */
function cancelGenericConfirm() {
  genericConfirm.value.visible = false
}

/** git 操作活跃数轮询 */
const activeGitOps = ref(0)
let opsPoller: ReturnType<typeof setInterval> | null = null
let initTimer: ReturnType<typeof setTimeout> | null = null
/** 当前视图: 'list' | 'stats' */
const currentView = ref<"list" | "stats">("list")
/** 当前选中的分类 ID（onMounted 中设为首个分类） */
const activeCategory = ref<string>("")

/** 扫描导入弹窗状态 */
const showScanDialog = ref(false)
const scanError = ref("")
const scanSelection = ref<Record<string, boolean>>({})

/** 按分类 TAB 过滤后的分组 */
const visibleGroups = computed(() => {
  if (!activeCategory.value) return groupedProjects.value
  return groupedProjects.value.filter((g) => g.category.id === activeCategory.value)
})

const {
  searchQuery,
  viewMode,
  showArchived,
  gitOpsPaused,
  selectedTags,
  filteredGroups,
  loadGitOpsPaused,
  loadShowArchived,
} = useProjectFilters({
  gitOpsPausedStorage: props.manager.storage.gitOpsPaused,
  showArchivedStorage: props.manager.storage.showArchived,
  projects,
  needsPushProjects,
  uncommittedProjects,
  starredProjects,
  visibleGroups,
  sortProjects,
})

const {
  detectedIdes,
  customIdes,
  confirmingDelIdx,
  showIdeDialog,
  addIdePreset,
  addIdePath,
  editingIdeIdx,
  editIdePreset,
  editIdePath,
  getIdePresetIcon,
  saveEditIde,
  loadCustomIdes,
  addCustomIde,
  doRemoveCustomIde,
  handleOpenCustomIde,
  scanIdes,
  handleOpenIde,
} = useIdeManagement({
  plugin: props.plugin,
  openFolder: (path: string) => { handleOpenPath(path) },
})
/** 解析项目有效路径（模板辅助函数） */
function resolvedPath(p: { path: string, localPaths?: string[] }): string {
  return resolveValidPath(p as GitProject)
}

/** 获取项目平台 URL（模板中动态属性访问的辅助函数） */
function getProjectUrl(project: GitProject, prop: "githubUrl" | "giteeUrl" | "giteaUrl" | "cnbUrl"): string | undefined {
  return project[prop]
}

const newProjectPath = ref("") // 目录选择回填用
const refreshing = ref<string | null>(null)
/** 防抖：记录每个项目的最后刷新时间戳，避免短时间内重复刷新 */
const lastRefreshTime = new Map<string, number>()
const REFRESH_COOLDOWN_MS = 500

/** 项目编辑弹窗状态 */
const editDialogProjectId = ref("")
/** 行内名称编辑状态 */
const editingNameId = ref("")
const editingNameInput = ref("")
const refreshingAll = ref(false)
/** 全局刷新防抖时间戳 */
let allRefreshLastTime = 0
/** FETCH 操作加载中 id → true */
const fetching = ref<Record<string, boolean>>({})
/** IDE 打开菜单：当前打开的项目 id 集合 */
const openIdeMenu = ref(new Set<string>())
/** 提交输出 id → text */
const commitOutputs = ref<Record<string, string>>({})
/** AI 生成状态 id → { generating, text } */
const generatingMsgs = ref<Record<string, { generating: boolean, text: string }>>({})
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

/**
 * 工作区面板首次展开时懒加载详情：commitLog + branches + stash
 *  首屏只加载了 workingTree/pushStatus，这三项延后到用户真正展开时才请求
 */
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
      loadTags(projectId),
    ])
  } finally {
    delete commitLogLoading.value[projectId]
  }
}

/** HEAD hash 缓存，用于跳过无变动项目的 commit log / branches 刷新 */
const headHashes = ref<Record<string, string>>({})

/** 静默刷新当前分类下的项目状态（批次处理，每批 3 个匹配 git 信号量上限） */
async function silentRefreshAll() {
  if (gitOpsPaused.value) return
  const catId = activeCategory.value
  if (!catId) return
  const projList = projects.value.filter((p) => p.categoryId === catId)
  if (projList.length === 0) return

  await batchProcess(projList, 3, async (p) => {
    const prev = headHashes.value[p.id] || ""
    const [, curr] = await Promise.all([
      loadPushStatus(p.id),
      props.manager.getHeadHash(resolveValidPath(p)),
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
  loadCommitTemplates()
  loadCustomIdes()
  scanIdes() // 扫描已安装的 IDE
  await loadGitOpsPaused() // 从持久化存储恢复暂停状态
  await loadShowArchived() // 从持久化存储恢复归档显示状态
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
  initTimer = setTimeout(async () => {
    if (gitOpsPaused.value) return
    const catId = activeCategory.value
    const projList = catId ? projects.value.filter((p) => p.categoryId === catId) : projects.value
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
  if (initTimer) { clearTimeout(initTimer); initTimer = null }
  document.removeEventListener("click", closeIdeMenuOnOutside)
})

/** 点击外部关闭 IDE 菜单 / 添加菜单 */
function closeIdeMenuOnOutside(e: MouseEvent) {
  const target = e.target as HTMLElement | null
  if (target && !target.closest(".gp-ide-wrap")) {
    openIdeMenu.value = new Set()
  }
  if (target && !target.closest(".gp-add-wrap")) {
    showAddMenu.value = false
  }
  if (target && !target.closest(".gp-platform-wrap")) {
    showPlatformMenu.value = false
  }
}

// 挂载时注册，卸载时清理
document.addEventListener("click", closeIdeMenuOnOutside)

/** 切换分类时懒加载该分类下项目的数据（首屏最小集，详情展开时再补） */
watch(activeCategory, async (catId) => {
  if (!catId || gitOpsPaused.value) return
  const projList = projects.value.filter((p) => p.categoryId === catId)
  if (projList.length === 0) return
  // 只加载尚未缓存的
  const pending = projList.filter((p) => !workingTrees.value[p.id])
  if (pending.length === 0) return
  await batchProcess(pending, 3, async (p) => {
    await Promise.all([
      loadWorkingTree(p.id, true),
      loadPushStatus(p.id),
    ])
  })
})

/**
 * 切换到统计视图时，补齐统计面板所需的最小数据集（pushStatus + workingTree）。
 *  commitLog/branches/stash 不在统计视图中展示，无需加载。
 *  使用 loadStatsData 共用 rev-parse，避免 loadPushStatus/loadWorkingTree 各调一次
 */
watch(currentView, async (view) => {
  if (view !== "stats" || gitOpsPaused.value) return
  const pending = projects.value.filter((p) => !pushStatuses.value[p.id] || !workingTrees.value[p.id])
  if (pending.length === 0) return
  await batchProcess(pending, 3, async (p) => {
    await loadStatsData(p.id)
  })
})

async function handleAddFromDialog(data: { name: string, path: string, catId: string, tags: string[] }) {
  try {
    await addProject(data.name, data.path, data.catId, data.tags.length > 0 ? data.tags : undefined)
    showAddDialog.value = false
  } catch (e: any) {
    showMessage(e?.message || "添加失败", 5000, "error")
  }
}

/** 卡片点击：排除交互元素后，轻量刷新 git 状态 */
function handleCardClick(projectId: string, event: MouseEvent) {
  const target = event.target as HTMLElement
  // 点击按钮/输入框/选择框/标签/IDE 弹窗时不触发刷新
  if (target.closest("button, input, select, textarea, .gp-ide-popover, .gp-card-name, .gp-card-name-input")) return
  // 防抖：正在刷新或冷却期内跳过
  if (refreshing.value === projectId) return
  const lastTime = lastRefreshTime.get(projectId)
  if (lastTime && Date.now() - lastTime < REFRESH_COOLDOWN_MS) return
  lastRefreshTime.set(projectId, Date.now())
  // 已禁用点击卡片自动刷新 git 状态，用户需通过 Fetch/刷新全部按钮手动触发
  // handleRefresh(projectId)
}

async function handleRefresh(id: string) {
  refreshing.value = id
  try {
    // 并行执行：remote 检测 + push 状态一组，工作区/日志/分支/stash 一组
    await Promise.all([
      refreshRemotes(id),
      loadPushStatus(id, { fetchFirst: true }),
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
  if (gitOpsPaused.value) return
  // 防抖：全局刷新的冷却期内跳过
  if (Date.now() - allRefreshLastTime < REFRESH_COOLDOWN_MS) return
  allRefreshLastTime = Date.now()
  refreshingAll.value = true
  try {
    await silentRefreshAll()
  } finally {
    refreshingAll.value = false
  }
}

/** 从统计视图跳转到指定项目 */
function onViewProject(projectId: string) {
  const project = projects.value.find((p) => p.id === projectId)
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

      }
    } catch {
      // 降级
    }
  }
  // 浏览器环境：无法直接打开本地文件夹
}

/** 切换 IDE 打开菜单 */
function toggleIdeMenu(id: string) {
  const s = openIdeMenu.value
  if (s.has(id)) { s.delete(id) } else { s.add(id) }
  openIdeMenu.value = new Set(s)
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
    showMessage("已复制链接", 1500, "info")
  }
}

/** 复制推送/拉取输出文本 */
async function handleCopyOutput(text: string) {
  await copyToClipboard(text)
}

/** Fetch 所有远程 + 刷新状态 */
async function handleFetchAll(id: string) {
  fetching.value = {
    ...fetching.value,
    [id]: true,
  }
  try {
    await fetchAllRemotes(id)
  } catch (e: any) {
    showMessage(e?.message || "Fetch 失败", 5000, "error")
  } finally {
    delete fetching.value[id]
    fetching.value = { ...fetching.value }
  }
}

function handleRemove(project: any) {
  showConfirm("删除项目", `确定要删除项目 "${project.name}" 吗？此操作不可撤销。`, () => {
    removeProject(project.id)
    // 清理防抖缓存中已删除项目的条目，防止 Map 无限增长
    lastRefreshTime.delete(project.id)
  })
}

async function handleSwitchBranch(id: string, branch: string) {
  await safeGitOp("分支切换失败", () => switchBranch(id, branch))
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
  editDialogProjectId.value = project.id
}

/** 编辑弹窗保存后同步状态 */
async function handleEditSaved() {
  editDialogProjectId.value = ""
  await loadProjects()
}

/** 行内名称编辑：点击名称开始编辑 */
function startNameEdit(project: GitProject) {
  editingNameId.value = project.id
  editingNameInput.value = project.name
}

/** 行内名称编辑：失焦/回车保存 */
async function handleNameEditSave(project: GitProject) {
  const newName = editingNameInput.value.trim()
  try {
    if (!newName) {
      showMessage("项目名称不能为空", 2000, "error")
    } else if (newName !== project.name) {
      await updateProjectMeta(project.id, { name: newName })
    }
  } catch (e: any) {
    showMessage(`名称修改失败: ${e?.message || e}`, 4000, "error")
  } finally {
    editingNameId.value = ""
  }
}





/** 统一的异步操作错误处理包装器 */
async function safeGitOp(label: string, fn: () => Promise<void>) {
  try {
    await fn()
  } catch (e: any) {
    showMessage(`${label}: ${e?.message || e}`, 5000, "error")
  }
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
    pruneRecordCache(commitOutputs.value)
  }
}

async function handleDiscard(id: string, file: string, staged: boolean, status: string) {
  const label = status === "untracked" ? "删除未跟踪文件" : "丢弃更改"
  showConfirm("确认操作", `确定要${label} "${file}" 吗？此操作不可撤销。`, () => {
    doDiscard(id, file, staged, status, label)
  })
}

async function doDiscard(id: string, file: string, staged: boolean, status: string, label: string) {
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

const genStashDescLoading = ref<Record<string, boolean>>({})
const generatedStashMsg = ref("")
/** Tag 推送操作加载中 id → tagName */
const tagPushLoading = ref<Record<string, string>>({})

async function handleGenStashDesc(id: string) {
  genStashDescLoading.value[id] = true
  try {
    const desc = await generateStashDesc(id)
    if (desc) generatedStashMsg.value = desc
  } catch {
    // 失败则保持输入内容不变
  } finally {
    delete genStashDescLoading.value[id]
  }
}

function handleStashConfirmMsg(id: string, msg: string) {
  safeGitOp("暂存失败", () => doStashSave(id, msg))
}

function handleStashPop(id: string, index: number) {
  showConfirm("恢复 Stash", `确定恢复 stash@{${index}} 并删除该条目？恢复过程中如有冲突会保留该 stash。`, () => {
    safeGitOp("恢复失败", () => doStashPop(id, index))
  })
}

function handleStashApply(id: string, index: number) {
  safeGitOp("应用失败", () => doStashApply(id, index))
}

function handleStashDrop(id: string, index: number) {
  showConfirm("删除 Stash", `确定删除 stash@{${index}}？此操作不可撤销。`, () => {
    safeGitOp("删除失败", () => doStashDrop(id, index))
  })
}

// ── Tag 操作 ──

function handleCreateTag(id: string, name: string, message?: string) {
  safeGitOp("创建 Tag 失败", () => createTagOp(id, name, message).then(() => { loadTags(id) }))
}

function handleDeleteTag(id: string, tag: string) {
  showConfirm("删除 Tag", `确定删除 Tag "${tag}"？此操作不可撤销。`, () => {
    safeGitOp("删除失败", () => deleteTagOp(id, tag).then(() => { loadTags(id) }))
  })
}

async function handlePushTag(id: string, tag: string) {
  const project = projects.value.find((p) => p.id === id)
  if (!project) return
  // 收集所有已配置的远程
  const remoteNames: string[] = []
  for (const pm of PLATFORM_META) {
    const name = project[pm.remoteProp] as string | undefined
    if (name) remoteNames.push(name)
  }
  if (remoteNames.length === 0) { showMessage("未找到远程仓库", 3000, "error"); return }
  tagPushLoading.value = {
    ...tagPushLoading.value,
    [id]: tag,
  }
  try {
    await Promise.all(remoteNames.map((name) => pushTagOp(id, name, tag)))
  } catch (e: any) {
    showMessage(`推送 Tag 失败: ${e?.message || e}`, 5000, "error")
  } finally {
    delete tagPushLoading.value[id]
    // ref<Record> 的 delete 不被 Vue 深层响应式追踪检测到，需手动触发浅拷贝
    tagPushLoading.value = { ...tagPushLoading.value }
  }
}

// ── 冲突操作 ──

function handleAbortMerge(id: string) {
  showConfirm("中止合并", "确定中止合并操作？所有合并进度将丢失。", () => {
    safeGitOp("中止合并失败", () => abortMergeOp(id))
  })
}

function handleResolveConflict(id: string, file: string, strategy: "theirs" | "ours") {
  safeGitOp("解决冲突失败", () => resolveConflictOp(id, file, strategy).then(() => { checkConflicts(id) }))
}

async function handleCommit(id: string, message: string) {
  commitOutputs.value[id] = ""
  try {
    const result = await doCommit(id, message)
    commitOutputs.value[id] = result || "提交成功"
    pruneRecordCache(commitOutputs.value)
    await loadCommitLog(id)
  } catch (e: any) {
    commitOutputs.value[id] = `提交失败: ${e?.message || e}`
  }
}

async function handleGenerateMsg(id: string) {
  generatingMsgs.value = {
    ...generatingMsgs.value,
    [id]: {
      generating: true,
      text: "",
    },
  }
  commitOutputs.value[id] = ""
  try {
    const result = await generateCommitMsg(id)
    generatingMsgs.value = {
      ...generatingMsgs.value,
      [id]: {
        generating: false,
        text: result.message,
      },
    }
    if (result.source === "heuristic") {
      commitOutputs.value[id] = "AI 未返回有效信息，已使用启发式生成。"
    }
  } catch (e: any) {
    commitOutputs.value[id] = `生成失败: ${e?.message || e}`
    generatingMsgs.value = {
      ...generatingMsgs.value,
      [id]: {
        generating: false,
        text: "",
      },
    }
  }
}

// ---- 分类管理 ----

async function handleAddCategory(name: string, color: string) {
  if (!name) return
  await addCategoryFn(name, color)
}

async function handleDeleteCategory(id: string) {
  const cat = categories.value.find((c) => c.id === id)
  if (!cat) return
  showConfirm("删除分类", `确定删除分类 "${cat.name}"？\n该分类下的项目将移至「未分组」。`, () => {
    doDeleteCategory(id)
  })
}

async function doDeleteCategory(id: string) {
  // 如果删除的是当前选中分类，切到第一个可用分类
  if (activeCategory.value === id) {
    const others = groupedProjects.value.filter((g) => g.category.id !== id)
    activeCategory.value = others.length > 0 ? others[0].category.id : ""
  }
  await deleteCategoryFn(id)
}

async function handleMoveProject(projectId: string, categoryId: string) {
  await moveProject(projectId, categoryId)
}

async function handleSaveConcurrency(value: number) {
  await setGitConcurrency(value)
}

/** 推送分支模式 */
const pushBranchMode = ref<"all" | "head">(props.manager.getPushBranchMode())

async function handleSaveBranchMode(mode: "all" | "head") {
  pushBranchMode.value = mode
  await props.manager.setPushBranchMode(mode)
}

/** 推送所有项目状态 */
const pushingAllProjects = ref(false)
const pushAllDone = ref(0)
const pushAllTotal = ref(0)

/** 当前视图下需要推送的项目数 */
const needsPushCount = computed(() => {
  let count = 0
  for (const p of projects.value) {
    if (pushStatuses.value[p.id]?.needsPush) { count++ }
  }
  return count
})

async function handlePushAllProjects() {
  pushingAllProjects.value = true
  const allProjects = projects.value.filter((p) => pushStatuses.value[p.id]?.needsPush)
  pushAllTotal.value = allProjects.length
  pushAllDone.value = 0
  try {
    for (const p of allProjects) {
      if (!pushingAllProjects.value) break
      await pushToAll(p.id)
      pushAllDone.value++
    }
  } finally {
    pushingAllProjects.value = false
  }
}

/** 获取指定项目指定远程的推送状态 */
function getRemoteStatus(projectId: string, remoteKey: string) {
  return pushStatuses.value[projectId]?.remotes[remoteKey]
}

/** 获取远程推送状态标签文案 */
function statusLabel(projectId: string, remoteKey: string): string {
  const rs = getRemoteStatus(projectId, remoteKey)
  if (!rs) return ""
  if (rs.noUpstream) return `+${rs.ahead}`
  if (rs.ahead > 0) return `↑${rs.ahead}`
  if (rs.behind > 0) return `↓${rs.behind}`
  return ""
}

/** 获取状态 badge 的 CSS 类 */
function statusBadgeClass(projectId: string, remoteKey: string): string {
  const rs = getRemoteStatus(projectId, remoteKey)
  if (!rs) return ""
  if (rs.noUpstream || rs.ahead > 0) return "gp-ahead"
  if (rs.behind > 0) return "gp-behind"
  return "gp-synced"
}

/** 判断某个远程是否需要推送（本地超前或从未推送） */
function needsPushFor(projectId: string, remoteKey: string): boolean {
  const rs = getRemoteStatus(projectId, remoteKey)
  if (!rs) return true // 尚未检测，允许点击
  return rs.noUpstream || rs.ahead > 0
}

/** 判断项目是否有远程落后（远程有新提交） */
function hasBehind(projectId: string): boolean {
  const status = pushStatuses.value[projectId]
  if (!status) return false
  return Object.values(status.remotes).some((r) => r.behind > 0)
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
    (r) => r.alreadyImported || scanSelection.value[r.path],
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
  scanSelection.value = {
    ...scanSelection.value,
    [path]: !scanSelection.value[path],
  }
}

async function handleImportSelected() {
  const selected = scanResults.value
    .filter((r) => scanSelection.value[r.path])
    .map((r) => r.path)
  const catId = activeCategory.value || "__ungrouped__"
  const {
    imported,
    skipped,
  } = await importScanResults(selected, catId)
  // 刷新项目列表以显示新导入的项目
  await loadProjects()
  handleCloseScan()
  if (imported > 0 || skipped > 0) {
    showMessage(`导入完成：成功 ${imported} 个${skipped > 0 ? `，跳过 ${skipped} 个` : ""}`, 3000, "info")
  }
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
@use "./styles/Buttons";
@use "./styles/Shared";
@use "./styles/index.scss";
</style>
