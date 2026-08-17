/**
 * RSS文章朗读组合式函数 - 使用浏览器 speechSynthesis 朗读文章
 */
import {
  onBeforeUnmount,
  ref,
} from "vue"

export function useTtsReader() {
  const ttsPlaying = ref(false)

  function speakArticle(item: { title?: string, content?: string, description?: string }) {
    if (ttsPlaying.value) {
      window.speechSynthesis.cancel()
      ttsPlaying.value = false
      return
    }
    const text = [item.title, item.content || item.description].filter(Boolean).join(". ")
    if (!text) return
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = "zh-CN"
    utterance.rate = 1.0
    utterance.onend = () => { ttsPlaying.value = false }
    utterance.onerror = () => { ttsPlaying.value = false }
    ttsPlaying.value = true
    window.speechSynthesis.speak(utterance)
  }

  onBeforeUnmount(() => {
    window.speechSynthesis.cancel()
    ttsPlaying.value = false
  })

  return {
    ttsPlaying,
    speakArticle,
  }
}
