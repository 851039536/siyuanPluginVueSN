import { Plugin } from "siyuan"
import { WebsiteNavigation } from "./types"

export function registerWebsiteNavigation(plugin: Plugin) {
  const websiteNavigation = new WebsiteNavigation(plugin)
  websiteNavigation.init();

  (plugin as any).__websiteNavigation = websiteNavigation

  return websiteNavigation
}

export * from "./types"
