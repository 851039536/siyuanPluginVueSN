<template>
  <div class="general-settings">
    <div class="settings-header">
      <h3>{{ i18n.generalSettings || '通用设置' }}</h3>
    </div>

    <!-- 模块选项卡 -->
    <div class="module-tabs">
      <button
        v-for="module in modules"
        :key="module.id"
        :class="['tab-btn', { active: activeModule === module.id }]"
        @click="switchModule(module.id)"
      >
        <span v-if="module.icon" class="tab-icon">{{ module.icon }}</span>
        {{ module.name }}
      </button>
    </div>

    <!-- 模块内容 -->
    <div class="module-content">
      <component
        :is="activeModuleComponent"
        :i18n="i18n"
        @change="handleModuleChange"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import FontSettings from './components/FontSettings.vue'
import GeneralActions from './components/GeneralActions.vue'
import PasswordSettings from './components/PasswordSettings.vue'
import CodeBlockSettings from './components/CodeBlockSettings.vue'

interface Props {
  i18n?: any
  onSettingsChange?: (settings: any) => void
}

const props = withDefaults(defineProps<Props>(), {
  i18n: () => ({}),
  onSettingsChange: () => {}
})

// 可用的设置模块
const modules = ref([
  {
    id: 'font',
    name: props.i18n.fontSettings || '字体设置',
    icon: '🔤',
    component: FontSettings,
    order: 1
  },
  {
    id: 'codeblock',
    name: props.i18n.codeBlockSettings || '代码块美化',
    icon: '💻',
    component: CodeBlockSettings,
    order: 2
  },
  {
    id: 'password',
    name: props.i18n.passwordSetting || '密码设置',
    icon: '🔒',
    component: PasswordSettings,
    order: 3
  },
  {
    id: 'actions',
    name: props.i18n.generalActions || '通用操作',
    icon: '🚀',
    component: GeneralActions,
    order: 4
  },
])

const activeModule = ref('font')

// 计算当前激活的模块组件
const activeModuleComponent = computed(() => {
  const module = modules.value.find(m => m.id === activeModule.value)
  return module?.component || FontSettings
})

function switchModule(moduleId: string) {
  activeModule.value = moduleId
}

function handleModuleChange(settings: any) {
  console.log(`模块 ${activeModule.value} 设置已更改:`, settings)
  props.onSettingsChange?.({
    moduleId: activeModule.value,
    settings
  })
}

// 暴露方法给父组件
defineExpose({
  switchModule,
  activeModule,
  modules
})
</script>

<style scoped>
.general-settings {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--b3-theme-background);
  color: var(--b3-theme-on-background);
  overflow: hidden;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.settings-header {
  padding: 16px 20px;
  border-bottom: 2px solid var(--b3-theme-surface-variant);
  background: linear-gradient(135deg, var(--b3-theme-surface), var(--b3-theme-surface-variant));
}

.settings-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: var(--b3-theme-primary);
  display: flex;
  align-items: center;
  gap: 8px;
}

.settings-header h3::before {
  content: '⚙️';
  font-size: 20px;
}

.module-tabs {
  display: flex;
  background: var(--b3-theme-surface-variant);
  border-bottom: 2px solid var(--b3-theme-outline);
  overflow-x: auto;
  scrollbar-width: none;
  -ms-overflow-style: none;
  position: relative;
}

.module-tabs::-webkit-scrollbar {
  display: none;
}

.tab-btn {
  flex: 1;
  min-width: 100px;
  padding: 12px 16px;
  border: none;
  background: transparent;
  color: var(--b3-theme-on-surface-variant);
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  white-space: nowrap;
  border-bottom: 3px solid transparent;
}

.tab-btn:hover {
  background: var(--b3-theme-surface);
  color: var(--b3-theme-on-surface);
  transform: translateY(-1px);
}

.tab-btn.active {
  background: linear-gradient(to bottom, var(--b3-theme-primary), var(--b3-theme-primary-container));
  color: var(--b3-theme-on-primary);
  border-bottom-color: var(--b3-theme-primary);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
}

.tab-icon {
  font-size: 16px;
}

.tab-icon {
  font-size: 14px;
}

.module-content {
  flex: 1;
  overflow-y: auto;
  background: var(--b3-theme-background);
  position: relative;
}

.module-content::-webkit-scrollbar {
  width: 6px;
}

.module-content::-webkit-scrollbar-track {
  background: var(--b3-theme-surface-variant);
}

.module-content::-webkit-scrollbar-thumb {
  background: var(--b3-theme-outline);
  border-radius: 3px;
}

.module-content::-webkit-scrollbar-thumb:hover {
  background: var(--b3-theme-primary);
}

/* 响应式设计 */
@media (max-width: 400px) {
  .tab-btn {
    font-size: 11px;
    padding: 6px 8px;
    min-width: 60px;
  }

  .settings-header {
    padding: 8px 12px;
  }

  .settings-header h3 {
    font-size: 14px;
  }
}
</style>
