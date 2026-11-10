/**
 * Skills 管理 — 状态与 CRUD 逻辑（以 filePath 为稳定标识，含定时器清理）
 */
import type { Plugin } from "siyuan"
import type { AISkillScope, AISkillSource, AIToolType } from "@/config/aiTools"
import type { SkillInfo } from "../SkillsManager"
import { showMessage } from "siyuan"
import { AI_TOOLS, getAITool, SKILL_SOURCES } from "@/config/aiTools"
import {
  enabledSkillSourceCount,
  initSkillSourcePrefs,
  isSkillPathEnabled,
  isSkillSourceEnabled,
  setAllSkillSourcesEnabled,
  setSkillSourceEnabled,
} from "../sourcePrefs"
import { SkillsManager } from "../SkillsManager"
import { SKILL_SCOPE_LABEL_KEYS } from "../../types"
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

  /** 技能搜索词（名称 / 描述 / 路径 / 工具名，前端过滤已加载列表） */
  const searchQuery = ref("")

  /** 「加载来源」区块展开态（默认收起：仅在需要缩小扫描范围时调整） */
  const sourcesOpen = ref(false)

  /** 来源行数据：配置投影 + 工具展示名/色（名称与颜色统一取自 getAITool） */
  const skillSources = computed<Array<AISkillSource & { toolName: string, color: string }>>(() =>
    SKILL_SOURCES.map((source) => ({
      ...source,
      toolName: getAITool(source.toolId)?.name ?? source.toolId,
      color: getAITool(source.toolId)?.color ?? "#999",
    })),
  )

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
    const byTool = selectedTool.value === "all"
      ? skills.value
      : skills.value.filter((s) => s.tool === selectedTool.value)

    const query = searchQuery.value.trim().toLowerCase()
    if (!query) return byTool

    return byTool.filter((skill) =>
      skill.name.toLowerCase().includes(query)
      || skill.description.toLowerCase().includes(query)
      || skill.filePath.toLowerCase().includes(query)
      || getToolName(skill.tool).toLowerCase().includes(query),
    )
  })

  /** 列表空态文案（未启用来源 / 搜索无结果 / 全局无技能 / 单工具无技能） */
  const emptyStateText = computed(() => {
    if (enabledSkillSourceCount.value === 0) return i18n.value.noSourcesEnabled ?? ""
    if (searchQuery.value.trim()) return i18n.value.searchNoMatch ?? ""
    return selectedTool.value === "all"
      ? (i18n.value.noSkillsAllTools ?? "")
      : (i18n.value.noSkillsForTool ?? "")
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

  /** 作用域展示名（全局 / 项目级 / 工作区） */
  function getScopeLabel(scope: AISkillScope): string {
    return i18n.value[SKILL_SCOPE_LABEL_KEYS[scope]] ?? scope
  }

  /** 来源路径展示：全局用 ~ 前缀，项目级/工作区保留相对路径（基准目录由作用域标签说明） */
  function getSourcePathLabel(source: AISkillSource): string {
    return source.scope === "global" ? `~/${source.relPath}` : source.relPath
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

  /** 是否含 YAML frontmatter（去掉 BOM 后首行必须是 ---） */
  const hasFrontmatter = (content: string) => /^---\r?\n/.test(content.replace(/^\uFEFF/, ""))

  async function saveEdit(filePath: string) {
    if (!filePath || savingSkill.value) return
    const skill = skills.value.find((s) => s.filePath === filePath)
    if (!skill) return

    // 原文件有 frontmatter 而新内容删掉了它：保存后技能名/描述会退化为目录名，等于"写坏"技能
    if (hasFrontmatter(skill.content) && !hasFrontmatter(editContent.value)) {
      showMessage(i18n.value.saveSkillFrontmatterRequired ?? "", 3000, "error")
      return
    }

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
        // 目标工具下多了一份技能：静默重扫，让列表与卡片计数同步出现
        await refreshSkills({ silent: true })
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
      const success = await manager.deleteSkill(skillDir, projectPath.value || undefined)
      if (success) {
        const originalIndex = skills.value.findIndex((s) => s.filePath === skill.filePath)
        if (originalIndex !== -1) {
          skills.value.splice(originalIndex, 1)
          // 计数由列表派生：删完立即同步，避免卡片数字比列表多 1
          syncToolStatuses()
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

  /**
   * 工具卡片计数：直接由扫描结果派生。
   * 口径与列表完全一致——目录存在但没有 SKILL.md、或路径被禁用，都不再计入。
   */
  function syncToolStatuses() {
    const next: typeof toolStatuses = {}
    for (const tool of AI_TOOLS) {
      next[tool.id] = {
        global: false,
        project: false,
        globalCount: 0,
        projectCount: 0,
      }
    }

    for (const skill of skills.value) {
      const bucket = next[skill.tool]
      if (!bucket) continue
      // workspace 与 global 同属"全局桶"（UI 卡片按合计展示）
      if (skill.scope === "project") {
        bucket.project = true
        bucket.projectCount += 1
      } else {
        bucket.global = true
        bucket.globalCount += 1
      }
    }

    for (const id of Object.keys(next)) {
      toolStatuses[id] = next[id]
    }
  }

  /** 扫描序号：连点来源开关时只接受最后一次扫描结果，避免旧结果覆盖新结果 */
  let scanToken = 0

  /**
   * 重新扫描。
   * silent 用于来源开关等高频操作：只刷新列表，不弹「扫描完成」提示。
   */
  async function refreshSkills(options: { silent?: boolean } = {}) {
    if (!managerAvailable) return
    const token = ++scanToken
    // 静默重扫（来源开关）不切加载态：避免每次勾选都闪一次骨架
    if (!options.silent) loading.value = true
    expandedSkills.clear()
    editingSkill.value = null

    try {
      const result = await manager.scanAllSkills(projectPath.value || undefined, isSkillPathEnabled)
      if (token !== scanToken) return // 已有更新的扫描在跑，丢弃本次结果
      skills.value = result
      syncToolStatuses()
      if (!options.silent) {
        showMessage(
          skills.value.length > 0
            ? `${i18n.value.scanComplete ?? ""}：${skills.value.length} ${i18n.value.unit ?? ""}`
            : (i18n.value.noSkillsFound ?? ""),
          2000,
          "info",
        )
      }
    } catch (e) {
      if (token !== scanToken) return
      console.error("扫描 Skills 失败:", e)
      showMessage(i18n.value.scanFailed ?? "", 2000, "error")
    } finally {
      // 仅最新一次扫描负责收尾，避免旧扫描提前关掉新扫描的加载态
      if (token === scanToken) loading.value = false
    }
  }

  /** 单个来源开关：落盘后静默重扫（禁用的路径不再读盘） */
  async function toggleSkillSource(id: string, enabled: boolean) {
    await setSkillSourceEnabled(id, enabled)
    await refreshSkills({ silent: true })
  }

  /** 全选 / 全不选（一次落盘，随后静默重扫一次） */
  async function toggleAllSkillSources(enabled: boolean) {
    await setAllSkillSourcesEnabled(skillSources.value.map((source) => source.id), enabled)
    await refreshSkills({ silent: true })
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

  /** 路径输入 500ms 防抖后自动重扫（静默：输入过程中不逐次弹「扫描完成」） */
  function handlePathChange() {
    if (!managerAvailable) return
    if (pathChangeTimer) clearTimeout(pathChangeTimer)
    pathChangeTimer = setTimeout(() => {
      pathChangeTimer = null
      refreshSkills({ silent: true })
    }, 500)
  }

  let hasInitialized = false

  // 每次打开都重扫：外部可能刚用 npx skills / git clone 装删过技能，只用首开快照会一直看到旧列表
  watch(() => props.visible, async (v) => {
    if (!v || !managerAvailable) return

    const firstOpen = !hasInitialized
    if (firstOpen) {
      hasInitialized = true
      // 先恢复来源偏好再扫描：否则首帧会按「全部启用」多读一批已禁用的目录
      await initSkillSourcePrefs(props.plugin)
    }
    await refreshSkills({ silent: !firstOpen })
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
    searchQuery,
    emptyStateText,
    sourcesOpen,
    skillSources,
    enabledSkillSourceCount,
    isSkillSourceEnabled,
    getScopeLabel,
    getSourcePathLabel,
    toggleSkillSource,
    toggleAllSkillSources,
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
