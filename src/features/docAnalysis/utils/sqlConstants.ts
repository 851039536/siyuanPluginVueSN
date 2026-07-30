/**
 * 文档分析功能 - SQL 模板常量
 */
// total_size 与 total_word_count 有意同为 SUM(length)：字数统计口径已统一为字符长度，
// 两别名分别服务大小分档与字数分布两套消费语义
export const SIZE_WORDCOUNT_SUBQUERY = `
  SELECT root_id,
    SUM(length) as total_size,
    SUM(length) as total_word_count
  FROM blocks
  WHERE type != 'd'
  GROUP BY root_id
`

export const BOOKMARK_SUBQUERY = `
  SELECT block_id, value as bookmark
  FROM attributes
  WHERE name = 'bookmark'
`

/** 文档层级深度表达式（hpath 斜杠计数 - 1），供查询模板与消费方共享 */
export const DOC_DEPTH_EXPR = `LENGTH(b.hpath) - LENGTH(REPLACE(b.hpath, '/', '')) - 1`

/** 文档基础字段片段（DOC_SELECT / DOC_SELECT_NO_SIZE 共享） */
const DOC_SELECT_BASE = `
b.id as doc_id,
b.content as doc_title,
b.hpath as doc_path,
b.box as notebook_id,
b.updated as doc_updated,
b.created as doc_created,`

export const DOC_SELECT = `${DOC_SELECT_BASE}
COALESCE(sw.total_size, 0) as content_size,
COALESCE(sw.total_word_count, 0) as word_count,
${DOC_DEPTH_EXPR} as doc_depth`

export const DOC_SELECT_NO_SIZE = `${DOC_SELECT_BASE}
0 as content_size,
0 as word_count,
${DOC_DEPTH_EXPR} as doc_depth`

// 引用判据 '%((20%'（块 ID 以 14 位时间戳开头，前缀恒为 20xx），向 analyzeContentScan 的严格正则判据对齐；
// LIKE 无法完全等价，仅大幅缩小正文普通括号文本的误报
export const REF_SUBQUERY = `
  SELECT root_id, COUNT(*) as ref_count
  FROM blocks
  WHERE type != 'd' AND markdown LIKE '%((20%'
  GROUP BY root_id
`

export const IMAGE_SUBQUERY = `
  SELECT root_id, COUNT(*) as image_count
  FROM blocks
  WHERE type != 'd' AND markdown LIKE '%![%'
  GROUP BY root_id
`
