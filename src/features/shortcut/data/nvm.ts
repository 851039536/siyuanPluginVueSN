/**
 * 快捷键模块 - 预置数据：NVM 命令
 *
 * ⚠️ 这批条目是「待复制的命令」，不是键位：nvm 本身没有原生快捷键，因此**不写 `keys`**。
 *    留空 ⇒ 卡片只渲染命令芯片，不会出现误导性的快捷键徽章（见 `utils.resolveShortcutDisplay`）。
 * 预置不落盘（代码即真源，聚合入口见 `data/presets.ts`），`copyContent` 即命令原文。
 */
import type { ShortcutInfo } from "../types"

export const NVM_SHORTCUTS: ShortcutInfo[] = [
  // NVM 命令
  {
    id: "tool_nvm_use",
    name: "nvm use",
    description: "切换 Node.js 版本",
    category: "nvm",
    group: "NVM",
    copyContent: "nvm use",
  },
  {
    id: "tool_nvm_install",
    name: "nvm install",
    description: "安装指定版本的 Node.js",
    category: "nvm",
    group: "NVM",
    copyContent: "nvm install",
  },
  {
    id: "tool_nvm_list",
    name: "nvm list",
    description: "列出已安装的 Node.js 版本",
    category: "nvm",
    group: "NVM",
    copyContent: "nvm list",
  },
  {
    id: "tool_nvm_list_available",
    name: "nvm list available",
    description: "列出所有可用版本",
    category: "nvm",
    group: "NVM",
    copyContent: "nvm list available",
  },
  {
    id: "tool_nvm_uninstall",
    name: "nvm uninstall",
    description: "卸载指定版本",
    category: "nvm",
    group: "NVM",
    copyContent: "nvm uninstall",
  },
  {
    id: "tool_nvm_alias",
    name: "nvm alias",
    description: "创建版本别名",
    category: "nvm",
    group: "NVM",
    copyContent: "nvm alias",
  },
  {
    id: "tool_nvm_current",
    name: "nvm current",
    description: "显示当前版本",
    category: "nvm",
    group: "NVM",
    copyContent: "nvm current",
  },
  {
    id: "tool_nvm_on",
    name: "nvm on",
    description: "启用 NVM",
    category: "nvm",
    group: "NVM",
    copyContent: "nvm on",
  },
  {
    id: "tool_nvm_off",
    name: "nvm off",
    description: "禁用 NVM",
    category: "nvm",
    group: "NVM",
    copyContent: "nvm off",
  },
]
