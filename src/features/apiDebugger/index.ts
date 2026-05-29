import type { Plugin } from "siyuan"

import { createVueDockApp } from "@/utils/vueAppHelper"

import ApiDebuggerPanel from "./index.vue"

export function registerApiDebugger(plugin: Plugin): void {
  createVueDockApp(plugin, ApiDebuggerPanel, {
    icon: "iconAPI",
    title: (plugin.i18n as any).apiDebugger?.panelTitle || "API调试器",
    type: "api-debugger-dock",
    width: 420,
    i18n: (plugin.i18n as any).apiDebugger || {},
  })
}
