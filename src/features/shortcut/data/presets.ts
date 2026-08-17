/**
 * 快捷键模块 - 预置数据聚合入口
 * 内置快捷键数据的唯一数据源，按分类拆分到各文件，此处汇总导出。
 */
import type { ShortcutInfo } from "../types"
import { SIYUAN_SHORTCUTS } from "./siyuan"
import { PLUGIN_SHORTCUTS } from "./plugin"
import { NPM_SHORTCUTS } from "./npm"
import { NVM_SHORTCUTS } from "./nvm"
import { CMD_SHORTCUTS } from "./cmd"
import { VSCODE_SHORTCUTS } from "./vscode"
import { VISUAL_STUDIO_SHORTCUTS } from "./visualStudio"

/**
 * 全部预置快捷键（首次使用时 seed 到本地持久化存储）
 */
export const PRESET_SHORTCUTS: ShortcutInfo[] = [
  ...SIYUAN_SHORTCUTS,
  ...PLUGIN_SHORTCUTS,
  ...NPM_SHORTCUTS,
  ...NVM_SHORTCUTS,
  ...CMD_SHORTCUTS,
  ...VSCODE_SHORTCUTS,
  ...VISUAL_STUDIO_SHORTCUTS,
]
