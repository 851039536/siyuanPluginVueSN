/**
 * Skills 查看器功能模块
 */
import { Plugin } from "siyuan"
import { type SkillInfo, SkillsViewerManager } from "./modules/SkillsViewerManager"
import { showSkillsViewer } from "./types"

export function registerSkillsViewer(plugin: Plugin) {
  plugin.addCommand({
    langKey: "skillsViewer",
    langText: "Skills 查看器",
    hotkey: "",
    callback: () => {
      showSkillsViewer()
    },
  })
}

export {
  hideSkillsViewer,
  showSkillsViewer,
  skillsViewerVisible,
  toggleSkillsViewer,
} from "./types"

export { type SkillInfo, SkillsViewerManager } from "./modules/SkillsViewerManager"

/** 公共 API：扫描所有 AI 工具的 Skills 配置，供其他功能模块通过依赖注入调用 */
export async function scanSkills(projectPath?: string): Promise<SkillInfo[]> {
  const manager = new SkillsViewerManager()
  return await manager.scanAllSkills(projectPath)
}
