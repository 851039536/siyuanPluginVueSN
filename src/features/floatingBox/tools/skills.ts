/**
 * Skills 技能库工具
 */
import { Plugin } from 'siyuan'
import { createApp, type App as VueApp } from 'vue'
import Skills from '../components/SkillsModal.vue'
import type { FloatingTool } from '../types'

let vueApp: VueApp | null = null
let container: HTMLElement | null = null

export function createSkillsTool(plugin: Plugin): FloatingTool {
  return {
    id: 'skills',
    label: (plugin.i18n?.skills as any)?.label || 'Skills',
    title: (plugin.i18n?.skills as any)?.title || '技能库',
    icon: `
      <path fill="currentColor" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
      <circle cx="12" cy="12" r="3.2"/>
    `,
    bgColor: '#667eea',
    action: () => {
      showSkillsModal(plugin)
    }
  }
}

function showSkillsModal(plugin: Plugin) {
  // Close existing modal if open
  if (container) {
    container.remove()
    vueApp?.unmount()
    vueApp = null
    container = null
  }

  // Create container
  container = document.createElement('div')
  container.id = 'skills-modal-container'

  // Try to append to different containers
  const selectors = [
    '#workspace',
    'body',
    '.layout__center',
    '.fn__flex-1'
  ]

  let inserted = false
  for (const selector of selectors) {
    const target = document.querySelector(selector)
    if (target) {
      target.appendChild(container)
      inserted = true
      break
    }
  }

  if (!inserted) {
    document.body.appendChild(container)
  }

  // Create Vue app
  vueApp = createApp(Skills, {
    i18n: {
      skillsTitle: (plugin.i18n?.skills as any)?.modal?.title || '技能库',
      close: (plugin.i18n?.skills as any)?.modal?.close || '关闭',
      addSkill: (plugin.i18n?.skills as any)?.modal?.addSkill || '添加技能',
      editSkill: (plugin.i18n?.skills as any)?.modal?.editSkill || '编辑技能',
      delete: (plugin.i18n?.skills as any)?.modal?.delete || '删除',
      edit: (plugin.i18n?.skills as any)?.modal?.edit || '编辑',
      search: (plugin.i18n?.skills as any)?.modal?.search || '搜索技能...',
      title: (plugin.i18n?.skills as any)?.modal?.titleLabel || '标题',
      description: (plugin.i18n?.skills as any)?.modal?.description || '描述',
      content: (plugin.i18n?.skills as any)?.modal?.content || '内容',
      content2: (plugin.i18n?.skills as any)?.modal?.content2 || '内容2',
      content3: (plugin.i18n?.skills as any)?.modal?.content3 || '内容3',
      cancel: (plugin.i18n?.skills as any)?.modal?.cancel || '取消',
      save: (plugin.i18n?.skills as any)?.modal?.save || '保存',
      titlePlaceholder: (plugin.i18n?.skills as any)?.modal?.titlePlaceholder || '请输入技能标题',
      descriptionPlaceholder: (plugin.i18n?.skills as any)?.modal?.descriptionPlaceholder || '请输入技能描述',
      contentPlaceholder: (plugin.i18n?.skills as any)?.modal?.contentPlaceholder || '请输入要复制的内容',
      content2Placeholder: (plugin.i18n?.skills as any)?.modal?.content2Placeholder || '请输入要复制的内容2',
      content3Placeholder: (plugin.i18n?.skills as any)?.modal?.content3Placeholder || '请输入要复制的内容3',
      noSkills: (plugin.i18n?.skills as any)?.modal?.noSkills || '暂无技能，点击添加',
      noSkillsFound: (plugin.i18n?.skills as any)?.modal?.noSkillsFound || '未找到匹配的技能',
      clickToCopy: (plugin.i18n?.skills as any)?.modal?.clickToCopy || '复制'
    },
    plugin: plugin
  })

  try {
    vueApp.mount(container)
  } catch (error) {
    console.error('Failed to mount skills modal:', error)
  }

  // Handle escape key
  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === 'Escape' && container) {
      closeSkillsModal()
    }
  }
  document.addEventListener('keydown', handleEscape)

  // Store cleanup function
  ;(plugin as any).__skillsModal = {
    destroy: () => {
      document.removeEventListener('keydown', handleEscape)
      closeSkillsModal()
    }
  }
}

function closeSkillsModal() {
  if (container) {
    container.remove()
    vueApp?.unmount()
    vueApp = null
    container = null
  }
}

export function skillsTool(plugin: Plugin): FloatingTool {
  return createSkillsTool(plugin)
}
