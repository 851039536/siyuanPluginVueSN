/**
 * 快捷键模块 - 预置数据：NPM 命令
 *
 * ⚠️ 这批条目是「待复制的命令」，不是键位：npm 本身没有原生快捷键，因此**不写 `keys`**。
 *    留空 ⇒ 卡片只渲染命令芯片，不会出现误导性的快捷键徽章（见 `utils.resolveShortcutDisplay`）。
 * 预置不落盘（代码即真源，聚合入口见 `data/presets.ts`），`copyContent` 即命令原文。
 */
import type { ShortcutInfo } from "../types"

export const NPM_SHORTCUTS: ShortcutInfo[] = [
  // NPM 命令
  {
    id: "tool_npm_install",
    name: "npm install",
    description: "安装项目依赖",
    category: "npm",
    group: "NPM",
    copyContent: "npm install",
  },
  {
    id: "tool_npm_install_g",
    name: "npm install -g",
    description: "全局安装包",
    category: "npm",
    group: "NPM",
    copyContent: "npm install -g",
  },
  {
    id: "tool_npm_start",
    name: "npm start",
    description: "启动开发服务器",
    category: "npm",
    group: "NPM",
    copyContent: "npm start",
  },
  {
    id: "tool_npm_run_build",
    name: "npm run build",
    description: "构建生产版本",
    category: "npm",
    group: "NPM",
    copyContent: "npm run build",
  },
  {
    id: "tool_npm_test",
    name: "npm test",
    description: "运行测试",
    category: "npm",
    group: "NPM",
    copyContent: "npm test",
  },
  {
    id: "tool_npm_dev",
    name: "npm run dev",
    description: "启动开发模式",
    category: "npm",
    group: "NPM",
    copyContent: "npm run dev",
  },
  {
    id: "tool_npm_run_lint",
    name: "npm run lint",
    description: "运行代码检查",
    category: "npm",
    group: "NPM",
    copyContent: "npm run lint",
  },
  {
    id: "tool_npm_run_format",
    name: "npm run format",
    description: "格式化代码",
    category: "npm",
    group: "NPM",
    copyContent: "npm run format",
  },
  {
    id: "tool_npm_publish",
    name: "npm publish",
    description: "发布包到npm",
    category: "npm",
    group: "NPM",
    copyContent: "npm publish",
  },
  {
    id: "tool_npm_update",
    name: "npm update",
    description: "更新依赖包",
    category: "npm",
    group: "NPM",
    copyContent: "npm update",
  },
]
