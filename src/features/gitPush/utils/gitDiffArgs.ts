// gitPush 补丁类 git 命令参数构造（纯函数）
//
// 统一注入防污染开关：用户 .gitconfig 里的 color.ui=always 会插入 ANSI 转义，
// diff.noprefix / diff.mnemonicPrefix 会改掉 a/、b/ 前缀（parseChangesetDiff 靠它取路径），
// diff.external / textconv 则会让输出不再是标准补丁。任何一项生效都会让解析静默错位。

/** 所有带补丁输出的命令（diff / show / log -p）共用的安全参数 */
export const DIFF_SAFE_ARGS: readonly string[] = [
  "--no-color",
  "--no-ext-diff",
  "--no-textconv",
  "--src-prefix=a/",
  "--dst-prefix=b/",
  "--no-relative",
]

export interface WorktreeDiffArgsOptions {
  /** 暂存区范围（git diff --cached） */
  staged?: boolean
  /** 上下文行数；0/缺省保持 git 默认 3 行 */
  context?: number
  /** 只算变更文件清单（--stat=<width>），与补丁输出互斥 */
  statWidth?: number
  /** 路径（放在 -- 之后） */
  paths?: string[]
}

/** 工作区/暂存区 diff 参数 */
export function buildWorktreeDiffArgs(opts: WorktreeDiffArgsOptions = {}): string[] {
  const args = ["diff", ...DIFF_SAFE_ARGS]
  if ((opts.context ?? 0) > 0) args.push(`-U${opts.context}`)
  if (opts.staged) args.push("--cached")
  if (opts.statWidth && opts.statWidth > 0) args.push(`--stat=${opts.statWidth}`)
  if (opts.paths?.length) args.push("--", ...opts.paths)
  return args
}

/** 未跟踪/新增文件：与 /dev/null 比较展示完整新增内容（有差异时退出码为 1） */
export function buildNoIndexDiffArgs(file: string): string[] {
  return ["diff", ...DIFF_SAFE_ARGS, "--no-index", "--", "/dev/null", file]
}

export interface ShowPatchArgsOptions {
  hash: string
  /** 限定单个文件；缺省输出整次提交 */
  filePath?: string
  /** 提交信息头格式；默认 `--format=`（不输出信息头） */
  format?: string
}

/** 提交补丁参数（git show） */
export function buildShowPatchArgs(opts: ShowPatchArgsOptions): string[] {
  const args = ["show", ...DIFF_SAFE_ARGS, opts.format ?? "--format=", opts.hash]
  if (opts.filePath) args.push("--", opts.filePath)
  return args
}

export interface LogPatchArgsOptions {
  maxCount?: number
  since?: string
  paths?: string[]
}

/** 历史补丁参数（git log -p） */
export function buildLogPatchArgs(opts: LogPatchArgsOptions = {}): string[] {
  const args = ["log", "-p", ...DIFF_SAFE_ARGS]
  if (opts.maxCount && opts.maxCount > 0) args.push(`--max-count=${opts.maxCount}`)
  if (opts.since) args.push(`--since=${opts.since}`)
  if (opts.paths?.length) args.push("--", ...opts.paths)
  return args
}
