/**
 * HTML展示 - 预览与格式处理 composable
 */
import type { Ref } from "vue"
import { ref, watch } from "vue"
import { jsonToHtml } from "../utils/jsonFormatter"
import { wrapWithBaseStyles } from "../utils/htmlStyles"

export function useHtmlPreview(htmlContent: Ref<string>) {
  const isJsonFormatted = ref(false)
  const previewHtml = ref("")
  let previewTimer: ReturnType<typeof setTimeout> | null = null

  function buildPreviewHtml(): string {
    let content: string = htmlContent.value
    if (isJsonFormatted.value && content.trim()) {
      const result = jsonToHtml(content)
      if (!result.error) content = result.html
    }
    return wrapWithBaseStyles(content)
  }

  watch(
    [htmlContent, isJsonFormatted],
    () => {
      if (previewTimer) clearTimeout(previewTimer)
      previewTimer = setTimeout(() => {
        previewHtml.value = buildPreviewHtml()
      }, 300)
    },
    { immediate: true },
  )

  function clearPreviewTimer() {
    if (previewTimer) clearTimeout(previewTimer)
  }

  return { isJsonFormatted, previewHtml, clearPreviewTimer }
}
