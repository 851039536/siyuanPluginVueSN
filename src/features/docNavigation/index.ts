import type { ProtyleLike } from "./types"
import { Plugin } from "siyuan"
import {
  createApp,
  h,
} from "vue"
import DocNavContainer from "./components/DocNavContainer.vue"
import {
  findNavigationTarget,
  removeExistingNav,
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
}

function updateDocNavigationDebounced(
  plugin: Plugin,
  settingsStorage: DocNavSettingsStorage,
  protyle: ProtyleLike,
) {
  if (!protyle?.block?.rootID || !protyle.element) return
  if (visibilityMap.get(protyle.element) === false) return

  const el = protyle.element
  const existing = timerMap.get(el)
  if (existing) clearTimeout(existing)
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

    removeExistingNav(protyle)

    const protyleRef = protyle as any
    if (protyleRef.__docNavApp) {
      protyleRef.__docNavApp.unmount()
      protyleRef.__docNavApp = null
    }

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

    if (target.method === "after") {
      target.el.after(container)
    } else {
      target.el.before(container)
    }
  } catch (error) {
    console.error("更新文档层级导航失败:", error)
  }
}
