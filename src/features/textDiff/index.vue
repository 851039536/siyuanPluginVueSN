<template>
  <div class="text-diff-container">
    <!-- 工具栏 -->
    <div class="diff-toolbar">
      <div class="diff-options">
        <!-- 模式选择 -->
        <div class="option-group">
          <Label class="option-label">{{ $t('displayMode') }}:</Label>
          <Button
            v-for="mode in [
              { value: 'split', label: $t('splitMode') },
              { value: 'unified', label: $t('unifiedMode') }
            ]"
            :key="mode.value"
            :variant="diffMode === mode.value ? 'primary' : 'ghost'"
            size="small"
            @click="updateMode(mode.value as 'split' | 'unified')"
          >
            {{ mode.label }}
          </Button>
        </div>

        <!-- 主题选择 -->
        <div class="option-group">
          <Label class="option-label">{{ $t('theme') }}:</Label>
          <Button
            v-for="theme in [
              { value: 'light', label: $t('lightTheme') },
              { value: 'dark', label: $t('darkTheme') }
            ]"
            :key="theme.value"
            :variant="diffTheme === theme.value ? 'primary' : 'ghost'"
            size="small"
            @click="updateTheme(theme.value as 'light' | 'dark')"
          >
            {{ theme.label }}
          </Button>
        </div>

        <!-- 字体大小选择 -->
        <div class="option-group">
          <Label class="option-label">{{ $t('fontSize') }}:</Label>
          <Select
            :model-value="fontSize"
            :options="fontSizeOptions"
            size="small"
            @update:model-value="updateFontSize"
          />
        </div>
      </div>

      <div class="diff-actions">
        <Button variant="ghost" size="small" icon="close" @click="clearAll">
          {{ $t('clear') }}
        </Button>
        <Button variant="ghost" size="small" icon="shuffle" @click="swapTexts">
          {{ $t('swap') }}
        </Button>
      </div>
    </div>

    <!-- 主内容区 -->
    <div class="diff-content">
      <!-- 上部：输入区域 -->
      <div class="input-section">
        <!-- 原文本 -->
        <div class="diff-panel input-area">
          <div class="panel-header">
            <Label>{{ $t('original') }}</Label>
            <span class="char-count">{{ originalText.length }} {{ $t('chars') }}</span>
          </div>
          <Textarea
            v-model="originalText"
            :placeholder="$t('originalPlaceholder')"
            resize="vertical"
          />
        </div>

        <!-- 修改后文本 -->
        <div class="diff-panel input-area">
          <div class="panel-header">
            <Label>{{ $t('modified') }}</Label>
            <span class="char-count">{{ modifiedText.length }} {{ $t('chars') }}</span>
          </div>
          <Textarea
            v-model="modifiedText"
            :placeholder="$t('modifiedPlaceholder')"
            resize="vertical"
          />
        </div>
      </div>

      <!-- 下部：差异显示 -->
      <div class="diff-panel result">
        <div class="panel-header">
          <Label>{{ $t('diffResult') }}</Label>
        </div>
        <Diff
          class="diff-content-viewer"
          :mode="diffMode"
          :theme="diffTheme"
          language="plaintext"
          :prev="originalText"
          :current="modifiedText"
          :folding="false"
          :virtual-scroll="false"
          :render-added="true"
          :render-removed="true"
          :hide-line-numbers="false"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Diff } from 'vue-diff'
import 'vue-diff/dist/index.css'
import type { Plugin } from 'siyuan'
import { TextDiffStorage, type TextDiffSettings } from './types/storage'
import Button from '@/components/Button.vue'
import Select from '@/components/Select.vue'
import Textarea from '@/components/Textarea.vue'
import Label from '@/components/Label.vue'

const props = defineProps<{
  onClose?: () => void
  i18n?: any
  plugin?: Plugin
}>()

// 存储管理
const storage = props.plugin ? new TextDiffStorage(props.plugin) : null

// 响应式数据
const originalText = ref('')
const modifiedText = ref('')
const diffMode = ref<'split' | 'unified'>('split')
const diffTheme = ref<'light' | 'dark'>('light')
const fontSize = ref<number>(14)

// 字体大小选项
const fontSizeOptions = [
  { value: 12, label: '12px' },
  { value: 14, label: '14px' },
  { value: 16, label: '16px' },
  { value: 18, label: '18px' },
  { value: 20, label: '20px' },
  { value: 24, label: '24px' },
  { value: 28, label: '28px' },
  { value: 32, label: '32px' }
]

// 加载保存的设置
const loadSettings = async () => {
  if (storage) {
    try {
      const settings = await storage.loadSettings()
      diffMode.value = settings.diffMode
      diffTheme.value = settings.theme
      fontSize.value = settings.fontSize
      // 加载设置后立即更新字体大小
      setFontSize(settings.fontSize)
    } catch (error) {
      console.error('加载文本对比设置失败:', error)
    }
  }
}

// 保存当前设置
const saveSettings = async () => {
  if (storage) {
    try {
      const settings: TextDiffSettings = {
        fontSize: fontSize.value,
        diffMode: diffMode.value,
        theme: diffTheme.value
      }
      await storage.saveSettings(settings)
    } catch (error) {
      console.error('保存文本对比设置失败:', error)
    }
  }
}

// 监听设置变化并保存
const updateMode = (mode: 'split' | 'unified') => {
  diffMode.value = mode
  saveSettings()
}

const updateTheme = (theme: 'light' | 'dark') => {
  diffTheme.value = theme
  saveSettings()
}

const updateFontSize = (size: number) => {
  fontSize.value = size
  setFontSize(size)  // 立即更新字体大小
  saveSettings()     // 保存到数据库
}

// 设置字体大小的 CSS 变量
const setFontSize = (size: number) => {
  document.documentElement.style.setProperty('--diff-font-size', `${size}px`)
}

// 组件挂载时加载设置
onMounted(() => {
  loadSettings()
  // 初始设置字体大小
  setFontSize(fontSize.value)
})

// 清空所有文本
function clearAll() {
  originalText.value = ''
  modifiedText.value = ''
}

// 交换文本内容
function swapTexts() {
  const temp = originalText.value
  originalText.value = modifiedText.value
  modifiedText.value = temp
}

// 国际化函数
const $t = (key: string) => {
  if (props.i18n && props.i18n.textDiff && props.i18n.textDiff[key]) {
    return props.i18n.textDiff[key]
  }
  // 回退到硬编码的翻译
  const translations: Record<string, string> = {
    clear: '清空',
    swap: '交换',
    original: '原文本',
    modified: '修改后文本',
    diffResult: '差异结果',
    chars: '字符',
    originalPlaceholder: '请输入原始文本...',
    modifiedPlaceholder: '请输入修改后的文本...',
    emptyState: '请输入文本以查看差异',
    displayMode: '显示模式',
    splitMode: '分栏模式',
    unifiedMode: '统一模式',
    theme: '主题',
    lightTheme: '浅色',
    darkTheme: '深色',
    fontSize: '字体大小'
  }
  return translations[key] || key
}
</script>

<style scoped lang="scss">
@use "./styles/index.scss";
</style>
