/**
 * RSS订阅功能 - 数据存储
 */
import type { Plugin } from "siyuan"
import type {
  RssFeed,
  RssItem,
  RssSettings,
} from "./index"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"
import { DEFAULT_RSS_SETTINGS } from "./index"

export class RssStorage {
  readonly settings: TypedStorage<RssSettings>
  readonly feeds: TypedStorage<RssFeed[]>
  readonly items: TypedStorage<RssItem[]>

  private storage: PluginStorage

  constructor(plugin: Plugin) {
    this.storage = new PluginStorage(plugin)
    this.settings = new TypedStorage<RssSettings>(
      this.storage,
      "rssReader-settings",
      DEFAULT_RSS_SETTINGS,
    )
    this.feeds = new TypedStorage<RssFeed[]>(
      this.storage,
      "rssReader-feeds",
      [],
    )
    this.items = new TypedStorage<RssItem[]>(
      this.storage,
      "rssReader-items",
      [],
    )
  }

  async init() {
    const [settings, feeds, items] = await Promise.all([
      this.settings.loadOrDefault(),
      this.feeds.loadOrDefault(),
      this.items.loadOrDefault(),
    ])
    return {
      settings,
      feeds,
      items,
    }
  }
}
