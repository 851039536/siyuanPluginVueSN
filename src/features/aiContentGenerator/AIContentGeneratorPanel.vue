<template>
  <div class="ai-content-panel">
    <!-- 顶部工具栏 -->
    <div class="panel-header">
      <div class="header-title">
        <span>🤖 {{ i18n.aiContentGenerator || 'AI信息生成' }}</span>
      </div>
      <div class="header-actions">
        <!-- 移动端：收起/展开输入区域按钮 -->
        <button
          v-if="isMobile"
          class="btn-icon"
          @click="showInputSection = !showInputSection"
          :class="{ 'active': showInputSection }"
          :title="showInputSection ? '收起输入' : '展开输入'"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <use :xlink:href="showInputSection ? '#iconUp' : '#iconDown'"></use>
          </svg>
        </button>
        <!-- Edit模式切换按钮 -->
        <button
          class="btn-icon"
          @click="toggleEditMode"
          :class="{ 'active': editMode }"
          :title="i18n.editMode || '编辑模式'"
        >
          <svg width="18" height="18" viewBox="0 0 24 24">
            <use xlink:href="#iconEdit"></use>
          </svg>
        </button>
        <button class="btn-icon" @click="toggleSettings" :title="i18n.conversationSettings || '对话设置'">
          <svg width="18" height="18" viewBox="0 0 24 24">
            <use xlink:href="#iconSettings"></use>
          </svg>
        </button>
      </div>
    </div>

    <!-- 对话设置面板 -->
    <div class="settings-panel" v-if="showSettings">
      <div class="panel-section">
        <div class="section-header">
          <span>💬 {{ i18n.conversationSettings || '对话设置' }}</span>
          <button class="btn-close" @click="toggleSettings">
            <svg width="14" height="14">
              <use xlink:href="#iconClose"></use>
            </svg>
          </button>
        </div>
        <div class="section-content">
          <div class="setting-item">
            <div class="label-row">
              <label>{{ i18n.systemPrompt || '系统提示词' }}</label>
            </div>
            <textarea
              v-model="systemPrompt"
              class="prompt-input"
              :placeholder="i18n.systemPromptPlaceholder || '输入系统提示词，定义AI的角色和行为...'"
              rows="4"
            ></textarea>
          </div>
          <div class="setting-item">
            <label>{{ i18n.temperature || '创造性' }} ({{ temperature }})</label>
            <input
              type="range"
              v-model.number="temperature"
              min="0"
              max="2"
              step="0.1"
              class="slider"
            />
            <div class="slider-hint">
              <span>{{ i18n.precise || '精确' }}</span>
              <span>{{ i18n.creative || '创造' }}</span>
            </div>
          </div>
          <div class="setting-item">
            <label>{{ i18n.maxTokens || '最大长度' }}</label>
            <input
              type="number"
              v-model.number="maxTokens"
              min="100"
              max="50000"
              step="100"
              class="number-input"
            />
          </div>
          <!-- 需求5：上下文消息数量配置 -->
          <div class="setting-item">
            <label>{{ i18n.contextMessageLimit || '上下文消息数量' }} ({{ contextMessageLimit }})</label>
            <input
              type="range"
              v-model.number="contextMessageLimit"
              min="1"
              max="10"
              step="1"
              class="slider"
            />
            <div class="slider-hint">
              <span>{{ i18n.minimal || '最少' }} (1)</span>
              <span>{{ i18n.maximum || '最多' }} (10)</span>
            </div>
          </div>
          <!-- 问题3：删除强制Markdown输出选项，默认就是Markdown格式 -->
          <!-- 打字机效果已默认启用,不再提供可选项 -->

          <!-- 保存提示词配置 -->
          <div class="setting-item save-prompt-section">
            <div class="save-prompt-header">
              <label>{{ i18n.savePromptConfig || '保存当前配置' }}</label>
              <span v-if="currentPromptName" class="editing-hint">
                ({{ i18n.editing || '编辑' }}: {{ currentPromptName }})
              </span>
            </div>
            <div class="save-prompt-input-group">
              <input
                v-model="newPromptName"
                type="text"
                class="prompt-name-input"
                :placeholder="currentPromptName || (i18n.promptNamePlaceholder || '输入配置名称...')"
                @keydown.enter="saveCurrentPrompt"
                @focus="onPromptNameFocus"
              />
              <button
                class="btn-save-prompt"
                @click="saveCurrentPrompt"
                :disabled="!newPromptName.trim() && !currentPromptName"
              >
                <svg width="14" height="14">
                  <use xlink:href="#iconSave"></use>
                </svg>
                {{ i18n.save || '保存' }}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 输入区域 -->
    <div class="input-section" v-show="showInputSection">
      <!-- 普通模式：紧凑工具栏（提示词选择 + 引用文档 + 输入框 + 生成按钮） -->
      <div v-if="!editMode" class="compact-toolbar">
        <!-- 提示词选择按钮 -->
        <div class="prompt-selector-wrapper">
          <button class="btn-prompt-compact" @click="showPromptSelector = !showPromptSelector" :title="currentPromptName || (i18n.selectPrompt || '选择提示词')">
            <svg width="14" height="14">
              <use xlink:href="#iconList"></use>
            </svg>
            <span v-if="currentPromptName" class="prompt-name-compact">{{ currentPromptName }}</span>
            <span v-else>{{ i18n.prompt || '提示词' }}</span>
            <span v-if="savedPrompts.length > 0 && !currentPromptName" class="prompt-count-compact">{{ savedPrompts.length }}</span>
            <button v-if="currentPromptName" class="btn-clear-inline" @click.stop="clearCurrentPrompt" :title="i18n.clear || '清除'">
              <svg width="10" height="10">
                <use xlink:href="#iconClose"></use>
              </svg>
            </button>
          </button>

          <!-- 提示词选择面板 -->
          <div v-if="showPromptSelector" class="prompt-selector-panel">
            <div class="prompt-selector-header">
              <span>{{ i18n.savedPrompts || '已保存的提示词' }}</span>
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
                :placeholder="i18n.searchPrompts || '搜索提示词...'"
              />
            </div>

            <div v-if="filteredPrompts.length === 0" class="empty-prompts">
              <p v-if="savedPrompts.length === 0">{{ i18n.noSavedPrompts || '暂无保存的提示词，请在对话设置中保存' }}</p>
              <p v-else>{{ i18n.noMatchingPrompts || '没有找到匹配的提示词' }}</p>
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
                      :title="i18n.edit || '编辑'"
                    >
                      <svg width="14" height="14">
                        <use xlink:href="#iconEdit"></use>
                      </svg>
                    </button>
                    <button
                      class="btn-delete-prompt"
                      @click.stop="deletePrompt(getOriginalIndex(prompt))"
                      :title="i18n.delete || '删除'"
                    >
                      <svg width="14" height="14">
                        <use xlink:href="#iconTrashcan"></use>
                      </svg>
                    </button>
                  </div>
                </div>
                <div class="prompt-item-preview">{{ getPromptPreview(prompt.systemPrompt) }}</div>
                <div class="prompt-item-meta">
                  <span>{{ i18n.temperature || '创造性' }}: {{ prompt.temperature }}</span>
                  <span>{{ i18n.maxTokens || '最大长度' }}: {{ prompt.maxTokens }}</span>
                </div>
              </div>

              <!-- 分页控制 -->
              <div v-if="totalPages > 1" class="prompt-pagination">
                <button
                  class="btn-page"
                  @click="currentPage = Math.max(1, currentPage - 1)"
                  :disabled="currentPage === 1"
                  :title="i18n.previousPage || '上一页'"
                >
                  ‹
                </button>
                <span class="page-info">{{ currentPage }} / {{ totalPages }}</span>
                <button
                  class="btn-page"
                  @click="currentPage = Math.min(totalPages, currentPage + 1)"
                  :disabled="currentPage === totalPages"
                  :title="i18n.nextPage || '下一页'"
                >
                  ›
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- 引用当前文档按钮 -->
        <button
          class="btn-reference-compact"
          @click="insertCurrentDocReference"
          :class="{ 'has-reference': referencedDocTitle }"
          :title="referencedDocTitle || (i18n.referenceCurrentDoc || '引用当前文档内容')"
        >
          <span class="btn-icon">📄</span>
          <span v-if="referencedDocTitle" class="ref-doc-name">{{ referencedDocTitle }}</span>
          <span v-else>{{ i18n.refDoc || '引用' }}</span>
          <button v-if="referencedDocTitle" class="btn-clear-inline" @click.stop="cancelDocReference" :title="i18n.cancel || '取消'">
            <svg width="10" height="10">
              <use xlink:href="#iconClose"></use>
            </svg>
          </button>
        </button>

        <!-- 输入框 -->
        <textarea
          v-model="userInput"
          class="user-input-compact"
          :placeholder="referencedDocContent ? (i18n.inputPlaceholderWithDoc || '输入问题...') : (i18n.inputPlaceholder || '输入您的问题...')"
          rows="1"
          @keydown.ctrl.enter="handleGenerate"
          :disabled="isGenerating"
        ></textarea>

        <!-- 生成/停止按钮 -->
        <button
          v-if="!isGenerating"
          class="btn-generate-compact"
          @click="handleGenerate"
          :disabled="!userInput.trim() && !referencedDocContent"
          :title="i18n.generate || '生成'"
        >
          <svg width="16" height="16">
            <use xlink:href="#iconSend"></use>
          </svg>
        </button>
        <button
          v-else
          class="btn-stop-compact"
          @click="handleStop"
          :title="i18n.stopGeneration || '停止生成'"
        >
          <svg width="16" height="16">
            <use xlink:href="#iconClose"></use>
          </svg>
        </button>
      </div>

      <!-- Edit模式：紧凑工具栏（目标文档选择 + 输入框 + 执行按钮） -->
      <div v-if="editMode" class="compact-toolbar edit-mode">
        <!-- 目标文档选择 -->
        <button class="btn-doc-compact" @click="selectTargetDocument" :title="editTargetDoc ? editTargetDoc.title : (i18n.selectDocument || '选择文档')">
          <svg width="14" height="14">
            <use xlink:href="#iconFile"></use>
          </svg>
          <span v-if="editTargetDoc" class="doc-name-compact">{{ editTargetDoc.title }}</span>
          <span v-else>{{ i18n.selectDoc || '选择文档' }}</span>
          <button v-if="editTargetDoc" class="btn-clear-inline" @click.stop="clearTargetDocument" :title="i18n.clear || '清除'">
            <svg width="10" height="10">
              <use xlink:href="#iconClose"></use>
            </svg>
          </button>
        </button>

        <!-- 编辑模式：自定义输入框 -->
        <textarea
          v-if="editTargetDoc"
          v-model="editCustomInput"
          class="user-input-compact"
          :placeholder="i18n.editCustomPlaceholder || '输入编辑指令...'"
          rows="1"
          @keydown.ctrl.enter="handleCustomEdit"
          :disabled="isGenerating"
        ></textarea>

        <!-- 执行/停止按钮 -->
        <button
          v-if="!isGenerating && editTargetDoc"
          class="btn-generate-compact"
          @click="handleCustomEdit"
          :disabled="!editCustomInput.trim()"
          :title="i18n.execute || '执行'"
        >
          <svg width="16" height="16">
            <use xlink:href="#iconSend"></use>
          </svg>
        </button>
        <button
          v-else-if="isGenerating"
          class="btn-stop-compact"
          @click="handleStop"
          :title="i18n.stopGeneration || '停止生成'"
        >
          <svg width="16" height="16">
            <use xlink:href="#iconClose"></use>
          </svg>
        </button>
      </div>

      <!-- Edit模式：AI智能编辑工具栏 -->
      <div v-if="editMode && editTargetDoc" class="ai-edit-toolbar">
        <div class="toolbar-label">
          <svg width="14" height="14">
            <use xlink:href="#iconSparkles"></use>
          </svg>
          <span>{{ i18n.aiEditTools || 'AI智能编辑' }}:</span>
        </div>
        <div class="toolbar-actions">
          <button class="btn-ai-action" @click="aiEditAction('polish')" :disabled="isGenerating" :title="i18n.aiPolish || 'AI润色'">
            <svg width="14" height="14"><use xlink:href="#iconEdit"></use></svg>
            {{ i18n.polish || '润色' }}
          </button>
          <button class="btn-ai-action" @click="aiEditAction('expand')" :disabled="isGenerating" :title="i18n.aiExpand || '扩写内容'">
            <svg width="14" height="14"><use xlink:href="#iconAdd"></use></svg>
            {{ i18n.expand || '扩写' }}
          </button>
          <button class="btn-ai-action" @click="aiEditAction('condense')" :disabled="isGenerating" :title="i18n.aiCondense || '精简内容'">
            <svg width="14" height="14"><use xlink:href="#iconMin"></use></svg>
            {{ i18n.condense || '精简' }}
          </button>
          <button class="btn-ai-action" @click="aiEditAction('fix')" :disabled="isGenerating" :title="i18n.aiFix || '修正错误'">
            <svg width="14" height="14"><use xlink:href="#iconCheck"></use></svg>
            {{ i18n.fix || '纠错' }}
          </button>
          <button class="btn-ai-action" @click="aiEditAction('translate')" :disabled="isGenerating" :title="i18n.aiTranslate || '翻译文档'">
            <svg width="14" height="14"><use xlink:href="#iconLanguage"></use></svg>
            {{ i18n.translate || '翻译' }}
          </button>
          <button class="btn-ai-action" @click="aiEditAction('rewrite')" :disabled="isGenerating" :title="i18n.aiRewrite || '改写文档'">
            <svg width="14" height="14"><use xlink:href="#iconRefresh"></use></svg>
            {{ i18n.rewrite || '改写' }}
          </button>
          <button class="btn-ai-action" @click="aiEditAction('summary')" :disabled="isGenerating" :title="i18n.aiSummary || 'AI总结文档'">
            <svg width="14" height="14" viewBox="0 0 24 24">
              <path fill="currentColor" d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20M13,12.5L11.5,14L10,12.5V16H8V12.5L10,14L11.5,12.5L13,14V16H15V12.5L13,12.5Z" />
            </svg>
            {{ i18n.summary || '总结' }}
          </button>
          <button class="btn-ai-action btn-analyze" @click="analyzeDocument" :disabled="isGenerating || isAnalyzing" :title="i18n.aiAnalyze || 'AI分析建议'">
            <div v-if="isAnalyzing" class="loading-spinner-tiny"></div>
            <svg v-else width="14" height="14"><use xlink:href="#iconInfo"></use></svg>
            {{ i18n.analyze || '智能分析' }}
          </button>
        </div>
      </div>

      <!-- AI分析建议面板 -->
      <div v-if="editMode && aiSuggestions" class="ai-suggestions-panel">
        <div class="suggestions-header">
          <svg width="16" height="16"><use xlink:href="#iconLightbulb"></use></svg>
          <span>{{ i18n.aiSuggestions || 'AI优化建议' }}</span>
          <button class="btn-close-suggestions" @click="aiSuggestions = null">
            <svg width="12" height="12"><use xlink:href="#iconClose"></use></svg>
          </button>
        </div>
        <div class="suggestions-content">
          <p class="suggestion-text">{{ aiSuggestions }}</p>
          <button class="btn-apply-suggestions" @click="applySuggestions" :disabled="isGenerating">
            {{ i18n.applySuggestions || '应用建议优化' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 输出区域 -->
    <div class="output-section">
      <!-- 加载状态（仅在没有内容时显示） -->
      <div v-if="isGenerating && !displayedContent && !generatedContent" class="loading-state">
        <div class="loading-spinner-large"></div>
        <p>{{ i18n.aiThinking || 'AI正在思考...' }}</p>
      </div>

      <!-- 错误提示 -->
      <div v-else-if="errorMessage && !displayedContent && !generatedContent" class="error-state">
        <svg width="48" height="48" class="error-icon">
          <use xlink:href="#iconCloseRound"></use>
        </svg>
        <p>{{ errorMessage }}</p>
        <button class="btn-retry" @click="handleGenerate">
          {{ i18n.retry || '重试' }}
        </button>
      </div>

      <!-- 生成结果（流式输出时也显示） -->
      <div v-else-if="displayedContent || generatedContent" class="result-container">
        <div class="result-header">
          <span class="result-title">
            📝 {{ editMode ? (i18n.editContent || '编辑内容') : (i18n.generatedContent || '生成内容') }}
            <span v-if="isGenerating" class="generating-indicator">
              <span class="dot-flashing"></span>
              {{ i18n.generating || '生成中' }}
            </span>
          </span>
          <div class="result-actions">
            <!-- Edit模式专用按钮 -->
            <template v-if="editMode">
              <!-- 停止生成按钮（编辑模式） -->
              <button
                v-if="isGenerating"
                class="btn-action btn-stop"
                @click="handleStop"
                :title="i18n.stopGeneration || '停止生成'"
              >
                <svg width="16" height="16">
                  <use xlink:href="#iconClose"></use>
                </svg>
                {{ i18n.stop || '停止' }}
              </button>
              <button
                class="btn-action btn-apply"
                @click="applyEdit"
                :disabled="!editTargetDoc || isApplying || isGenerating"
                :title="i18n.applyEdit || '应用编辑'"
              >
                <div v-if="isApplying" class="loading-spinner-small"></div>
                <svg v-else width="16" height="16">
                  <use xlink:href="#iconCheck"></use>
                </svg>
                {{ i18n.applyEdit || '应用' }}
              </button>
              <button
                class="btn-action btn-insert-subdoc"
                @click="insertSubDocument"
                :disabled="!editTargetDoc || isInsertingSubDoc || isGenerating"
                :title="i18n.insertSubDocument || '插入子文档'"
              >
                <div v-if="isInsertingSubDoc" class="loading-spinner-small"></div>
                <svg v-else width="16" height="16" viewBox="0 0 24 24">
                  <path fill="currentColor" d="M20,18H4V6H20M20,4H4C2.89,4 2,4.89 2,6V18A2,2 0 0,0 4,20H20A2,2 0 0,0 22,18V6C22,4.89 21.1,4 20,4M13,12H16V15H18V12H21V10H18V7H16V10H13V12Z" />
                </svg>
                {{ i18n.insertSubDoc || '子文档' }}
              </button>
              <button
                v-if="lastEditHistory && editMode"
                class="btn-action btn-undo"
                @click="undoEdit"
                :disabled="isUndoing"
                :title="i18n.undoEdit || '撤回编辑'"
              >
                <div v-if="isUndoing" class="loading-spinner-small"></div>
                <svg v-else width="16" height="16">
                  <use xlink:href="#iconUndo"></use>
                </svg>
                {{ i18n.undo || '撤回' }}
              </button>
            </template>
            <!-- 普通模式：撤回插入按钮 -->
            <button
              v-if="!editMode && lastEditHistory"
              class="btn-action btn-undo"
              @click="undoEdit"
              :disabled="isUndoing"
              :title="i18n.undoInsert || '撤回插入'"
            >
              <div v-if="isUndoing" class="loading-spinner-small"></div>
              <svg v-else width="16" height="16">
                <use xlink:href="#iconUndo"></use>
              </svg>
              {{ i18n.undo || '撤回' }}
            </button>
            <!-- 通用按钮 -->
            <!-- 普通模式：保存到AI问答封存按钮（移动端隐藏） -->
            <button
              v-if="!editMode && !isMobile"
              class="btn-action btn-save"
              @click="saveToArchiveNotebook"
              :disabled="isGenerating"
              :title="i18n.saveToArchive || '保存到AI问答封存'"
            >
              <svg width="16" height="16">
                <use xlink:href="#iconSave"></use>
              </svg>
              {{ i18n.saveToArchive || '保存' }}
            </button>
            <!-- 普通模式：插入到当前文档按钮 -->
            <button
              v-if="!editMode"
              class="btn-action btn-insert"
              @click="insertToCurrentDocument"
              :disabled="isInserting"
              :title="i18n.insertToDocument || '插入到当前文档'"
            >
              <div v-if="isInserting" class="loading-spinner-small"></div>
              <svg v-else width="16" height="16">
                <use xlink:href="#iconDownload"></use>
              </svg>
              {{ i18n.insertToDoc || '插入' }}
            </button>
            <button class="btn-action" @click="copyContent" :title="i18n.copyMarkdown || '复制Markdown'">
              <svg width="16" height="16">
                <use xlink:href="#iconCopy"></use>
              </svg>
              {{ i18n.copy || '复制' }}
            </button>
            <button class="btn-action btn-clear" @click="clearContent">
              <svg width="16" height="16">
                <use xlink:href="#iconTrashcan"></use>
              </svg>
              {{ i18n.clear || '清除' }}
            </button>
          </div>
        </div>
        <div class="result-content">
          <!-- 统一预览界面 -->
          <div class="markdown-preview selectable-content" v-html="renderedDisplayedMarkdown"></div>
        </div>
      </div>

      <!-- 空状态 -->
      <div v-else class="empty-state">
        <svg width="64" height="64" class="empty-icon">
          <use xlink:href="#iconFile"></use>
        </svg>
        <p>{{ i18n.emptyHint || '输入问题后点击生成，AI将为您创建Markdown格式的内容' }}</p>
        <div class="quick-templates">
          <p class="templates-title">{{ i18n.quickTemplates || '快速模板' }}:</p>
          <div class="template-buttons">
            <button class="btn-template" @click="useTemplate('article')">
              📄 {{ i18n.article || '文章大纲' }}
            </button>
            <button class="btn-template" @click="useTemplate('summary')">
              📋 {{ i18n.summary || '内容总结' }}
            </button>
            <button class="btn-template" @click="useTemplate('todo')">
              ✅ {{ i18n.todoList || '待办清单' }}
            </button>
            <button class="btn-template" @click="useTemplate('ideas')">
              💡 {{ i18n.brainstorm || '头脑风暴' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 自定义输入对话框 -->
    <div v-if="showDialog" class="input-dialog-overlay" @click.self="cancelInputDialog">
      <div class="input-dialog">
        <div class="input-dialog-header">
          <h3>{{ inputDialogTitle }}</h3>
          <button class="btn-close-dialog" @click="cancelInputDialog">
            <svg width="16" height="16">
              <use xlink:href="#iconClose"></use>
            </svg>
          </button>
        </div>
        <div class="input-dialog-content">
          <input
            ref="dialogInput"
            v-model="inputDialogValue"
            type="text"
            class="input-dialog-input"
            :placeholder="inputDialogPlaceholder"
            @keydown.enter="confirmInputDialog"
            @keydown.esc="cancelInputDialog"
          />
        </div>
        <div class="input-dialog-footer">
          <button class="btn-cancel" @click="cancelInputDialog">
            {{ i18n.cancel || '取消' }}
          </button>
          <button class="btn-confirm" @click="confirmInputDialog" :disabled="!inputDialogValue.trim()">
            {{ i18n.confirm || '确定' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { showMessage } from 'siyuan';
import { marked } from 'marked';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';
import * as api from '@/api';
import { AIGeneratorStorage, type AIPromptConfig } from './storage';

// Props
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
  onChunk?: (chunk: string) => void; // 流式输出回调（修复问题2）
}

const props = withDefaults(defineProps<Props>(), {
  plugin: null
});

// 存储实例
let storage: AIGeneratorStorage | null = null;

// 状态
const userInput = ref('');
const generatedContent = ref('');
const isGenerating = ref(false);
const errorMessage = ref('');
const showSettings = ref(false);
const abortController = ref<AbortController | null>(null);

// 移动端检测
const isMobile = ref(false);

// 移动端：输入区域显示状态
const showInputSection = ref(true);

// Edit模式状态
const editMode = ref(false);
const editTargetDoc = ref<{ id: string; title: string; content: string } | null>(null);
const originalContent = ref(''); // 文档原始内容
const isApplying = ref(false);
const isUndoing = ref(false);
const isInsertingSubDoc = ref(false); // 插入子文档状态

// 自定义输入对话框状态
const showDialog = ref(false);
const inputDialogTitle = ref('');
const inputDialogPlaceholder = ref('');
const inputDialogValue = ref('');
let inputDialogResolve: ((value: string | null) => void) | null = null;

// AI智能编辑状态
const isAnalyzing = ref(false);
const aiSuggestions = ref<string | null>(null);
const editCustomInput = ref(''); // 编辑模式自定义提问输入

// 编辑历史（用于撤回/重做）
interface EditHistory {
  docId: string;
  docTitle: string;
  originalContent: string;
  timestamp: number;
}
const lastEditHistory = ref<EditHistory | null>(null);

// 普通模式：插入到当前文档状态
const isInserting = ref(false);

// 对话设置
const systemPrompt = ref('你是一个专业的内容创作助手，擅长生成结构清晰、格式规范的Markdown文档。请确保输出内容使用标准的Markdown语法。');
const temperature = ref(0.7);
const maxTokens = ref(10000); // 问题1：默认改为1万
const enableTypewriter = ref(true);

// 需求5：新增上下文消息数量配置
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

// 需求3：持久化当前提示词选择
const CURRENT_PROMPT_STORAGE_KEY = 'ai-content-generator-current-prompt';

// 引用当前文档
const referencedDocTitle = ref('');
const referencedDocContent = ref('');



/**
 * 确认输入对话框
 */
const confirmInputDialog = () => {
  if (inputDialogResolve) {
    const value = inputDialogValue.value.trim();
    inputDialogResolve(value ? value : null);
  }
  showDialog.value = false;
  inputDialogValue.value = '';
  inputDialogResolve = null;
};

/**
 * 取消输入对话框
 */
const cancelInputDialog = () => {
  if (inputDialogResolve) {
    inputDialogResolve(null);
  }
  showDialog.value = false;
  inputDialogValue.value = '';
  inputDialogResolve = null;
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



// 渲染Markdown (使用marked库进行标准渲染，支持代码高亮)
const renderedDisplayedMarkdown = computed(() => {
  if (!displayedContent.value) return '';
  try {
    // 配置marked选项
    marked.setOptions({
      breaks: true,  // 支持GFM换行
      gfm: true,     // 启用GitHub风格的Markdown
    });

    let content = displayedContent.value;

    // 移除标题中的粗体标记
    content = content.replace(/^(#{1,6})\s+\*\*(.+?)\*\*\s*$/gm, '$1 $2');

    return marked.parse(content) as string;
  } catch (error) {
    console.error('Markdown渲染失败:', error);
    return `<pre>${displayedContent.value}</pre>`;
  }
});



// 监听渲染内容变化，应用代码高亮（修复问题3）
watch(renderedDisplayedMarkdown, async () => {
  await nextTick();
  // 手动对所有代码块应用高亮
  const preBlocks = document.querySelectorAll('.markdown-preview pre code');
  preBlocks.forEach((block) => {
    if (!(block as HTMLElement).dataset.highlighted) {
      hljs.highlightElement(block as HTMLElement);
    }
  });
});

// 切换设置面板
const toggleSettings = () => {
  showSettings.value = !showSettings.value;
};

// 切换Edit模式
const toggleEditMode = () => {
  editMode.value = !editMode.value;
  if (!editMode.value) {
    // 退出Edit模式时清理状态
    clearEditState();
  }
  showMessage(
    editMode.value
      ? (props.i18n.editModeEnabled || '✓ 已启用编辑模式')
      : (props.i18n.editModeDisabled || '✓ 已关闭编辑模式'),
    1500,
    'info'
  );
};

// 清理Edit模式状态
const clearEditState = () => {
  editTargetDoc.value = null;
  originalContent.value = '';
  editCustomInput.value = ''; // 清理自定义提问输入
};


// 停止生成
const handleStop = () => {
  if (abortController.value) {
    abortController.value.abort();
    abortController.value = null;
    isGenerating.value = false;
    showMessage('✓ 已停止生成', 2000, 'info');
  }
};

// 生成内容
const handleGenerate = async () => {
  // 如果既没有输入也没有引用文档，提示用户
  if (!userInput.value.trim() && !referencedDocContent.value) {
    showMessage(props.i18n.enterInput || '请输入内容或引用文档', 2000, 'info');
    return;
  }

  // 移动端：隐藏输入区域
  if (isMobile.value) {
    showInputSection.value = false;
  }

  // 创建新的 AbortController
  abortController.value = new AbortController();

  isGenerating.value = true;
  errorMessage.value = '';
  generatedContent.value = '';
  displayedContent.value = '';

  try {
    // 根据用户是否选择提示词来决定是否使用系统提示词
    let finalSystemPrompt = '';
    if (currentPromptName.value) {
      // 用户选择了提示词，使用选中的提示词配置
      finalSystemPrompt = systemPrompt.value;
      console.log('使用选中的提示词:', currentPromptName.value, '内容:', finalSystemPrompt.substring(0, 100) + '...');
      // 追加Markdown格式要求
      finalSystemPrompt += '\n\n**重要**: 请严格使用Markdown格式输出，包括标题(#)、列表(- 或 1.)、代码块(```)、粗体(**) 等标准语法。';
    } else {
      // 用户未选择提示词，使用基础问答模式（仅保持Markdown格式要求）
      finalSystemPrompt = '请使用Markdown格式输出回答。';
      console.log('未选择提示词，使用基础问答模式');
    }

    // 添加当前文档上下文（如果有）
    let contextInfo = '';
    if (referencedDocContent.value) {
      // 移除文档内容中的 frontmatter
      const cleanDocContent = removeFrontmatter(referencedDocContent.value);

      contextInfo = `【参考文档】
标题：${referencedDocTitle.value}
内容：
${cleanDocContent}`;
      console.log('已添加文档上下文，标题:', referencedDocTitle.value, '内容长度:', cleanDocContent.length);
    }

    // 如果只引用了文档没有输入问题，使用默认的总结提示
    let finalUserInput = userInput.value;
    if (!userInput.value.trim() && referencedDocContent.value) {
      // 当没有用户输入时，将系统提示词的要求融入到用户消息中
      // 这样可以确保 AI 遵循系统提示词中的格式要求
      finalUserInput = '请严格按照系统提示词中定义的文档结构和格式要求，对上述文档内容进行专业的技术文档撰写。如果文档内容不完整或只有标题，请基于标题主题，撰写一份完整、专业的技术说明文档。';
      console.log('使用增强的默认提示（融合系统提示词要求）');
    } else {
      console.log('用户输入:', finalUserInput.substring(0, 100));
    }

    const options: GenerateOptions = {
      userInput: finalUserInput,
      systemPrompt: finalSystemPrompt,
      temperature: temperature.value,
      maxTokens: maxTokens.value,
      context: contextInfo || undefined,
      signal: abortController.value?.signal,
      // 默认启用打字机效果，传入流式回调
      onChunk: (chunk: string) => {
        console.log('收到流式数据块:', chunk);
        displayedContent.value += chunk;
        generatedContent.value += chunk;
      }
    };

    const result = await props.onGenerate(options);

    if (result) {
      // 如果流式输出没有更新内容（某些API可能不支持流式），使用返回的完整结果
      if (!generatedContent.value && result) {
        generatedContent.value = result;
        displayedContent.value = result;
      }
      showMessage('✓ 生成成功', 2000, 'info');

      // 自动保存到AI问答封存笔记本（移动端不自动保存）
      if (!editMode.value && !isMobile.value) {
        await saveToArchiveNotebook();
      }
    } else {
      errorMessage.value = props.i18n.generateFailed || '生成失败，请重试';
    }
  } catch (error) {
    // 如果是用户主动取消，不显示错误
    if ((error as Error).name === 'AbortError') {
      console.log('用户取消了生成');
      return;
    }
    console.error('生成内容失败:', error);
    errorMessage.value = (error as Error).message || '生成失败';
    showMessage('生成失败: ' + errorMessage.value, 3000, 'error');
  } finally {
    isGenerating.value = false;
    abortController.value = null;
  }
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

/**
 * 保存生成内容到"AI问答封存"笔记本
 */
const saveToArchiveNotebook = async () => {
  if (!generatedContent.value) {
    showMessage('没有可保存的内容', 2000, 'info');
    return;
  }

  try {
    showMessage('正在保存...', 1000, 'info');

    // 1. 获取或创建"AI问答封存"笔记本
    const archiveNotebookId = await getOrCreateArchiveNotebook();
    if (!archiveNotebookId) {
      showMessage('无法创建AI问答封存笔记本', 3000, 'error');
      return;
    }

    // 2. 根据内容自动分类
    const category = await autoClassifyContent(generatedContent.value);

    // 3. 获取或创建分类文档
    const categoryDocId = await getOrCreateCategoryDoc(archiveNotebookId, category);
    if (!categoryDocId) {
      showMessage('无法创建分类文档', 3000, 'error');
      return;
    }

    // 4. 生成文档标题
    const docTitle = await generateDocTitle(generatedContent.value);

    // 5. 创建时间戳
    const timestamp = new Date().toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).replace(/\//g, '-').replace(/,/g, '');

    const fullTitle = `${docTitle}-${timestamp}`;

    // 6. 在分类文档下创建子文档
    const docPath = `/${category}/${fullTitle}`;
    const newDocId = await api.createDocWithMd(
      archiveNotebookId,
      docPath,
      generatedContent.value
    );

    if (newDocId) {
      showMessage(`✓ 已保存: AI问答封存/${category}/${fullTitle}`, 3000, 'info');
    } else {
      showMessage('保存失败', 3000, 'error');
    }
  } catch (error) {
    console.error('保存到封存笔记本失败:', error);
    showMessage('保存失败: ' + (error as Error).message, 3000, 'error');
  }
};

/**
 * 获取或创建"AI问答封存"笔记本
 */
const getOrCreateArchiveNotebook = async (): Promise<string | null> => {
  try {
    // 获取所有笔记本
    const notebooks = await api.lsNotebooks();

    // 查找"AI问答封存"笔记本
    const archiveNotebook = notebooks.notebooks.find(
      (nb: any) => nb.name === 'AI问答封存'
    );

    if (archiveNotebook) {
      return archiveNotebook.id;
    }

    // 不存在则创建
    const newNotebook = await api.createNotebook('AI问答封存');
    return newNotebook?.id || null;
  } catch (error) {
    console.error('获取或创建笔记本失败:', error);
    return null;
  }
};

/**
 * 自动分类内容
 */
const autoClassifyContent = async (content: string): Promise<string> => {
  try {
    // 简单的关键词匹配分类
    const firstPart = content.substring(0, 500);

    // 技术文档关键词
    if (/代码|函数|API|接口|算法|数据结构|编程|开发|技术|bug|debug/i.test(firstPart)) {
      return '技术文档';
    }

    // 学习笔记关键词
    if (/学习|笔记|总结|复习|知识点|要点|理解|掌握/i.test(firstPart)) {
      return '学习笔记';
    }

    // 创意想法关键词
    if (/创意|想法|灵感|构思|设计|方案|计划|头脑风暴/i.test(firstPart)) {
      return '创意想法';
    }

    // 问答记录关键词
    if (/问题|回答|解答|疑问|为什么|怎么|如何|什么是/i.test(firstPart)) {
      return '问答记录';
    }

    // 总结归纳关键词
    if (/总结|归纳|概括|梳理|整理|汇总|提炼/i.test(firstPart)) {
      return '总结归纳';
    }

    return '其他';
  } catch (error) {
    console.error('自动分类失败:', error);
    return '其他';
  }
};

/**
 * 获取或创建分类文档
 */
const getOrCreateCategoryDoc = async (
  notebookId: string,
  category: string
): Promise<string | null> => {
  try {
    // 查询是否已存在该分类文档
    const sqlQuery = `SELECT id FROM blocks WHERE box = '${notebookId}' AND type = 'd' AND content = '${category}' LIMIT 1`;
    const result = await api.sql(sqlQuery);

    if (result && result.length > 0) {
      return result[0].id;
    }

    // 不存在则创建
    const docPath = `/${category}`;
    const newDocId = await api.createDocWithMd(
      notebookId,
      docPath,
      `# ${category}\n\n本文档用于存放${category}相关的AI生成内容。`
    );

    return newDocId;
  } catch (error) {
    console.error('获取或创建分类文档失败:', error);
    return null;
  }
};

/**
 * 生成文档标题
 */
const generateDocTitle = async (content: string): Promise<string> => {
  try {
    // 从内容中提取第一个标题
    const titleMatch = content.match(/^#\s+(.+)$/m);
    if (titleMatch && titleMatch[1]) {
      const title = titleMatch[1].trim().substring(0, 20);
      return title.replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, '');
    }

    // 如果没有标题，使用前20个字符
    const firstLine = content.split('\n')[0].trim();
    if (firstLine) {
      return firstLine.substring(0, 20).replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s]/g, '') || 'AI生成内容';
    }

    return 'AI生成内容';
  } catch (error) {
    console.error('生成标题失败:', error);
    return 'AI生成内容';
  }
};

// 复制内容（需求2：修复Markdown格式复制）
const copyContent = async () => {
  if (!generatedContent.value) return;

  try {
    // 转换为思源兼容的 Markdown 格式
    const siyuanContent = convertToSiyuanMarkdown(generatedContent.value);
    await navigator.clipboard.writeText(siyuanContent);
    showMessage('✓ 已复制Markdown到剪贴板', 2000, 'info');
  } catch (error) {
    console.error('复制失败:', error);
    showMessage('复制失败', 2000, 'error');
  }
};

/**
 * 插入到当前文档（普通模式）
 */
const insertToCurrentDocument = async () => {
  if (!generatedContent.value) {
    showMessage('没有可插入的内容', 2000, 'info');
    return;
  }

  // 确认对话框
  const confirmMessage = props.i18n.confirmInsertToDocument ||
    '确定要将生成的内容插入到当前文档吗？这将覆盖文档的现有内容。';

  if (!confirm(confirmMessage)) {
    return;
  }

  isInserting.value = true;
  try {
    // 1. 获取当前光标所在的块ID
    const currentBlockId = getCurrentBlockId();
    if (!currentBlockId) {
      // 备用方案：使用激活窗口的文档
      const protyle = document.querySelector('.layout__wnd--active .protyle:not(.fn__none)');
      const docId = protyle?.querySelector('.protyle-background')?.getAttribute('data-node-id');

      if (!docId) {
        showMessage('无法获取当前文档，请将光标放在文档中', 3000, 'error');
        return;
      }

      await insertContentToDocument(docId);
      return;
    }

    // 2. 通过块ID获取文档ID
    const docId = await getDocIdByBlockId(currentBlockId);
    if (!docId) {
      showMessage('无法获取当前文档信息', 3000, 'error');
      return;
    }

    await insertContentToDocument(docId);
  } catch (error) {
    console.error('插入文档失败:', error);
    showMessage('插入文档失败: ' + (error as Error).message, 3000, 'error');
  } finally {
    isInserting.value = false;
  }
};

/**
 * 将内容插入到指定文档
 */
const insertContentToDocument = async (docId: string) => {
  try {
    // 获取文档信息（用于显示和历史记录）
    const docBlock = await api.getBlockByID(docId);
    if (!docBlock) {
      showMessage('无法获取文档信息', 3000, 'error');
      return;
    }

    // 获取原始内容（用于撤回）
    const docContent = await api.exportMdContent(docId);
    const originalContent = docContent?.content || '';

    // 保存到编辑历史（用于撤回）
    lastEditHistory.value = {
      docId: docId,
      docTitle: docBlock.content || '未命名文档',
      originalContent: removeFrontmatter(originalContent),
      timestamp: Date.now()
    };

    // 转换为思源兼容的 Markdown 格式
    const siyuanContent = convertToSiyuanMarkdown(generatedContent.value);

    // 使用updateBlock API更新文档内容
    await api.updateBlock('markdown', siyuanContent, docId);

    showMessage(`✓ 已插入到文档: ${docBlock.content || '未命名文档'}`, 2000, 'info');
  } catch (error) {
    console.error('插入内容失败:', error);
    throw error;
  }
};

// 需求1：取消文档引用
const cancelDocReference = () => {
  referencedDocTitle.value = '';
  referencedDocContent.value = '';
  showMessage('✓ 已取消文档引用', 1500, 'info');
};

// 清除内容
const clearContent = () => {
  generatedContent.value = '';
  displayedContent.value = '';
  errorMessage.value = '';

  // 移动端：清除后显示输入区域
  if (isMobile.value) {
    showInputSection.value = true;
  }
};

// 选择目标文档
const selectTargetDocument = async () => {
  try {
    // 获取当前光标所在的块ID
    const currentBlockId = getCurrentBlockId();
    if (!currentBlockId) {
      // 备用方案：使用激活窗口的文档
      const protyle = document.querySelector('.layout__wnd--active .protyle:not(.fn__none)');
      const docId = protyle?.querySelector('.protyle-background')?.getAttribute('data-node-id');

      if (!docId) {
        showMessage('无法获取当前文档，请将光标放在文档中', 3000, 'error');
        return;
      }

      await loadTargetDocument(docId);
      return;
    }

    // 通过块ID获取文档ID
    const docId = await getDocIdByBlockId(currentBlockId);
    if (!docId) {
      showMessage('无法获取当前文档信息', 3000, 'error');
      return;
    }

    await loadTargetDocument(docId);
  } catch (error) {
    console.error('选择文档失败:', error);
    showMessage('选择文档失败: ' + (error as Error).message, 3000, 'error');
  }
};

// 加载目标文档
const loadTargetDocument = async (docId: string) => {
  try {
    // 获取文档块信息
    const docBlock = await api.getBlockByID(docId);
    if (!docBlock) {
      showMessage('无法获取文档信息', 3000, 'error');
      return;
    }

    // 获取文档的Markdown内容
    const docContent = await api.exportMdContent(docId);
    if (!docContent || !docContent.content) {
      showMessage('无法获取文档内容', 3000, 'error');
      return;
    }

    // 移除frontmatter，获取纯净的Markdown内容
    const cleanContent = removeFrontmatter(docContent.content);

    // 保存文档信息（使用清理后的内容）
    editTargetDoc.value = {
      id: docId,
      title: docBlock.content || '未命名文档',
      content: cleanContent
    };

    // 保存原始内容用于对比（使用清理后的内容）
    originalContent.value = cleanContent;

    // 将文档内容加载到生成内容区域（使用清理后的内容）
    generatedContent.value = cleanContent;
    displayedContent.value = cleanContent;

    showMessage(`✓ 已选择文档: ${editTargetDoc.value.title}`, 2000, 'info');
  } catch (error) {
    console.error('加载文档失败:', error);
    showMessage('加载文档失败: ' + (error as Error).message, 3000, 'error');
  }
};

// 清除目标文档
const clearTargetDocument = () => {
  clearEditState();
  clearContent();
  showMessage('✓ 已清除目标文档', 1500, 'info');
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

    // 转换为思源兼容的 Markdown 格式
    const siyuanContent = convertToSiyuanMarkdown(generatedContent.value);

    // 使用updateBlock API更新文档内容
    await api.updateBlock('markdown', siyuanContent, editTargetDoc.value.id);

    showMessage(`✓ 已更新文档: ${editTargetDoc.value.title}`, 2000, 'info');

    // 更新原始内容为当前内容
    originalContent.value = generatedContent.value;
    editTargetDoc.value.content = generatedContent.value;
  } catch (error) {
    console.error('应用编辑失败:', error);
    showMessage('应用编辑失败: ' + (error as Error).message, 3000, 'error');
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
    showMessage('撤回编辑失败: ' + (error as Error).message, 3000, 'error');
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

  // 移动端：自动收起设置面板
  if (isMobile.value) {
    showSettings.value = false;
  }

  const actionPrompts = {
    polish: '请对以下文档进行润色优化，保持原有结构，提升语言质量和可读性，使表达更加专业、流畅。保持Markdown格式，直接输出优化后的完整文档内容：',
    expand: '请对以下文档进行扩写，增加更详细的说明、例子和补充信息，使内容更加丰富和全面。保持Markdown格式，直接输出扩写后的完整文档内容：',
    condense: '请对以下文档进行精简，去除冗余内容，保留核心要点，使表达更加简洁有力。保持Markdown格式，直接输出精简后的完整文档内容：',
    fix: '请对以下文档进行错误检查和修正，包括拼写错误、语法错误、逻辑错误等。保持Markdown格式，直接输出修正后的完整文档内容：',
    translate: '请将以下文档翻译成中文（如果原文是中文则翻译成英文）。保持原有的Markdown格式和文档结构，只翻译文本内容。直接输出翻译后的完整文档内容：',
    rewrite: '请用不同的表达方式重写以下文档，保持核心意思不变，但使用全新的语言风格和句式结构。保持Markdown格式，直接输出改写后的完整文档内容：',
    summary: '请为以下文档生成一个简洁的总结，包括主要内容和关键要点。总结应该清晰明了，突出文档的核心信息。保持Markdown格式，直接输出总结内容：'
  };

  // 创建新的 AbortController
  abortController.value = new AbortController();

  isGenerating.value = true;
  generatedContent.value = '';
  displayedContent.value = '';
  errorMessage.value = '';
  aiSuggestions.value = null; // 清除之前的建议

  try {
    const options: GenerateOptions = {
      userInput: `${actionPrompts[action]}\n\n${editTargetDoc.value.content}`,
      systemPrompt: '你是一个专业的文档编辑助手，擅长优化Markdown文档。请直接输出优化后的完整文档，不要添加任何解释性文字。',
      temperature: 0.3, // 降低创造性，提高准确性
      maxTokens: maxTokens.value,
      signal: abortController.value?.signal,
      onChunk: (chunk: string) => {
        displayedContent.value += chunk;
        generatedContent.value += chunk;
      }
    };

    await props.onGenerate(options);

    showMessage('✓ AI编辑完成', 2000, 'info');
  } catch (error) {
    // 如果是用户主动取消，不显示错误
    if ((error as Error).name === 'AbortError') {
      console.log('用户取消了AI编辑');
      return;
    }
    console.error('AI编辑失败:', error);
    errorMessage.value = (error as Error).message || 'AI编辑失败';
    showMessage('AI编辑失败: ' + errorMessage.value, 3000, 'error');
  } finally {
    isGenerating.value = false;
    abortController.value = null;
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

  if (!editCustomInput.value.trim()) {
    showMessage('请输入编辑指令', 2000, 'info');
    return;
  }

  // 移动端：自动收起设置面板
  if (isMobile.value) {
    showSettings.value = false;
  }

  // 创建新的 AbortController
  abortController.value = new AbortController();

  isGenerating.value = true;
  generatedContent.value = '';
  displayedContent.value = '';
  errorMessage.value = '';
  aiSuggestions.value = null;

  try {
    const options: GenerateOptions = {
      userInput: `请根据以下指令对文档进行编辑。保持Markdown格式，直接输出编辑后的完整文档内容：

编辑指令：${editCustomInput.value}

原文档：
${editTargetDoc.value.content}`,
      systemPrompt: '你是一个专业的文档编辑助手，擅长根据用户指令优化Markdown文档。请直接输出编辑后的完整文档，不要添加任何解释性文字。',
      temperature: 0.4,
      maxTokens: maxTokens.value,
      signal: abortController.value?.signal,
      onChunk: (chunk: string) => {
        displayedContent.value += chunk;
        generatedContent.value += chunk;
      }
    };

    await props.onGenerate(options);

    // 执行成功后清空输入框
    editCustomInput.value = '';
    showMessage('✓ 自定义编辑完成', 2000, 'info');
  } catch (error) {
    if ((error as Error).name === 'AbortError') {
      console.log('用户取消了自定义编辑');
      return;
    }
    console.error('自定义编辑失败:', error);
    errorMessage.value = (error as Error).message || '自定义编辑失败';
    showMessage('自定义编辑失败: ' + errorMessage.value, 3000, 'error');
  } finally {
    isGenerating.value = false;
    abortController.value = null;
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

  // 移动端：自动收起设置面板
  if (isMobile.value) {
    showSettings.value = false;
  }

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
      onChunk: (chunk: string) => {
        if (!aiSuggestions.value) {
          aiSuggestions.value = chunk;
        } else {
          aiSuggestions.value += chunk;
        }
      }
    };

    await props.onGenerate(options);
    showMessage('✓ 分析完成', 2000, 'info');
  } catch (error) {
    console.error('文档分析失败:', error);
    showMessage('文档分析失败: ' + (error as Error).message, 3000, 'error');
  } finally {
    isAnalyzing.value = false;
  }
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
    // 转换为思源兼容的 Markdown 格式
    const siyuanContent = convertToSiyuanMarkdown(generatedContent.value);

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

  // 移动端：自动收起设置面板
  if (isMobile.value) {
    showSettings.value = false;
  }

  isGenerating.value = true;
  generatedContent.value = '';
  displayedContent.value = '';
  errorMessage.value = '';

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
      onChunk: (chunk: string) => {
        displayedContent.value += chunk;
        generatedContent.value += chunk;
      }
    };

    await props.onGenerate(options);

    aiSuggestions.value = null; // 应用后清除建议
    showMessage('✓ 已应用优化建议', 2000, 'info');
  } catch (error) {
    console.error('应用建议失败:', error);
    errorMessage.value = (error as Error).message || '应用建议失败';
    showMessage('应用建议失败: ' + errorMessage.value, 3000, 'error');
  } finally {
    isGenerating.value = false;
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
    showMessage(props.i18n.enterPromptName || '请输入配置名称', 2000, 'info');
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
    } else {
      // 降级使用localStorage
      localStorage.setItem('ai-content-generator-prompts', JSON.stringify(savedPrompts.value));
    }
  } catch (error) {
    console.error('保存提示词配置失败:', error);
  }

  newPromptName.value = '';
  currentPromptName.value = promptName;
  showMessage(
    existingIndex >= 0
      ? `✓ 已更新配置: ${promptConfig.name}`
      : `✓ 已保存配置: ${promptConfig.name}`,
    2000,
    'info'
  );
};

// 清除当前提示词选择
const clearCurrentPrompt = async () => {
  currentPromptName.value = '';

  try {
    if (storage) {
      await storage.clearCurrentPrompt();
    } else {
      // 降级使用localStorage
      localStorage.removeItem('ai-content-generator-current-prompt');
    }
    showMessage('✓ 已清除提示词选择', 1500, 'info');
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

/**
 * 插入当前文档引用（修复问题2）
 */
const insertCurrentDocReference = async () => {
  try {
    // 1. 获取当前光标所在的块ID
    const currentBlockId = getCurrentBlockId();
    if (!currentBlockId) {
      // 备用方案：使用激活窗口的文档
      const protyle = document.querySelector('.layout__wnd--active .protyle:not(.fn__none)');
      const docId = protyle?.querySelector('.protyle-background')?.getAttribute('data-node-id');

      if (!docId) {
        showMessage('无法获取当前文档，请将光标放在文档中', 3000, 'error');
        return;
      }

      await loadDocumentContent(docId);
      return;
    }

    // 2. 通过块ID获取文档ID
    const docId = await getDocIdByBlockId(currentBlockId);
    if (!docId) {
      showMessage('无法获取当前文档信息', 3000, 'error');
      return;
    }

    await loadDocumentContent(docId);
  } catch (error) {
    console.error('引用文档失败:', error);
    showMessage('引用文档失败: ' + (error as Error).message, 3000, 'error');
  }
};

/**
 * 加载文档内容
 */
async function loadDocumentContent(docId: string) {
  try {
    // 3. 获取文档块信息
    const docBlock = await api.getBlockByID(docId);
    if (!docBlock) {
      showMessage('无法获取文档信息', 3000, 'error');
      return;
    }

    // 4. 获取文档的Markdown内容
    const docContent = await api.exportMdContent(docId);
    if (!docContent || !docContent.content) {
      showMessage('无法获取文档内容', 3000, 'error');
      return;
    }

    // 5. 保存引用的文档信息
    referencedDocTitle.value = docBlock.content || '未命名文档';
    referencedDocContent.value = docContent.content;

    console.log('文档引用成功:', {
      title: referencedDocTitle.value,
      contentLength: referencedDocContent.value.length,
      contentPreview: referencedDocContent.value.substring(0, 200)
    });

    showMessage(`✓ 已引用文档: ${referencedDocTitle.value}`, 2000, 'info');
  } catch (error) {
    console.error('加载文档内容失败:', error);
    throw error;
  }
}

// 加载提示词配置（需求3：持久化保存）
const loadPrompt = (index: number) => {
  const prompt = savedPrompts.value[index];
  if (!prompt) return;

  systemPrompt.value = prompt.systemPrompt;
  temperature.value = prompt.temperature;
  maxTokens.value = prompt.maxTokens;
  enableTypewriter.value = prompt.enableTypewriter;
  contextMessageLimit.value = prompt.contextMessageLimit || 1;

  // 设置当前选中的提示词名称
  currentPromptName.value = prompt.name;

  // 需求3：保存到localStorage
  localStorage.setItem(CURRENT_PROMPT_STORAGE_KEY, prompt.name);

  showPromptSelector.value = false;
  showMessage(`✓ 已加载配置: ${prompt.name}`, 2000, 'info');
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

  showMessage(`✓ 已加载配置到编辑区: ${prompt.name}，修改后请重新保存`, 3000, 'info');
};

// 删除提示词配置
const deletePrompt = (index: number) => {
  const prompt = savedPrompts.value[index];
  if (!prompt) return;

  if (confirm(`${props.i18n.confirmDelete || '确定删除配置'}: ${prompt.name}?`)) {
    savedPrompts.value.splice(index, 1);
    savePromptsToStorage();
    showMessage(`✓ 已删除配置: ${prompt.name}`, 2000, 'info');
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
    // 降级使用localStorage
    try {
      localStorage.setItem('ai-content-generator-prompts', JSON.stringify(savedPrompts.value));
    } catch (localError) {
      console.error('localStorage保存也失败:', localError);
    }
  }
};

// 从存储加载提示词配置
const loadPromptsFromStorage = async () => {
  if (!storage) {
    // 降级使用localStorage
    try {
      const stored = localStorage.getItem('ai-content-generator-prompts');
      if (stored) {
        savedPrompts.value = JSON.parse(stored);
      }

      const currentPrompt = localStorage.getItem('ai-content-generator-current-prompt');
      if (currentPrompt) {
        const promptIndex = savedPrompts.value.findIndex(p => p.name === currentPrompt);
        if (promptIndex !== -1) {
          loadPrompt(promptIndex);
        }
      }
    } catch (error) {
      console.error('从localStorage加载提示词配置失败:', error);
    }
    return;
  }

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
    // 降级尝试localStorage
    try {
      const stored = localStorage.getItem('ai-content-generator-prompts');
      if (stored) {
        savedPrompts.value = JSON.parse(stored);
      }

      const currentPrompt = localStorage.getItem('ai-content-generator-current-prompt');
      if (currentPrompt) {
        const promptIndex = savedPrompts.value.findIndex(p => p.name === currentPrompt);
        if (promptIndex !== -1) {
          loadPrompt(promptIndex);
        }
      }
    } catch (localError) {
      console.error('从localStorage加载也失败:', localError);
    }
  }
};

// 检测是否为移动端
const checkIsMobile = () => {
  // 检测思源笔记的移动端环境
  const isSiyuanMobile = document.body.classList.contains('body--mobile');
  // 检测屏幕宽度
  const isSmallScreen = window.innerWidth <= 768;
  isMobile.value = isSiyuanMobile || isSmallScreen;

  // 调试日志
  console.log('[AI生成器] 移动端检测:', {
    isSiyuanMobile,
    isSmallScreen,
    screenWidth: window.innerWidth,
    isMobile: isMobile.value,
    bodyClasses: document.body.className
  });
};

// 组件挂载时加载保存的提示词
onMounted(async () => {
  // 检测移动端
  checkIsMobile();
  window.addEventListener('resize', checkIsMobile);

  // 初始化存储实例
  if (props.plugin) {
    storage = new AIGeneratorStorage(props.plugin);
    await storage.init();
    loadPromptsFromStorage();
    loadSettings();
  } else {
    // 降级使用localStorage
    loadPromptsFromStorage();
    loadSettings();
  }
});

// 组件卸载时清理事件监听
onUnmounted(() => {
  window.removeEventListener('resize', checkIsMobile);
});

// 使用模板
const useTemplate = (templateType: string) => {
  const templates: Record<string, string> = {
    article: '请为以下主题生成一个详细的文章大纲，包含引言、主要章节和结论：',
    summary: '请总结以下内容的核心要点，使用简洁的列表形式：',
    todo: '请根据以下项目目标生成一个详细的待办事项清单：',
    ideas: '请针对以下主题进行头脑风暴，生成至少10个创意想法：'
  };

  userInput.value = templates[templateType] || '';
};

// 保存设置到存储
const saveSettings = async () => {
  if (!storage) return;

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
      console.log('AI生成器设置已保存');
    }
  } catch (error) {
    console.error('保存设置失败:', error);
  }
};

// 加载设置
const loadSettings = async () => {

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

// 初始化
loadSettings();
</script>

<style scoped lang="scss">
@use "./index.scss";
</style>
