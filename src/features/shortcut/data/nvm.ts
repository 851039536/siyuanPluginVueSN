/**
 * 快捷键模块 - 预置数据：NVM 命令
 * 内置快捷键数据的唯一数据源，用于首次使用时 seed 到本地持久化存储。
 */
import type { ShortcutInfo } from "../types"

export const NVM_SHORTCUTS: ShortcutInfo[] = [
  // NVM 快捷键
  {
    id: "tool_nvm_use",
    name: "nvm use",
    description: "切换 Node.js 版本",
    keys: "Ctrl+Alt+U",
    category: "nvm",
    group: "NVM",
    copyContent: "nvm use",
  },
  {
    id: "tool_nvm_install",
    name: "nvm install",
    description: "安装指定版本的 Node.js",
    keys: "Ctrl+Alt+I",
    category: "nvm",
    group: "NVM",
    copyContent: "nvm install",
  },
  {
    id: "tool_nvm_list",
    name: "nvm list",
    description: "列出已安装的 Node.js 版本",
    keys: "Ctrl+Alt+L",
    category: "nvm",
    group: "NVM",
    copyContent: "nvm list",
  },
  {
    id: "tool_nvm_list_available",
    name: "nvm list available",
    description: "列出所有可用版本",
    keys: "Ctrl+Alt+Shift+L",
    category: "nvm",
    group: "NVM",
    copyContent: "nvm list available",
  },
  {
    id: "tool_nvm_uninstall",
    name: "nvm uninstall",
    description: "卸载指定版本",
    keys: "Ctrl+Alt+R",
    category: "nvm",
    group: "NVM",
    copyContent: "nvm uninstall",
  },
  {
    id: "tool_nvm_alias",
    name: "nvm alias",
    description: "创建版本别名",
    keys: "Ctrl+Alt+A",
    category: "nvm",
    group: "NVM",
    copyContent: "nvm alias",
  },
  {
    id: "tool_nvm_current",
    name: "nvm current",
    description: "显示当前版本",
    keys: "Ctrl+Alt+C",
    category: "nvm",
    group: "NVM",
    copyContent: "nvm current",
  },
  {
    id: "tool_nvm_on",
    name: "nvm on",
    description: "启用 NVM",
    keys: "Ctrl+Alt+O",
    category: "nvm",
    group: "NVM",
    copyContent: "nvm on",
  },
  {
    id: "tool_nvm_off",
    name: "nvm off",
    description: "禁用 NVM",
    keys: "Ctrl+Alt+Shift+O",
    category: "nvm",
    group: "NVM",
    copyContent: "nvm off",
  },
]
