<template>
  <div class="settings-panel" v-if="showSettings">
    <div class="panel-section">
      <div class="section-header">
        <div class="section-title-wrapper">
          <svg width="16" height="16" class="section-icon">
            <use xlink:href="#iconSparkles"></use>
          </svg>
          <span>{{ '提示词配置' }}</span>
          <Button
            :class="['btn-collapse', { 'collapsed': collapsed }]"
            @click="$emit('toggle-collapse')"
            :title="collapsed ? '展开设置' : '折叠设置'"
            variant="ghost"
            size="small"
          >
            <svg width="14" height="14" class="collapse-icon">
              <use :xlink:href="collapsed ? '#iconRight' : '#iconDown'"></use>
            </svg>
          </Button>
        </div>
        <Button variant="ghost" size="small" @click="$emit('toggle-settings')">
          <svg width="14" height="14">
            <use xlink:href="#iconClose"></use>
          </svg>
        </Button>
      </div>
      <div class="section-content" :class="{ 'collapsed': collapsed }">
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
            <Textarea
              :model-value="systemPrompt"
              @update:model-value="$emit('update:systemPrompt', $event)"
              :placeholder="'输入系统提示词，定义AI的角色和行为...'"
              :rows="10"
            />
          </div>

          <!-- 参数配置 -->
          <div class="params-grid">
            <div class="setting-item">
              <label class="setting-label">
                <svg width="12" height="12" class="label-icon">
                  <use xlink:href="#iconHot"></use>
                </svg>
                {{ '创造性' }}
              </label>
              <Slider
                :model-value="temperature"
                @update:model-value="$emit('update:temperature', $event)"
                :min="0"
                :max="2"
                :step="0.1"
                :showValue="true"
                :showMinMax="true"
                :formatValue="v => v.toFixed(1)"
                :hint="'精确 - 创造'"
              />
            </div>

            <div class="setting-item">
              <label class="setting-label">
                <svg width="12" height="12" class="label-icon">
                  <use xlink:href="#iconAlignLeft"></use>
                </svg>
                {{ '最大长度' }}
              </label>
              <Input
                type="number"
                :model-value="maxTokens"
                @update:model-value="$emit('update:maxTokens', Number($event))"
                :min="100"
                :max="50000"
                :step="100"
              />
            </div>

            <div class="setting-item">
              <label class="setting-label">
                <svg width="12" height="12" class="label-icon">
                  <use xlink:href="#iconList"></use>
                </svg>
                {{ '上下文' }}
              </label>
              <Slider
                :model-value="contextMessageLimit"
                @update:model-value="$emit('update:contextMessageLimit', $event)"
                :min="1"
                :max="10"
                :step="1"
                :showValue="true"
                :showMinMax="true"
              />
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
            <Tag v-if="currentPromptName" size="small" variant="info">
              {{ currentPromptName }}
            </Tag>
          </div>
          <div class="save-prompt-input-group">
            <Input
              :model-value="newPromptName"
              @update:model-value="$emit('update:newPromptName', String($event))"
              type="text"
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
              <svg width="14" height="14">
                <use xlink:href="#iconCheck"></use>
              </svg>
              {{ currentPromptName ? '更新' : '保存' }}
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from '@/components/Button.vue';
import Input from '@/components/Input.vue';
import Textarea from '@/components/Textarea.vue';
import Slider from '@/components/Slider.vue';
import Tag from '@/components/Tag.vue';

interface Props {
  showSettings: boolean;
  collapsed: boolean;
  systemPrompt: string;
  temperature: number;
  maxTokens: number;
  contextMessageLimit: number;
  currentPromptName: string;
  newPromptName: string;
}

defineProps<Props>();

defineEmits<{
  'update:systemPrompt': [value: string]
  'update:temperature': [value: number]
  'update:maxTokens': [value: number]
  'update:contextMessageLimit': [value: number]
  'update:newPromptName': [value: string]
  'toggle-settings': []
  'toggle-collapse': []
  'save-current-prompt': []
  'on-prompt-name-focus': []
}>();
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
