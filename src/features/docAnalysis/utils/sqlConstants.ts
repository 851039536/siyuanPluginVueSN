/**
 * 文档分析功能 - SQL 模板常量
 */
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

export const DOC_SELECT = `
b.id as doc_id,
b.content as doc_title,
b.hpath as doc_path,
b.box as notebook_id,
b.updated as doc_updated,
b.created as doc_created,
COALESCE(sw.total_size, 0) as content_size,
COALESCE(sw.total_word_count, 0) as word_count,
LENGTH(b.hpath) - LENGTH(REPLACE(b.hpath, '/', '')) - 1 as doc_depth`

export const DOC_SELECT_NO_SIZE = `
b.id as doc_id,
b.content as doc_title,
b.hpath as doc_path,
b.box as notebook_id,
b.updated as doc_updated,
b.created as doc_created,
0 as content_size,
0 as word_count,
LENGTH(b.hpath) - LENGTH(REPLACE(b.hpath, '/', '')) - 1 as doc_depth`

export const REF_SUBQUERY = `
  SELECT root_id, COUNT(*) as ref_count
  FROM blocks
  WHERE type != 'd' AND markdown LIKE '%((%'
  GROUP BY root_id
`

export const IMAGE_SUBQUERY = `
  SELECT root_id, COUNT(*) as image_count
  FROM blocks
  WHERE type != 'd' AND markdown LIKE '%![%'
  GROUP BY root_id
`
