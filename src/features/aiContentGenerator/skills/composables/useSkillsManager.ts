/**
 * Skills 管理 — 状态与 CRUD 逻辑（以 filePath 为稳定标识，含定时器清理）
 */
import type { Plugin } from "siyuan"
import type { AIToolType } from "@/config/aiTools"
import type { SkillInfo } from "../SkillsManager"
import { showMessage } from "siyuan"
import { AI_TOOLS, getAITool } from "@/config/aiTools"
import { SkillsManager } from "../SkillsManager"
import {
  computed,
  onBeforeUnmount,
  reactive,
  ref,
  watch,
} from "vue"

interface UseSkillsManagerProps {
  visible: boolean
  plugin?: Plugin | null
}

export function useSkillsManager(props: UseSkillsManagerProps) {
  const i18n = computed<Record<string, string>>(
    () => (props.plugin?.i18n?.skillsViewer as unknown as Record<string, string>) || {},
  )

  const manager = new SkillsManager()
  const managerAvailable = manager.isAvailable()
  const aiTools = AI_TOOLS

  const selectedTool = ref<string>("all")
  const projectPath = ref("")
  const skills = ref<SkillInfo[]>([])
  const loading = ref(false)
  const expandedSkills = reactive(new Set<string>())

  const editingSkill = ref<string | null>(null)
  const editContent = ref("")
  const savingSkill = ref(false)
  const deleteConfirmVisible = ref(false)
  const deleteTargetPath = ref<string | null>(null)
  const deletingSkill = ref(false)
  const copyConfirmVisible = ref(false)
  const copySourcePath = ref<string | null>(null)
  const copyingSkill = ref(false)

  const deleteTargetSkill = computed(() => {
    if (!deleteTargetPath.value) return null
    return skills.value.find((s) => s.filePath === deleteTargetPath.value) || null
  })
  const copySourceSkill = computed(() => {
    if (!copySourcePath.value) return null
    return skills.value.find((s) => s.filePath === copySourcePath.value) || null
  })

  const toolStatuses = reactive<Record<string, {
    global: boolean
    project: boolean
    globalCount: number
    projectCount: number
  }>>({})

  const filteredSkills = computed(() => {
    if (selectedTool.value === "all") return skills.value
    return skills.value.filter((s) => s.tool === selectedTool.value)
  })

  function selectTool(toolId: string) {
    selectedTool.value = toolId
  }

  /** 工具展示色（经共享 getAITool 查询，AI_TOOLS 全量含 color） */
  function getToolColor(toolId: AIToolType): string {
    return getAITool(toolId)?.color || "#999"
  }

  function getToolName(toolId: AIToolType): string {
    return getAITool(toolId)?.name || toolId
  }

  function toggleExpand(filePath: string) {
    if (expandedSkills.has(filePath)) {
      expandedSkills.delete(filePath)
    } else {
      expandedSkills.add(filePath)
    }
  }

  function startEdit(filePath: string) {
    const skill = skills.value.find((s) => s.filePath === filePath)
    if (!skill) return
    editingSkill.value = filePath
    editContent.value = skill.content
  }

  function cancelEdit() {
    editingSkill.value = null
    editContent.value = ""
  }

  async function saveEdit(filePath: string) {
    if (!filePath || savingSkill.value) return
    const skill = skills.value.find((s) => s.filePath === filePath)
    if (!skill) return

    savingSkill.value = true
    try {
      const success = await manager.saveSkillContent(filePath, editContent.value)
      if (success) {
        skill.content = editContent.value
        const dirName = filePath.split(/[\\/]/).slice(-2, -1)[0]
        const parsed = manager.parseSkillMd(editContent.value, dirName)
        skill.name = parsed.name
        skill.description = parsed.description
        editingSkill.value = null
        editContent.value = ""
        showMessage(i18n.value.saveSkillSuccess ?? "", 2000, "info")
      } else {
        showMessage(i18n.value.saveSkillFailed ?? "", 2000, "error")
      }
    } catch (e) {
      console.error("保存 Skill 失败:", e)
      showMessage(i18n.value.saveSkillFailed ?? "", 2000, "error")
    } finally {
      savingSkill.value = false
    }
  }

  function confirmDeleteSkill(filePath: string) {
    deleteTargetPath.value = filePath
    deleteConfirmVisible.value = true
  }

  function cancelDeleteSkill() {
    deleteConfirmVisible.value = false
    deleteTargetPath.value = null
  }

  function confirmCopySkill(filePath: string) {
    copySourcePath.value = filePath
    copyConfirmVisible.value = true
  }

  function cancelCopySkill() {
    copyConfirmVisible.value = false
    copySourcePath.value = null
  }

  async function executeCopySkill(targetToolId: AIToolType) {
    if (!copySourcePath.value || copyingSkill.value) return
    const skill = skills.value.find((s) => s.filePath === copySourcePath.value)
    if (!skill) return

    const targetTool = AI_TOOLS.find((t) => t.id === targetToolId)
    if (!targetTool) return

    copyingSkill.value = true
    try {
      const skillDir = manager.resolveSkillDir(skill.filePath)
      // 来源作用域：工作区前缀最具体（工作区可能位于用户目录内），先判工作区
      const isWorkspace = await manager.isWorkspaceSkill(skill.filePath)
      const isGlobal = !isWorkspace && skill.filePath.startsWith(manager.getHomeDir())
      const isProject = !isWorkspace && !isGlobal

      // 目标作用域候选（来源作用域优先，无登记路径的作用域自动顺延）：
      // global 桶 = 用户全局（homeDir + skillPaths）+ 思源工作区（workspaceDir + workspacePaths）
      const wsDir = await manager.getWorkspaceDir()
      const globalTier: Array<{ base: string, rels: string[] }> = []
      if (manager.getHomeDir() && targetTool.skillPaths.length > 0) {
        globalTier.push({ base: manager.getHomeDir(), rels: targetTool.skillPaths })
      }
      if (wsDir && targetTool.workspacePaths && targetTool.workspacePaths.length > 0) {
        globalTier.push({ base: wsDir, rels: targetTool.workspacePaths })
      }
      const projectTier: Array<{ base: string, rels: string[] }> = []
      if (projectPath.value && targetTool.projectPaths.length > 0) {
        projectTier.push({ base: projectPath.value, rels: targetTool.projectPaths })
      }
      const scopes = isProject
        ? [...projectTier, ...globalTier]
        : [...globalTier, ...projectTier]

      // 只尝试第一个「有登记路径」的作用域（沿用旧语义：同作用域逐个尝试、失败即失败，
      // 不跨作用域静默扩散，避免「目标已存在」时被额外复制到第二处）
      let copied = false
      const scope = scopes[0]
      if (scope) {
        for (const relPath of scope.rels) {
          const targetDir = manager.resolveDir(scope.base, relPath)
          const success = await manager.copySkill(skillDir, targetDir)
          if (success) {
            copied = true
            break
          }
        }
      }

      if (copied) {
        copyConfirmVisible.value = false
        copySourcePath.value = null
        await checkAllToolStatuses()
        showMessage(
          `${i18n.value.copySkillSuccess ?? ""} ${targetTool.name}`,
          2000,
          "info",
        )
      } else {
        showMessage(i18n.value.copySkillFailed ?? "", 2000, "error")
      }
    } catch (e) {
      console.error("复制 Skill 失败:", e)
      showMessage(i18n.value.copySkillFailed ?? "", 2000, "error")
    } finally {
      copyingSkill.value = false
    }
  }

  async function executeDeleteSkill() {
    if (!deleteTargetPath.value || deletingSkill.value) return
    const skill = skills.value.find((s) => s.filePath === deleteTargetPath.value)
    if (!skill) return

    deletingSkill.value = true
    try {
      const skillDir = manager.resolveSkillDir(skill.filePath)
      const success = await manager.deleteSkill(skillDir)
      if (success) {
        const originalIndex = skills.value.findIndex((s) => s.filePath === skill.filePath)
        if (originalIndex !== -1) {
          skills.value.splice(originalIndex, 1)
        }
        deleteConfirmVisible.value = false
        deleteTargetPath.value = null
        showMessage(i18n.value.deleteSkillSuccess ?? "", 2000, "info")
      } else {
        showMessage(i18n.value.deleteSkillFailed ?? "", 2000, "error")
      }
    } catch (e) {
      console.error("删除 Skill 失败:", e)
      showMessage(i18n.value.deleteSkillFailed ?? "", 2000, "error")
    } finally {
      deletingSkill.value = false
    }
  }

  async function checkAllToolStatuses() {
    const results = await Promise.all(
      AI_TOOLS.map(async (tool) => {
        const status = await manager.checkToolExists(tool, projectPath.value || undefined)
        return { id: tool.id, status }
      }),
    )
    for (const { id, status } of results) {
      toolStatuses[id] = status
    }
  }

  async function refreshSkills() {
    if (!managerAvailable) return
    loading.value = true
    expandedSkills.clear()
    editingSkill.value = null

    try {
      skills.value = await manager.scanAllSkills(projectPath.value || undefined)
      await checkAllToolStatuses()
      showMessage(
        skills.value.length > 0
          ? `${i18n.value.scanComplete ?? ""}：${skills.value.length} ${i18n.value.unit ?? ""}`
          : (i18n.value.noSkillsFound ?? ""),
        2000,
        "info",
      )
    } catch (e) {
      console.error("扫描 Skills 失败:", e)
      showMessage(i18n.value.scanFailed ?? "", 2000, "error")
    } finally {
      loading.value = false
    }
  }

  async function openCurrentToolDir() {
    if (!managerAvailable) return

    let dirPath = ""
    if (selectedTool.value === "all") {
      dirPath = manager.getHomeDir()
    } else {
      const tool = AI_TOOLS.find((t) => t.id === selectedTool.value)
      if (tool) {
        dirPath = (await manager.firstSkillDir(tool)) || ""
      }
    }

    if (dirPath) {
      const success = await manager.openInFileManager(dirPath)
      if (!success) {
        showMessage(i18n.value.openDirFailed ?? "", 2000, "error")
      }
    }
  }

  let pathChangeTimer: ReturnType<typeof setTimeout> | null = null

  /** 路径输入 500ms 防抖后自动重扫（@input 实时触发） */
  function handlePathChange() {
    if (!managerAvailable) return
    if (pathChangeTimer) clearTimeout(pathChangeTimer)
    pathChangeTimer = setTimeout(() => {
      pathChangeTimer = null
      refreshSkills()
    }, 500)
  }

  let hasInitialized = false

  watch(() => props.visible, async (v) => {
    if (v && !hasInitialized && managerAvailable) {
      hasInitialized = true
      await checkAllToolStatuses()
      await refreshSkills()
    }
  })

  onBeforeUnmount(() => {
    if (pathChangeTimer) clearTimeout(pathChangeTimer)
    manager.destroy()
  })

  return {
    aiTools,
    i18n,
    managerAvailable,
    selectedTool,
    projectPath,
    skills,
    loading,
    expandedSkills,
    editingSkill,
    editContent,
    savingSkill,
    deleteConfirmVisible,
    deleteTargetSkill,
    deletingSkill,
    copyConfirmVisible,
    copySourceSkill,
    copyingSkill,
    toolStatuses,
    filteredSkills,
    selectTool,
    getToolColor,
    getToolName,
    toggleExpand,
    startEdit,
    cancelEdit,
    saveEdit,
    confirmDeleteSkill,
    cancelDeleteSkill,
    confirmCopySkill,
    cancelCopySkill,
    executeCopySkill,
    executeDeleteSkill,
    refreshSkills,
    openCurrentToolDir,
    handlePathChange,
  }
}
