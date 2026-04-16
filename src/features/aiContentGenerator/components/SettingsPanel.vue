<template>
  <Teleport to="body">
    <div v-if="showSettings" class="settings-overlay" @click.self="$emit('toggle-settings')">
      <div class="settings-dialog">
        <!-- 标题栏 -->
        <header class="dialog-header">
          <div class="header-left">
            <svg width="16" height="16"><use xlink:href="#iconSparkles" /></svg>
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
          <div class="form-group">
            <label class="form-label">
              <svg width="14" height="14"><use xlink:href="#iconEdit" /></svg>
              系统提示词
            </label>
            <Textarea
              :model-value="systemPrompt"
              @update:model-value="$emit('update:systemPrompt', $event)"
              placeholder="输入系统提示词，定义AI的角色和行为..."
              :rows="6"
            />
          </div>

          <!-- 参数区域 -->
          <div class="params-section">
            <div class="form-group">
              <label class="form-label">
                <svg width="12" height="12"><use xlink:href="#iconHot" /></svg>
                创造性
              </label>
              <Slider
                :model-value="temperature"
                @update:model-value="$emit('update:temperature', $event)"
                :min="0" :max="2" :step="0.1"
                showValue showMinMax
                :formatValue="v => v.toFixed(1)"
                hint="精确 - 创造"
              />
            </div>

            <div class="form-group">
              <label class="form-label">
                <svg width="12" height="12"><use xlink:href="#iconAlignLeft" /></svg>
                最大长度
              </label>
              <Input
                type="number"
                :model-value="maxTokens"
                @update:model-value="$emit('update:maxTokens', Number($event))"
                :min="100" :max="50000" :step="100"
              />
            </div>

            <div class="form-group">
              <label class="form-label">
                <svg width="12" height="12"><use xlink:href="#iconList" /></svg>
                上下文
              </label>
              <Slider
                :model-value="contextMessageLimit"
                @update:model-value="$emit('update:contextMessageLimit', $event)"
                :min="1" :max="10" :step="1"
                showValue showMinMax
              />
            </div>
          </div>

          <!-- 保存配置 -->
          <div class="save-section">
            <div class="save-header">
              <label class="form-label">
                <svg width="14" height="14"><use xlink:href="#iconSave" /></svg>
                {{ currentPromptName ? '更新配置' : '保存为新配置' }}
              </label>
            </div>
            <div class="save-input">
              <Input
                :model-value="newPromptName"
                @update:model-value="$emit('update:newPromptName', String($event))"
                :placeholder="currentPromptName || '输入配置名称...'"
                @keydown.enter="$emit('save-current-prompt')"
                @focus="$emit('on-prompt-name-focus')"
              />
              <Button
                @click="$emit('save-current-prompt')"
                :disabled="!newPromptName.trim() && !currentPromptName"
                variant="primary"
                size="small"
              >
                <svg width="14" height="14"><use xlink:href="#iconCheck" /></svg>
                {{ currentPromptName ? '更新' : '保存' }}
              </Button>
            </div>
          </div>
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

defineProps<{
	showSettings: boolean;
	systemPrompt: string;
	temperature: number;
	maxTokens: number;
	contextMessageLimit: number;
	currentPromptName: string;
	newPromptName: string;
}>();

defineEmits<{
	"update:systemPrompt": [value: string];
	"update:temperature": [value: number];
	"update:maxTokens": [value: number];
	"update:contextMessageLimit": [value: number];
	"update:newPromptName": [value: string];
	"toggle-settings": [];
	"save-current-prompt": [];
	"on-prompt-name-focus": [];
}>();
</script>

<style scoped lang="scss">
.settings-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
}

.settings-dialog {
  width: 480px;
  max-width: 92vw;
  max-height: 85vh;
  display: flex;
  flex-direction: column;
  background: var(--b3-theme-background);
  border: 1px solid var(--b3-theme-surface-light);
  border-radius: 8px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.18);
  overflow: hidden;
}

.dialog-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--b3-theme-surface-lighter);

  .header-left {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .header-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--b3-theme-on-background);
  }

  svg { color: var(--b3-theme-primary); }
}

.dialog-body {
  display: flex;
  flex-direction: column;
  gap: 16px;
  padding: 16px;
  overflow-y: auto;
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

  svg { color: var(--b3-theme-primary); opacity: 0.8; }
}

.params-section {
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 12px;
  background: var(--b3-theme-surface);
  border-radius: 6px;
  border: 1px solid var(--b3-theme-surface-lighter);
}

.save-section {
  padding-top: 12px;
  border-top: 1px solid var(--b3-theme-surface-lighter);
}

.save-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.save-input {
  display: flex;
  gap: 8px;
}
</style>
