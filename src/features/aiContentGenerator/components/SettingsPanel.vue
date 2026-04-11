<template>
  <div v-if="showSettings" class="settings-panel">
    <!-- 标题栏 -->
    <header class="panel-header">
      <div class="header-left">
        <svg width="16" height="16"><use xlink:href="#iconSparkles" /></svg>
        <span>提示词配置</span>
        <Button
          :class="['collapse-btn', { collapsed }]"
          @click="$emit('toggle-collapse')"
          :title="collapsed ? '展开' : '折叠'"
          variant="ghost"
          size="small"
        >
          <svg width="14" height="14">
            <use :xlink:href="collapsed ? '#iconRight' : '#iconDown'" />
          </svg>
        </Button>
      </div>
      <Button variant="ghost" size="small" @click="$emit('toggle-settings')">
        <svg width="14" height="14"><use xlink:href="#iconClose" /></svg>
      </Button>
    </header>

    <!-- 内容区 -->
    <div :class="['panel-body', { collapsed }]">
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
          :rows="8"
        />
      </div>

      <!-- 参数网格 -->
      <div class="params-grid">
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
          <Tag v-if="currentPromptName" size="small" variant="info">
            {{ currentPromptName }}
          </Tag>
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
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue";
import Input from "@/components/Input.vue";
import Textarea from "@/components/Textarea.vue";
import Slider from "@/components/Slider.vue";
import Tag from "@/components/Tag.vue";

defineProps<{
	showSettings: boolean;
	collapsed: boolean;
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
	"toggle-collapse": [];
	"save-current-prompt": [];
	"on-prompt-name-focus": [];
}>();
</script>

<style scoped lang="scss">
.settings-panel {
  border-bottom: 1px solid var(--b3-theme-surface-lighter);
  background: var(--b3-theme-surface-lighter);
}

.panel-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 6px 10px;
  font-size: 12px;

  .header-left {
    display: flex;
    align-items: center;
    gap: 6px;
    color: var(--b3-theme-on-surface);

    svg { color: var(--b3-theme-primary); }
  }
}

.collapse-btn.collapsed svg { transform: rotate(-90deg); }

.panel-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 0 10px 10px;

  &.collapsed { display: none; }
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-label {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);

  svg { color: var(--b3-theme-primary); opacity: 0.8; }
}

.params-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
}

.save-section {
  padding-top: 10px;
  border-top: 1px solid var(--b3-theme-surface-lighter);
}

.save-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 6px;
}

.save-input {
  display: flex;
  gap: 6px;
}
</style>
