/**
 * Iconify 离线图标预加载
 * 在插件入口调用，将 mdi + ph 图标数据注入 @iconify/vue 内部注册表，
 * 之后所有 <Icon> 组件不再依赖 CDN，断网也能正常渲染。
 */
import { addCollection } from "@iconify/vue"
import mdiIcons from "@iconify-json/mdi/icons.json"
import phIcons from "@iconify-json/ph/icons.json"

let loaded = false

export function setupIconifyOffline() {
  if (loaded) return
  addCollection(mdiIcons as any)
  addCollection(phIcons as any)
  loaded = true
}
