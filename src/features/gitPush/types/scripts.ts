// gitPush 项目脚本识别结果类型（前端 scripts / .NET 命令 / 脚本文件）
/** 脚本来源类别：package.json scripts / .NET(sln·csproj) 命令 / 独立脚本文件 */
export type ScriptKind = "package" | "dotnet" | "scriptFile"

/** 可识别的包管理器（按锁文件判定，影响 npm 系命令前缀） */
export type PackageManager = "npm" | "pnpm" | "yarn"

/** 单条可运行脚本/命令 */
export interface ProjectScript {
  /** 唯一 id（kind:source:label） */
  id: string
  kind: ScriptKind
  /** 显示名：npm script 名 / dotnet 子命令 / 脚本文件名 */
  label: string
  /** 可执行命令（npm/pnpm/yarn/dotnet/cmd/sh/...） */
  command: string
  args: string[]
  /** 运行工作目录（绝对路径，统一为项目根） */
  cwd: string
  /** 来源文件（相对项目根，POSIX 分隔符，展示用） */
  source: string
  /** 原始内容（package.json 的命令串；dotnet/脚本文件为空串） */
  detail: string
  /** 命令行预览字符串（command + args 拼接） */
  preview: string
}

/** 同源脚本分组（一个 package.json / 一个 sln·csproj / 全部独立脚本文件） */
export interface ScriptGroup {
  kind: ScriptKind
  /** 分组来源标识（package.json 相对路径 / sln·csproj 相对路径 / 脚本文件目录） */
  source: string
  scripts: ProjectScript[]
}

/** 项目脚本识别结果 */
export interface ScriptScanResult {
  /** 被扫描的项目根（绝对路径） */
  root: string
  groups: ScriptGroup[]
}

/** dotnet 子命令 → i18n 键映射（label 为 CLI 动词原文，UI 按此翻译展示） */
export const DOTNET_VERB_KEYS: Record<string, string> = {
  restore: "scriptVerbRestore",
  build: "scriptVerbBuild",
  run: "scriptVerbRun",
  test: "scriptVerbTest",
  publish: "scriptVerbPublish",
}
