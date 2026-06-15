<template>
  <Teleport to="body">
    <div
      v-if="showSettings"
      class="settings-overlay"
      @click.self="$emit('toggle-settings')"
    >
      <div class="settings-dialog">
        <!-- 标题栏 -->
        <header class="dialog-header">
          <div class="header-left">
            <svg
              width="15"
              height="15"
            ><use xlink:href="#iconSparkles" /></svg>
            <span class="header-title">提示词配置</span>
            <Tag
              v-if="currentPromptName"
              size="small"
              variant="info"
            >
              {{ currentPromptName }}
            </Tag>
          </div>
          <Button
            variant="ghost"
            size="small"
            @click="$emit('toggle-settings')"
          >
            <svg
              width="14"
              height="14"
            ><use xlink:href="#iconClose" /></svg>
          </Button>
        </header>

        <!-- 内容区 -->
        <div class="dialog-body">
          <!-- 系统提示词 -->
          <section class="form-section">
            <label class="form-label">
              <svg
                width="13"
                height="13"
              ><use xlink:href="#iconEdit" /></svg>
              系统提示词
            </label>
            <Input
              type="textarea"
              :model-value="systemPrompt"
              placeholder="输入系统提示词，定义AI的角色和行为..."
              :rows="5"
              @update:model-value="$emit('update:systemPrompt', $event)"
            />
          </section>

          <!-- 参数区域 -->
          <section class="form-section params-section">
            <div class="params-grid">
              <div class="form-group">
                <label class="form-label">
                  <svg
                    width="12"
                    height="12"
                  ><use xlink:href="#iconHot" /></svg>
                  创造性
                  <span class="label-value">{{ temperature.toFixed(1) }}</span>
                </label>
                <Slider
                  :model-value="temperature"
                  :min="0"
                  :max="2"
                  :step="0.1"
                  size="small"
                  @update:model-value="$emit('update:temperature', $event)"
                />
                <div class="param-hint">
                  精确 ← → 创造
                </div>
              </div>

              <div class="form-group">
                <label class="form-label">
                  <svg
                    width="12"
                    height="12"
                  ><use xlink:href="#iconAlignLeft" /></svg>
                  最大长度
                  <span class="label-value">{{ maxTokens.toLocaleString() }}</span>
                </label>
                <Input
                  type="number"
                  :model-value="maxTokens"
                  :min="100"
                  :max="50000"
                  :step="100"
                  size="small"
                  @update:model-value="$emit('update:maxTokens', Number($event))"
                />
              </div>
            </div>
          </section>

          <!-- 保存当前配置 -->
          <section class="form-section save-section">
            <label class="form-label">
              <svg
                width="13"
                height="13"
              ><use xlink:href="#iconSave" /></svg>
              {{ currentPromptName ? '更新配置' : '保存为新配置' }}
            </label>
            <div class="save-row">
              <Input
                :model-value="newPromptName"
                :placeholder="currentPromptName || '输入配置名称...'"
                size="small"
                @update:model-value="$emit('update:newPromptName', String($event))"
                @keydown.enter="$emit('save-current-prompt')"
                @focus="$emit('on-prompt-name-focus')"
              />
              <Button
                :disabled="!newPromptName.trim() && !currentPromptName"
                variant="primary"
                size="small"
                @click="$emit('save-current-prompt')"
              >
                <svg
                  width="12"
                  height="12"
                ><use xlink:href="#iconCheck" /></svg>
                {{ currentPromptName ? '更新' : '保存' }}
              </Button>
            </div>
          </section>

          <!-- 已保存的提示词管理 -->
          <section
            v-if="savedPrompts.length > 0"
            class="form-section prompts-section"
          >
            <label class="form-label">
              <svg
                width="13"
                height="13"
              ><use xlink:href="#iconList" /></svg>
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
                <div
                  class="prompt-manage-info"
                  @click="$emit('load-prompt', index)"
                >
                  <span class="prompt-manage-name">{{ prompt.name }}</span>
                  <span class="prompt-manage-preview">{{ getPromptPreview(prompt.systemPrompt) }}</span>
                </div>
                <div class="prompt-manage-actions">
                  <Button
                    variant="ghost"
                    size="small"
                    title="应用"
                    @click.stop="$emit('load-prompt', index)"
                  >
                    <svg
                      width="12"
                      height="12"
                    ><use xlink:href="#iconCheck" /></svg>
                  </Button>
                  <Button
                    variant="ghost"
                    size="small"
                    title="删除"
                    @click.stop="$emit('delete-prompt', index)"
                  >
                    <svg
                      width="12"
                      height="12"
                    ><use xlink:href="#iconTrashcan" /></svg>
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
import type { SavedPrompt } from "@/types/ai"
import Button from "@/components/Button.vue"
import Input from "@/components/Input.vue"
import Slider from "@/components/Slider.vue"
import Tag from "@/components/Tag.vue"
import { getPromptPreview } from "../utils"

defineProps<{
  showSettings: boolean
  systemPrompt: string
  temperature: number
  maxTokens: number
  currentPromptName: string
  newPromptName: string
  savedPrompts: SavedPrompt[]
}>()

defineEmits<{
  "update:systemPrompt": [value: string]
  "update:temperature": [value: number]
  "update:maxTokens": [value: number]
  "update:newPromptName": [value: string]
  "toggle-settings": []
  "save-current-prompt": []
  "on-prompt-name-focus": []
  "load-prompt": [index: number]
  "delete-prompt": [index: number]
}>()

</script>

<style lang="scss" scoped>
@use "../styles/SettingsPanel.scss";
</style>
