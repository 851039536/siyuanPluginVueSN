// dataSnapshot 功能注册入口与 Dock 面板创建
import type { Plugin } from "siyuan"
import { createVueDockApp } from "@/utils/vueAppHelper"
import DataSnapshotPanel from "./index.vue"
import { getDataSnapshotI18n } from "./types/i18n"

export function registerDataSnapshot(plugin: Plugin) {
  plugin.addIcons(
    `<symbol id="iconCameraMarker" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/><path d="M18 2l2 2-2 2"/><path d="M22 2l-2 2 2 2"/></symbol>`,
  )

  // 标题以 i18n 为唯一数据源（禁止硬编码兜底），缺失时留空由思源按默认样式展示
  createVueDockApp(plugin, DataSnapshotPanel, {
    icon: "iconCameraMarker",
    title: getDataSnapshotI18n(plugin).title ?? "",
    type: "data-snapshot-dock",
    width: 400,
  })
}
