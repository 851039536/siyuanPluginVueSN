import {
  Plugin,
} from "siyuan";
import { createApp } from 'vue'
import App from './App.vue'
import type PluginSample from '@/index'
import 'highlight.js/styles/github-dark.css'
import PrimeVue from 'primevue/config';
import Aura from '@primeuix/themes/aura';

let plugin: Plugin | null = null
export function usePlugin(pluginProps?: Plugin): Plugin {
  console.log('usePlugin', pluginProps, plugin)
  if (pluginProps) {
    plugin = pluginProps
  }
  if (!plugin && !pluginProps) {
    console.error('need bind plugin')
  }
  return plugin as Plugin;
}


let app = null
export function init(pluginInstance: Plugin) {
  // bind plugin hook
  usePlugin(pluginInstance);

  // 初始化时应用紧凑模式
  const pluginSample = pluginInstance as PluginSample
  if (pluginSample.settings?.compactMode) {
    document.documentElement.classList.add('siyuan-compact-mode')
  }

  const div = document.createElement('div')
  div.classList.toggle('siyuan-plugin-vite-vue-sn-app')
  div.id = pluginInstance.name
  app = createApp(App)
  app.mount(div)
  app.use(PrimeVue, {
    theme: {
        preset: Aura
    }
});
  document.body.appendChild(div)
}

export function destroy() {
  app.unmount()
  const div = document.getElementById(this.name)
  document.body.removeChild(div)
}
