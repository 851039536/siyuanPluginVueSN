<template>
  <div
    class="ai-content-panel"
    :class="{ 'is-dragging': isDragging, ['drag-over-' + dragOverType]: dragOverType }"
    @dragenter="handleDragEnter"
    @dragover="handleDragOver"
    @dragleave="handleDragLeave"
    @drop="handleDrop"
    @dragend="handleDragEnd"
  >
    <!-- 拖拽提示遮罩 -->
    <div v-if="isDragging" class="drag-overlay">
      <div class="drag-overlay-content">
        <svg width="48" height="48">
          <use xlink:href="#iconDownload"></use>
        </svg>
        <p class="drag-text">{{ getDragText() }}</p>
        <p class="drag-hint">松开鼠标加载文档</p>
      </div>
    </div>

    <!-- 顶部工具栏 -->
    <div class="panel-header">
      <div class="header-title">
        <span>🤖 {{'AI信息生成' }}</span>
      </div>
      <div class="header-actions">
        <!-- 设置按钮 -->
        <button class="btn-icon" @click="toggleSettings" :title="'对话设置'">
          <svg width="18" height="18" viewBox="0 0 24 24">
            <use xlink:href="#iconSettings"></use>
          </svg>
        </button>
      </div>
    </div>

    <!-- 提示词配置面板 -->
    <div class="settings-panel" v-if="showSettings">
      <div class="panel-section">
        <div class="section-header">
          <div class="section-title-wrapper">
            <svg width="16" height="16" class="section-icon">
              <use xlink:href="#iconSparkles"></use>
            </svg>
            <span>{{ '提示词配置' }}</span>
            <button
              class="btn-collapse"
              @click="toggleCollapse('settings')"
              :class="{ 'collapsed': collapsedSections.settings }"
              :title="collapsedSections.settings ? '展开设置' : '折叠设置'"
            >
              <svg width="14" height="14" class="collapse-icon">
                <use :xlink:href="collapsedSections.settings ? '#iconRight' : '#iconDown'"></use>
              </svg>
            </button>
          </div>
          <button class="btn-close" @click="toggleSettings">
            <svg width="14" height="14">
              <use xlink:href="#iconClose"></use>
            </svg>
          </button>
        </div>
        <div class="section-content" :class="{ 'collapsed': collapsedSections.settings }">
          <!-- 提示词内容 -->
          <div class="prompt-content-section">
            <div class="setting-item setting-item-full">
              <div class="label-row">
                <label class="setting-label">
                  <svg width="14" height="14" class="label-icon">
                    <use xlink:href="#iconEdit"></use>
                  </svg>
                  {{ '系统提示词' }}
                </label>
              </div>
              <textarea
                v-model="systemPrompt"
                class="prompt-input"
                :placeholder="'输入系统提示词，定义AI的角色和行为...'"
                rows="5"
              ></textarea>
            </div>

            <!-- 参数配置 -->
            <div class="params-grid">
              <div class="setting-item">
                <label class="setting-label">
                  <svg width="12" height="12" class="label-icon">
                    <use xlink:href="#iconHot"></use>
                  </svg>
                  {{ '创造性' }}
                  <span class="value-badge">{{ temperature }}</span>
                </label>
                <input
                  type="range"
                  v-model.number="temperature"
                  min="0"
                  max="2"
                  step="0.1"
                  class="slider"
                />
                <div class="slider-hint">
                  <span>{{ '精确' }}</span>
                  <span>{{ '创造' }}</span>
                </div>
              </div>

              <div class="setting-item">
                <label class="setting-label">
                  <svg width="12" height="12" class="label-icon">
                    <use xlink:href="#iconAlignLeft"></use>
                  </svg>
                  {{ '最大长度' }}
                </label>
                <input
                  type="number"
                  v-model.number="maxTokens"
                  min="100"
                  max="50000"
                  step="100"
                  class="number-input"
                />
              </div>

              <div class="setting-item">
                <label class="setting-label">
                  <svg width="12" height="12" class="label-icon">
                    <use xlink:href="#iconList"></use>
                  </svg>
                  {{ '上下文' }}
                  <span class="value-badge">{{ contextMessageLimit }}</span>
                </label>
                <input
                  type="range"
                  v-model.number="contextMessageLimit"
                  min="1"
                  max="10"
                  step="1"
                  class="slider"
                />
                <div class="slider-hint">
                  <span>1</span>
                  <span>10</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 保存操作区域 -->
          <div class="save-prompt-section">
            <div class="save-prompt-header">
              <label class="setting-label">
                <svg width="14" height="14" class="label-icon">
                  <use xlink:href="#iconSave"></use>
                </svg>
                {{ currentPromptName ? '更新配置' : '保存为新配置' }}
              </label>
              <span v-if="currentPromptName" class="editing-badge">
                {{ currentPromptName }}
              </span>
            </div>
            <div class="save-prompt-input-group">
              <input
                v-model="newPromptName"
                type="text"
                class="prompt-name-input"
                :placeholder="currentPromptName || '输入配置名称...'"
                @keydown.enter="saveCurrentPrompt"
                @focus="onPromptNameFocus"
              />
              <button
                class="btn-save-prompt"
                @click="saveCurrentPrompt"
                :disabled="!newPromptName.trim() && !currentPromptName"
              >
                <svg width="14" height="14">
                  <use xlink:href="#iconCheck"></use>
                </svg>
                {{ currentPromptName ? '更新' : '保存' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 内容显示区域（移到上方） -->
    <div class="content-display-section">
      <!-- AI分析建议面板 -->
      <div v-if="aiSuggestions" class="ai-suggestions-panel">
        <div class="suggestions-header">
          <div class="section-title-wrapper">
            <svg width="16" height="16"><use xlink:href="#iconLightbulb"></use></svg>
            <span>{{'AI优化建议' }}</span>
            <button
              class="btn-collapse"
              @click="toggleCollapse('suggestions')"
              :class="{ 'collapsed': collapsedSections.suggestions }"
              :title="collapsedSections.suggestions ? '展开建议' : '折叠建议'"
            >
              <svg width="14" height="14" class="collapse-icon">
                <use :xlink:href="collapsedSections.suggestions ? '#iconRight' : '#iconDown'"></use>
              </svg>
            </button>
          </div>
          <button class="btn-close-suggestions" @click="aiSuggestions = null">
            <svg width="12" height="12"><use xlink:href="#iconClose"></use></svg>
          </button>
        </div>
        <div class="suggestions-content" :class="{ 'collapsed': collapsedSections.suggestions }">
          <p class="suggestion-text">{{ aiSuggestions }}</p>
          <button class="btn-apply-suggestions" @click="applySuggestions" :disabled="isGenerating">
            {{'应用建议优化' }}
          </button>
        </div>
      </div>

      <!-- AI查重结果面板 -->
      <div v-if="plagiarismResult" class="plagiarism-result-panel">
        <div class="result-header">
          <div class="section-title-wrapper">
            <svg width="16" height="16"><use xlink:href="#iconSearch"></use></svg>
            <span>{{'AI查重结果' }}</span>
            <button
              class="btn-collapse"
              @click="toggleCollapse('plagiarism')"
              :class="{ 'collapsed': collapsedSections.plagiarism }"
              :title="collapsedSections.plagiarism ? '展开结果' : '折叠结果'"
            >
              <svg width="14" height="14" class="collapse-icon">
                <use :xlink:href="collapsedSections.plagiarism ? '#iconRight' : '#iconDown'"></use>
              </svg>
            </button>
          </div>
          <button class="btn-close-result" @click="plagiarismResult = null">
            <svg width="12" height="12"><use xlink:href="#iconClose"></use></svg>
          </button>
        </div>
        <div class="result-content" :class="{ 'collapsed': collapsedSections.plagiarism }">
          <div class="plagiarism-summary">
            <div class="summary-item" :class="plagiarismResult.riskLevel === 'low' ? 'low-risk' : plagiarismResult.riskLevel === 'medium' ? 'medium-risk' : 'high-risk'">
              <span class="summary-label">{{'风险等级' }}:</span>
              <span class="summary-value">{{ getRiskLevelText(plagiarismResult.riskLevel) }}</span>
            </div>
            <div class="summary-item">
              <span class="summary-label">{{ '相似度' }}:</span>
              <span class="summary-value">{{ plagiarismResult.similarityRate }}%</span>
            </div>
          </div>
          <div class="plagiarism-details">
            <div class="detail-text markdown-preview selectable-content" v-html="renderPlagiarismMarkdown"></div>
          </div>
        </div>
      </div>

      <!-- 主内容显示区域 -->
      <div class="main-content-area">
        <!-- 加载状态（仅在没有内容时显示） -->
        <div v-if="isGenerating && !displayedContent && !generatedContent" class="loading-state">
          <div class="loading-spinner-large"></div>
          <p>{{ 'AI正在思考...' }}</p>
        </div>

        <!-- 错误提示 -->
        <div v-else-if="errorMessage && !displayedContent && !generatedContent" class="error-state">
          <svg width="48" height="48" class="error-icon">
            <use xlink:href="#iconCloseRound"></use>
          </svg>
          <p>{{ errorMessage }}</p>
        </div>

        <!-- 生成结果（流式输出时也显示） -->
        <div v-else-if="displayedContent || generatedContent" class="result-container">
          <div class="result-header">
            <span class="result-title">
              📝 {{'编辑内容' }}
              <span v-if="isGenerating" class="generating-indicator">
                <span class="dot-flashing"></span>
                {{ '生成中' }}
              </span>
            </span>
            <div class="result-actions">
              <!-- 停止生成按钮 -->
              <button
                v-if="isGenerating"
                class="btn-action btn-stop"
                @click="handleStop"
                :title="'停止生成'"
              >
                <svg width="16" height="16">
                  <use xlink:href="#iconClose"></use>
                </svg>
                {{ '停止' }}
              </button>
              <button
                class="btn-action btn-apply"
                @click="applyEdit"
                :disabled="!editTargetDoc || isApplying || isGenerating"
                :title="'应用编辑'"
              >
                <div v-if="isApplying" class="loading-spinner-small"></div>
                <svg v-else width="16" height="16">
                  <use xlink:href="#iconCheck"></use>
                </svg>
                {{ '应用' }}
              </button>
              <button
                v-if="editTargetDoc && originalContent && generatedContent && originalContent !== generatedContent"
                class="btn-action btn-diff-mode"
                @click="showDiffMode = !showDiffMode"
                :class="{ active: showDiffMode }"
                :title="showDiffMode ? '返回预览' : '查看差异'"
              >
                <svg width="16" height="16" viewBox="0 0 24 24">
                  <path v-if="!showDiffMode" fill="currentColor" d="M3,13H11V3H3V13M3,21H11V15H3V21M13,21H21V11H13V21M13,3V9H21V3H13Z" />
                  <path v-else fill="currentColor" d="M12,9A3,3 0 0,0 9,12A3,3 0 0,0 12,15A3,3 0 0,0 15,12A3,3 0 0,0 12,9M12,17A5,5 0 0,1 7,12A5,5 0 0,1 12,7A5,5 0 0,1 17,12A5,5 0 0,1 12,17M12,4.5C7,4.5 2.73,7.61 1,12C2.73,16.39 7,19.5 12,19.5C17,19.5 21.27,16.39 23,12C21.27,7.61 17,4.5 12,4.5Z" />
                </svg>
                {{ showDiffMode ? '预览' : '差异' }}
              </button>
              <button
                class="btn-action btn-insert-subdoc"
                @click="insertSubDocument"
                :disabled="!editTargetDoc || isInsertingSubDoc || isGenerating"
                :title="'插入子文档'"
              >
                <div v-if="isInsertingSubDoc" class="loading-spinner-small"></div>
                <svg v-else width="16" height="16" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M20,18H4V6H20M20,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6C22,4.89 21.1,4 20,4M13,12H16V15H18V12H21V10H18V7H16V10H13V12Z" />
                </svg>
                {{ '子文档' }}
              </button>
              <button
                v-if="lastEditHistory"
                class="btn-action btn-undo"
                @click="undoEdit"
                :disabled="isUndoing"
                :title="'撤回编辑'"
              >
                <div v-if="isUndoing" class="loading-spinner-small"></div>
                <svg v-else width="16" height="16">
                  <use xlink:href="#iconUndo"></use>
                </svg>
                {{ '撤回' }}
              </button>
              <button class="btn-action" @click="copyContent" :title="'复制Markdown'">
                <svg width="16" height="16">
                  <use xlink:href="#iconCopy"></use>
                </svg>
                {{ '复制' }}
              </button>
              <button class="btn-action btn-clear" @click="clearContent">
                <svg width="16" height="16">
                  <use xlink:href="#iconTrashcan"></use>
                </svg>
                {{ '清除' }}
              </button>
            </div>
          </div>
          <div class="result-content">
            <!-- 预览模式 -->
            <div v-if="!showDiffMode" class="markdown-preview selectable-content" v-html="renderedDisplayedMarkdown"></div>
            <!-- 差异对比模式 -->
            <div v-else class="diff-view-container">
              <!-- 差异显示工具栏 -->
              <div class="diff-view-toolbar">
                <div class="diff-mode-options">
                  <button
                    :class="['diff-mode-btn', { active: diffMode === 'split' }]"
                    @click="diffMode = 'split'"
                    title="分栏显示"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M4,4H10V10H4V4M20,4V10H14V4H20M14,20H20V14H14V20M4,14V20H10V14H4Z" />
                    </svg>
                    分栏
                  </button>
                  <button
                    :class="['diff-mode-btn', { active: diffMode === 'unified' }]"
                    @click="diffMode = 'unified'"
                    title="统一显示"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24">
                      <path fill="currentColor" d="M2,2V22H22V2H2M20,20H4V4H20V20M8,8H16V10H8V8M8,11H16V13H8V11M8,14H16V16H8V14Z" />
                    </svg>
                    统一
                  </button>
                </div>
                <div class="diff-view-info">
                  <span class="diff-label">原文档 vs AI生成</span>
                </div>
              </div>
              <!-- 差异显示组件 -->
              <div class="diff-viewer-wrapper">
                <Diff
                  :mode="diffMode"
                  theme="dark"
                  language="markdown"
                  :prev="originalContent"
                  :current="generatedContent"
                  :folding="false"
                  :virtual-scroll="false"
                  :render-added="true"
                  :render-removed="true"
                  :hide-line-numbers="false"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 空状态 -->
        <div v-else class="empty-state">
          <svg width="64" height="64" class="empty-icon">
            <use xlink:href="#iconFile"></use>
          </svg>
          <p>{{ '请选择文档并使用AI编辑功能' }}</p>
        </div>
      </div>
    </div>

    <!-- 底部输入区域 -->
    <div class="bottom-input-section">
      <!-- AI智能编辑工具栏 -->
      <div v-if="editTargetDoc" class="ai-edit-toolbar">
        <div class="toolbar-label">
          <div class="section-title-wrapper">
            <svg width="14" height="14">
              <use xlink:href="#iconSparkles"></use>
            </svg>
            <span>{{'AI智能编辑' }}:</span>
            <button
              class="btn-collapse"
              @click="toggleCollapse('aiToolbar')"
              :class="{ 'collapsed': collapsedSections.aiToolbar }"
              :title="collapsedSections.aiToolbar ? '展开工具栏' : '折叠工具栏'"
            >
              <svg width="14" height="14" class="collapse-icon">
                <use :xlink:href="collapsedSections.aiToolbar ? '#iconRight' : '#iconDown'"></use>
              </svg>
            </button>
          </div>
        </div>
        <div class="toolbar-actions" :class="{ 'collapsed': collapsedSections.aiToolbar }">
          <button class="btn-ai-action" @click="aiEditAction('polish')" :disabled="isGenerating" :title="'AI润色'">
            <svg width="14" height="14"><use xlink:href="#iconEdit"></use></svg>
            {{'润色' }}
          </button>
          <button class="btn-ai-action" @click="aiEditAction('expand')" :disabled="isGenerating" :title="'扩写内容'">
            <svg width="14" height="14"><use xlink:href="#iconAdd"></use></svg>
            {{'扩写' }}
          </button>
          <button class="btn-ai-action" @click="aiEditAction('condense')" :disabled="isGenerating" :title="'精简内容'">
            <svg width="14" height="14"><use xlink:href="#iconMin"></use></svg>
            {{'精简' }}
          </button>
          <button class="btn-ai-action" @click="aiEditAction('fix')" :disabled="isGenerating" :title="'修正错误'">
            <svg width="14" height="14"><use xlink:href="#iconCheck"></use></svg>
            {{'纠错' }}
          </button>
          <button class="btn-ai-action" @click="aiEditAction('translate')" :disabled="isGenerating" :title="'翻译文档'">
            <svg width="14" height="14"><use xlink:href="#iconLanguage"></use></svg>
            {{'翻译' }}
          </button>
          <button class="btn-ai-action" @click="aiEditAction('rewrite')" :disabled="isGenerating" :title="'改写文档'">
            <svg width="14" height="14"><use xlink:href="#iconRefresh"></use></svg>
            {{'改写' }}
          </button>
          <button class="btn-ai-action" @click="aiEditAction('summary')" :disabled="isGenerating" :title="'AI总结文档'">
            <svg width="14" height="14" viewBox="0 0 24 24">
              <path fill="currentColor" d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M13,12.5L11.5,14L10,12.5V16H8V12.5L10,14L11.5,12.5L13,14V16H15V12.5L13,12.5Z" />
            </svg>
            {{'总结' }}
          </button>
          <button class="btn-ai-action btn-analyze" @click="analyzeDocument" :disabled="isGenerating || isAnalyzing" :title="'AI分析建议'">
            <div v-if="isAnalyzing" class="loading-spinner-tiny"></div>
            <svg v-else width="14" height="14"><use xlink:href="#iconInfo"></use></svg>
            {{'智能分析' }}
          </button>
          <button v-if="!isCheckingPlagiarism" class="btn-ai-action btn-plagiarism" @click="checkPlagiarism" :disabled="isGenerating" :title="'AI查重'">
            <svg width="14" height="14"><use xlink:href="#iconSearch"></use></svg>
            {{'查重' }}
          </button>
          <button v-else class="btn-ai-action btn-stop-plagiarism" @click="handleStop" :title="'停止生成'">
            <svg width="14" height="14"><use xlink:href="#iconClose"></use></svg>
            {{'停止' }}
          </button>
        </div>
      </div>

      <!-- 编辑模式：紧凑工具栏（提示词选择 + 目标文档选择 + 输入框 + 执行按钮） -->
      <div class="compact-toolbar edit-mode">
        <!-- 提示词选择按钮 -->
        <div class="prompt-selector-wrapper">
          <button class="btn-prompt-compact" @click="showPromptSelector = !showPromptSelector" :title="currentPromptName || ('选择提示词')">
            <svg width="14" height="14">
              <use xlink:href="#iconList"></use>
            </svg>
            <span v-if="currentPromptName" class="prompt-name-compact">{{ currentPromptName }}</span>
            <span v-else>{{ '提示词' }}</span>
            <span v-if="savedPrompts.length > 0 && !currentPromptName" class="prompt-count-compact">{{ savedPrompts.length }}</span>
            <button v-if="currentPromptName" class="btn-clear-inline" @click.stop="clearCurrentPrompt" :title="'清除'">
              <svg width="10" height="10">
                <use xlink:href="#iconClose"></use>
              </svg>
            </button>
          </button>

          <!-- 提示词选择面板 -->
          <div v-if="showPromptSelector" class="prompt-selector-panel">
            <div class="prompt-selector-header">
              <span>{{'已保存的提示词' }}</span>
              <button class="btn-close-small" @click="showPromptSelector = false">
                <svg width="12" height="12">
                  <use xlink:href="#iconClose"></use>
                </svg>
              </button>
            </div>

            <!-- 搜索框 -->
            <div v-if="savedPrompts.length > 5" class="prompt-search-wrapper">
              <input
                v-model="promptSearchQuery"
                type="text"
                class="prompt-search-input"
                :placeholder="'搜索提示词...'"
              />
            </div>

            <div v-if="filteredPrompts.length === 0" class="empty-prompts">
              <p v-if="savedPrompts.length === 0">{{'暂无保存的提示词，请在对话设置中保存' }}</p>
              <p v-else>{{'没有找到匹配的提示词' }}</p>
            </div>

            <div v-else class="prompt-list">
              <div
                v-for="(prompt, index) in paginatedPrompts"
                :key="prompt.id || index"
                class="prompt-item"
                @click="loadPrompt(getOriginalIndex(prompt))"
              >
                <div class="prompt-item-header">
                  <span class="prompt-name">{{ prompt.name }}</span>
                  <div class="prompt-item-actions">
                    <button
                      class="btn-edit-prompt"
                      @click.stop="editPrompt(getOriginalIndex(prompt))"
                      :title="'编辑'"
                    >
                      <svg width="14" height="14">
                        <use xlink:href="#iconEdit"></use>
                      </svg>
                    </button>
                    <button
                      class="btn-delete-prompt"
                      @click.stop="deletePrompt(getOriginalIndex(prompt))"
                      :title="'删除'"
                    >
                      <svg width="14" height="14">
                        <use xlink:href="#iconTrashcan"></use>
                      </svg>
                    </button>
                  </div>
                </div>
                <div class="prompt-item-preview">{{ getPromptPreview(prompt.systemPrompt) }}</div>
                <div class="prompt-item-meta">
                  <span>{{'创造性' }}: {{ prompt.temperature }}</span>
                  <span>{{'最大长度' }}: {{ prompt.maxTokens }}</span>
                </div>
              </div>

              <!-- 分页控制 -->
              <div v-if="totalPages > 1" class="prompt-pagination">
                <button
                  class="btn-page"
                  @click="currentPage = Math.max(1, currentPage - 1)"
                  :disabled="currentPage === 1"
                  :title="'上一页'"
                >
                  ‹
                </button>
                <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
                <button
                  class="btn-page"
                  @click="currentPage = Math.min(totalPages, currentPage + 1)"
                  :disabled="currentPage === totalPages"
                  :title="'下一页'"
                >
                  ›
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 目标文档选择 -->
        <div class="doc-selector-wrapper">
          <button class="btn-doc-compact" @click="selectTargetDocument" :title="editTargetDoc ? editTargetDoc.title : ('选择文档')">
            <svg width="14" height="14">
              <use xlink:href="#iconFile"></use>
            </svg>
            <span v-if="editTargetDoc" class="doc-name-compact">
              {{ editTargetDoc.title }}
              <span v-if="editTargetDoc.isBlock" class="block-badge" title="块内容">块</span>
              <span v-if="autoLoadEnabled && lastAutoLoadDocId === editTargetDoc.id" class="auto-badge" title="自动加载">自动</span>
            </span>
            <span v-else>{{ '选择文档' }}</span>
            <button v-if="editTargetDoc" class="btn-clear-inline" @click.stop="clearTargetDocument" :title="'清除'">
              <svg width="10" height="10">
                <use xlink:href="#iconClose"></use>
              </svg>
            </button>
          </button>
          <!-- 自动加载开关 -->
          <button
            class="btn-auto-load"
            @click="autoLoadEnabled = !autoLoadEnabled"
            :class="{ 'active': autoLoadEnabled }"
            :title="autoLoadEnabled ? '自动加载已开启' : '自动加载已关闭'"
          >
            <svg width="12" height="12">
              <use :xlink:href="autoLoadEnabled ? '#iconFocus' : '#iconPause'"></use>
            </svg>
          </button>
        </div>

        <!-- 编辑模式：自定义输入框 -->
        <textarea
          v-if="editTargetDoc"
          v-model="editCustomInput"
          class="user-input-compact"
          :placeholder="'输入编辑指令...'"
          rows="1"
          @keydown.ctrl.enter="handleCustomEdit"
          :disabled="isGenerating"
        ></textarea>

        <!-- 执行/停止按钮 -->
        <button
          v-if="!isGenerating && editTargetDoc"
          class="btn-generate-compact"
          @click="handleCustomEdit"
          :disabled="!editCustomInput.trim() && !currentPromptName"
          :title="!editCustomInput.trim() && currentPromptName ? '使用当前提示词生成' : '执行'"
        >
          <svg width="16" height="16">
            <use xlink:href="#iconSparkles"></use>
          </svg>
        </button>
        <button
          v-else-if="isGenerating"
          class="btn-stop-compact"
          @click="handleStop"
          :title="'停止生成'"
        >
          <svg width="16" height="16">
            <use xlink:href="#iconClose"></use>
          </svg>
        </button>
      </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted,  nextTick } from 'vue';
import { showMessage } from 'siyuan';
import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import { Diff } from 'vue-diff';
import 'vue-diff/dist/index.css';
import * as api from '@/api';
import { AIGeneratorStorage, type AIPromptConfig } from './storage';

interface Props {
  i18n: any;
  plugin: any;
  onGenerate: (options: GenerateOptions) => Promise<string>;
}

interface GenerateOptions {
  userInput: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  context?: string;
  signal?: AbortSignal;
  onChunk?: (chunk: string) => void; // 流式输出回调
}

const props = withDefaults(defineProps<Props>(), {
  plugin: null
});

// 存储实例
let storage: AIGeneratorStorage | null = null;

// 状态
const generatedContent = ref('');
const isGenerating = ref(false);
const errorMessage = ref('');
const showSettings = ref(false);
const abortController = ref<AbortController | null>(null);

// 输入区域显示状态（已废弃，新布局始终显示底部输入）
// const showInputSection = ref(true);

// 折叠状态管理
const collapsedSections = ref({
  settings: false,
  aiToolbar: false,
  suggestions: false,
  plagiarism: false,
  promptSelector: false
});

// 编辑模式状态
interface TargetDoc {
  id: string;
  title: string;
  content: string;
  isBlock?: boolean; // 是否为块内容（区别于整个文档）
}
const editTargetDoc = ref<TargetDoc | null>(null);
const originalContent = ref(''); // 文档原始内容
const isApplying = ref(false);
const isUndoing = ref(false);
const isInsertingSubDoc = ref(false); // 插入子文档状态

// 自动获取文档相关状态
const autoLoadEnabled = ref(false); // 是否启用自动加载
const lastAutoLoadDocId = ref<string | null>(null); // 上次自动加载的文档ID
const autoLoadDebounceTimer = ref<number | null>(null); // 防抖定时器

// 拖拽相关状态
const isDragging = ref(false); // 是否正在拖拽
const dragOverType = ref<'block' | 'tab' | 'tree' | null>(null); // 拖拽类型

// AI智能编辑状态
const isAnalyzing = ref(false);
const aiSuggestions = ref<string | null>(null);
const isCheckingPlagiarism = ref(false);
const plagiarismResult = ref<{
  riskLevel: 'low' | 'medium' | 'high';
  similarityRate: number;
  details: string;
} | null>(null);
const editCustomInput = ref(''); // 编辑模式自定义提问输入

// 编辑历史（用于撤回/重做）
interface EditHistory {
  docId: string;
  docTitle: string;
  originalContent: string;
  timestamp: number;
}
const lastEditHistory = ref<EditHistory | null>(null);

// 差异显示模式
const showDiffMode = ref(false); // 是否显示差异对比模式
const diffMode = ref<'split' | 'unified'>('split'); // 差异显示模式：分栏或统一

// 对话设置
const systemPrompt = ref('你是一个专业的内容创作助手，擅长生成结构清晰、格式规范的Markdown文档。请确保输出内容使用标准的Markdown语法。');
const temperature = ref(0.7);
const maxTokens = ref(10000); // 问题1：默认改为1万
const enableTypewriter = ref(true);

// 上下文消息数量配置
const contextMessageLimit = ref(1);

// 上下文配置已删除
const displayedContent = ref(''); // 用于打字机效果显示的内容
// 提示词管理（与 AIPromptConfig 保持一致）
interface SavedPrompt {
  id: string;
  name: string;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  enableTypewriter: boolean;
  contextMessageLimit: number;
  createdAt: number;
}

const savedPrompts = ref<SavedPrompt[]>([]);
const showPromptSelector = ref(false);
const newPromptName = ref('');
const currentPromptName = ref(''); // 当前选中的提示词名称

// 提示词搜索和分页状态
const promptSearchQuery = ref('');
const currentPage = ref(1);
const ITEMS_PER_PAGE = 10; // 每页显示数量

// 过滤后的提示词
const filteredPrompts = computed(() => {
  if (!promptSearchQuery.value.trim()) {
    return savedPrompts.value;
  }

  const query = promptSearchQuery.value.toLowerCase().trim();
  return savedPrompts.value.filter(prompt =>
    prompt.name.toLowerCase().includes(query) ||
    prompt.systemPrompt.toLowerCase().includes(query)
  );
});

// 分页后的提示词
const paginatedPrompts = computed(() => {
  const start = (currentPage.value - 1) * ITEMS_PER_PAGE;
  const end = start + ITEMS_PER_PAGE;
  return filteredPrompts.value.slice(start, end);
});

// 总页数
const totalPages = computed(() => {
  return Math.ceil(filteredPrompts.value.length / ITEMS_PER_PAGE) || 1;
});

// 获取原始索引（用于处理过滤后的列表）
const getOriginalIndex = (prompt: SavedPrompt) => {
  return savedPrompts.value.findIndex(p => p.id === prompt.id);
};

// 监听搜索查询变化，重置页码
watch(promptSearchQuery, () => {
  currentPage.value = 1;
});

// 监听提示词选择面板显示状态，重置搜索
watch(showPromptSelector, (newVal) => {
  if (newVal) {
    promptSearchQuery.value = '';
    currentPage.value = 1;
  }
});

// ============ 公共工具函数 ============

/**
 * 开始生成内容的公共初始化
 */
const startGeneration = () => {
  abortController.value = new AbortController();
  isGenerating.value = true;
  generatedContent.value = '';
  displayedContent.value = '';
  errorMessage.value = '';
  aiSuggestions.value = null;
  plagiarismResult.value = null;
};

/**
 * 结束生成内容的公共清理
 */
const finishGeneration = () => {
  isGenerating.value = false;
  abortController.value = null;
  isAnalyzing.value = false;
  isCheckingPlagiarism.value = false;
};

/**
 * 处理生成过程中的错误
 * @returns true 表示是用户取消，调用方应直接返回
 */
const handleGenerationError = (error: Error, context: string): boolean => {
  if (error.name === 'AbortError') {
    return true;
  }
  console.error(`${context}失败:`, error);
  const message = error.message || `${context}失败`;
  errorMessage.value = message;
  return false;
};

/**
 * 统一的文档加载函数
 */
const loadDocument = async (docId: string): Promise<{ title: string; content: string } | null> => {
  try {
    const docBlock = await api.getBlockByID(docId);
    if (!docBlock) {
      showMessage('无法获取文档信息', 3000, 'error');
      return null;
    }

    const docContent = await api.exportMdContent(docId);
    if (!docContent || !docContent.content) {
      showMessage('无法获取文档内容', 3000, 'error');
      return null;
    }

    return {
      title: docBlock.content || '未命名文档',
      content: docContent.content
    };
  } catch (error) {
    console.error('加载文档失败:', error);
    showMessage('加载文档失败: ' + (error as Error).message, 3000, 'error');
    return null;
  }
};

/**
 * 默认的流式输出回调（同时更新显示内容和生成内容）
 */
const defaultOnChunk = (chunk: string) => {
  displayedContent.value += chunk;
  generatedContent.value += chunk;
};

/**
 * 创建只更新单个目标的流式回调
 * @param targetRef 目标响应式引用
 * @returns 流式输出回调函数
 */
const createSingleTargetCallback = (targetRef: { value: string | null }) => {
  return (chunk: string) => {
    targetRef.value = (targetRef.value || '') + chunk;
  };
};

/**
 * 创建带自定义处理的流式回调
 * @param onUpdate 自定义更新函数，接收累积的内容
 * @returns 流式输出回调函数
 */
const createCustomStreamCallback = (onUpdate: (accumulatedContent: string) => void) => {
  let accumulated = '';
  return (chunk: string) => {
    accumulated += chunk;
    onUpdate(accumulated);
  };
};

/**
 * 获取当前文档ID（包含备用方案）
 */
const getCurrentDocId = async (): Promise<string | null> => {
  const currentBlockId = getCurrentBlockId();
  if (currentBlockId) {
    return await getDocIdByBlockId(currentBlockId);
  }
  // 备用方案：使用激活窗口的文档
  const protyle = document.querySelector('.layout__wnd--active .protyle:not(.fn__none)');
  return protyle?.querySelector('.protyle-background')?.getAttribute('data-node-id') || null;
};

/**
 * 获取激活窗口的文档ID
 */
const getActiveDocId = (): string | null => {
  const protyle = document.querySelector('.layout__wnd--active .protyle:not(.fn__none)');
  return protyle?.querySelector('.protyle-background')?.getAttribute('data-node-id') || null;
};

/**
 * 自动加载当前文档（带防抖）
 */
const autoLoadCurrentDoc = async () => {
  if (!autoLoadEnabled.value) return;

  // 清除之前的定时器
  if (autoLoadDebounceTimer.value) {
    clearTimeout(autoLoadDebounceTimer.value);
  }

  // 防抖：500ms 后执行
  autoLoadDebounceTimer.value = window.setTimeout(async () => {
    const docId = getActiveDocId();
    if (!docId) return;

    // 如果和上次加载的文档相同，则跳过
    if (lastAutoLoadDocId.value === docId) return;

    // 如果用户正在生成内容或手动选择了文档，则不自动切换
    if (isGenerating.value || (editTargetDoc.value && editTargetDoc.value.id !== docId)) {
      return;
    }
    await loadTargetDocument(docId);
    lastAutoLoadDocId.value = docId;
  }, 500);
};

/**
 * 启动自动加载监听
 */
const startAutoLoadCurrentDoc = () => {
  // 监听窗口激活事件
  document.addEventListener('click', autoLoadCurrentDoc);

  // 监听标签页切换（通过 MutationObserver 监听 DOM 变化）
  const observer = new MutationObserver(() => {
    autoLoadCurrentDoc();
  });

  // 观察布局变化
  const layoutEl = document.querySelector('.layout');
  if (layoutEl) {
    observer.observe(layoutEl, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class']
    });
  }

  // 初始加载当前文档
  setTimeout(() => {
    autoLoadCurrentDoc();
  }, 1000);
};

/**
 * 停止自动加载监听
 */
const stopAutoLoadCurrentDoc = () => {
  if (autoLoadDebounceTimer.value) {
    clearTimeout(autoLoadDebounceTimer.value);
    autoLoadDebounceTimer.value = null;
  }
  document.removeEventListener('click', autoLoadCurrentDoc);
};

/**
 * 拖拽进入处理
 */
const handleDragEnter = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

  // 简化：只要进入面板就显示拖拽状态
  isDragging.value = true;
  dragOverType.value = 'block'; // 默认为块类型
};

/**
 * 拖拽悬停处理
 */
const handleDragOver = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

/**
 * 拖拽离开处理
 */
const handleDragLeave = (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

  const target = e.target as HTMLElement;
  const panel = target.closest('.ai-content-panel');

  // 只有离开整个面板时才清除状态
  if (panel && !panel.contains(e.relatedTarget as Node)) {
    isDragging.value = false;
    dragOverType.value = null;
  }
};

/**
 * 拖拽放置处理
 * 支持：块拖拽、文档标签拖拽、文档树拖拽
 */
const handleDrop = async (e: DragEvent) => {
  e.preventDefault();
  e.stopPropagation();

  isDragging.value = false;
  dragOverType.value = null;

  // 获取拖拽数据
  const transfer = e.dataTransfer;
  if (!transfer) {
    console.warn('⚠️ dataTransfer 为空');
    return;
  }

  // 尝试所有可能的类型获取 ID
  let blockId: string | null = null;
  let isBlockDrag = false; // 是否为块拖拽

  // 方式 1: 从 dataTransfer.types 中提取块 ID（最准确的方式）
  // 思源笔记的块拖拽会在 types 中包含块 ID
  // 格式类似：application/siyuan-gutternodeparagraph​null​20260116135906-7wheger​e:\siyuan2
  for (const type of transfer.types) {

    // 匹配思源块拖拽的类型格式
    // application/siyuan-gutternodeparagraph + null + blockId + path
    const blockIdMatch = type.match(/application\/siyuan-gutternodeparagraph\S+(\d{14}-[a-z0-9]+)/);
    if (blockIdMatch) {
      blockId = blockIdMatch[1];
      isBlockDrag = true;
      break;
    }

    // 备用：直接匹配块 ID 格式（14位数字-连字符-小写字母数字）
    const idMatch = type.match(/(\d{14}-[a-z0-9]{7})/);
    if (idMatch) {
      blockId = idMatch[1];
      isBlockDrag = true;
      break;
    }
  }

  // 方式 2: 如果从 types 提取失败，尝试从数据内容提取
  if (!blockId) {
    const possibleTypes = ['siyuan/block', 'text/plain', 'text/html', 'Files'];

    for (const type of possibleTypes) {
      if (transfer.types.includes(type)) {
        try {
          const data = transfer.getData(type);

          // 尝试解析 JSON（思源的块拖拽数据）
          try {
            const jsonData = JSON.parse(data);

            // 思源笔记的块拖拽数据格式：
            // 可能是单个块对象：{ id: "xxx", type: "h", ... }
            // 或者是块数组：[{ id: "xxx", ... }, { id: "yyy", ... }]
            if (Array.isArray(jsonData)) {
              // 如果是数组，取第一个块（拖拽多个块时的主块）
              if (jsonData.length > 0 && jsonData[0].id) {
                blockId = jsonData[0].id;
                break;
              }
            } else if (jsonData.id) {
              // 单个块对象
              blockId = jsonData.id;
              break;
            }
          } catch (jsonError) {
            // 不是 JSON 格式，继续尝试其他方式
          }

          // 尝试提取 ID（可能是块 ID 或文档 ID）
          // JSON 格式
          const jsonMatch = data.match(/"id":"([^"]+)"/);
          if (jsonMatch) {
            // 提取所有匹配的 ID
            const allIds = data.match(/"id":"([^"]+)"/g);
            blockId = jsonMatch[1];
            break;
          }

          // HTML 格式（思源可能使用）
          const htmlIdMatch = data.match(/data-node-id="([^"]+)"/);
          if (htmlIdMatch) {
            blockId = htmlIdMatch[1];
            break;
          }
        } catch (error) {
          console.warn(`⚠️ 读取 ${type} 数据失败:`, error);
        }
      }
    }
  }

  // 方式 2: 从 items 获取（异步）
  if (!blockId && transfer.items.length > 0) {
    for (let i = 0; i < transfer.items.length; i++) {
      const item = transfer.items[i];

      if (item.kind === 'string') {
        try {
          const data = await new Promise<string>((resolve) => {
            item.getAsString(resolve);
          });

          // 提取 ID
          const idMatch = data.match(/"id":"([^"]+)"/) || data.match(/data-node-id="([^"]+)"/);
          if (idMatch) {
            blockId = idMatch[1];
            break;
          }
        } catch (error) {
          console.warn('⚠️ 读取 item 数据失败:', error);
        }
      }
    }
  }

  // 方式 3: 从当前激活文档获取（备用方案）
  if (!blockId) {
    blockId = getActiveDocId();
    if (blockId) {
    }
  }

  // 根据获取到的 ID 加载内容
  if (blockId) {

    // 检测是否为块拖拽还是文档拖拽
    // 方法 1: 检查 dataTransfer.types 是否包含 'siyuan/block'
    if (transfer.types.includes('siyuan/block')) {
      isBlockDrag = true;
    } else {
      // 方法 2: 通过获取块信息，检查 type 是否为文档类型
      // 在思源笔记中，文档的 type 为 'd'，其他类型（如段落、标题等）为块
      try {
        const block = await api.getBlockByID(blockId);
        if (block) {

          // 如果 type 不是 'd'（文档类型），或者是文档但内容为空（说明可能是拖拽的特定块），则认为是块拖拽
          // 另外检查 dataTransfer.types 包含的特定类型来判断
          if (block.type !== 'd') {
            isBlockDrag = true;
          } else if (transfer.types.includes('text/html') && transfer.types.includes('text/plain')) {
            // 如果是文档类型，但拖拽数据包含 HTML 和纯文本，可能是从内容区拖拽的块
            // 进一步检查：文档根节点的 content 通常为空或较短，而块有内容
            const data = transfer.getData('text/plain');
            if (data && data.length > 0 && !data.startsWith('{')) {
              // 如果有纯文本数据且不是 JSON，很可能是块内容拖拽
              isBlockDrag = true;
            }
          }
        }
      } catch (error) {
        console.warn('⚠️ 检查块类型失败:', error);
        // 如果检查失败，默认作为文档处理
      }
    }

    if (isBlockDrag) {
      // 块拖拽：只加载块内容
      await loadTargetBlock(blockId);
      showMessage('✓ 已加载块内容', 2000, 'info');
    } else {
      // 文档拖拽：加载整个文档
      await loadTargetDocument(blockId);
      showMessage('✓ 已加载文档', 2000, 'info');
    }
  } else {
    console.error('❌ 无法获取 ID');
    showMessage('⚠️ 无法识别拖拽的内容', 3000, 'error');
  }
};

/**
 * 拖拽结束处理
 */
const handleDragEnd = () => {
  isDragging.value = false;
  dragOverType.value = null;
};

/**
 * 获取拖拽提示文本
 */
const getDragText = () => {
  const typeMap = {
    block: '拖拽块',
    tab: '拖拽标签页',
    tree: '拖拽文档'
  };
  return typeMap[dragOverType.value || 'block'] || '拖拽文档';
};

/**
 * 关闭设置面板
 */
const closeSettings = () => {
  showSettings.value = false;
};



/**
 * 移除Markdown内容中的Frontmatter（YAML元数据）
 * @param content 原始内容
 * @returns 移除frontmatter后的内容
 */
const removeFrontmatter = (content: string): string => {
  // 匹配开头的 --- ... --- 格式的YAML frontmatter
  const frontmatterRegex = /^---\s*\n[\s\S]*?\n---\s*\n/;
  return content.replace(frontmatterRegex, '').trim();
};

/**
 * 移除Markdown内容中的标题
 * @param content 原始内容
 * @returns 移除标题后的内容
 */
const removeHeadings = (content: string): string => {
  // 移除第一行（通常是对应标题）
  const lines = content.split('\n');
  if (lines.length <= 1) {
    return '';
  }
  // 移除第一行后返回剩余内容
  return lines.slice(1).join('\n').trim();
};


/**
 * 统一的 Markdown 渲染函数
 */
const renderMarkdown = (content: string, highlightKeywords: string[] = []): string => {
  if (!content) return '';

  try {
    // 配置 marked 选项（全局配置一次）
    marked.setOptions({
      breaks: true,
      gfm: true,
    });

    let processedContent = content;

    // 对特定关键词进行高亮标记
    const boldKeywords = highlightKeywords.filter(k => k.startsWith('bold:')).map(k => k.slice(6));
    const italicKeywords = highlightKeywords.filter(k => k.startsWith('italic:')).map(k => k.slice(8));

    boldKeywords.forEach(keyword => {
      processedContent = processedContent.replace(new RegExp(keyword, 'gi'), `**${keyword}**`);
    });
    italicKeywords.forEach(keyword => {
      processedContent = processedContent.replace(new RegExp(keyword, 'gi'), `*${keyword}*`);
    });

    // 移除标题中的粗体标记（对主内容）
    processedContent = processedContent.replace(/^(#{1,6})\s+\*\*(.+?)\*\*\s*$/gm, '$1 $2');

    return marked.parse(processedContent) as string;
  } catch (error) {
    console.error('Markdown渲染失败:', error);
    return `<pre>${content}</pre>`;
  }
};

// 渲染主内容 Markdown
const renderedDisplayedMarkdown = computed(() => {
  return renderMarkdown(displayedContent.value);
});

// 渲染查重结果 Markdown（带关键词高亮）
const renderPlagiarismMarkdown = computed(() => {
  if (!plagiarismResult.value?.details) return '';
  const highlightKeywords = [
    'bold:重复',
    'bold:相似',
    'italic:原创',
    'bold:建议',
    'bold:位置',
    'bold:风险'
  ];
  return renderMarkdown(plagiarismResult.value.details, highlightKeywords);
});

/**
 * 统一的代码高亮应用函数
 */
const applyCodeHighlighting = async (selector: string) => {
  await nextTick();
  const preBlocks = document.querySelectorAll(selector);
  preBlocks.forEach((block) => {
    if (!(block as HTMLElement).dataset.highlighted) {
      hljs.highlightElement(block as HTMLElement);
    }
  });
};

// 监听渲染内容变化，应用代码高亮
watch(renderedDisplayedMarkdown, () => applyCodeHighlighting('.markdown-preview pre code'));

// 监听查重结果渲染，应用代码高亮
watch(renderPlagiarismMarkdown, () => applyCodeHighlighting('.plagiarism-details .markdown-preview pre code'));

// 切换设置面板
const toggleSettings = () => {
  showSettings.value = !showSettings.value;
};

// 折叠切换函数
const toggleCollapse = (section: keyof typeof collapsedSections.value) => {
  collapsedSections.value[section] = !collapsedSections.value[section];
  saveCollapsedSections();
};

// 保存折叠状态到本地存储
const saveCollapsedSections = async () => {
  if (storage) {
    try {
      await storage.saveCollapsedSections(collapsedSections.value);
    } catch (error) {
      console.error('保存折叠状态失败:', error);
    }
  }
};

// 从本地存储加载折叠状态
const loadCollapsedSections = async () => {
  if (storage) {
    try {
      const saved = await storage.loadCollapsedSections();
      if (saved) {
        Object.assign(collapsedSections.value, saved);
      }
    } catch (error) {
      console.error('加载折叠状态失败:', error);
    }
  }
};

// 清理编辑模式状态
const clearEditState = () => {
  editTargetDoc.value = null;
  originalContent.value = '';
  editCustomInput.value = ''; // 清理自定义提问输入
  aiSuggestions.value = null;
  plagiarismResult.value = null;
};

/**
 * 统一的编辑状态重置函数
 */
const resetEditStates = () => {
  isApplying.value = false;
  isUndoing.value = false;
  isInsertingSubDoc.value = false;
  isAnalyzing.value = false;
  isCheckingPlagiarism.value = false;
};


// 停止生成
const handleStop = () => {
  if (abortController.value) {
    abortController.value.abort();
    // 注意：不在这里重置 abortController.value，让 finally 块处理
    // 但要重置所有相关状态
    isGenerating.value = false;
    resetEditStates();
    // showMessage('✓ 已停止生成', 2000, 'info');
  } else {
    // 如果 abortController 不存在，也强制重置状态
    isGenerating.value = false;
    resetEditStates();
    // showMessage('✓ 已停止生成', 2000, 'info');
  }
};

/**
 * 统一的内容处理函数
 * 移除 frontmatter 和标题，并转换为思源兼容格式
 */
const processContent = (content: string): string => {
  const withoutFrontmatter = removeFrontmatter(content);
  const withoutHeadings = removeHeadings(withoutFrontmatter);
  return convertToSiyuanMarkdown(withoutHeadings);
};

/**
 * 转换 Markdown 为思源兼容格式
 * 思源笔记对某些 Markdown 语法有特殊要求
 *
 * 注意：思源笔记在使用 markdown 模式时会解析 Markdown 语法
 * 但某些格式（如粗体）可能在某些情况下显示不正确
 */
const convertToSiyuanMarkdown = (content: string): string => {
  let converted = content;

  // 1. 确保标题前后有空行
  const headingStart = /([^\n])\n(#{1,6}\s)/g;
  const headingEnd = /(#{1,6}\s[^\n]+)\n([^\n#])/g;
  converted = converted.replace(headingStart, '$1\n\n$2');
  converted = converted.replace(headingEnd, '$1\n\n$2');

  // 2. 处理粗体格式
  // 思源笔记在使用 markdown 模式时，粗体标记可能被解析但不显示效果
  // 临时解决方案：移除粗体标记，保留文本内容
  // TODO: 找到更好的方法让思源正确显示粗体
  converted = converted.replace(/\*\*([^*]+?)\*\*/g, '$1'); // 移除粗体标记
  converted = converted.replace(/__([^_]+?)__/g, '$1'); // 移除另一种粗体标记

  // 3. 处理斜体格式（同样可能有显示问题，暂时保留）
  // converted = converted.replace(/\*([^*]+?)\*/g, '$1'); // 如需移除斜体，取消注释

  // 4. 确保代码块前后有空行
  const codeBlockStart = /([^\n])\n```/g;
  const codeBlockEnd = /```\n([^\n])/g;
  converted = converted.replace(codeBlockStart, '$1\n\n```');
  converted = converted.replace(codeBlockEnd, '```\n\n$1');

  // 5. 确保列表前后有空行
  const listUnordered = /([^\n])\n([-*+]\s)/g;
  const listOrdered = /([^\n])\n(\d+\.\s)/g;
  converted = converted.replace(listUnordered, '$1\n\n$2');
  converted = converted.replace(listOrdered, '$1\n\n$2');

  // 6. 清理多余的连续空行（最多保留两个换行符）
  converted = converted.replace(/\n{3,}/g, '\n\n');

  return converted;
};

// 复制内容
const copyContent = async () => {
  if (!generatedContent.value) return;

  try {
    // 转换为思源兼容的 Markdown 格式
    const siyuanContent = convertToSiyuanMarkdown(generatedContent.value);
    await navigator.clipboard.writeText(siyuanContent);
    // showMessage('✓ 已复制Markdown到剪贴板', 2000, 'info');
  } catch (error) {
    console.error('复制失败:', error);
    showMessage('复制失败', 2000, 'error');
  }
};

// 清除内容
const clearContent = () => {
  generatedContent.value = '';
  displayedContent.value = '';
  errorMessage.value = '';
};

// 选择目标文档
const selectTargetDocument = async () => {
  try {
    // 优先使用激活窗口的文档ID，而不是依赖光标位置
    // 这样可以确保选择的是用户当前正在查看的文档
    const protyle = document.querySelector('.layout__wnd--active .protyle:not(.fn__none)');
    let docId = protyle?.querySelector('.protyle-background')?.getAttribute('data-node-id') || null;

    // 如果激活窗口方法失败，再使用getCurrentDocId作为备用方案
    if (!docId) {
      docId = await getCurrentDocId();
    }

    if (!docId) {
      showMessage('无法获取当前文档，请将光标放在文档中', 2000, 'error');
      return;
    }

    await loadTargetDocument(docId);
  } catch (error) {
    console.error('选择文档失败:', error);
  }
};

// 加载目标文档
const loadTargetDocument = async (docId: string) => {
  const result = await loadDocument(docId);
  if (!result) return;

  // 移除frontmatter，获取纯净的Markdown内容
  const cleanContent = removeFrontmatter(result.content);

  // 保存文档信息（使用清理后的内容）
  editTargetDoc.value = {
    id: docId,
    title: result.title,
    content: cleanContent,
    isBlock: false // 标记为文档
  };

  // 保存原始内容用于对比（使用清理后的内容）
  originalContent.value = cleanContent;

  // 将文档内容加载到生成内容区域（使用清理后的内容）
  generatedContent.value = cleanContent;
  displayedContent.value = cleanContent;

  // 清理编辑模式相关的状态，确保重新选择文档时显示正确的状态
  editCustomInput.value = ''; // 清理自定义输入
  aiSuggestions.value = null; // 清理AI建议
  plagiarismResult.value = null; // 清理查重结果
  lastEditHistory.value = null; // 清理编辑历史

  // showMessage(`✓ 已选择文档: ${editTargetDoc.value.title}`, 2000, 'info');
};

/**
 * 加载目标块（用于拖拽块时只加载块内容）
 */
const loadTargetBlock = async (blockId: string) => {
  try {

    // 获取块信息
    const block = await api.getBlockByID(blockId);
    if (!block) {
      console.error('❌ 无法获取块信息');
      showMessage('无法获取块信息', 3000, 'error');
      return;
    }

    // 获取块的 Markdown 内容
    let blockContent = await api.getBlockMarkdown(blockId);

    // 备用方案：如果 getBlockMarkdown 失败，尝试使用 block.content
    if (!blockContent && block.content) {
      console.warn('⚠️ getBlockMarkdown 返回空，使用 block.content 作为备用');
      blockContent = block.content;

      // 对于标题块，添加标题标记
      if (block.type === 'h') {
        const level = (block as any).headingLevel || 1;
        const headingPrefix = '#'.repeat(level) + ' ';
        if (!blockContent.startsWith('#')) {
          blockContent = headingPrefix + blockContent;
        }
      }
    }

    if (!blockContent) {
      console.error('❌ 无法获取块内容，blockContent 为空');
      showMessage('无法获取块内容', 3000, 'error');
      return;
    }


    // 获取块所属文档的路径（用于显示）
    const hPath = await api.getHPathByID(block.root_id || blockId);
    const docName = hPath ? hPath.split('/').pop() : '未命名';

    // 构建块标题
    const blockTitle = block.content
      ? `${block.content.substring(0, 30)}${block.content.length > 30 ? '...' : ''}`
      : '块内容';

    // 移除 frontmatter
    const cleanContent = removeFrontmatter(blockContent);

    // 保存块信息
    editTargetDoc.value = {
      id: blockId,
      title: `${blockTitle} (${docName})`,
      content: cleanContent,
      isBlock: true // 标记为块
    };

    // 保存原始内容用于对比
    originalContent.value = cleanContent;

    // 将块内容加载到生成内容区域
    generatedContent.value = cleanContent;
    displayedContent.value = cleanContent;

    // 清理编辑模式相关的状态
    editCustomInput.value = '';
    aiSuggestions.value = null;
    plagiarismResult.value = null;
    lastEditHistory.value = null;


  } catch (error) {
    console.error('❌ 加载块失败:', error);
    showMessage('加载块失败: ' + (error as Error).message, 3000, 'error');
  }
};

// 清除目标文档
const clearTargetDocument = () => {
  clearEditState();
  clearContent();
  // showMessage('✓ 已清除目标文档', 1500, 'info');
};


// 应用编辑
const applyEdit = async () => {
  if (!editTargetDoc.value) return;

  isApplying.value = true;
  try {
    // 保存编辑历史（用于撤回）
    lastEditHistory.value = {
      docId: editTargetDoc.value.id,
      docTitle: editTargetDoc.value.title,
      originalContent: originalContent.value,
      timestamp: Date.now()
    };

    let siyuanContent: string;

    // 区分文档和块的处理
    if (editTargetDoc.value.isBlock) {
      // 块编辑：只移除 frontmatter，不移除标题
      const withoutFrontmatter = removeFrontmatter(generatedContent.value);
      siyuanContent = convertToSiyuanMarkdown(withoutFrontmatter);
    } else {
      // 文档编辑：移除 frontmatter 和标题
      siyuanContent = processContent(generatedContent.value);
    }

    // 使用updateBlock API更新文档内容
    await api.updateBlock('markdown', siyuanContent, editTargetDoc.value.id);


    // 更新原始内容为当前内容
    originalContent.value = generatedContent.value;
    editTargetDoc.value.content = generatedContent.value;
  } catch (error) {
    console.error('应用编辑失败:', error);
  } finally {
    isApplying.value = false;
  }
};

// 撤回编辑
const undoEdit = async () => {
  if (!lastEditHistory.value) return;

  isUndoing.value = true;
  try {
    // 恢复原始内容
    await api.updateBlock('markdown', lastEditHistory.value.originalContent, lastEditHistory.value.docId);

    showMessage(`✓ 已撤回对文档的编辑: ${lastEditHistory.value.docTitle}`, 2000, 'info');

    // 如果当前编辑的是同一个文档，更新界面
    if (editTargetDoc.value && editTargetDoc.value.id === lastEditHistory.value.docId) {
      generatedContent.value = lastEditHistory.value.originalContent;
      displayedContent.value = lastEditHistory.value.originalContent;
      originalContent.value = lastEditHistory.value.originalContent;
      editTargetDoc.value.content = lastEditHistory.value.originalContent;
    }

    // 清除历史记录
    lastEditHistory.value = null;
  } catch (error) {
    console.error('撤回编辑失败:', error);
  } finally {
    isUndoing.value = false;
  }
};

/**
 * AI智能编辑功能
 */
const aiEditAction = async (action: 'polish' | 'expand' | 'condense' | 'fix' | 'translate' | 'rewrite' | 'summary') => {
  if (!editTargetDoc.value) {
    showMessage('请先选择要编辑的文档', 2000, 'info');
    return;
  }

  closeSettings();

  const actionPrompts = {
    polish: '请对以下文档进行润色优化，保持原有结构，提升语言质量和可读性，使表达更加专业、流畅。保持Markdown格式，直接输出优化后的完整文档内容：',
    expand: '请对以下文档进行扩写，增加更详细的说明、例子和补充信息，使内容更加丰富和全面。保持Markdown格式，直接输出扩写后的完整文档内容：',
    condense: '请对以下文档进行精简，去除冗余内容，保留核心要点，使表达更加简洁有力。保持Markdown格式，直接输出精简后的完整文档内容：',
    fix: '请对以下文档进行错误检查和修正，包括拼写错误、语法错误、逻辑错误等。保持Markdown格式，直接输出修正后的完整文档内容：',
    translate: '请将以下文档翻译成中文（如果原文是中文则翻译成英文）。保持原有的Markdown格式和文档结构，只翻译文本内容。直接输出翻译后的完整文档内容：',
    rewrite: '请用不同的表达方式重写以下文档，保持核心意思不变，但使用全新的语言风格和句式结构。保持Markdown格式，直接输出改写后的完整文档内容：',
    summary: '请为以下文档生成一个简洁的总结，包括主要内容和关键要点。总结应该清晰明了，突出文档的核心信息。保持Markdown格式，直接输出总结内容：'
  };

  startGeneration();

  try {
    const options: GenerateOptions = {
      userInput: `${actionPrompts[action]}\n\n${editTargetDoc.value.content}`,
      systemPrompt: '你是一个专业的文档编辑助手，擅长优化Markdown文档。请直接输出优化后的完整文档，不要添加任何解释性文字。',
      temperature: 0.3,
      maxTokens: maxTokens.value,
      signal: abortController.value?.signal,
      onChunk: defaultOnChunk
    };

    await props.onGenerate(options);

    // showMessage('✓ AI编辑完成', 2000, 'info');
  } catch (error) {
    if (handleGenerationError(error as Error, 'AI编辑')) return;
  } finally {
    finishGeneration();
  }
};

/**
 * 编辑模式：自定义提问处理
 */
const handleCustomEdit = async () => {
  if (!editTargetDoc.value) {
    showMessage('请先选择要编辑的文档', 2000, 'info');
    return;
  }

  // 如果既没有自定义输入，又没有选择提示词，则提示用户
  if (!editCustomInput.value.trim() && !currentPromptName.value) {
    showMessage('请输入编辑指令或选择提示词', 2000, 'info');
    return;
  }

  closeSettings();
  startGeneration();

  try {
    // 根据是否选择提示词来决定系统提示词
    let finalSystemPrompt = '你是一个专业的文档编辑助手，擅长根据用户指令优化Markdown文档。请直接输出编辑后的完整文档，不要添加任何解释性文字。';
    let userInput: string;

    if (editCustomInput.value.trim()) {
      // 用户有自定义输入，使用自定义输入
      if (currentPromptName.value) {
        // 同时选择了提示词，使用选中的提示词配置
        finalSystemPrompt = systemPrompt.value;

      } else {
      }

      userInput = `请根据以下指令对文档进行编辑。保持Markdown格式，直接输出编辑后的完整文档内容：

编辑指令：${editCustomInput.value}

原文档：
${editTargetDoc.value.content}`;
    } else {
      // 没有自定义输入，但选择了提示词，使用提示词配置直接生成
      finalSystemPrompt = systemPrompt.value;
      userInput = `${editTargetDoc.value.content}`;
    }

    const options: GenerateOptions = {
      userInput,
      systemPrompt: finalSystemPrompt,
      temperature: temperature.value,
      maxTokens: maxTokens.value,
      signal: abortController.value?.signal,
      onChunk: defaultOnChunk
    };

    await props.onGenerate(options);

    editCustomInput.value = '';
    showMessage('✓ 自定义编辑完成', 2000, 'info');
  } catch (error) {
    if (handleGenerationError(error as Error, '自定义编辑')) return;
  } finally {
    finishGeneration();
  }
};

/**
 * AI文档分析和建议
 */
const analyzeDocument = async () => {
  if (!editTargetDoc.value) {
    showMessage('请先选择要分析的文档', 2000, 'info');
    return;
  }

  closeSettings();
  startGeneration(); // 初始化abortController
  isAnalyzing.value = true;

  try {
    const options: GenerateOptions = {
      userInput: `请分析以下文档，提供具体的优化建议，包括但不限于：
1. 结构优化建议
2. 内容完善建议
3. 语言表达改进点
4. 逻辑性和连贯性建议

请用简洁的语言给出分析报告和可执行的建议。\n\n文档内容：\n${editTargetDoc.value.content}`,
      systemPrompt: '你是一个专业的文档分析专家，擅长发现文档中的问题并提供建设性的优化意见。',
      temperature: 0.5,
      maxTokens: 1500,
      signal: abortController.value?.signal,
      onChunk: createSingleTargetCallback(aiSuggestions)
    };

    await props.onGenerate(options);
    // showMessage('✓ 分析完成', 2000, 'info');
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      finishGeneration();
      isAnalyzing.value = false;
      return;
    }
    showMessage('文档分析失败: ' + (error as Error).message, 3000, 'error');
  } finally {
    // 如果不是用户主动停止且abortController仍存在，则重置状态
    if (abortController.value) {
      finishGeneration();
      isAnalyzing.value = false;
    }
  }
};

/**
 * AI查重功能
 */
const checkPlagiarism = async () => {
  if (!editTargetDoc.value) {
    showMessage('请先选择要查重的文档', 2000, 'info');
    return;
  }

  closeSettings();
  startGeneration(); // 初始化abortController
  isCheckingPlagiarism.value = true;
  plagiarismResult.value = null;

  try {
    const options: GenerateOptions = {
      userInput: `请对以下文档进行全面的原创性分析，重点关注以下方面：

一、文档内部重复内容检测：
1. 检查同一段落、句子或表述是否在文档中反复出现
2. 识别重复的段落、章节或观点
3. 检查相同内容是否用不同方式重复表达

二、外部内容相似性检测：
1. 识别可能与已知资料、公开内容相似的部分
2. 评估语言表达和内容结构的原创性
3. 检查是否存在常见的模板化或套话内容

三、具体分析要求：
- 指出具体重复或相似的位置（段落、行数等）
- 给出相似度百分比评估（0-100%）
- 评估整体风险等级：低风险/中风险/高风险
- 提供明确的改进建议

请使用Markdown格式返回分析结果，包括：
- 使用标题组织内容
- 使用列表列出问题和建议
- 使用**粗体**标记重要内容
- 使用*斜体*标记正面内容

文档内容：
${editTargetDoc.value.content}`,
      systemPrompt: '你是一个专业的查重分析专家，擅长识别文档中的重复内容和潜在抄袭。请以Markdown格式返回详细分析结果，使用标题、列表等Markdown语法让内容更加结构化和易读。',
      temperature: 0.3,
      maxTokens: 3000,
      signal: abortController.value?.signal,
      onChunk: createCustomStreamCallback((newContent) => {
        // 简单分析文本内容，尝试提取风险等级和相似度
        const riskLevel = detectRiskLevel(newContent);
        const similarityRate = detectSimilarityRate(newContent);

        plagiarismResult.value = {
          riskLevel,
          similarityRate,
          details: newContent
        };
      })
    };

    await props.onGenerate(options);

    // 确保至少返回基本结果
    if (!plagiarismResult.value || !plagiarismResult.value.details) {
      plagiarismResult.value = {
        riskLevel: 'low',
        similarityRate: 0,
        details: '查重分析已完成，未发现明显的重复或抄袭内容。建议继续保持内容的原创性。'
      };
    }

    // showMessage('✓ 查重完成', 2000, 'info');
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      finishGeneration();
      isCheckingPlagiarism.value = false;
      return;
    }
    showMessage('查重分析失败: ' + (error as Error).message, 3000, 'error');
  } finally {
    // 如果不是用户主动停止且abortController仍存在，则重置状态
    if (abortController.value) {
      finishGeneration();
      isCheckingPlagiarism.value = false;
    }
  }
};

/**
 * 检测风险等级
 */
const detectRiskLevel = (text: string): 'low' | 'medium' | 'high' => {
  const lowerText = text.toLowerCase();

  if (lowerText.includes('高风险') || lowerText.includes('high risk') ||
      lowerText.includes('严重重复') || lowerText.includes('大量相似')) {
    return 'high';
  } else if (lowerText.includes('中风险') || lowerText.includes('medium risk') ||
             lowerText.includes('部分重复') || lowerText.includes('中等相似')) {
    return 'medium';
  }

  return 'low';
};

/**
 * 检测相似度百分比
 */
const detectSimilarityRate = (text: string): number => {
  const match = text.match(/(\d+)%?/);
  if (match) {
    const num = parseInt(match[1]);
    return Math.min(Math.max(num, 0), 100);
  }
  return 0;
};

/**
 * 获取风险等级文本
 */
const getRiskLevelText = (riskLevel: string): string => {
  const riskLevelMap: Record<string, string> = {
    low: '低风险',
    medium: '中风险',
    high: '高风险'
  };
  return riskLevelMap[riskLevel] || riskLevel;
};

/**
 * 插入子文档功能
 */
const insertSubDocument = async () => {
  if (!editTargetDoc.value || !generatedContent.value) {
    showMessage('请先选择文档并生成内容', 2000, 'info');
    return;
  }

  // 获取父文档的人性化路径，提取文档名
  const parentHPath = await api.getHPathByID(editTargetDoc.value.id);
  const parentDocName = parentHPath ? parentHPath.split('/').pop() || '文档' : '文档';

  // 生成子文档名称：父文档名 + 总结
  const subDocTitle = `${parentDocName}总结`;

  // 添加时间戳以避免重复
  const timestamp = new Date().toLocaleDateString('zh-CN').replace(/\//g, '-');
  const finalSubDocTitle = `${subDocTitle}_${timestamp}`;

  isInsertingSubDoc.value = true;

  try {
    // 使用统一的内容处理函数
    const siyuanContent = processContent(generatedContent.value);

    // 获取父文档信息
    const parentDoc = await api.getBlockByID(editTargetDoc.value.id);
    if (!parentDoc || !parentDoc.box) {
      throw new Error('无法获取父文档信息');
    }

    const notebookId = parentDoc.box;

    // 构建子文档路径：在父文档下创建子文档
    // 思源的路径格式：/笔记本/父文档路径/子文档名
    const subDocPath = `${parentHPath}/${finalSubDocTitle}`;

    // 创建子文档
    const subDocId = await api.createDocWithMd(
      notebookId,
      subDocPath,
      siyuanContent
    );

    if (subDocId) {
      showMessage(`✓ 已在文档"${parentDoc.content || editTargetDoc.value.title}"下创建子文档: ${finalSubDocTitle}`, 3000, 'info');
    } else {
      throw new Error('创建子文档失败');
    }
  } catch (error) {
    console.error('插入子文档失败:', error);
    showMessage('插入子文档失败: ' + (error as Error).message, 3000, 'error');
  } finally {
    isInsertingSubDoc.value = false;
  }
};

/**
 * 应用AI建议进行优化
 */
const applySuggestions = async () => {
  if (!editTargetDoc.value || !aiSuggestions.value) return;

  closeSettings();
  startGeneration();

  try {
    const options: GenerateOptions = {
      userInput: `请根据以下分析建议，对文档进行优化。直接输出优化后的完整文档内容，保持Markdown格式。

分析建议：
${aiSuggestions.value}

原文档：
${editTargetDoc.value.content}`,
      systemPrompt: '你是一个专业的文档编辑助手。请根据建议优化文档，直接输出结果，不要添加解释。',
      temperature: 0.3,
      maxTokens: maxTokens.value,
      onChunk: defaultOnChunk
    };

    await props.onGenerate(options);

    aiSuggestions.value = null;
  } catch (error) {
    if (handleGenerationError(error as Error, '应用建议')) return;
  } finally {
    finishGeneration();
  }
};

// 当聚焦配置名称输入框时，自动填充当前配置名称
const onPromptNameFocus = () => {
  if (currentPromptName.value && !newPromptName.value) {
    newPromptName.value = currentPromptName.value;
  }
};

// 保存当前提示词配置
const saveCurrentPrompt = async () => {
  // 如果输入框为空但有当前配置名称，使用当前配置名称
  const promptName = newPromptName.value.trim() || currentPromptName.value;

  if (!promptName) {
    showMessage('请输入配置名称', 2000, 'info');
    return;
  }

  // 检查是否已存在同名配置（更新模式）
  const existingIndex = savedPrompts.value.findIndex(p => p.name === promptName);

  const promptConfig: AIPromptConfig = {
    id: existingIndex >= 0 ? savedPrompts.value[existingIndex].id : Date.now().toString(),
    name: promptName,
    systemPrompt: systemPrompt.value,
    temperature: temperature.value,
    maxTokens: maxTokens.value,
    enableTypewriter: enableTypewriter.value,
    contextMessageLimit: contextMessageLimit.value,
    createdAt: existingIndex >= 0 ? savedPrompts.value[existingIndex].createdAt : Date.now()
  };

  if (existingIndex >= 0) {
    // 更新现有配置
    savedPrompts.value[existingIndex] = promptConfig;
  } else {
    // 添加新配置
    savedPrompts.value.push(promptConfig);
  }

  try {
    if (storage) {
      await storage.savePrompts(savedPrompts.value);
    }
  } catch (error) {
    console.error('保存提示词配置失败:', error);
  }

  newPromptName.value = '';
  currentPromptName.value = promptName;
  // showMessage(
  //   existingIndex >= 0
  //     ? `✓ 已更新配置: ${promptConfig.name}`
  //     : `✓ 已保存配置: ${promptConfig.name}`,
  //   2000,
  //   'info'
  // );
};

// 清除当前提示词选择
const clearCurrentPrompt = async () => {
  currentPromptName.value = '';

  try {
    if (storage) {
      await storage.clearCurrentPrompt();
    }
  } catch (error) {
    console.error('清除当前提示词失败:', error);
  }
};

/**
 * 获取当前光标所在的块ID
 */
function getCurrentBlockId(): string | null {
  // 方法1: 获取当前选中的块
  const selectedBlock = document.querySelector('.protyle-wysiwyg--select');
  if (selectedBlock) {
    return selectedBlock.getAttribute('data-node-id');
  }

  // 方法2: 获取光标所在的块（聚焦的块）
  const focusedBlock = document.querySelector('.protyle-wysiwyg [data-node-id].protyle-wysiwyg--focus');
  if (focusedBlock) {
    return focusedBlock.getAttribute('data-node-id');
  }

  // 方法3: 通过 window.getSelection() 精确获取光标位置
  const selection = window.getSelection();
  if (selection && selection.rangeCount > 0) {
    const range = selection.getRangeAt(0);
    let node: Node | null = range.startContainer;

    // 向上查找直到找到带有 data-node-id 和 data-type 的元素
    while (node) {
      if (node instanceof Element) {
        const nodeId = node.getAttribute('data-node-id');
        const dataType = node.getAttribute('data-type');

        // 必须同时有 data-node-id 和 data-type 才是有效的块
        if (nodeId && dataType) {
          return nodeId;
        }
      }
      node = node.parentNode;
    }
  }

  return null;
}

/**
 * 通过块ID获取其所属的文档ID
 */
async function getDocIdByBlockId(blockId: string): Promise<string | null> {
  try {
    const block = await api.getBlockByID(blockId);
    return block?.root_id || null;
  } catch (error) {
    console.error('获取文档ID失败:', error);
    return null;
  }
}

// 加载提示词配置
const loadPrompt = async (index: number) => {
  const prompt = savedPrompts.value[index];
  if (!prompt) return;

  systemPrompt.value = prompt.systemPrompt;
  temperature.value = prompt.temperature;
  maxTokens.value = prompt.maxTokens;
  enableTypewriter.value = prompt.enableTypewriter;
  contextMessageLimit.value = prompt.contextMessageLimit || 1;

  // 设置当前选中的提示词名称
  currentPromptName.value = prompt.name;
  showPromptSelector.value = false;

  // 保存当前选中的提示词到存储
  try {
    if (storage) {
      await storage.saveCurrentPrompt(prompt.name);
    }
  } catch (error) {
    console.error('保存当前提示词失败:', error);
  }
};

// 编辑提示词配置
const editPrompt = (index: number) => {
  const prompt = savedPrompts.value[index];
  if (!prompt) return;

  // 加载配置到编辑区域
  systemPrompt.value = prompt.systemPrompt;
  temperature.value = prompt.temperature;
  maxTokens.value = prompt.maxTokens;
  enableTypewriter.value = prompt.enableTypewriter;
  contextMessageLimit.value = prompt.contextMessageLimit;

  // 设置当前选中的提示词名称
  currentPromptName.value = prompt.name;

  // 打开设置面板以便编辑
  showSettings.value = true;
  showPromptSelector.value = false;
};

// 删除提示词配置
const deletePrompt = (index: number) => {
  const prompt = savedPrompts.value[index];
  if (!prompt) return;

  if (confirm(`确定删除配置: ${prompt.name}?`)) {
    savedPrompts.value.splice(index, 1);
    savePromptsToStorage();
  }
};

// 获取提示词预览
const getPromptPreview = (text: string): string => {
  const maxLength = 60;
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
};

// 保存提示词到存储
const savePromptsToStorage = async () => {
  if (!storage) return;

  try {
    await storage.savePrompts(savedPrompts.value);
  } catch (error) {
    console.error('保存提示词配置失败:', error);
  }
};

// 从存储加载提示词配置
const loadPromptsFromStorage = async () => {

  try {
    const prompts = await storage.loadPrompts();
    if (prompts) {
      savedPrompts.value = prompts;
    }

    const currentPromptName = await storage.loadCurrentPrompt();
    if (currentPromptName) {
      const promptIndex = savedPrompts.value.findIndex(p => p.name === currentPromptName);
      if (promptIndex !== -1) {
        loadPrompt(promptIndex);
      }
    }
  } catch (error) {
    console.error('从插件存储加载提示词配置失败:', error);
  }
};

// 组件挂载时加载保存的提示词
onMounted(async () => {

  // 初始化存储实例
  if (props.plugin) {
    storage = new AIGeneratorStorage(props.plugin);
    await storage.init();
    await loadPromptsFromStorage();
    await loadSettings();
    await loadCollapsedSections();
  }

  // 启动自动加载当前文档
  startAutoLoadCurrentDoc();
});

// 保存设置到存储
const saveSettings = async () => {
  if (!storage) {
    console.warn('存储实例未初始化，跳过设置保存');
    return;
  }

  const settings = {
    systemPrompt: systemPrompt.value,
    temperature: temperature.value,
    maxTokens: maxTokens.value,
    enableTypewriter: enableTypewriter.value,
    contextMessageLimit: contextMessageLimit.value
  };

  try {
    const success = await storage.saveSettings(settings);
    if (success) {
    }
  } catch (error) {
    console.error('保存设置失败:', error);
  }
};

// 加载设置
const loadSettings = async () => {
  if (!storage) {
    console.warn('存储实例未初始化，跳过设置加载');
    return;
  }

  try {
    const settings = await storage.loadSettings();
    if (settings) {
      systemPrompt.value = settings.systemPrompt || systemPrompt.value;
      temperature.value = settings.temperature ?? temperature.value;
      maxTokens.value = settings.maxTokens || maxTokens.value;
      enableTypewriter.value = settings.enableTypewriter ?? enableTypewriter.value;
      contextMessageLimit.value = settings.contextMessageLimit ?? contextMessageLimit.value;
    }
  } catch (error) {
    console.error('从插件存储加载设置失败:', error);
  }
};

// 监听设置变化
watch([systemPrompt, temperature, maxTokens, enableTypewriter, contextMessageLimit], () => {
  saveSettings();
});

// 监听当前提示词名称变化（调试用）
watch(currentPromptName, (newName, oldName) => {
});
</script>

<style scoped lang="scss">
@use "./index.scss";
</style>
