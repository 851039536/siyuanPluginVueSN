/**
 * Skills 查看器功能模块
 */
import { Plugin } from "siyuan"
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
