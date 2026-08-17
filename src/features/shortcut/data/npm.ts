/**
 * 快捷键模块 - 预置数据：NPM 命令
 * 内置快捷键数据的唯一数据源，用于首次使用时 seed 到本地持久化存储。
 */
import type { ShortcutInfo } from "../types"

export const NPM_SHORTCUTS: ShortcutInfo[] = [
  // NPM 快捷键
  {
    id: "tool_npm_install",
    name: "npm install",
    description: "安装项目依赖",
    keys: "Ctrl+Alt+N",
    category: "npm",
    group: "NPM",
    copyContent: "npm install",
  },
  {
    id: "tool_npm_install_g",
    name: "npm install -g",
    description: "全局安装包",
    keys: "Ctrl+Alt+Shift+N",
    category: "npm",
    group: "NPM",
    copyContent: "npm install -g",
  },
  {
    id: "tool_npm_start",
    name: "npm start",
    description: "启动开发服务器",
    keys: "Ctrl+Alt+S",
    category: "npm",
    group: "NPM",
    copyContent: "npm start",
  },
  {
    id: "tool_npm_run_build",
    name: "npm run build",
    description: "构建生产版本",
    keys: "Ctrl+Alt+B",
    category: "npm",
    group: "NPM",
    copyContent: "npm run build",
  },
  {
    id: "tool_npm_test",
    name: "npm test",
    description: "运行测试",
    keys: "Ctrl+Alt+T",
    category: "npm",
    group: "NPM",
    copyContent: "npm test",
  },
  {
    id: "tool_npm_dev",
    name: "npm run dev",
    description: "启动开发模式",
    keys: "Ctrl+Alt+D",
    category: "npm",
    group: "NPM",
    copyContent: "npm run dev",
  },
  {
    id: "tool_npm_run_lint",
    name: "npm run lint",
    description: "运行代码检查",
    keys: "Ctrl+Alt+L",
    category: "npm",
    group: "NPM",
    copyContent: "npm run lint",
  },
  {
    id: "tool_npm_run_format",
    name: "npm run format",
    description: "格式化代码",
    keys: "Ctrl+Alt+F",
    category: "npm",
    group: "NPM",
    copyContent: "npm run format",
  },
  {
    id: "tool_npm_publish",
    name: "npm publish",
    description: "发布包到npm",
    keys: "Ctrl+Alt+P",
    category: "npm",
    group: "NPM",
    copyContent: "npm publish",
  },
  {
    id: "tool_npm_update",
    name: "npm update",
    description: "更新依赖包",
    keys: "Ctrl+Alt+U",
    category: "npm",
    group: "NPM",
    copyContent: "npm update",
  },
]
