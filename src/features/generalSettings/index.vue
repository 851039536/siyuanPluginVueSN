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

        <div v-show="activeCategory === 'list'" class="content-section">
          <ListSettings :i18n="i18n" :plugin="plugin" @change="handleListChange" />
        </div>

        <div v-show="activeCategory === 'actions'" class="content-section">
          <GeneralActions :i18n="i18n" @change="handleActionsChange" />
        </div>

        <div v-show="activeCategory === 'backup'" class="content-section">
          <DataBackupSettings :i18n="i18n" :plugin="plugin" @change="handleBackupChange" />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import GeneralActions from './components/GeneralActions.vue'
import PasswordSettings from './components/PasswordSettings.vue'
import CodeBlockSettings from './components/CodeBlockSettings.vue'
import HeadingSettings from './components/HeadingSettings.vue'
import ListSettings from './components/ListSettings.vue'
import EncryptionSettings from './components/EncryptionSettings.vue'
import HighlightSettings from './components/HighlightSettings.vue'
import DataBackupSettings from './components/DataBackupSettings.vue'

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
    id: 'list',
    label: props.i18n.listSettings || '列表设置'
  },
  {
    id: 'encryption',
    label: props.i18n.encryptionSettings || '加密设置'
  },
  {
    id: 'actions',
    label: props.i18n.generalActions || '通用操作'
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
const handleActionsChange = createSettingsHandler('actions')
const handleHeadingChange = createSettingsHandler('heading')
const handleListChange = createSettingsHandler('list')
const handleBackupChange = createSettingsHandler('backup')

defineExpose({
  handleCodeBlockChange,
  handleActionsChange,
  handleHeadingChange,
  handleListChange,
  handleBackupChange
})
</script>

<style scoped lang="scss">
@use './styles/index.scss' as *;
</style>
