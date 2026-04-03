<template>
  <div class="general-settings">
    <div class="settings-header">
      <h3>{{ i18n.commonSettings || '常用设置' }}</h3>
    </div>

    <div class="settings-layout">
      <div class="settings-sidebar">
        <div
          v-for="category in categories"
          :key="category.id"
          :class="['sidebar-item', { active: activeCategory === category.id }]"
          @click="activeCategory = category.id"
        >
          <span class="sidebar-title">{{ category.label }}</span>
        </div>
      </div>

      <div class="settings-content">
        <div v-show="activeCategory === 'highlight'" class="content-section">
          <HighlightSettings :i18n="i18n" :plugin="plugin" />
        </div>

        <div v-show="activeCategory === 'codeblock'" class="content-section">
          <CodeBlockSettings :i18n="i18n" :plugin="plugin" @change="handleCodeBlockChange" />
        </div>

        <div v-show="activeCategory === 'heading'" class="content-section">
          <HeadingSettings :i18n="i18n" :plugin="plugin" @change="handleHeadingChange" />
        </div>

        <div v-show="activeCategory === 'encryption'" class="content-section">
          <PasswordSettings :i18n="i18n" />
          <EncryptionSettings :plugin="plugin" />
        </div>

        <div v-show="activeCategory === 'backup'" class="content-section">
          <DataBackupSettings :i18n="i18n" :plugin="plugin" @change="handleBackupChange" />
        </div>

        <div v-show="activeCategory === 'documentFont'" class="content-section">
          <DocumentFontSettings :i18n="i18n" :plugin="plugin" @change="handleDocumentFontChange" />
        </div>

        <div v-show="activeCategory === 'tableStyle'" class="content-section">
          <TableStyleSettings :i18n="i18n" :plugin="plugin" @change="handleTableStyleChange" />
        </div>

        <div v-show="activeCategory === 'listStyle'" class="content-section">
          <ListStyleSettings :i18n="i18n" :plugin="plugin" @change="handleListStyleChange" />
        </div>

        <div v-show="activeCategory === 'tabPin'" class="content-section">
          <TabPinSettings :i18n="i18n" :plugin="plugin" @change="handleTabPinChange" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import PasswordSettings from './components/PasswordSettings.vue'
import CodeBlockSettings from './components/CodeBlockSettings.vue'
import HeadingSettings from './components/HeadingSettings.vue'
import EncryptionSettings from './components/EncryptionSettings.vue'
import HighlightSettings from './components/HighlightSettings.vue'
import DataBackupSettings from './components/DataBackupSettings.vue'
import DocumentFontSettings from './components/DocumentFontSettings.vue'
import TableStyleSettings from './components/TableStyleSettings.vue'
import ListStyleSettings from './components/ListStyleSettings.vue'
import TabPinSettings from './components/TabPinSettings.vue'

interface Props {
  i18n?: any
  plugin?: any
  onSettingsChange?: (settings: any) => void
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
  plugin: null,
  onSettingsChange: () => {}
})

const activeCategory = ref('highlight')

const categories = computed(() => [
  {
    id: 'highlight',
    label: props.i18n.enableHighlight || '高亮设置'
  },
  {
    id: 'codeblock',
    label: props.i18n.codeBlockSettings || '代码块美化'
  },
  {
    id: 'heading',
    label: props.i18n.headingSettings || '标题配置'
  },
  {
    id: 'documentFont',
    label: props.i18n.documentFontSettings || '文档字体'
  },
  {
    id: 'tableStyle',
    label: props.i18n.tableStyleSettings || '表格样式'
  },
  {
    id: 'listStyle',
    label: props.i18n.listStyleSettings || '列表样式'
  },
  {
    id: 'tabPin',
    label: props.i18n.tabPinSettings || '钉住页签'
  },
  {
    id: 'encryption',
    label: props.i18n.encryptionSettings || '加密设置'
  },
  {
    id: 'backup',
    label: props.i18n.dataBackup || '数据备份'
  }
])

function createSettingsHandler(moduleId: string) {
  return (settings: any) => {
    props.onSettingsChange?.({ moduleId, settings })
  }
}

const handleCodeBlockChange = createSettingsHandler('codeblock')
const handleHeadingChange = createSettingsHandler('heading')
const handleBackupChange = createSettingsHandler('backup')
const handleDocumentFontChange = createSettingsHandler('documentFont')
const handleTableStyleChange = createSettingsHandler('tableStyle')
const handleListStyleChange = createSettingsHandler('listStyle')
const handleTabPinChange = createSettingsHandler('tabPin')

defineExpose({
  handleCodeBlockChange,
  handleHeadingChange,
  handleBackupChange,
  handleDocumentFontChange,
  handleTableStyleChange,
  handleListStyleChange,
  handleTabPinChange
})
</script>

<style scoped lang="scss">
@use './styles/index.scss' as *;
</style>
