/**
 * 快捷键模块 - 预置数据聚合入口
 * 内置快捷键数据的唯一数据源，按分类拆分到各文件，此处汇总导出。
 * 预置不落盘（代码即真源）⇒ 插件升级后新增条目在用户面板中立即可见。
 */
import type { ShortcutInfo } from "../types"
import { NPM_SHORTCUTS } from "./npm"
import { NVM_SHORTCUTS } from "./nvm"
import { VISUAL_STUDIO_SHORTCUTS } from "./visualStudio"

/**
 * 全部预置快捷键（当前保留 NPM / NVM / Visual Studio 三类）
 *
 * 已移除的预设分类：siyuan（思源笔记）、plugin（插件快捷键）、
 * vscode（VS Code）、cmd（Windows CMD）。
 * 其分类标识、工具类登记与中英文案仍完整保留在 `types/index.ts` 与 i18n 分片中，
 * 需要恢复时补回对应的 `data/<分类>.ts` 并在此处引入即可（面板分类由数据驱动，无数据不显示）。
 */
export const PRESET_SHORTCUTS: ShortcutInfo[] = [
  ...NPM_SHORTCUTS,
  ...NVM_SHORTCUTS,
  ...VISUAL_STUDIO_SHORTCUTS,
]
