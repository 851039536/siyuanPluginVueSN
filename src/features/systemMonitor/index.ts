import { Plugin } from 'siyuan'
import { createApp } from 'vue'
import SystemMonitorPanel from './SystemMonitorPanel.vue'
import './index.scss'

let app: ReturnType<typeof createApp> | null = null

export function registerSystemMonitor(plugin: Plugin) {
  const container = document.createElement('div')
  app = createApp(SystemMonitorPanel)
  app.mount(container)
}

export function unregisterSystemMonitor() {
  if (app) {
    app.unmount()
    app = null
  }
}
