// gitPush 报告指标引擎 — 提交块公共类型（类型单一源，供兄弟模块与外部消费方引用）
//
// ⚠️ 本目录（reportMetrics/）的类型放此处而**不是** types/：
// NumstatCommit 是解析层产物类型，与解析函数同域演进；types/ 收报告展示域的共享类型。

/** 单条提交的 numstat 解析结果 */
export interface NumstatCommit {
  /** 短 hash（7 位，仅 getCommitStatsLog 新格式解析时填充，旧格式/报告数据为 undefined） */
  hash?: string
  /** 提交主题（仅 getCommitStatsLog 新格式解析时填充，旧格式/报告数据为 undefined） */
  message?: string
  /** 作者名 */
  author: string
  /** ISO 时间戳（git %aI 输出，new Date 可直接解析） */
  date: string
  /** 本次提交的文件变更 [路径, 新增行, 删除行] */
  files: Array<{ path: string, added: number, deleted: number }>
}
