// 文档导航功能入口：监听 protyle 事件渲染层级导航栏，插件卸载时经 destroy() 统一销毁（observer/事件/Vue app/缓存）
import type { ProtyleLike } from "./types"
import { Plugin } from "siyuan"
import {
  createApp,
  h,
} from "vue"
import DocNavContainer from "./components/DocNavContainer.vue"
import {
  disposeCache,
  findNavigationTarget,
} from "./composables/useDocNavigation"
import {
  DEFAULT_NAV_SETTINGS,
  DEFAULT_OPTIONS,
} from "./types"
import { DocNavSettingsStorage } from "./types/storage"
import "./styles/index.scss"

const timerMap = new WeakMap<Element, ReturnType<typeof setTimeout>>()
const visibilityMap = new WeakMap<Element, boolean>()
const observer = new IntersectionObserver(
  (entries) => {
    for (const entry of entries) {
      visibilityMap.set(entry.target, entry.isIntersecting)
    }
  },
  { threshold: 0 },
)
/** 跟踪所有进入导航流程的 protyle 对象，插件卸载时统一清理 timer / Vue app / DOM 容器 */
const mountedProtyles = new Set<ProtyleLike>()

export function registerDocNavigation(plugin: Plugin) {
  const settingsStorage = new DocNavSettingsStorage(plugin)

  const handleEvent = (e: CustomEvent) => {
    updateDocNavigationDebounced(
      plugin,
      settingsStorage,
      (e.detail as { protyle: ProtyleLike }).protyle,
    )
  };

  ["switch-protyle", "loaded-protyle-dynamic", "loaded-protyle-static"].forEach(
    (event) => {
      plugin.eventBus.on(event as any, handleEvent)
    },
  )

  /** 清理函数挂载到 plugin 实例，供 onunload 经 DESTROYABLE_KEYS 统一销毁 */
  const instance = {
    destroy() {
      // 1. 释放 IntersectionObserver 对已观测元素的引用
      observer.disconnect()
      // 2. 解绑事件监听，避免插件重载时监听器累积
      plugin.eventBus.off("switch-protyle" as any, handleEvent)
      plugin.eventBus.off("loaded-protyle-dynamic" as any, handleEvent)
      plugin.eventBus.off("loaded-protyle-static" as any, handleEvent)
      // 3. 逐个清理已挂载的导航实例：清定时器 + 卸载 Vue app + 移除容器 DOM
      for (const protyle of mountedProtyles) {
        const el = protyle.element
        if (el && timerMap.has(el)) {
          clearTimeout(timerMap.get(el))
          timerMap.delete(el)
        }
        const ref = protyle as any
        ref.__docNavApp?.unmount()
        ref.__docNavApp = null
        ref.__docNavDocId = null
        ref.__docNavContainer?.remove()
        ref.__docNavContainer = null
      }
      mountedProtyles.clear()
      // visibilityMap 为 WeakMap，键（DOM Element）为弱引用，随元素被 GC 自动回收，无需手动清理
      // 4. 清空文档层级/面包屑/同级数据缓存
      disposeCache()
    },
  }
  ;(plugin as any).__docNavigation = instance
  return instance
}

function updateDocNavigationDebounced(
  plugin: Plugin,
  settingsStorage: DocNavSettingsStorage,
  protyle: ProtyleLike,
) {
  if (!protyle?.block?.rootID || !protyle.element) return
  // visibilityMap 未观测到该元素时返回 undefined（与 false 严格不等），不拦截首次渲染；
  // 仅拦截已确认不可见（=== false）的文档，避免为隐藏编辑器做无意义渲染
  if (visibilityMap.get(protyle.element) === false) return

  const el = protyle.element
  const existing = timerMap.get(el)
  if (existing) clearTimeout(existing)
  // 记录已进入导航流程的 protyle，插件卸载时可统一清理 timer 与挂载实例
  mountedProtyles.add(protyle)
  timerMap.set(
    el,
    setTimeout(
      () => updateDocNavigation(plugin, settingsStorage, protyle),
      DEFAULT_OPTIONS.debounceDelay,
    ),
  )
}

async function updateDocNavigation(
  plugin: Plugin,
  settingsStorage: DocNavSettingsStorage,
  protyle: ProtyleLike,
) {
  try {
    const docId = protyle.block!.rootID

    const settings = await settingsStorage.settings.loadOrDefault()
    const position = settings.position ?? DEFAULT_NAV_SETTINGS.position

    const target = findNavigationTarget(protyle, position)
    if (!target) return

    const protyleRef = protyle as any
    if (protyleRef.__docNavApp && protyleRef.__docNavDocId === docId) {
      // 同一 protyle 同一文档重复触发（如块内焦点切换、编辑器重绘）时导航栏已挂载，
      // 直接复用避免卸载重建造成页面跳动/闪烁
      return
    }
    if (protyleRef.__docNavApp) {
      // 切换到另一文档时先卸载旧 app，容器 DOM 会被复用于后续挂载
      protyleRef.__docNavApp.unmount()
      protyleRef.__docNavApp = null
    }
    protyleRef.__docNavDocId = docId

    let container = protyleRef.__docNavContainer
    if (!container) {
      container = document.createElement("div")
      protyleRef.__docNavContainer = container
    }

    if (protyle.element) {
      observer.observe(protyle.element)
    }

    const app = createApp({
      setup() {
        return () =>
          h(DocNavContainer, {
            docId,
            plugin,
          })
      },
    })

    app.mount(container)
    protyleRef.__docNavApp = app
    mountedProtyles.add(protyle)

    if (target.method === "after") {
      target.el.after(container)
    } else {
      target.el.before(container)
    }
  } catch (error) {
    console.error("更新文档层级导航失败:", error)
  }
}
