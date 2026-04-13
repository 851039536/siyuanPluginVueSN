<template>
  <div class="bottom-input-section">
    <!-- 简化的操作栏 -->
    <div class="action-bar">
      <!-- 左侧：文档选择 + 快捷操作 -->
      <div class="left-actions">
        <!-- 文档选择器 -->
        <div class="doc-selector" :class="{ 'has-doc': editTargetDoc }">
          <Button
            variant="ghost"
            size="small"
            @click="$emit('select-target-doc')"
            :title="editTargetDoc ? editTargetDoc.title : '选择文档'"
          >
            <svg width="14" height="14"><use xlink:href="#iconFile"></use></svg>
            <span class="doc-name">{{ editTargetDoc ? truncateTitle(editTargetDoc.title) : '选择文档' }}</span>
            <Tag v-if="editTargetDoc?.isBlock" size="small" variant="primary">块</Tag>
          </Button>
          <Button
            v-if="editTargetDoc"
            variant="ghost"
            size="small"
            class="clear-btn"
            @click="$emit('clear-target-doc')"
            title="清除"
          >
            <svg width="12" height="12"><use xlink:href="#iconClose"></use></svg>
          </Button>
        </div>

        <!-- 快捷操作下拉菜单（已选择文档时显示） -->
        <div v-if="editTargetDoc" class="quick-actions">
          <div class="dropdown-wrapper">
            <Button
              variant="ghost"
              size="small"
              @click="showQuickMenu = !showQuickMenu"
              :disabled="isGenerating"
            >
              <svg width="14" height="14"><use xlink:href="#iconSparkles"></use></svg>
              <span>AI操作</span>
              <svg width="10" height="10" class="dropdown-arrow" :class="{ 'open': showQuickMenu }">
                <use xlink:href="#iconDown"></use>
              </svg>
            </Button>
            <div v-if="showQuickMenu" class="dropdown-menu">
              <div class="menu-item" @click="handleQuickAction('polish')">
                <svg width="14" height="14"><use xlink:href="#iconEdit"></use></svg>
                <span>润色</span>
              </div>
              <div class="menu-item" @click="handleQuickAction('expand')">
                <svg width="14" height="14"><use xlink:href="#iconAdd"></use></svg>
                <span>扩写</span>
              </div>
              <div class="menu-item" @click="handleQuickAction('condense')">
                <svg width="14" height="14"><use xlink:href="#iconMin"></use></svg>
                <span>精简</span>
              </div>
              <div class="menu-item" @click="handleQuickAction('fix')">
                <svg width="14" height="14"><use xlink:href="#iconCheck"></use></svg>
                <span>纠错</span>
              </div>
              <div class="menu-item" @click="handleQuickAction('translate')">
                <svg width="14" height="14"><use xlink:href="#iconLanguage"></use></svg>
                <span>翻译</span>
              </div>
              <div class="menu-item" @click="handleQuickAction('rewrite')">
                <svg width="14" height="14"><use xlink:href="#iconRefresh"></use></svg>
                <span>改写</span>
              </div>
              <div class="menu-item" @click="handleQuickAction('summary')">
                <svg width="14" height="14"><use xlink:href="#iconList"></use></svg>
                <span>总结</span>
              </div>
              <div class="menu-divider"></div>
              <div class="menu-item" @click="handleQuickAction('plagiarism')">
                <svg width="14" height="14"><use xlink:href="#iconSearch"></use></svg>
                <span>查重</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧：提示词选择 -->
      <div class="right-actions">
        <div class="prompt-selector-wrapper">
          <Button
            variant="ghost"
            size="small"
            @click="$emit('toggle-prompt-selector')"
            :class="{ 'active': currentPromptName }"
          >
            <svg width="14" height="14"><use xlink:href="#iconList"></use></svg>
            <span>{{ currentPromptName || '提示词' }}</span>
            <span v-if="savedPrompts.length > 0 && !currentPromptName" class="badge">{{ savedPrompts.length }}</span>
          </Button>

          <!-- 提示词选择面板 -->
          <div v-if="showPromptSelector" class="prompt-selector-panel">
            <div class="prompt-selector-header">
              <span>选择提示词</span>
              <Button @click="$emit('toggle-prompt-selector')" variant="ghost" size="small">
                <svg width="12" height="12"><use xlink:href="#iconClose"></use></svg>
              </Button>
            </div>
            <div class="prompt-list">
              <div
                v-for="(prompt, index) in paginatedPrompts"
                :key="prompt.id || index"
                class="prompt-item"
                @click="$emit('load-prompt', getOriginalIndex(prompt))"
              >
                <div class="prompt-item-header">
                  <span class="prompt-name">{{ prompt.name }}</span>
                  <div class="prompt-item-actions">
                    <Button
                      @click.stop="$emit('edit-prompt', getOriginalIndex(prompt))"
                      variant="ghost"
                      size="small"
                      title="编辑"
                    >
                      <svg width="12" height="12"><use xlink:href="#iconEdit"></use></svg>
                    </Button>
                    <Button
                      @click.stop="$emit('delete-prompt', getOriginalIndex(prompt))"
                      variant="ghost"
                      size="small"
                      title="删除"
                    >
                      <svg width="12" height="12"><use xlink:href="#iconTrashcan"></use></svg>
                    </Button>
                  </div>
                </div>
                <div class="prompt-item-preview">{{ getPromptPreview(prompt.systemPrompt) }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- 输入区域（已选择文档时显示） -->
    <div v-if="editTargetDoc" class="input-row">
      <Textarea
        :model-value="editCustomInput"
        @update:model-value="$emit('update:editCustomInput', $event)"
        placeholder="输入编辑指令，或选择AI快捷操作..."
        :rows="1"
        :autosize="true"
        :disabled="isGenerating"
        @keydown.ctrl.enter="$emit('custom-edit')"
        class="input-field"
      />
      <!-- 执行/停止按钮 -->
      <Button
        v-if="!isGenerating"
        @click="$emit('custom-edit')"
        :disabled="!canExecute"
        :title="executeButtonTitle"
        variant="primary"
        size="small"
        class="execute-btn"
      >
        <svg width="16" height="16"><use xlink:href="#iconSparkles"></use></svg>
      </Button>
      <Button
        v-else
        @click="$emit('stop')"
        title="停止生成"
        variant="danger"
        size="small"
        class="execute-btn"
      >
        <svg width="16" height="16"><use xlink:href="#iconClose"></use></svg>
      </Button>
    </div>

    <!-- 点击遮罩关闭下拉菜单 -->
    <div v-if="showQuickMenu" class="dropdown-overlay" @click="showQuickMenu = false"></div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import Button from "@/components/Button.vue";
import Textarea from "@/components/Textarea.vue";
import Tag from "@/components/Tag.vue";
import type { TargetDoc, SavedPrompt } from "@/types/ai";

interface Props {
	isGenerating: boolean;
	isCheckingPlagiarism: boolean;
	editTargetDoc: TargetDoc | null;
	showPromptSelector: boolean;
	currentPromptName: string;
	savedPrompts: SavedPrompt[];
	filteredPrompts: SavedPrompt[];
	paginatedPrompts: SavedPrompt[];
	promptSearchQuery: string;
	currentPage: number;
	totalPages: number;
	editCustomInput: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
	(
		e: "ai-edit",
		action:
			| "polish"
			| "expand"
			| "condense"
			| "fix"
			| "translate"
			| "rewrite"
			| "summary",
	): void;
	(e: "check-plagiarism"): void;
	(e: "stop"): void;
	(e: "toggle-prompt-selector"): void;
	(e: "clear-current-prompt"): void;
	(e: "load-prompt", index: number): void;
	(e: "edit-prompt", index: number): void;
	(e: "delete-prompt", index: number): void;
	(e: "select-target-doc"): void;
	(e: "clear-target-doc"): void;
	(e: "custom-edit"): void;
	(e: "update:promptSearchQuery", value: string): void;
	(e: "update:currentPage", value: number): void;
	(e: "update:editCustomInput", value: string): void;
}>();

// 下拉菜单状态
const showQuickMenu = ref(false);

// 计算属性
const canExecute = computed(() => {
	return props.editCustomInput.trim() || props.currentPromptName;
});

const executeButtonTitle = computed(() => {
	return !props.editCustomInput.trim() && props.currentPromptName
		? "使用当前提示词生成"
		: "执行";
});

// 截断标题
const truncateTitle = (title: string, maxLen = 12) => {
	if (title.length <= maxLen) return title;
	return title.substring(0, maxLen) + "...";
};

// 处理快捷操作
const handleQuickAction = (action: string) => {
	showQuickMenu.value = false;
	if (action === "plagiarism") {
		emit("check-plagiarism");
	} else {
		emit("ai-edit", action as any);
	}
};

// 获取原始索引
const getOriginalIndex = (prompt: SavedPrompt) => {
	return props.savedPrompts.findIndex((p) => p.id === prompt.id);
};

// 获取提示词预览
const getPromptPreview = (text: string): string => {
	const maxLength = 50;
	if (text.length <= maxLength) return text;
	return text.substring(0, maxLength) + "...";
};
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
