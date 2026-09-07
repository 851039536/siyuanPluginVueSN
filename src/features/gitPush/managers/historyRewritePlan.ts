// 历史重写计划类型：HistoryRewriter 预计算的重建计划（拓扑序条目 + mark 引用解析结果），
// 由 FastImportRewriter 消费执行。两文件共享，避免相互导入形成循环依赖。

/** 单条待重建提交（拓扑序父先子后；parents 已解析为 ":N" mark 或原 40-hex 引用域） */
export interface RewriteEntry {
  /** 导入流 mark 编号（:N，从 1 递增，供后代父引用指向本条目的重写版） */
  mark: number
  /** 原提交根 tree hash（完整 tree 模型：内容不变，仅消息/父指针变化） */
  tree: string
  /** 作者姓名/邮箱/ISO 时间/Unix epoch（%at，raw 时间格式用） */
  an: string
  ae: string
  aI: string
  at: number
  /** 提交者姓名/邮箱/ISO 时间/Unix epoch（%ct） */
  cn: string
  ce: string
  cI: string
  ct: number
  /** 最终提交消息（保证末尾带换行；data 字节数按 UTF-8 计算） */
  message: string
  /** 最终父引用列表（":N" 或原 hash；根提交为空数组；merge 提交含多父） */
  parents: string[]
}

/** fast-import 重建计划（HistoryRewriter 预计算产物，FastImportRewriter 只负责执行） */
export interface RewritePlan {
  /** 导入临时 ref（refs/gprw/<branch>，导入完成后由 FastImportRewriter 在 finally 删除） */
  tempRef: string
  /** 待重建提交列表（拓扑序父先子后；drop 的目标不在其中，进度分母 = entries.length） */
  entries: RewriteEntry[]
  /** 全部被重写提交的原始 hash 集合（含目标；调用方据 HEAD 是否在内做祖先守卫） */
  markedHashes: Set<string>
  /** 保留提交者原始时间；false = committer 时间刷新为当前时间（与旧 commit-tree 方案语义对齐） */
  preserveDate: boolean
}
