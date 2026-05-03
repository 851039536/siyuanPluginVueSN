/**
 * 快捷键模块
 * 功能：在右侧边栏显示思源笔记和插件的快捷键信息
 * 侧边栏图标：iconKeymap（快捷键图标）
 */
import { Plugin } from "siyuan";
import { createApp, h } from "vue";
// @ts-ignore
import ShortcutPanel from "./index.vue";
import { ShortcutManager, getShortcutManager } from "./manager";
import { ShortcutStorage } from "./types/storage";
import type { ShortcutInfo } from "./types";

/**
 * 注册快捷键模块
 */
export async function registerShortcut(plugin: Plugin) {
  // 初始化快捷键管理器
  const manager = getShortcutManager();

  // 添加思源笔记常用快捷键
  await manager.addShortcuts(getSiyuanShortcuts());

  // 添加当前项目的快捷键
  await manager.addShortcuts(getPluginShortcuts());

  // 添加Claude Code快捷键
  await manager.addShortcuts(getClaudeShortcuts());

  // 添加OpenSpec快捷键
  await manager.addShortcuts(getOpenSpecShortcuts());

  // 添加工具快捷键 (npm, nvm, cmd, vscode, Visual Studio)
  await manager.addShortcuts(getToolShortcuts());

  // 加载自定义快捷键从数据库
  const customShortcuts = await new ShortcutStorage(plugin).loadCustomShortcuts();
  if (customShortcuts.length > 0) {
    await manager.addShortcuts(customShortcuts);
  }

  // 设置保存回调
  manager.setSaveCallback(async (shortcuts: ShortcutInfo[]) => {
    await new ShortcutStorage(plugin).saveCustomShortcuts(shortcuts);
  });

  // 添加右侧边栏 Dock
  addShortcutDock(plugin);
}

/**
 * 获取思源笔记的常用快捷键
 */
function getSiyuanShortcuts(): ShortcutInfo[] {
  return [
    // 编辑操作
    {
      id: "sy_undo",
      name: "撤销",
      description: "撤销上一步操作",
      keys: "Ctrl+Z",
      category: "siyuan",
      group: "编辑操作",
    },
    {
      id: "sy_redo",
      name: "重做",
      description: "重做上一步操作",
      keys: "Ctrl+Shift+Z",
      category: "siyuan",
      group: "编辑操作",
    },
    {
      id: "sy_bold",
      name: "粗体",
      description: "使文本加粗",
      keys: "Ctrl+B",
      category: "siyuan",
      group: "文本格式",
    },
    {
      id: "sy_italic",
      name: "斜体",
      description: "使文本倾斜",
      keys: "Ctrl+I",
      category: "siyuan",
      group: "文本格式",
    },
    {
      id: "sy_underline",
      name: "下划线",
      description: "为文本添加下划线",
      keys: "Ctrl+U",
      category: "siyuan",
      group: "文本格式",
    },
    {
      id: "sy_strikethrough",
      name: "删除线",
      description: "为文本添加删除线",
      keys: "Ctrl+Shift+X",
      category: "siyuan",
      group: "文本格式",
    },
    {
      id: "sy_code",
      name: "代码",
      description: "使文本显示为代码",
      keys: "Ctrl+Shift+`",
      category: "siyuan",
      group: "文本格式",
    },
    {
      id: "sy_heading1",
      name: "一级标题",
      description: "插入一级标题",
      keys: "Ctrl+1",
      category: "siyuan",
      group: "块类型",
    },
    {
      id: "sy_heading2",
      name: "二级标题",
      description: "插入二级标题",
      keys: "Ctrl+2",
      category: "siyuan",
      group: "块类型",
    },
    {
      id: "sy_heading3",
      name: "三级标题",
      description: "插入三级标题",
      keys: "Ctrl+3",
      category: "siyuan",
      group: "块类型",
    },
    {
      id: "sy_unordered_list",
      name: "无序列表",
      description: "插入无序列表",
      keys: "Ctrl+Shift+L",
      category: "siyuan",
      group: "块类型",
    },
    {
      id: "sy_ordered_list",
      name: "有序列表",
      description: "插入有序列表",
      keys: "Ctrl+Shift+O",
      category: "siyuan",
      group: "块类型",
    },
    {
      id: "sy_quote",
      name: "引用块",
      description: "插入引用块",
      keys: "Ctrl+Shift+B",
      category: "siyuan",
      group: "块类型",
    },
    {
      id: "sy_code_block",
      name: "代码块",
      description: "插入代码块",
      keys: "Ctrl+Shift+C",
      category: "siyuan",
      group: "块类型",
    },
    {
      id: "sy_inline_link",
      name: "行内链接",
      description: "插入行内链接",
      keys: "Ctrl+K",
      category: "siyuan",
      group: "插入",
    },
    {
      id: "sy_search",
      name: "搜索",
      description: "打开全局搜索",
      keys: "Ctrl+F",
      category: "siyuan",
      group: "导航",
    },
    {
      id: "sy_replace",
      name: "替换",
      description: "打开替换面板",
      keys: "Ctrl+H",
      category: "siyuan",
      group: "导航",
    },
    {
      id: "sy_focus",
      name: "聚焦",
      description: "聚焦当前块",
      keys: "Ctrl+L",
      category: "siyuan",
      group: "导航",
    },
    {
      id: "sy_delete_block",
      name: "删除块",
      description: "删除当前块",
      keys: "Ctrl+Shift+D",
      category: "siyuan",
      group: "编辑操作",
    },
    {
      id: "sy_duplicate_block",
      name: "复制块",
      description: "复制当前块",
      keys: "Ctrl+D",
      category: "siyuan",
      group: "编辑操作",
    },
  ];
}

/**
 * 获取Claude Code的快捷键
 */
function getClaudeShortcuts(): ShortcutInfo[] {
  return [
    // 基础交互
    {
      id: "claude_start",
      name: "启动 Claude Code",
      description: "启动 Claude Code 交互模式",
      keys: "claude",
      category: "claude",
      group: "基础交互",
    },
    {
      id: "claude_prompt",
      name: "一次性命令执行",
      description: "快速执行单个任务",
      keys: 'claude "任务描述"',
      category: "claude",
      group: "基础交互",
    },
    {
      id: "claude_continue",
      name: "继续上次对话",
      description: "继续上次的对话内容",
      keys: "claude -c",
      category: "claude",
      group: "基础交互",
    },
    {
      id: "claude_update",
      name: "更新客户端",
      description: "更新 Claude Code 客户端",
      keys: "claude update",
      category: "claude",
      group: "基础交互",
    },
    {
      id: "claude_mcp",
      name: "启动 MCP 向导",
      description: "启动 Model Context Protocol 向导",
      keys: "claude mcp",
      category: "claude",
      group: "基础交互",
    },
    // 快捷命令
    {
      id: "claude_help",
      name: "帮助",
      description: "列出所有斜线命令",
      keys: "/help",
      category: "claude",
      group: "快捷命令",
    },
    {
      id: "claude_add_dir",
      name: "添加工作目录",
      description: "添加更多工作目录",
      keys: "/add-dir",
      category: "claude",
      group: "快捷命令",
    },
    {
      id: "claude_bug",
      name: "报告错误",
      description: "向 Anthropic 报告错误",
      keys: "/bug",
      category: "claude",
      group: "快捷命令",
    },
    {
      id: "claude_clear",
      name: "清除聊天记录",
      description: "清除当前对话历史",
      keys: "/clear",
      category: "claude",
      group: "快捷命令",
    },
    {
      id: "claude_compact",
      name: "压缩上下文",
      description: "压缩对话上下文以节省 Token",
      keys: "/compact",
      category: "claude",
      group: "快捷命令",
    },
    {
      id: "claude_config",
      name: "配置菜单",
      description: "打开配置菜单",
      keys: "/config",
      category: "claude",
      group: "快捷命令",
    },
    {
      id: "claude_cost",
      name: "Token 花费统计",
      description: "查看 Token 使用统计",
      keys: "/cost",
      category: "claude",
      group: "快捷命令",
    },
    {
      id: "claude_doctor",
      name: "完整性检查",
      description: "客户端完整性检查",
      keys: "/doctor",
      category: "claude",
      group: "快捷命令",
    },
    {
      id: "claude_exit",
      name: "退出",
      description: "退出 Claude Code",
      keys: "/exit",
      category: "claude",
      group: "快捷命令",
    },
    {
      id: "claude_init",
      name: "初始化项目",
      description: "初始化项目，生成 CLAUDE.md 全局记忆",
      keys: "/init",
      category: "claude",
      group: "快捷命令",
    },
    {
      id: "claude_mcp_list",
      name: "MCP 列表",
      description: "查看 MCP 列表和状态",
      keys: "/mcp",
      category: "claude",
      group: "快捷命令",
    },
    {
      id: "claude_memory",
      name: "编辑记忆",
      description: "编辑 Claude 记忆",
      keys: "/memory",
      category: "claude",
      group: "快捷命令",
    },
    {
      id: "claude_model",
      name: "更换模型",
      description: "切换 AI 模型",
      keys: "/model",
      category: "claude",
      group: "快捷命令",
    },
    {
      id: "claude_permissions",
      name: "修改工具权限",
      description: "修改工具权限设置",
      keys: "/permissions",
      category: "claude",
      group: "快捷命令",
    },
    {
      id: "claude_pr_comments",
      name: "查看 PR 评论",
      description: "查看 Pull Request 评论",
      keys: "/pr_comments",
      category: "claude",
      group: "快捷命令",
    },
    {
      id: "claude_review",
      name: "代码审查",
      description: "请求代码审查",
      keys: "/review",
      category: "claude",
      group: "快捷命令",
    },
    {
      id: "claude_sessions",
      name: "会话列表",
      description: "列出 sessions 列表",
      keys: "/sessions",
      category: "claude",
      group: "快捷命令",
    },
    {
      id: "claude_status",
      name: "系统状态",
      description: "查看系统/账户状态",
      keys: "/status",
      category: "claude",
      group: "快捷命令",
    },
    {
      id: "claude_terminal_setup",
      name: "终端设置",
      description: "安装 Shift+Enter 绑定",
      keys: "/terminal-setup",
      category: "claude",
      group: "快捷命令",
    },
    {
      id: "claude_vim",
      name: "Vim 模式",
      description: "切换 vim 模式",
      keys: "/vim",
      category: "claude",
      group: "快捷命令",
    },
    // Think 模式
    {
      id: "claude_think",
      name: "基础思考",
      description: "激活基础思考模式（2-5秒）",
      keys: "think",
      category: "claude",
      group: "Think 模式",
    },
    {
      id: "claude_think_hard",
      name: "深度思考",
      description: "激活深度思考模式（5-15秒）",
      keys: "think hard",
      category: "claude",
      group: "Think 模式",
    },
    {
      id: "claude_think_harder",
      name: "更深度思考",
      description: "激活更深度思考模式（15-30秒）",
      keys: "think harder",
      category: "claude",
      group: "Think 模式",
    },
    {
      id: "claude_ultrathink",
      name: "极深度思考",
      description: "激活极深度思考模式（30-60秒）",
      keys: "ultrathink",
      category: "claude",
      group: "Think 模式",
    },
    // 快捷键
    {
      id: "claude_esc",
      name: "中断操作",
      description: "停止 AI 执行",
      keys: "ESC",
      category: "claude",
      group: "快捷键",
    },
    {
      id: "claude_ctrl_z",
      name: "退出模式",
      description: "返回普通终端",
      keys: "Ctrl+Z",
      category: "claude",
      group: "快捷键",
    },
    {
      id: "claude_ctrl_v",
      name: "粘贴图片",
      description: "直接粘贴截图分析",
      keys: "Ctrl+V",
      category: "claude",
      group: "快捷键",
    },
    {
      id: "claude_ctrl_c",
      name: "强制退出",
      description: "强制终止程序",
      keys: "Ctrl+C",
      category: "claude",
      group: "快捷键",
    },
    {
      id: "claude_tab",
      name: "自动补全",
      description: "补全命令和路径",
      keys: "Tab",
      category: "claude",
      group: "快捷键",
    },
  ];
}

/**
 * 获取 OpenSpec 的快捷键
 */
function getOpenSpecShortcuts(): ShortcutInfo[] {
  return [
    // 核心命令
    {
      id: "openspec_proposal",
      name: "创建变更提案",
      description: "创建新的 OpenSpec 变更提案",
      keys: "/openspec:proposal",
      category: "openspec",
      group: "核心命令",
    },
    {
      id: "openspec_apply",
      name: "应用变更",
      description: "应用已批准的 OpenSpec 变更",
      keys: "/openspec:apply",
      category: "openspec",
      group: "核心命令",
    },
    {
      id: "openspec_archive",
      name: "归档变更",
      description: "归档已部署的 OpenSpec 变更",
      keys: "/openspec:archive",
      category: "openspec",
      group: "核心命令",
    },
    // 辅助命令
    {
      id: "openspec_validate",
      name: "验证变更",
      description: "验证 OpenSpec 变更的正确性",
      keys: "openspec validate",
      category: "openspec",
      group: "辅助命令",
    },
    {
      id: "openspec_list",
      name: "列出变更",
      description: "列出所有 OpenSpec 变更",
      keys: "openspec list",
      category: "openspec",
      group: "辅助命令",
    },
    {
      id: "openspec_show",
      name: "显示详情",
      description: "显示 OpenSpec 变更或规范的详细信息",
      keys: "openspec show",
      category: "openspec",
      group: "辅助命令",
    },
    // 文档结构说明
    {
      id: "openspec_doc_structure_info",
      name: "Feature 文档结构说明",
      description:
        "1.proposal.md:说明为什么要做这个功能 2.spec.md:定义要做什么 3.design.md:定义怎么做 4.tasks.md:定义谁做什么、顺序与依赖",
      keys: "changes/<feature>/",
      category: "openspec",
      group: "文档结构说明",
      copyContent: "",
    },
  ];
}

/**
 * 获取插件的快捷键
 */
function getPluginShortcuts(): ShortcutInfo[] {
  return [
    // 目录索引功能
    {
      id: "plugin_insert_index",
      name: "插入索引",
      description: "插入当前文档的子文档索引",
      keys: "Ctrl+Alt+I",
      category: "plugin",
      group: "目录索引",
    },
    {
      id: "plugin_insert_subdocs_ref",
      name: "插入子文档引用",
      description: "插入子文档引用列表",
      keys: "Ctrl+Alt+R",
      category: "plugin",
      group: "目录索引",
    },
    {
      id: "plugin_insert_subdocs_outline",
      name: "插入子文档大纲",
      description: "插入子文档及其大纲",
      keys: "Ctrl+Alt+O",
      category: "plugin",
      group: "目录索引",
    },
    // 页面锁定功能
    {
      id: "plugin_page_lock",
      name: "锁定/解锁页面",
      description: "对当前文档进行加密锁定或解锁",
      keys: "Icon Click",
      category: "plugin",
      group: "页面锁定",
    },
    // 图片压缩功能
    {
      id: "plugin_image_compressor",
      name: "打开图片压缩器",
      description: "扫描并压缩资源库中的图片",
      keys: "Icon Click",
      category: "plugin",
      group: "图片压缩",
    },
  ];
}

/**
 * 获取开发工具的快捷键 (npm, nvm, cmd, vscode, Visual Studio)
 */
function getToolShortcuts(): ShortcutInfo[] {
  return [
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
      id: "tool_npm_run_dev",
      name: "npm run dev",
      description: "开发环境运行",
      keys: "Ctrl+Alt+Shift+D",
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
    // CMD 命令列表
    {
      id: "tool_cmd_dir",
      name: "dir",
      description: "列出目录内容",
      keys: "",
      category: "cmd",
      group: "Windows CMD",
      copyContent: "dir",
    },
    {
      id: "tool_cmd_cd",
      name: "cd",
      description: "切换目录",
      keys: "",
      category: "cmd",
      group: "Windows CMD",
      copyContent: "cd",
    },
    {
      id: "tool_cmd_mkdir",
      name: "mkdir",
      description: "创建新目录",
      keys: "",
      category: "cmd",
      group: "Windows CMD",
      copyContent: "mkdir",
    },
    {
      id: "tool_cmd_copy",
      name: "copy",
      description: "复制文件",
      keys: "",
      category: "cmd",
      group: "Windows CMD",
      copyContent: "copy",
    },
    {
      id: "tool_cmd_del",
      name: "del",
      description: "删除文件",
      keys: "",
      category: "cmd",
      group: "Windows CMD",
      copyContent: "del",
    },
    {
      id: "tool_cmd_move",
      name: "move",
      description: "移动文件",
      keys: "",
      category: "cmd",
      group: "Windows CMD",
      copyContent: "move",
    },
    {
      id: "tool_cmd_rename",
      name: "ren",
      description: "重命名文件",
      keys: "",
      category: "cmd",
      group: "Windows CMD",
      copyContent: "ren",
    },
    {
      id: "tool_cmd_cls",
      name: "cls",
      description: "清屏",
      keys: "",
      category: "cmd",
      group: "Windows CMD",
      copyContent: "cls",
    },
    {
      id: "tool_cmd_tree",
      name: "tree",
      description: "显示目录树",
      keys: "",
      category: "cmd",
      group: "Windows CMD",
      copyContent: "tree",
    },
    {
      id: "tool_cmd_type",
      name: "type",
      description: "显示文件内容",
      keys: "",
      category: "cmd",
      group: "Windows CMD",
      copyContent: "type",
    },
    {
      id: "tool_cmd_xcopy",
      name: "xcopy",
      description: "高级复制文件",
      keys: "",
      category: "cmd",
      group: "Windows CMD",
      copyContent: "xcopy",
    },
    {
      id: "tool_cmd_robocopy",
      name: "robocopy",
      description: "强大的复制工具",
      keys: "",
      category: "cmd",
      group: "Windows CMD",
      copyContent: "robocopy",
    },
    {
      id: "tool_cmd_ipconfig",
      name: "ipconfig",
      description: "显示网络配置",
      keys: "",
      category: "cmd",
      group: "Windows CMD",
      copyContent: "ipconfig",
    },
    {
      id: "tool_cmd_ping",
      name: "ping",
      description: "测试网络连通性",
      keys: "",
      category: "cmd",
      group: "Windows CMD",
      copyContent: "ping",
    },
    {
      id: "tool_cmd_tracert",
      name: "tracert",
      description: "跟踪网络路径",
      keys: "",
      category: "cmd",
      group: "Windows CMD",
      copyContent: "tracert",
    },
    {
      id: "tool_cmd_nslookup",
      name: "nslookup",
      description: "DNS 查询工具",
      keys: "",
      category: "cmd",
      group: "Windows CMD",
      copyContent: "nslookup",
    },
    {
      id: "tool_cmd_tasklist",
      name: "tasklist",
      description: "列出运行进程",
      keys: "",
      category: "cmd",
      group: "Windows CMD",
      copyContent: "tasklist",
    },
    {
      id: "tool_cmd_taskkill",
      name: "taskkill",
      description: "结束进程",
      keys: "",
      category: "cmd",
      group: "Windows CMD",
      copyContent: "taskkill",
    },
    {
      id: "tool_cmd_netstat",
      name: "netstat",
      description: "显示网络连接",
      keys: "",
      category: "cmd",
      group: "Windows CMD",
      copyContent: "netstat",
    },
    {
      id: "tool_cmd_systeminfo",
      name: "systeminfo",
      description: "显示系统信息",
      keys: "",
      category: "cmd",
      group: "Windows CMD",
      copyContent: "systeminfo",
    },
    {
      id: "tool_cmd_sfc",
      name: "sfc /scannow",
      description: "系统文件检查器",
      keys: "",
      category: "cmd",
      group: "Windows CMD",
      copyContent: "sfc /scannow",
    },
    {
      id: "tool_cmd_chkdsk",
      name: "chkdsk",
      description: "检查磁盘",
      keys: "",
      category: "cmd",
      group: "Windows CMD",
      copyContent: "chkdsk",
    },
    {
      id: "tool_cmd_format",
      name: "format",
      description: "格式化磁盘",
      keys: "",
      category: "cmd",
      group: "Windows CMD",
      copyContent: "format",
    },
    {
      id: "tool_cmd_diskpart",
      name: "diskpart",
      description: "磁盘管理工具",
      keys: "",
      category: "cmd",
      group: "Windows CMD",
      copyContent: "diskpart",
    },
    {
      id: "tool_cmd_powercfg",
      name: "powercfg",
      description: "电源配置管理",
      keys: "",
      category: "cmd",
      group: "Windows CMD",
      copyContent: "powercfg",
    },
    // Visual Studio Code 快捷键
    {
      id: "tool_vscode_command_palette",
      name: "Command Palette",
      description: "打开命令面板",
      keys: "Ctrl+Shift+P",
      category: "vscode",
      group: "VS Code",
      copyContent: "Ctrl+Shift+P",
    },
    {
      id: "tool_vscode_terminal",
      name: "Integrated Terminal",
      description: "打开集成终端",
      keys: "Ctrl+`",
      category: "vscode",
      group: "VS Code",
      copyContent: "Ctrl+`",
    },
    {
      id: "tool_vscode_format",
      name: "Format Document",
      description: "格式化文档",
      keys: "Shift+Alt+F",
      category: "vscode",
      group: "VS Code",
      copyContent: "Shift+Alt+F",
    },
    {
      id: "tool_vscode_find",
      name: "Find",
      description: "查找",
      keys: "Ctrl+F",
      category: "vscode",
      group: "VS Code",
      copyContent: "Ctrl+F",
    },
    {
      id: "tool_vscode_replace",
      name: "Replace",
      description: "替换",
      keys: "Ctrl+H",
      category: "vscode",
      group: "VS Code",
      copyContent: "Ctrl+H",
    },
    {
      id: "tool_vscode_toggle_terminal",
      name: "Toggle Terminal",
      description: "切换终端可见性",
      keys: "Ctrl+`",
      category: "vscode",
      group: "VS Code",
      copyContent: "Ctrl+`",
    },
    {
      id: "tool_vscode_go_to_file",
      name: "Go to File",
      description: "快速打开文件",
      keys: "Ctrl+P",
      category: "vscode",
      group: "VS Code",
      copyContent: "Ctrl+P",
    },
    {
      id: "tool_vscode_go_to_line",
      name: "Go to Line",
      description: "跳转到指定行",
      keys: "Ctrl+G",
      category: "vscode",
      group: "VS Code",
      copyContent: "Ctrl+G",
    },
    {
      id: "tool_vscode_show_problems",
      name: "Problems Panel",
      description: "显示问题面板",
      keys: "Ctrl+Shift+M",
      category: "vscode",
      group: "VS Code",
      copyContent: "Ctrl+Shift+M",
    },
    {
      id: "tool_vscode_show_output",
      name: "Output Panel",
      description: "显示输出面板",
      keys: "Ctrl+Shift+U",
      category: "vscode",
      group: "VS Code",
      copyContent: "Ctrl+Shift+U",
    },
    {
      id: "tool_vscode_show_debug_console",
      name: "Debug Console",
      description: "显示调试控制台",
      keys: "Ctrl+Shift+Y",
      category: "vscode",
      group: "VS Code",
      copyContent: "Ctrl+Shift+Y",
    },
    {
      id: "tool_vscode_toggle_sidebar",
      name: "Toggle Sidebar",
      description: "切换侧边栏",
      keys: "Ctrl+B",
      category: "vscode",
      group: "VS Code",
      copyContent: "Ctrl+B",
    },
    {
      id: "tool_vscode_quick_open",
      name: "Quick Open",
      description: "快速打开",
      keys: "Ctrl+E",
      category: "vscode",
      group: "VS Code",
      copyContent: "Ctrl+E",
    },
    {
      id: "tool_vscode_new_file",
      name: "New File",
      description: "新建文件",
      keys: "Ctrl+N",
      category: "vscode",
      group: "VS Code",
      copyContent: "Ctrl+N",
    },
    {
      id: "tool_vscode_open_file",
      name: "Open File",
      description: "打开文件",
      keys: "Ctrl+O",
      category: "vscode",
      group: "VS Code",
      copyContent: "Ctrl+O",
    },
    {
      id: "tool_vscode_save",
      name: "Save",
      description: "保存文件",
      keys: "Ctrl+S",
      category: "vscode",
      group: "VS Code",
      copyContent: "Ctrl+S",
    },
    {
      id: "tool_vscode_save_all",
      name: "Save All",
      description: "保存所有文件",
      keys: "Ctrl+K, S",
      category: "vscode",
      group: "VS Code",
      copyContent: "Ctrl+K, S",
    },
    {
      id: "tool_vscode_close_editor",
      name: "Close Editor",
      description: "关闭编辑器",
      keys: "Ctrl+W",
      category: "vscode",
      group: "VS Code",
      copyContent: "Ctrl+W",
    },
    {
      id: "tool_vscode_split_editor",
      name: "Split Editor",
      description: "拆分编辑器",
      keys: "Ctrl+\\",
      category: "vscode",
      group: "VS Code",
      copyContent: "Ctrl+\\",
    },
    {
      id: "tool_vscode_Zen_Mode",
      name: "Zen Mode",
      description: "禅模式",
      keys: "Ctrl+K, Z",
      category: "vscode",
      group: "VS Code",
      copyContent: "Ctrl+K, Z",
    },
    {
      id: "tool_vscode_toggle_fullscreen",
      name: "Toggle Fullscreen",
      description: "切换全屏",
      keys: "F11",
      category: "vscode",
      group: "VS Code",
      copyContent: "F11",
    },
    // Visual Studio 快捷键
    {
      id: "tool_vs_solution_explorer",
      name: "Solution Explorer",
      description: "打开解决方案资源管理器",
      keys: "Ctrl+Alt+L",
      category: "visual-studio",
      group: "Visual Studio",
      copyContent: "Ctrl+Alt+L",
    },
    {
      id: "tool_vs_team_explorer",
      name: "Team Explorer",
      description: "打开团队资源管理器",
      keys: "Ctrl+Alt+M",
      category: "visual-studio",
      group: "Visual Studio",
      copyContent: "Ctrl+Alt+M",
    },
    {
      id: "tool_vs_build_solution",
      name: "Build Solution",
      description: "生成解决方案",
      keys: "Ctrl+Shift+B",
      category: "visual-studio",
      group: "Visual Studio",
      copyContent: "Ctrl+Shift+B",
    },
    {
      id: "tool_vs_start_debugging",
      name: "Start Debugging",
      description: "开始调试",
      keys: "F5",
      category: "visual-studio",
      group: "Visual Studio",
      copyContent: "F5",
    },
    {
      id: "tool_vs_find_in_files",
      name: "Find in Files",
      description: "在文件中查找",
      keys: "Ctrl+Shift+F",
      category: "visual-studio",
      group: "Visual Studio",
      copyContent: "Ctrl+Shift+F",
    },
    {
      id: "tool_vs_properties_window",
      name: "Properties Window",
      description: "显示属性窗口",
      keys: "F4",
      category: "visual-studio",
      group: "Visual Studio",
      copyContent: "F4",
    },
    {
      id: "tool_vs_error_list",
      name: "Error List",
      description: "显示错误列表",
      keys: "Ctrl+\\, E",
      category: "visual-studio",
      group: "Visual Studio",
      copyContent: "Ctrl+\\, E",
    },
    {
      id: "tool_vs_output_window",
      name: "Output Window",
      description: "显示输出窗口",
      keys: "Ctrl+\\, O",
      category: "visual-studio",
      group: "Visual Studio",
      copyContent: "Ctrl+\\, O",
    },
    {
      id: "tool_vs_class_view",
      name: "Class View",
      description: "显示类视图",
      keys: "Ctrl+Shift+C",
      category: "visual-studio",
      group: "Visual Studio",
      copyContent: "Ctrl+Shift+C",
    },
    {
      id: "tool_vs_object_browser",
      name: "Object Browser",
      description: "显示对象浏览器",
      keys: "Ctrl+Alt+J",
      category: "visual-studio",
      group: "Visual Studio",
      copyContent: "Ctrl+Alt+J",
    },
    {
      id: "tool_vs_code_definition_window",
      name: "Code Definition Window",
      description: "显示代码定义窗口",
      keys: "Ctrl+\\, D",
      category: "visual-studio",
      group: "Visual Studio",
      copyContent: "Ctrl+\\, D",
    },
    {
      id: "tool_vs_server_explorer",
      name: "Server Explorer",
      description: "显示服务器资源管理器",
      keys: "Ctrl+Alt+S",
      category: "visual-studio",
      group: "Visual Studio",
      copyContent: "Ctrl+Alt+S",
    },
    {
      id: "tool_vs_stop_debugging",
      name: "Stop Debugging",
      description: "停止调试",
      keys: "Shift+F5",
      category: "visual-studio",
      group: "Visual Studio",
      copyContent: "Shift+F5",
    },
    {
      id: "tool_vs_step_over",
      name: "Step Over",
      description: "单步跳过",
      keys: "F10",
      category: "visual-studio",
      group: "Visual Studio",
      copyContent: "F10",
    },
    {
      id: "tool_vs_step_into",
      name: "Step Into",
      description: "单步执行",
      keys: "F11",
      category: "visual-studio",
      group: "Visual Studio",
      copyContent: "F11",
    },
    {
      id: "tool_vs_step_out",
      name: "Step Out",
      description: "单步跳出",
      keys: "Shift+F11",
      category: "visual-studio",
      group: "Visual Studio",
      copyContent: "Shift+F11",
    },
    {
      id: "tool_vs_toggle_breakpoint",
      name: "Toggle Breakpoint",
      description: "切换断点",
      keys: "F9",
      category: "visual-studio",
      group: "Visual Studio",
      copyContent: "F9",
    },
    {
      id: "tool_vs_run_to_cursor",
      name: "Run to Cursor",
      description: "运行到光标处",
      keys: "Ctrl+F10",
      category: "visual-studio",
      group: "Visual Studio",
      copyContent: "Ctrl+F10",
    },
    {
      id: "tool_vs_set_next_statement",
      name: "Set Next Statement",
      description: "设置下一语句",
      keys: "Ctrl+Shift+F10",
      category: "visual-studio",
      group: "Visual Studio",
      copyContent: "Ctrl+Shift+F10",
    },
    {
      id: "tool_vs_comment_selection",
      name: "Comment Selection",
      description: "注释选中代码",
      keys: "Ctrl+K, Ctrl+C",
      category: "visual-studio",
      group: "Visual Studio",
      copyContent: "Ctrl+K, Ctrl+C",
    },
    {
      id: "tool_vs_uncomment_selection",
      name: "Uncomment Selection",
      description: "取消注释选中代码",
      keys: "Ctrl+K, Ctrl+U",
      category: "visual-studio",
      group: "Visual Studio",
      copyContent: "Ctrl+K, Ctrl+U",
    },
    {
      id: "tool_vs_format_document",
      name: "Format Document",
      description: "格式化整个文档",
      keys: "Ctrl+K, Ctrl+D",
      category: "visual-studio",
      group: "Visual Studio",
      copyContent: "Ctrl+K, Ctrl+D",
    },
    {
      id: "tool_vs_format_selection",
      name: "Format Selection",
      description: "格式化选中代码",
      keys: "Ctrl+K, Ctrl+F",
      category: "visual-studio",
      group: "Visual Studio",
      copyContent: "Ctrl+K, Ctrl+F",
    },
    {
      id: "tool_vs_go_to_definition",
      name: "Go to Definition",
      description: "转到定义",
      keys: "F12",
      category: "visual-studio",
      group: "Visual Studio",
      copyContent: "F12",
    },
    {
      id: "tool_vs_peek_definition",
      name: "Peek Definition",
      description: "查看定义",
      keys: "Alt+F12",
      category: "visual-studio",
      group: "Visual Studio",
      copyContent: "Alt+F12",
    },
    {
      id: "tool_vs_find_all_references",
      name: "Find All References",
      description: "查找所有引用",
      keys: "Shift+F12",
      category: "visual-studio",
      group: "Visual Studio",
      copyContent: "Shift+F12",
    },
    {
      id: "tool_vs_navigate_to",
      name: "Navigate To",
      description: "导航到",
      keys: "Ctrl+,",
      category: "visual-studio",
      group: "Visual Studio",
      copyContent: "Ctrl+,",
    },
    {
      id: "tool_vs_quick_find",
      name: "Quick Find",
      description: "快速查找",
      keys: "Ctrl+F",
      category: "visual-studio",
      group: "Visual Studio",
      copyContent: "Ctrl+F",
    },
    {
      id: "tool_vs_replace",
      name: "Replace",
      description: "替换",
      keys: "Ctrl+H",
      category: "visual-studio",
      group: "Visual Studio",
      copyContent: "Ctrl+H",
    },
  ];
}

/**
 * 添加快捷键 Dock 到右侧边栏
 */
function addShortcutDock(plugin: Plugin) {
  plugin.addDock({
    config: {
      position: "RightTop",
      size: { width: 480, height: 0 },
      icon: "iconKeymap",
      title: plugin.i18n.shortcuts || "快捷键",
      show: false,
    },
    data: {},
    type: "shortcut-panel-dock",
    init(dock: any) {
      // 创建 Vue 应用
      const container = document.createElement("div");
      container.style.height = "100%";
      container.style.overflow = "hidden";

      const app = createApp({
        setup() {
          return () =>
            h(ShortcutPanel, {
              i18n: plugin.i18n,
              plugin: plugin,
            });
        },
      });

      app.mount(container);
      dock.element?.appendChild(container);

      // 保存应用引用，以便卸载时清理
      dock.__app = app;
      dock.__container = container;
    },
  });
}

/**
 * 导出公共接口供用户自定义添加快捷键
 */
export async function addCustomShortcut(shortcut: ShortcutInfo) {
  const manager = getShortcutManager();
  await manager.addShortcut(shortcut);
}

/**
 * 批量添加自定义快捷键
 */
export async function addCustomShortcuts(shortcuts: ShortcutInfo[]) {
  const manager = getShortcutManager();
  await manager.addShortcuts(shortcuts);
}

/**
 * 获取快捷键管理器
 */
export { getShortcutManager, ShortcutManager };

/**
 * 导出类型
 */
export type {
  ShortcutInfo,
  ShortcutGroup,
  ViewMode,
  DialogType,
  QuickFilter,
  ShortcutFormData,
} from "./types";
