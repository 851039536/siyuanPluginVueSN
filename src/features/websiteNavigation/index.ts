import type { Plugin } from "siyuan"
import { WebsiteNavigation } from "./types"

export function registerWebsiteNavigation(plugin: Plugin) {
  const websiteNavigation = new WebsiteNavigation(plugin)
  websiteNavigation.init()
}

