<template>
  <div class="qrcode-section">
    <div class="input-section">
      <h4>{{ inputTitle }}</h4>
      <Textarea
        :model-value="content"
        class="input-textarea"
        :placeholder="placeholder"
        :rows="4"
        @update:model-value="$emit('update:content', $event)"
      />
      <div class="qrcode-settings">
        <div class="setting-group">
          <label>{{ sizeLabel }}: {{ size }}px</label>
          <input
            type="range"
            :value="size"
            min="100"
            max="400"
            step="20"
            class="quality-slider"
            @input="$emit('update:size', Number(($event.target as HTMLInputElement).value))"
          />
        </div>
        <div class="setting-group">
          <label class="checkbox-label">
            <input
              type="checkbox"
              :checked="darkMode"
              @change="$emit('update:darkMode', ($event.target as HTMLInputElement).checked)"
            />
            {{ darkModeLabel }}
          </label>
        </div>
      </div>
      <Button
        variant="primary"
        :disabled="!content"
        class="generate-btn"
        @click="$emit('generate')"
      >
        {{ generateText }}
      </Button>
    </div>

    <div
      v-if="output"
      class="result-section qrcode-result"
    >
      <div class="preview-section">
        <h4>{{ previewTitle }}</h4>
        <div class="qrcode-preview">
          <img
            :src="output"
            alt="QR Code"
          />
        </div>
      </div>

      <div class="output-section">
        <div class="output-controls">
          <Button
            variant="primary"
            size="small"
            @click="$emit('download')"
          >
            {{ downloadText }}
          </Button>
          <Button
            variant="ghost"
            size="small"
            icon="contentCopy"
            :icon-size="14"
            @click="$emit('copy')"
          >
            {{ copyText }}
          </Button>
        </div>
        <div
          v-if="content"
          class="output-info"
        >
          <p><strong>{{ contentLabel }}:</strong> {{ content.substring(0, 50) }}{{ content.length > 50 ? '...' : '' }}</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue"
import Textarea from "@/components/Textarea.vue"

interface Props {
  content: string
  size: number
  darkMode: boolean
  output: string
  inputTitle: string
  placeholder: string
  sizeLabel: string
  darkModeLabel: string
  generateText: string
  previewTitle: string
  downloadText: string
  copyText: string
  contentLabel: string
}

defineProps<Props>()
defineEmits<{
  "update:content": [value: string]
  "update:size": [value: number]
  "update:darkMode": [value: boolean]
  "generate": []
  "download": []
  "copy": []
}>()
</script>

<style scoped lang="scss">
@use "../styles/index.scss";
</style>
