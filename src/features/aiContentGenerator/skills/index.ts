/**
 * Skills 管理子模块（原 skillsViewer 功能）— 注册入口 + 模块内共享 API
 */
import type { Plugin } from "siyuan"
import type { SkillInfo } from "./SkillsManager"
import { SkillsManager } from "./SkillsManager"
import { isSkillPathEnabled } from "./sourcePrefs"
import { showSkillsManager } from "./state"

/** 注册「Skills 查看器」命令（功能并入 aiContentGenerator 后由其统一注册） */
export function registerSkillsManager(plugin: Plugin): void {
  plugin.addCommand({
    langKey: "skillsViewer",
    langText: "Skills 查看器",
    hotkey: "",
    callback: () => {
      showSkillsManager()
    },
  })
}

export type { SkillInfo } from "./SkillsManager"
export { SkillsManager } from "./SkillsManager"

export {
  hideSkillsManager,
  showSkillsManager,
  skillsManagerVisible,
} from "./state"

/** 扫描所有 AI 工具的 Skills 配置（模块内 useSkillsLoader 消费） */
export async function scanSkills(projectPath?: string): Promise<SkillInfo[]> {
  const manager = new SkillsManager()
  try {
    // 只扫描启用中的来源路径（偏好由 Skills 管理弹窗的「加载来源」维护）
    return await manager.scanAllSkills(projectPath, isSkillPathEnabled)
  } finally {
    manager.destroy()
  }
}

/** 初始化技能来源偏好（面板在首次扫描前调用；弹窗内部自行初始化，幂等） */
export { initSkillSourcePrefs } from "./sourcePrefs"
