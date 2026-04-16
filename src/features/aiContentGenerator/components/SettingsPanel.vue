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

              <div class="form-group">
                <label class="form-label">
                  <svg width="12" height="12"><use xlink:href="#iconList" /></svg>
                  上下文消息
                  <span class="label-value">{{ contextMessageLimit }}</span>
                </label>
                <Slider
                  :model-value="contextMessageLimit"
                  @update:model-value="$emit('update:contextMessageLimit', $event)"
                  :min="1" :max="10" :step="1"
                  size="small"
                />
                <div class="param-hint">1 ~ 10 条</div>
              </div>
            </div>
          </section>

          <!-- 保存配置 -->
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
</style>
