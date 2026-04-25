<template>
  <Teleport to="body">
    <div v-if="showSettings" class="settings-overlay" @click.self="$emit('toggle-settings')">
      <div class="settings-dialog">
        <!-- 标题栏 -->
        <header class="dialog-header">
          <div class="header-left">
            <svg width="15" height="15"><use xlink:href="#iconSparkles" /></svg>
            <span class="header-title">提示词配置</span>
            <Tag v-if="currentPromptName" size="small" variant="info">
              {{ currentPromptName }}
            </Tag>
          </div>
          <Button variant="ghost" size="small" @click="$emit('toggle-settings')">
            <svg width="14" height="14"><use xlink:href="#iconClose" /></svg>
          </Button>
        </header>

        <!-- 内容区 -->
        <div class="dialog-body">
          <!-- 系统提示词 -->
          <section class="form-section">
            <label class="form-label">
              <svg width="13" height="13"><use xlink:href="#iconEdit" /></svg>
              系统提示词
            </label>
            <Textarea
              :model-value="systemPrompt"
              @update:model-value="$emit('update:systemPrompt', $event)"
              placeholder="输入系统提示词，定义AI的角色和行为..."
              :rows="5"
            />
          </section>

          <!-- 参数区域 -->
          <section class="form-section params-section">
            <div class="params-grid">
              <div class="form-group">
                <label class="form-label">
                  <svg width="12" height="12"><use xlink:href="#iconHot" /></svg>
                  创造性
                  <span class="label-value">{{ temperature.toFixed(1) }}</span>
                </label>
                <Slider
                  :model-value="temperature"
                  @update:model-value="$emit('update:temperature', $event)"
                  :min="0" :max="2" :step="0.1"
                  size="small"
                />
                <div class="param-hint">精确 ← → 创造</div>
              </div>

              <div class="form-group">
                <label class="form-label">
                  <svg width="12" height="12"><use xlink:href="#iconAlignLeft" /></svg>
                  最大长度
                  <span class="label-value">{{ maxTokens.toLocaleString() }}</span>
                </label>
                <Input
                  type="number"
                  :model-value="maxTokens"
                  @update:model-value="$emit('update:maxTokens', Number($event))"
                  :min="100" :max="50000" :step="100"
                  size="small"
                />
              </div>
            </div>
          </section>

          <!-- 保存当前配置 -->
          <section class="form-section save-section">
            <label class="form-label">
              <svg width="13" height="13"><use xlink:href="#iconSave" /></svg>
              {{ currentPromptName ? '更新配置' : '保存为新配置' }}
            </label>
            <div class="save-row">
              <Input
                :model-value="newPromptName"
                @update:model-value="$emit('update:newPromptName', String($event))"
                :placeholder="currentPromptName || '输入配置名称...'"
                @keydown.enter="$emit('save-current-prompt')"
                @focus="$emit('on-prompt-name-focus')"
                size="small"
              />
              <Button
                @click="$emit('save-current-prompt')"
                :disabled="!newPromptName.trim() && !currentPromptName"
                variant="primary"
                size="small"
              >
                <svg width="12" height="12"><use xlink:href="#iconCheck" /></svg>
                {{ currentPromptName ? '更新' : '保存' }}
              </Button>
            </div>
          </section>

          <!-- 已保存的提示词管理 -->
          <section v-if="savedPrompts.length > 0" class="form-section prompts-section">
            <label class="form-label">
              <svg width="13" height="13"><use xlink:href="#iconList" /></svg>
              已保存配置
              <span class="label-value">{{ savedPrompts.length }}</span>
            </label>
            <div class="prompts-list">
              <div
                v-for="(prompt, index) in savedPrompts"
                :key="prompt.id || index"
                class="prompt-manage-item"
                :class="{ active: prompt.name === currentPromptName }"
              >
                <div class="prompt-manage-info" @click="$emit('load-prompt', index)">
                  <span class="prompt-manage-name">{{ prompt.name }}</span>
                  <span class="prompt-manage-preview">{{ getPromptPreview(prompt.systemPrompt) }}</span>
                </div>
                <div class="prompt-manage-actions">
                  <Button
                    @click.stop="$emit('load-prompt', index)"
                    variant="ghost"
                    size="small"
                    title="应用"
                  >
                    <svg width="12" height="12"><use xlink:href="#iconCheck" /></svg>
                  </Button>
                  <Button
                    @click.stop="$emit('delete-prompt', index)"
                    variant="ghost"
                    size="small"
                    title="删除"
                  >
                    <svg width="12" height="12"><use xlink:href="#iconTrashcan" /></svg>
                  </Button>
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue";
import Input from "@/components/Input.vue";
import Textarea from "@/components/Textarea.vue";
import Slider from "@/components/Slider.vue";
import Tag from "@/components/Tag.vue";
import type { SavedPrompt } from "@/types/ai";

defineProps<{
	showSettings: boolean;
	systemPrompt: string;
	temperature: number;
	maxTokens: number;
	currentPromptName: string;
	newPromptName: string;
	savedPrompts: SavedPrompt[];
}>();

defineEmits<{
	"update:systemPrompt": [value: string];
	"update:temperature": [value: number];
	"update:maxTokens": [value: number];
	"update:newPromptName": [value: string];
	"toggle-settings": [];
	"save-current-prompt": [];
	"on-prompt-name-focus": [];
	"load-prompt": [index: number];
	"delete-prompt": [index: number];
}>();

const getPromptPreview = (text: string): string => {
	const maxLength = 60;
	if (text.length <= maxLength) return text;
	return text.substring(0, maxLength) + "...";
};
</script>

<style scoped lang="scss">
.settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.4);
}

.settings-dialog {
  width: 460px;
  max-width: 92vw;
  max-height: 88vh;
  display: flex;
  flex-direction: column;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-theme-surface-light);
  border-radius: 10px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.16);
  overflow: hidden;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface);

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-title {
    font-size: 13px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
    letter-spacing: 0.02em;
  }

  svg { color: var(--b3-theme-primary); }
}

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 14px 18px 18px;
  overflow-y: auto;
}

.form-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.form-section + .form-section {
  margin-top: 14px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);

  svg {
    color: var(--b3-theme-primary);
    opacity: 0.75;
    flex-shrink: 0;
  }
}

.label-value {
  margin-left: auto;
  font-size: 11px;
  font-weight: 600;
  color: var(--b3-theme-primary);
  opacity: 0.85;
  font-variant-numeric: tabular-nums;
}

.param-hint {
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  opacity: 0.45;
  text-align: center;
  margin-top: -2px;
}

.params-section {
  padding: 14px;
  background: var(--b3-theme-surface);
  border-radius: 8px;
  border: 1px solid var(--b3-theme-surface-lighter);

  .params-grid {
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
}

.save-section {
  border-top: 1px solid var(--b3-theme-surface-lighter);
  padding-top: 14px;
}

.save-row {
  display: flex;
  gap: 8px;

  :deep(.si-input) {
    flex: 1;
    min-width: 0;
  }
}

// ============ 提示词管理列表 ============
.prompts-section {
  border-top: 1px solid var(--b3-theme-surface-lighter);
  padding-top: 14px;
}

.prompts-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
  padding: 2px;
}

.prompt-manage-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 10px;
  border-radius: 6px;
  border: 1px solid transparent;

  &:hover {
    background: var(--b3-theme-surface-light);
  }

  &.active {
    background: var(--b3-theme-surface);
    border-color: var(--b3-theme-primary);
    opacity: 0.85;
  }
}

.prompt-manage-info {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
  min-width: 0;
  cursor: pointer;
}

.prompt-manage-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--b3-theme-on-background);
}

.prompt-manage-preview {
  font-size: 11px;
  color: var(--b3-theme-on-surface);
  opacity: 0.55;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.prompt-manage-actions {
  display: flex;
  gap: 2px;
  flex-shrink: 0;
  opacity: 0;
}

.prompt-manage-item:hover .prompt-manage-actions {
  opacity: 1;
}
</style>
