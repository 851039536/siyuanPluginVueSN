/**
 * kit/iconify.ts —— 图标数据离线注册（自包含迁移的组成部分）
 *
 * 把 mdi 图标集注入 @iconify/vue 的内部注册表，使 <Icon icon="mdi:*"> 完全离线可用。
 * 未注册时 @iconify/vue 会转而请求 api.iconify.design，断网/内网环境下图标全部
 * 空白且不报错，是最容易漏、症状最迷惑的一步。
 *
 * 组件库只使用 mdi 图标集（kit/icons.ts 内 100% 为 mdi:*），因此这里仅注册 mdi；
 * ph 等其他图标集由宿主项目按需自行注册（本仓库见 src/utils/iconifySetup.ts）。
 *
 * 由 IconWrapper.vue 以副作用导入（import "./kit/iconify"）触发 —— 图标数据只在
 * 真正用到图标的产物中出现，纯展示类组件不会被迫打包整套 mdi 数据。模块级幂等。
 */

import mdiIcons from "@iconify-json/mdi/icons.json"
import { addCollection } from "@iconify/vue"

let registered = false

/** 注册 mdi 图标集（幂等；重复调用无副作用） */
export function setupKitIcons(): void {
  if (registered)
    return
  addCollection(mdiIcons as any)
  registered = true
}

// 副作用：被 IconWrapper import 时自动注册一次
setupKitIcons()
