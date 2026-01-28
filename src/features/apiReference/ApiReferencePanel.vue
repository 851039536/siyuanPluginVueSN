<template>
  <div class="api-reference-panel">
    <!-- 头部 -->
    <div class="api-reference-header">
      <div class="header-title">
        <span class="icon">📚</span>
        <h2>{{ i18n.apiReference?.title || 'API使用参考' }}</h2>
      </div>
      <div class="header-actions">
        <button class="action-btn" @click="showAddProviderDialog" :title="i18n.apiReference?.addProvider || '添加API文档'">
          <Icon icon="lucide:plus" width="16" height="16" />
        </button>
        <button class="close-btn" @click="handleClose">
          <Icon icon="lucide:x" width="16" height="16" />
        </button>
      </div>
    </div>

    <!-- 搜索栏 -->
    <div class="search-bar">
      <div class="search-input-wrapper">
        <Icon class="search-icon" icon="lucide:search" width="16" height="16" />
        <input
          v-model="searchQuery"
          type="text"
          class="search-input"
          :placeholder="i18n.apiReference?.searchPlaceholder || '搜索API文档...'"
          @keydown.esc="searchQuery = ''"
        />
        <kbd v-if="!searchQuery" class="search-hint">Ctrl+Alt+A</kbd>
        <button v-else class="clear-search" @click="searchQuery = ''">
          <Icon icon="lucide:x" width="12" height="12" />
        </button>
      </div>
    </div>

    <!-- API选择器 -->
    <div class="api-selector" v-if="providers.length > 0">
      <div class="api-tabs">
        <button
          v-for="provider in filteredProviders"
          :key="provider.id"
          :class="['api-tab', { active: selectedProvider?.id === provider.id }]"
          @click="selectProvider(provider.id)"
        >
          <span class="provider-icon">{{ provider.icon }}</span>
          <span class="provider-name">{{ provider.name }}</span>
          <span class="provider-version" v-if="provider.version">v{{ provider.version }}</span>
          <button
            class="remove-provider-btn"
            @click.stop="removeProvider(provider.id)"
            :title="i18n.apiReference?.deleteProvider || '删除此API文档'"
          >
            <Icon icon="lucide:x" width="12" height="12" />
          </button>
        </button>
      </div>
      <div v-if="filteredProviders.length === 0 && searchQuery" class="no-results">
        {{ i18n.apiReference?.noResults || '未找到匹配的API文档' }}
      </div>
    </div>

    <!-- 空状态 -->
    <div v-if="providers.length === 0" class="empty-state">
      <div class="empty-icon">📄</div>
      <h3>{{ i18n.apiReference?.noProviders || '暂无API文档' }}</h3>
      <p>{{ i18n.apiReference?.addFirstProvider || '点击上方的 + 按钮添加您的第一个API文档' }}</p>
      <button class="add-provider-btn" @click="showAddProviderDialog">
        {{ i18n.apiReference?.addProvider || '添加API文档' }}
      </button>
    </div>

    <!-- 内容区域 -->
    <div class="api-reference-content" v-if="selectedProvider">
      <!-- 目录导航 -->
      <div class="toc-sidebar" v-if="hasToc">
        <div class="toc-header">
          <span class="toc-icon">📑</span>
          <h3>{{ i18n.apiReference?.tableOfContents || '目录' }}</h3>
        </div>
        <nav class="toc-nav">
          <TocTree
            :items="tocItems"
            :activeSlug="activeHeading"
            @navigate="scrollToHeading"
          />
        </nav>
      </div>

      <!-- Markdown 内容渲染 -->
      <div class="markdown-content-wrapper" ref="contentRef">
        <div
          class="markdown-content"
          v-html="renderedMarkdown"
          @click="handleContentClick"
        ></div>
      </div>
    </div>

    <!-- 添加API文档对话框 -->
    <div v-if="showAddDialog" class="dialog-overlay" @click="hideAddProviderDialog">
      <div class="dialog" @click.stop>
        <div class="dialog-header">
          <h3>{{ i18n.apiReference?.addProvider || '添加API文档' }}</h3>
          <button class="close-btn" @click="hideAddProviderDialog">
            <Icon icon="lucide:x" width="16" height="16" />
          </button>
        </div>
        <div class="dialog-content">
          <div class="form-group">
            <label>{{ i18n.apiReference?.providerName || 'API名称' }}:</label>
            <input
              v-model="newProvider.name"
              type="text"
              :placeholder="i18n.apiReference?.providerNamePlaceholder || '例如: OpenAI API'"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label>{{ i18n.apiReference?.providerIcon || '图标' }}:</label>
            <input
              v-model="newProvider.icon"
              type="text"
              :placeholder="i18n.apiReference?.providerIconPlaceholder || '例如: 🤖'"
              class="form-input"
            />
          </div>
          <div class="form-group">
            <label>{{ i18n.apiReference?.markdownContent || 'Markdown内容' }}:</label>
            <textarea
              v-model="newProvider.content"
              :placeholder="i18n.apiReference?.markdownPlaceholder || '请输入Markdown格式的API文档内容...'"
              class="form-textarea"
              rows="10"
            ></textarea>
          </div>
        </div>
        <div class="dialog-actions">
          <button class="btn btn-secondary" @click="hideAddProviderDialog">
            {{ i18n.apiReference?.cancel || '取消' }}
          </button>
          <button class="btn btn-primary" @click="addProvider" :disabled="!canAddProvider">
            {{ i18n.apiReference?.add || '添加' }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, nextTick, watch, defineComponent, h } from 'vue'
import { Icon } from '@iconify/vue'
import { Plugin } from 'siyuan'
import { renderMarkdown, extractToc, type TocItem } from './markdownLoader'
import { createApiReferenceStorage } from './storage'
import { initializeDefaultProviders } from './register'
import hljs from 'highlight.js'
import type { ApiProvider } from './types'

interface Props {
  i18n: any
  plugin: Plugin
  onClose: () => void
}

const props = defineProps<Props>()

// TOC Tree 组件
const TocTree = defineComponent({
  name: 'TocTree',
  props: {
    items: { type: Array as () => TocItem[], required: true },
    activeSlug: { type: String, default: '' }
  },
  emits: ['navigate'],
  setup(props, { emit }) {
    const handleClick = (slug: string, event: Event) => {
      event.preventDefault()
      event.stopPropagation()
      emit('navigate', slug)
    }

    const handleMouseEnter = (event: Event) => {
      const target = event.currentTarget as HTMLElement
      if (target) {
        target.style.transform = 'translateX(4px)'
        const indicator = target.querySelector('.toc-indicator') as HTMLElement
        if (indicator) {
          indicator.style.transform = 'scale(1.2)'
        }
      }
    }

    const handleMouseLeave = (event: Event, item: TocItem) => {
      const target = event.currentTarget as HTMLElement
      const isActive = props.activeSlug === item.slug
      if (target && !isActive) {
        target.style.transform = 'translateX(0)'
        const indicator = target.querySelector('.toc-indicator') as HTMLElement
        if (indicator) {
          indicator.style.transform = 'scale(1)'
        }
      }
    }

    const renderItem = (item: TocItem) => {
      const isActive = props.activeSlug === item.slug
      const hasChildren = item.children && item.children.length > 0

      return h('li', {
        class: `toc-item toc-level-${item.level}`,
        'data-slug': item.slug
      }, [
        h('div', {
          class: { 'toc-link': true, 'active': isActive },
          onClick: (e: Event) => handleClick(item.slug, e),
          onMouseenter: (e: Event) => handleMouseEnter(e),
          onMouseleave: (e: Event) => handleMouseLeave(e, item)
        }, [
          h('div', {
            class: 'toc-indicator'
          }),
          h('span', {
            class: 'toc-text'
          }, item.text)
        ]),
        hasChildren ? h('ul', { class: 'toc-children' }, item.children!.map(renderItem)) : null
      ])
    }

    return () => h('ul', { class: 'toc-list' }, props.items.map(renderItem))
  }
})

// 响应式数据
const storage = createApiReferenceStorage(props.plugin)
const contentRef = ref<HTMLElement>()
const providers = ref<ApiProvider[]>([])
const selectedProvider = ref<ApiProvider>()
const showAddDialog = ref(false)
const tocItems = ref<TocItem[]>([])
const activeHeading = ref<string>('')
const newProvider = ref({ name: '', icon: '📄', content: '' })
const searchQuery = ref('')

// 计算属性
const renderedMarkdown = computed(() => {
  if (!selectedProvider.value) return ''
  let content = selectedProvider.value.description || ''

  // 如果有搜索关键词，高亮显示
  if (searchQuery.value.trim()) {
    const regex = new RegExp(`(${searchQuery.value.trim()})`, 'gi')
    content = content.replace(regex, '<mark>$1</mark>')
  }

  return renderMarkdown(content)
})

const hasToc = computed(() => tocItems.value.length > 0)
const canAddProvider = computed(() => newProvider.value.name.trim() && newProvider.value.content.trim())

const filteredProviders = computed(() => {
  if (!searchQuery.value.trim()) return providers.value
  const query = searchQuery.value.toLowerCase()
  return providers.value.filter(p =>
    p.name.toLowerCase().includes(query) ||
    p.description.toLowerCase().includes(query)
  )
})

// 生命周期
onMounted(async () => {

  // 强制注入关键样式
  injectCriticalStyles()

  await initializeDefaultProviders(props.plugin)
  const storedProviders = await storage.getProviders()
  providers.value = storedProviders
  if (providers.value.length > 0) {
    await selectProvider(providers.value[0].id)
  }
})

// 强制注入关键样式，确保在第三方环境中也能正常显示
function injectCriticalStyles() {
  const styleId = 'api-reference-critical-styles'
  if (document.getElementById(styleId)) return

  const style = document.createElement('style')
  style.id = styleId
  style.textContent = `
    .api-reference-panel .toc-indicator {
      border-radius: 50% !important;
      margin-right: 12px !important;
      flex-shrink: 0 !important;
      transition: all 0.2s ease !important;
    }

    .api-reference-panel .toc-text {
      flex: 1 !important;
      line-height: 1.4 !important;
    }

    .api-reference-panel .toc-list {
      list-style: none !important;
      padding: 0 !important;
      margin: 0 !important;
    }

    .api-reference-panel .toc-item {
      margin: 0 !important;
    }

    .api-reference-panel .toc-children {
      list-style: none !important;
      padding: 0 !important;
      margin: 0 !important;
    }
  `
  document.head.appendChild(style)
}

// 监听选中的提供者变化
watch(selectedProvider, (newProvider) => {
  if (newProvider) {
    tocItems.value = extractToc(newProvider.description || '')
    nextTick(() => {
      highlightCodeBlocks()
      setupScrollSpy()
    })
  } else {
    tocItems.value = []
  }
}, { immediate: true })

// Provider 管理
async function selectProvider(providerId: string) {
  const provider = providers.value.find(p => p.id === providerId)
  if (!provider) return

  const content = await storage.getMarkdownContent(providerId)
  if (content) provider.description = content
  selectedProvider.value = provider
}

async function addProvider() {
  if (!canAddProvider.value) return

  const providerId = newProvider.value.name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-') + '-' + Date.now()
  const provider: ApiProvider = {
    id: providerId,
    name: newProvider.value.name,
    description: newProvider.value.content,
    icon: newProvider.value.icon,
    version: '',
    documentationUrl: '',
    baseUrl: '',
    authType: 'none',
    categories: []
  }

  const updatedProviders = [...providers.value, provider]
  await storage.saveProviders(updatedProviders)
  await storage.saveMarkdownContent(providerId, newProvider.value.content)

  providers.value = updatedProviders
  selectedProvider.value = provider
  hideAddProviderDialog()
}

async function removeProvider(providerId: string) {
  if (!confirm(props.i18n.apiReference?.confirmDelete || '确定要删除此API文档吗？')) return

  await storage.removeProvider(providerId)
  providers.value = providers.value.filter(p => p.id !== providerId)

  if (selectedProvider.value?.id === providerId) {
    selectedProvider.value = providers.value.length > 0 ? providers.value[0] : undefined
  }
}

// 对话框管理
function showAddProviderDialog() {
  newProvider.value = { name: '', icon: '📄', content: '' }
  showAddDialog.value = true
}

function hideAddProviderDialog() {
  showAddDialog.value = false
}

// 内容交互
function handleContentClick(event: Event) {
  const target = event.target as HTMLElement
  if (target.tagName === 'A') {
    const href = target.getAttribute('href')
    if (href && href.startsWith('http')) {
      event.preventDefault()
      window.open(href, '_blank')
    }
  }
}

function highlightCodeBlocks() {
  nextTick(() => {
    const codeBlocks = contentRef.value?.querySelectorAll('pre code')
    codeBlocks?.forEach((block) => {
      try {
        hljs.highlightElement(block as HTMLElement)
      } catch (err) {
        console.warn('Failed to highlight code block:', err)
      }
    })
  })
}

function scrollToHeading(slug: string) {
  const element = contentRef.value?.querySelector(`[id="${slug}"]`)
  if (element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    activeHeading.value = slug
  }
}

function setupScrollSpy() {
  const container = contentRef.value
  if (!container) return

  const headings = container.querySelectorAll('h1, h2, h3, h4, h5, h6')
  if (headings.length === 0) return

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.getAttribute('id')
          if (id) activeHeading.value = id
        }
      })
    },
    { root: container, rootMargin: '-80px 0px -80% 0px', threshold: 0 }
  )

  headings.forEach((heading) => observer.observe(heading))
}

function handleClose() {
  props.onClose()
}
</script>

<style lang="scss">
@use "./index.scss";
</style>
