import type { ToolbarAction } from "../../types"
import { Plugin } from "siyuan"
import { createDialogAction } from "../utils"

const LOCK_ICON = `<svg viewBox="0 0 24 24" width="14" height="14">
    <path fill="currentColor" d="M12,17A2,2 0 0,0 14,15C14,13.89 13.1,13 12,13A2,2 0 0,0 10,15A2,2 0 0,0 12,17M18,8A2,2 0 0,1 20,10V20A2,2 0 0,1 18,22H6A2,2 0 0,1 4,20V10C4,8.89 4.9,8 6,8H7V6A5,5 0 0,1 12,1A5,5 0 0,1 17,6V8H18M12,3A3,3 0 0,0 9,6V8H15V6A3,3 0 0,0 12,3Z"/>
</svg>`

/** 格式提示（追加到 tooltip name 中展示） */
const FORMAT_HINT = "\n名称 账号 密码 | 名称:账号:密码 | 名称-账号-密码"

export function createPasswordVaultAction(plugin: Plugin): ToolbarAction {
  const action = createDialogAction(plugin, {
    id: "save-password",
    i18nKey: "savePassword",
    defaultMessage: "存密码",
    icon: LOCK_ICON,
    eventName: "openPasswordVaultAdd",
  })

  // 追加格式提示到 tooltip（aria-label）
  action.name += FORMAT_HINT

  return action
}
