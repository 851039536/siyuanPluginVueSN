/**
 * RSS文章朗读组合式函数 - 使用浏览器 speechSynthesis 朗读文章
 */
import {
  onBeforeUnmount,
  ref,
} from "vue"

/** 语音合成可用性：部分移动端 WebView 未实现 speechSynthesis，调用会抛异常 */
const ttsSupported = typeof window !== "undefined"
  && typeof window.speechSynthesis !== "undefined"
  && typeof window.SpeechSynthesisUtterance !== "undefined"

export function useTtsReader() {
  const ttsPlaying = ref(false)

  function speakArticle(item: { title?: string, content?: string, description?: string }) {
    if (!ttsSupported) return
    if (ttsPlaying.value) {
      try {
        window.speechSynthesis.cancel()
      } catch {
        // speechSynthesis 不可用时静默忽略
      }
      ttsPlaying.value = false
      return
    }
    const text = [item.title, item.content || item.description].filter(Boolean).join(". ")
    if (!text) return
    try {
      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = "zh-CN"
      utterance.rate = 1.0
      utterance.onend = () => { ttsPlaying.value = false }
      utterance.onerror = () => { ttsPlaying.value = false }
      ttsPlaying.value = true
      window.speechSynthesis.speak(utterance)
    } catch (error) {
      console.error("[rssReader] 朗读失败:", error)
      ttsPlaying.value = false
    }
  }

  onBeforeUnmount(() => {
    if (ttsSupported) {
      try {
        window.speechSynthesis.cancel()
      } catch {
        // speechSynthesis 不可用时静默忽略
      }
    }
    ttsPlaying.value = false
  })

  return {
    ttsPlaying,
    ttsSupported,
    speakArticle,
  }
}
