// 当前文档资源 composable：获取活动编辑器文档 ID 并加载其引用的资源列表（含文件大小）
import type { AssetInfo } from "@/api"
import { getAllEditor } from "siyuan"
import { ref, shallowRef } from "vue"
import { getDocAssets } from "@/api"

/** 活动编辑器最小结构（仅声明本文件用到的字段） */
interface EditorLike {
  protyle?: {
    block?: { rootID?: string }
    element?: Element
    title?: { editElement?: HTMLElement }
  }
}

/** 取活动文档：优先命中活动窗口内的编辑器，否则取首个打开的编辑器 */
function getActiveDoc(): { id: string, title: string } | null {
  const editors = getAllEditor() as unknown as EditorLike[]
  if (!editors.length) return null
  const active = editors.find((e) => e.protyle?.element?.closest?.(".layout__wnd--active")) ?? editors[0]
  const protyle = active.protyle
  const id = protyle?.block?.rootID
  if (!id) return null
  const title = protyle?.title?.editElement?.textContent?.trim() ?? ""
  return { id, title }
}

/** 文档资源页签的独立状态与加载逻辑（错误以标志位内联展示，不依赖 toast） */
export function useDocAssets() {
  // 资源列表无需深层响应式
  const docAssets = shallowRef<AssetInfo[]>([])
  const loading = ref(false)
  const noActiveDoc = ref(false)
  const loadError = ref(false)
  const docTitle = ref("")

  async function loadDocAssets() {
    loadError.value = false
    const doc = getActiveDoc()
    if (!doc) {
      noActiveDoc.value = true
      docAssets.value = []
      docTitle.value = ""
      return
    }
    noActiveDoc.value = false
    docTitle.value = doc.title
    loading.value = true
    try {
      const result = await getDocAssets(doc.id)
      docAssets.value = result?.assets ?? []
    }
    catch (e: unknown) {
      console.error("加载文档资源失败:", e)
      docAssets.value = []
      loadError.value = true
    }
    finally {
      loading.value = false
    }
  }

  return { docAssets, loading, noActiveDoc, loadError, docTitle, loadDocAssets }
}
