import type { Plugin } from "siyuan"
import type {
  ApiEndpointPreset,
  ApiRequestRecord,
  CustomHeader,
  HttpMethod,
} from "../types"

import {
  onMounted,
  ref,
  shallowRef,
} from "vue"
import { SIYUAN_API_BASE_URL } from "@/api"

import { ApiDebuggerStorage } from "../types/storage"

export function useApiDebugger(plugin: Plugin) {
  const storage = new ApiDebuggerStorage(plugin)

  const method = ref<HttpMethod>("POST")
  const path = ref("")
  const requestBody = ref("{}")
  const customHeaders = ref<CustomHeader[]>([])
  const loading = ref(false)
  const activeTab = ref<"response" | "history">("response")
  const selectedEndpoint = ref<ApiEndpointPreset | null>(null)

  const statusCode = ref<number | null>(null)
  const responseBody = ref("")
  const responseTime = ref(0)
  const errorMessage = ref("")

  const history = shallowRef<ApiRequestRecord[]>([])

  async function loadHistory() {
    history.value = await storage.loadHistory()
  }

  function selectEndpoint(preset: ApiEndpointPreset) {
    selectedEndpoint.value = preset
    path.value = preset.path
    requestBody.value = preset.defaultBody
  }

  function addHeader() {
    customHeaders.value.push({
      key: "",
      value: "",
    })
  }

  function removeHeader(index: number) {
    customHeaders.value.splice(index, 1)
  }

  function clearRequest() {
    method.value = "POST"
    path.value = ""
    requestBody.value = "{}"
    customHeaders.value = []
    selectedEndpoint.value = null
    statusCode.value = null
    responseBody.value = ""
    responseTime.value = 0
    errorMessage.value = ""
  }

  async function sendRequest() {
    if (!path.value.trim()) {
      errorMessage.value = "请输入请求路径"
      return
    }

    // Validate JSON body
    try {
      JSON.parse(requestBody.value)
    } catch {
      errorMessage.value = "请求体JSON格式错误"
      return
    }

    loading.value = true
    errorMessage.value = ""
    statusCode.value = null
    responseBody.value = ""
    responseTime.value = 0

    const url = `${SIYUAN_API_BASE_URL}${path.value}`
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }

    // Add custom headers
    for (const h of customHeaders.value) {
      if (h.key.trim()) {
        headers[h.key.trim()] = h.value
      }
    }

    const startTime = performance.now()

    try {
      const response = await fetch(url, {
        method: method.value,
        headers,
        body: method.value !== "GET" ? requestBody.value : undefined,
      })

      const endTime = performance.now()
      responseTime.value = Math.round(endTime - startTime)
      statusCode.value = response.status

      const text = await response.text()
      try {
        responseBody.value = JSON.stringify(JSON.parse(text), null, 2)
      } catch {
        responseBody.value = text
      }

      // Parse Siyuan convention: code === 0 means success
      let success = response.ok
      try {
        const json = JSON.parse(text)
        if (json.code !== undefined) {
          success = json.code === 0
        }
      } catch {}

      const record: ApiRequestRecord = {
        id: Date.now(),
        timestamp: Date.now(),
        method: method.value,
        url,
        path: path.value,
        requestBody: requestBody.value,
        headers: [...customHeaders.value],
        statusCode: response.status,
        responseBody: responseBody.value,
        responseTime: responseTime.value,
        success,
      }

      await storage.addRecord(record)
      await loadHistory()
      activeTab.value = "response"
    } catch (err: any) {
      const endTime = performance.now()
      responseTime.value = Math.round(endTime - startTime)
      errorMessage.value = err.message || "请求失败"
      statusCode.value = 0

      const record: ApiRequestRecord = {
        id: Date.now(),
        timestamp: Date.now(),
        method: method.value,
        url,
        path: path.value,
        requestBody: requestBody.value,
        headers: [...customHeaders.value],
        statusCode: 0,
        responseBody: "",
        responseTime: responseTime.value,
        success: false,
        errorMessage: err.message,
      }

      await storage.addRecord(record)
      await loadHistory()
      activeTab.value = "response"
    } finally {
      loading.value = false
    }
  }

  function replayRecord(record: ApiRequestRecord) {
    method.value = record.method
    path.value = record.path
    requestBody.value = record.requestBody
    customHeaders.value = [...record.headers]
    statusCode.value = record.statusCode
    responseBody.value = record.responseBody
    responseTime.value = record.responseTime
    errorMessage.value = record.errorMessage || ""
    activeTab.value = "response"
  }

  async function clearHistory() {
    await storage.clearHistory()
    history.value = []
  }

  function syntaxHighlight(json: string): string {
    if (!json) return ""
    return json.replace(
      /("(\\u[\da-fA-F]{4}|\\[^u]|[^\\"])*"(\s*:)?|\b(true|false|null)\b|-?\d+(?:\.\d*)?(?:[eE][+-]?\d+)?)/g,
      (match) => {
        let cls = "json-number"
        if (match.startsWith('"')) {
          if (match.endsWith(':')) {
            cls = "json-key"
          } else {
            cls = "json-string"
          }
        } else if (/true|false/.test(match)) {
          cls = "json-boolean"
        } else if (/null/.test(match)) {
          cls = "json-null"
        }
        return `<span class="${cls}">${match}</span>`
      },
    )
  }

  async function copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // Fallback
      const textarea = document.createElement("textarea")
      textarea.value = text
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand("copy")
      document.body.removeChild(textarea)
      return true
    }
  }

  onMounted(() => loadHistory())

  return {
    method,
    path,
    requestBody,
    customHeaders,
    loading,
    activeTab,
    selectedEndpoint,
    statusCode,
    responseBody,
    responseTime,
    errorMessage,
    history,
    selectEndpoint,
    addHeader,
    removeHeader,
    clearRequest,
    sendRequest,
    replayRecord,
    clearHistory,
    syntaxHighlight,
    copyToClipboard,
  }
}
