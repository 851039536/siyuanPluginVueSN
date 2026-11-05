/**
 * 平台判断：基于思源 getFrontend() 区分桌面端与移动端
 */
import { getFrontend } from "siyuan"

/** 是否移动端（思源移动 App = mobile，移动浏览器 = browser-mobile） */
export function isMobileFrontend(): boolean {
  const frontend = getFrontend()
  return frontend === "mobile" || frontend === "browser-mobile"
}
