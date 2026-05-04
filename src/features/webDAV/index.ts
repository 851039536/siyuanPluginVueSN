import type { App as VueApp } from "vue"
import type { WebDAVConfig } from "@/config/settings"
/**
 * WebDAV功能模块
 * 提供WebDAV服务器连接和数据同步功能
 */
import { Plugin } from "siyuan"
import { createApp } from "vue"
import WebDAVPanel from "./WebDAVPanel.vue"

let webdavApp: VueApp | null = null
let panelContainer: HTMLElement | null = null

/**
 * 注册WebDAV功能
 */
export function registerWebDAV(plugin: Plugin) {
  window.addEventListener("openWebDAV", () => {
    openWebDAVPanel(plugin)
  })

  window.addEventListener("closeWebDAV", () => {
    closeWebDAVPanel()
  })

  window.addEventListener("updateWebDAVConfig", async (event: CustomEvent) => {
    await handleUpdateConfig(plugin, event.detail.config)
  })
}

/**
 * 打开WebDAV面板
 */
function openWebDAVPanel(plugin: Plugin) {
  if (webdavApp && panelContainer) {
    closeWebDAVPanel()
    return
  }

  panelContainer = document.createElement("div")
  panelContainer.id = "webdav-panel-container"
  document.body.appendChild(panelContainer)

  const pluginSample = plugin as any
  const i18n = (plugin.i18n as any).webDAV || {}

  webdavApp = createApp(WebDAVPanel, {
    config: pluginSample.settings.webdavConfig || getDefaultConfig(),
    i18n,
  })

  webdavApp.mount(panelContainer)
}

/**
 * 关闭WebDAV面板
 */
function closeWebDAVPanel() {
  if (webdavApp && panelContainer) {
    webdavApp.unmount()
    panelContainer.remove()
    webdavApp = null
    panelContainer = null
  }
}

/**
 * 获取默认配置
 */
function getDefaultConfig(): WebDAVConfig {
  return {
    serverUrl: "",
    username: "",
    password: "",
    basePath: "/",
    autoSync: false,
    syncInterval: 30,
    lastSyncTime: "",
  }
}

/**
 * 处理配置更新
 */
async function handleUpdateConfig(plugin: Plugin, config: WebDAVConfig) {
  const pluginSample = plugin as any

  const newSettings = {
    ...pluginSample.settings,
    webdavConfig: config,
  }

  await pluginSample.updateSettings(newSettings)
}

/**
 * 测试WebDAV连接
 */
export async function testWebDAVConnection(
  serverUrl: string,
  username: string,
  password: string,
): Promise<boolean> {
  if (!serverUrl) {
    return false
  }

  try {
    const url = new URL(serverUrl)
    const response = await fetch(url.toString(), {
      method: "PROPFIND",
      headers: {
        "Authorization": `Basic ${btoa(`${username}:${password}`)}`,
        "Depth": "0",
        "Content-Type": "application/xml",
      },
    })

    return response.ok || response.status === 207
  } catch {
    return false
  }
}

/**
 * 执行WebDAV同步
 */
export async function performWebDAVSync(
  serverUrl: string,
  username: string,
  password: string,
  _basePath: string = "/",
): Promise<{ success: boolean, message: string }> {
  if (!serverUrl || !username) {
    return {
      success: false,
      message: "请先配置WebDAV服务器",
    }
  }

  try {
    const url = new URL(serverUrl)
    const response = await fetch(url.toString(), {
      method: "PROPFIND",
      headers: {
        "Authorization": `Basic ${btoa(`${username}:${password}`)}`,
        "Depth": "1",
        "Content-Type": "application/xml",
      },
    })

    if (response.ok || response.status === 207) {
      return {
        success: true,
        message: "同步成功",
      }
    } else {
      return {
        success: false,
        message: `同步失败: ${response.status}`,
      }
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : "同步失败",
    }
  }
}
