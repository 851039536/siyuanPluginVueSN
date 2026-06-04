import { Plugin } from "siyuan"
import { PluginStorage } from "@/utils/pluginStorage"
import { TypedStorage } from "@/utils/typedStorage"

export interface WordQuerySettings {
  pronunciationType: "uk" | "us"
  autoPlayPronunciation: boolean
}

const DEFAULT_SETTINGS: WordQuerySettings = {
  pronunciationType: "uk",
  autoPlayPronunciation: false,
}

export class WordQueryStorage {
  readonly settings: TypedStorage<WordQuerySettings>

  constructor(plugin: Plugin) {
    const storage = new PluginStorage(plugin)
    this.settings = new TypedStorage(storage, "word-query-settings", DEFAULT_SETTINGS)
  }

  async init(): Promise<void> {
    const data = await this.settings.load()
    if (!data) {
      await this.settings.save(DEFAULT_SETTINGS)
    }
  }
}
