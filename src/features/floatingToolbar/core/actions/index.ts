import type { ToolbarAction } from "../../types"
import { Plugin } from "siyuan"
import { createDialogAction } from "../utils"

export { createTranslateAction } from "./translate"

export function createPronunciationAction(plugin: Plugin): ToolbarAction {
  return createDialogAction(plugin, {
    id: "pronunciation",
    i18nKey: "pronunciation",
    defaultMessage: "谐音翻译",
    icon: `<svg><use xlink:href="#iconSparkles"></use></svg>`,
    eventName: "openPronunciationDialog",
  })
}

const QRCODE_ICON = `<svg viewBox="0 0 24 24" width="14" height="14">
    <path fill="currentColor" d="M3,11H11V3H3M5,5H9V9H5M13,3V11H21V3M19,9H15V5H19M3,21H11V13H3M5,15H9V19H5M18,13H16V15H13V18H15V21H18V18H21V15H18M21,21H19V19H21V21Z"/>
</svg>`

export function createQRCodeAction(plugin: Plugin): ToolbarAction {
  return createDialogAction(plugin, {
    id: "qrcode",
    i18nKey: "qrcode",
    defaultMessage: "生成二维码",
    icon: QRCODE_ICON,
    eventName: "openQRCodeDialog",
  })
}
