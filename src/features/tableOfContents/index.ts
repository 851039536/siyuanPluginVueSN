/**
 * 目录索引功能模块
 */
import { Plugin } from "siyuan";
import { TableOfContentsManager } from "./types";

/**
 * 注册目录索引插件功能
 */
export function registerTableOfContents(plugin: Plugin) {
  const manager = new TableOfContentsManager(plugin);
  manager.init();
  (plugin as any).__tableOfContents = manager;
  return manager;
}

export * from "./types";
