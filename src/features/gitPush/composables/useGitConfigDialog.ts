// Git 全局/项目级配置弹窗状态与查询
import type { Ref } from "vue"
import { ref } from "vue"
import type { GitProject, GitPushManager } from "../types"
import { resolveValidPath } from "../utils"
import { getErrorMessage } from "@/utils/stringUtils"

export function useGitConfigDialog(deps: {
  manager: GitPushManager
  projects: Ref<GitProject[]>
  tf: (key: string, fallback: string, ...args: (string | number)[]) => string
}) {
  const { manager, projects, tf } = deps

  const showGitConfig = ref(false)
  const gitConfigText = ref("")
  const gitConfigLoading = ref(false)
  const gitConfigError = ref("")
  const gitConfigFilePath = ref("")
  const gitConfigTitle = ref("")

  /** 打开 Git 全局配置弹窗并查询 */
  async function handleOpenGitConfig() {
    showGitConfig.value = true
    gitConfigLoading.value = true
    gitConfigError.value = ""
    gitConfigText.value = ""
    gitConfigFilePath.value = manager.getGitConfigFilePath()
    gitConfigTitle.value = ""
    try {
      const text = await manager.getGitGlobalConfig()
      gitConfigText.value = text
    } catch (e: unknown) {
      gitConfigError.value = getErrorMessage(e) || tf("queryFailed", "查询失败")
    } finally {
      gitConfigLoading.value = false
    }
  }

  /** 打开项目级 Git 配置弹窗并查询 */
  async function handleOpenProjectGitConfig(projectId: string) {
    const index = projects.value.findIndex((p) => p.id === projectId)
    if (index === -1) return
    const project = projects.value[index]
    const path = resolveValidPath(project)
    showGitConfig.value = true
    gitConfigLoading.value = true
    gitConfigError.value = ""
    gitConfigText.value = ""
    gitConfigFilePath.value = manager.getProjectGitConfigFilePath(path)
    gitConfigTitle.value = project.name
    try {
      const text = await manager.getProjectGitConfig(path)
      gitConfigText.value = text
    } catch (e: unknown) {
      gitConfigError.value = getErrorMessage(e) || tf("queryFailed", "查询失败")
    } finally {
      gitConfigLoading.value = false
    }
  }

  /** 关闭 Git 全局配置弹窗 */
  function closeGitConfig() {
    showGitConfig.value = false
  }

  return {
    showGitConfig,
    gitConfigText,
    gitConfigLoading,
    gitConfigError,
    gitConfigFilePath,
    gitConfigTitle,
    handleOpenGitConfig,
    handleOpenProjectGitConfig,
    closeGitConfig,
  }
}
