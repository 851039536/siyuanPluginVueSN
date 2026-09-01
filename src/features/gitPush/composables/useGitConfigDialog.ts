// Git 配置弹窗开关与作用域参数（项目级入口；全局配置走设置弹窗 GitConfigSection 分区，查询/编辑逻辑已下沉至 GitConfigDialog 内自包含组件）
import type { Ref } from "vue"
import { ref } from "vue"
import type { GitProject, GitPushManager } from "../types"
import type { GitConfigScope } from "../types/gitConfigDesc"
import { findProjectIndex, resolveValidPath } from "../utils"

export function useGitConfigDialog(deps: {
  manager: GitPushManager
  projects: Ref<GitProject[]>
}) {
  const { projects } = deps

  const showGitConfig = ref(false)
  const gitConfigScope = ref<GitConfigScope>("local")
  const gitConfigProjectPath = ref("")
  const gitConfigTitle = ref("")

  /** 打开项目级 Git 配置弹窗（作用域：local，带项目名标题） */
  function handleOpenProjectGitConfig(projectId: string) {
    const index = findProjectIndex(projects, projectId)
    if (index === -1) return
    const project = projects.value[index]
    gitConfigScope.value = "local"
    gitConfigProjectPath.value = resolveValidPath(project)
    gitConfigTitle.value = project.name
    showGitConfig.value = true
  }

  /** 关闭 Git 配置弹窗 */
  function closeGitConfig() {
    showGitConfig.value = false
  }

  return {
    showGitConfig,
    gitConfigScope,
    gitConfigProjectPath,
    gitConfigTitle,
    handleOpenProjectGitConfig,
    closeGitConfig,
  }
}
