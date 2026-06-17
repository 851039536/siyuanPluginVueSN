import type { Plugin } from "siyuan"
import { createModalVueApp } from "@/utils/vueAppHelper"
import type { ModalAppInstance } from "@/utils/vueAppHelper"
import Prompts from "../components/PromptsModal.vue"
import type { FloatingTool } from "../types"

let modal: ModalAppInstance | null = null

function getI18nMap(plugin: Plugin) {
  const m = (plugin.i18n?.skills as unknown as Record<string, any>) || {}
  return {
    promptsTitle: m.modal?.title || "提示词库",
    close: m.modal?.close || "关闭",
    addPrompt: m.modal?.addPrompt || "添加提示词",
    delete: m.modal?.delete || "删除",
    edit: m.modal?.edit || "编辑",
    search: m.modal?.search || "搜索提示词...",
    title: m.modal?.titleLabel || "标题",
    description: m.modal?.description || "描述",
    content: m.modal?.content || "内容",
    cancel: m.modal?.cancel || "取消",
    save: m.modal?.save || "保存",
    titlePlaceholder: m.modal?.titlePlaceholder || "请输入提示词标题",
    descriptionPlaceholder: m.modal?.descriptionPlaceholder || "请输入提示词描述",
    contentPlaceholder: m.modal?.contentPlaceholder || "请输入提示词内容",
    noPrompts: m.modal?.noPrompts || "暂无提示词，点击添加",
    noPromptsFound: m.modal?.noPromptsFound || "未找到匹配的提示词",
    clickToCopy: m.modal?.clickToCopy || "复制",
    contents: m.modal?.contents || "内容块",
    contentLabel: m.modal?.contentLabel || "内容标签",
    contentLabelPlaceholder: m.modal?.contentLabelPlaceholder || "内容标签",
    addContentBlock: m.modal?.addContentBlock || "添加内容块",
    moveUp: m.modal?.moveUp || "上移",
    moveDown: m.modal?.moveDown || "下移",
    removeContent: m.modal?.removeContent || "删除内容块",
    manageCategories: m.modal?.manageCategories || "管理分类",
    add: m.modal?.add || "添加",
    categoryName: m.modal?.categoryName || "分类名称",
    category: m.modal?.category || "分类",
    loading: m.modal?.loading || "加载中...",
    editPrompt: m.modal?.editPrompt || "编辑提示词",
  }
}

function showPromptsModal(plugin: Plugin) {
  if (!modal) {
    modal = createModalVueApp(Prompts, {
      maskId: "prompts-modal-mask",
      width: "80vw",
      height: "80vh",
      getCloseHandler: () => () => modal?.close(),
      buildProps: () => ({
        i18n: getI18nMap(plugin),
        plugin,
        onClose: () => modal?.close(),
      }),
    })
  }
  modal.open()
}

export function createPromptsTool(plugin: Plugin): FloatingTool {
  const m = (plugin.i18n?.skills as unknown as Record<string, any>) || {}
  return {
    id: "skills",
    label: m.label || "Prompts",
    title: m.title || "提示词库",
    icon: `<path fill="currentColor" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/><circle cx="12" cy="12" r="3.2"/>`,
    bgColor: "#667eea",
    action: () => showPromptsModal(plugin),
  }
}

export function promptsTool(plugin: Plugin): FloatingTool {
  return createPromptsTool(plugin)
}
