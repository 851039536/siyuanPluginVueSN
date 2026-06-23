/**
 * 单词阅读功能模块
 */
import { Plugin } from "siyuan"
import {
  FlashcardReading,
  toggleFlashcardDialog,
} from "./FlashcardReading"

export { toggleFlashcardDialog }

/**
 * 注册单词阅读功能
 */
export function registerFlashcardReading(plugin: Plugin) {
  const flashcardReading = new FlashcardReading(plugin)
  flashcardReading.init();

  (plugin as any).__flashcardReading = flashcardReading

  return flashcardReading
}

