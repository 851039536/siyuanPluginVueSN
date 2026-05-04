import type { App as VueApp } from "vue"
import type { FloatingTool } from "../types"
import { Plugin } from "siyuan"
import { createApp } from "vue"
import Skills from "../components/SkillsModal.vue"

let vueApp: VueApp | null = null
let container: HTMLElement | null = null

const CONTAINER_SELECTORS = [
  "#workspace",
  "body",
  ".layout__center",
  ".fn__flex-1",
]

function findContainer(): HTMLElement {
  for (const selector of CONTAINER_SELECTORS) {
    const target = document.querySelector(selector)
    if (target) return target as HTMLElement
  }
  return document.body
}

function getI18nMap(plugin: Plugin) {
  const m = (plugin.i18n?.skills as unknown as Record<string, any>) || {}
  return {
    skillsTitle: m.modal?.title || "技能库",
    close: m.modal?.close || "关闭",
    addSkill: m.modal?.addSkill || "添加技能",
    editSkill: m.modal?.editSkill || "编辑技能",
    delete: m.modal?.delete || "删除",
    edit: m.modal?.edit || "编辑",
    search: m.modal?.search || "搜索技能...",
    title: m.modal?.titleLabel || "标题",
    description: m.modal?.description || "描述",
    content: m.modal?.content || "内容",
    content2: m.modal?.content2 || "内容2",
    content3: m.modal?.content3 || "内容3",
    cancel: m.modal?.cancel || "取消",
    save: m.modal?.save || "保存",
    titlePlaceholder: m.modal?.titlePlaceholder || "请输入技能标题",
    descriptionPlaceholder: m.modal?.descriptionPlaceholder || "请输入技能描述",
    contentPlaceholder: m.modal?.contentPlaceholder || "请输入要复制的内容",
    content2Placeholder: m.modal?.content2Placeholder || "请输入要复制的内容2",
    content3Placeholder: m.modal?.content3Placeholder || "请输入要复制的内容3",
    noSkills: m.modal?.noSkills || "暂无技能，点击添加",
    noSkillsFound: m.modal?.noSkillsFound || "未找到匹配的技能",
    clickToCopy: m.modal?.clickToCopy || "复制",
    manageCategories: m.modal?.manageCategories || "管理分类",
    add: m.modal?.add || "添加",
    categoryName: m.modal?.categoryName || "分类名称",
  }
}

function closeSkillsModal() {
  if (container) {
    container.remove()
    vueApp?.unmount()
    vueApp = null
    container = null
  }
}

function showSkillsModal(plugin: Plugin) {
  if (container) {
    container.remove()
    vueApp?.unmount()
    vueApp = null
    container = null
  }

  container = document.createElement("div")
  container.id = "skills-modal-container"
  findContainer().appendChild(container)

  vueApp = createApp(Skills, {
    i18n: getI18nMap(plugin),
    plugin,
  })

  try {
    vueApp.mount(container)
  } catch (error) {
    console.error("Failed to mount skills modal:", error)
  }

  const handleEscape = (e: KeyboardEvent) => {
    if (e.key === "Escape" && container) closeSkillsModal()
  }
  document.addEventListener("keydown", handleEscape);

  (plugin as any).__skillsModal = {
    destroy: () => {
      document.removeEventListener("keydown", handleEscape)
      closeSkillsModal()
    },
  }
}

export function createSkillsTool(plugin: Plugin): FloatingTool {
  const m = (plugin.i18n?.skills as unknown as Record<string, any>) || {}
  return {
    id: "skills",
    label: m.label || "Skills",
    title: m.title || "技能库",
    icon: `<path fill="currentColor" d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/><circle cx="12" cy="12" r="3.2"/>`,
    bgColor: "#667eea",
    action: () => showSkillsModal(plugin),
  }
}

export function skillsTool(plugin: Plugin): FloatingTool {
  return createSkillsTool(plugin)
}
