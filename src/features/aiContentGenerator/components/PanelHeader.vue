<template>
  <div class="panel-header">
    <div class="header-mode-tabs">
      <button
        class="mode-tab"
        :class="{ active: activeMode === 'generator' }"
        @click="$emit('update:activeMode', 'generator')"
      >
        <svg width="14" height="14"><use xlink:href="#iconSparkles" /></svg>
        <span>{{ generatorTitle }}</span>
      </button>
      <button
        class="mode-tab"
        :class="{ active: activeMode === 'automation' }"
        @click="$emit('update:activeMode', 'automation')"
      >
        <svg width="14" height="14"><use xlink:href="#iconRefresh" /></svg>
        <span>{{ automationTitle }}</span>
      </button>
      <button
        class="mode-tab"
        :class="{ active: activeMode === 'chat' }"
        @click="$emit('update:activeMode', 'chat')"
      >
        <svg width="14" height="14"><use xlink:href="#iconHelp" /></svg>
        <span>{{ chatTitle }}</span>
      </button>
    </div>
    <div class="header-actions">
      <!-- 模型选择器（仅在生成器模式显示） -->
      <template v-if="activeMode === 'generator'">
        <!-- 自定义模型输入 -->
        <input
          v-if="selectedModel === 'custom'"
          class="model-custom-input"
          :value="customModel"
          placeholder="输入模型名..."
          @input="$emit('update:custom-model', ($event.target as HTMLInputElement).value)"
        />
        <!-- 模型选择下拉 -->
        <select
          v-else
          class="model-select"
          :value="selectedModel"
          @change="$emit('update:selected-model', ($event.target as HTMLSelectElement).value)"
        >
          <option value="">默认模型</option>
          <optgroup
            v-if="availableModels.common.length > 0"
            label="常用"
          >
            <option
              v-for="m in availableModels.common"
              :key="m.value"
              :value="m.value"
            >
              {{ m.label }}
            </option>
          </optgroup>
          <optgroup
            v-if="availableModels.all.length > 0"
            label="全部"
          >
            <option
              v-for="m in availableModels.all"
              :key="m.value"
              :value="m.value"
            >
              {{ m.label }}
            </option>
          </optgroup>
          <option value="custom">自定义...</option>
        </select>
        <!-- 思考模式开关（仅 DeepSeek 思考模型显示） -->
        <label
          v-if="supportsThinking"
          class="thinking-toggle"
          title="思考模式"
        >
          <input
            type="checkbox"
            :checked="enableThinking"
            @change="$emit('update:enable-thinking', ($event.target as HTMLInputElement).checked)"
          />
          <span class="thinking-label">思考</span>
        </label>
      </template>
      <!-- 设置按钮（仅在生成器模式显示） -->
      <Button
        v-if="activeMode === 'generator'"
        variant="ghost"
        size="small"
        title="对话设置"
        @click="$emit('toggle-settings')"
      >
        <svg width="18" height="16" viewBox="0 0 24 24">
          <use xlink:href="#iconSettings"></use>
        </svg>
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue"

interface ModelOption { value: string; label: string }
interface ProviderModels { common: ModelOption[]; all: ModelOption[] }

interface Props {
  title?: string
  activeMode: "generator" | "automation" | "chat"
  generatorTitle?: string
  automationTitle?: string
  chatTitle?: string
  selectedModel?: string
  customModel?: string
  enableThinking?: boolean
  availableModels?: ProviderModels
  supportsThinking?: boolean
}

withDefaults(defineProps<Props>(), {
  title: "信息生成",
  generatorTitle: "生成器",
  automationTitle: "自动化",
  chatTitle: "技能问答",
  selectedModel: "",
  customModel: "",
  enableThinking: false,
  availableModels: () => ({ common: [], all: [] }),
  supportsThinking: false,
})

defineEmits<{
  (e: "toggle-settings"): void
  (e: "update:activeMode", mode: "generator" | "automation" | "chat"): void
  (e: "update:selected-model", value: string): void
  (e: "update:custom-model", value: string): void
  (e: "update:enable-thinking", value: boolean): void
}>()
</script>

<style scoped lang="scss">
@use "../styles/index.scss";

// ============ 模式切换 Tab ============
.header-mode-tabs {
  display: flex;
  gap: 1px;
  background: var(--b3-theme-surface-lighter);
  border-radius: 5px;
  padding: 2px;
}

.mode-tab {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 500;
  color: var(--b3-theme-on-surface);
  background: transparent;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  white-space: nowrap;
  transition: all 0.15s;

  svg {
    color: var(--b3-theme-on-surface);
    opacity: 0.6;
  }

  &:hover {
    color: var(--b3-theme-on-background);
    svg { opacity: 0.8; }
  }

  &.active {
    color: var(--b3-theme-primary);
    background: var(--b3-theme-background);
    box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);

    svg {
      color: var(--b3-theme-primary);
      opacity: 1;
    }
  }
}

// ============ 模型选择器 ============
.model-select {
  padding: 2px 6px;
  font-size: 10px;
  color: var(--b3-theme-on-background);
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 4px;
  cursor: pointer;
  max-width: 120px;
  outline: none;

  &:hover {
    border-color: var(--b3-theme-primary);
  }

  &:focus {
    border-color: var(--b3-theme-primary);
  }
}

.model-custom-input {
  padding: 2px 6px;
  font-size: 10px;
  color: var(--b3-theme-on-background);
  background: var(--b3-theme-surface);
  border: 1px solid var(--b3-theme-surface-lighter);
  border-radius: 4px;
  max-width: 100px;
  outline: none;

  &:hover,
  &:focus {
    border-color: var(--b3-theme-primary);
  }

  &::placeholder {
    color: var(--b3-theme-on-surface);
    opacity: 0.4;
  }
}

// ============ 思考模式开关 ============
.thinking-toggle {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 5px;
  font-size: 10px;
  color: var(--b3-theme-on-surface);
  border-radius: 4px;
  cursor: pointer;
  user-select: none;
  white-space: nowrap;

  input[type="checkbox"] {
    width: 12px;
    height: 12px;
    cursor: pointer;
    accent-color: var(--b3-theme-primary);
  }

  &:hover {
    background: var(--b3-theme-surface);
  }

  &.active .thinking-label {
    color: var(--b3-theme-primary);
  }
}

.thinking-label {
  color: var(--b3-theme-on-surface);
  opacity: 0.7;
}

.thinking-toggle input:checked + .thinking-label {
  color: var(--b3-theme-primary);
  opacity: 1;
  font-weight: 500;
}
</style>
