import { Plugin } from 'siyuan'
import { createApp, h } from 'vue'
import DocNavContainer from './components/DocNavContainer.vue'
import { findNavigationTarget, removeExistingNav } from './composables/useDocNavigation'
import type { ProtyleLike } from './types'
import { DEFAULT_OPTIONS } from './types'

export type { Block, DocHierarchy, DocNavigationOptions, DocNavigationI18n, ProtyleLike, BreadcrumbItem, SiblingDocs } from './types'
export { DocNavigationCache, fetchDocHierarchy, fetchBreadcrumb, fetchSiblingDocs } from './types/storage'
export { useDocNavigation } from './composables/useDocNavigation'

import './styles/index.scss'

let updateTimer: ReturnType<typeof setTimeout> | null = null

export function registerDocNavigation(plugin: Plugin) {
  const handleEvent = (e: CustomEvent) => {
    updateDocNavigationDebounced(plugin, (e.detail as { protyle: ProtyleLike }).protyle)
  }

  ;['switch-protyle', 'loaded-protyle-dynamic', 'loaded-protyle-static'].forEach(event => {
    plugin.eventBus.on(event as any, handleEvent)
  })
}

function updateDocNavigationDebounced(plugin: Plugin, protyle: ProtyleLike) {
  if (!protyle?.block?.rootID) return

  updateTimer && clearTimeout(updateTimer)
  updateTimer = setTimeout(() => updateDocNavigation(plugin, protyle), DEFAULT_OPTIONS.debounceDelay)
}

async function updateDocNavigation(plugin: Plugin, protyle: ProtyleLike) {
  try {
    const docId = protyle?.block?.rootID
    if (!docId) return

    const target = findNavigationTarget(protyle)
    if (!target) return

    removeExistingNav(protyle)

    const protyleRef = protyle as any
    if (protyleRef.__docNavApp) {
      protyleRef.__docNavApp.unmount()
      protyleRef.__docNavApp = null
    }

    let container = protyleRef.__docNavContainer
    if (!container) {
      container = document.createElement('div')
      protyleRef.__docNavContainer = container
    }

    const app = createApp({
      setup() {
        return () => h(DocNavContainer, {
          docId: docId,
        })
      }
    })

    app.mount(container)
    protyleRef.__docNavApp = app

    if (target.method === 'after') {
      target.el.after(container)
    } else {
      target.el.before(container)
    }
  } catch (error) {
    console.error('更新文档层级导航失败:', error)
  }
}
