// Git 配置键中文说明映射与通配匹配（供 GitConfigDialog 展示 git config --list 条目说明）

/** Git 配置键中文说明映射（git config --list 输出键为全小写+子节原样，通配类键由 getConfigDesc 处理） */
const GIT_CONFIG_DESC: Record<string, string> = {
  // 用户信息
  "user.name": "用户名",
  "user.email": "邮箱",
  "user.signingkey": "签名密钥",
  // 换行符
  "core.autocrlf": "自动换行符转换",
  "core.safecrlf": "安全换行检查",
  "core.eol": "默认换行符",
  // 编辑器与工具
  "core.editor": "默认编辑器",
  "core.pager": "分页器",
  "core.commentchar": "注释字符",
  // 路径与编码
  "core.quotepath": "路径引号",
  "core.ignorecase": "忽略大小写",
  "core.precomposeunicode": "Unicode 预组合",
  "core.hooksPath": "钩子路径",
  "core.sshCommand": "SSH 命令",
  // 文件模式
  "core.filemode": "文件权限追踪",
  "core.symlinks": "符号链接支持",
  "core.bare": "裸仓库",
  "core.logallrefupdates": "记录所有引用更新",
  "core.repositoryformatversion": "仓库格式版本",
  // 初始化
  "init.defaultBranch": "默认分支名",
  // 拉取与合并
  "pull.rebase": "拉取策略(rebase)",
  "pull.ff": "快进合并",
  "merge.tool": "合并工具",
  "merge.conflictstyle": "冲突展示风格",
  "diff.tool": "差异工具",
  "diff.algorithm": "差异算法",
  // 凭据
  "credential.helper": "凭据助手",
  "credential.usehttppath": "HTTP 路径匹配",
  // 代理与网络
  "http.proxy": "HTTP 代理",
  "https.proxy": "HTTPS 代理",
  "http.sslVerify": "SSL 验证",
  "http.sslbackend": "SSL 后端",
  "http.postBuffer": "推送缓冲区大小",
  "http.lowspeedlimit": "最低传输速度",
  "http.lowspeedtime": "最低传输超时",
  "http.version": "HTTP 协议版本",
  // 协议
  "protocol.version": "协议版本",
  "protocol.allow": "协议允许列表",
  // 过滤器
  "filter.lfs.clean": "LFS 清理过滤器",
  "filter.lfs.smudge": "LFS 恢复过滤器",
  "filter.lfs.process": "LFS 进程过滤器",
  "filter.lfs.required": "LFS 必须启用",
  // 签名
  "commit.gpgsign": "提交 GPG 签名",
  "tag.gpgsign": "标签 GPG 签名",
  "gpg.program": "GPG 程序",
  // 颜色
  "color.ui": "颜色输出",
  "color.diff": "差异颜色",
  "color.branch": "分支颜色",
  "color.status": "状态颜色",
  "color.interactive": "交互颜色",
  // 推送
  "push.default": "推送默认行为",
  "push.autoSetupRemote": "自动设置上游",
  "push.followTags": "推送时附带标签",
  // 分支
  "branch.autosetupmerge": "自动设置合并",
  "branch.sort": "分支排序",
  // Rebase
  "rebase.autosquash": "自动压缩修复提交",
  "rebase.autostash": "自动暂存变更",
  // Rerere
  "rerere.enabled": "重用冲突解决",
  "rerere.autoupdate": "自动更新冲突",
  // 子模块
  "submodule.recurse": "子模块递归",
  "submodule.active": "活跃子模块",
  // 安全
  "safe.directory": "安全目录",
  "safe.bareRepository": "安全裸仓库",
  // 其他
  "help.autocorrect": "自动纠错",
  "gc.auto": "自动垃圾回收",
  "gc.autodetach": "后台垃圾回收",
  "pack.threads": "打包线程数",
  "pack.windowMemory": "打包内存窗口",
  "advice.detachedhead": "分离头提示",
  "advice.skippedcherrypicks": "跳过拣选提示",
  "blame.markignoredlines": "忽略行标记",
  "blame.markunblamablelines": "无法追溯行标记",
  "checkout.defaultRemote": "默认远程",
  "fetch.prune": "清理已删除远程分支",
  "fetch.parallel": "并行获取",
  "format.pretty": "默认日志格式",
  "gui.encoding": "GUI 编码",
  "i18n.commitencoding": "提交信息编码",
  "i18n.logoutputencoding": "日志输出编码",
  "interactive.difffilter": "交互差异过滤器",
  "log.date": "日志日期格式",
  "log.decorate": "日志装饰",
  "lfs.storage": "LFS 存储路径",
  "maintenance.auto": "自动维护",
  "notes.rewriteref": "笔记重写规则",
  "pack.packsizelimit": "包大小限制",
  "rebase.backend": "变基后端",
  "rebase.instructionformat": "变基指令格式",
  "splitindex.maxpercentchange": "分割索引变更阈值",
  "status.relativePaths": "状态相对路径",
  "tag.sort": "标签排序",
  "transfer.fsckobjects": "传输校验",
  "uploadpack.allowfilter": "允许部分克隆",
}

/** Git 配置作用域：全局（~/.gitconfig）或项目级（<project>/.git/config） */
export type GitConfigScope = "global" | "local"

/** git config --list 输出解析后的配置条目 */
export interface GitConfigEntry {
  key: string
  value: string
  desc: string
}

/** 解析 git config --list 输出为 key-value 数组（含中文说明），跳过无 = 的行 */
export function parseGitConfigText(text: string): GitConfigEntry[] {
  if (!text) return []
  return text
    .split("\n")
    .filter((line) => line.includes("="))
    .map((line) => {
      const eqIdx = line.indexOf("=")
      const key = line.substring(0, eqIdx)
      return {
        key,
        value: line.substring(eqIdx + 1),
        desc: getConfigDesc(key),
      }
    })
}

/** 常用 Git 全局配置键预设（新增配置项时下拉选择，label 与说明映射同源） */
export const GIT_PRESET_KEYS: { key: string, label: string }[] = [
  { key: "user.name", label: "用户名" },
  { key: "user.email", label: "邮箱" },
  { key: "user.signingkey", label: "签名密钥" },
  { key: "core.autocrlf", label: "自动换行符转换" },
  { key: "core.editor", label: "默认编辑器" },
  { key: "core.quotepath", label: "路径引号" },
  { key: "init.defaultBranch", label: "默认分支名" },
  { key: "pull.rebase", label: "拉取策略(rebase)" },
  { key: "push.default", label: "推送默认行为" },
  { key: "push.autoSetupRemote", label: "自动设置上游" },
  { key: "credential.helper", label: "凭据助手" },
  { key: "http.proxy", label: "HTTP 代理" },
  { key: "https.proxy", label: "HTTPS 代理" },
]

/** 查找配置键中文说明：精确匹配优先，其次按前缀/正则通配（alias.*、remote.*.url 等），无匹配返回空串 */
export function getConfigDesc(key: string): string {
  if (GIT_CONFIG_DESC[key]) return GIT_CONFIG_DESC[key]
  // alias.* → 别名
  if (key.startsWith("alias.")) return "别名: " + key.substring(6)
  // remote.*.url → 远程仓库地址
  if (/^remote\..+\.url$/.test(key)) return `远程 ${key.split(".")[1]} 地址`
  // remote.*.fetch → 远程仓库获取规则
  if (/^remote\..+\.fetch$/.test(key)) return `远程 ${key.split(".")[1]} 获取规则`
  // remote.*.pushurl → 远程仓库推送地址
  if (/^remote\..+\.pushurl$/.test(key)) return `远程 ${key.split(".")[1]} 推送地址`
  // filter.*.* → 过滤器
  if (key.startsWith("filter.")) {
    const parts = key.split(".")
    return `过滤器 ${parts[1]}.${parts[2]}`
  }
  // url.*.insteadOf → URL 替换规则
  if (key.startsWith("url.") && key.endsWith(".insteadof")) return "URL 替换规则"
  // credential.* → 凭据配置
  if (key.startsWith("credential.")) return `凭据: ${key.substring(11)}`
  // diff.* → 差异配置
  if (key.startsWith("diff.")) return `差异: ${key.substring(5)}`
  // merge.* → 合并配置
  if (key.startsWith("merge.")) return `合并: ${key.substring(6)}`
  // pack.* → 打包配置
  if (key.startsWith("pack.")) return `打包: ${key.substring(5)}`
  // branch.* → 分支配置
  if (key.startsWith("branch.")) return `分支: ${key.substring(7)}`
  return ""
}
