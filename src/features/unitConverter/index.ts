import { createApp, h } from 'vue'
import type PluginSample from '@/index'
import UnitConverter from './UnitConverter.vue'

/**
 * 注册单位转换功能
 */
export const registerUnitConverter = (plugin: PluginSample) => {
  const self = plugin

  plugin.addDock({
    config: {
      position: 'RightTop',
      size: { width: 360, height: 0 },
      icon: 'iconList',
      title: plugin.i18n.unitConverter || '单位转换',
      show: false,
    },
    data: {},
    type: 'unit-converter-dock',
    init: (dock: any) => {
      const container = document.createElement('div')
      container.style.height = '100%'
      container.style.overflow = 'hidden'

      const app = createApp({
        setup() {
          return () => h(UnitConverter, {
            i18n: self.i18n || {}
          })
        }
      })

      app.mount(container)
      dock.element?.appendChild(container)

      dock.__app = app
      dock.__container = container
    },
  })
}
