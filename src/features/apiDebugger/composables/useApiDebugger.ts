import type { Plugin } from "siyuan"
import type {
  Ref,
  ShallowRef,
} from "vue"
import type {
  ApiEndpointPreset,
  ApiRequestRecord,
  CustomHeader,
  HttpMethod,
} from "../types"
import {
  onMounted,
  onUnmounted,
  ref,
  shallowRef,
} from "vue"
import { SIYUAN_API_BASE_URL } from "@/api"
import {
  escapeHtml,
  getErrorMessage,
} from "@/utils/stringUtils"
import { isValidHttpMethod } from "../types"

import { ApiDebuggerStorage } from "../types/storage"

const INITIAL_STATE = {
  method: "POST" as HttpMethod,
  path: "",
  requestBody: "{}",
  statusCode: null as number | null,
  responseBody: "",
  responseTime: 0,
  errorMessage: "",
}

let recordSeq = 0

export function useApiDebugger(plugin: Plugin): {
  method: Ref<HttpMethod>
  path: Ref<string>
  requestBody: Ref<string>
  customHeaders: Ref<CustomHeader[]>
  loading: Ref<boolean>
  activeTab: Ref<"response" | "history">
  statusCode: Ref<number | null>
  responseBody: Ref<string>
  responseTime: Ref<number>
  errorMessage: Ref<string>
  history: ShallowRef<ApiRequestRecord[]>
  selectEndpoint: (preset: ApiEndpointPreset) => void
  addHeader: () => void
  removeHeader: (index: number) => void
  clearRequest: () => void
  sendRequest: () => Promise<void>
  replayRecord: (record: ApiRequestRecord) => void
  clearHistory: () => Promise<void>
  syntaxHighlight: (json: string) => string
} {
  const storage = new ApiDebuggerStorage(plugin)

  const method = ref(INITIAL_STATE.method)
  const path = ref(INITIAL_STATE.path)
  const requestBody = ref(INITIAL_STATE.requestBody)
  const customHeaders = ref<CustomHeader[]>([])
  const loading = ref(false)
  const activeTab = ref<"response" | "history">("response")
  const selectedEndpoint = ref<ApiEndpointPreset | null>(null)
  const statusCode = ref(INITIAL_STATE.statusCode)
  const responseBody = ref(INITIAL_STATE.responseBody)
  const responseTime = ref(INITIAL_STATE.responseTime)
  const errorMessage = ref(INITIAL_STATE.errorMessage)
  const history = shallowRef<ApiRequestRecord[]>([])

  let disposed = false

  onMounted(async () => {
    const data = await storage.settings.loadOrDefault()
    if (disposed) return
    history.value = data.history.filter((record) => isValidHttpMethod(record.method))
  })

  onUnmounted(() => {
    disposed = true
  })

  function selectEndpoint(preset: ApiEndpointPreset): void {
    selectedEndpoint.value = preset
    path.value = preset.path
    requestBody.value = preset.defaultBody
  }

  function addHeader(): void {
    customHeaders.value.push({
      key: "",
      value: "",
    })
  }

  function removeHeader(index: number): void {
    customHeaders.value.splice(index, 1)
  }

  function clearRequest(): void {
    method.value = INITIAL_STATE.method
    path.value = INITIAL_STATE.path
    requestBody.value = INITIAL_STATE.requestBody
    statusCode.value = INITIAL_STATE.statusCode
    responseBody.value = INITIAL_STATE.responseBody
    responseTime.value = INITIAL_STATE.responseTime
    errorMessage.value = INITIAL_STATE.errorMessage
    customHeaders.value = []
    selectedEndpoint.value = null
  }

  function createRecord(
    success: boolean,
    status: number,
    body: string,
    errMsg?: string,
  ): ApiRequestRecord {
    return {
      id: ++recordSeq,
      timestamp: Date.now(),
      method: method.value,
      path: path.value,
      requestBody: requestBody.value,
      headers: [...customHeaders.value],
      statusCode: status,
      responseBody: body,
      responseTime: responseTime.value,
      success,
      errorMessage: errMsg,
    }
  }

  async function sendRequest(): Promise<void> {
    if (!path.value.trim()) {
      errorMessage.value = "请输入请求路径"
      return
    }

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

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    }
    for (const h of customHeaders.value) {
      if (h.key.trim())
        headers[h.key.trim()] = h.value
    }

    const startTime = performance.now()

    try {
      const response = await fetch(`${SIYUAN_API_BASE_URL}${path.value}`, {
        method: method.value,
        headers,
        body: method.value !== "GET" ? requestBody.value : undefined,
      })

      responseTime.value = Math.round(performance.now() - startTime)
      statusCode.value = response.status

      const text = await response.text()
      try {
        responseBody.value = JSON.stringify(JSON.parse(text), null, 2)
      } catch {
        responseBody.value = text
      }

      let success = response.ok
      try {
        const json = JSON.parse(text)
        if (json.code !== undefined)
          success = json.code === 0
      } catch {}

      history.value = await storage.addRecord(createRecord(success, response.status, responseBody.value))
      activeTab.value = "response"
    } catch (err: unknown) {
      responseTime.value = Math.round(performance.now() - startTime)
      errorMessage.value = getErrorMessage(err) || "请求失败"
      statusCode.value = 0

      history.value = await storage.addRecord(createRecord(false, 0, "", getErrorMessage(err)))
      activeTab.value = "response"
    } finally {
      loading.value = false
    }
  }

  function replayRecord(record: ApiRequestRecord): void {
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

  async function clearHistory(): Promise<void> {
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
          cls = match.endsWith(":") ? "json-key" : "json-string"
        } else if (/true|false/.test(match)) {
          cls = "json-boolean"
        } else if (/null/.test(match)) {
          cls = "json-null"
        }
        return `<span class="${cls}">${escapeHtml(match)}</span>`
      },
    )
  }

  return {
    method,
    path,
    requestBody,
    customHeaders,
    loading,
    activeTab,
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
  }
}
