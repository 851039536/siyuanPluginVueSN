<template>
  <div class="git-push-panel">
    <!-- 头部 -->
    <div class="gp-header">
      <span class="gp-title">{{ i18n.panelTitle || 'Git 推送' }}</span>
      <div class="gp-header-btns">
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

    <!-- 分类 TAB 导航 -->
    <div v-if="groupedProjects.length > 0" class="gp-tabs">
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
            <div class="gp-card-name">{{ project.name }}</div>
            <div class="gp-card-path" :title="project.path">{{ project.path }}</div>
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
              :title="'打开 GitHub ' + project.githubUrl"
              @click="handleOpenWeb(project.githubUrl)"
            >
              <Icon icon="mdi:github" height="14" />
            </button>
            <button
              v-if="project.giteeUrl"
              class="vp-btn vp-btn--ghost vp-btn--sm"
              :title="'打开 Gitee ' + project.giteeUrl"
              @click="handleOpenWeb(project.giteeUrl)"
            >
              <Icon icon="mdi:git" height="14" />
            </button>
            <button
              v-if="project.giteaUrl"
              class="vp-btn vp-btn--ghost vp-btn--sm"
              :title="'打开 Gitea ' + project.giteaUrl"
              @click="handleOpenWeb(project.giteaUrl)"
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
        />

        <!-- Stash 暂存 -->
        <div class="gp-stash-wrap">
          <div class="gp-stash-header">
            <span class="gp-stash-label">STASH</span>
            <span class="gp-stash-help" title="暂存：把当前未提交的修改临时保存起来，方便切换到其他分支工作。之后可以随时'恢复'回来继续编辑，就像把工作进度先放进抽屉里一样。">
              <Icon icon="mdi:help-circle-outline" height="14" />
            </span>
            <button
              class="vp-btn vp-btn--ghost vp-btn--sm"
              :disabled="!workingTrees[project.id]?.hasChanges || stashLoading[project.id]"
              @click="handleStashSave(project.id)"
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
            <div v-for="(r, i) in remoteList" :key="i" class="gp-remote-row">
              <span class="gp-remote-name">{{ r.name }}</span>
              <span class="gp-remote-url" :title="r.url">{{ r.url }}</span>
              <button
                class="vp-btn vp-btn--ghost vp-btn--sm gp-btn-danger"
                title="删除此远程"
                @click="handleRemoveRemote(remoteConfigProject.id, r.name)"
              >删除</button>
            </div>
          </div>
          <div v-else class="gp-remote-empty">暂无远程仓库</div>
          <!-- 添加远程表单 -->
          <div class="gp-remote-add">
            <input v-model="newRemoteName" class="gp-input" placeholder="远程名称 (如 origin)" style="width:100px" />
            <input v-model="newRemoteUrl" class="gp-input" placeholder="远程 URL" style="flex:1" />
            <button
              class="vp-btn vp-btn--primary vp-btn--sm"
              :disabled="!newRemoteName.trim() || !newRemoteUrl.trim()"
              @click="handleAddRemote(remoteConfigProject.id)"
            >添加</button>
          </div>
          <div v-if="remoteError" class="gp-error">{{ remoteError }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted, ref, computed } from "vue"
import { Icon } from "@iconify/vue"
import type { GitPushManager, GitProject, CommitLogEntry, ScannedGitRepo } from "./types"
import { useGitPush } from "./composables/useGitPush"
import WorkingTreePanel from "./components/WorkingTreePanel.vue"

type RemoteKey = "github" | "gitee" | "gitea"

/** 远程仓库配置常量（驱动模板 v-for） */
const REMOTES: { key: RemoteKey; icon: string; label: string; remoteProp: keyof GitProject }[] = [
  { key: "github", icon: "mdi:github", label: "GitHub", remoteProp: "githubRemote" },
  { key: "gitee", icon: "mdi:git", label: "Gitee", remoteProp: "giteeRemote" },
  { key: "gitea", icon: "mdi:tea", label: "Gitea", remoteProp: "giteaRemote" },
]

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
  addRemoteOp,
  removeRemoteOp,
} = useGitPush(props.manager)

const showAddDialog = ref(false)
const showCatDialog = ref(false)
const showSettings = ref(false)
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

/** 搜索过滤后的分组 */
const filteredGroups = computed(() => {
  const q = searchQuery.value.trim().toLowerCase()
  if (!q) return visibleGroups.value
  return visibleGroups.value
    .map(g => ({
      ...g,
      projects: g.projects.filter(
        p => p.name.toLowerCase().includes(q) || p.path.toLowerCase().includes(q),
      ),
    }))
    .filter(g => g.projects.length > 0)
})

const newProjectName = ref("")
const newProjectPath = ref("")
const newProjectCat = ref("__ungrouped__")
const newCatName = ref("")
const newCatColor = ref("#4a9eff")
const addError = ref("")
const addChecking = ref(false)
const addResult = ref<boolean | null>(null)
const refreshing = ref<string | null>(null)
const refreshingAll = ref(false)
/** 远程仓库配置弹窗 */
const remoteConfigProject = ref<GitProject | null>(null)
const remoteList = ref<{ name: string; url: string }[]>([])
const newRemoteName = ref("")
const newRemoteUrl = ref("")
const remoteError = ref("")
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

/** HEAD hash 缓存，用于跳过无变动项目的 commit log / branches 刷新 */
const headHashes = ref<Record<string, string>>({})

/** 静默刷新当前分类下的项目状态（manager 内置 git 信号量限流 3 并发） */
async function silentRefreshAll() {
  const catId = activeCategory.value
  if (!catId) return
  const projList = projects.value.filter(p => p.categoryId === catId)
  if (projList.length === 0) return

  await Promise.all(projList.map(async (p) => {
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
  }))
}

onMounted(async () => {
  await loadProjects()
  // 默认选中第一个分类
  if (!activeCategory.value && groupedProjects.value.length > 0) {
    activeCategory.value = groupedProjects.value[0].category.id
  }
  loadGitConcurrency()
  // 延迟加载当前分类下项目的工作区状态（manager 内置信号量限流）
  setTimeout(async () => {
    const catId = activeCategory.value
    const projList = catId ? projects.value.filter(p => p.categoryId === catId) : projects.value
    await Promise.all(projList.map(async (p) => {
      const [, hash] = await Promise.all([
        loadWorkingTree(p.id),
        props.manager.getHeadHash(p.path),
        loadCommitLog(p.id),
        loadBranches(p.id),
      ])
      if (hash) headHashes.value[p.id] = hash
    }))
    // 加载所有项目的 stash 列表（轻量，每个项目一条 git 命令）
    await Promise.all(projects.value.map(p => loadStashList(p.id)))
  }, 200)
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
    // 即使不是 git 仓库也允许添加（用户可能后续初始化）
    await addProject(newProjectName.value.trim(), newProjectPath.value.trim(), newProjectCat.value)
    showAddDialog.value = false
    newProjectName.value = ""
    newProjectPath.value = ""
    newProjectCat.value = "__ungrouped__"
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
    await refreshRemotes(id)
    await loadPushStatus(id)
    await loadWorkingTree(id)
    await loadStashList(id)
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

async function handleStashSave(id: string) {
  const msg = prompt("暂存描述（可选，留空使用时间戳）：", "")
  if (msg === null) return // 用户取消
  try {
    await doStashSave(id, msg.trim() || new Date().toLocaleString())
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
      commitOutputs.value[id] = "⚠️ 未配置 AI API Key，使用启发式生成。可在超级面板设置中配置。"
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
  newRemoteName.value = ""
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
    newRemoteName.value = ""
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
  // 优先使用 Electron 原生目录选择对话框（路径可靠）
  if (typeof window.require === "function") {
    try {
      let remote: any
      // 兼容新旧 Electron：先尝试 @electron/remote（Electron 14+），再回退 electron.remote
      try {
        remote = window.require("@electron/remote")
      } catch {
        const electron = window.require("electron")
        remote = electron.remote || electron
      }
      if (remote?.dialog?.showOpenDialog) {
        const result = await remote.dialog.showOpenDialog({
          properties: ["openDirectory"],
          title: "选择项目目录",
        })
        if (!result.canceled && result.filePaths[0]) {
          newProjectPath.value = result.filePaths[0]
          return
        }
      }
    } catch {
      // 降级到 webkitdirectory 方案
    }
  }
  // 降级方案：浏览器环境使用 input[webkitdirectory]
  try {
    const input = document.createElement("input")
    input.type = "file"
    input.setAttribute("webkitdirectory", "")
    input.setAttribute("directory", "")
    input.onchange = (e: any) => {
      const files = e.target?.files
      if (files && files.length > 0) {
        const relativePath = files[0].webkitRelativePath
        const dirName = relativePath.split("/")[0]
        if (files[0].path) {
          const fullPath = files[0].path
          const dirPath = fullPath.substring(0, fullPath.lastIndexOf(dirName) + dirName.length)
          newProjectPath.value = dirPath
        }
      }
    }
    input.click()
  } catch {
    // 最终降级：用户手动输入
  }
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
  // 优先使用 Electron 原生目录选择对话框
  if (typeof window.require === "function") {
    try {
      let remote: any
      try {
        remote = window.require("@electron/remote")
      } catch {
        const electron = window.require("electron")
        remote = electron.remote || electron
      }
      if (remote?.dialog?.showOpenDialog) {
        const result = await remote.dialog.showOpenDialog({
          properties: ["openDirectory"],
          title: "选择要扫描的目录",
        })
        if (!result.canceled && result.filePaths[0]) {
          scanDirInput.value = result.filePaths[0]
          return
        }
      }
    } catch {
      // 降级
    }
  }
  // 降级方案：浏览器环境使用 input[webkitdirectory]
  try {
    const input = document.createElement("input")
    input.type = "file"
    input.setAttribute("webkitdirectory", "")
    input.setAttribute("directory", "")
    input.onchange = (e: any) => {
      const files = e.target?.files
      if (files && files.length > 0) {
        const relativePath = files[0].webkitRelativePath
        const dirName = relativePath.split("/")[0]
        if (files[0].path) {
          const fullPath = files[0].path
          const dirPath = fullPath.substring(0, fullPath.lastIndexOf(dirName) + dirName.length)
          scanDirInput.value = dirPath
        }
      }
    }
    input.click()
  } catch {
    // 最终降级
  }
}
</script>

<style lang="scss">
@use "@/index.scss" as *;
@use "./styles/variables" as *;
@use "./styles/mixins" as *;
@use "./styles/buttons";
@use "./styles/shared";

.git-push-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
  overflow: hidden;
}

.gp-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.gp-header-btns {
  display: flex;
  gap: 4px;
}

.gp-title {
  font-size: 14px;
  font-weight: 600;
}

.gp-divider {
  border-bottom: 1px solid var(--b3-border-color);
  margin: 10px 0;
}

// 分类 TAB 导航栏
.gp-tabs {
  display: flex;
  gap: 2px;
  overflow-x: auto;
  padding: 0 0 4px;
  -webkit-overflow-scrolling: touch;

  &::-webkit-scrollbar { height: 0; }
}

.gp-tab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
  padding: 4px 10px;
  border: none;
  border-bottom: 2px solid transparent;
  border-radius: 4px 4px 0 0;
  background: transparent;
  color: var(--b3-theme-on-surface);
  font-size: 11px;
  opacity: 0.5;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;

  &:hover {
    opacity: 0.8;
  }

  &.active {
    opacity: 1;
    font-weight: 600;
    border-bottom-color: var(--b3-theme-primary);
    background: var(--b3-theme-primary-lightest);
  }
}

.gp-tab-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.gp-tab-count {
  font-size: 9px;
  font-family: $vp-mono;
  opacity: 0.4;
}

// 搜索框
.gp-search-wrap {
  position: relative;
  display: flex;
  align-items: center;
  margin: 6px 0 2px;
}

.gp-search-icon {
  position: absolute;
  left: 8px;
  opacity: 0.35;
  pointer-events: none;
}

.gp-search-input {
  width: 100%;
  padding: 5px 28px 5px 28px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  font-size: 11px;
  font-family: $vp-mono;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  outline: none;
  transition: border-color 0.15s;

  &:focus {
    border-color: var(--b3-theme-primary);
  }

  &::placeholder {
    opacity: 0.35;
    font-family: inherit;
  }
}

.gp-search-clear {
  position: absolute;
  right: 4px;
  background: none;
  border: none;
  cursor: pointer;
  opacity: 0.35;
  padding: 2px;
  color: var(--b3-theme-on-surface);

  &:hover {
    opacity: 0.7;
  }
}

.gp-loading,
.gp-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  color: var(--b3-theme-on-surface-light);
  font-size: 13px;
}

.gp-empty-icon {
  opacity: 0.3;
  margin-bottom: 8px;
}

.gp-list {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  padding-right: 4px;
}

.gp-card {
  border: 1px solid var(--b3-border-color);
  border-radius: 6px;
  padding: 10px 12px;
  transition: border-color 0.15s;

  &:hover {
    border-color: var(--b3-theme-primary);
  }
}

.gp-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
}

.gp-card-info {
  flex: 1;
  min-width: 0;
}

.gp-card-name {
  font-size: 13px;
  font-weight: 600;
  margin-bottom: 2px;
}

.gp-card-path {
  font-size: 10px;
  font-family: $vp-mono;
  opacity: 0.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 280px;
}

.gp-branch-row {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 3px;
  flex-wrap: wrap;
}

.gp-branch-tag {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 6px;
  font-size: 9px;
  font-family: $vp-mono;
  font-weight: 600;
  border: 1px solid var(--b3-border-color);
  border-radius: 3px;
  background: transparent;
  color: var(--b3-theme-on-surface);
  opacity: 0.5;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    opacity: 0.8;
    border-color: var(--b3-theme-primary);
  }

  &.current {
    opacity: 1;
    border-color: var(--b3-theme-primary);
    color: var(--b3-theme-primary);
    background: var(--b3-theme-primary-lightest);
  }
}

.gp-card-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}

.gp-btn-danger {
  &:hover {
    color: var(--b3-theme-error);
  }
}

.gp-remotes {
  display: flex;
  gap: 16px;
  margin: 8px 0;
}

.gp-remote-item {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-family: $vp-mono;
  opacity: 0.35;
  text-transform: uppercase;
  letter-spacing: 0.04em;

  &.active {
    opacity: 1;
    color: var(--b3-theme-primary);
  }
}

.gp-remote-none {
  opacity: 0.35;
}

.gp-conflict-warn {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  margin-top: 6px;
  font-size: 11px;
  color: var(--b3-theme-warning);
  background: var(--b3-theme-warning-lightest);
  border: 1px solid var(--b3-theme-warning-lighter, var(--b3-theme-warning));
  border-radius: 4px;
}

.gp-status-badge {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 3px;
  margin-left: 4px;
  letter-spacing: 0;

  &.gp-ahead {
    background: var(--b3-theme-primary-lightest);
    color: var(--b3-theme-primary);
  }

  &.gp-behind {
    background: var(--b3-theme-warning-lightest);
    color: var(--b3-theme-warning);
  }

  &.gp-synced {
    background: var(--b3-theme-success-lightest);
    color: var(--b3-theme-success);
  }
}

.gp-push-group {
  display: flex;
  gap: 6px;
  margin-top: 6px;
}

// Stash 暂存
.gp-stash-wrap {
  border-top: 1px solid var(--b3-border-color);
  margin-top: 6px;
  padding-top: 6px;
}

.gp-stash-header {
  display: flex;
  align-items: center;
  gap: 4px;
}

.gp-stash-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.45;
}

.gp-stash-help {
  cursor: help;
  opacity: 0.35;
  transition: opacity 0.15s;

  &:hover {
    opacity: 0.7;
  }
}

.gp-stash-list {
  margin-top: 4px;
  max-height: 120px;
  overflow-y: auto;
}

.gp-stash-row {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 3px 0;
  font-size: 10px;
  border-bottom: 1px solid var(--b3-border-color);

  &:last-child {
    border-bottom: none;
  }
}

.gp-stash-index {
  font-family: $vp-mono;
  opacity: 0.5;
  flex-shrink: 0;
}

.gp-stash-msg {
  flex: 1;
  font-family: $vp-mono;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gp-push-btn {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  font-size: 12px;
  padding: 6px 4px;

  &:disabled {
    opacity: 0.4;
    cursor: not-allowed;
  }
}

.gp-output {
  margin-top: 8px;
  max-height: 150px;
  @include output-base;

  pre {
    word-break: break-all;
  }
}

// 弹窗
.gp-mask {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
}

.gp-dialog {
  background: var(--b3-theme-background);
  border-radius: 8px;
  width: 420px;
  max-width: 90vw;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
}

.gp-dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 16px;
  border-bottom: 1px solid var(--b3-border-color);
}

.gp-dialog-title {
  font-size: 14px;
  font-weight: 600;
}

.gp-dialog-body {
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.gp-dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--b3-border-color);
}

.gp-form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.gp-label {
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  opacity: 0.45;
}

.gp-input {
  width: 100%;
  box-sizing: border-box;
  padding: 7px 10px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  font-size: 12px;
  font-family: $vp-mono;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  outline: none;
  transition: border-color 0.15s, box-shadow 0.15s;

  &:focus {
    @include focus-ring;
  }

  &::placeholder {
    opacity: 0.35;
  }
}

.gp-path-row {
  display: flex;
  gap: 4px;
}

.gp-error {
  font-size: 11px;
  color: var(--b3-theme-error);
}

.gp-checking {
  font-size: 11px;
  display: flex;
  align-items: center;
  gap: 6px;
  opacity: 0.6;
}

.gp-check-result {
  font-size: 11px;

  &.success {
    color: var(--b3-theme-primary);
  }

  &:not(.success) {
    opacity: 0.5;
  }
}

// 分类管理弹窗
.gp-set-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.gp-set-label {
  font-size: 12px;
  white-space: nowrap;
}

.gp-set-input-row {
  display: flex;
  align-items: center;
  gap: 4px;
}

.gp-set-hint {
  font-size: 10px;
  opacity: 0.4;
}

.gp-cat-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 0;
  border-bottom: 1px solid var(--b3-border-color);

  &:last-of-type {
    border-bottom: none;
  }
}

.gp-cat-dot-sm {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  flex-shrink: 0;
}

.gp-cat-name-sm {
  flex: 1;
  font-size: 11px;
}

.gp-cat-add-row {
  display: flex;
  gap: 4px;
  margin-top: 8px;
}

.gp-color-input {
  width: 28px;
  height: 28px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  cursor: pointer;
  padding: 2px;
  background: none;
}

// 分类选择框（卡片内联）
.gp-cat-select {
  background: transparent;
  border: 1px solid var(--b3-border-color);
  border-radius: 3px;
  color: var(--b3-theme-on-surface);
  font-size: 10px;
  padding: 1px 2px;
  cursor: pointer;
  max-width: 60px;
  opacity: 0.5;

  &:hover {
    opacity: 1;
  }
}

// 添加弹窗中的分类下拉
.gp-select {
  width: 100%;
  padding: 7px 10px;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  font-size: 12px;
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  outline: none;
  cursor: pointer;

  &:focus {
    @include focus-ring;
  }
}

// 扫描导入弹窗
.gp-remote-list {
  max-height: 200px;
  overflow-y: auto;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
}

.gp-remote-row {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 6px;
  font-size: 11px;
  border-bottom: 1px solid var(--b3-border-color);

  &:last-child { border-bottom: none; }
}

.gp-remote-name {
  font-family: $vp-mono;
  font-weight: 600;
  flex-shrink: 0;
}

.gp-remote-url {
  flex: 1;
  font-family: $vp-mono;
  font-size: 10px;
  opacity: 0.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gp-remote-empty {
  padding: 12px;
  text-align: center;
  font-size: 11px;
  opacity: 0.4;
}

.gp-remote-add {
  display: flex;
  gap: 4px;
  margin-top: 4px;
}

.gp-scan-results {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid var(--b3-border-color);
  border-radius: 4px;
  padding: 8px;

  &::-webkit-scrollbar {
    width: 4px;
  }
}

.gp-scan-results-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 0 6px;
}

.gp-scan-count {
  font-size: 11px;
  font-weight: 600;
  opacity: 0.6;
}

.gp-scan-item {
  border-bottom: 1px solid var(--b3-border-color);

  &:last-child {
    border-bottom: none;
  }
}

.gp-scan-item-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 4px;
  cursor: pointer;
  transition: background 0.1s;

  &:hover {
    background: var(--b3-theme-surface);
  }

  &.gp-scan-imported {
    opacity: 0.4;
    cursor: default;
    pointer-events: none;

    &:hover {
      background: transparent;
    }
  }
}

.gp-scan-item-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.gp-scan-item-name {
  font-size: 11px;
  font-weight: 600;
}

.gp-scan-item-path {
  font-size: 9px;
  font-family: $vp-mono;
  opacity: 0.5;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.gp-scan-badge {
  font-size: 9px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 3px;
  background: var(--b3-theme-primary-lightest);
  color: var(--b3-theme-primary);
  white-space: nowrap;
}

// 按钮样式已提取到 styles/_buttons.scss
</style>
